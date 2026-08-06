import Link from "next/link";
import { ArrowUpRight, Bot, Clock3, Home, Mail, MapPin, MessageSquareText, Phone, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { buildLeadFollowUpSummary, formatLeadOwner } from "@entities/lead/lib/lead-queue";
import { parseAiConciergeLeadContext } from "@entities/lead/model/ai-concierge-lead";
import { UpdateLeadContactForm } from "@features/lead-contact-update/ui/update-lead-contact-form";
import type { LeadSnapshot } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { formatBucket, formatDateTime } from "@shared/lib/formatters";
import styles from "./lead-overview-panel.module.css";

export function LeadOverviewPanel({
  lead,
  linkedListing
}: {
  lead: LeadSnapshot;
  linkedListing?: PropertySnapshot | null;
}) {
  const followUpState = buildLeadFollowUpSummary(lead);
  const aiContext = parseAiConciergeLeadContext(lead);

  return (
    <>
      <section className={styles.kpiGrid} aria-label="Lead detail overview">
        <KpiCard icon={<Sparkles size={18} />} label="Source" note="Acquisition channel" value={formatBucket(lead.source)} />
        <KpiCard icon={<ShieldCheck size={18} />} label="Priority" note="Queue signal" value={lead.priority ?? "none"} />
        <KpiCard icon={<UserRound size={18} />} label="Owner" note="Assigned agent" value={formatLeadOwner(lead.assignedAgentId)} />
        <KpiCard icon={<Clock3 size={18} />} label="Follow-up" note={followUpState.note} value={followUpState.value} />
      </section>

      <section className={styles.layout}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Contact</p>
              <h2 className={styles.panelTitle}>Client details</h2>
            </div>
            <UserRound size={20} />
          </div>
          <div className={styles.fieldGrid}>
            <Field icon={<Mail size={15} />} label="Email" value={lead.contactEmail ?? "not provided"} />
            <Field icon={<Phone size={15} />} label="Phone" value={lead.contactPhone ?? "not provided"} />
            <Field label="Locale" value={lead.preferredLocale ?? "not set"} />
            <Field label="Created" value={formatDateTime(lead.createdAt)} />
          </div>
          <div className={styles.inlineAction}>
            <UpdateLeadContactForm lead={lead} />
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Intent</p>
              <h2 className={styles.panelTitle}>Attribution context</h2>
            </div>
            <MapPin size={20} />
          </div>
          <div className={styles.fieldGrid}>
            <LinkedListingField lead={lead} listing={linkedListing} />
            <Field label="Search source" value={lead.attributionSearchSource ?? "not attributed"} />
            <Field label="Search query" value={lead.attributionSearchQuery ?? "not captured"} wide />
            <Field label="Social channel" value={lead.attributionSocialPostChannel ? formatBucket(lead.attributionSocialPostChannel) : "not attributed"} />
            <Field label="Social campaign" value={lead.attributionSocialPostCampaign ?? "not captured"} />
            <Field label="Tracking slug" value={lead.attributionSocialPostTrackingSlug ?? "not captured"} wide />
          </div>
        </section>
      </section>

      {aiContext ? <AiConciergeLeadPanel context={aiContext} /> : null}
    </>
  );
}

function AiConciergeLeadPanel({
  context
}: {
  context: NonNullable<ReturnType<typeof parseAiConciergeLeadContext>>;
}) {
  return (
    <section className={styles.aiPanel} aria-label="AI qualified lead context">
      <div className={styles.panelHeader}>
        <div>
          <p className="section-kicker">AI qualified lead</p>
          <h2 className={styles.panelTitle}>Conversation result</h2>
        </div>
        <Bot size={20} />
      </div>

      {context.visitorNote ? (
        <div className={styles.aiNote}>
          <MessageSquareText size={16} />
          <span>{context.visitorNote}</span>
        </div>
      ) : null}

      {context.recommendedListings.length ? (
        <div className={styles.aiSection}>
          <strong>Recommended listings</strong>
          <div className={styles.aiListingGrid}>
            {context.recommendedListings.map((listing) => (
              <Link className={styles.aiListing} href={`/listings/${listing.propertyId}`} key={listing.propertyId}>
                <span>{listing.title}</span>
                <small>{listing.propertyId}</small>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {context.conversation.length ? (
        <div className={styles.aiSection}>
          <strong>Recent conversation</strong>
          <div className={styles.aiConversation}>
            {context.conversation.map((turn, index) => (
              <p data-role={turn.role} key={`${turn.role}-${index}`}>
                <span>{turn.role}</span>
                {turn.text}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function LinkedListingField({ lead, listing }: { lead: LeadSnapshot; listing?: PropertySnapshot | null }) {
  if (!lead.propertyId) {
    return <Field label="Linked listing" value="not linked" />;
  }

  if (!listing) {
    return <Field label="Linked listing" value={lead.propertyId} />;
  }

  return (
    <div className={`${styles.field} ${styles.fieldWide}`}>
      <span>
        <Home size={15} />
        Linked listing
      </span>
      <Link className={styles.listingLink} href={`/listings/${listing.id}`}>
        <strong>{listing.title}</strong>
        <small>
          {listing.market} · {listing.address}
        </small>
        <ArrowUpRight size={16} />
      </Link>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  note,
  value
}: {
  icon: React.ReactNode;
  label: string;
  note: string;
  value: number | string;
}) {
  return (
    <article className={styles.kpiCard}>
      <div className={styles.kpiIcon}>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function Field({
  icon,
  label,
  value,
  wide = false
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`${styles.field} ${wide ? styles.fieldWide : ""}`}>
      <span>
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}
