import { Controller, Get, Inject } from "@nestjs/common";
import type { Pool } from "pg";
import { PG_POOL } from "./database.constants.js";

@Controller("health")
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get()
  async health(): Promise<{ status: "ok"; database: "ok" }> {
    await this.pool.query("select 1");

    return {
      status: "ok",
      database: "ok"
    };
  }
}

