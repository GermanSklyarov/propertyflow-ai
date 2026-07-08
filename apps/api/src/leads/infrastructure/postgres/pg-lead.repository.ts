import { Inject, Injectable } from "@nestjs/common";
import type {
  CountByBucket,
  LeadNoteSnapshot,
  LeadPriority,
  LeadQueueSummaryResponse,
  LeadSnapshot,
  LeadStatus,
  LeadStatusEventSnapshot,
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
          $14,
          'medium',
          null,
          $15,
          $16
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
