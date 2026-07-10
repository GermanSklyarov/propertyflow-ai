"use client";

import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import type { LeadSnapshot } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { createWebsiteLead } from "../../../shared/api/propertyflow-client";

type LeadIntent = "viewing" | "rental" | "investment";

const leadIntents: Array<{ value: LeadIntent; label: string }> = [
  { value: "viewing", label: "Viewing" },
  { value: "rental", label: "Rent terms" },
  { value: "investment", label: "ROI check" }
];

export function LeadCaptureForm({ property }: { property: PropertySnapshot }) {
  const [intent, setIntent] = useState<LeadIntent>(property.listingType === "rent" ? "rental" : "viewing");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [message, setMessage] = useState(defaultMessage(property, intent));
  const [lead, setLead] = useState<LeadSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSubmit = contactName.trim().length >= 2 && Boolean(contactEmail.trim() || contactPhone.trim());
  const actionLabel = useMemo(() => {
    if (intent === "rental") {
      return "Request rent terms";
    }

    if (intent === "investment") {
      return "Request ROI review";
    }

    return "Request viewing";
  }, [intent]);

  function chooseIntent(nextIntent: LeadIntent) {
    setIntent(nextIntent);
    setMessage(defaultMessage(property, nextIntent));
  }

  function submit() {
    if (!canSubmit) {
      setError("Add your name and at least one contact method.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const nextLead = await createWebsiteLead({
        propertyId: property.id,
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        preferredLocale: "en",
        attributionSearchSource: "ai",
        attributionSearchQuery: `${intent}:${property.title}`,
        message: message.trim() || defaultMessage(property, intent)
      });

      setLead(nextLead);
    });
  }

  if (lead) {
    return (
      <section className="border border-[rgba(15,118,110,0.26)] bg-[#edf8f4] p-[clamp(18px,2vw,26px)] shadow-[0_16px_42px_rgba(37,50,46,0.08)]">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-1 text-[var(--teal)]" size={22} />
          <div>
            <p className="section-kicker">Lead created</p>
            <h2 className="mb-2 mt-2 text-2xl leading-tight">Agent follow-up is queued.</h2>
            <p className="m-0 leading-normal text-[#42524e]">
              Request <strong>{lead.id}</strong> is ready in the CRM queue with this property attached.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="border border-[var(--line)] bg-white p-[clamp(18px,2vw,26px)] shadow-[0_16px_42px_rgba(37,50,46,0.08)]">
      <p className="section-kicker">Next step</p>
      <h2 className="mb-4 mt-2 text-2xl leading-tight">Ask an agent to follow up.</h2>

      <div className="grid grid-cols-1 gap-2 min-[761px]:grid-cols-3">
        {leadIntents.map((option) => {
          const isActive = option.value === intent;

          return (
            <button
              aria-pressed={isActive}
              className={`min-h-10 border px-3 py-2 text-left text-[0.82rem] font-black ${
                isActive
                  ? "border-[rgba(15,118,110,0.55)] bg-[var(--teal)] text-white"
                  : "border-[var(--line)] bg-white text-[var(--teal-dark)]"
              }`}
              key={option.value}
              onClick={() => chooseIntent(option.value)}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-[0.82rem] font-extrabold text-[var(--muted)]">Name</span>
          <input
            className="min-h-11 w-full min-w-0 border border-[var(--line)] px-3 text-[var(--ink)] outline-none focus:border-[rgba(15,118,110,0.55)] focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)]"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            placeholder="Your name"
          />
        </label>

        <div className="grid grid-cols-1 gap-3">
          <label className="grid min-w-0 gap-1.5">
            <span className="text-[0.82rem] font-extrabold text-[var(--muted)]">Email</span>
            <input
              className="min-h-11 w-full min-w-0 border border-[var(--line)] px-3 text-[var(--ink)] outline-none focus:border-[rgba(15,118,110,0.55)] focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)]"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder="name@email.com"
              type="email"
            />
          </label>
          <label className="grid min-w-0 gap-1.5">
            <span className="text-[0.82rem] font-extrabold text-[var(--muted)]">Phone</span>
            <input
              className="min-h-11 w-full min-w-0 border border-[var(--line)] px-3 text-[var(--ink)] outline-none focus:border-[rgba(15,118,110,0.55)] focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)]"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              placeholder="+66..."
            />
          </label>
        </div>

        <label className="grid gap-1.5">
          <span className="text-[0.82rem] font-extrabold text-[var(--muted)]">Message</span>
          <textarea
            className="min-h-[104px] w-full min-w-0 resize-y border border-[var(--line)] px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[rgba(15,118,110,0.55)] focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)]"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
      </div>

      {error ? <p className="mb-0 mt-3 text-[0.86rem] font-bold text-[var(--coral)]">{error}</p> : null}

      <button
        className="mt-4 inline-flex w-full items-center justify-center gap-2.5 bg-[var(--teal)] px-4 py-3.5 font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        onClick={submit}
        type="button"
      >
        {isPending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
        <span>{actionLabel}</span>
      </button>
    </section>
  );
}

function defaultMessage(property: PropertySnapshot, intent: LeadIntent) {
  if (intent === "rental") {
    return `I want to discuss rent terms for ${property.title}, including lease length, deposit, and utilities.`;
  }

  if (intent === "investment") {
    return `Please review the ROI, rent estimate, fees, and resale liquidity for ${property.title}.`;
  }

  return `I would like to schedule a viewing or video tour for ${property.title}.`;
}
