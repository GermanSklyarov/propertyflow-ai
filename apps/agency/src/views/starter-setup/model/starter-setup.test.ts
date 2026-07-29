import { describe, expect, it } from "vitest";
import type {
  BackgroundJobMonitorItem,
  KnowledgeDocumentSnapshot,
  KnowledgeEmbeddingHealthSnapshot,
  TenantSnapshot
} from "@propertyflow/contracts";
import { buildStarterEmbeddingReadiness, buildStarterSetupProgress } from "./starter-setup";

describe("starter setup progress", () => {
  it("points a new tenant at knowledge first", () => {
    const progress = buildStarterSetupProgress({
      documents: [],
      jobs: [],
      tenant: tenantFactory()
    });

    expect(progress.launchReady).toBe(false);
    expect(progress.steps[0]).toMatchObject({
      id: "plan",
      status: "complete",
      title: "Plan confirmation",
      value: "Starter"
    });
    expect(progress.completed).toBe(2);
    expect(progress.total).toBe(5);
    expect(progress.selectedPlanMatchesWorkspace).toBe(true);
    expect(progress.requestedPlanLabel).toBe("Starter");
    expect(progress.nextAction).toMatchObject({
      actionHref: "/knowledge?create=source#create-knowledge-document",
      status: "action",
      title: "Knowledge Sources"
    });
    expect(progress.blockers.map((blocker) => blocker.id)).toEqual(["knowledge", "origins", "widget"]);
  });

  it("waits for indexing before marking knowledge complete", () => {
    const progress = buildStarterSetupProgress({
      documents: readyStarterDocuments(),
      jobs: [knowledgeJobFactory()],
      tenant: tenantFactory()
    });

    expect(progress.steps.find((step) => step.id === "knowledge")).toMatchObject({
      status: "waiting",
      value: "9/9 ready"
    });
  });

  it("marks the setup launch-ready when starter gates are complete", () => {
    const progress = buildStarterSetupProgress({
      documents: readyStarterDocuments(),
      jobs: [],
      tenant: tenantFactory({
        widget: {
          ...tenantFactory().widget,
          allowedOrigins: ["https://demo.example.com"],
          welcomeMessages: {
            en: "Hi",
            ru: "Привет",
            th: "สวัสดีค่ะ",
            zh: "你好"
          }
        }
      })
    });

    expect(progress.launchReady).toBe(true);
    expect(progress.completed).toBe(progress.total);
    expect(progress.blockers).toEqual([]);
  });

  it("keeps the signup-selected plan visible before tenant provisioning updates the workspace", () => {
    const progress = buildStarterSetupProgress({
      documents: [],
      jobs: [],
      requestedPlan: "growth",
      tenant: tenantFactory()
    });

    expect(progress.requestedPlanLabel).toBe("Growth");
    expect(progress.workspacePlanLabel).toBe("Starter");
    expect(progress.selectedPlanMatchesWorkspace).toBe(false);
    expect(progress.upgradePreview).toMatchObject({
      actionHref: "/settings#plan-upgrade",
      actionLabel: "Review Growth controls",
      title: "Growth is the next step after Starter"
    });
  });
});

describe("starter embedding readiness", () => {
  it("summarizes current vectors", () => {
    expect(buildStarterEmbeddingReadiness(embeddingHealthFactory())).toMatchObject({
      actionLabel: "Refresh vectors",
      current: 12,
      pending: 0,
      ready: true,
      stale: 0,
      summary: "12/12 chunks are using the active embedding provider."
    });
  });

  it("flags stale and unembedded chunks", () => {
    expect(
      buildStarterEmbeddingReadiness(
        embeddingHealthFactory({
          currentChunks: 7,
          ready: false,
          staleChunks: 2,
          totalChunks: 12,
          unembeddedChunks: 3
        })
      )
    ).toMatchObject({
      actionLabel: "Refresh vectors",
      current: 7,
      pending: 3,
      ready: false,
      stale: 2,
      summary: "5 chunks need fresh vectors before Concierge retrieval is production-ready."
    });
  });
});

function tenantFactory(overrides: Partial<TenantSnapshot> = {}): TenantSnapshot {
  return {
    branding: {
      displayName: "Demo Agency",
      primaryColor: "#0f766e"
    },
    createdAt: "2026-07-20T00:00:00.000Z",
    domainStatus: "not-configured",
    id: "tenant-demo",
    limits: {
      agents: 1,
      aiCreditsMonthly: 5000,
      properties: 1000,
      publicApiRequestsMonthly: 10000
    },
    name: "Demo Agency",
    slug: "demo-agency",
    status: "active",
    subscriptionPlan: "starter",
    updatedAt: "2026-07-20T00:00:00.000Z",
    widget: {
      aiName: "Anna",
      aiNames: {
        en: "Anna",
        ru: "Анна",
        th: "มาลี",
        zh: "安娜"
      },
      allowedOrigins: [],
      languages: ["en", "ru", "th", "zh"],
      personaGenders: {
        en: "feminine",
        ru: "feminine",
        th: "feminine",
        zh: "neutral"
      },
      tone: "friendly",
      welcomeMessage: "Hi! I'm Anna, your AI property consultant.",
      welcomeMessages: {
        en: "Hi! I'm Anna, your AI property consultant.",
        ru: "Привет! Я Анна, ваш AI-консультант по недвижимости.",
        th: "สวัสดีค่ะ ฉันชื่อมาลี ผู้ช่วย AI ด้านอสังหาริมทรัพย์ของคุณ",
        zh: "你好！我是安娜，你的 AI 房产顾问。"
      }
    },
    ...overrides
  };
}

function readyStarterDocuments(): KnowledgeDocumentSnapshot[] {
  return [
    ["faq", "Demo FAQ questions answers"],
    ["article", "Thailand buying guide foreign quota ownership"],
    ["article", "Selling guide resale commission"],
    ["article", "Company information team contact"],
    ["neighborhood", "Condo brochures facilities project"],
    ["neighborhood", "Developer PDFs construction handover"],
    ["legal", "Tax information transfer fee duty"],
    ["relocation", "Visa guide retirement elite work permit"],
    ["faq", "Internal instructions handoff script"]
  ].map(([kind, title], index) => ({
    body: `${title} content for concierge answers. This source includes enough agency-approved context for a buyer, seller, or relocating visitor to ask follow-up questions and get grounded answers from the AI Concierge. Source reference: demo-starter-source-${index}.pdf`,
    createdAt: "2026-07-20T00:00:00.000Z",
    id: `doc-${index}`,
    kind: kind as KnowledgeDocumentSnapshot["kind"],
    locale: "en",
    tags: title.toLowerCase().split(" "),
    tenantId: "tenant-demo",
    title,
    updatedAt: "2026-07-20T00:00:00.000Z"
  }));
}

function knowledgeJobFactory(): BackgroundJobMonitorItem {
  return {
    attemptsMade: 0,
    id: "job-1",
    name: "knowledge.documents.ingest",
    payload: {
      documentId: "doc-1",
      reason: "created",
      tenantId: "tenant-demo"
    },
    progress: 40,
    queue: "propertyflow.jobs",
    state: "active",
    tenantId: "tenant-demo"
  };
}

function embeddingHealthFactory(overrides: Partial<KnowledgeEmbeddingHealthSnapshot> = {}): KnowledgeEmbeddingHealthSnapshot {
  return {
    currentChunks: 12,
    failedChunks: 0,
    generatedAt: "2026-07-20T00:00:00.000Z",
    pendingChunks: 0,
    ready: true,
    retrieval: "hybrid-chunks-v1",
    staleChunks: 0,
    targetDimensions: 768,
    targetModel: "gemini-embedding-001",
    targetModelKey: "gemini:gemini-embedding-001:768",
    targetProvider: "gemini",
    tenantId: "tenant-demo",
    totalChunks: 12,
    unembeddedChunks: 0,
    ...overrides
  };
}
