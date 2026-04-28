import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { categoryMeta, CATEGORIES, type JobCategory } from "@/lib/categories";
import type { Job } from "@/lib/types";
import { formatSchedule, scheduleBadgeStyle } from "@/lib/schedule";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, DollarSign, Plus, Clock, Lock, Search } from "lucide-react";
import ProBadge from "@/components/ProBadge";
import StarRating from "@/components/StarRating";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const GLEN_ELLYN: [number, number] = [-88.0678, 41.8775]; // [lng, lat] for Mapbox
const JOBS_SOURCE_ID = "jobs-source";
const CLUSTER_RADIUS_LAYER = "jobs-cluster-radius";
const CLUSTER_STROKE_LAYER = "jobs-cluster-stroke";
const SINGLE_RADIUS_LAYER = "jobs-single-radius";
const SINGLE_STROKE_LAYER = "jobs-single-stroke";

// Convert meters to pixel radius at a given latitude/zoom for circle layer rendering.
// Mapbox circle layer takes a pixel radius, so we convert from meters using the
// Web Mercator scale at the layer's latitude. We use an interpolated expression
// so circles stay ~constant in real-world meters as the user zooms.
function metersToPixelsAtMaxZoom(meters: number, latitude: number) {
  return meters / 0.075 / Math.cos((latitude * Math.PI) / 180);
}

export default function Feed() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [posterRatings, setPosterRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const fetchJobs = async () => {
    // Use the public view that hides exact coordinates and address.
    // Defense-in-depth: also exclude jobs whose listing timer has already passed
    // (the cron job runs every 5 min, so we don't want a stale window between expiration and cleanup).
    const { data, error } = await supabase
      .from("jobs_public" as any)
      .select("*")
      .eq("status", "open")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    const list = (data as any as Job[]) ?? [];
    setJobs(list);
    setLoading(false);

    if (list.length === 0) {
      toast("No jobs in Glen Ellyn yet—be the first!");
    }

    const posterIds = Array.from(new Set(list.map((j) => j.poster_id).filter(Boolean)));
    if (posterIds.length > 0) {
      const { data: ratings } = await supabase
        .from("ratings")
        .select("ratee_id, score")
        .in("ratee_id", posterIds);
      const agg: Record<string, { sum: number; count: number }> = {};
      (ratings ?? []).forEach((r: any) => {
        const key = r.ratee_id as string;
        if (!agg[key]) agg[key] = { sum: 0, count: 0 };
        agg[key].sum += Number(r.score);
        agg[key].count += 1;
      });
      const out: Record<string, { avg: number; count: number }> = {};
      Object.entries(agg).forEach(([k, v]) => { out[k] = { avg: v.sum / v.count, count: v.count }; });
      setPosterRatings(out);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchJobs();

    // Realtime: refresh when any job is inserted/updated/deleted so privacy bubbles update live.
    const channel = supabase
      .channel("jobs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        () => {
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Mapbox state
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const circleSourcesRef = useRef<string[]>([]);
  const [mapTab, setMapTab] = useState<string>("map");
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [mapboxError, setMapboxError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; place_name: string; center: [number, number] }>>([]);
  const [searching, setSearching] = useState(false);

  // Fetch Mapbox token from edge function
  useEffect(() => {
    if (!user || mapboxToken) return;
    supabase.functions.invoke("get-mapbox-token").then(({ data, error }) => {
      if (error || !data?.token) {
        setMapboxError("Could not load map. Please try again later.");
        console.error("Mapbox token fetch failed", error);
        return;
      }
      setMapboxToken(data.token);
    });
  }, [user, mapboxToken]);

  // Callback ref: init Mapbox when the container mounts; tear it down when it unmounts.
  // Radix Tabs unmounts inactive panels, so this fires every time the user toggles tabs.
  const setMapContainer = (node: HTMLDivElement | null) => {
    if (node === mapContainerRef.current) return;

    // Container is leaving the DOM — clean up the existing map instance.
    if (!node && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markersRef.current = [];
      circleSourcesRef.current = [];
    }

    mapContainerRef.current = node;

    // Container just mounted — initialize the map.
    if (node && mapboxToken && !mapRef.current) {
      mapboxgl.accessToken = mapboxToken;
      const map = new mapboxgl.Map({
        container: node,
        style: "mapbox://styles/mapbox/streets-v12",
        center: GLEN_ELLYN, // [-88.0678, 41.8775] => Glen Ellyn, IL
        zoom: 13,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => map.resize());
      mapRef.current = map;
    }
  };

  // If the token arrives after the container is already mounted, initialize then.
  useEffect(() => {
    if (mapboxToken && mapContainerRef.current && !mapRef.current) {
      const node = mapContainerRef.current;
      mapContainerRef.current = null; // force setMapContainer to treat as new mount
      setMapContainer(node);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxToken]);

  // Final cleanup on full component unmount (prevents WebGL context leaks).
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = [];
      circleSourcesRef.current = [];
    };
  }, []);

  // Force resize when the Map tab becomes active (container may have been 0x0 mid-transition).
  useEffect(() => {
    if (mapTab !== "map") return;
    const t = setTimeout(() => mapRef.current?.resize(), 100);
    return () => clearTimeout(t);
  }, [mapTab]);

  // Build a clustered GeoJSON source of all open jobs and render privacy bubbles.
  // - Single jobs: 200m semi-transparent green circle
  // - Clusters:    300m circle (slightly larger to indicate multiple jobs)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapboxToken) return;

    const featureCollection = {
      type: "FeatureCollection" as const,
      features: jobs
        .filter((j) => j.location_lat != null && j.location_lng != null)
        .map((j) => ({
          type: "Feature" as const,
          properties: {
            id: j.id,
            title: j.title,
            budget: Number(j.budget),
            category: j.category,
          },
          geometry: {
            type: "Point" as const,
            coordinates: [j.location_lng!, j.location_lat!],
          },
        })),
    };

    const apply = () => {
      // Update or create source with clustering enabled
      const existing = map.getSource(JOBS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (existing) {
        existing.setData(featureCollection as any);
        return;
      }

      map.addSource(JOBS_SOURCE_ID, {
        type: "geojson",
        data: featureCollection as any,
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 16,
      });

      const meterRadiusSingle = 200;
      const meterRadiusCluster = 300;
      const lat = GLEN_ELLYN[1];
      const pxSingle = metersToPixelsAtMaxZoom(meterRadiusSingle, lat);
      const pxCluster = metersToPixelsAtMaxZoom(meterRadiusCluster, lat);

      // Cluster bubbles (point_count > 1)
      map.addLayer({
        id: CLUSTER_RADIUS_LAYER,
        type: "circle",
        source: JOBS_SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#22c55e",
          "circle-opacity": 0.3,
          "circle-radius": [
            "interpolate", ["exponential", 2], ["zoom"],
            0, 0,
            22, pxCluster,
          ],
        },
      });
      map.addLayer({
        id: CLUSTER_STROKE_LAYER,
        type: "circle",
        source: JOBS_SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#22c55e",
          "circle-stroke-width": 2,
          "circle-radius": [
            "interpolate", ["exponential", 2], ["zoom"],
            0, 0,
            22, pxCluster,
          ],
        },
      });

      // Single-job bubbles
      map.addLayer({
        id: SINGLE_RADIUS_LAYER,
        type: "circle",
        source: JOBS_SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#22c55e",
          "circle-opacity": 0.3,
          "circle-radius": [
            "interpolate", ["exponential", 2], ["zoom"],
            0, 0,
            22, pxSingle,
          ],
        },
      });
      map.addLayer({
        id: SINGLE_STROKE_LAYER,
        type: "circle",
        source: JOBS_SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#22c55e",
          "circle-stroke-width": 2,
          "circle-radius": [
            "interpolate", ["exponential", 2], ["zoom"],
            0, 0,
            22, pxSingle,
          ],
        },
      });

      const cursorIn = () => (map.getCanvas().style.cursor = "pointer");
      const cursorOut = () => (map.getCanvas().style.cursor = "");
      [SINGLE_RADIUS_LAYER, CLUSTER_RADIUS_LAYER].forEach((layerId) => {
        map.on("mouseenter", layerId, cursorIn);
        map.on("mouseleave", layerId, cursorOut);
      });

      // Single-job popup
      map.on("click", SINGLE_RADIUS_LAYER, (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const props = feature.properties as { id: string; title: string; budget: number };
        const coords = (feature.geometry as any).coordinates.slice() as [number, number];
        const html = `
          <div style="font-family: inherit; min-width: 200px;">
            <p style="font-weight: 800; margin: 0; font-size: 14px;">${String(props.title).replace(/</g, "&lt;")}</p>
            <p style="font-size: 13px; color: #16a34a; font-weight: 700; margin: 4px 0 0;">$${Number(props.budget).toFixed(0)}</p>
            <p style="font-size: 11px; font-style: italic; color: #6b7280; margin: 6px 0 0;">Approximate area — exact address shared after acceptance</p>
            <a href="/jobs/${props.id}" style="display: inline-block; margin-top: 10px; padding: 6px 12px; font-size: 12px; font-weight: 700; color: white; background: #22c55e; border-radius: 8px; text-decoration: none;">View Details →</a>
          </div>`;
        new mapboxgl.Popup({ offset: 12 }).setLngLat(coords).setHTML(html).addTo(map);
      });

      // Cluster popup — shows multi-job list (truncated past 3)
      map.on("click", CLUSTER_RADIUS_LAYER, (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const clusterId = feature.properties?.cluster_id;
        const pointCount = Number(feature.properties?.point_count ?? 0);
        const coords = (feature.geometry as any).coordinates.slice() as [number, number];
        const source = map.getSource(JOBS_SOURCE_ID) as mapboxgl.GeoJSONSource;
        source.getClusterLeaves(clusterId, pointCount, 0, (err, leaves) => {
          if (err || !leaves) return;
          const items = leaves.map((l: any) => l.properties as { id: string; title: string; budget: number });
          const visible = items.slice(0, 3);
          const remaining = items.length - visible.length;

          const rows = visible
            .map(
              (it) => `
                <a href="/jobs/${it.id}" style="display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-decoration: none; color: inherit;">
                  <span style="font-weight: 700; font-size: 13px; color: #0f172a;">${String(it.title).replace(/</g, "&lt;")}</span>
                  <span style="font-weight: 700; font-size: 13px; color: #16a34a;">$${Number(it.budget).toFixed(0)}</span>
                </a>`
            )
            .join("");

          const moreLine =
            remaining > 0
              ? `<p style="margin: 8px 0 0; font-size: 12px; font-weight: 600; color: #16a34a;">+ ${remaining} more job${remaining === 1 ? "" : "s"}. Click circle to zoom in.</p>`
              : "";

          const html = `
            <div style="font-family: inherit; min-width: 240px;">
              <p style="font-weight: 800; margin: 0 0 6px; font-size: 13px; color: #16a34a;">${items.length} jobs in this area</p>
              ${rows}
              ${moreLine}
              <p style="font-size: 11px; font-style: italic; color: #6b7280; margin: 8px 0 0;">Exact addresses hidden for privacy</p>
            </div>`;
          new mapboxgl.Popup({ offset: 12, maxWidth: "320px" }).setLngLat(coords).setHTML(html).addTo(map);
        });
      });
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [jobs, mapboxToken, mapTab]);

  // Geocoding search (Glen Ellyn-focused)
  useEffect(() => {
    if (!mapboxToken || searchQuery.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          searchQuery
        )}.json?access_token=${mapboxToken}&proximity=${GLEN_ELLYN[0]},${GLEN_ELLYN[1]}&bbox=-88.15,41.83,-87.99,41.92&limit=5&country=US`;
        const res = await fetch(url);
        const json = await res.json();
        setSearchResults(
          (json.features ?? []).map((f: any) => ({ id: f.id, place_name: f.place_name, center: f.center }))
        );
      } catch (e) {
        console.error("Geocoding failed", e);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery, mapboxToken]);

  const flyToResult = (center: [number, number], place_name: string) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center, zoom: 16, essential: true });
    new mapboxgl.Popup({ offset: 12 })
      .setLngLat(center)
      .setHTML(`<div style="font-family: inherit; font-size: 12px;">${place_name}</div>`)
      .addTo(map);
    setSearchResults([]);
    setSearchQuery(place_name);
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <Header />
      <div className="container py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold md:text-4xl">Jobs near you</h1>
            <p className="mt-2 text-muted-foreground">Lend a hand or find someone who can.</p>
          </div>
          <Button asChild className="rounded-2xl shadow-soft" size="lg">
            <Link to="/post"><Plus className="mr-1 h-4 w-4" />Post a job</Link>
          </Button>
        </div>

        {/* Worker incentive */}
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-accent-soft p-4 text-sm">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground font-extrabold">A</span>
          <p className="text-secondary-foreground">
            <span className="font-bold">Your Trust Grade and profile are shared with clients</span> to help them choose you — do a great job to keep your grade high!
          </p>
        </div>

        <Tabs value={mapTab} onValueChange={setMapTab}>
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
                <Button asChild className="mt-4 rounded-2xl"><Link to="/post">Post a job</Link></Button>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {jobs.map((job) => {
                  const meta = categoryMeta(job.category);
                  const Icon = meta.icon;
                  return (
                    <Card key={job.id} className="group flex flex-col rounded-3xl border-border/60 p-6 shadow-card transition-smooth hover:-translate-y-1 hover:shadow-soft">
                      <div className="flex items-start justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${meta.color}1a` }}>
                          <Icon className="h-6 w-6" style={{ color: meta.color }} />
                        </div>
                        <div className="flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-sm font-bold text-accent-foreground">
                          <DollarSign className="h-3.5 w-3.5" />{Number(job.budget).toFixed(0)}
                        </div>
                      </div>
                      <div className="mt-4 flex items-start justify-between gap-2">
                        <h3 className="font-extrabold leading-tight">{job.title}</h3>
                        {(job as any).pro_only && <ProBadge compact />}
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{job.description}</p>

                      <div className="mt-2">
                        <StarRating
                          score={posterRatings[job.poster_id]?.avg ?? null}
                          count={posterRatings[job.poster_id]?.count ?? 0}
                          emptyLabel="New poster"
                          compact
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", scheduleBadgeStyle(job.schedule_window))}>
                          <Clock className="h-3 w-3" />{formatSchedule(job.scheduled_for, job.schedule_window)}
                        </span>
                        {job.location_text && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />{job.location_text}
                          </span>
                        )}
                      </div>

                      <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Lock className="h-3 w-3" /> Exact address shared after acceptance
                      </p>

                      <Button asChild className="mt-4 h-12 w-full rounded-2xl text-base">
                        <Link to={`/jobs/${job.id}`}>View & request</Link>
                      </Button>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="map" className="mt-6">
            {/* Search bar */}
            <div className="relative mb-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Glen Ellyn addresses or places…"
                  className="h-12 rounded-2xl pl-11"
                  disabled={!mapboxToken}
                />
              </div>
              {searchResults.length > 0 && (
                <div className="absolute z-[1000] mt-2 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
                  {searchResults.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => flyToResult(r.center, r.place_name)}
                      className="flex w-full items-start gap-2 px-4 py-3 text-left text-sm transition-smooth hover:bg-muted"
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>{r.place_name}</span>
                    </button>
                  ))}
                </div>
              )}
              {searching && searchResults.length === 0 && searchQuery.length >= 3 && (
                <p className="absolute mt-2 text-xs text-muted-foreground">Searching…</p>
              )}
            </div>

            <div className="relative h-[600px] overflow-hidden rounded-3xl border border-border shadow-card">
              {mapboxError ? (
                <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
                  {mapboxError}
                </div>
              ) : !mapboxToken ? (
                <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
                  Loading map…
                </div>
              ) : null}
              <div ref={setMapContainer} className="absolute inset-0 h-full w-full" />
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> For privacy, jobs show a ~500m neighborhood circle — never an exact address.
            </p>
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
      <BottomNav />
    </div>
  );
}
