import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import type { RealtimeEvent } from "@propertyflow/contracts";
import type { Server, Socket } from "socket.io";

@WebSocketGateway({
  namespace: "realtime",
  cors: {
    origin: "*"
  }
})
export class RealtimeGateway {
  @WebSocketServer()
  private server!: Server;

  handleConnection(client: Socket): void {
    const tenantId = this.readTenantId(client);

    if (tenantId) {
      client.join(this.tenantRoom(tenantId));
      client.emit("connected", {
        tenantId,
        room: this.tenantRoom(tenantId)
      });
    }
  }

  @SubscribeMessage("tenant.join")
  joinTenant(@ConnectedSocket() client: Socket, @MessageBody() body: { tenantId?: string }): { tenantId: string } {
    const tenantId = body.tenantId ?? this.readTenantId(client);

    if (!tenantId) {
      throw new Error("tenantId is required");
    }

    client.join(this.tenantRoom(tenantId));

    return { tenantId };
  }

  publish(event: RealtimeEvent): void {
    this.server.to(this.tenantRoom(event.tenantId)).emit(event.type, event);
    this.server.to(this.tenantRoom(event.tenantId)).emit("event", event);
  }

  private readTenantId(client: Socket): string | undefined {
    const queryTenantId = client.handshake.query.tenantId;
    const headerTenantId = client.handshake.headers["x-tenant-id"];
    const tenantId = Array.isArray(queryTenantId) ? queryTenantId[0] : queryTenantId;

    if (tenantId) {
      return tenantId;
    }

    return Array.isArray(headerTenantId) ? headerTenantId[0] : headerTenantId;
  }

  private tenantRoom(tenantId: string): string {
    return `tenant:${tenantId}`;
  }
}

