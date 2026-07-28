import { ArrowRight, Building2, CheckCircle2, Code2, Globe2, MessageCircle, ShieldCheck } from "lucide-react";
import type { TenantSnapshot } from "@propertyflow/contracts";
import { buildWidgetInstallPackage } from "@widgets/tenant-settings/model/widget-install";
import { CopyWidgetSnippetButton } from "@widgets/tenant-settings/ui/copy-widget-snippet-button";
import { buildWidgetDemoProfiles, buildWidgetDemoPrompts, buildWidgetDemoSummary, getPrimaryWidgetDemoProfile } from "../model/widget-demo";
import { WidgetDemoChat } from "./widget-demo-chat";
import styles from "./widget-demo-page.module.css";

export function WidgetDemoPage({ tenant }: { tenant: TenantSnapshot }) {
  const install = buildWidgetInstallPackage(tenant);
  const profiles = buildWidgetDemoProfiles(tenant);
  const prompts = buildWidgetDemoPrompts(tenant);
  const primaryProfile = getPrimaryWidgetDemoProfile(tenant);
  const summary = buildWidgetDemoSummary(tenant);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className="section-kicker">Widget demo host</p>
            <h1>Preview the AI Concierge before installing it.</h1>
            <p>
              This page behaves like a client website using the same tenant slug, widget personality, languages, listings, and knowledge sources.
            </p>
          </div>
          <a className={styles.headerAction} href="/settings#widget-install">
            Widget settings
            <ArrowRight size={18} />
          </a>
        </header>

        <section className={styles.demoGrid}>
          <article className={styles.fakeSite}>
            <div className={styles.fakeSiteTopline}>
              <span>
                <Building2 size={16} />
                {tenant.name}
              </span>
              <span>{summary.tenantSlug}</span>
            </div>
            <div className={styles.fakeHero}>
              <p>Thailand property search</p>
              <h2>Find the right condo with an AI consultant that knows this agency.</h2>
              <a href="#live-widget-demo">
                Ask {primaryProfile.aiName}
                <MessageCircle size={17} />
              </a>
            </div>
            <div className={styles.fakeCards}>
              <span>Sea-view condos under budget</span>
              <span>Visa and buying FAQ</span>
              <span>Property matches from imported listings</span>
            </div>
            <div className={styles.installStrip}>
              <ShieldCheck size={17} />
              <span>{summary.originNote}</span>
            </div>
          </article>

          <div id="live-widget-demo">
            <WidgetDemoChat
              initialLocale={primaryProfile.locale}
              profiles={profiles}
              prompts={prompts}
              tenantSlug={tenant.slug}
            />
          </div>
        </section>

        <section className={styles.installPanel}>
          <div className={styles.installHeader}>
            <div>
              <p className="section-kicker">Install handoff</p>
              <h2>Use the same snippet on the agency website</h2>
            </div>
            <Code2 size={22} />
          </div>
          <div className={styles.snippetRow}>
            <pre>{install.snippet}</pre>
            <CopyWidgetSnippetButton snippet={install.snippet} />
          </div>
          <div className={styles.checkGrid}>
            {install.dataAttributes.map((attribute) => (
              <span key={attribute.label}>
                <CheckCircle2 size={15} />
                <strong>{attribute.label}</strong>
                <em>{attribute.value}</em>
              </span>
            ))}
            <span>
              <Globe2 size={15} />
              <strong>Demo origin</strong>
              <em>{summary.originMode === "test" ? "internal host allowed" : "origin restricted"}</em>
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
