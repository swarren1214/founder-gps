"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Crosshair, Minus, Plus, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="pointer-events-auto absolute right-4 top-4 z-30 flex flex-col items-end">
      <AnimatePresence>
        {searchOpen ? (
          <motion.form
            key="search-form"
            onSubmit={handleSubmit}
            className="absolute right-[calc(100%_+_8px)] top-0 w-[240px]"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="relative flex items-center backdrop-blur">
              <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search place"
                autoFocus
                className="h-10 pl-9 pr-10 border-0 bg-transparent focus-visible:ring-0"
              />
              <Button type="submit" size="icon" variant="ghost" className="absolute right-1 h-8 w-8 p-0" aria-label="Run map search" disabled={isSearching}>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>

      <div className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card/95 shadow-xl backdrop-blur">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="p-4"
          aria-label="Search locations"
          onClick={() => setSearchOpen((open) => !open)}
          disabled={isSearching}
        >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </motion.div>
        </Button>
        <div className="h-px bg-border/70" />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="p-4"
          aria-label="Use current location"
          onClick={onLocate}
          disabled={isLocating}
        >
          <Crosshair className={`h-4 w-4 ${isLocating ? "animate-pulse" : ""}`} />
        </Button>
        <div className="h-px bg-border/70" />
        <Button type="button" size="icon" variant="ghost" className="p-4" aria-label="Zoom in" onClick={onZoomIn}>
          <Plus className="h-4 w-4" />
        </Button>
        <div className="h-px bg-border/70" />
        <Button type="button" size="icon" variant="ghost" className="p-4" aria-label="Zoom out" onClick={onZoomOut}>
          <Minus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
