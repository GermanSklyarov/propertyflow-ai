import { ChevronDown, Plus, Send } from "lucide-react";
import { addLeadNoteAction } from "@entities/lead/api/lead-actions";
import styles from "./add-lead-note-form.module.css";

export function AddLeadNoteForm({ leadId }: { leadId: string }) {
  const action = addLeadNoteAction.bind(null, leadId);

  return (
    <details className={styles.disclosure}>
      <summary>
        <span className={styles.summaryIcon}>
          <Plus size={15} />
        </span>
        <span>
          <strong>Add note</strong>
          <small>Capture call outcome, objection, or next step</small>
        </span>
        <ChevronDown className={styles.chevron} size={17} />
      </summary>
      <form action={action} className={styles.form}>
        <label>
          <span>Add agent note</span>
          <textarea
            maxLength={2000}
            minLength={2}
            name="note"
            placeholder="Summarize the call, WhatsApp reply, objection, or next step."
            required
            rows={4}
          />
        </label>
        <button type="submit">
          <Send size={16} />
          Save note
        </button>
      </form>
    </details>
  );
}
