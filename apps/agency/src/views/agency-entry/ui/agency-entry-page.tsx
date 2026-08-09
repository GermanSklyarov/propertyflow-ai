import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, DatabaseZap, FileText, Globe2, KeyRound, Sparkles } from "lucide-react";
import { requestAgencySigninLink, submitAgencySignup } from "../api/signup-actions";
import type { AgencySignupSummary } from "../model/agency-entry";
import { buildAgencyEntryPlanCards } from "../model/agency-entry";
import styles from "./agency-entry-page.module.css";

const onboardingSteps = [
  {
    icon: FileText,
    label: "Upload knowledge",
    note: "FAQ, buying guides, company rules, brochures, and developer PDFs become AI-ready sources."
  },
  {
    icon: DatabaseZap,
    label: "Connect listings",
    note: "CSV, REST, XML, or CRM inventory can feed Concierge search without a full CRM migration."
  },
  {
    icon: Bot,
    label: "Tune the Concierge",
    note: "Name, tone, languages, welcome messages, and site locale behavior stay tenant-specific."
  },
  {
    icon: Globe2,
    label: "Install the widget",
    note: "Copy one script, allowlist the site origin, and run the smoke check before going live."
  }
];

const signinAssurances = [
  "Open the agency workspace for the selected company.",
  "Keep setup, knowledge sources, and widget controls in one dashboard.",
  "Continue where the Starter onboarding left off."
];

export function AgencyEntryPage() {
  const plans = buildAgencyEntryPlanCards();

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <nav className={styles.nav} aria-label="Agency entry navigation">
          <Link href="/" className={styles.logo}>
            PropertyFlow AI
          </Link>
          <div>
            <Link href="#pricing">Pricing</Link>
            <Link href="/signin">Sign in</Link>
            <Link href="/signup?plan=starter" className={styles.navCta}>
              Start Starter
            </Link>
          </div>
        </nav>

        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className="section-kicker">AI Concierge for agencies</p>
            <h1>Add a knowledgeable property consultant to your agency website.</h1>
            <p>
              Starter turns your documents, listing feeds, and website knowledge into an AI Concierge without asking the
              agency to replace its CRM on day one.
            </p>
            <div className={styles.heroActions}>
              <Link href="/signup?plan=starter" className={styles.primaryAction}>
                Create Starter workspace
                <ArrowRight size={18} />
              </Link>
              <Link href="#pricing" className={styles.secondaryAction}>
                Compare plans
              </Link>
            </div>
          </div>

          <div className={styles.flowPanel} aria-label="Starter setup flow">
            <div className={styles.flowHeader}>
              <Sparkles size={22} />
              <strong>Production starter path</strong>
            </div>
            {onboardingSteps.map((step, index) => {
              const Icon = step.icon;

              return (
                <article className={styles.flowStep} key={step.label}>
                  <span>{index + 1}</span>
                  <Icon size={20} />
                  <div>
                    <strong>{step.label}</strong>
                    <p>{step.note}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.promiseBand} aria-label="Starter value">
        <article>
          <strong>1 day</strong>
          <span>to launch the first widget demo</span>
        </article>
        <article>
          <strong>No CRM migration</strong>
          <span>until the agency wants Growth</span>
        </article>
        <article>
          <strong>Knowledge first</strong>
          <span>documents and listings power every answer</span>
        </article>
      </section>

      <section className={styles.pricing} id="pricing">
        <div className={styles.sectionHeader}>
          <p className="section-kicker">Plans</p>
          <h2>Start with AI. Add CRM when conversations become leads.</h2>
        </div>
        <div className={styles.planGrid}>
          {plans.map((plan) => (
            <article className={styles.planCard} data-featured={plan.featured} key={plan.id}>
              <span className={plan.featured ? styles.featuredBadge : styles.featuredBadgePlaceholder}>
                {plan.featured ? "Best entry point" : "Plan option"}
              </span>
              <h3>{plan.name}</h3>
              <p>{plan.primaryUseCase}</p>
              <span>{plan.description}</span>
              <ul>
                {plan.unlocks.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href={plan.ctaHref} className={plan.featured ? styles.primaryAction : styles.secondaryAction}>
                {plan.ctaLabel}
                <ArrowRight size={18} />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export function SignupEntryPage({ errorMessage, signup }: { errorMessage?: string | null; signup: AgencySignupSummary }) {
  return (
    <main className={styles.page}>
      <section className={styles.signupPanel}>
        <div className={styles.signupCopy}>
          <p className="section-kicker">Create workspace</p>
          <h1>{signup.planName} workspace setup</h1>
          <p>
            Capture the agency basics, keep the selected plan attached, and continue into the first-run setup path.
          </p>
          <div className={styles.signupPlanCard}>
            <span>Selected plan</span>
            <strong>{signup.planName}</strong>
            <p>{signup.positioning}</p>
            <ol>
              {signup.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
        <form action={submitAgencySignup} className={styles.signupForm}>
          {errorMessage ? (
            <div className={styles.signupError} role="alert">
              {errorMessage}
            </div>
          ) : null}
          <input name="plan" type="hidden" value={signup.planId} />
          <label>
            Agency name
            <input name="agencyName" placeholder="Thailand Realty Co." required />
          </label>
          <label>
            Work email
            <input name="email" placeholder="you@agency.com" required type="email" />
          </label>
          <label>
            Website
            <input name="website" placeholder="https://agency.co.th" required type="url" />
          </label>
          <div className={styles.signupActions}>
            <button className={styles.primaryAction} type="submit">
              Continue to Starter setup
              <ArrowRight size={18} />
            </button>
            <span>
              <KeyRound size={16} />
              Account verification and billing attach to this step next.
            </span>
          </div>
          <p className={styles.signupFootnote}>
            Already have a workspace? <Link href="/signin">Sign in</Link>.
          </p>
        </form>
      </section>
    </main>
  );
}

export function SigninEntryPage({
  developmentMagicLinkHref,
  errorMessage,
  linkSent,
  linkSentWorkspace
}: {
  developmentMagicLinkHref?: string;
  errorMessage?: string | null;
  linkSent?: boolean;
  linkSentWorkspace?: string;
}) {
  return (
    <main className={styles.page}>
      <section className={styles.signinPanel}>
        <div className={styles.signinCopy}>
          <p className="section-kicker">Agency login</p>
          <h1>Return to your workspace</h1>
          <p>
            Sign in with your agency workspace and work email to manage the AI Concierge, knowledge sources, and widget
            launch settings.
          </p>
          <div className={styles.signinValueCard}>
            <span>Workspace access</span>
            <ul>
              {signinAssurances.map((item) => (
                <li key={item}>
                  <CheckCircle2 size={17} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <form action={requestAgencySigninLink} className={styles.signinForm}>
          {errorMessage ? (
            <div className={styles.signupError} role="alert">
              {errorMessage}
            </div>
          ) : null}
          {linkSent ? (
            <div className={styles.signinNotice} role="status">
              <CheckCircle2 size={19} />
              <div>
                <strong>Secure sign-in link requested</strong>
                <p>
                  If this email belongs to {linkSentWorkspace ?? "the workspace"}, the agency owner will receive a
                  sign-in link.
                </p>
                {developmentMagicLinkHref ? (
                  <a href={developmentMagicLinkHref}>Continue with local development link</a>
                ) : null}
              </div>
            </div>
          ) : null}
          <label>
            Workspace slug
            <input name="tenantSlug" placeholder="your-agency" required defaultValue={linkSentWorkspace} />
          </label>
          <label>
            Work email
            <input name="email" placeholder="you@agency.com" required type="email" />
          </label>
          <div className={styles.signinActions}>
            <button className={styles.primaryAction} type="submit">
              Send secure sign-in link
              <ArrowRight size={18} />
            </button>
            <span>
              <KeyRound size={16} />
              We send a short-lived link instead of trusting a workspace id from the browser.
            </span>
          </div>
          <p className={styles.signinFootnote}>
            New to PropertyFlow AI? <Link href="/signup?plan=starter">Create a Starter workspace</Link>.
          </p>
        </form>
      </section>
    </main>
  );
}
