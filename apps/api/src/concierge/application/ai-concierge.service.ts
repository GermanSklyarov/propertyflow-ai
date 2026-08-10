import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AddConciergeSessionMessageRequest,
  ConciergeAnalyticsResponse,
  ConciergeAreaRecommendation,
  ConciergeFeedbackSnapshot,
  ConciergeModelRegistryResponse,
  ConciergeProfile,
  ConciergePropertyRecommendation,
  ConciergeQuestion,
  ConciergeRequest,
  ConciergeResponse,
  ConciergeSessionDetailResponse,
  ConciergeSessionListResponse,
  ConciergeSessionMessageSnapshot,
  ConciergeSessionSnapshot,
  ConciergeTrainingDatasetRequest,
  ConciergeTrainingDatasetResponse,
  ConciergeTrainingDatasetRow,
  CreateLeadFromConciergeSessionRequest,
  CreateConciergeSessionRequest,
  LeadSnapshot,
  RequestUser,
  ListConciergeSessionsRequest,
  SubmitConciergeFeedbackRequest
} from "@propertyflow/contracts";
import type { PropertyListingType, PropertyPurpose, PropertySnapshot, ThailandMarket } from "@propertyflow/domain";
import type { Pool } from "pg";
import { PG_POOL } from "../../database/database.constants.js";
import { LeadService } from "../../leads/application/lead.service.js";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../properties/domain/property.repository.js";

const CONCIERGE_MODEL_VERSION = "baseline-advisory-v1";
const CONCIERGE_FEATURES = [
  "market",
  "budget",
  "purpose",
  "family",
  "children",
  "car",
  "remoteWork",
  "quietPreference",
  "areaSignals",
  "propertyScore",
  "feedbackRating",
  "leadConversion"
];

interface BudgetSignal {
  amountThb: number;
  cadence?: "monthly";
}

const MARKET_PATTERNS: Array<[ThailandMarket, RegExp]> = [
  ["pattaya", /(?:pattaya|паттай|พัทยา|芭提雅)/],
  ["phuket", /(?:phuket|пхукет|ภูเก็ต|普吉)/],
  ["bangkok", /(?:bangkok|бангкок|กรุงเทพ|曼谷)/],
  ["hua-hin", /(?:hua[\s-]?hin|хуахин|хуа\s?хин|หัวหิน|华欣|華欣)/],
  ["koh-samui", /(?:koh[\s-]?samui|samui|самуи|ко\s?самуи|เกาะสมุย|สมุย|苏梅|蘇梅)/]
];

const QUESTION_COPY: Record<
  ConciergeRequest["locale"],
  Record<"market" | "listingIntent" | "rentBudget" | "purchaseBudget" | "hasChildren" | "hasCar" | "remoteWork" | "purpose" | "prefersQuiet", string>
> = {
  en: {
    market: "Which Thailand market should we focus on?",
    listingIntent: "Do you want to rent, buy, or compare both paths?",
    rentBudget: "What monthly rent budget in THB should I stay under?",
    purchaseBudget: "What purchase budget in THB should I stay under?",
    hasChildren: "Will children live with you?",
    hasCar: "Will you have a car, or should walkability matter more?",
    remoteWork: "Will you work remotely and need strong internet?",
    purpose: "Is this mainly for living, relocation, or investment?",
    prefersQuiet: "Do you prefer quiet, or is a busier tourist area fine?"
  },
  ru: {
    market: "В каком городе или районе Таиланда смотрим?",
    listingIntent: "Вы хотите снять, купить или рассматриваете оба варианта?",
    rentBudget: "Какой месячный бюджет на аренду в батах?",
    purchaseBudget: "Какой бюджет покупки в батах?",
    hasChildren: "Есть дети или планируете жить только взрослыми?",
    hasCar: "Будет машина или важна пешая доступность?",
    remoteWork: "Работаете удаленно и критичен хороший интернет?",
    purpose: "Это покупка для жизни, переезда или инвестиции?",
    prefersQuiet: "Любите тишину или нормальна активная туристическая среда?"
  },
  th: {
    market: "อยากโฟกัสเมืองหรือโซนไหนในไทย?",
    listingIntent: "ต้องการเช่า ซื้อ หรือเปรียบเทียบทั้งสองแบบ?",
    rentBudget: "งบเช่าต่อเดือนในหน่วยบาทไม่เกินเท่าไร?",
    purchaseBudget: "งบซื้อในหน่วยบาทไม่เกินเท่าไร?",
    hasChildren: "จะมีเด็กพักอาศัยด้วยไหม?",
    hasCar: "จะมีรถ หรือควรเน้นเดินทางสะดวกโดยไม่ใช้รถ?",
    remoteWork: "ทำงานออนไลน์และต้องการอินเทอร์เน็ตแรงไหม?",
    purpose: "เป้าหมายหลักคืออยู่อาศัย ย้ายมาอยู่ หรือการลงทุน?",
    prefersQuiet: "ชอบโซนเงียบ หรือโซนท่องเที่ยวคึกคักก็ได้?"
  },
  zh: {
    market: "想重点看泰国哪个城市或区域？",
    listingIntent: "想租、买，还是两种都比较？",
    rentBudget: "每月租金预算希望控制在多少泰铢以内？",
    purchaseBudget: "购买预算希望控制在多少泰铢以内？",
    hasChildren: "会有孩子一起居住吗？",
    hasCar: "会有车，还是更看重步行便利？",
    remoteWork: "会远程办公并且需要稳定高速网络吗？",
    purpose: "主要用途是自住、搬迁还是投资？",
    prefersQuiet: "更喜欢安静区域，还是热闹游客区也可以？"
  }
};

const QUESTION_REASONS: Record<ConciergeRequest["locale"], Record<keyof typeof QUESTION_COPY.en, string>> = {
  en: {
    market: "Market changes lifestyle fit and resale/rental demand.",
    listingIntent: "This keeps monthly rent and purchase budgets from getting mixed.",
    rentBudget: "Budget keeps recommendations realistic.",
    purchaseBudget: "Budget keeps recommendations realistic.",
    hasChildren: "Children change priorities around space, quiet, and schools.",
    hasCar: "Without a car, the area needs stronger daily walkability.",
    remoteWork: "Remote work makes internet, noise, and cafes/coworking more important.",
    purpose: "Living and investment use different scoring criteria.",
    prefersQuiet: "This prevents recommending the wrong neighborhood mood."
  },
  ru: {
    market: "Рынок сильно влияет на стиль жизни и ликвидность.",
    listingIntent: "От этого зависит, какой бюджет и какие объекты показывать.",
    rentBudget: "Без бюджета легко советовать красивые, но бесполезные варианты.",
    purchaseBudget: "Без бюджета легко советовать красивые, но бесполезные варианты.",
    hasChildren: "Для семьи важны тишина, площадь, школы и удобство быта.",
    hasCar: "Без машины район должен быть более самодостаточным.",
    remoteWork: "Для удаленной работы важны интернет, шум и инфраструктура.",
    purpose: "У жизни и инвестиций разные критерии хорошего объекта.",
    prefersQuiet: "Это помогает не ошибиться с районом."
  },
  th: {
    market: "แต่ละตลาดต่างกันทั้งไลฟ์สไตล์และดีมานด์เช่า/ขายต่อ.",
    listingIntent: "ช่วยไม่ให้ปนงบเช่ารายเดือนกับงบซื้อ.",
    rentBudget: "งบประมาณทำให้คำแนะนำอยู่บนความจริง.",
    purchaseBudget: "งบประมาณทำให้คำแนะนำอยู่บนความจริง.",
    hasChildren: "เด็กทำให้พื้นที่ ความเงียบ และโรงเรียนสำคัญขึ้น.",
    hasCar: "ถ้าไม่มีรถ โซนต้องใช้ชีวิตประจำวันได้สะดวกกว่า.",
    remoteWork: "งานออนไลน์ทำให้อินเทอร์เน็ต เสียง และคาเฟ่/โคเวิร์กสำคัญขึ้น.",
    purpose: "อยู่อาศัยกับลงทุนใช้เกณฑ์ให้คะแนนต่างกัน.",
    prefersQuiet: "ช่วยเลี่ยงการแนะนำบรรยากาศย่านที่ผิด."
  },
  zh: {
    market: "不同市场会影响生活方式匹配度和租售需求.",
    listingIntent: "这样不会把月租预算和购买预算混在一起.",
    rentBudget: "预算能让推荐更现实.",
    purchaseBudget: "预算能让推荐更现实.",
    hasChildren: "孩子会改变对面积、安静度和学校的优先级.",
    hasCar: "如果没有车，区域需要更强的日常步行便利.",
    remoteWork: "远程办公会让网络、噪音和咖啡/共享办公更重要.",
    purpose: "自住和投资需要不同的评分标准.",
    prefersQuiet: "这能避免推荐错的社区氛围."
  }
};

interface ConciergeSessionRow {
  id: string;
  tenant_id: string;
  user_id?: string;
  locale: ConciergeSessionSnapshot["locale"];
  status: ConciergeSessionSnapshot["status"];
  profile: ConciergeProfile;
  latest_response: ConciergeResponse;
  created_at: Date;
  updated_at: Date;
}

interface ConciergeMessageRow {
  id: string;
  tenant_id: string;
  session_id: string;
  role: ConciergeSessionMessageSnapshot["role"];
  message: string;
  response?: ConciergeResponse;
  profile?: ConciergeProfile;
  created_at: Date;
}

interface CountRow {
  count: string;
}

interface BucketRow {
  bucket: string | null;
  count: string;
}

interface ConciergeFeedbackRow {
  id: string;
  tenant_id: string;
  session_id: string;
  rating: ConciergeFeedbackSnapshot["rating"];
  area_accurate: boolean | null;
  property_recommendations_useful: boolean | null;
  selected_property_id: string | null;
  note: string | null;
  created_by_user_id: string | null;
  created_by_user_role: ConciergeFeedbackSnapshot["createdByUserRole"] | null;
  created_at: Date;
}

interface ConciergeTrainingDatasetSqlRow {
  session_id: string;
  locale: ConciergeSessionSnapshot["locale"];
  profile: ConciergeProfile;
  latest_response: ConciergeResponse;
  session_created_at: Date;
  feedback_rating: ConciergeFeedbackSnapshot["rating"] | null;
  area_accurate: boolean | null;
  property_recommendations_useful: boolean | null;
  selected_property_id: string | null;
  feedback_note: string | null;
  feedback_created_at: Date | null;
  converted_to_lead: boolean;
}

@Injectable()
export class AiConciergeService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(LeadService) private readonly leads: LeadService,
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository
  ) {}

  async advise(tenantId: string, request: ConciergeRequest): Promise<ConciergeResponse> {
    const profile = this.mergeProfile(request.profile ?? {}, this.inferProfile(request.message));
    const nextQuestions = this.nextQuestions(profile, request.locale);

    if (nextQuestions.length) {
      return {
        id: crypto.randomUUID(),
        stage: "intake",
        profile,
        nextQuestions,
        propertyRecommendations: [],
        summary: this.intakeSummary(profile, nextQuestions, request.locale),
        createdAt: new Date().toISOString()
      };
    }

    const areaRecommendation = this.recommendArea(profile);
    const recommendations = await this.recommendProperties(tenantId, profile);

    return {
      id: crypto.randomUUID(),
      stage: "recommendation",
      profile,
      nextQuestions: [],
      areaRecommendation,
      propertyRecommendations: recommendations,
      summary: this.recommendationSummary(areaRecommendation, recommendations, request.locale),
      createdAt: new Date().toISOString()
    };
  }

  registry(): ConciergeModelRegistryResponse {
    return {
      activeModelVersion: CONCIERGE_MODEL_VERSION,
      models: [
        {
          engine: "baseline-advisory",
          modelVersion: CONCIERGE_MODEL_VERSION,
          predictionTarget: "property_ranking",
          trainingStatus: "not-trained",
          featuresUsed: CONCIERGE_FEATURES,
          active: true,
          description:
            "Deterministic advisory baseline that scores intake profile, area fit, listing fit, feedback, and lead conversion. Ready to be replaced by an LLM reranker or learning-to-rank model."
        }
      ],
      generatedAt: new Date().toISOString()
    };
  }

  async createSession(
    tenantId: string,
    userId: string | undefined,
    request: CreateConciergeSessionRequest
  ): Promise<ConciergeSessionDetailResponse> {
    const response = await this.advise(tenantId, request);
    const now = new Date().toISOString();
    const sessionId = crypto.randomUUID();
    const userMessageId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();

    await this.pool.query(
      `
        insert into concierge_sessions (
          id,
          tenant_id,
          user_id,
          locale,
          status,
          profile,
          latest_response,
          created_at,
          updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        sessionId,
        tenantId,
        userId,
        request.locale,
        this.sessionStatus(response),
        response.profile,
        response,
        now,
        now
      ]
    );
    await this.insertMessage(tenantId, sessionId, userMessageId, "user", request.message, undefined, request.profile, now);
    await this.insertMessage(tenantId, sessionId, assistantMessageId, "assistant", response.summary, response, response.profile, now);

    return this.getSession(tenantId, sessionId);
  }

  async addSessionMessage(
    tenantId: string,
    sessionId: string,
    request: AddConciergeSessionMessageRequest
  ): Promise<ConciergeSessionDetailResponse> {
    const session = await this.findSession(tenantId, sessionId);
    const mergedProfile = this.mergeProfile(session.profile, request.profile ?? {});
    const response = await this.advise(tenantId, {
      locale: session.locale,
      message: request.message,
      profile: mergedProfile
    });
    const now = new Date().toISOString();

    await this.pool.query(
      `
        update concierge_sessions
        set status = $1, profile = $2, latest_response = $3, updated_at = $4
        where tenant_id = $5 and id = $6
      `,
      [this.sessionStatus(response), response.profile, response, now, tenantId, sessionId]
    );
    await this.insertMessage(
      tenantId,
      sessionId,
      crypto.randomUUID(),
      "user",
      request.message,
      undefined,
      request.profile,
      now
    );
    await this.insertMessage(
      tenantId,
      sessionId,
      crypto.randomUUID(),
      "assistant",
      response.summary,
      response,
      response.profile,
      now
    );

    return this.getSession(tenantId, sessionId);
  }

  async getSession(tenantId: string, sessionId: string): Promise<ConciergeSessionDetailResponse> {
    const session = await this.findSession(tenantId, sessionId);
    const messagesResult = await this.pool.query<ConciergeMessageRow>(
      `
        select *
        from concierge_messages
        where tenant_id = $1 and session_id = $2
        order by created_at asc
      `,
      [tenantId, sessionId]
    );

    return {
      session,
      messages: messagesResult.rows.map((row) => this.toMessageSnapshot(row))
    };
  }

  async listSessions(
    tenantId: string,
    request: ListConciergeSessionsRequest
  ): Promise<ConciergeSessionListResponse> {
    const clauses = ["tenant_id = $1"];
    const values: unknown[] = [tenantId];
    const limit = Math.min(Math.max(request.limit ?? 50, 1), 100);
    const addValue = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };

    if (request.status) {
      clauses.push(`status = ${addValue(request.status)}`);
    }

    if (request.userId) {
      clauses.push(`user_id = ${addValue(request.userId)}`);
    }

    const result = await this.pool.query<ConciergeSessionRow>(
      `
        select *
        from concierge_sessions
        where ${clauses.join(" and ")}
        order by updated_at desc
        limit ${addValue(limit)}
      `,
      values
    );

    return {
      items: result.rows.map((row) => this.toSessionSnapshot(row)),
      total: result.rows.length,
      filters: {
        status: request.status,
        userId: request.userId,
        limit
      }
    };
  }

  async createLeadFromSession(
    tenantId: string,
    sessionId: string,
    request: CreateLeadFromConciergeSessionRequest,
    user: RequestUser
  ): Promise<LeadSnapshot> {
    const session = await this.findSession(tenantId, sessionId);
    const preferredPropertyId = request.propertyId ?? session.latestResponse.propertyRecommendations[0]?.propertyId;

    return this.leads.create(
      tenantId,
      {
        propertyId: preferredPropertyId,
        source: "ai-concierge",
        contactName: request.contactName,
        contactEmail: request.contactEmail,
        contactPhone: request.contactPhone,
        preferredLocale: session.locale,
        assignedAgentId: request.assignedAgentId ?? user.id,
        message: request.message ?? this.buildLeadMessage(session),
        attributionSearchEventId: session.id,
        attributionSearchQuery: session.latestResponse.summary,
        attributionSearchSource: "ai"
      },
      user
    );
  }

  async submitFeedback(
    tenantId: string,
    sessionId: string,
    request: SubmitConciergeFeedbackRequest,
    user: RequestUser
  ): Promise<ConciergeFeedbackSnapshot> {
    await this.findSession(tenantId, sessionId);
    const now = new Date().toISOString();
    const result = await this.pool.query<ConciergeFeedbackRow>(
      `
        insert into concierge_feedback (
          id,
          tenant_id,
          session_id,
          rating,
          area_accurate,
          property_recommendations_useful,
          selected_property_id,
          note,
          created_by_user_id,
          created_by_user_role,
          created_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        returning *
      `,
      [
        crypto.randomUUID(),
        tenantId,
        sessionId,
        request.rating,
        request.areaAccurate ?? null,
        request.propertyRecommendationsUseful ?? null,
        request.selectedPropertyId ?? null,
        request.note ?? null,
        user.id,
        user.role,
        now
      ]
    );

    return this.toFeedbackSnapshot(result.rows[0]);
  }

  async getTrainingDataset(
    tenantId: string,
    request: ConciergeTrainingDatasetRequest
  ): Promise<ConciergeTrainingDatasetResponse> {
    const clauses = ["session.tenant_id = $1"];
    const values: unknown[] = [tenantId];
    const limit = Math.min(Math.max(request.limit ?? 100, 1), 500);
    const addValue = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };

    if (request.rating) {
      clauses.push(`feedback.rating = ${addValue(request.rating)}`);
    }

    if (request.convertedOnly) {
      clauses.push("lead.id is not null");
    }

    const result = await this.pool.query<ConciergeTrainingDatasetSqlRow>(
      `
        select
          session.id as session_id,
          session.locale,
          session.profile,
          session.latest_response,
          session.created_at as session_created_at,
          feedback.rating as feedback_rating,
          feedback.area_accurate,
          feedback.property_recommendations_useful,
          feedback.selected_property_id,
          feedback.note as feedback_note,
          feedback.created_at as feedback_created_at,
          (lead.id is not null) as converted_to_lead
        from concierge_sessions session
        left join lateral (
          select *
          from concierge_feedback feedback
          where feedback.tenant_id = session.tenant_id
            and feedback.session_id = session.id
          order by feedback.created_at desc
          limit 1
        ) feedback on true
        left join leads lead
          on lead.tenant_id = session.tenant_id
          and lead.source = 'ai-concierge'
          and lead.attribution_search_event_id = session.id
        where ${clauses.join(" and ")}
        order by session.updated_at desc
        limit ${addValue(limit)}
      `,
      values
    );

    return {
      items: result.rows.map((row) => this.toTrainingDatasetRow(row)),
      total: result.rows.length,
      generatedAt: new Date().toISOString()
    };
  }

  async getAnalytics(tenantId: string, request: ListConciergeSessionsRequest): Promise<ConciergeAnalyticsResponse> {
    const sessionClauses = ["tenant_id = $1"];
    const sessionValues: unknown[] = [tenantId];
    const addSessionValue = (value: unknown): string => {
      sessionValues.push(value);
      return `$${sessionValues.length}`;
    };

    if (request.userId) {
      sessionClauses.push(`user_id = ${addSessionValue(request.userId)}`);
    }

    const whereSessions = sessionClauses.join(" and ");
    const [
      totalSessions,
      awaitingInputSessions,
      recommendedSessions,
      convertedLeads,
      feedbackCount,
      positiveFeedbackCount,
      sessionsByPurpose,
      sessionsByMarket,
      recommendedAreas,
      feedbackByRating
    ] = await Promise.all([
      this.count(`select count(*) from concierge_sessions where ${whereSessions}`, sessionValues),
      this.count(`select count(*) from concierge_sessions where ${whereSessions} and status = 'awaiting-input'`, sessionValues),
      this.count(`select count(*) from concierge_sessions where ${whereSessions} and status = 'recommended'`, sessionValues),
      this.count(
        `
          select count(*)
          from leads
          where tenant_id = $1
            and source = 'ai-concierge'
            and attribution_search_event_id is not null
            ${request.userId ? "and assigned_agent_id = $2" : ""}
        `,
        request.userId ? [tenantId, request.userId] : [tenantId]
      ),
      this.count(
        `
          select count(*)
          from concierge_feedback feedback
          join concierge_sessions session on session.tenant_id = feedback.tenant_id and session.id = feedback.session_id
          where feedback.tenant_id = $1
            ${request.userId ? "and session.user_id = $2" : ""}
        `,
        request.userId ? [tenantId, request.userId] : [tenantId]
      ),
      this.count(
        `
          select count(*)
          from concierge_feedback feedback
          join concierge_sessions session on session.tenant_id = feedback.tenant_id and session.id = feedback.session_id
          where feedback.tenant_id = $1
            and feedback.rating = 'positive'
            ${request.userId ? "and session.user_id = $2" : ""}
        `,
        request.userId ? [tenantId, request.userId] : [tenantId]
      ),
      this.bucket(
        `
          select profile ->> 'purpose' as bucket, count(*)
          from concierge_sessions
          where ${whereSessions} and profile ->> 'purpose' is not null
          group by bucket
          order by count(*) desc, bucket asc
          limit 10
        `,
        sessionValues
      ),
      this.bucket(
        `
          select profile ->> 'market' as bucket, count(*)
          from concierge_sessions
          where ${whereSessions} and profile ->> 'market' is not null
          group by bucket
          order by count(*) desc, bucket asc
          limit 10
        `,
        sessionValues
      ),
      this.bucket(
        `
          select latest_response #>> '{areaRecommendation,area}' as bucket, count(*)
          from concierge_sessions
          where ${whereSessions} and latest_response #>> '{areaRecommendation,area}' is not null
          group by bucket
          order by count(*) desc, bucket asc
          limit 10
        `,
        sessionValues
      ),
      this.bucket(
        `
          select feedback.rating as bucket, count(*)
          from concierge_feedback feedback
          join concierge_sessions session on session.tenant_id = feedback.tenant_id and session.id = feedback.session_id
          where feedback.tenant_id = $1
            ${request.userId ? "and session.user_id = $2" : ""}
          group by bucket
          order by count(*) desc, bucket asc
          limit 10
        `,
        request.userId ? [tenantId, request.userId] : [tenantId]
      )
    ]);

    return {
      tenantId,
      totalSessions,
      awaitingInputSessions,
      recommendedSessions,
      convertedLeads,
      feedbackCount,
      recommendationRate: totalSessions > 0 ? Math.round((recommendedSessions / totalSessions) * 10_000) / 100 : 0,
      leadConversionRate: totalSessions > 0 ? Math.round((convertedLeads / totalSessions) * 10_000) / 100 : 0,
      positiveFeedbackRate:
        feedbackCount > 0 ? Math.round((positiveFeedbackCount / feedbackCount) * 10_000) / 100 : 0,
      sessionsByPurpose,
      sessionsByMarket,
      recommendedAreas,
      feedbackByRating,
      generatedAt: new Date().toISOString()
    };
  }

  private async findSession(tenantId: string, sessionId: string): Promise<ConciergeSessionSnapshot> {
    const result = await this.pool.query<ConciergeSessionRow>(
      `
        select *
        from concierge_sessions
        where tenant_id = $1 and id = $2
      `,
      [tenantId, sessionId]
    );
    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException("Concierge session not found");
    }

    return this.toSessionSnapshot(row);
  }

  private insertMessage(
    tenantId: string,
    sessionId: string,
    messageId: string,
    role: ConciergeSessionMessageSnapshot["role"],
    message: string,
    response: ConciergeResponse | undefined,
    profile: ConciergeProfile | undefined,
    createdAt: string
  ): Promise<unknown> {
    return this.pool.query(
      `
        insert into concierge_messages (
          id,
          tenant_id,
          session_id,
          role,
          message,
          response,
          profile,
          created_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [messageId, tenantId, sessionId, role, message, response, profile, createdAt]
    );
  }

  private sessionStatus(response: ConciergeResponse): ConciergeSessionSnapshot["status"] {
    return response.stage === "recommendation" ? "recommended" : "awaiting-input";
  }

  private toSessionSnapshot(row: ConciergeSessionRow): ConciergeSessionSnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      locale: row.locale,
      status: row.status,
      profile: row.profile,
      latestResponse: row.latest_response,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private toMessageSnapshot(row: ConciergeMessageRow): ConciergeSessionMessageSnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      sessionId: row.session_id,
      role: row.role,
      message: row.message,
      response: row.response,
      profile: row.profile,
      createdAt: row.created_at.toISOString()
    };
  }

  private toFeedbackSnapshot(row: ConciergeFeedbackRow): ConciergeFeedbackSnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      sessionId: row.session_id,
      rating: row.rating,
      areaAccurate: row.area_accurate ?? undefined,
      propertyRecommendationsUseful: row.property_recommendations_useful ?? undefined,
      selectedPropertyId: row.selected_property_id ?? undefined,
      note: row.note ?? undefined,
      createdByUserId: row.created_by_user_id ?? undefined,
      createdByUserRole: row.created_by_user_role ?? undefined,
      createdAt: row.created_at.toISOString()
    };
  }

  private toTrainingDatasetRow(row: ConciergeTrainingDatasetSqlRow): ConciergeTrainingDatasetRow {
    const feedback = row.feedback_rating
      ? {
          rating: row.feedback_rating,
          areaAccurate: row.area_accurate ?? undefined,
          propertyRecommendationsUseful: row.property_recommendations_useful ?? undefined,
          selectedPropertyId: row.selected_property_id ?? undefined,
          note: row.feedback_note ?? undefined,
          createdAt: row.feedback_created_at!.toISOString()
        }
      : undefined;

    return {
      sessionId: row.session_id,
      locale: row.locale,
      profile: row.profile,
      recommendation: {
        stage: row.latest_response.stage,
        area: row.latest_response.areaRecommendation,
        properties: row.latest_response.propertyRecommendations,
        summary: row.latest_response.summary
      },
      feedback,
      label: {
        accepted: row.feedback_rating === "positive",
        convertedToLead: row.converted_to_lead,
        selectedPropertyId: row.selected_property_id ?? undefined
      },
      createdAt: row.session_created_at.toISOString()
    };
  }

  private async count(sql: string, values: unknown[]): Promise<number> {
    const result = await this.pool.query<CountRow>(sql, values);
    return Number(result.rows[0]?.count ?? 0);
  }

  private async bucket(sql: string, values: unknown[]) {
    const result = await this.pool.query<BucketRow>(sql, values);

    return result.rows
      .filter((row) => row.bucket)
      .map((row) => ({
        bucket: row.bucket!,
        count: Number(row.count)
      }));
  }

  private buildLeadMessage(session: ConciergeSessionSnapshot): string {
    const profile = session.profile;
    const area = session.latestResponse.areaRecommendation?.area;
    const topProperty = session.latestResponse.propertyRecommendations[0];
    const profileParts = [
      profile.market ? `market=${profile.market}` : undefined,
      profile.listingIntent ? `listingIntent=${profile.listingIntent}` : undefined,
      profile.budgetThb ? `budgetThb=${profile.budgetThb}` : undefined,
      profile.purpose ? `purpose=${profile.purpose}` : undefined,
      profile.hasChildren !== undefined ? `hasChildren=${profile.hasChildren}` : undefined,
      profile.hasCar !== undefined ? `hasCar=${profile.hasCar}` : undefined,
      profile.remoteWork !== undefined ? `remoteWork=${profile.remoteWork}` : undefined,
      profile.prefersQuiet !== undefined ? `prefersQuiet=${profile.prefersQuiet}` : undefined
    ].filter(Boolean);

    return [
      "Created from AI Concierge session.",
      area ? `Recommended area: ${area}.` : undefined,
      topProperty ? `Top listing: ${topProperty.title} (${topProperty.fit}, score ${topProperty.score}).` : undefined,
      profileParts.length ? `Profile: ${profileParts.join(", ")}.` : undefined,
      `Concierge summary: ${session.latestResponse.summary}`
    ]
      .filter(Boolean)
      .join(" ");
  }

  private inferProfile(message: string): ConciergeProfile {
    const normalized = this.normalize(message);
    const profile: ConciergeProfile = {};

    const market = this.detectMarket(normalized);
    if (market) {
      profile.market = market;
    }

    const budget = this.detectBudget(normalized);
    if (budget) {
      profile.budgetThb = budget.amountThb;
    }

    const listingIntent = this.detectListingIntent(normalized);
    if (listingIntent) {
      profile.listingIntent = listingIntent;
    } else if (budget?.cadence === "monthly") {
      profile.listingIntent = "rent";
    } else if (budget && budget.amountThb >= 500_000) {
      profile.listingIntent = "sale";
    } else if (budget) {
      profile.listingIntent = "rent";
    }

    if (/(семь|семей|family|children|дет|ครอบครัว|เด็ก|โรงเรียน|家庭|家人|孩子|学校|學校)/.test(normalized)) {
      profile.purpose = "family";
      profile.hasChildren = true;
      profile.familySize = profile.familySize ?? 3;
    }

    if (/(переезж|переезд|relocat|move|ย้าย|搬到|移居)/.test(normalized)) {
      profile.purpose = profile.purpose ?? "relocation";
    }

    if (/(инвест|доходн|roi|yield|rent out|сдач|ลงทุน|ผลตอบแทน|ปล่อยเช่า|投资|投資|收益|回报|回報|出租收益)/.test(normalized)) {
      profile.purpose = profile.purpose ?? "investment";
    }

    if (/(rent|lease|аренд|снять|เช่า|租房|租公寓|月租|อยู่เอง|อาศัย|自住|居住)/.test(normalized)) {
      profile.purpose = profile.purpose ?? "living";
    }

    if (/(удален|remote|internet|интернет|online|ออนไลน์|เน็ต|อินเทอร์เน็ต|远程|遠程|网络|網絡|共享办公|共享辦公)/.test(normalized)) {
      profile.remoteWork = true;
    }

    if (/(тих|quiet|calm|спокойн|เงียบ|สงบ|安静|安靜)/.test(normalized)) {
      profile.prefersQuiet = true;
    }

    if (/(без машины|без авто|no car|without car|ไม่มีรถ|ไม่ใช้รถ|没车|沒有車|无车|無車|不想开车|不想開車)/.test(normalized)) {
      profile.hasCar = false;
    } else if (/(машин|авто|car|drive|รถ|开车|開車|有车|有車)/.test(normalized)) {
      profile.hasCar = true;
    }

    return profile;
  }

  private mergeProfile(current: ConciergeProfile, inferred: ConciergeProfile): ConciergeProfile {
    return {
      ...inferred,
      ...current
    };
  }

  private nextQuestions(profile: ConciergeProfile, locale: ConciergeRequest["locale"]): ConciergeQuestion[] {
    const questions: ConciergeQuestion[] = [];
    const copy = QUESTION_COPY[locale];
    const reasons = QUESTION_REASONS[locale];

    if (!profile.market) {
      questions.push({
        id: "market",
        question: copy.market,
        reason: reasons.market
      });
    }

    if (!profile.listingIntent) {
      questions.push({
        id: "listingIntent",
        question: copy.listingIntent,
        reason: reasons.listingIntent
      });
    }

    if (!profile.budgetThb) {
      const budgetQuestion = profile.listingIntent === "rent" ? copy.rentBudget : copy.purchaseBudget;
      questions.push({
        id: "budgetThb",
        question: budgetQuestion,
        reason: profile.listingIntent === "rent" ? reasons.rentBudget : reasons.purchaseBudget
      });
    }

    if (profile.hasChildren === undefined) {
      questions.push({
        id: "hasChildren",
        question: copy.hasChildren,
        reason: reasons.hasChildren
      });
    }

    if (profile.hasCar === undefined) {
      questions.push({
        id: "hasCar",
        question: copy.hasCar,
        reason: reasons.hasCar
      });
    }

    if (profile.remoteWork === undefined) {
      questions.push({
        id: "remoteWork",
        question: copy.remoteWork,
        reason: reasons.remoteWork
      });
    }

    if (!profile.purpose) {
      questions.push({
        id: "purpose",
        question: copy.purpose,
        reason: reasons.purpose
      });
    }

    if (profile.prefersQuiet === undefined) {
      questions.push({
        id: "prefersQuiet",
        question: copy.prefersQuiet,
        reason: reasons.prefersQuiet
      });
    }

    return questions.slice(0, 4);
  }

  private recommendArea(profile: ConciergeProfile): ConciergeAreaRecommendation {
    const market = profile.market ?? "pattaya";

    if (market === "pattaya" && profile.hasChildren && profile.prefersQuiet) {
      return {
        area: "Wongamat",
        market,
        fit: "strong",
        reasons: [
          "Quieter residential feel than Central Pattaya.",
          "Good fit for family relocation and beach lifestyle.",
          "Still close enough to city infrastructure for daily errands."
        ],
        tradeoffs: ["Fewer nightlife options nearby.", "Prime buildings can be more expensive than inland areas."]
      };
    }

    if (market === "pattaya" && profile.hasCar === false) {
      return {
        area: "Central Pattaya",
        market,
        fit: "moderate",
        reasons: ["Strong walkability.", "Easy access to malls, cafes, restaurants, and transport."],
        tradeoffs: ["More noise and tourist traffic.", "Less calm for family routines."]
      };
    }

    if (market === "pattaya") {
      return {
        area: "Pratumnak",
        market,
        fit: "moderate",
        reasons: ["Balanced residential mood.", "Beach access and calmer streets than the city center."],
        tradeoffs: ["Some buildings require transport for daily errands."]
      };
    }

    return {
      area: `${market} family-friendly residential zones`,
      market,
      fit: "moderate",
      reasons: ["Matches the selected market and long-stay use case."],
      tradeoffs: ["Needs more neighborhood data before making a sharper area call."]
    };
  }

  private async recommendProperties(
    tenantId: string,
    profile: ConciergeProfile
  ): Promise<ConciergePropertyRecommendation[]> {
    const strictCandidates = await this.properties.search(tenantId, {
      market: profile.market,
      listingType: profile.listingIntent,
      maxMonthlyRentThb: profile.listingIntent === "rent" ? profile.budgetThb : undefined,
      maxPriceThb: profile.listingIntent === "rent" ? undefined : profile.budgetThb,
      minBedrooms: profile.hasChildren ? 2 : undefined,
      requiredAmenities: profile.remoteWork ? ["fast-internet"] : undefined
    });
    const relaxedCandidates = strictCandidates.length
      ? strictCandidates
      : await this.properties.search(tenantId, {
          market: profile.market,
          listingType: profile.listingIntent,
          maxMonthlyRentThb: profile.listingIntent === "rent" ? profile.budgetThb : undefined,
          maxPriceThb: profile.listingIntent === "rent" ? undefined : profile.budgetThb
        });
    const candidates = relaxedCandidates.length
      ? relaxedCandidates
      : await this.properties.search(tenantId, {
          market: profile.market
        });

    return candidates
      .map((property) => this.scoreProperty(property, profile))
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);
  }

  private scoreProperty(property: PropertySnapshot, profile: ConciergeProfile): ConciergePropertyRecommendation {
    const reasons: string[] = [];
    const tradeoffs: string[] = [];
    let score = 0;

    if (profile.budgetThb && property.price.amount <= profile.budgetThb) {
      score += 3;
      reasons.push("Fits the stated budget.");
    }

    if (profile.hasChildren && property.bedrooms >= 2) {
      score += 3;
      reasons.push("Two or more bedrooms fit family living better.");
    } else if (profile.hasChildren) {
      tradeoffs.push("Bedroom count may be tight for a family.");
    }

    if (profile.remoteWork && property.amenities.includes("fast-internet")) {
      score += 2;
      reasons.push("Fast internet supports remote work.");
    } else if (profile.remoteWork) {
      tradeoffs.push("No explicit fast-internet signal yet.");
    }

    if ((property.beachDistanceMeters ?? Number.POSITIVE_INFINITY) <= 1200) {
      score += 1.5;
      reasons.push("Beach is within a practical daily distance.");
    }

    if (profile.prefersQuiet && property.floor !== undefined && property.floor >= 8) {
      score += 1;
      reasons.push("Higher floor can reduce street noise.");
    }

    if (profile.hasCar === false && (property.beachDistanceMeters ?? Number.POSITIVE_INFINITY) > 1600) {
      tradeoffs.push("May be less convenient without a car.");
    }

    const roundedScore = Math.round(score * 10) / 10;

    return {
      propertyId: property.id,
      title: property.title,
      score: roundedScore,
      fit: roundedScore >= 7 ? "strong" : roundedScore >= 4 ? "moderate" : "weak",
      reasons: reasons.length ? reasons : ["Matches some basic search constraints."],
      tradeoffs
    };
  }

  private recommendationSummary(
    area: ConciergeAreaRecommendation,
    recommendations: ConciergePropertyRecommendation[],
    locale: ConciergeRequest["locale"]
  ): string {
    const top = recommendations[0];

    if (locale === "ru") {
      return top
        ? `Исходя из ответов, я бы начал с района ${area.area}: ${area.reasons[0]} Лучший объект сейчас: ${top.title}.`
        : `Исходя из ответов, я бы начал с района ${area.area}: ${area.reasons[0]} Подходящих объектов в базе пока не нашел.`;
    }

    if (locale === "th") {
      return top
        ? `จากคำตอบของคุณ ฉันจะเริ่มที่โซน ${area.area}: ${area.reasons[0]} รายการที่เหมาะที่สุดตอนนี้คือ ${top.title}.`
        : `จากคำตอบของคุณ ฉันจะเริ่มที่โซน ${area.area}: ${area.reasons[0]} ตอนนี้ยังไม่พบรายการที่ตรงพอ.`;
    }

    if (locale === "zh") {
      return top
        ? `根据你的回答，我会先看 ${area.area}: ${area.reasons[0]} 目前最匹配的房源是 ${top.title}.`
        : `根据你的回答，我会先看 ${area.area}: ${area.reasons[0]} 目前还没有找到足够匹配的房源.`;
    }

    return top
      ? `Based on your answers, I would start with ${area.area}: ${area.reasons[0]} Current top listing: ${top.title}.`
      : `Based on your answers, I would start with ${area.area}: ${area.reasons[0]} I did not find matching listings yet.`;
  }

  private intakeSummary(
    profile: ConciergeProfile,
    questions: ConciergeQuestion[],
    locale: ConciergeRequest["locale"]
  ): string {
    const known = this.describeProfile(profile, locale);
    const questionText = questions.map((question) => question.question).join(" ");

    if (locale === "ru") {
      return known
        ? `Я понял вводные: ${known}. Чтобы подобрать район и объекты точнее, уточню несколько деталей. ${questionText}`
        : `Я задам несколько коротких вопросов, чтобы подобрать район и объекты точнее. ${questionText}`;
    }

    if (locale === "th") {
      return known
        ? `ฉันเข้าใจข้อมูลเบื้องต้นแล้ว: ${known}. เพื่อแนะนำโซนและรายการให้แม่นขึ้น ขอถามเพิ่มสั้นๆ ${questionText}`
        : `ขอถามเพิ่มสั้นๆ เพื่อแนะนำโซนและรายการให้แม่นขึ้น ${questionText}`;
    }

    if (locale === "zh") {
      return known
        ? `我已了解这些条件：${known}. 为了更准确推荐区域和房源，还需要确认几个问题。${questionText}`
        : `为了更准确推荐区域和房源，我需要先确认几个简短问题。${questionText}`;
    }

    return known
      ? `I have enough to start with ${known}. To recommend an area and listings more precisely, I need a few quick details. ${questionText}`
      : `I need a few quick details before recommending an area and listings. ${questionText}`;
  }

  private describeProfile(profile: ConciergeProfile, locale: ConciergeRequest["locale"]): string {
    const parts = [
      profile.market ? this.describeMarket(profile.market, locale) : undefined,
      profile.listingIntent ? this.describeListingIntent(profile.listingIntent, locale) : undefined,
      profile.budgetThb ? this.describeBudget(profile.budgetThb, locale) : undefined,
      profile.purpose ? this.describePurpose(profile.purpose, locale) : undefined,
      profile.hasChildren !== undefined ? this.describeBooleanSignal("children", profile.hasChildren, locale) : undefined,
      profile.hasCar !== undefined ? this.describeBooleanSignal("car", profile.hasCar, locale) : undefined,
      profile.remoteWork !== undefined ? this.describeBooleanSignal("remoteWork", profile.remoteWork, locale) : undefined,
      profile.prefersQuiet !== undefined ? this.describeBooleanSignal("quiet", profile.prefersQuiet, locale) : undefined
    ].filter(Boolean);

    return parts.join(locale === "zh" ? "，" : ", ");
  }

  private describeListingIntent(listingIntent: PropertyListingType, locale: ConciergeRequest["locale"]): string {
    const labels: Record<ConciergeRequest["locale"], Record<PropertyListingType, string>> = {
      en: {
        rent: "rental intent",
        sale: "purchase intent",
        sale_or_rent: "rent-or-buy intent"
      },
      ru: {
        rent: "формат: аренда",
        sale: "формат: покупка",
        sale_or_rent: "формат: аренда или покупка"
      },
      th: {
        rent: "ต้องการเช่า",
        sale: "ต้องการซื้อ",
        sale_or_rent: "เช่าหรือซื้อ"
      },
      zh: {
        rent: "租赁需求",
        sale: "购买需求",
        sale_or_rent: "租或买都可"
      }
    };

    return labels[locale][listingIntent];
  }

  private describePurpose(purpose: PropertyPurpose, locale: ConciergeRequest["locale"]): string {
    const labels: Record<ConciergeRequest["locale"], Record<PropertyPurpose, string>> = {
      en: {
        family: "family goal",
        investment: "investment goal",
        living: "living goal",
        relocation: "relocation goal"
      },
      ru: {
        family: "семья",
        investment: "инвестиция",
        living: "жизнь",
        relocation: "переезд"
      },
      th: {
        family: "เพื่อครอบครัว",
        investment: "เพื่อการลงทุน",
        living: "เพื่ออยู่อาศัย",
        relocation: "เพื่อย้ายมาอยู่"
      },
      zh: {
        family: "家庭用途",
        investment: "投资用途",
        living: "自住用途",
        relocation: "搬迁用途"
      }
    };

    return labels[locale][purpose];
  }

  private describeMarket(market: ThailandMarket, locale: ConciergeRequest["locale"]): string {
    if (locale === "ru") {
      return `рынок ${market}`;
    }

    if (locale === "th") {
      return `ตลาด ${market}`;
    }

    if (locale === "zh") {
      return `${market} 市场`;
    }

    return `${market} market`;
  }

  private describeBudget(amount: number, locale: ConciergeRequest["locale"]): string {
    if (locale === "ru") {
      return `бюджет до ${this.formatThb(amount)}`;
    }

    if (locale === "th") {
      return `งบไม่เกิน ${this.formatThb(amount)}`;
    }

    if (locale === "zh") {
      return `预算不超过 ${this.formatThb(amount)}`;
    }

    return `budget up to ${this.formatThb(amount)}`;
  }

  private describeBooleanSignal(
    signal: "children" | "car" | "remoteWork" | "quiet",
    value: boolean,
    locale: ConciergeRequest["locale"]
  ): string {
    const labels: Record<ConciergeRequest["locale"], Record<typeof signal, [string, string]>> = {
      en: {
        children: ["children will live there", "adults only"],
        car: ["you will have a car", "walkability matters"],
        remoteWork: ["remote work matters", "internet is not critical"],
        quiet: ["you prefer quiet", "a livelier area is fine"]
      },
      ru: {
        children: ["с детьми", "без детей"],
        car: ["будет машина", "важна пешая доступность"],
        remoteWork: ["важна удаленная работа", "интернет не критичен"],
        quiet: ["предпочитаете тишину", "активный район допустим"]
      },
      th: {
        children: ["มีเด็กพักด้วย", "ผู้ใหญ่เท่านั้น"],
        car: ["มีรถ", "ต้องการเดินทางสะดวก"],
        remoteWork: ["ต้องทำงานออนไลน์", "อินเทอร์เน็ตไม่ใช่เงื่อนไขหลัก"],
        quiet: ["ชอบความเงียบ", "โซนคึกคักก็ได้"]
      },
      zh: {
        children: ["有孩子居住", "仅成人居住"],
        car: ["会有车", "重视步行便利"],
        remoteWork: ["需要远程办公", "网络不是关键条件"],
        quiet: ["偏好安静", "热闹区域也可以"]
      }
    };

    return labels[locale][signal][value ? 0 : 1];
  }

  private formatThb(amount: number): string {
    if (amount >= 1_000_000) {
      return `${Number.parseFloat((amount / 1_000_000).toFixed(1))}M THB`;
    }

    if (amount >= 1_000) {
      return `${Math.round(amount / 1_000)}k THB`;
    }

    return `${amount} THB`;
  }

  private detectMarket(message: string): ThailandMarket | undefined {
    return MARKET_PATTERNS.find(([, pattern]) => pattern.test(message))?.[0];
  }

  private detectListingIntent(message: string): PropertyListingType | undefined {
    if (/(rent out|yield|roi|invest|investment|сдач|доход|инвест|ลงทุน|ผลตอบแทน|ปล่อยเช่า|投资|投資|收益|回报|回報|出租收益)/.test(message)) {
      return "sale";
    }

    const rentalIntent = /(?:rent|lease|аренд|снять|сним|เช่า|ให้เช่า|租房|租公寓|月租)/.test(message);
    const saleIntent = /(?:buy|purchase|ownership|sale|купить|покуп|ซื้อ|ขาย|买|買|购买|購買|出售)/.test(message);

    if (rentalIntent && saleIntent) {
      return "sale_or_rent";
    }

    if (rentalIntent) {
      return "rent";
    }

    if (saleIntent) {
      return "sale";
    }

    return undefined;
  }

  private detectBudget(message: string): BudgetSignal | undefined {
    const cadence = /(?:month|monthly|per month|месяц|мес|ต่อเดือน|รายเดือน|每月|月租)/.test(message)
      ? "monthly"
      : undefined;
    const millionMatch = message.match(
      /(?:до|under|below|max|maximum|budget|งบ|ไม่เกิน|ต่ำกว่า|预算|預算|不超过|不超過|低于|低於)?\s*(\d+(?:[.,]\d+)?)\s*(?:млн|million|m|ล้าน|百万|百萬)\s*(?:бат|baht|thb|บาท|泰铢|泰銖)?/
    );
    if (millionMatch?.[1]) {
      return {
        amountThb: Math.round(Number(millionMatch[1].replace(",", ".")) * 1_000_000),
        cadence
      };
    }

    const tenThousandMatch = message.match(
      /(?:до|under|below|max|maximum|budget|งบ|ไม่เกิน|ต่ำกว่า|预算|預算|不超过|不超過|低于|低於)?\s*(\d+(?:[.,]\d+)?)\s*(?:万|萬)\s*(?:บาท|泰铢|泰銖|thb)?/
    );
    if (tenThousandMatch?.[1]) {
      return {
        amountThb: Math.round(Number(tenThousandMatch[1].replace(",", ".")) * 10_000),
        cadence
      };
    }

    const thbMatch = message.match(
      /(?:до|under|below|max|maximum|budget|งบ|ไม่เกิน|ต่ำกว่า|预算|預算|不超过|不超過|低于|低於)?\s*(\d[\d\s,.]*)\s*(?:бат|baht|thb|บาท|泰铢|泰銖)/
    );
    if (thbMatch?.[1]) {
      const amount = Number(thbMatch[1].replace(/[^\d]/g, ""));

      return Number.isFinite(amount) && amount > 0 ? { amountThb: amount, cadence } : undefined;
    }

    return undefined;
  }

  private normalize(message: string): string {
    return message
      .toLowerCase()
      .replaceAll("ё", "е")
      .replace(/[，。；：]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}
