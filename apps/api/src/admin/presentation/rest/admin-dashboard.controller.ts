import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { SuperAdminDashboardResponse } from "@propertyflow/contracts";
import { AdminDashboardService } from "../../application/admin-dashboard.service.js";
import { SuperAdminGuard } from "./super-admin.guard.js";

@ApiTags("super-admin")
@ApiHeader({ name: "x-admin-key", required: true })
@Controller("admin")
@UseGuards(SuperAdminGuard)
export class AdminDashboardController {
  constructor(
    @Inject(AdminDashboardService)
    private readonly dashboard: AdminDashboardService,
  ) {}

  @Get("starter-dashboard")
  @ApiOperation({
    summary:
      "Return Starter pilot usage, cost, ROI, limits, and health metrics for all agencies",
  })
  @ApiOkResponse({ description: "Starter super admin dashboard snapshot" })
  starterDashboard(): Promise<SuperAdminDashboardResponse> {
    return this.dashboard.getStarterDashboard();
  }
}
