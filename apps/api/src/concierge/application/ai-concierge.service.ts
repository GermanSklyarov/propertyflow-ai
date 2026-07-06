import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AddConciergeSessionMessageRequest,
  ConciergeAreaRecommendation,
  ConciergeProfile,
  ConciergePropertyRecommendation,
  ConciergeQuestion,
  ConciergeRequest,
  ConciergeResponse,
  ConciergeSessionDetailResponse,
  ConciergeSessionListResponse,
  ConciergeSessionMessageSnapshot,
  ConciergeSessionSnapshot,
  CreateConciergeSessionRequest,
  ListConciergeSessionsRequest
} from "@propertyflow/contracts";
import type { PropertySnapshot, ThailandMarket } from "@propertyflow/domain";
import type { Pool } from "pg";
import { PG_POOL } from "../../database/database.constants.js";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../properties/domain/property.repository.js";

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

@Injectable()
export class AiConciergeService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
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

  private inferProfile(message: string): ConciergeProfile {
    const normalized = message.toLowerCase().replaceAll("ё", "е");
    const profile: ConciergeProfile = {};

    const market = this.detectMarket(normalized);
    if (market) {
      profile.market = market;
    }

    const budget = this.detectBudget(normalized);
    if (budget) {
      profile.budgetThb = budget;
    }

    if (/(семь|family|children|дет)/.test(normalized)) {
      profile.purpose = "family";
      profile.hasChildren = true;
      profile.familySize = profile.familySize ?? 3;
    }

    if (/(переезж|переезд|relocat|move)/.test(normalized)) {
      profile.purpose = profile.purpose ?? "relocation";
    }

    if (/(удален|remote|internet|интернет|online)/.test(normalized)) {
      profile.remoteWork = true;
    }

    if (/(тих|quiet|calm|спокойн)/.test(normalized)) {
      profile.prefersQuiet = true;
    }

    if (/(машин|car|drive)/.test(normalized)) {
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
    const ru = locale === "ru";

    if (!profile.market) {
      questions.push({
        id: "market",
        question: ru ? "В каком городе или районе Таиланда смотрим?" : "Which Thailand market should we focus on?",
        reason: ru ? "Рынок сильно влияет на стиль жизни и ликвидность." : "Market changes lifestyle fit and resale/rental demand."
      });
    }

    if (!profile.budgetThb) {
      questions.push({
        id: "budgetThb",
        question: ru ? "Какой бюджет в батах?" : "What budget in THB should I stay under?",
        reason: ru ? "Без бюджета легко советовать красивые, но бесполезные варианты." : "Budget keeps recommendations realistic."
      });
    }

    if (profile.hasChildren === undefined) {
      questions.push({
        id: "hasChildren",
        question: ru ? "Есть дети или планируете жить только взрослыми?" : "Will children live with you?",
        reason: ru ? "Для семьи важны тишина, площадь, школы и удобство быта." : "Children change priorities around space, quiet, and schools."
      });
    }

    if (profile.hasCar === undefined) {
      questions.push({
        id: "hasCar",
        question: ru ? "Будет машина или важна пешая доступность?" : "Will you have a car, or should walkability matter more?",
        reason: ru ? "Без машины район должен быть более самодостаточным." : "Without a car, the area needs stronger daily walkability."
      });
    }

    if (profile.remoteWork === undefined) {
      questions.push({
        id: "remoteWork",
        question: ru ? "Работаете удаленно и критичен хороший интернет?" : "Will you work remotely and need strong internet?",
        reason: ru ? "Для удаленной работы важны интернет, шум и инфраструктура." : "Remote work makes internet, noise, and cafes/coworking more important."
      });
    }

    if (!profile.purpose) {
      questions.push({
        id: "purpose",
        question: ru ? "Это покупка для жизни, переезда или инвестиции?" : "Is this mainly for living, relocation, or investment?",
        reason: ru ? "У жизни и инвестиций разные критерии хорошего объекта." : "Living and investment use different scoring criteria."
      });
    }

    if (profile.prefersQuiet === undefined) {
      questions.push({
        id: "prefersQuiet",
        question: ru ? "Любите тишину или нормальна активная туристическая среда?" : "Do you prefer quiet, or is a busier tourist area fine?",
        reason: ru ? "Это помогает не ошибиться с районом." : "This prevents recommending the wrong neighborhood mood."
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
      maxPriceThb: profile.budgetThb,
      minBedrooms: profile.hasChildren ? 2 : undefined,
      requiredAmenities: profile.remoteWork ? ["fast-internet"] : undefined
    });
    const relaxedCandidates = strictCandidates.length
      ? strictCandidates
      : await this.properties.search(tenantId, {
          market: profile.market,
          maxPriceThb: profile.budgetThb
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

    return top
      ? `Based on your answers, I would start with ${area.area}: ${area.reasons[0]} Current top listing: ${top.title}.`
      : `Based on your answers, I would start with ${area.area}: ${area.reasons[0]} I did not find matching listings yet.`;
  }

  private intakeSummary(
    profile: ConciergeProfile,
    questions: ConciergeQuestion[],
    locale: ConciergeRequest["locale"]
  ): string {
    const known = Object.entries(profile)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ");

    if (locale === "ru") {
      return `Я понял вводные${known ? `: ${known}` : ""}. Чтобы дать район и объекты, уточню: ${questions.map((question) => question.question).join(" ")}`;
    }

    return `I understood${known ? `: ${known}` : ""}. To recommend an area and listings, I need: ${questions.map((question) => question.question).join(" ")}`;
  }

  private detectMarket(message: string): ThailandMarket | undefined {
    const markets: Array<[ThailandMarket, RegExp]> = [
      ["pattaya", /(pattaya|паттай)/],
      ["phuket", /\b(phuket|пхукет|пхукете|пхукета)\b/],
      ["bangkok", /\b(bangkok|бангкок|бангкоке|бангкока)\b/],
      ["hua-hin", /\b(hua hin|hua-hin|хуахин|хуа хин)\b/],
      ["koh-samui", /\b(koh samui|samui|koh-samui|самуи|ко самуи)\b/]
    ];

    return markets.find(([, pattern]) => pattern.test(message))?.[0];
  }

  private detectBudget(message: string): number | undefined {
    const millionMatch = message.match(/(?:до|under|below|max|budget)\s*(\d+(?:[.,]\d+)?)\s*(?:млн|million|m)/);

    return millionMatch?.[1] ? Math.round(Number(millionMatch[1].replace(",", ".")) * 1_000_000) : undefined;
  }
}
