import type { Server, Socket } from "socket.io";
import type {
  ClientRole,
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../utils/types.ts";

export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type AppIo = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export class DuplicateClientError extends Error {
  constructor(role: Exclude<ClientRole, "tablet">) {
    super(`A ${role} client is already connected`);
    this.name = "DuplicateClientError";
  }
}

export class ClientRegistry {
  private readonly tablets = new Map<string, AppSocket>();
  private hardware: AppSocket | null = null;
  private display: AppSocket | null = null;

  assertRoleAvailable(role: ClientRole): void {
    if (role === "hardware" && this.hardware?.connected) {
      throw new DuplicateClientError(role);
    }
    if (role === "display" && this.display?.connected) {
      throw new DuplicateClientError(role);
    }
  }

  register(socket: AppSocket): void {
    const { role } = socket.data;

    if (role === "tablet") {
      this.tablets.set(socket.id, socket);
    } else if (role === "hardware") {
      this.hardware = socket;
    } else {
      this.display = socket;
    }
  }

  unregister(socket: AppSocket): void {
    const { role } = socket.data;

    if (role === "tablet") {
      this.tablets.delete(socket.id);
    } else if (role === "hardware" && this.hardware?.id === socket.id) {
      this.hardware = null;
    } else if (role === "display" && this.display?.id === socket.id) {
      this.display = null;
    }
  }

  getHardware(): AppSocket | null {
    return this.hardware;
  }

  getDisplay(): AppSocket | null {
    return this.display;
  }

  get tabletCount(): number {
    return this.tablets.size;
  }

  get hardwareOnline(): boolean {
    return this.hardware?.connected ?? false;
  }

  get displayOnline(): boolean {
    return this.display?.connected ?? false;
  }
}
