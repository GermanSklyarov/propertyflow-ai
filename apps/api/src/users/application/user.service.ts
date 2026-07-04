import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { TenantUserSnapshot } from "@propertyflow/contracts";
import { USER_REPOSITORY, type UserRepository } from "../domain/user.repository.js";

@Injectable()
export class UserService {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  listAgents(tenantId: string): Promise<TenantUserSnapshot[]> {
    return this.users.listAgents(tenantId);
  }

  async getActiveAssignableUser(tenantId: string, userId: string): Promise<TenantUserSnapshot> {
    const user = await this.users.findById(tenantId, userId);

    if (!user || user.status !== "active") {
      throw new NotFoundException("Assignable user not found");
    }

    return user;
  }
}

