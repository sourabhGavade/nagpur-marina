import type { Server, Socket } from "socket.io";
import type {
  ClientRole,
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../utils/types.ts";
import { EXPECTED_HARDWARE_CLIENTS } from "./consts.ts";

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

/** Exactly this many Raspberry Pi hardware agents must connect. */

export class DuplicateClientError extends Error {
  constructor(role: Exclude<ClientRole, "tablet">) {
    super(
      role === "hardware"
        ? `Hardware client capacity (${EXPECTED_HARDWARE_CLIENTS}) reached or client_id already connected`
        : `A ${role} client is already connected`,
    );
    this.name = "DuplicateClientError";
  }
}

export class ClientRegistry {
  private readonly tablets = new Map<string, AppSocket>();
  private readonly hardware = new Map<string, AppSocket>();
  private display: AppSocket | null = null;

  assertRoleAvailable(role: ClientRole, clientId: string): void {
    if (role === "hardware") {
      const existing = this.hardware.get(clientId);
      if (existing?.connected) {
        throw new DuplicateClientError(role);
      }

      const connectedCount = [...this.hardware.values()].filter(
        (socket) => socket.connected,
      ).length;
      if (connectedCount >= EXPECTED_HARDWARE_CLIENTS) {
        throw new DuplicateClientError(role);
      }
      return;
    }

    if (role === "display" && this.display?.connected) {
      throw new DuplicateClientError(role);
    }
  }

  register(socket: AppSocket): void {
    const { role, client_id } = socket.data;

    if (role === "tablet") {
      this.tablets.set(socket.id, socket);
    } else if (role === "hardware") {
      this.hardware.set(client_id, socket);
    } else {
      this.display = socket;
    }
  }

  unregister(socket: AppSocket): void {
    const { role, client_id } = socket.data;

    if (role === "tablet") {
      this.tablets.delete(socket.id);
    } else if (
      role === "hardware" &&
      this.hardware.get(client_id)?.id === socket.id
    ) {
      this.hardware.delete(client_id);
    } else if (role === "display" && this.display?.id === socket.id) {
      this.display = null;
    }
  }

  getHardwareClients(): AppSocket[] {
    return [...this.hardware.values()].filter((socket) => socket.connected);
  }

  getHardwareClient(clientId: string): AppSocket | null {
    const socket = this.hardware.get(clientId);
    return socket?.connected ? socket : null;
  }

  getDisplay(): AppSocket | null {
    return this.display;
  }

  get tabletCount(): number {
    return this.tablets.size;
  }

  get hardwareOnline(): boolean {
    return this.getHardwareClients().length === EXPECTED_HARDWARE_CLIENTS;
  }

  get displayOnline(): boolean {
    return this.display?.connected ?? false;
  }
}
