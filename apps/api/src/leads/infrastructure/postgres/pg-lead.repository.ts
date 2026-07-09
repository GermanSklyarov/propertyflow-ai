import { Inject, Injectable } from "@nestjs/common";
import type {
  CountByBucket,
  LeadQualityActionItem,
  LeadQualityAgentPerformanceItem,
  LeadQualitySourcePerformanceItem,
  LeadNoteSnapshot,
  LeadPriority,
  LeadQualitySignalsResponse,
  LeadQueueSummaryResponse,
  LeadSlaAgentPerformanceItem,
  LeadSlaBreachItem,
  LeadSlaResponse,
  LeadSlaSourcePerformanceItem,
  LeadSnapshot,
  LeadStatus,
  LeadStatusEventSnapshot,
  LeadTimelineEventSnapshot,
  ListLeadsRequest
} from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type {
  CreateLeadInput,
  CreateLeadNoteInput,
  LeadRepository,
  RecordLeadStatusEventInput,
  UpdateLeadFollowUpInput
} from "../../domain/lead.repository.js";

interface LeadRow {
  id: string;
  tenant_id: string;
  property_id: string | null;
  source: LeadSnapshot["source"];
  status: LeadSnapshot["status"];
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  message: string | null;
  preferred_locale: LeadSnapshot["preferredLocale"] | null;
  assigned_agent_id: string | null;
  attribution_search_event_id: string | null;
  attribution_search_query: string | null;
  attribution_search_source: LeadSnapshot["attributionSearchSource"] | null;
  priority: LeadPriority;
  next_follow_up_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface LeadStatusEventRow {
  id: string;
  tenant_id: string;
  lead_id: string;
  previous_status: LeadStatus | null;
  status: LeadStatus;
  changed_by_user_id: string | null;
  changed_by_user_role: LeadStatusEventSnapshot["changedByUserRole"] | null;
  created_at: Date;
}

interface LeadNoteRow {
  id: string;
  tenant_id: string;
  lead_id: string;
  note: string;
  created_by_user_id: string | null;
  created_by_user_role: LeadNoteSnapshot["createdByUserRole"] | null;
  created_at: Date;
}

interface LeadQueueSummaryRow {
  total: string;
  open: string;
  assigned: string;
  unassigned: string;
  overdue_follow_ups: string;
  due_soon_follow_ups: string;
  high_priority: string;
  by_status: CountByBucket[];
  by_priority: CountByBucket[];
  by_source: CountByBucket[];
}

interface LeadQualitySignalsRow {
  total: string;
  missing_contact_info: string;
  missing_property: string;
  unassigned: string;
  missing_follow_up: string;
  stale_new_leads: string;
}

interface LeadSlaSummaryRow {
  total: string;
  response_breached: string;
  response_due_soon: string;
  unassigned_breached: string;
  overdue_follow_ups: string;
  average_first_response_hours: string | null;
  breached_by_source: CountByBucket[];
}

interface LeadSlaBreachRow extends LeadRow {
  first_response_breached: boolean;
  first_response_due_soon: boolean;
  unassigned_response_breached: boolean;
  follow_up_overdue: boolean;
  age_hours: string;
  follow_up_overdue_hours: string | null;
  score: string;
}

interface LeadSlaAgentPerformanceRow {
  agent_id: string;
  total: string;
  open: string;
  response_breached: string;
  overdue_follow_ups: string;
  average_first_response_hours: string | null;
}

interface LeadSlaSourcePerformanceRow {
  source: LeadSnapshot["source"];
  total: string;
  open: string;
  won: string;
  lost: string;
  response_breached: string;
  overdue_follow_ups: string;
  average_first_response_hours: string | null;
}

interface LeadQualityActionRow extends LeadRow {
  missing_contact_info: boolean;
  missing_property: boolean;
  unassigned: boolean;
  missing_follow_up: boolean;
  stale_new_lead: boolean;
  score: string;
}

interface LeadQualityAgentPerformanceRow {
  agent_id: string;
  total: string;
  affected_leads: string;
  issue_count: string;
  missing_contact_info: string;
  missing_property: string;
  missing_follow_up: string;
  stale_new_leads: string;
}

interface LeadQualitySourcePerformanceRow {
  source: LeadSnapshot["source"];
  total: string;
  affected_leads: string;
  issue_count: string;
  missing_contact_info: string;
  missing_property: string;
  unassigned: string;
  missing_follow_up: string;
  stale_new_leads: string;
}

interface LeadTimelineRow {
  id: string;
  tenant_id: string;
  lead_id: string;
  type: LeadTimelineEventSnapshot["type"];
  title: string;
  actor_user_id: string | null;
  actor_user_role: LeadTimelineEventSnapshot["actorUserRole"] | null;
  payload: Record<string, unknown>;
  created_at: Date;
}

@Injectable()
export class PgLeadRepository implements LeadRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(input: CreateLeadInput): Promise<LeadSnapshot> {
    const now = new Date().toISOString();
    const result = await this.pool.query<LeadRow>(
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
          priority,
          next_follow_up_at,
          created_at,
          updated_at
        ) values (
          $1,
          $2,
          $3,
          $4,
          'new',
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          'medium',
          null,
          $14,
          $15
        )
        returning *
      `,
      [
        crypto.randomUUID(),
        input.tenantId,
        input.propertyId ?? null,
        input.source,
        input.contactName,
        input.contactEmail ?? null,
        input.contactPhone ?? null,
        input.message ?? null,
        input.preferredLocale ?? null,
        input.assignedAgentId ?? null,
        input.attributionSearchEventId ?? null,
        input.attributionSearchQuery ?? null,
        input.attributionSearchSource ?? null,
        now,
        now
      ]
    );

    return this.toSnapshot(result.rows[0]);
  }

  async listUnassigned(tenantId: string): Promise<LeadSnapshot[]> {
    const result = await this.pool.query<LeadRow>(
      `
        select *
        from leads
        where tenant_id = $1
          and assigned_agent_id is null
          and status in ('new', 'contacted', 'qualified')
        order by created_at desc
      `,
      [tenantId]
    );

    return result.rows.map((row) => this.toSnapshot(row));
  }

  async findById(tenantId: string, leadId: string): Promise<LeadSnapshot | null> {
    const result = await this.pool.query<LeadRow>(
      `
        select *
        from leads
        where tenant_id = $1 and id = $2
      `,
      [tenantId, leadId]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  async createNote(input: CreateLeadNoteInput): Promise<LeadNoteSnapshot> {
    const result = await this.pool.query<LeadNoteRow>(
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
        returning id, tenant_id, lead_id, note, created_by_user_id, created_by_user_role, created_at
      `,
      [crypto.randomUUID(), input.tenantId, input.leadId, input.note, input.user.id, input.user.role, new Date().toISOString()]
    );

    return this.toNoteSnapshot(result.rows[0]);
  }

  async listNotes(tenantId: string, leadId: string): Promise<LeadNoteSnapshot[]> {
    const result = await this.pool.query<LeadNoteRow>(
      `
        select id, tenant_id, lead_id, note, created_by_user_id, created_by_user_role, created_at
        from lead_notes
        where tenant_id = $1 and lead_id = $2
        order by created_at desc
      `,
      [tenantId, leadId]
    );

    return result.rows.map((row) => this.toNoteSnapshot(row));
  }

  async listTimeline(tenantId: string, leadId: string): Promise<LeadTimelineEventSnapshot[]> {
    const result = await this.pool.query<LeadTimelineRow>(
      `
        select *
        from (
          select
            note.id,
            note.tenant_id,
            note.lead_id::text as lead_id,
            'note'::text as type,
            'Note added'::text as title,
            note.created_by_user_id as actor_user_id,
            note.created_by_user_role as actor_user_role,
            jsonb_build_object('note', note.note) as payload,
            note.created_at
          from lead_notes note
          where note.tenant_id = $1 and note.lead_id = $2::uuid

          union all

          select
            event.id,
            event.tenant_id,
            event.lead_id::text as lead_id,
            'status-changed'::text as type,
            case
              when event.previous_status is null then 'Lead created'
              else 'Status changed'
            end as title,
            event.changed_by_user_id as actor_user_id,
            event.changed_by_user_role as actor_user_role,
            jsonb_build_object(
              'previousStatus', event.previous_status,
              'status', event.status
            ) as payload,
            event.created_at
          from lead_status_events event
          where event.tenant_id = $1 and event.lead_id = $2::uuid

          union all

          select
            audit.id,
            audit.tenant_id,
            audit.resource_id as lead_id,
            case audit.action
              when 'lead.created' then 'created'
              when 'lead.assigned' then 'assigned'
              when 'lead.follow_up_updated' then 'follow-up-updated'
            end as type,
            case audit.action
              when 'lead.created' then 'Lead created'
              when 'lead.assigned' then 'Lead assigned'
              when 'lead.follow_up_updated' then 'Follow-up updated'
            end as title,
            audit.user_id as actor_user_id,
            audit.user_role as actor_user_role,
            audit.metadata as payload,
            audit.created_at
          from audit_events audit
          where audit.tenant_id = $1
            and audit.resource_type = 'lead'
            and audit.resource_id = $2::text
            and audit.action in ('lead.created', 'lead.assigned', 'lead.follow_up_updated')
        ) timeline
        order by created_at desc
      `,
      [tenantId, leadId]
    );

    return result.rows.map((row) => this.toTimelineSnapshot(row));
  }

  async recordStatusEvent(input: RecordLeadStatusEventInput): Promise<LeadStatusEventSnapshot> {
    const result = await this.pool.query<LeadStatusEventRow>(
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
          $4,
          $5,
          $6,
          $7,
          $8
        )
        returning id, tenant_id, lead_id, previous_status, status, changed_by_user_id, changed_by_user_role, created_at
      `,
      [
        crypto.randomUUID(),
        input.tenantId,
        input.leadId,
        input.previousStatus ?? null,
        input.status,
        input.user?.id ?? null,
        input.user?.role ?? null,
        new Date().toISOString()
      ]
    );

    return this.toStatusEventSnapshot(result.rows[0]);
  }

  async listStatusEvents(tenantId: string, leadId: string): Promise<LeadStatusEventSnapshot[]> {
    const result = await this.pool.query<LeadStatusEventRow>(
      `
        select id, tenant_id, lead_id, previous_status, status, changed_by_user_id, changed_by_user_role, created_at
        from lead_status_events
        where tenant_id = $1 and lead_id = $2
        order by created_at asc
      `,
      [tenantId, leadId]
    );

    return result.rows.map((row) => this.toStatusEventSnapshot(row));
  }

  async list(tenantId: string, request: ListLeadsRequest = {}): Promise<LeadSnapshot[]> {
    const result = await this.pool.query<LeadRow>(
      `
        select *
        from leads
        where tenant_id = $1
          and ($2::text is null or status = $2)
          and ($3::text is null or source = $3)
          and ($4::text is null or assigned_agent_id = $4)
          and ($5::boolean = false or assigned_agent_id is null)
          and ($6::text is null or priority = $6)
          and ($7::timestamptz is null or next_follow_up_at <= $7)
        order by next_follow_up_at asc nulls last, updated_at desc, created_at desc
        limit $8
      `,
      [
        tenantId,
        request.status ?? null,
        request.source ?? null,
        request.assignedAgentId ?? null,
        request.unassigned ?? false,
        request.priority ?? null,
        request.followUpDueBefore ?? null,
        request.limit ?? 50
      ]
    );

    return result.rows.map((row) => this.toSnapshot(row));
  }

  async getQueueSummary(
    tenantId: string,
    request: ListLeadsRequest = {}
  ): Promise<Omit<LeadQueueSummaryResponse, "filters" | "generatedAt">> {
    const result = await this.pool.query<LeadQueueSummaryRow>(
      `
        with filtered as (
          select *
          from leads
          where tenant_id = $1
            and ($2::text is null or status = $2)
            and ($3::text is null or source = $3)
            and ($4::text is null or assigned_agent_id = $4)
            and ($5::boolean = false or assigned_agent_id is null)
            and ($6::text is null or priority = $6)
            and ($7::timestamptz is null or next_follow_up_at <= $7)
        )
        select
          count(*) as total,
          count(*) filter (where status in ('new', 'contacted', 'qualified')) as open,
          count(*) filter (where assigned_agent_id is not null) as assigned,
          count(*) filter (where assigned_agent_id is null) as unassigned,
          count(*) filter (where next_follow_up_at is not null and next_follow_up_at < now()) as overdue_follow_ups,
          count(*) filter (
            where next_follow_up_at is not null
              and next_follow_up_at >= now()
              and next_follow_up_at <= now() + interval '24 hours'
          ) as due_soon_follow_ups,
          count(*) filter (where priority = 'high') as high_priority,
          coalesce((
            select jsonb_agg(jsonb_build_object('bucket', row.status, 'count', row.count) order by row.count desc, row.status asc)
            from (
              select status, count(*)::int as count
              from filtered
              group by status
            ) row
          ), '[]'::jsonb) as by_status,
          coalesce((
            select jsonb_agg(jsonb_build_object('bucket', row.priority, 'count', row.count) order by row.count desc, row.priority asc)
            from (
              select priority, count(*)::int as count
              from filtered
              group by priority
            ) row
          ), '[]'::jsonb) as by_priority,
          coalesce((
            select jsonb_agg(jsonb_build_object('bucket', row.source, 'count', row.count) order by row.count desc, row.source asc)
            from (
              select source, count(*)::int as count
              from filtered
              group by source
            ) row
          ), '[]'::jsonb) as by_source
        from filtered
      `,
      [
        tenantId,
        request.status ?? null,
        request.source ?? null,
        request.assignedAgentId ?? null,
        request.unassigned ?? false,
        request.priority ?? null,
        request.followUpDueBefore ?? null
      ]
    );
    const row = result.rows[0];

    return {
      total: Number(row.total),
      open: Number(row.open),
      assigned: Number(row.assigned),
      unassigned: Number(row.unassigned),
      overdueFollowUps: Number(row.overdue_follow_ups),
      dueSoonFollowUps: Number(row.due_soon_follow_ups),
      highPriority: Number(row.high_priority),
      byStatus: row.by_status,
      byPriority: row.by_priority,
      bySource: row.by_source
    };
  }

  async getSlaSummary(
    tenantId: string,
    request: ListLeadsRequest = {}
  ): Promise<Omit<LeadSlaResponse, "filters" | "generatedAt">> {
    const result = await this.pool.query<LeadSlaSummaryRow>(
      `
        with filtered as (
          select *
          from leads
          where tenant_id = $1
            and ($2::text is null or status = $2)
            and ($3::text is null or source = $3)
            and ($4::text is null or assigned_agent_id = $4)
            and ($5::boolean = false or assigned_agent_id is null)
            and ($6::text is null or priority = $6)
            and ($7::timestamptz is null or next_follow_up_at <= $7)
        ),
        first_response as (
          select
            lead_id,
            min(created_at) as first_response_at
          from lead_status_events
          where tenant_id = $1
            and previous_status = 'new'
            and status in ('contacted', 'qualified', 'lost', 'won')
          group by lead_id
        ),
        enriched as (
          select
            lead.*,
            response.first_response_at,
            lead.status = 'new'
              and lead.created_at <= now() - interval '4 hours' as response_breached,
            lead.status = 'new'
            and lead.created_at <= now() - interval '3 hours'
              and lead.created_at > now() - interval '4 hours' as response_due_soon
          from filtered lead
          left join first_response response on response.lead_id = lead.id
        ),
        source_summary as (
          select source, count(*) as source_breaches
          from enriched
          where response_breached
          group by source
        )
        select
          count(*) as total,
          count(*) filter (where response_breached) as response_breached,
          count(*) filter (where response_due_soon) as response_due_soon,
          count(*) filter (where response_breached and assigned_agent_id is null) as unassigned_breached,
          count(*) filter (
            where status in ('new', 'contacted', 'qualified')
              and next_follow_up_at is not null
              and next_follow_up_at < now()
          ) as overdue_follow_ups,
          avg(extract(epoch from (first_response_at - created_at)) / 3600)
            filter (where first_response_at is not null) as average_first_response_hours,
          (
            select coalesce(
              jsonb_agg(
                jsonb_build_object('bucket', source, 'count', source_breaches)
                order by source_breaches desc, source
              ),
              '[]'::jsonb
            )
            from source_summary
          ) as breached_by_source
        from enriched
      `,
      [
        tenantId,
        request.status ?? null,
        request.source ?? null,
        request.assignedAgentId ?? null,
        request.unassigned ?? false,
        request.priority ?? null,
        request.followUpDueBefore ?? null
      ]
    );
    const row = result.rows[0];
    const averageFirstResponseHours =
      row.average_first_response_hours === null ? undefined : Number(row.average_first_response_hours);

    return {
      total: Number(row.total),
      targetFirstResponseHours: 4,
      responseBreached: Number(row.response_breached),
      responseDueSoon: Number(row.response_due_soon),
      unassignedBreached: Number(row.unassigned_breached),
      overdueFollowUps: Number(row.overdue_follow_ups),
      averageFirstResponseHours:
        averageFirstResponseHours === undefined ? undefined : Number(averageFirstResponseHours.toFixed(2)),
      breachedBySource: row.breached_by_source
    };
  }

  async listSlaBreaches(tenantId: string, request: ListLeadsRequest = {}): Promise<LeadSlaBreachItem[]> {
    const result = await this.pool.query<LeadSlaBreachRow>(
      `
        with filtered as (
          select *
          from leads
          where tenant_id = $1
            and ($2::text is null or status = $2)
            and ($3::text is null or source = $3)
            and ($4::text is null or assigned_agent_id = $4)
            and ($5::boolean = false or assigned_agent_id is null)
            and ($6::text is null or priority = $6)
            and ($7::timestamptz is null or next_follow_up_at <= $7)
        ),
        enriched as (
          select
            *,
            status = 'new'
              and created_at <= now() - interval '4 hours' as first_response_breached,
            status = 'new'
              and created_at <= now() - interval '3 hours'
              and created_at > now() - interval '4 hours' as first_response_due_soon,
            status = 'new'
              and assigned_agent_id is null
              and created_at <= now() - interval '4 hours' as unassigned_response_breached,
            status in ('new', 'contacted', 'qualified')
              and next_follow_up_at is not null
              and next_follow_up_at < now() as follow_up_overdue,
            extract(epoch from (now() - created_at)) / 3600 as age_hours,
            case
              when next_follow_up_at is not null and next_follow_up_at < now()
                then extract(epoch from (now() - next_follow_up_at)) / 3600
              else null
            end as follow_up_overdue_hours
          from filtered
        )
        select
          *,
          (
            case when first_response_breached then 5 else 0 end
            + case when follow_up_overdue then 4 else 0 end
            + case when unassigned_response_breached then 3 else 0 end
            + case when first_response_due_soon then 2 else 0 end
          ) as score
        from enriched
        where first_response_breached
          or first_response_due_soon
          or unassigned_response_breached
          or follow_up_overdue
        order by score desc, created_at asc
        limit $8
      `,
      [
        tenantId,
        request.status ?? null,
        request.source ?? null,
        request.assignedAgentId ?? null,
        request.unassigned ?? false,
        request.priority ?? null,
        request.followUpDueBefore ?? null,
        request.limit ?? 20
      ]
    );

    return result.rows.map((row) => this.toSlaBreach(row));
  }

  async getSlaAgentPerformance(
    tenantId: string,
    request: ListLeadsRequest = {}
  ): Promise<LeadSlaAgentPerformanceItem[]> {
    const result = await this.pool.query<LeadSlaAgentPerformanceRow>(
      `
        with filtered as (
          select *
          from leads
          where tenant_id = $1
            and assigned_agent_id is not null
            and ($2::text is null or status = $2)
            and ($3::text is null or source = $3)
            and ($4::text is null or assigned_agent_id = $4)
            and ($5::boolean = false or assigned_agent_id is null)
            and ($6::text is null or priority = $6)
            and ($7::timestamptz is null or next_follow_up_at <= $7)
        ),
        first_response as (
          select
            lead_id,
            min(created_at) as first_response_at
          from lead_status_events
          where tenant_id = $1
            and previous_status = 'new'
            and status in ('contacted', 'qualified', 'lost', 'won')
          group by lead_id
        )
        select
          lead.assigned_agent_id as agent_id,
          count(*) as total,
          count(*) filter (where lead.status in ('new', 'contacted', 'qualified')) as open,
          count(*) filter (
            where lead.status = 'new'
              and lead.created_at <= now() - interval '4 hours'
          ) as response_breached,
          count(*) filter (
            where lead.status in ('new', 'contacted', 'qualified')
              and lead.next_follow_up_at is not null
              and lead.next_follow_up_at < now()
          ) as overdue_follow_ups,
          avg(extract(epoch from (response.first_response_at - lead.created_at)) / 3600)
            filter (where response.first_response_at is not null) as average_first_response_hours
        from filtered lead
        left join first_response response on response.lead_id = lead.id
        group by lead.assigned_agent_id
        order by response_breached desc, overdue_follow_ups desc, open desc, agent_id asc
        limit $8
      `,
      [
        tenantId,
        request.status ?? null,
        request.source ?? null,
        request.assignedAgentId ?? null,
        request.unassigned ?? false,
        request.priority ?? null,
        request.followUpDueBefore ?? null,
        request.limit ?? 20
      ]
    );

    return result.rows.map((row) => this.toSlaAgentPerformance(row));
  }

  async getSlaSourcePerformance(
    tenantId: string,
    request: ListLeadsRequest = {}
  ): Promise<LeadSlaSourcePerformanceItem[]> {
    const result = await this.pool.query<LeadSlaSourcePerformanceRow>(
      `
        with filtered as (
          select *
          from leads
          where tenant_id = $1
            and ($2::text is null or status = $2)
            and ($3::text is null or source = $3)
            and ($4::text is null or assigned_agent_id = $4)
            and ($5::boolean = false or assigned_agent_id is null)
            and ($6::text is null or priority = $6)
            and ($7::timestamptz is null or next_follow_up_at <= $7)
        ),
        first_response as (
          select
            lead_id,
            min(created_at) as first_response_at
          from lead_status_events
          where tenant_id = $1
            and previous_status = 'new'
            and status in ('contacted', 'qualified', 'lost', 'won')
          group by lead_id
        )
        select
          lead.source,
          count(*) as total,
          count(*) filter (where lead.status in ('new', 'contacted', 'qualified')) as open,
          count(*) filter (where lead.status = 'won') as won,
          count(*) filter (where lead.status = 'lost') as lost,
          count(*) filter (
            where lead.status = 'new'
              and lead.created_at <= now() - interval '4 hours'
          ) as response_breached,
          count(*) filter (
            where lead.status in ('new', 'contacted', 'qualified')
              and lead.next_follow_up_at is not null
              and lead.next_follow_up_at < now()
          ) as overdue_follow_ups,
          avg(extract(epoch from (response.first_response_at - lead.created_at)) / 3600)
            filter (where response.first_response_at is not null) as average_first_response_hours
        from filtered lead
        left join first_response response on response.lead_id = lead.id
        group by lead.source
        order by response_breached desc, overdue_follow_ups desc, total desc, source asc
        limit $8
      `,
      [
        tenantId,
        request.status ?? null,
        request.source ?? null,
        request.assignedAgentId ?? null,
        request.unassigned ?? false,
        request.priority ?? null,
        request.followUpDueBefore ?? null,
        request.limit ?? 20
      ]
    );

    return result.rows.map((row) => this.toSlaSourcePerformance(row));
  }

  async getQualitySignals(
    tenantId: string,
    request: ListLeadsRequest = {}
  ): Promise<Omit<LeadQualitySignalsResponse, "filters" | "generatedAt">> {
    const result = await this.pool.query<LeadQualitySignalsRow>(
      `
        with filtered as (
          select *
          from leads
          where tenant_id = $1
            and ($2::text is null or status = $2)
            and ($3::text is null or source = $3)
            and ($4::text is null or assigned_agent_id = $4)
            and ($5::boolean = false or assigned_agent_id is null)
            and ($6::text is null or priority = $6)
            and ($7::timestamptz is null or next_follow_up_at <= $7)
        )
        select
          count(*) as total,
          count(*) filter (
            where coalesce(nullif(contact_email, ''), nullif(contact_phone, '')) is null
          ) as missing_contact_info,
          count(*) filter (where property_id is null) as missing_property,
          count(*) filter (where assigned_agent_id is null) as unassigned,
          count(*) filter (
            where status in ('new', 'contacted', 'qualified')
              and next_follow_up_at is null
          ) as missing_follow_up,
          count(*) filter (
            where status = 'new'
              and created_at < now() - interval '48 hours'
          ) as stale_new_leads
        from filtered
      `,
      [
        tenantId,
        request.status ?? null,
        request.source ?? null,
        request.assignedAgentId ?? null,
        request.unassigned ?? false,
        request.priority ?? null,
        request.followUpDueBefore ?? null
      ]
    );
    const row = result.rows[0];
    const missingContactInfo = Number(row.missing_contact_info);
    const missingProperty = Number(row.missing_property);
    const unassigned = Number(row.unassigned);
    const missingFollowUp = Number(row.missing_follow_up);
    const staleNewLeads = Number(row.stale_new_leads);
    const byIssue: CountByBucket[] = [
      { bucket: "missing-contact-info", count: missingContactInfo },
      { bucket: "missing-property", count: missingProperty },
      { bucket: "unassigned", count: unassigned },
      { bucket: "missing-follow-up", count: missingFollowUp },
      { bucket: "stale-new-lead", count: staleNewLeads }
    ].filter((item) => item.count > 0);

    return {
      total: Number(row.total),
      issueCount: byIssue.reduce((sum, item) => sum + item.count, 0),
      missingContactInfo,
      missingProperty,
      unassigned,
      missingFollowUp,
      staleNewLeads,
      byIssue
    };
  }

  async getQualityAgentPerformance(
    tenantId: string,
    request: ListLeadsRequest = {}
  ): Promise<LeadQualityAgentPerformanceItem[]> {
    const result = await this.pool.query<LeadQualityAgentPerformanceRow>(
      `
        with filtered as (
          select *
          from leads
          where tenant_id = $1
            and assigned_agent_id is not null
            and ($2::text is null or status = $2)
            and ($3::text is null or source = $3)
            and ($4::text is null or assigned_agent_id = $4)
            and ($5::boolean = false or assigned_agent_id is null)
            and ($6::text is null or priority = $6)
            and ($7::timestamptz is null or next_follow_up_at <= $7)
        ),
        classified as (
          select
            assigned_agent_id,
            coalesce(nullif(contact_email, ''), nullif(contact_phone, '')) is null as missing_contact_info,
            property_id is null as missing_property,
            status in ('new', 'contacted', 'qualified') and next_follow_up_at is null as missing_follow_up,
            status = 'new' and created_at < now() - interval '48 hours' as stale_new_lead
          from filtered
        )
        select
          assigned_agent_id as agent_id,
          count(*) as total,
          count(*) filter (
            where missing_contact_info
              or missing_property
              or missing_follow_up
              or stale_new_lead
          ) as affected_leads,
          sum(
            missing_contact_info::int
            + missing_property::int
            + missing_follow_up::int
            + stale_new_lead::int
          ) as issue_count,
          count(*) filter (where missing_contact_info) as missing_contact_info,
          count(*) filter (where missing_property) as missing_property,
          count(*) filter (where missing_follow_up) as missing_follow_up,
          count(*) filter (where stale_new_lead) as stale_new_leads
        from classified
        group by assigned_agent_id
        order by affected_leads desc, issue_count desc, total desc, agent_id asc
        limit $8
      `,
      [
        tenantId,
        request.status ?? null,
        request.source ?? null,
        request.assignedAgentId ?? null,
        request.unassigned ?? false,
        request.priority ?? null,
        request.followUpDueBefore ?? null,
        request.limit ?? 20
      ]
    );

    return result.rows.map((row) => this.toQualityAgentPerformance(row));
  }

  async getQualitySourcePerformance(
    tenantId: string,
    request: ListLeadsRequest = {}
  ): Promise<LeadQualitySourcePerformanceItem[]> {
    const result = await this.pool.query<LeadQualitySourcePerformanceRow>(
      `
        with filtered as (
          select *
          from leads
          where tenant_id = $1
            and ($2::text is null or status = $2)
            and ($3::text is null or source = $3)
            and ($4::text is null or assigned_agent_id = $4)
            and ($5::boolean = false or assigned_agent_id is null)
            and ($6::text is null or priority = $6)
            and ($7::timestamptz is null or next_follow_up_at <= $7)
        ),
        classified as (
          select
            source,
            coalesce(nullif(contact_email, ''), nullif(contact_phone, '')) is null as missing_contact_info,
            property_id is null as missing_property,
            assigned_agent_id is null as unassigned,
            status in ('new', 'contacted', 'qualified') and next_follow_up_at is null as missing_follow_up,
            status = 'new' and created_at < now() - interval '48 hours' as stale_new_lead
          from filtered
        )
        select
          source,
          count(*) as total,
          count(*) filter (
            where missing_contact_info
              or missing_property
              or unassigned
              or missing_follow_up
              or stale_new_lead
          ) as affected_leads,
          sum(
            missing_contact_info::int
            + missing_property::int
            + unassigned::int
            + missing_follow_up::int
            + stale_new_lead::int
          ) as issue_count,
          count(*) filter (where missing_contact_info) as missing_contact_info,
          count(*) filter (where missing_property) as missing_property,
          count(*) filter (where unassigned) as unassigned,
          count(*) filter (where missing_follow_up) as missing_follow_up,
          count(*) filter (where stale_new_lead) as stale_new_leads
        from classified
        group by source
        order by affected_leads desc, issue_count desc, total desc, source asc
        limit $8
      `,
      [
        tenantId,
        request.status ?? null,
        request.source ?? null,
        request.assignedAgentId ?? null,
        request.unassigned ?? false,
        request.priority ?? null,
        request.followUpDueBefore ?? null,
        request.limit ?? 20
      ]
    );

    return result.rows.map((row) => this.toQualitySourcePerformance(row));
  }

  async listQualityActions(tenantId: string, request: ListLeadsRequest = {}): Promise<LeadQualityActionItem[]> {
    const result = await this.pool.query<LeadQualityActionRow>(
      `
        with filtered as (
          select
            *,
            coalesce(nullif(contact_email, ''), nullif(contact_phone, '')) is null as missing_contact_info,
            property_id is null as missing_property,
            assigned_agent_id is null as unassigned,
            status in ('new', 'contacted', 'qualified') and next_follow_up_at is null as missing_follow_up,
            status = 'new' and created_at < now() - interval '48 hours' as stale_new_lead
          from leads
          where tenant_id = $1
            and ($2::text is null or status = $2)
            and ($3::text is null or source = $3)
            and ($4::text is null or assigned_agent_id = $4)
            and ($5::boolean = false or assigned_agent_id is null)
            and ($6::text is null or priority = $6)
            and ($7::timestamptz is null or next_follow_up_at <= $7)
        )
        select
          *,
          (
            case when missing_contact_info then 5 else 0 end
            + case when unassigned then 4 else 0 end
            + case when stale_new_lead then 3 else 0 end
            + case when missing_follow_up then 2 else 0 end
            + case when missing_property then 1 else 0 end
          ) as score
        from filtered
        where missing_contact_info
          or missing_property
          or unassigned
          or missing_follow_up
          or stale_new_lead
        order by score desc, created_at asc
        limit $8
      `,
      [
        tenantId,
        request.status ?? null,
        request.source ?? null,
        request.assignedAgentId ?? null,
        request.unassigned ?? false,
        request.priority ?? null,
        request.followUpDueBefore ?? null,
        request.limit ?? 20
      ]
    );

    return result.rows.map((row) => this.toQualityAction(row));
  }

  async listByAttribution(tenantId: string, attributionSearchEventId: string): Promise<LeadSnapshot[]> {
    const result = await this.pool.query<LeadRow>(
      `
        select *
        from leads
        where tenant_id = $1
          and attribution_search_event_id = $2
        order by created_at desc
      `,
      [tenantId, attributionSearchEventId]
    );

    return result.rows.map((row) => this.toSnapshot(row));
  }

  async assign(tenantId: string, leadId: string, assignedAgentId: string): Promise<LeadSnapshot | null> {
    const result = await this.pool.query<LeadRow>(
      `
        update leads
        set assigned_agent_id = $3,
            updated_at = $4
        where tenant_id = $1 and id = $2
        returning *
      `,
      [tenantId, leadId, assignedAgentId, new Date().toISOString()]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  async updateFollowUp(
    tenantId: string,
    leadId: string,
    input: UpdateLeadFollowUpInput
  ): Promise<LeadSnapshot | null> {
    const shouldUpdateNextFollowUp = input.nextFollowUpAt !== undefined;
    const result = await this.pool.query<LeadRow>(
      `
        update leads
        set next_follow_up_at = case
              when $3::boolean then $4::timestamptz
              else next_follow_up_at
            end,
            priority = coalesce($5::text, priority),
            updated_at = $6
        where tenant_id = $1 and id = $2
        returning *
      `,
      [
        tenantId,
        leadId,
        shouldUpdateNextFollowUp,
        input.nextFollowUpAt ?? null,
        input.priority ?? null,
        new Date().toISOString()
      ]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  async updateStatus(tenantId: string, leadId: string, status: LeadStatus): Promise<LeadSnapshot | null> {
    const result = await this.pool.query<LeadRow>(
      `
        update leads
        set status = $3,
            updated_at = $4
        where tenant_id = $1 and id = $2
        returning *
      `,
      [tenantId, leadId, status, new Date().toISOString()]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  private toSnapshot(row: LeadRow): LeadSnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id ?? undefined,
      source: row.source,
      status: row.status,
      contactName: row.contact_name,
      contactEmail: row.contact_email ?? undefined,
      contactPhone: row.contact_phone ?? undefined,
      message: row.message ?? undefined,
      preferredLocale: row.preferred_locale ?? undefined,
      assignedAgentId: row.assigned_agent_id ?? undefined,
      attributionSearchEventId: row.attribution_search_event_id ?? undefined,
      attributionSearchQuery: row.attribution_search_query ?? undefined,
      attributionSearchSource: row.attribution_search_source ?? undefined,
      priority: row.priority,
      nextFollowUpAt: row.next_follow_up_at?.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private toNoteSnapshot(row: LeadNoteRow): LeadNoteSnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      leadId: row.lead_id,
      note: row.note,
      createdByUserId: row.created_by_user_id ?? undefined,
      createdByUserRole: row.created_by_user_role ?? undefined,
      createdAt: row.created_at.toISOString()
    };
  }

  private toTimelineSnapshot(row: LeadTimelineRow): LeadTimelineEventSnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      leadId: row.lead_id,
      type: row.type,
      title: row.title,
      actorUserId: row.actor_user_id ?? undefined,
      actorUserRole: row.actor_user_role ?? undefined,
      payload: row.payload,
      createdAt: row.created_at.toISOString()
    };
  }

  private toQualityAction(row: LeadQualityActionRow): LeadQualityActionItem {
    const issueTypes = [
      row.missing_contact_info ? "missing-contact-info" : undefined,
      row.missing_property ? "missing-property" : undefined,
      row.unassigned ? "unassigned" : undefined,
      row.missing_follow_up ? "missing-follow-up" : undefined,
      row.stale_new_lead ? "stale-new-lead" : undefined
    ].filter((issue): issue is LeadQualityActionItem["issueTypes"][number] => issue !== undefined);

    return {
      lead: this.toSnapshot(row),
      issueTypes,
      score: Number(row.score),
      recommendation: this.qualityRecommendation(issueTypes)
    };
  }

  private toSlaBreach(row: LeadSlaBreachRow): LeadSlaBreachItem {
    const breachTypes = [
      row.first_response_breached ? "first-response-breached" : undefined,
      row.first_response_due_soon ? "first-response-due-soon" : undefined,
      row.unassigned_response_breached ? "unassigned-response-breached" : undefined,
      row.follow_up_overdue ? "follow-up-overdue" : undefined
    ].filter((type): type is LeadSlaBreachItem["breachTypes"][number] => type !== undefined);
    const followUpOverdueHours =
      row.follow_up_overdue_hours === null ? undefined : Number(Number(row.follow_up_overdue_hours).toFixed(2));

    return {
      lead: this.toSnapshot(row),
      breachTypes,
      score: Number(row.score),
      ageHours: Number(Number(row.age_hours).toFixed(2)),
      followUpOverdueHours,
      recommendation: this.slaRecommendation(breachTypes)
    };
  }

  private toSlaAgentPerformance(row: LeadSlaAgentPerformanceRow): LeadSlaAgentPerformanceItem {
    const total = Number(row.total);
    const responseBreached = Number(row.response_breached);
    const overdueFollowUps = Number(row.overdue_follow_ups);
    const averageFirstResponseHours =
      row.average_first_response_hours === null ? undefined : Number(row.average_first_response_hours);

    return {
      agentId: row.agent_id,
      total,
      open: Number(row.open),
      responseBreached,
      overdueFollowUps,
      averageFirstResponseHours:
        averageFirstResponseHours === undefined ? undefined : Number(averageFirstResponseHours.toFixed(2)),
      breachRate: total === 0 ? 0 : Number((((responseBreached + overdueFollowUps) / total) * 100).toFixed(2))
    };
  }

  private toSlaSourcePerformance(row: LeadSlaSourcePerformanceRow): LeadSlaSourcePerformanceItem {
    const total = Number(row.total);
    const won = Number(row.won);
    const responseBreached = Number(row.response_breached);
    const overdueFollowUps = Number(row.overdue_follow_ups);
    const averageFirstResponseHours =
      row.average_first_response_hours === null ? undefined : Number(row.average_first_response_hours);

    return {
      source: row.source,
      total,
      open: Number(row.open),
      won,
      lost: Number(row.lost),
      conversionRate: total === 0 ? 0 : Number(((won / total) * 100).toFixed(2)),
      responseBreached,
      overdueFollowUps,
      averageFirstResponseHours:
        averageFirstResponseHours === undefined ? undefined : Number(averageFirstResponseHours.toFixed(2)),
      breachRate: total === 0 ? 0 : Number((((responseBreached + overdueFollowUps) / total) * 100).toFixed(2))
    };
  }

  private toQualityAgentPerformance(row: LeadQualityAgentPerformanceRow): LeadQualityAgentPerformanceItem {
    const total = Number(row.total);
    const affectedLeads = Number(row.affected_leads);
    const missingContactInfo = Number(row.missing_contact_info);
    const missingProperty = Number(row.missing_property);
    const missingFollowUp = Number(row.missing_follow_up);
    const staleNewLeads = Number(row.stale_new_leads);
    const byIssue: CountByBucket[] = [
      { bucket: "missing-contact-info", count: missingContactInfo },
      { bucket: "missing-property", count: missingProperty },
      { bucket: "missing-follow-up", count: missingFollowUp },
      { bucket: "stale-new-lead", count: staleNewLeads }
    ].filter((item) => item.count > 0);
    const affectedRate = total === 0 ? 0 : Number(((affectedLeads / total) * 100).toFixed(2));

    return {
      agentId: row.agent_id,
      total,
      affectedLeads,
      issueCount: Number(row.issue_count),
      missingContactInfo,
      missingProperty,
      missingFollowUp,
      staleNewLeads,
      affectedRate,
      healthScore: Number((100 - affectedRate).toFixed(2)),
      byIssue
    };
  }

  private toQualitySourcePerformance(row: LeadQualitySourcePerformanceRow): LeadQualitySourcePerformanceItem {
    const total = Number(row.total);
    const affectedLeads = Number(row.affected_leads);
    const missingContactInfo = Number(row.missing_contact_info);
    const missingProperty = Number(row.missing_property);
    const unassigned = Number(row.unassigned);
    const missingFollowUp = Number(row.missing_follow_up);
    const staleNewLeads = Number(row.stale_new_leads);
    const byIssue: CountByBucket[] = [
      { bucket: "missing-contact-info", count: missingContactInfo },
      { bucket: "missing-property", count: missingProperty },
      { bucket: "unassigned", count: unassigned },
      { bucket: "missing-follow-up", count: missingFollowUp },
      { bucket: "stale-new-lead", count: staleNewLeads }
    ].filter((item) => item.count > 0);
    const affectedRate = total === 0 ? 0 : Number(((affectedLeads / total) * 100).toFixed(2));

    return {
      source: row.source,
      total,
      affectedLeads,
      issueCount: Number(row.issue_count),
      missingContactInfo,
      missingProperty,
      unassigned,
      missingFollowUp,
      staleNewLeads,
      affectedRate,
      healthScore: Number((100 - affectedRate).toFixed(2)),
      byIssue
    };
  }

  private slaRecommendation(breachTypes: LeadSlaBreachItem["breachTypes"]): string {
    if (breachTypes.includes("unassigned-response-breached")) {
      return "Assign the lead and contact them immediately.";
    }

    if (breachTypes.includes("first-response-breached")) {
      return "Contact the lead now or move it to the next CRM status.";
    }

    if (breachTypes.includes("follow-up-overdue")) {
      return "Complete the overdue follow-up or schedule the next touch.";
    }

    return "Contact the lead before the first-response SLA is breached.";
  }

  private qualityRecommendation(issueTypes: LeadQualityActionItem["issueTypes"]): string {
    if (issueTypes.includes("missing-contact-info")) {
      return "Add an email or phone number before the lead can be followed up.";
    }

    if (issueTypes.includes("unassigned")) {
      return "Assign the lead to an agent so ownership is clear.";
    }

    if (issueTypes.includes("stale-new-lead")) {
      return "Contact the lead or move it to the next CRM status.";
    }

    if (issueTypes.includes("missing-follow-up")) {
      return "Schedule the next follow-up to keep the lead moving.";
    }

    return "Link a property to make the lead context easier to act on.";
  }

  private toStatusEventSnapshot(row: LeadStatusEventRow): LeadStatusEventSnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      leadId: row.lead_id,
      previousStatus: row.previous_status ?? undefined,
      status: row.status,
      changedByUserId: row.changed_by_user_id ?? undefined,
      changedByUserRole: row.changed_by_user_role ?? undefined,
      createdAt: row.created_at.toISOString()
    };
  }
}
