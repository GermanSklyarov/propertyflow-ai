"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import styles from "./create-listing-form.module.css";

const steps = [
  { label: "Source", note: "Facts, Chanote, project" },
  { label: "Photos", note: "Gallery and AI analysis" },
  { label: "Details", note: "Pricing, tags, notes" }
] as const;

const draftStorageKey = "propertyflow:listing-intake-draft";

export function CreateListingWizard({
  action,
  children
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode[];
}) {
  const [activeStep, setActiveStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const isLastStep = activeStep === steps.length - 1;

  useEffect(() => {
    const form = formRef.current;
    const draft = readDraft();

    if (!form || !draft) {
      return;
    }

    for (const element of Array.from(form.elements)) {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) {
        continue;
      }

      const savedValue = draft[element.name];

      if (!element.name || savedValue === undefined || element.type === "file") {
        continue;
      }

      if (element instanceof HTMLInputElement && element.type === "checkbox") {
        element.checked = savedValue === "true";
      } else {
        element.value = savedValue;
      }
    }
  }, []);

  function saveDraft() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    window.sessionStorage.setItem(draftStorageKey, JSON.stringify(collectDraft(form)));
  }

  function clearDraft() {
    window.sessionStorage.removeItem(draftStorageKey);
  }

  return (
    <form action={action} className={styles.form} onInput={saveDraft} onSubmit={clearDraft} ref={formRef}>
      <div className={styles.wizardTabs} aria-label="Listing creation steps">
        {steps.map((step, index) => (
          <button
            aria-current={activeStep === index ? "step" : undefined}
            className={`${styles.wizardTab} ${activeStep === index ? styles.wizardTabActive : ""}`}
            key={step.label}
            onClick={() => setActiveStep(index)}
            type="button"
          >
            <span>{index + 1}</span>
            <strong>{step.label}</strong>
            <small>{step.note}</small>
          </button>
        ))}
      </div>

      <div className={styles.stepViewport}>
        {children.map((child, index) => (
          <div className={styles.stepPanel} hidden={activeStep !== index} key={steps[index]?.label ?? index}>
            {child}
          </div>
        ))}
      </div>

      <div className={styles.wizardFooter}>
        <button disabled={activeStep === 0} onClick={() => setActiveStep((step) => Math.max(0, step - 1))} type="button">
          <ChevronLeft size={16} />
          Back
        </button>
        <small>Text fields are kept as a browser draft while you move through the intake.</small>
        {isLastStep ? (
          <button className={styles.submitButton} type="submit">
            <Plus size={16} />
            Create AI-ready draft
          </button>
        ) : (
          <button className={styles.nextButton} onClick={() => setActiveStep((step) => Math.min(steps.length - 1, step + 1))} type="button">
            Next
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </form>
  );
}

function readDraft() {
  try {
    const draft = window.sessionStorage.getItem(draftStorageKey);

    return draft ? (JSON.parse(draft) as Record<string, string>) : null;
  } catch {
    return null;
  }
}

function collectDraft(form: HTMLFormElement) {
  const draft: Record<string, string> = {};

  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) {
      continue;
    }

    if (!element.name || element.type === "file") {
      continue;
    }

    draft[element.name] = element instanceof HTMLInputElement && element.type === "checkbox" ? String(element.checked) : element.value;
  }

  return draft;
}
