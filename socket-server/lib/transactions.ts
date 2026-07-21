import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { AppSocket } from "./client-registry.ts";
import type { RuntimeState } from "./runtime-state.ts";

export class TransactionTimeoutError extends Error {
  constructor(transactionId: string) {
    super(`Transaction ${transactionId} timed out`);
    this.name = "TransactionTimeoutError";
  }
}

export class ClientDisconnectedError extends Error {
  constructor(transactionId: string) {
    super(`Client disconnected during transaction ${transactionId}`);
    this.name = "ClientDisconnectedError";
  }
}

export function createTransactionId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export interface AckRequest<T> {
  socket: AppSocket;
  runtime: RuntimeState;
  transactionId: string;
  timeoutMs: number;
  schema: z.ZodType<T>;
  emit(ack: (value: unknown) => void): void;
}

export function requestAck<T>({
  socket,
  runtime,
  transactionId,
  timeoutMs,
  schema,
  emit,
}: AckRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const releaseTransaction = runtime.trackTransaction(transactionId);

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.off("disconnect", onDisconnect);
      releaseTransaction();
      callback();
    };

    const onDisconnect = () =>
      finish(() => reject(new ClientDisconnectedError(transactionId)));

    const timeout = setTimeout(
      () =>
        finish(() => reject(new TransactionTimeoutError(transactionId))),
      timeoutMs,
    );

    socket.once("disconnect", onDisconnect);

    try {
      emit((value) => {
        const result = schema.safeParse(value);

        if (!result.success) {
          finish(() => reject(result.error));
          return;
        }

        finish(() => resolve(result.data));
      });
    } catch (error) {
      finish(() => reject(error));
    }
  });
}
