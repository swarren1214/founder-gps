"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

type AddressSuggestion = {
  formatted: string;
  lat: number | null;
  lon: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postcode: string | null;
};

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minChars?: number;
  debounceMs?: number;
};

export function AddressAutocompleteInput({
  id,
  value,
  onChange,
  required,
  placeholder = "Start typing an address...",
  disabled,
  className,
  minChars = 5,
  debounceMs = 450
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const skipAutocompleteRef = useRef(false);
  const cacheRef = useRef(new Map<string, AddressSuggestion[]>());

  const normalizedValue = value.trim();
  const shouldSearch = normalizedValue.length >= minChars;

  const hasResults = suggestions.length > 0;
  const showMenu = isOpen && (isLoading || hasResults || Boolean(error));

  function closeMenu() {
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function pickSuggestion(suggestion: AddressSuggestion) {
    skipAutocompleteRef.current = true;
    onChange(suggestion.formatted);
    setSuggestions([]);
    closeMenu();
    setError(null);
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current || wrapperRef.current.contains(event.target as Node)) {
        return;
      }
      closeMenu();
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (skipAutocompleteRef.current) {
      skipAutocompleteRef.current = false;
      return;
    }

    if (!shouldSearch) {
      abortRef.current?.abort();
      setIsLoading(false);
      setSuggestions([]);
      setError(null);
      setActiveIndex(-1);
      return;
    }

    const cacheKey = normalizedValue.toLowerCase();
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setSuggestions(cached);
      setIsOpen(true);
      setIsLoading(false);
      setError(null);
      setActiveIndex(-1);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);
      setIsOpen(true);

      try {
        const response = await fetch(`/api/geoapify/address?text=${encodeURIComponent(normalizedValue)}`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store"
        });

        const payload = (await response.json()) as { results?: AddressSuggestion[]; error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Address lookup failed.");
        }

        const nextResults = Array.isArray(payload.results) ? payload.results : [];
        cacheRef.current.set(cacheKey, nextResults);
        setSuggestions(nextResults);
        setActiveIndex(-1);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        setSuggestions([]);
        const message = fetchError instanceof Error ? fetchError.message : "Address lookup failed.";
        setError(null);
        setIsOpen(false);
        toast.error(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [debounceMs, minChars, normalizedValue, shouldSearch]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <Input
        id={id}
        required={required}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        autoComplete="street-address"
        onFocus={() => {
          if (isLoading || hasResults || Boolean(error)) {
            setIsOpen(true);
          }
        }}
        onChange={(event) => {
          onChange(event.target.value);
          if (!isOpen) {
            setIsOpen(true);
          }
        }}
        onKeyDown={(event) => {
          if (!showMenu) {
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => Math.min(current + 1, suggestions.length - 1));
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
            return;
          }

          if (event.key === "Enter" && activeIndex >= 0 && suggestions[activeIndex]) {
            event.preventDefault();
            pickSuggestion(suggestions[activeIndex]);
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            closeMenu();
          }
        }}
      />

      {showMenu ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-border/70 bg-popover shadow-lg">
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Searching addresses...
            </div>
          ) : null}

          {!isLoading && !error && !hasResults ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">No addresses found.</p>
          ) : null}

          {!isLoading && !error && hasResults ? (
            <ul role="listbox" className="max-h-64 overflow-auto py-1">
              {suggestions.map((suggestion, index) => (
                <li key={`${suggestion.formatted}-${index}`}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors",
                      index === activeIndex ? "bg-muted" : "hover:bg-muted/70"
                    )}
                    onClick={() => pickSuggestion(suggestion)}
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>{suggestion.formatted}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
