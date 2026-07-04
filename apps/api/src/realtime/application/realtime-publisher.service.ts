import { Injectable } from "@nestjs/common";
import type { RealtimeEvent, RealtimeEventType } from "@propertyflow/contracts";
import { RealtimeGateway } from "../presentation/websocket/realtime.gateway.js";

@Injectable()
export class RealtimePublisherService {
  constructor(private readonly gateway: RealtimeGateway) {}

  publish<TPayload extends Record<string, unknown>>(
    tenantId: string,
    type: RealtimeEventType,
    payload: TPayload
  ): RealtimeEvent<TPayload> {
    const event: RealtimeEvent<TPayload> = {
      type,
      tenantId,
      payload,
      occurredAt: new Date().toISOString()
    };

    this.gateway.publish(event);

    return event;
  }
}

