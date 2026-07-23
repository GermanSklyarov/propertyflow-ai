"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, DatabaseZap, FileText } from "lucide-react";
import { createKnowledgeDocumentAction } from "@entities/knowledge/api/knowledge-actions";
import { knowledgeKindOptions, knowledgeLocaleOptions } from "@entities/knowledge/model/knowledge-options";
import {
  buildKnowledgeDocumentSourceIntake,
  knowledgeDocumentSourcePresets
} from "@entities/knowledge/model/knowledge-source-presets";
import { formatBucket } from "@shared/lib/formatters";
import { FileDropField } from "@shared/ui/file-drop-field";
import styles from "./create-knowledge-document-form.module.css";

const steps = [
  { label: "Source", note: "Type, title, locale" },
  { label: "Content", note: "URL, body, file" }
] as const;

export function CreateKnowledgeDocumentForm() {
  const [activeStep, setActiveStep] = useState(0);
  const isLastStep = activeStep === steps.length - 1;

  return (
    <form action={createKnowledgeDocumentAction} className={styles.form}>
      <div className={styles.wizardTabs} aria-label="Knowledge source creation steps">
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
        <section className={styles.stepPanel} hidden={activeStep !== 0}>
          <fieldset className={styles.sourcePicker}>
            <legend>Source type</legend>
            <div className={styles.sourcePresetGrid}>
              {knowledgeDocumentSourcePresets.map((preset, index) => {
                const intake = buildKnowledgeDocumentSourceIntake(preset.id);

                return (
                  <label className={styles.sourcePresetCard} key={preset.id}>
                    <input defaultChecked={index === 0} name="sourcePreset" type="radio" value={preset.id} />
                    <span>
                      <strong>{preset.title}</strong>
                      <small>{formatBucket(preset.defaultKind)}</small>
                    </span>
                    <em>{intake.checklistLabel}</em>
                  </label>
                );
              })}
            </div>
            <div className={styles.pipelineHint}>
              <DatabaseZap size={17} />
              <span>Source to ingestion to parsing to embeddings to AI Concierge.</span>
            </div>
          </fieldset>

          <div className={styles.fieldGrid}>
            <label className={styles.wide}>
              Title
              <input name="title" placeholder="Buying guide, visa FAQ, company information, condo brochure..." required />
            </label>
            <label>
              Locale
              <select defaultValue="en" name="locale">
                {knowledgeLocaleOptions.map((locale) => (
                  <option key={locale} value={locale}>
                    {locale.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kind fallback
              <select defaultValue="faq" name="kind">
                {knowledgeKindOptions.map((kind) => (
                  <option key={kind} value={kind}>
                    {formatBucket(kind)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className={styles.stepPanel} hidden={activeStep !== 1}>
          <div className={styles.fieldGrid}>
            <label className={styles.wide}>
              Extra tags
              <input name="tags" placeholder="pattaya, wongamat, transfer-fee, developer-name" />
            </label>
            <label className={`${styles.wide} ${styles.sourceUrl}`}>
              Source URL
              <input name="sourceUrl" placeholder="https://agency.example.com/faq/buying-property-in-thailand" type="url" />
              <small>Optional, but useful for website pages, blog articles, public PDFs, and future re-sync checks.</small>
            </label>
            <label className={styles.wide}>
              Body
              <textarea
                name="body"
                placeholder="Paste source material or a cleaned transcript. You can also drop a text, markdown, CSV, JSON, HTML, or XML file below."
                rows={7}
              />
            </label>
            <div className={styles.wide}>
              <FileDropField
                accept=".txt,.md,.csv,.json,.html,.xml,.pdf,.png,.jpg,.jpeg,text/*,application/json,application/xml,application/pdf,image/*"
                description="Text-like files are read immediately. PDFs and images are stored as source files for the upcoming OCR/PDF worker."
                icon={<FileText size={24} />}
                name="sourceFile"
                title="Drop knowledge file"
                variant="compact"
              />
            </div>
          </div>
        </section>
      </div>

      <div className={styles.wizardFooter}>
        <button disabled={activeStep === 0} onClick={() => setActiveStep((step) => Math.max(0, step - 1))} type="button">
          <ChevronLeft size={16} />
          Back
        </button>
        <small>Choose the source shape first, then add URL, pasted content, or a file for ingestion.</small>
        {isLastStep ? (
          <button className={styles.submitButton} type="submit">
            <DatabaseZap size={16} />
            Create and ingest
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
