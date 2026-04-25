import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { categoryMeta, CATEGORIES, type JobCategory } from "@/lib/categories";
import type { Job } from "@/lib/types";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { MapPin, DollarSign, Plus } from "lucide-react";

function buildIcon(category: JobCategory) {
  const meta = categoryMeta(category);
  const Icon = meta.icon;
  const html = `<div class="job-pin" style="background:${meta.color}">${renderToStaticMarkup(<Icon size={18} strokeWidth={2.5} />)}</div>`;
  return L.divIcon({ html, className: "", iconSize: [36, 36], iconAnchor: [18, 18] });
}

export default function Feed() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("jobs").select("*").eq("status", "open").order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setJobs((data as any as Job[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  const center = useMemo<[number, number]>(() => {
    const withLoc = jobs.filter((j) => j.location_lat && j.location_lng);
    if (withLoc.length === 0) return [37.7749, -122.4194];
    const lat = withLoc.reduce((s, j) => s + (j.location_lat ?? 0), 0) / withLoc.length;
    const lng = withLoc.reduce((s, j) => s + (j.location_lng ?? 0), 0) / withLoc.length;
    return [lat, lng];
  }, [jobs]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold md:text-4xl">Jobs near you</h1>
            <p className="mt-2 text-muted-foreground">Lend a hand or find someone who can.</p>
          </div>
          <Button asChild className="rounded-2xl shadow-soft" size="lg">
            <a href="/post"><Plus className="mr-1 h-4 w-4" />Post a job</a>
          </Button>
        </div>

        <Tabs defaultValue="list">
          <TabsList className="rounded-2xl">
            <TabsTrigger value="list" className="rounded-xl">List</TabsTrigger>
            <TabsTrigger value="map" className="rounded-xl">Map</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-6">
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : jobs.length === 0 ? (
              <Card className="rounded-3xl p-12 text-center">
                <p className="text-lg font-bold">No jobs yet</p>
                <p className="mt-1 text-muted-foreground">Be the first to post one!</p>
                <Button asChild className="mt-4 rounded-2xl"><a href="/post">Post a job</a></Button>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {jobs.map((job) => {
                  const meta = categoryMeta(job.category);
                  const Icon = meta.icon;
                  return (
                    <Card key={job.id} className="group rounded-3xl border-border/60 p-6 shadow-card transition-smooth hover:-translate-y-1 hover:shadow-soft">
                      <div className="flex items-start justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${meta.color}1a` }}>
                          <Icon className="h-6 w-6" style={{ color: meta.color }} />
                        </div>
                        <div className="flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-sm font-bold text-accent-foreground">
                          <DollarSign className="h-3.5 w-3.5" />{Number(job.budget).toFixed(0)}
                        </div>
                      </div>
                      <h3 className="mt-4 font-extrabold leading-tight">{job.title}</h3>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{job.description}</p>
                      {job.location_text && (
                        <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />{job.location_text}
                        </p>
                      )}
                      <Button variant="outline" className="mt-4 w-full rounded-2xl" disabled>I can help (soon)</Button>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="map" className="mt-6">
            <div className="h-[600px] overflow-hidden rounded-3xl border border-border shadow-card">
              <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {jobs.filter((j) => j.location_lat && j.location_lng).map((j) => (
                  <Marker key={j.id} position={[j.location_lat!, j.location_lng!]} icon={buildIcon(j.category)}>
                    <Popup>
                      <div className="font-sans">
                        <p className="font-extrabold">{j.title}</p>
                        <p className="text-xs text-muted-foreground">${Number(j.budget).toFixed(0)} · {categoryMeta(j.category).label}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {CATEGORIES.map(({ value, label, icon: Icon, color }) => (
                <span key={value} className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-semibold shadow-card">
                  <Icon className="h-3.5 w-3.5" style={{ color }} />{label}
                </span>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
