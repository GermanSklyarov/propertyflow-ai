import { ArrowRight, BookOpenText, CheckCircle2, CircleDot, Code2, Globe2, Languages, Rocket } from "lucide-react";
import type { BackgroundJobMonitorItem, KnowledgeDocumentSnapshot, TenantSnapshot } from "@propertyflow/contracts";
import { countRunningKnowledgeJobs } from "@entities/jobs/model/background-jobs";
import { buildKnowledgeStarterReadiness } from "@entities/knowledge/model/knowledge-starter-readiness";
import { getTenantWidgetSettings } from "@entities/tenant/model/widget-settings";
import { buildWidgetInstallPackage } from "@widgets/tenant-settings/model/widget-install";
import { CopyWidgetSnippetButton } from "@widgets/tenant-settings/ui/copy-widget-snippet-button";
import { buildStarterSetupProgress, type StarterSetupStep } from "../model/starter-setup";
import styles from "./starter-setup-page.module.css";

export function StarterSetupPage({
  documents,
  jobs,
  tenant
}: {
  documents: KnowledgeDocumentSnapshot[];
  jobs: BackgroundJobMonitorItem[];
  tenant: TenantSnapshot;
}) {
  const progress = buildStarterSetupProgress({ documents, jobs, tenant });
  const knowledgeReadiness = buildKnowledgeStarterReadiness(documents, countRunningKnowledgeJobs(jobs));
  const widgetInstall = buildWidgetInstallPackage(tenant);
  const widgetSettings = getTenantWidgetSettings(tenant);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className="section-kicker">Starter launch</p>
            <h1 className={styles.title}>Set up AI Concierge</h1>
            <p className={styles.subtitle}>
              Launch the website assistant first. Knowledge, personality, origins, and widget install come before CRM migration.
            </p>
          </div>
          <span className={styles.statusBadge}>{progress.completed}/{progress.total} ready</span>
        </header>

        <section className={styles.heroPanel}>
          <div className={styles.heroCopy}>
            <Rocket size={26} />
            <div>
              <p className="section-kicker">Next best action</p>
              <h2>{progress.launchReady ? "Starter is ready to install." : progress.nextAction.title}</h2>
              <p>{progress.launchReady ? "Copy the widget snippet and test it on the agency website." : progress.nextAction.description}</p>
            </div>
          </div>
          <a className={styles.primaryAction} href={progress.nextAction.actionHref}>
            {progress.nextAction.actionLabel}
            <ArrowRight size={18} />
          </a>
        </section>

        <section className={styles.stepGrid} aria-label="Starter setup checklist">
          {progress.steps.map((step, index) => (
            <SetupStepCard index={index + 1} key={step.id} step={step} />
          ))}
        </section>

        <section className={styles.layout}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className="section-kicker">Knowledge Sources</p>
                <h2>Documents that make AI useful</h2>
              </div>
              <BookOpenText size={20} />
            </div>
            <div className={styles.knowledgeMeter}>
              <strong>{knowledgeReadiness.completed}/{knowledgeReadiness.total}</strong>
              <span>{knowledgeReadiness.summary}</span>
            </div>
            <div className={styles.requirementList}>
              {knowledgeReadiness.items.map((item) => {
                const Icon = item.done ? CheckCircle2 : CircleDot;

                return (
                  <span data-ready={String(item.done)} key={item.id}>
                    <Icon size={15} />
                    {item.title}
                  </span>
                );
              })}
            </div>
            <a className={styles.secondaryAction} href="/knowledge?create=source#create-knowledge-document">
              Add knowledge source
              <ArrowRight size={16} />
            </a>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className="section-kicker">Widget</p>
                <h2>Copy this code</h2>
              </div>
              <Code2 size={20} />
            </div>
            <pre className={styles.snippet}>{widgetInstall.snippet}</pre>
            <div className={styles.widgetActions}>
              <CopyWidgetSnippetButton snippet={widgetInstall.snippet} />
              <a className={styles.secondaryAction} href="/settings#widget-install">
                Open widget settings
                <ArrowRight size={16} />
              </a>
            </div>
            <div className={styles.infoList}>
              <span>
                <Globe2 size={15} />
                {widgetSettings.allowedOrigins.length ? `${widgetSettings.allowedOrigins.length} allowed origin` : "Test mode until origins are added"}
              </span>
              <span>
                <Languages size={15} />
                {widgetSettings.languages.map((language) => language.toUpperCase()).join(", ")}
              </span>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

function SetupStepCard({ index, step }: { index: number; step: StarterSetupStep }) {
  const Icon = step.status === "complete" ? CheckCircle2 : CircleDot;

  return (
    <article className={styles.stepCard} data-status={step.status}>
      <div className={styles.stepTopline}>
        <span>{index}</span>
        <strong>{formatStepStatus(step.status)}</strong>
      </div>
      <div className={styles.stepTitle}>
        <Icon size={18} />
        <h2>{step.title}</h2>
      </div>
      <p>{step.description}</p>
      <div className={styles.stepFooter}>
        <span>{step.value}</span>
        <a href={step.actionHref}>
          {step.actionLabel}
          <ArrowRight size={15} />
        </a>
      </div>
    </article>
  );
}

function formatStepStatus(status: StarterSetupStep["status"]) {
  const labels = {
    action: "Action",
    blocked: "Needs setup",
    complete: "Ready",
    waiting: "Indexing"
  } satisfies Record<StarterSetupStep["status"], string>;

  return labels[status];
}
