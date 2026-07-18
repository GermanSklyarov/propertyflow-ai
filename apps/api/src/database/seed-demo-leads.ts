import { Pool } from "pg";
import { loadAppConfig } from "@propertyflow/config";
import type { LeadPriority, LeadSource, LeadStatus } from "@propertyflow/contracts";

type SeedLead = {
  id: string;
  propertyId?: string;
  source: LeadSource;
  status: LeadStatus;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  message: string;
  preferredLocale?: string;
  assignedAgentId?: string;
  attributionSearchQuery?: string;
  attributionSearchSource?: string;
  attributionSocialPostTrackingSlug?: string;
  attributionSocialPostChannel?: string;
  attributionSocialPostCampaign?: string;
  priority: LeadPriority;
  nextFollowUpAt?: string;
  createdAt: string;
};

type SeedLeadNote = {
  id: string;
  leadId: string;
  note: string;
  createdByUserId: string;
  createdByUserRole: string;
  createdAt: string;
};

const tenantId = process.env.SEED_TENANT_ID ?? "demo-agency";
const agentId = "agent-demo-1";
const managerId = "manager-demo-1";
const now = new Date();

const demoLeads: SeedLead[] = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    propertyId: "10000000-0000-4000-8000-000000000001",
    source: "ai-concierge",
    status: "qualified",
    contactName: "Maya Winter Buyer",
    contactEmail: "maya.buyer@example.com",
    contactPhone: "+66 81 555 0101",
    message: "Family moving to Pattaya for winter, wants Wongamat or quiet Jomtien with fast internet.",
    preferredLocale: "en",
    assignedAgentId: agentId,
    attributionSearchQuery: "family move pattaya quiet 3.5m",
    attributionSearchSource: "concierge",
    priority: "high",
    nextFollowUpAt: addHours(-5),
    createdAt: addDays(-4)
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    source: "saved-search",
    status: "new",
    contactName: "Lead Coverage Smoke",
    contactEmail: "coverage-smoke@example.com",
    contactPhone: "+66 82 777 0202",
    message: "Lead created from saved search for Pattaya condos. Needs matching property before agent follow-up.",
    preferredLocale: "en",
    assignedAgentId: agentId,
    attributionSearchQuery: "condo jomtien 1 bedroom under 20k/month",
    attributionSearchSource: "saved-search",
    priority: "medium",
    nextFollowUpAt: addDays(-2),
    createdAt: addDays(-3)
  },
  {
    id: "40000000-0000-4000-8000-000000000003",
    source: "agent",
    status: "contacted",
    contactName: "Quality Action Smoke",
    contactEmail: "quality-action-smoke@example.com",
    contactPhone: "+66 83 888 0303",
    message: "Smoke lead for quality follow-up action. Client asks for Bangkok family rental near schools.",
    preferredLocale: "en",
    priority: "high",
    nextFollowUpAt: addDays(-1),
    createdAt: addDays(-2)
  },
  {
    id: "40000000-0000-4000-8000-000000000004",
    propertyId: "10000000-0000-4000-8000-000000000006",
    source: "website",
    status: "new",
    contactName: "Nadia Rental Caller",
    contactEmail: "nadia.rent@example.com",
    contactPhone: "+66 90 123 4404",
    message: "Needs a Central Pattaya rental for six months, beach access and good internet under 30k THB/month.",
    preferredLocale: "en",
    assignedAgentId: agentId,
    priority: "medium",
    nextFollowUpAt: addHours(8),
    createdAt: addDays(-1)
  },
  {
    id: "40000000-0000-4000-8000-000000000005",
    propertyId: "10000000-0000-4000-8000-000000000003",
    source: "social-post",
    status: "contacted",
    contactName: "Facebook Jomtien Family",
    contactEmail: "fb.family@example.com",
    contactPhone: "+66 91 234 5505",
    message: "Interested in Jomtien family condo after Facebook carousel. Wants school and beach tradeoff details.",
    preferredLocale: "en",
    assignedAgentId: agentId,
    attributionSocialPostTrackingSlug: "pattaya-sale-or-rent-10000000-0000-4000-8000-000000000003-facebook-en",
    attributionSocialPostChannel: "facebook",
    attributionSocialPostCampaign: "pattaya-family-condo",
    priority: "low",
    nextFollowUpAt: addDays(1),
    createdAt: addDays(-1)
  },
  {
    id: "40000000-0000-4000-8000-000000000006",
    source: "ai-chat",
    status: "new",
    contactName: "Phuket Pool Search",
    contactEmail: "pool.search@example.com",
    contactPhone: "+66 92 345 6606",
    message: "Client wants a Phuket pool villa but has not selected a property yet.",
    preferredLocale: "en",
    priority: "medium",
    nextFollowUpAt: addHours(20),
    createdAt: addHours(-18)
  },
  {
    id: "40000000-0000-4000-8000-000000000007",
    propertyId: "10000000-0000-4000-8000-000000000008",
    source: "public-api",
    status: "qualified",
    contactName: "Rawai Villa Buyer",
    contactEmail: "rawai.buyer@example.com",
    contactPhone: "+66 93 456 7707",
    message: "Buyer asks about Rawai pool villa ownership costs and title transfer process.",
    preferredLocale: "en",
    assignedAgentId: managerId,
    priority: "high",
    nextFollowUpAt: addDays(2),
    createdAt: addHours(-10)
  },
  {
    id: "40000000-0000-4000-8000-000000000008",
    source: "website",
    status: "new",
    contactName: "Line Walk-In Rental",
    contactEmail: "line.walkin@example.com",
    contactPhone: "+66 94 567 8808",
    message: "Called from LINE after seeing a rental post. Wants Pattaya, one bedroom, flexible move-in.",
    preferredLocale: "en",
    priority: "medium",
    createdAt: addHours(-4)
  }
];

const demoNotes: SeedLeadNote[] = [
  {
    id: "41000000-0000-4000-8000-000000000001",
    leadId: "40000000-0000-4000-8000-000000000001",
    note: "Concierge recommended Wongamat first. Confirm school commute and winter dates.",
    createdByUserId: agentId,
    createdByUserRole: "agent",
    createdAt: addDays(-3)
  },
  {
    id: "41000000-0000-4000-8000-000000000002",
    leadId: "40000000-0000-4000-8000-000000000004",
    note: "Client prefers walkability over parking. Send Central Pattaya and Terminal 21 options.",
    createdByUserId: agentId,
    createdByUserRole: "agent",
    createdAt: addHours(-12)
  }
];

const config = loadAppConfig();
const pool = new Pool({
  connectionString: config.databaseUrl
});

try {
  await ensureTenantExists();
  await ensureUsersExist();

  for (const lead of demoLeads) {
    await ensurePropertyExists(lead.propertyId);
    await upsertLead(lead);
    await upsertStatusEvent(lead);
  }

  for (const note of demoNotes) {
    await upsertLeadNote(note);
  }

  console.log(`Seeded ${demoLeads.length} demo leads for tenant "${tenantId}".`);
} finally {
  await pool.end();
}

async function ensureTenantExists() {
  const result = await pool.query("select id from tenants where id = $1 limit 1", [tenantId]);

  if (!result.rows[0]) {
    throw new Error(`Tenant "${tenantId}" does not exist. Run migrations before seeding demo leads.`);
  }
}

async function ensureUsersExist() {
  const result = await pool.query("select id from tenant_users where tenant_id = $1 and id = any($2::text[])", [
    tenantId,
    [agentId, managerId]
  ]);
  const existing = new Set(result.rows.map((row: { id: string }) => row.id));

  for (const userId of [agentId, managerId]) {
    if (!existing.has(userId)) {
      throw new Error(`Tenant user "${userId}" does not exist. Run migrations before seeding demo leads.`);
    }
  }
}

async function ensurePropertyExists(propertyId?: string) {
  if (!propertyId) {
    return;
  }

  const result = await pool.query("select id from properties where tenant_id = $1 and id = $2 limit 1", [tenantId, propertyId]);

  if (!result.rows[0]) {
    throw new Error(`Property "${propertyId}" does not exist. Run npm run seed:demo before seeding demo leads.`);
  }
}

async function upsertLead(lead: SeedLead) {
  await pool.query(
    `
      insert into leads (
        id,
        tenant_id,
        property_id,
        source,
        status,
        contact_name,
        contact_email,
        contact_phone,
        message,
        preferred_locale,
        assigned_agent_id,
        attribution_search_event_id,
        attribution_search_query,
        attribution_search_source,
        attribution_social_post_tracking_slug,
        attribution_social_post_channel,
        attribution_social_post_campaign,
        priority,
        next_follow_up_at,
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
        null,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17,
        $18,
        $19,
        $20
      )
      on conflict (id) do update set
        property_id = excluded.property_id,
        source = excluded.source,
        status = excluded.status,
        contact_name = excluded.contact_name,
        contact_email = excluded.contact_email,
        contact_phone = excluded.contact_phone,
        message = excluded.message,
        preferred_locale = excluded.preferred_locale,
        assigned_agent_id = excluded.assigned_agent_id,
        attribution_search_query = excluded.attribution_search_query,
        attribution_search_source = excluded.attribution_search_source,
        attribution_social_post_tracking_slug = excluded.attribution_social_post_tracking_slug,
        attribution_social_post_channel = excluded.attribution_social_post_channel,
        attribution_social_post_campaign = excluded.attribution_social_post_campaign,
        priority = excluded.priority,
        next_follow_up_at = excluded.next_follow_up_at,
        updated_at = excluded.updated_at
    `,
    [
      lead.id,
      tenantId,
      lead.propertyId ?? null,
      lead.source,
      lead.status,
      lead.contactName,
      lead.contactEmail ?? null,
      lead.contactPhone ?? null,
      lead.message,
      lead.preferredLocale ?? "en",
      lead.assignedAgentId ?? null,
      lead.attributionSearchQuery ?? null,
      lead.attributionSearchSource ?? null,
      lead.attributionSocialPostTrackingSlug ?? null,
      lead.attributionSocialPostChannel ?? null,
      lead.attributionSocialPostCampaign ?? null,
      lead.priority,
      lead.nextFollowUpAt ?? null,
      lead.createdAt,
      now.toISOString()
    ]
  );
}

async function upsertStatusEvent(lead: SeedLead) {
  await pool.query(
    `
      insert into lead_status_events (
        id,
        tenant_id,
        lead_id,
        previous_status,
        status,
        changed_by_user_id,
        changed_by_user_role,
        created_at
      ) values (
        $1,
        $2,
        $3,
        null,
        $4,
        $5,
        $6,
        $7
      )
      on conflict (id) do update set
        status = excluded.status,
        changed_by_user_id = excluded.changed_by_user_id,
        changed_by_user_role = excluded.changed_by_user_role,
        created_at = excluded.created_at
    `,
    [
      lead.id.replace("40000000", "42000000"),
      tenantId,
      lead.id,
      lead.status,
      lead.assignedAgentId ?? managerId,
      lead.assignedAgentId ? "agent" : "manager",
      lead.createdAt
    ]
  );
}

async function upsertLeadNote(note: SeedLeadNote) {
  await pool.query(
    `
      insert into lead_notes (
        id,
        tenant_id,
        lead_id,
        note,
        created_by_user_id,
        created_by_user_role,
        created_at
      ) values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7
      )
      on conflict (id) do update set
        note = excluded.note,
        created_by_user_id = excluded.created_by_user_id,
        created_by_user_role = excluded.created_by_user_role,
        created_at = excluded.created_at
    `,
    [note.id, tenantId, note.leadId, note.note, note.createdByUserId, note.createdByUserRole, note.createdAt]
  );
}

function addDays(days: number) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function addHours(hours: number) {
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}
