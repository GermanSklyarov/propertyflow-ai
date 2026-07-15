"use client";

import { useEffect, useMemo, useState } from "react";
import { ListPlus, Sparkles } from "lucide-react";
import type { AmenitySuggestionResponse } from "@propertyflow/contracts";
import styles from "./amenities-suggestion-field.module.css";

export function AmenitiesSuggestionField({
  className,
  defaultValue = ""
}: {
  className?: string;
  defaultValue?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AmenitySuggestionResponse["items"]>([]);
  const [value, setValue] = useState(defaultValue);
  const activeToken = useMemo(() => value.split(",").at(-1)?.trim() ?? "", [value]);

  useEffect(() => {
    if (activeToken.length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams({ limit: "8", query: activeToken });

      fetch(`/api/amenities?${params.toString()}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : undefined))
        .then((body: AmenitySuggestionResponse | undefined) => {
          const existing = new Set(splitAmenities(value).map(normalizeAmenity));
          setSuggestions((body?.items ?? []).filter((item) => !existing.has(item.normalized)));
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }

          setSuggestions([]);
        });
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [activeToken, value]);

  function selectAmenity(label: string) {
    const amenities = splitAmenities(value);
    const nextAmenities = activeToken ? amenities.slice(0, -1) : amenities;
    const existing = new Set(nextAmenities.map(normalizeAmenity));

    if (!existing.has(normalizeAmenity(label))) {
      nextAmenities.push(label);
    }

    setValue(nextAmenities.join(", "));
    setSuggestions([]);
    setFocused(false);
  }

  return (
    <label className={`${styles.field} ${className ?? ""}`}>
      <span>Shared amenities</span>
      <div className={styles.lookupInput}>
        <Sparkles size={16} />
        <input
          autoComplete="off"
          name="amenities"
          onBlur={() => window.setTimeout(() => setFocused(false), 160)}
          onChange={(event) => {
            setValue(event.currentTarget.value);
            setFocused(true);
          }}
          onFocus={() => setFocused(true)}
          placeholder="pool, gym, lobby, parking"
          value={value}
        />
      </div>
      {focused && suggestions.length ? (
        <div className={styles.suggestionList}>
          {suggestions.map((amenity) => (
            <button
              key={amenity.normalized}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectAmenity(amenity.label)}
              type="button"
            >
              <ListPlus size={15} />
              <span>
                <strong>{amenity.label}</strong>
                <small>
                  {amenity.count} uses · {amenity.sources.join(" + ")}
                </small>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}

function splitAmenities(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAmenity(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
