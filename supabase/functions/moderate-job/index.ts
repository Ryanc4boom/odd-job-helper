import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, description } = await req.json();
    const text = `${title ?? ""}\n${description ?? ""}`.trim();
    if (!text) {
      return new Response(JSON.stringify({ error: "Missing job text" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a content moderator for "Odd Job", a community marketplace for simple, NON-SPECIALIZED neighborly tasks like yardwork, moving help, cleaning, errands, pet care, and small assembly.

You must BLOCK any job that requires:
- Licensed trades: plumbing, electrical, HVAC, gas work, roofing
- Power tools beyond basic (chainsaws, table saws, jackhammers, welding)
- Structural/construction: framing, drywall installation, concrete pouring
- Hazardous work: asbestos, lead, working at heights >2 stories, chemical handling
- Medical/legal/financial professional services
- Anything illegal or unsafe

ALLOW general help: lawn mowing, raking, weeding, moving boxes, cleaning, dog walking, grocery runs, simple IKEA-style assembly, hanging pictures, basic painting of one wall.

Use the classify_job function to respond.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Job to review:\n\n${text}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "classify_job",
            description: "Classify whether the job is allowed on Odd Job.",
            parameters: {
              type: "object",
              properties: {
                allowed: { type: "boolean", description: "True if the job is allowed." },
                reason: { type: "string", description: "Friendly 1-2 sentence explanation. If blocked, say which specialized work was detected." },
                category: {
                  type: "string",
                  enum: ["yardwork","moving","cleaning","delivery","pet_care","errands","assembly","other"],
                  description: "Best-fit category."
                },
              },
              required: ["allowed", "reason", "category"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "classify_job" } },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      return new Response(JSON.stringify({ error: "Moderation service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : null;
    if (!args) {
      return new Response(JSON.stringify({ error: "Invalid AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("moderate-job error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
