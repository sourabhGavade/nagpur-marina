import { createServer, type Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { ClientRegistry } from "./client-registry.ts";
import {
  ControlController,
  type ControlControllerOptions,
} from "../controllers/control-controller.ts";
import {
  RuntimeController,
  type RuntimeControllerOptions,
} from "../controllers/runtime-controller.ts";
import { config } from "../utils/config.ts";
import type {
  AppConfig,
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../utils/types.ts";
import {
  DisplayHeartbeatSchema,
  HardwareHeartbeatSchema,
  SocketHandshakeAuthSchema,
  validateConfig,
} from "../utils/validation.ts";
import { isTabletLocked } from "./remote-enable.ts";
import type { TabletLockReason } from "./remote-enable.ts";

export interface SocketServerOptions {
  corsOrigin?: string | string[];
  runtime?: RuntimeControllerOptions;
  controls?: ControlControllerOptions;
  appConfig?: AppConfig;
}

export interface SocketServer {
  httpServer: HttpServer;
  io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >;
  registry: ClientRegistry;
  runtime: RuntimeController;
  controls: ControlController;
  config: AppConfig;
  listen(port?: number, hostname?: string): Promise<number>;
  close(): Promise<void>;
  disconnectAllTablets(reason: TabletLockReason): void;
}

const TABLET_ROOM = "role:tablet";

export function createSocketServer(
  options: SocketServerOptions = {},
): SocketServer {
  const appConfig = validateConfig(options.appConfig ?? config);
  const httpServer = createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }

    response.writeHead(404);
    response.end();
  });

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: options.corsOrigin ?? "*",
    },
    transports: ["websocket"],
  });
  const registry = new ClientRegistry();
  const runtime = new RuntimeController(io, registry, options.runtime);
  const controls = new ControlController(
    registry,
    runtime,
    appConfig,
    options.controls,
  );

  io.use((socket, next) => {
    const result = SocketHandshakeAuthSchema.safeParse(socket.handshake.auth);

    if (!result.success) {
      const error = new Error("Invalid client identity") as Error & {
        data?: unknown;
      };
      error.data = {
        error_code: "invalid_handshake",
        issues: result.error.issues,
      };
      next(error);
      return;
    }

    try {
      registry.assertRoleAvailable(result.data.role, result.data.client_id);

      if (result.data.role === "tablet" && isTabletLocked()) {
        const error = new Error("tablet_locked") as Error & {
          data?: unknown;
        };
        error.data = { error_code: "tablet_locked" };
        next(error);
        return;
      }

      socket.data = result.data;
      next();
    } catch (cause) {
      const error = new Error(
        cause instanceof Error ? cause.message : "Client role unavailable",
      ) as Error & { data?: unknown };
      error.data = { error_code: "duplicate_client" };
      next(error);
    }
  });

  io.on("connection", (socket) => {
    registry.register(socket);

    if (socket.data.role === "tablet") {
      void socket.join(TABLET_ROOM);
      socket.emit("system-layout", appConfig);
      socket.emit("hardware-status", {
        online: runtime.state.isOnline("hardware"),
      });
      socket.emit("display-status", {
        online: runtime.state.isOnline("display"),
      });
      socket.emit("runtime-status", runtime.getRuntimeStatus());
      controls.registerTablet(socket);
    } else if (socket.data.role === "hardware") {
      runtime.onNodeConnected("hardware", socket);
      socket.on("hardware-heartbeat", (payload) => {
        const result = HardwareHeartbeatSchema.safeParse(payload);

        if (!result.success) {
          console.error("[runtime] rejected invalid hardware-heartbeat");
          return;
        }

        runtime.onHeartbeat("hardware", result.data, socket);
      });
    } else {
      runtime.onNodeConnected("display", socket);
      socket.on("display-heartbeat", (payload) => {
        const result = DisplayHeartbeatSchema.safeParse(payload);

        if (!result.success) {
          console.error("[runtime] rejected invalid display-heartbeat");
          return;
        }

        runtime.onHeartbeat("display", result.data, socket);
      });
    }

    console.info(
      `[socket] connected role=${socket.data.role} client=${socket.data.client_id}`,
    );

    socket.on("disconnect", (reason) => {
      const { role, client_id } = socket.data;
      registry.unregister(socket);

      if (role === "hardware") {
        runtime.onNodeDisconnected("hardware", client_id);
      } else if (role === "display") {
        runtime.onNodeDisconnected("display", client_id);
      } else if (role === "tablet") {
        runtime.onTabletDisconnected();
      }

      console.info(
        `[socket] disconnected role=${role} client=${client_id} reason=${reason}`,
      );
    });
  });

  runtime.start();

  const disconnectAllTablets = (reason: TabletLockReason) => {
    for (const socket of registry.getTablets()) {
      socket.emit("tablet-locked", { reason });
      socket.disconnect(true);
    }
  };

  return {
    httpServer,
    io,
    registry,
    runtime,
    controls,
    config: appConfig,
    disconnectAllTablets,
    listen(port = 4000, hostname = "0.0.0.0") {
      return new Promise((resolve, reject) => {
        const onError = (error: Error) => {
          httpServer.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          httpServer.off("error", onError);
          const address = httpServer.address();

          if (!address || typeof address === "string") {
            reject(new Error("Server did not expose a TCP address"));
            return;
          }

          resolve(address.port);
        };

        httpServer.once("error", onError);
        httpServer.once("listening", onListening);
        httpServer.listen(port, hostname);
      });
    },
    close() {
      return new Promise((resolve) => {
        runtime.stop();
        io.disconnectSockets(true);
        io.engine.close();
        io.removeAllListeners();
        httpServer.closeAllConnections();

        if (!httpServer.listening) {
          resolve();
          return;
        }

        httpServer.close(() => resolve());
      });
    },
  };
}
