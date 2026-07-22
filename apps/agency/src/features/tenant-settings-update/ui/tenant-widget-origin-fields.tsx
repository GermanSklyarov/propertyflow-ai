"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import styles from "./update-tenant-settings-form.module.css";

export function TenantWidgetOriginFields({
  customDomain,
  origins
}: {
  customDomain?: string;
  origins: string[];
}) {
  const [originInput, setOriginInput] = useState("");
  const [originList, setOriginList] = useState(() => normalizeOrigins(origins));
  const suggestedOrigin = customDomain ? normalizeOrigin(`https://${customDomain}`) : undefined;
  const canAddSuggestedOrigin = Boolean(suggestedOrigin && !originList.includes(suggestedOrigin));
  const serializedOrigins = useMemo(() => originList.join("\n"), [originList]);

  function addOrigin(value: string) {
    const normalizedOrigin = normalizeOrigin(value);

    if (!normalizedOrigin) {
      return;
    }

    setOriginList((current) => (current.includes(normalizedOrigin) ? current : [...current, normalizedOrigin]));
    setOriginInput("");
  }

  function removeOrigin(origin: string) {
    setOriginList((current) => current.filter((currentOrigin) => currentOrigin !== origin));
  }

  return (
    <div className={styles.originBuilder}>
      <textarea hidden name="allowedOrigins" readOnly value={serializedOrigins} />

      <div className={styles.originInputRow}>
        <label className={styles.field}>
          <span>Website origin</span>
          <input
            onChange={(event) => setOriginInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addOrigin(originInput);
              }
            }}
            placeholder="https://agency.example.com"
            type="url"
            value={originInput}
          />
        </label>
        <button disabled={!originInput.trim()} onClick={() => addOrigin(originInput)} type="button">
          <Plus size={16} />
          Add origin
        </button>
      </div>

      {canAddSuggestedOrigin ? (
        <button className={styles.originSuggestion} onClick={() => addOrigin(suggestedOrigin ?? "")} type="button">
          <Plus size={15} />
          Use custom domain: {suggestedOrigin}
        </button>
      ) : null}

      {originList.length ? (
        <div className={styles.originList} aria-label="Allowed widget origins">
          {originList.map((origin) => (
            <div className={styles.originChip} key={origin}>
              <span>{origin}</span>
              <button aria-label={`Remove ${origin}`} onClick={() => removeOrigin(origin)} type="button">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.originEmpty}>
          Widget is open while testing. Add production website origins before sharing the snippet publicly.
        </div>
      )}
    </div>
  );
}

function normalizeOrigins(origins: string[]) {
  return origins.reduce<string[]>((normalizedOrigins, origin) => {
    const normalizedOrigin = normalizeOrigin(origin);

    if (normalizedOrigin && !normalizedOrigins.includes(normalizedOrigin)) {
      normalizedOrigins.push(normalizedOrigin);
    }

    return normalizedOrigins;
  }, []);
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value.trim()).origin.toLowerCase();
  } catch (_error) {
    return undefined;
  }
}
