import { Pool } from "pg";
import { loadAppConfig } from "@propertyflow/config";
import type { KnowledgeDocumentKind, KnowledgeDocumentSnapshot } from "@propertyflow/contracts";

type SeedKnowledgeDocument = {
  id: string;
  title: string;
  body: string;
  locale: KnowledgeDocumentSnapshot["locale"];
  kind: KnowledgeDocumentKind;
  tags: string[];
};

const tenantId = process.env.SEED_TENANT_ID ?? "demo-agency";
const now = new Date().toISOString();

const demoKnowledgeDocuments: SeedKnowledgeDocument[] = [
  {
    id: "50000000-0000-4000-8000-000000000001",
    title: "Demo Agency FAQ",
    locale: "en",
    kind: "faq",
    tags: ["faq", "starter", "source-url", "source-domain:demo.propertyflow.local"],
    body:
      "Client questions, objection handling, booking rules, viewing slots, deposits, and handoff rules. Buyers can ask about sea-view condos, rental yield, maintenance fees, foreign ownership quota, and winter relocation. Agents should offer a viewing only after budget, preferred area, move-in month, and purpose are clear. Source reference: demo.propertyflow.local/faq"
  },
  {
    id: "50000000-0000-4000-8000-000000000002",
    title: "Thailand Buying Guide",
    locale: "en",
    kind: "legal",
    tags: ["buying", "buyer", "purchase", "foreign-quota", "source-file"],
    body:
      "Foreign buyers usually purchase condominium freehold when foreign quota is available. Before booking, confirm title, quota, transfer fee split, sinking fund, maintenance fee, and expected closing timeline. For leasehold or villa structures, route the client to legal review before making promises. Source upload: buying-guide-demo.pdf"
  },
  {
    id: "50000000-0000-4000-8000-000000000003",
    title: "Seller Process and Resale Guide",
    locale: "en",
    kind: "investment",
    tags: ["selling", "seller", "resale", "commission", "listing-process", "source-file"],
    body:
      "Sellers should provide title copy, maintenance fee statement, current tenant terms, photo permissions, and target net proceeds. The agency checks comparable listings, recommends pricing, prepares multilingual copy, and schedules viewings. Commission and transfer-cost expectations must be stated before publication. Source upload: selling-guide-demo.pdf"
  },
  {
    id: "50000000-0000-4000-8000-000000000004",
    title: "Demo Agency Company Information",
    locale: "en",
    kind: "article",
    tags: ["company", "agency", "about", "team", "contact", "source-url"],
    body:
      "Demo Agency helps international clients buy, rent, and relocate in Pattaya, Phuket, Bangkok, Hua Hin, and Koh Samui. The team responds in English, Russian, Thai, and Chinese. For urgent viewing requests, Concierge should collect contact details and preferred dates before handing off to the agency. Source reference: demo.propertyflow.local/about"
  },
  {
    id: "50000000-0000-4000-8000-000000000005",
    title: "Pattaya Condo Brochures",
    locale: "en",
    kind: "neighborhood",
    tags: ["condo", "brochure", "project", "development", "facilities", "pattaya", "source-file"],
    body:
      "Wongamat projects are positioned for quieter beach living, sea views, pools, gyms, security, and winter rental appeal. Jomtien projects are stronger for family space, beach access, and value. Central Pattaya projects work for tenants who prioritize nightlife, shopping, and walkability. Source upload: pattaya-condo-brochures.zip"
  },
  {
    id: "50000000-0000-4000-8000-000000000006",
    title: "Developer PDF Notes",
    locale: "en",
    kind: "neighborhood",
    tags: ["developer", "pdf", "brochure", "construction", "handover", "source-file"],
    body:
      "Developer PDFs should be used for project facilities, handover timing, building status, parking, common areas, and branded positioning. If a project is under construction, Concierge must avoid promising exact completion dates unless the source states them. Source upload: developer-pdf-notes-demo.pdf"
  },
  {
    id: "50000000-0000-4000-8000-000000000007",
    title: "Transfer Tax and Ownership Costs",
    locale: "en",
    kind: "legal",
    tags: ["tax", "transfer-fee", "withholding", "specific-business-tax", "stamp-duty", "source-file"],
    body:
      "Common transaction costs can include transfer fee, specific business tax, stamp duty, withholding tax, sinking fund, maintenance fee, and agency commission. Concierge should explain that exact responsibility depends on the agreement and must be confirmed before reservation. Source upload: tax-information-demo.pdf"
  },
  {
    id: "50000000-0000-4000-8000-000000000008",
    title: "Thailand Visa and Relocation Guide",
    locale: "en",
    kind: "relocation",
    tags: ["visa", "retirement", "elite", "ltr", "work-permit", "relocation", "source-file"],
    body:
      "Relocation clients often ask about retirement visa, Thailand Privilege, LTR visa, work permit, school access, hospitals, internet reliability, and long-stay rental timing. Concierge should not give legal advice, but can explain common paths and offer an agency referral. Source upload: visa-guide-demo.pdf"
  },
  {
    id: "50000000-0000-4000-8000-000000000009",
    title: "Internal Concierge Handoff Instructions",
    locale: "en",
    kind: "faq",
    tags: ["internal", "instructions", "script", "handoff", "agent-note", "source-file"],
    body:
      "Internal script: ask budget, buy or rent intent, family size, car availability, remote-work needs, quiet preference, move-in date, and whether the client wants investment yield or lifestyle first. Create a CRM lead only when the visitor asks for viewing, availability, price confirmation, or agent contact. Source upload: internal-instructions-demo.md"
  }
];

const config = loadAppConfig();
const pool = new Pool({
  connectionString: config.databaseUrl
});

try {
  await ensureTenantExists();
  await syncStarterTenantDefaults();
  await deleteSeedKnowledgeChunks();

  for (const document of demoKnowledgeDocuments) {
    await upsertKnowledgeDocument(document);
    await upsertKnowledgeChunks(document);
  }

  console.log(`Seeded ${demoKnowledgeDocuments.length} Starter knowledge documents for tenant "${tenantId}".`);
} finally {
  await pool.end();
}

async function ensureTenantExists() {
  const result = await pool.query("select id from tenants where id = $1 limit 1", [tenantId]);

  if (!result.rows[0]) {
    throw new Error(`Tenant "${tenantId}" does not exist. Run migrations before seeding demo knowledge.`);
  }
}

async function syncStarterTenantDefaults() {
  await pool.query(
    `
      update tenants
      set
        subscription_plan = 'starter',
        limits = '{"properties":1000,"agents":1,"aiCreditsMonthly":5000,"publicApiRequestsMonthly":10000}'::jsonb,
        widget_ai_names = '{"en":"Anna","ru":"Анна","th":"มาลี","zh":"安娜"}'::jsonb,
        widget_welcome_messages = $2::jsonb,
        widget_persona_genders = '{"en":"feminine","ru":"feminine","th":"feminine","zh":"neutral"}'::jsonb,
        widget_tone = 'friendly',
        widget_languages = array['en','ru','th','zh'],
        updated_at = $3
      where id = $1
    `,
    [
      tenantId,
      JSON.stringify({
        en: "Hi! I'm Anna, your AI property consultant.",
        ru: "Привет! Я Анна, ваш AI-консультант по недвижимости.",
        th: "สวัสดีค่ะ ฉันชื่อ มาลี ผู้ช่วย AI ด้านอสังหาริมทรัพย์ของคุณ",
        zh: "你好！我是安娜，你的 AI 房产顾问。"
      }),
      now
    ]
  );
}

async function deleteSeedKnowledgeChunks() {
  await pool.query(
    `
      delete from knowledge_document_chunks
      where (tenant_id = $1 and document_id = any($2::uuid[]))
        or id = any($3::uuid[])
    `,
    [
      tenantId,
      demoKnowledgeDocuments.map((document) => document.id),
      demoKnowledgeDocuments.map((document) => buildChunkId(document.id, 0))
    ]
  );
}

async function upsertKnowledgeDocument(document: SeedKnowledgeDocument) {
  await pool.query(
    `
      insert into knowledge_documents (
        id,
        tenant_id,
        title,
        body,
        locale,
        kind,
        tags,
        created_at,
        updated_at
      ) values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9
      )
      on conflict (id) do update set
        title = excluded.title,
        body = excluded.body,
        locale = excluded.locale,
        kind = excluded.kind,
        tags = excluded.tags,
        updated_at = excluded.updated_at
    `,
    [document.id, tenantId, document.title, document.body, document.locale, document.kind, document.tags, now, now]
  );
}

async function upsertKnowledgeChunks(document: SeedKnowledgeDocument) {
  const chunks = splitIntoChunks(document.body);

  await pool.query("delete from knowledge_document_chunks where tenant_id = $1 and document_id = $2", [tenantId, document.id]);

  for (const [index, content] of chunks.entries()) {
    await pool.query(
      `
        insert into knowledge_document_chunks (
          id,
          tenant_id,
          document_id,
          chunk_index,
          title,
          content,
          locale,
          kind,
          tags,
          token_estimate,
          search_text,
          embedding_model,
          embedding_status,
          embedding,
          created_at,
          updated_at
        ) values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          'embedded',
          $13,
          $14,
          $15
        )
        on conflict (id) do update set
          tenant_id = excluded.tenant_id,
          document_id = excluded.document_id,
          chunk_index = excluded.chunk_index,
          title = excluded.title,
          content = excluded.content,
          locale = excluded.locale,
          kind = excluded.kind,
          tags = excluded.tags,
          token_estimate = excluded.token_estimate,
          search_text = excluded.search_text,
          embedding_model = excluded.embedding_model,
          embedding_status = excluded.embedding_status,
          embedding = excluded.embedding,
          updated_at = excluded.updated_at
      `,
      [
        buildChunkId(document.id, index),
        tenantId,
        document.id,
        index,
        document.title,
        content,
        document.locale,
        document.kind,
        document.tags,
        estimateTokens(content),
        [document.title, document.kind, document.tags.join(" "), content].join(" "),
        "demo-hash-embedding-v1",
        embedText([document.title, content, document.tags.join(" ")].join(" "), 16),
        now,
        now
      ]
    );
  }
}

function splitIntoChunks(body: string) {
  return body
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function buildChunkId(documentId: string, chunkIndex: number) {
  const chunkNamespace = documentId.replace(/^50000000/, "51000000").slice(0, -12);
  const documentSequence = Number(documentId.slice(-12));
  const chunkSequence = documentSequence + chunkIndex * 1000;

  return `${chunkNamespace}${String(chunkSequence).padStart(12, "0")}`;
}

function estimateTokens(content: string) {
  return Math.max(1, Math.ceil(content.split(/\s+/).filter(Boolean).length * 1.35));
}

function embedText(text: string, dimensions: number): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = text
    .toLowerCase()
    .replaceAll("ё", "е")
    .split(/[^a-zа-я0-9-]+/i)
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of tokens.length ? tokens : [text]) {
    const hash = hashToken(token);
    const index = Math.abs(hash) % dimensions;
    vector[index] += hash < 0 ? -1 : 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

function hashToken(token: string): number {
  let hash = 0;

  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) | 0;
  }

  return hash;
}
