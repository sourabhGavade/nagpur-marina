# Edge Cases and Failure Handling

This document records edge cases handled by the current repository. It
distinguishes executable behavior from guarantees that are only planned or
delegated to the separately implemented Raspberry Pi hardware agent.

## Connection and client identity

- Socket connections are rejected unless they provide a non-empty `client_id`
  and a supported role: `tablet`, `hardware`, or `display`.
- Multiple tablets may connect. Exactly two hardware clients may be active at a
  time, each with a distinct `client_id`. Only one display client may be active
  at a time.
- A third hardware connection, or a hardware connection that reuses an already
  connected `client_id`, is rejected with `duplicate_client`.
- A late disconnect from an old socket cannot unregister a newer replacement
  socket with the same role/`client_id`.
- Hardware is online only when both expected Pis are connected and pass
  readiness. The display is online after it connects and passes readiness.
- A failed readiness check, heartbeat timeout, reported device error, or socket
  disconnect marks the affected device offline and starts fail-safe cleanup.
  Losing either Pi marks combined hardware status offline.
- Lighting commands for Area/Zone/Sub-zone/Stop, and emergency shutdown, are
  broadcast identically to every connected hardware client; apply-state for
  those scopes requires successful ACKs from both.
- Dedicated `lighting-control` commands are routed to one Pi by lighting
  `model` (`main-model` → `raspberry-pi-1`, `clubhouse` → `raspberry-pi-2`).
  Only that Pi must ACK. Lighting does not drive the display.
- Server startup and signal-driven shutdown are guarded against duplicate
  execution.

Relevant code:

- `socket-server/lib/server.ts`
- `socket-server/lib/client-registry.ts`
- `socket-server/lib/runtime-state.ts`
- `socket-server/controllers/runtime-controller.ts`

## Configuration and payload validation

- The server refuses to start with no Areas or with an Area that has no Zones.
- IDs, names, image URLs, and video URLs must be non-empty.
- IDs and sequence orders must be positive integers.
- Durations must be non-negative integers.
- Lighting `intensity` must be a number from `0` through `1`.
- A crossfade cannot be longer than its video.
- Duplicate Area IDs/orders, Zone IDs/orders, Lighting IDs, and Sub-zone
  element IDs are rejected.
- Lighting `sequence_order` values must be unique within each `model`
  (`main-model` or `clubhouse`).
- Commands for unknown Areas, Zones, or Lightings are rejected before any
  device command is sent.
- A Sub-zone command is rejected when the Sub-zone does not belong to the
  supplied Zone.
- Sub-zone and Lighting actions are restricted to `activate` and `deactivate`.
- Malformed heartbeat and ACK payloads are ignored or rejected without updating
  valid runtime state.
- `PORT` must be an integer between 1 and 65535.

Zones are allowed to have no Sub-zones. Activating such a Zone sends an empty
lighting list, which switches all outputs off while its video plays.

Relevant code:

- `socket-server/utils/validation.ts`
- `socket-server/utils/config.ts`
- `socket-server/index.ts`

## Transactions, ACKs, and concurrent commands

- ACK handling has a single completion path. Success, timeout, disconnect,
  malformed ACK, and synchronous emit failure cannot settle the same operation
  more than once.
- ACK transaction IDs must match the command transaction ID.
- Late and duplicate ACKs are ignored after cleanup.
- Timers, listeners, and active transaction tracking are removed when a
  transaction finishes.
- Tablet callbacks are guarded against multiple replies.
- A new Area, Zone, Sub-zone, Lighting, Stop, or Emergency Stop command
  invalidates older work through a generation token.
- An older command cannot send stale hardware state after waiting for delayed
  media preparation.
- Overriding an Area sequence with a Zone stops the old sequence loop.
- Hardware and display activation are dispatched concurrently with the same
  execution timestamp.
- Duplicate readiness and failure workflows for the same role are suppressed.

Relevant code:

- `socket-server/lib/transactions.ts`
- `socket-server/lib/runtime-state.ts`
- `socket-server/controllers/control-controller.ts`
- `socket-server/controllers/runtime-controller.ts`
- `socket-server/controllers/area-sequence-controller.ts`

## Sequence and timing behavior

- Areas and Zones are sorted by `sequence_order`, independently of their source
  array order.
- Area playback starts at the selected Area, continues through later Areas,
  wraps to earlier Areas, and loops until interrupted.
- Crossfades begin at `video_duration_ms - video_crossfade_duration_ms`.
- A transition that is already late is rescheduled far enough into the future
  to preserve the configured dispatch lead time.
- Negative local waits are clamped to zero.
- Hardware and playback ACK deadlines are calculated relative to scheduled
  execution, with a minimum timeout of one second.
- Pause cancels the active Area timer and retains its remaining duration.
- Resume schedules the remainder rather than restarting the full Zone duration.
- Pause is rejected while idle or already paused. Resume is rejected unless the
  runtime is paused.
- If display pause fails, the server rolls back its local paused state.

Configuration currently permits zero-duration videos and crossfades equal to
the full video duration. These produce immediate transitions and may create a
high-frequency loop; there is no enforced minimum Zone duration.

Relevant code:

- `socket-server/controllers/area-sequence-controller.ts`
- `socket-server/controllers/runtime-controller.ts`
- `socket-server/lib/runtime-state.ts`

## Safe-state behavior

- Normal Stop invalidates active work before contacting devices.
- Stop sends hardware all-off and display stop concurrently.
- Missing devices and rejected Stop ACKs are aggregated; Stop reports success
  only when both operations succeed.
- A failed Area, Zone, Sub-zone, or Lighting activation invalidates the runtime
  and sends all-off/stop commands to whichever devices remain available.
- Fail-safe cleanup uses best-effort settlement, so failure to clean up one
  device does not prevent cleanup of the other.
- A display failure sends all-off to connected hardware.
- A hardware failure sends stop-video to the connected display.
- Emergency Stop invalidates active work immediately and broadcasts hardware
  emergency shutdown five times at 50 ms intervals by default.
- Normal controls are temporarily rejected during that bounded emergency
  broadcast.
- Error responses are normalized into codes such as `invalid_payload`,
  `timeout`, `hardware_offline`, `display_offline`, and `busy`.

Relevant code:

- `socket-server/controllers/control-controller.ts`
- `socket-server/controllers/runtime-controller.ts`
- `socket-server/controllers/area-sequence-controller.ts`

## TV display edge cases

- Media preparation rejects a missing URL or Zone ID.
- Media load failure and a 15-second preparation timeout return a structured
  `display_error`.
- Competing `canplay`, media error, and timeout events can complete preparation
  only once.
- Playback is rejected when no prepared video buffer exists.
- A playback timestamp more than 250 ms late is rejected as
  `missed_deadline`; a slightly late command executes immediately.
- Browser autoplay or `play()` rejection is returned as a display error.
- Pause and Resume validate local playback state.
- A new playback command cancels an existing scheduled playback timer.
- Stop is idempotent locally: it safely resets both buffers even while already
  idle.
- A socket disconnect clears timers, pauses and rewinds both video elements,
  hides them, and returns the TV runtime to idle.
- The TV status overlay distinguishes connecting, preparing, paused, error,
  ready, and playing states.

Relevant code:

- `tv-nextjs/app/page.tsx`

## Tablet UI edge cases

- Tablet sockets reconnect automatically.
- Disconnect resets device/runtime status; reconnect receives fresh layout and
  status data from the server.
- A command attempted while disconnected fails immediately on the client.
- Protected control pages redirect to the start screen if connection or layout
  data is missing.
- Empty Area, Zone, and Lighting collections display an explicit empty state
  instead of selecting an undefined item.
- Command buttons lock while their local command is pending.
- Stop is disabled while the runtime is idle.
- Failed commands show a toast and release the local pending lock.
- Area, Zone, and Lighting pages distinguish starting, playing, and error
  states (Lighting uses on/off toggle feedback).
- Broken content images leave a visible text fallback.
- Reduced-motion preferences disable or shorten nonessential animations.

Relevant code:

- `tablet-nextjs/contexts/tablet-context.tsx`
- `tablet-nextjs/components/device-statuses.tsx`
- `tablet-nextjs/components/playback-controls.tsx`
- `tablet-nextjs/app/areas/page.tsx`
- `tablet-nextjs/app/zones/page.tsx`
- `tablet-nextjs/app/lighting/page.tsx`
- `tablet-nextjs/app/journey/page.tsx`

## Important gaps and partial coverage

The following cases should not be treated as fully handled by this repository:

- **Production Pi guarantees:** startup safe-off, GPIO validation, atomic output
  application, server-heartbeat watchdog, missed-deadline rejection, duplicate
  transaction caching, and reconnect recovery belong to the external hardware
  agent. The included mock hardware does not implement all of them. See
  `RASPBERRY_PI_INTEGRATION.md`.
- **End-to-end idempotency:** the server prevents one active transaction from
  settling twice, but the server, TV, and mock hardware do not cache completed
  transaction results. Re-sending a Tablet command creates a new transaction.
- **First-frame confirmation:** the TV acknowledges playback after
  `video.play()` resolves, not after the first rendered frame.
- **Display readiness depth:** the TV readiness response does not verify both
  buffers or media-engine health.
- **TV server-heartbeat watchdog:** the TV does not independently enter safe
  state after losing server heartbeats.
- **Clock synchronization:** execution assumes comparable `Date.now()` clocks;
  no clock-offset or round-trip compensation is implemented.
- **Scheduled-play cancellation ACK:** replacing a pending TV play timer does
  not complete the cancelled command's ACK; the server eventually times it out.
- **Tablet command timeout:** a connected Tablet can remain pending indefinitely
  if the server never invokes its callback.
- **Global Tablet interlock:** controls are locally disabled while a command is
  pending, but are not globally disabled solely because a sequence is running
  or a device is offline. Server validation remains the final guard.
- **Emergency Stop UI:** server support exists, but the Tablet has no Emergency
  Stop control.
- **Persistent offline alerts:** the Tablet shows status indicators and generic
  toasts, not the persistent offline/error popups described in `PLAN.md`.
- **TV media cleanup:** Stop rewinds and hides video elements but does not clear
  their `src` attributes.
- **Deployment safeguards:** kiosk flags, OS watchdogs, cursor hiding, power
  settings, and Docker orchestration remain documentation-only.

## Verified test coverage

The Socket.IO server test suite covers:

- configuration and command validation;
- dual hardware capacity and duplicate hardware rejection;
- model-routed Lighting control to a single Pi;
- readiness timeout and heartbeat expiry;
- disconnect fail-safe behavior;
- sequence ordering and wraparound;
- pause/resume timing;
- stale-command suppression;
- normal Stop; and
- repeated Emergency Stop broadcast to both Pis.

TV browser behavior, Tablet callback timeouts, completed-transaction
idempotency, reconnect recovery, and production Raspberry Pi behavior require
additional integration or end-to-end testing.
