import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Lock, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const GLEN_ELLYN: [number, number] = [-88.0678, 41.8775];
// Bounding box around Glen Ellyn, IL (a few miles in each direction)
const GE_BBOX = "-88.15,41.83,-87.99,41.92";

export type SelectedAddress = {
  address: string;
  lat: number;
  lng: number;
};

type Feature = {
  id: string;
  place_name: string;
  center: [number, number];
};

interface Props {
  token: string | null;
  value: string;
  onChange: (val: string) => void;
  onSelect: (addr: SelectedAddress) => void;
}

export default function MapboxAddressSearch({ token, value, onChange, onSelect }: Props) {
  const [results, setResults] = useState<Feature[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    if (!token || value.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          value,
        )}.json?access_token=${token}&proximity=${GLEN_ELLYN[0]},${GLEN_ELLYN[1]}&bbox=${GE_BBOX}&limit=5&country=US&types=address`;
        const res = await fetch(url);
        const data = await res.json();
        setResults(data.features ?? []);
        setOpen(true);
        setHighlight(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [value, token]);

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (f: Feature) => {
    skipNextSearch.current = true;
    onChange(f.place_name);
    onSelect({ address: f.place_name, lng: f.center[0], lat: f.center[1] });
    setOpen(false);
    setResults([]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        id="addr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Start typing your Glen Ellyn address…"
        maxLength={200}
        autoComplete="off"
        className="h-12 rounded-xl text-base"
      />
      {loading && (
        <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
          {results.map((f, i) => (
            <button
              key={f.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(f);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                i === highlight ? "bg-accent text-accent-foreground" : "hover:bg-muted",
              )}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{f.place_name}</span>
            </button>
          ))}
        </div>
      )}
      {open && !loading && results.length === 0 && value.trim().length >= 3 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-popover px-3 py-2.5 text-sm text-muted-foreground shadow-lg">
          No Glen Ellyn addresses found. Keep typing…
        </div>
      )}
    </div>
  );
}
