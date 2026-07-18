import { MailPlus, Save } from "lucide-react";
import { updateLeadContactAction } from "@entities/lead/api/lead-actions";
import type { LeadSnapshot } from "@propertyflow/contracts";
import styles from "./update-lead-contact-form.module.css";

export function UpdateLeadContactForm({ lead }: { lead: LeadSnapshot }) {
  const action = updateLeadContactAction.bind(null, lead.id);
  const isMissingContact = !lead.contactEmail && !lead.contactPhone;

  return (
    <details className={styles.panel} open={isMissingContact}>
      <summary>
        <span>
          <MailPlus size={16} />
          {isMissingContact ? "Add contact info" : "Update contact"}
        </span>
        <small>{isMissingContact ? "Required before follow-up" : "Keep CRM data current"}</small>
      </summary>

      <form action={action} className={styles.form}>
        <label>
          <span>Email</span>
          <input defaultValue={lead.contactEmail ?? ""} name="contactEmail" placeholder="client@example.com" type="email" />
        </label>

        <label>
          <span>Phone</span>
          <input defaultValue={lead.contactPhone ?? ""} name="contactPhone" placeholder="+66 81 234 5678" type="tel" />
        </label>

        <label className={styles.full}>
          <span>Agent note</span>
          <input name="note" placeholder="Optional: where this contact came from" />
        </label>

        <button type="submit">
          <Save size={16} />
          Save contact
        </button>
      </form>
    </details>
  );
}
