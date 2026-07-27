import { z } from "zod";
import type {
  AppConfig,
  AreaActivationRequest,
  DisplayHeartbeat,
  HardwareHeartbeat,
  LightingControlRequest,
  SocketHandshakeAuth,
  SubZoneControlRequest,
  ZoneActivationRequest,
} from "./types.ts";

const positiveOrderSchema = z.number().int().min(1);
const durationSchema = z.number().int().nonnegative();
const intensitySchema = z.number().min(0).max(1);
const nonEmptyStringSchema = z.string().trim().min(1);

function reportDuplicates<T>(
  values: T[],
  description: string,
  ctx: z.RefinementCtx,
  path: PropertyKey[],
): void {
  if (new Set(values).size !== values.length) {
    ctx.addIssue({
      code: "custom",
      message: `Duplicate ${description}`,
      path,
    });
  }
}

export const SubZoneSchema = z.object({
  element_id: nonEmptyStringSchema,
  intensity: intensitySchema,
  animation_duration_ms: durationSchema,
});

export const ZoneSchema = z
  .object({
    id: nonEmptyStringSchema,
    sequence_order: positiveOrderSchema,
    name: nonEmptyStringSchema,
    video_url: nonEmptyStringSchema,
    video_duration_ms: durationSchema,
    video_crossfade_duration_ms: durationSchema,
    tabletImageUrl: nonEmptyStringSchema,
    subZones: z.array(SubZoneSchema),
  })
  .superRefine((zone, ctx) => {
    if (zone.video_crossfade_duration_ms > zone.video_duration_ms) {
      ctx.addIssue({
        code: "custom",
        message: "Crossfade duration must not exceed video duration",
        path: ["video_crossfade_duration_ms"],
      });
    }

    reportDuplicates(
      zone.subZones.map(({ element_id }) => element_id),
      "Sub-Zone element_id",
      ctx,
      ["subZones"],
    );
  });

export const AreaSchema = z
  .object({
    id: z.number().int().min(1),
    sequence_order: positiveOrderSchema,
    name: nonEmptyStringSchema,
    zones: z.array(ZoneSchema).min(1),
  })
  .superRefine((area, ctx) => {
    reportDuplicates(
      area.zones.map(({ id }) => id),
      "Zone id",
      ctx,
      ["zones"],
    );
    reportDuplicates(
      area.zones.map(({ sequence_order }) => sequence_order),
      "Zone sequence_order",
      ctx,
      ["zones"],
    );
  });

export const LightingSchema = z
  .object({
    id: nonEmptyStringSchema,
    name: nonEmptyStringSchema,
    sequence_order: positiveOrderSchema,
    model: z.enum(["main-model", "clubhouse"]),
    subZones: z.array(SubZoneSchema).min(1),
  })
  .superRefine((lighting, ctx) => {
    reportDuplicates(
      lighting.subZones.map(({ element_id }) => element_id),
      "Sub-Zone element_id",
      ctx,
      ["subZones"],
    );
  });

export const AppConfigSchema = z
  .object({
    areas: z.array(AreaSchema).min(1),
    lightings: z.array(LightingSchema).min(1),
  })
  .superRefine((config, ctx) => {
    reportDuplicates(
      config.areas.map(({ id }) => id),
      "Area id",
      ctx,
      ["areas"],
    );
    reportDuplicates(
      config.areas.map(({ sequence_order }) => sequence_order),
      "Area sequence_order",
      ctx,
      ["areas"],
    );

    const zones = config.areas.flatMap(({ zones }) => zones);
    reportDuplicates(
      zones.map(({ id }) => id),
      "Zone id",
      ctx,
      ["areas"],
    );
    reportDuplicates(
      zones.flatMap(({ subZones }) =>
        subZones.map(({ element_id }) => element_id),
      ),
      "Sub-Zone element_id",
      ctx,
      ["areas"],
    );

    reportDuplicates(
      config.lightings.map(({ id }) => id),
      "Lighting id",
      ctx,
      ["lightings"],
    );
    reportDuplicates(
      config.lightings.flatMap(({ subZones }) =>
        subZones.map(({ element_id }) => element_id),
      ),
      "Lighting Sub-Zone element_id",
      ctx,
      ["lightings"],
    );

    for (const model of ["main-model", "clubhouse"] as const) {
      reportDuplicates(
        config.lightings
          .filter((lighting) => lighting.model === model)
          .map(({ sequence_order }) => sequence_order),
        `${model} Lighting sequence_order`,
        ctx,
        ["lightings"],
      );
    }
  });

export const SocketHandshakeAuthSchema = z.object({
  role: z.enum(["tablet", "hardware", "display"]),
  client_id: nonEmptyStringSchema,
});

export const AreaActivationRequestSchema = z.object({
  area_id: z.number().int().min(1),
});

export const ZoneActivationRequestSchema = z.object({
  zone_id: nonEmptyStringSchema,
});

export const SubZoneControlRequestSchema = z.object({
  zone_id: nonEmptyStringSchema,
  element_id: nonEmptyStringSchema,
  action: z.enum(["activate", "deactivate"]),
  intensity: intensitySchema,
  animation_duration_ms: durationSchema,
});

export const LightingControlRequestSchema = z.object({
  lighting_id: nonEmptyStringSchema,
  action: z.enum(["activate", "deactivate"]),
});

export const HardwareHeartbeatSchema = z.object({
  pi_id: nonEmptyStringSchema,
  uptime_ms: durationSchema,
  status: z.enum(["ready", "error"]),
  active_transaction_id: nonEmptyStringSchema.nullable(),
  active_zone_id: nonEmptyStringSchema.nullable(),
  sent_at_ms: durationSchema,
});

export const DisplayHeartbeatSchema = z.object({
  display_id: nonEmptyStringSchema,
  uptime_ms: durationSchema,
  status: z.enum(["ready", "error"]),
  playback_state: z.enum(["idle", "preparing", "playing", "paused", "error"]),
  active_zone_id: nonEmptyStringSchema.nullable(),
  sent_at_ms: durationSchema,
});

const commandErrorCodeSchema = z.enum([
  "invalid_payload",
  "not_found",
  "hardware_offline",
  "display_offline",
  "timeout",
  "busy",
  "missed_deadline",
  "unknown_element",
  "hardware_error",
  "display_error",
]);

export const ReadinessResultSchema = z.discriminatedUnion("status", [
  z.object({
    transaction_id: nonEmptyStringSchema,
    status: z.literal("ready"),
    checked_at_ms: durationSchema,
  }),
  z.object({
    transaction_id: nonEmptyStringSchema,
    status: z.literal("error"),
    error_code: commandErrorCodeSchema,
    message: nonEmptyStringSchema,
    failed_at_ms: durationSchema,
  }),
]);

export const HardwareApplyResultSchema = z.discriminatedUnion("status", [
  z.object({
    transaction_id: nonEmptyStringSchema,
    status: z.literal("success"),
    applied_at_ms: durationSchema,
  }),
  z.object({
    transaction_id: nonEmptyStringSchema,
    status: z.literal("error"),
    error_code: z.enum([
      "invalid_payload",
      "unknown_element",
      "busy",
      "missed_deadline",
      "hardware_error",
    ]),
    message: nonEmptyStringSchema,
    failed_at_ms: durationSchema,
  }),
]);

export const PrepareVideoResultSchema = z.discriminatedUnion("status", [
  z.object({
    transaction_id: nonEmptyStringSchema,
    status: z.literal("ready"),
    prepared_at_ms: durationSchema,
  }),
  z.object({
    transaction_id: nonEmptyStringSchema,
    status: z.literal("error"),
    error_code: z.enum(["invalid_payload", "display_error"]),
    message: nonEmptyStringSchema,
    failed_at_ms: durationSchema,
  }),
]);

export const DisplayPlaybackResultSchema = z.discriminatedUnion("status", [
  z.object({
    transaction_id: nonEmptyStringSchema,
    status: z.literal("success"),
    started_at_ms: durationSchema,
  }),
  z.object({
    transaction_id: nonEmptyStringSchema,
    status: z.literal("error"),
    error_code: z.enum(["invalid_payload", "missed_deadline", "display_error"]),
    message: nonEmptyStringSchema,
    failed_at_ms: durationSchema,
  }),
]);

export const StopVideoResultSchema = z.discriminatedUnion("status", [
  z.object({
    transaction_id: nonEmptyStringSchema,
    status: z.literal("success"),
    stopped_at_ms: durationSchema,
  }),
  z.object({
    transaction_id: nonEmptyStringSchema,
    status: z.literal("error"),
    error_code: z.literal("display_error"),
    message: nonEmptyStringSchema,
    failed_at_ms: durationSchema,
  }),
]);

export const PauseVideoResultSchema = z.discriminatedUnion("status", [
  z.object({
    transaction_id: nonEmptyStringSchema,
    status: z.literal("success"),
    paused_at_ms: durationSchema,
  }),
  z.object({
    transaction_id: nonEmptyStringSchema,
    status: z.literal("error"),
    error_code: z.literal("display_error"),
    message: nonEmptyStringSchema,
    failed_at_ms: durationSchema,
  }),
]);

export const ResumeVideoResultSchema = z.discriminatedUnion("status", [
  z.object({
    transaction_id: nonEmptyStringSchema,
    status: z.literal("success"),
    resumed_at_ms: durationSchema,
  }),
  z.object({
    transaction_id: nonEmptyStringSchema,
    status: z.literal("error"),
    error_code: z.literal("display_error"),
    message: nonEmptyStringSchema,
    failed_at_ms: durationSchema,
  }),
]);

export const validateConfig = (value: unknown): AppConfig =>
  AppConfigSchema.parse(value);

export const parseSocketHandshakeAuth = (value: unknown): SocketHandshakeAuth =>
  SocketHandshakeAuthSchema.parse(value);

export function parseAreaActivationRequest(
  value: unknown,
  config: AppConfig,
): AreaActivationRequest {
  return AreaActivationRequestSchema.refine(
    ({ area_id }) => config.areas.some(({ id }) => id === area_id),
    { message: "Unknown Area", path: ["area_id"] },
  ).parse(value);
}

export function parseZoneActivationRequest(
  value: unknown,
  config: AppConfig,
): ZoneActivationRequest {
  return ZoneActivationRequestSchema.refine(
    ({ zone_id }) =>
      config.areas.some(({ zones }) => zones.some(({ id }) => id === zone_id)),
    { message: "Unknown Zone", path: ["zone_id"] },
  ).parse(value);
}

export function parseSubZoneControlRequest(
  value: unknown,
  config: AppConfig,
): SubZoneControlRequest {
  return SubZoneControlRequestSchema.superRefine(
    ({ zone_id, element_id }, ctx) => {
      const zone = config.areas
        .flatMap(({ zones }) => zones)
        .find(({ id }) => id === zone_id);

      if (!zone) {
        ctx.addIssue({
          code: "custom",
          message: "Unknown Zone",
          path: ["zone_id"],
        });
      } else if (
        !zone.subZones.some((subZone) => subZone.element_id === element_id)
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Sub-Zone does not belong to the selected Zone",
          path: ["element_id"],
        });
      }
    },
  ).parse(value);
}

export function parseLightingControlRequest(
  value: unknown,
  config: AppConfig,
): LightingControlRequest {
  return LightingControlRequestSchema.refine(
    ({ lighting_id }) =>
      config.lightings.some(({ id }) => id === lighting_id),
    { message: "Unknown Lighting", path: ["lighting_id"] },
  ).parse(value);
}

export const parseHardwareHeartbeat = (value: unknown): HardwareHeartbeat =>
  HardwareHeartbeatSchema.parse(value);

export const parseDisplayHeartbeat = (value: unknown): DisplayHeartbeat =>
  DisplayHeartbeatSchema.parse(value);

export { ZodError as ValidationError } from "zod";
