"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useForm } from "react-hook-form";
import type { PropertySnapshot } from "@propertyflow/domain";
import { createWebsiteLeadMutationOptions } from "@entities/lead/api/lead-mutations";
import {
  getDefaultLeadMessage,
  getFallbackLeadIntent,
  getLeadActionLabel,
  leadIntentOptions
} from "@features/lead-capture/model/lead-capture-copy";
import {
  leadCaptureSchema,
  type LeadCaptureFormValues
} from "@features/lead-capture/model/lead-capture-schema";

export function LeadCaptureForm({ property }: { property: PropertySnapshot }) {
  const leadMutation = useMutation(createWebsiteLeadMutationOptions());
  const lead = leadMutation.data ?? null;
  const fallbackIntent = getFallbackLeadIntent(property);
  const {
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    watch
  } = useForm<LeadCaptureFormValues>({
    resolver: zodResolver(leadCaptureSchema),
    defaultValues: {
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      intent: fallbackIntent,
      message: getDefaultLeadMessage(property, fallbackIntent)
    }
  });

  const intent = watch("intent");

  function chooseIntent(nextIntent: LeadCaptureFormValues["intent"]) {
    setValue("intent", nextIntent, { shouldDirty: true, shouldValidate: true });
    setValue("message", getDefaultLeadMessage(property, nextIntent), { shouldDirty: true, shouldValidate: true });
  }

  function submit(values: LeadCaptureFormValues) {
    leadMutation.mutate({
      propertyId: property.id,
      contactName: values.contactName,
      contactEmail: values.contactEmail || undefined,
      contactPhone: values.contactPhone || undefined,
      preferredLocale: "en",
      attributionSearchSource: "ai",
      attributionSearchQuery: `${values.intent}:${property.title}`,
      message: values.message || getDefaultLeadMessage(property, values.intent)
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

      <form onSubmit={handleSubmit(submit)}>
        <input type="hidden" {...register("intent")} />

        <div className="grid grid-cols-1 gap-2 min-[761px]:grid-cols-3">
          {leadIntentOptions.map((option) => {
            const isActive = option.value === intent;

            return (
              <button
                aria-pressed={isActive}
                className={`min-h-10 cursor-pointer border px-3 py-2 text-left text-[0.82rem] font-black transition duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(15,118,110,0.18)] ${
                  isActive
                    ? "border-[rgba(15,118,110,0.55)] bg-[var(--teal)] text-white hover:bg-[var(--teal-dark)]"
                    : "border-[var(--line)] bg-white text-[var(--teal-dark)] hover:border-[rgba(15,118,110,0.42)] hover:bg-[#edf8f4]"
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
              placeholder="Your name"
              {...register("contactName")}
            />
          </label>

          <div className="grid grid-cols-1 gap-3">
            <label className="grid min-w-0 gap-1.5">
              <span className="text-[0.82rem] font-extrabold text-[var(--muted)]">Email</span>
              <input
                className="min-h-11 w-full min-w-0 border border-[var(--line)] px-3 text-[var(--ink)] outline-none focus:border-[rgba(15,118,110,0.55)] focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)]"
                placeholder="name@email.com"
                type="email"
                {...register("contactEmail")}
              />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-[0.82rem] font-extrabold text-[var(--muted)]">Phone</span>
              <input
                className="min-h-11 w-full min-w-0 border border-[var(--line)] px-3 text-[var(--ink)] outline-none focus:border-[rgba(15,118,110,0.55)] focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)]"
                placeholder="+66..."
                {...register("contactPhone")}
              />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-[0.82rem] font-extrabold text-[var(--muted)]">Message</span>
            <textarea
              className="min-h-[104px] w-full min-w-0 resize-y border border-[var(--line)] px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[rgba(15,118,110,0.55)] focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)]"
              {...register("message")}
            />
          </label>
        </div>

        {errors.contactName ? (
          <p className="mb-0 mt-3 text-[0.86rem] font-bold text-[var(--coral)]">{errors.contactName.message}</p>
        ) : null}
        {errors.contactEmail ? (
          <p className="mb-0 mt-3 text-[0.86rem] font-bold text-[var(--coral)]">{errors.contactEmail.message}</p>
        ) : null}
        {errors.contactPhone ? (
          <p className="mb-0 mt-3 text-[0.86rem] font-bold text-[var(--coral)]">{errors.contactPhone.message}</p>
        ) : null}

        <button
          className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2.5 bg-[var(--teal)] px-4 py-3.5 font-black text-white transition duration-150 hover:-translate-y-0.5 hover:bg-[var(--teal-dark)] hover:shadow-[0_14px_28px_rgba(37,50,46,0.12)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(15,118,110,0.18)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-[var(--teal)] disabled:hover:shadow-none"
          disabled={leadMutation.isPending}
          type="submit"
        >
          {leadMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          <span>{getLeadActionLabel(intent)}</span>
        </button>
      </form>
    </section>
  );
}
