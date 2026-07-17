import { CalendarClock, GitBranch, Save } from "lucide-react";
import { updateLeadFollowUpAction, updateLeadStatusAction } from "@entities/lead/api/lead-actions";
import {
  formatLeadFollowUpDateTimeLocalValue,
  leadWorkflowPriorityOptions,
  leadWorkflowStatusOptions
} from "@features/lead-workflow-update/model/lead-workflow";
import type { LeadSnapshot } from "@propertyflow/contracts";
import styles from "./lead-workflow-panel.module.css";

export function LeadWorkflowPanel({ lead }: { lead: LeadSnapshot }) {
  const statusAction = updateLeadStatusAction.bind(null, lead.id);
  const followUpAction = updateLeadFollowUpAction.bind(null, lead.id);

  return (
    <section className={styles.panel} aria-label="Lead workflow actions">
      <div className={styles.header}>
        <div>
          <p className="section-kicker">Workflow</p>
          <h2>Next action controls</h2>
        </div>
        <GitBranch size={20} />
      </div>

      <div className={styles.grid}>
        <form action={statusAction} className={styles.actionCard}>
          <div className={styles.actionTitle}>
            <GitBranch size={17} />
            <span>Pipeline status</span>
          </div>
          <label>
            <span>Status</span>
            <select defaultValue={lead.status} name="status">
              {leadWorkflowStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replace("-", " ")}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">
            <Save size={16} />
            Update status
          </button>
        </form>

        <form action={followUpAction} className={styles.actionCard}>
          <div className={styles.actionTitle}>
            <CalendarClock size={17} />
            <span>Follow-up plan</span>
          </div>
          <div className={styles.inlineFields}>
            <label>
              <span>Priority</span>
              <select defaultValue={lead.priority ?? ""} name="priority">
                <option value="">Keep current</option>
                {leadWorkflowPriorityOptions.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Next touch</span>
              <input defaultValue={formatLeadFollowUpDateTimeLocalValue(lead.nextFollowUpAt)} name="nextFollowUpAt" type="datetime-local" />
            </label>
          </div>
          <button type="submit">
            <Save size={16} />
            Save follow-up
          </button>
        </form>
      </div>
    </section>
  );
}
