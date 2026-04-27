// Compares Before/After photos for a job using Lovable AI (Gemini vision)
// and returns a structured verification result. The function does NOT mutate
// the job — the client decides whether to auto-release or wait for poster approval.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a job-completion verifier for a neighborhood odd-jobs app.
You receive a job description, a "before" photo, and an "after" photo taken by the worker.
Decide whether the after photo plausibly shows the described job completed compared to the before photo.
Be lenient about lighting/angle differences but strict about whether the actual work was done.
Return your decision via the verify_completion tool.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { data: job, error: jobErr } = await admin
      .from("jobs")
      .select("id, poster_id, accepted_doer_id, title, description, before_photo_url, after_photo_url")
      .eq("id", job_id)
      .single();
    if (jobErr || !job) throw new Error("Job not found");

    if (job.poster_id !== userId && job.accepted_doer_id !== userId) {
      return new Response(JSON.stringify({ error: "Not a participant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!job.before_photo_url || !job.after_photo_url) {
      return new Response(JSON.stringify({ error: "Both photos required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sign the photo URLs so the model can fetch them
    const sign = async (path: string) => {
      const { data, error } = await admin.storage.from("job-photos").createSignedUrl(path, 600);
      if (error) throw error;
      return data.signedUrl;
    };
    const beforeUrl = await sign(job.before_photo_url);
    const afterUrl = await sign(job.after_photo_url);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: `Job title: ${job.title}\nJob description: ${job.description}\nFirst image is BEFORE, second image is AFTER.` },
              { type: "image_url", image_url: { url: beforeUrl } },
              { type: "image_url", image_url: { url: afterUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "verify_completion",
              description: "Return verification verdict.",
              parameters: {
                type: "object",
                properties: {
                  verdict: { type: "string", enum: ["completed", "partial", "not_completed", "unclear"] },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  explanation: { type: "string" },
                },
                required: ["verdict", "confidence", "explanation"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "verify_completion" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, text);
      throw new Error("AI gateway error");
    }

    const ai = await aiResp.json();
    const toolCall = ai?.choices?.[0]?.message?.tool_calls?.[0];
    let result: any = { verdict: "unclear", confidence: 0, explanation: "Could not parse AI response." };
    if (toolCall?.function?.arguments) {
      try { result = JSON.parse(toolCall.function.arguments); } catch { /* keep fallback */ }
    }
    result.verified_at = new Date().toISOString();
    result.model = "google/gemini-2.5-flash";

    // Persist the verification result to the job for later review
    await admin.from("jobs").update({ ai_verification: result }).eq("id", job_id);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("verify-job-photos error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
