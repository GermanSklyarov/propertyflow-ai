import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { UserService } from "./application/user.service.js";
import { USER_REPOSITORY } from "./domain/user.repository.js";
import { PgUserRepository } from "./infrastructure/postgres/pg-user.repository.js";

@Module({
  imports: [DatabaseModule],
  providers: [
    UserService,
    {
      provide: USER_REPOSITORY,
      useClass: PgUserRepository
    }
  ],
  exports: [UserService]
})
export class UsersModule {}
