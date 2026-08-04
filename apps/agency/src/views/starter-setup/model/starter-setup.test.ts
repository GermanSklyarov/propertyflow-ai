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
      embeddingHealth: embeddingHealthFactory({
        currentChunks: 0,
        totalChunks: 0
      }),
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
    expect(progress.total).toBe(6);
    expect(progress.selectedPlanMatchesWorkspace).toBe(true);
    expect(progress.requestedPlanLabel).toBe("Starter");
    expect(progress.nextAction).toMatchObject({
      actionHref: "/knowledge?create=source#create-knowledge-document",
      status: "action",
      title: "Knowledge Sources"
    });
    expect(progress.blockers.map((blocker) => blocker.id)).toEqual(["knowledge", "retrieval", "origins"]);
  });

  it("waits for indexing before marking knowledge complete", () => {
    const progress = buildStarterSetupProgress({
      documents: readyStarterDocuments(),
      embeddingHealth: embeddingHealthFactory({
        pendingChunks: 4,
        ready: false,
        unembeddedChunks: 4
      }),
      jobs: [knowledgeJobFactory()],
      tenant: tenantFactory()
    });

    expect(progress.steps.find((step) => step.id === "knowledge")).toMatchObject({
      status: "waiting",
      value: "9/9 ready"
    });
    expect(progress.steps.find((step) => step.id === "retrieval")).toMatchObject({
      status: "waiting",
      value: "4/12 need refresh"
    });
  });

  it("blocks launch until AI retrieval vectors are current", () => {
    const progress = buildStarterSetupProgress({
      documents: readyStarterDocuments(),
      embeddingHealth: embeddingHealthFactory({
        currentChunks: 7,
        pendingChunks: 1,
        ready: false,
        staleChunks: 2,
        totalChunks: 12,
        unembeddedChunks: 3
      }),
      jobs: [],
      tenant: productionReadyTenant()
    });

    expect(progress.launchReady).toBe(false);
    expect(progress.steps.find((step) => step.id === "retrieval")).toMatchObject({
      actionHref: "/setup#ai-retrieval-readiness",
      actionLabel: "Refresh stale vectors",
      status: "waiting",
      title: "AI retrieval",
      value: "3/12 need refresh"
    });
    expect(progress.blockers.map((blocker) => blocker.id)).toEqual(["retrieval", "widget"]);
  });

  it("marks the setup launch-ready when starter gates are complete", () => {
    const progress = buildStarterSetupProgress({
      documents: readyStarterDocuments(),
      embeddingHealth: embeddingHealthFactory(),
      jobs: [],
      tenant: productionReadyTenant()
    });

    expect(progress.launchReady).toBe(true);
    expect(progress.completed).toBe(progress.total);
    expect(progress.blockers).toEqual([]);
  });

  it("keeps the signup-selected plan visible before tenant provisioning updates the workspace", () => {
    const progress = buildStarterSetupProgress({
      documents: [],
      embeddingHealth: embeddingHealthFactory({
        currentChunks: 0,
        totalChunks: 0
      }),
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
          pendingChunks: 1,
          ready: false,
          staleChunks: 2,
          totalChunks: 12,
          unembeddedChunks: 3
        })
      )
    ).toMatchObject({
      actionLabel: "Refresh stale vectors",
      current: 7,
      pending: 1,
      ready: false,
      stale: 2,
      summary: "3 chunks need fresh vectors (2 stale, 1 pending). Retry before Concierge retrieval is production-ready."
    });
  });

  it("makes failed embedding chunks explicitly retryable", () => {
    expect(
      buildStarterEmbeddingReadiness(
        embeddingHealthFactory({
          currentChunks: 10,
          failedChunks: 2,
          ready: false,
          totalChunks: 12,
          unembeddedChunks: 2
        })
      )
    ).toMatchObject({
      actionLabel: "Retry failed vectors",
      current: 10,
      failed: 2,
      ready: false,
      summary: "2 chunks need fresh vectors (2 failed). Retry before Concierge retrieval is production-ready."
    });
  });

  it("labels new unembedded chunks as buildable vectors", () => {
    expect(
      buildStarterEmbeddingReadiness(
        embeddingHealthFactory({
          currentChunks: 0,
          pendingChunks: 12,
          ready: false,
          totalChunks: 12,
          unembeddedChunks: 12
        })
      )
    ).toMatchObject({
      actionLabel: "Build vectors",
      pending: 12,
      ready: false,
      summary: "12 chunks need fresh vectors (12 pending). Retry before Concierge retrieval is production-ready."
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
      listingUrlTemplate: "/listings/:propertyId",
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

function productionReadyTenant(): TenantSnapshot {
  return tenantFactory({
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
  });
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

function embeddingHealthFactory(
  overrides: Partial<KnowledgeEmbeddingHealthSnapshot> = {}
): KnowledgeEmbeddingHealthSnapshot {
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
