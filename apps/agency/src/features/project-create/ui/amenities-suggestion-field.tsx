"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ListPlus, Sparkles } from "lucide-react";
import type { AmenitySuggestionResponse } from "@propertyflow/contracts";
import { projectAmenitiesSelectedEvent } from "@features/listing-create/model/project-amenities-events";
import styles from "./amenities-suggestion-field.module.css";

export function AmenitiesSuggestionField({
  className,
  defaultValue = "",
  label = "Shared amenities",
  listenForProjectAmenities = false,
  placeholder = "pool, gym, lobby, parking"
}: {
  className?: string;
  defaultValue?: string;
  label?: string;
  listenForProjectAmenities?: boolean;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [projectAmenities, setProjectAmenities] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<AmenitySuggestionResponse["items"]>([]);
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeToken = useMemo(() => value.split(",").at(-1)?.trim() ?? "", [value]);

  useEffect(() => {
    if (!listenForProjectAmenities) {
      return;
    }

    function handleProjectAmenities(event: Event) {
      const detail = (event as CustomEvent<{ amenities?: string[] }>).detail;
      setProjectAmenities(detail?.amenities ?? []);
    }

    window.addEventListener(projectAmenitiesSelectedEvent, handleProjectAmenities);

    return () => window.removeEventListener(projectAmenitiesSelectedEvent, handleProjectAmenities);
  }, [listenForProjectAmenities]);

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

    setValue(formatAmenitiesForNextInput(nextAmenities));
    setSuggestions([]);
    setFocused(true);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <label className={`${styles.field} ${className ?? ""}`}>
      <span>{label}</span>
      <div className={styles.lookupInput}>
        <Sparkles size={16} />
        <input
          autoComplete="off"
          ref={inputRef}
          name="amenities"
          onBlur={() => window.setTimeout(() => setFocused(false), 160)}
          onChange={(event) => {
            setValue(event.currentTarget.value);
            setFocused(true);
          }}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          value={value}
        />
      </div>
      {listenForProjectAmenities && projectAmenities.length ? (
        <div className={styles.inheritedAmenities}>
          <strong>Already covered by selected project</strong>
          <div>
            {projectAmenities.map((amenity) => (
              <span key={amenity}>{amenity}</span>
            ))}
          </div>
        </div>
      ) : null}
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

function formatAmenitiesForNextInput(amenities: string[]) {
  return amenities.length ? `${amenities.join(", ")}, ` : "";
}
