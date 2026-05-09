"use client";

import { FormEvent, useState } from "react";
import { Crosshair, Minus, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

type MapControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
  onSearch: (query: string) => Promise<boolean>;
  isLocating?: boolean;
  isSearching?: boolean;
};

export function MapControls({
  onZoomIn,
  onZoomOut,
  onLocate,
  onSearch,
  isLocating = false,
  isSearching = false
}: MapControlsProps) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const found = await onSearch(trimmed);
    if (found) {
      setSearchOpen(false);
    }
  }

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-30 flex flex-col items-end gap-2">
      {searchOpen ? (
        <form
          onSubmit={handleSubmit}
          className="flex w-[240px] items-center gap-2 rounded-xl border border-border/70 bg-card/95 p-2 shadow-xl backdrop-blur"
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search place"
            className="h-8 flex-1 rounded-md border border-border/70 bg-background px-2 text-sm outline-none focus:border-primary/50"
            autoFocus
          />
          <Button type="submit" size="icon" variant="secondary" className="p-2" aria-label="Run map search" disabled={isSearching}>
            <Search className="h-4 w-4" />
          </Button>
        </form>
      ) : null}

      <div className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card/95 shadow-xl backdrop-blur">
        <Button type="button" size="icon" variant="ghost" className="p-2" aria-label="Zoom in" onClick={onZoomIn}>
          <Plus className="h-4 w-4" />
        </Button>
        <div className="h-px bg-border/70" />
        <Button type="button" size="icon" variant="ghost" className="p-2" aria-label="Zoom out" onClick={onZoomOut}>
          <Minus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card/95 shadow-xl backdrop-blur">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="p-2"
          aria-label="Search locations"
          onClick={() => setSearchOpen((open) => !open)}
          disabled={isSearching}
        >
          <Search className="h-4 w-4" />
        </Button>
        <div className="h-px bg-border/70" />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="p-2"
          aria-label="Use current location"
          onClick={onLocate}
          disabled={isLocating}
        >
          <Crosshair className={`h-4 w-4 ${isLocating ? "animate-pulse" : ""}`} />
        </Button>
      </div>
    </div>
  );
}
