import { Module } from "@nestjs/common";
import { RealtimePublisherService } from "./application/realtime-publisher.service.js";
import { RealtimeGateway } from "./presentation/websocket/realtime.gateway.js";

@Module({
  providers: [RealtimeGateway, RealtimePublisherService],
  exports: [RealtimePublisherService]
})
export class RealtimeModule {}

