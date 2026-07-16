"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Search } from "lucide-react";
import type { PropertyProjectSearchResponse, PropertyProjectSuggestion } from "@propertyflow/contracts";
import type { PropertyProjectStatus, ThailandMarket } from "@propertyflow/domain";
import { projectAmenitiesSelectedEvent } from "../model/project-amenities-events";
import styles from "./create-listing-form.module.css";

const projectStatuses = [
  { label: "Completed", value: "completed" },
  { label: "Under construction", value: "under_construction" },
  { label: "Planned", value: "planned" },
  { label: "Paused", value: "paused" }
] satisfies Array<{ label: string; value: PropertyProjectStatus }>;

interface ProjectAutocompleteFieldProps {
  broadcastProjectAmenities?: boolean;
  initialProject?: {
    developer?: string;
    name: string;
    status: PropertyProjectStatus;
  };
  market?: ThailandMarket;
}

export function ProjectAutocompleteField({
  broadcastProjectAmenities = false,
  initialProject,
  market: fixedMarket
}: ProjectAutocompleteFieldProps = {}) {
  const [developer, setDeveloper] = useState(initialProject?.developer ?? "");
  const [market, setMarket] = useState<ThailandMarket>(fixedMarket ?? "pattaya");
  const [name, setName] = useState(initialProject?.name ?? "");
  const [status, setStatus] = useState<PropertyProjectStatus>(initialProject?.status ?? "completed");
  const [suggestions, setSuggestions] = useState<PropertyProjectSuggestion[]>([]);
  const [touched, setTouched] = useState(false);
  const [selectedProjectName, setSelectedProjectName] = useState(initialProject?.name ?? "");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fixedMarket) {
      setMarket(fixedMarket);
      return;
    }

    const form = containerRef.current?.closest("form");
    const marketField = form?.elements.namedItem("market") as HTMLSelectElement | null;

    if (!marketField) {
      return;
    }

    const syncMarket = () => setMarket(marketField.value as ThailandMarket);

    syncMarket();
    marketField.addEventListener("change", syncMarket);

    return () => marketField.removeEventListener("change", syncMarket);
  }, [fixedMarket]);

  useEffect(() => {
    if (selectedProjectName && normalizeProjectName(name) === normalizeProjectName(selectedProjectName)) {
      setSuggestions([]);
      return;
    }

    if (name.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams({ limit: "8", market, query: name });

      fetch(`/api/property-projects?${params.toString()}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : undefined))
        .then((body: PropertyProjectSearchResponse | undefined) => {
          setSuggestions(body?.items ?? []);
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
  }, [market, name, selectedProjectName]);

  function selectProject(project: PropertyProjectSuggestion) {
    setName(project.name);
    setStatus(project.status);
    setDeveloper(project.developer ?? "");
    setSelectedProjectName(project.name);
    setSuggestions([]);
    setTouched(false);
    broadcastAmenities(project.amenities ?? []);
  }

  function broadcastAmenities(amenities: string[]) {
    if (!broadcastProjectAmenities) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent(projectAmenitiesSelectedEvent, {
        detail: { amenities }
      })
    );
  }

  return (
    <div className={styles.projectLookup} ref={containerRef}>
      <label className={styles.wideField}>
        <span>Project / development name</span>
        <div className={styles.lookupInput}>
          <Search size={16} />
          <input
            autoComplete="off"
            name="projectName"
            onBlur={() => window.setTimeout(() => setSuggestions([]), 160)}
            onChange={(event) => {
              setName(event.currentTarget.value);
              setSelectedProjectName("");
              setTouched(true);
              broadcastAmenities([]);
            }}
            onFocus={() => setTouched(true)}
            placeholder="Start typing: Riviera, Laguna, Copacabana..."
            value={name}
          />
        </div>
      </label>

      {touched && suggestions.length ? (
        <div className={styles.suggestionList}>
          {suggestions.map((project) => (
            <button key={project.id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectProject(project)} type="button">
              <Building2 size={15} />
              <span>
                <strong>{project.name}</strong>
                <small>
                  {project.status.replace("_", " ")}
                  {project.developer ? ` · ${project.developer}` : ""} · {project.listingCount} listings
                </small>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <label className={styles.field}>
        <span>Project status</span>
        <select name="projectStatus" onChange={(event) => setStatus(event.currentTarget.value as PropertyProjectStatus)} value={status}>
          {projectStatuses.map((projectStatus) => (
            <option key={projectStatus.value} value={projectStatus.value}>
              {projectStatus.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>Developer</span>
        <input name="projectDeveloper" onChange={(event) => setDeveloper(event.currentTarget.value)} placeholder="Developer name" value={developer} />
      </label>
    </div>
  );
}

function normalizeProjectName(value: string) {
  return value.trim().toLowerCase();
}
