# Raspberry Pi Hardware Integration Contract

**Protocol version:** 1.4  
**Status:** Implemented Central Server contract for the Raspberry Pi team

This document defines every Socket.IO message exchanged between the Central Laptop Server and the Raspberry Pi hardware agents.

## 1. Connection

| Item | Value |
|---|---|
| Server URI | Installation server address, for example `http://192.168.1.15:4000` |
| Protocol | Socket.IO client v4.x |
| Socket.IO namespace | `/` (default) |
| Preferred transport | WebSocket |
| Expected hardware clients | Exactly **2** (distinct `client_id`s) |
| Example Pi IDs | `raspberry-pi-1`, `raspberry-pi-2` |

The Socket.IO handshake must identify the client as hardware:

```javascript
io(process.env.SOCKET_SERVER_URL, {
  transports: ["websocket"],
  auth: {
    role: "hardware",
    client_id: "raspberry-pi-1" // or "raspberry-pi-2"
  }
});
```

The Server accepts exactly two connected hardware clients with distinct
`client_id` values. A third hardware connection, or a second connection using an
already-connected `client_id`, is rejected with `duplicate_client`.

Both Pis:

1. Maintain a persistent Socket.IO connection.
2. Reconnect automatically after a network or power interruption.
3. Load their local `element_id` to GPIO/output mapping before reporting ready.
4. Set all registered outputs to their safe off state at startup.
5. Set all outputs to their safe off state after a disconnect or after 30 seconds without a `server-heartbeat`.
6. Never restore a previous output state or queued transaction automatically after startup or reconnection.

Hardware is reported online to the Tablet only when **both** Pis are connected,
ready, and not in error.

Apply-state routing:

- **Area, Zone, Sub-zone, and normal Stop** — the same `hardware-apply-state`
  payload is broadcast to both Pis; both must acknowledge success.
- **Dedicated Lighting control** — routed to one Pi by lighting `model`:
  `main-model` → `raspberry-pi-1`, `clubhouse` → `raspberry-pi-2`. Only that Pi
  must ACK. Lighting does not drive the TV display.
- **Emergency shutdown** — broadcast to both Pis.

Configure the address through the Pi agent's `SOCKET_SERVER_URL` environment
variable. There is currently no authentication token in protocol version 1.4.
The system must run only on the trusted installation LAN.

## 2. Event Summary

| Event | Direction | Response |
|---|---|---|
| `hardware-readiness-check` | Server → Pi | Socket.IO callback required |
| `hardware-apply-state` | Server → Pi | Socket.IO callback required |
| `server-heartbeat` | Server → Pi | No callback |
| `hardware-heartbeat` | Pi → Server | No callback |
| `hardware-emergency-shutdown` | Server → Pi | Immediate action; no callback wait |
| `emergency-shutdown-result` | Pi → Server | Best-effort event |

Events that require a callback use the Socket.IO acknowledgement callback attached to the incoming event. The Pi must invoke that callback exactly once.

## 3. Terminology and Basic Message Flow

### Core terms

| Term | Plain-language meaning |
|---|---|
| Server | The Central Laptop application that decides what should happen and when |
| Pi / hardware agent | The Raspberry Pi program that receives commands and controls the physical outputs |
| Event | The Socket.IO message name, such as `hardware-apply-state` |
| Payload | The JSON data sent with an event |
| JSON | A text format containing named fields and values |
| ACK / callback | The one-time response the Pi returns directly to a received Socket.IO event |
| Transaction | One uniquely identified command and its result |
| `transaction_id` | A unique command ID used to match an ACK and prevent duplicate execution |
| GPIO | A Raspberry Pi pin or hardware interface used to control a light, relay, or driver |
| Output registry | The Pi's local mapping from an `element_id` to the actual GPIO pin or output driver |
| Sub-zone | One controllable light/physical element inside a Zone; it is the lighting entity in the shared data model |
| `lights` array | A transport collection containing one desired hardware state per sub-zone; it is not a separate collection of Light entities |
| Atomic | Apply the entire state together; never leave a partially updated state |
| Replace state | The received `lights` array becomes the complete state; omitted outputs switch off |
| Safe off state | The configured electrical state that turns an output off safely |
| Unix timestamp | Number of milliseconds since 1 January 1970 UTC |
| Heartbeat | A periodic message proving that a device and its software are still running |
| Watchdog | A safety timer that switches outputs off when expected heartbeats stop |
| Idempotent | Repeating the same operation is safe and does not activate hardware twice |
| Best effort | Send the result if possible, but the sender does not wait for or depend on it |

### How one normal command works

1. The Server sends the `hardware-readiness-check` event and a JSON payload to each connected Pi.
2. Each Pi checks its registry, drivers, and watchdog, then returns one callback.
3. For Area/Zone/Sub-zone/Stop, the Server sends the same `hardware-apply-state`
   payload to **both** Pis. For dedicated Lighting control, it sends the payload
   only to the Pi mapped to that lighting's `model`.
4. Each addressed Pi validates the full payload without changing any output.
5. Each addressed Pi schedules the valid state for `execute_at_ms`.
6. At that time, each addressed Pi applies all output changes together.
7. Each addressed Pi returns one success callback. If validation or execution
   fails on a required Pi, that Pi returns one error callback instead and the
   overall command fails.

### Socket.IO ACK concept

An ACK is not a separate event. It is the callback supplied with the event:

```javascript
socket.on("hardware-apply-state", (payload, ack) => {
  // Validate and apply payload.
  ack({
    transaction_id: payload.transaction_id,
    status: "success",
    applied_at_ms: Date.now()
  });
});
```

The code above only illustrates the callback shape. The actual implementation must wait until the scheduled transition begins before returning success.

## 4. Readiness Check

### Server sends

**Event:** `hardware-readiness-check`

```json
{
  "transaction_id": "ready-174001",
  "requested_at_ms": 1784654999000
}
```

### Pi success callback

The Pi returns `ready` only when its hardware registry is loaded, output drivers are available, the watchdog is running, and it can accept a command.

```json
{
  "transaction_id": "ready-174001",
  "status": "ready",
  "checked_at_ms": 1784654999005
}
```

### Pi error callback

```json
{
  "transaction_id": "ready-174001",
  "status": "error",
  "error_code": "hardware_error",
  "message": "Output driver initialization failed",
  "failed_at_ms": 1784654999005
}
```

The readiness check must not switch on or otherwise energize any output.

## 5. Apply Complete Lighting State

The shared data model is `Area → Zone → Sub-Zone`, plus a separate **Lighting**
collection for model-scoped groups. Each sub-zone represents exactly one
controllable light/physical element. There is no separate Light entity. The
protocol keeps the field name `lights` because it carries hardware lighting
states: a Zone command includes one item for each of its sub-zones, a single
sub-zone command includes exactly one item, and a Lighting command includes one
item for each sub-zone in that lighting group.

### Server sends

**Event:** `hardware-apply-state`

```json
{
  "transaction_id": "cmd-174001",
  "area_id": 1,
  "zone_id": "foyer-welcome",
  "lighting_id": null,
  "scope": "zone",
  "mode": "replace",
  "execute_at_ms": 1784655000123,
  "lights": [
    {
      "element_id": "foyer_accent",
      "action": "activate",
      "intensity": 0.8,
      "animation_duration_ms": 500
    }
  ]
}
```

### Plain-language explanation of this payload

This example means:

> For command `cmd-174001`, replace the current lighting state for Zone `foyer-welcome` in Area `1`. At Unix time `1784655000123`, switch on the hardware element named `foyer_accent`, transition it to intensity `0.8` (80% of full) over 500 milliseconds, and switch off every other registered output. For Area/Zone/Sub-zone scopes, the Server sends this identical payload to both connected Raspberry Pis.

### Field requirements

| Field | Type | Meaning and rules |
|---|---|---|
| `transaction_id` | string | Unique ID generated by the Server for this command. The Pi copies it into its ACK and uses it to detect retries. |
| `area_id` | integer or null | Identifies the larger physical Area containing the Zone. It is `null` for Lighting control and for a system-wide normal stop. |
| `zone_id` | string or null | Stable software ID of the Zone being displayed. It is `null` for Lighting control and for a system-wide normal stop. |
| `lighting_id` | string or null | Stable ID of a Lighting group when `scope` is `lighting`; otherwise `null`. |
| `scope` | string | Says what initiated the state: `area`, `zone`, `subzone`, `lighting`, or `system`. `system` is used for a normal all-off stop. |
| `mode` | string | Must be `replace`. The Pi must replace its old state instead of merging the new lights into it. |
| `execute_at_ms` | integer | Exact future Unix time when all output transitions must begin. `_ms` means milliseconds. |
| `lights` | array | Transport list of desired sub-zone hardware states. A Zone can supply multiple items, a single sub-zone command supplies one item, a Lighting group supplies its sub-zones, and `[]` means all outputs off. |
| `element_id` | string | Identifies the sub-zone's controllable physical element. The Pi translates it through its local registry to a GPIO pin, relay, PWM channel, or driver address. |
| `action` | string | `activate` switches the element on as requested; `deactivate` sends it to its safe off state. |
| `intensity` | number | Requested brightness from `0` (off) to `1` (full intensity). Example: `0.8` means 80% of full. |
| `animation_duration_ms` | integer | Time taken to move from the current output to the requested output. `500` means half a second; `0` means immediate. |

### Replacement behavior

`mode: "replace"` means the payload is the complete desired state:

- Every registered output omitted from `lights` must transition to its safe off state.
- An item with `action: "activate"` transitions to the supplied intensity.
- An item with `action: "deactivate"` transitions to its safe off state. Its intensity value is ignored, but must still be valid.
- An empty `lights` array switches every registered output off.
- Pending non-emergency lighting commands are cancelled when a valid replacement command is accepted.
- All listed and omitted outputs must begin their transitions together at `execute_at_ms`.
- After a successful transition, outputs remain at their commanded state even when the associated video ends. They change only when a new replacement state, normal Stop, emergency shutdown, disconnect fail-safe, or heartbeat watchdog replaces them.
- Tablet Pause/Resume does not send a new lighting payload. Pause freezes video and Area sequence timing while the Pi keeps the current commanded output state.

### Pi success callback

The Pi must not return an early acceptance ACK. It returns success only after the scheduled time, when its software begins applying the requested transition to the output drivers.

```json
{
  "transaction_id": "cmd-174001",
  "status": "success",
  "applied_at_ms": 1784655000125
}
```

The server's callback deadline is `execute_at_ms + 1000ms`.

`status: "success"` confirms software-side application. It does not prove that a physical lamp or relay operated unless the hardware provides separate electrical feedback.

### Pi error callback

```json
{
  "transaction_id": "cmd-174001",
  "status": "error",
  "error_code": "unknown_element",
  "message": "Unknown element_id: foyer_accent",
  "failed_at_ms": 1784655000010
}
```

Allowed `error_code` values:

| Code | Meaning |
|---|---|
| `invalid_payload` | Missing field, invalid type, range, enum, or format |
| `unknown_element` | An `element_id` is not in the Pi registry |
| `busy` | Hardware cannot safely accept the command |
| `missed_deadline` | `execute_at_ms` passed before the command could be scheduled |
| `hardware_error` | GPIO/output driver or hardware operation failed |

If validation fails, the Pi must not partially apply the command.

### Duplicate transactions

The Pi must cache recently completed `transaction_id` values and their callback results. If the same transaction is received again:

1. Do not operate the outputs again.
2. Return the previously cached callback result.

## 6. Payload Examples

### Zone activation

The array contains one item for every sub-zone/light that belongs to the selected Zone. This example Zone has one sub-zone.

```json
{
  "transaction_id": "cmd-zone-001",
  "area_id": 1,
  "zone_id": "foyer-welcome",
  "lighting_id": null,
  "scope": "zone",
  "mode": "replace",
  "execute_at_ms": 1784655000123,
  "lights": [
    {
      "element_id": "foyer_accent",
      "action": "activate",
      "intensity": 0.8,
      "animation_duration_ms": 500
    }
  ]
}
```

### Single sub-zone activation

Because one sub-zone represents one controllable light, the array contains exactly one item. All other outputs switch off because this is a replacement state.

```json
{
  "transaction_id": "cmd-subzone-001",
  "area_id": 1,
  "zone_id": "corridor-reveal",
  "lighting_id": null,
  "scope": "subzone",
  "mode": "replace",
  "execute_at_ms": 1784655020000,
  "lights": [
    {
      "element_id": "corridor_wall_left",
      "action": "activate",
      "intensity": 1,
      "animation_duration_ms": 750
    }
  ]
}
```

### Dedicated Lighting control (model-routed)

Tablet `lighting-control` activates or deactivates every sub-zone in a Lighting
group. The Server sends this payload only to the Pi mapped to the lighting
`model` (`main-model` → `raspberry-pi-1`, `clubhouse` → `raspberry-pi-2`). It
does not prepare or play TV video.

```json
{
  "transaction_id": "cmd-lighting-001",
  "area_id": null,
  "zone_id": null,
  "lighting_id": "lighting-1",
  "scope": "lighting",
  "mode": "replace",
  "execute_at_ms": 1784655025000,
  "lights": [
    {
      "element_id": "corridor_wall_left",
      "action": "activate",
      "intensity": 1,
      "animation_duration_ms": 750
    },
    {
      "element_id": "corridor_wall_right",
      "action": "activate",
      "intensity": 0.9,
      "animation_duration_ms": 750
    }
  ]
}
```

### Normal sequence stop / switch all outputs off

The normal Tablet Stop control is not a Pi-specific event. The Server implements it by sending the same atomic replacement event with `scope: "system"` and an empty `lights` array to **both** Pis:

```json
{
  "transaction_id": "cmd-off-001",
  "area_id": null,
  "zone_id": null,
  "lighting_id": null,
  "scope": "system",
  "mode": "replace",
  "execute_at_ms": 1784655030000,
  "lights": []
}
```

## 7. Pause and Resume

Pause and Resume are coordinated between the Tablet, Central Server, and TV
display. They are intentionally not hardware events:

1. Tablet sends `sequence-pause` to the Central Server.
2. The Server pauses the TV at its current video position and suspends Area
   sequence timers.
3. The Pi receives no replacement state, so its current lights stay active.
4. Tablet sends `sequence-resume`.
5. The Server resumes the TV from the same position and continues the Area
   timer using its remaining delay.

The Pi must continue sending normal heartbeats while the experience is paused.
It must not interpret the absence of new apply-state commands as a reason to
switch outputs off. Normal heartbeat and disconnect fail-safes still apply.

`sequence-stop` is different: the Server sends `hardware-apply-state` with
`scope: "system"` and `lights: []`, which switches all outputs off.

## 8. Heartbeats and Watchdog

### Pi sends heartbeat

**Event:** `hardware-heartbeat`  
**Interval:** Every 5 seconds

```json
{
  "pi_id": "raspberry-pi-1",
  "uptime_ms": 86400000,
  "status": "ready",
  "active_transaction_id": "cmd-174001",
  "active_zone_id": "foyer-welcome",
  "sent_at_ms": 1784655005000
}
```

When no transaction or Zone is active, send `null`:

```json
{
  "pi_id": "raspberry-pi-1",
  "uptime_ms": 86405000,
  "status": "ready",
  "active_transaction_id": null,
  "active_zone_id": null,
  "sent_at_ms": 1784655010000
}
```

`status` is either `ready` or `error`. Heartbeats do not use callbacks.

The server marks the Pi offline immediately when its socket disconnects, or when no `hardware-heartbeat` is received for 30 seconds.

Heartbeat field meanings:

| Field | Meaning |
|---|---|
| `pi_id` | Stable name of this Raspberry Pi |
| `uptime_ms` | How long the Pi agent has been running, in milliseconds |
| `status` | `ready` when commands can be accepted; otherwise `error` |
| `active_transaction_id` | Command currently being applied, or `null` |
| `active_zone_id` | Zone currently active, or `null` |
| `sent_at_ms` | Unix time when the heartbeat was sent |

### Server sends heartbeat

**Event:** `server-heartbeat`  
**Interval:** Every 5 seconds

```json
{
  "sent_at_ms": 1784655005000
}
```

The Pi does not ACK this event. If no `server-heartbeat` arrives for 30 seconds, the Pi must:

1. Cancel all queued commands and running transitions.
2. Immediately drive every registered output to its safe off state.
3. Remain safe until the server connection and readiness flow recover.

### Reconnection recovery

After startup, socket reconnection, or server-heartbeat recovery, the Pi must:

1. Discard every command queued before the disconnection.
2. Keep every registered output in its safe off state.
3. Restart its heartbeat and watchdog.
4. Wait for a new `hardware-readiness-check`.
5. Accept only newly issued transactions with valid future `execute_at_ms` values.

The Pi must never resume an old Area, Zone, sub-zone, transition, or output state automatically.

## 9. Emergency Shutdown

### Server sends

**Event:** `hardware-emergency-shutdown`

```json
{
  "signal": "emergency-halt"
}
```

This event has priority over every normal command. On receipt, the Pi must immediately:

1. Interrupt all running transitions.
2. Cancel all queued executions.
3. Drive every registered output to its safe off state.
4. Emit `emergency-shutdown-result` only after outputs have been commanded safe.

The event may be sent repeatedly. Handling it must be safe and idempotent.

### Pi sends best-effort result

**Event:** `emergency-shutdown-result`

```json
{
  "pi_id": "raspberry-pi-1",
  "status": "safe",
  "completed_at_ms": 1784655000200
}
```

If shutdown encounters a hardware error:

```json
{
  "pi_id": "raspberry-pi-1",
  "status": "error",
  "error_code": "hardware_error",
  "message": "Failed to confirm safe state for output relay_2",
  "completed_at_ms": 1784655000200
}
```

The server does not wait for or depend on this event.

## 10. Timing Requirements

- All timestamps and durations are integers in milliseconds.
- `execute_at_ms`, `sent_at_ms`, `applied_at_ms`, `checked_at_ms`, `failed_at_ms`, and `completed_at_ms` use Unix epoch time in milliseconds.
- The Pi clock must be synchronized with the Central Laptop clock before scheduled operation. NTP on the local network is recommended.
- The Pi must return `missed_deadline` instead of executing late when it cannot schedule a command before `execute_at_ms`.
- `animation_duration_ms: 0` means an immediate output change.

## 11. Pi Team Delivery Checklist

- Socket.IO v4 client with automatic reconnection
- Local registry mapping every agreed `element_id` to GPIO/output hardware
- Safe off value defined for every output
- Strict payload validation before output changes
- Atomic replacement-state application
- Scheduling using `execute_at_ms`
- Socket.IO callbacks for readiness and apply-state events
- Duplicate `transaction_id` protection
- Five-second hardware heartbeat
- Thirty-second server-heartbeat watchdog
- Immediate disconnect fail-safe
- Reconnection recovery with no automatic state restoration
- Normal Stop support through an empty system-scoped replacement state
- Pause behavior that keeps the current output state while heartbeats continue
- Highest-priority emergency shutdown handler
- Startup behavior that keeps all outputs safely off

## 12. Important Integration Note

The Central Laptop Server, Tablet client, TV display client, and a development
hardware simulator are implemented in this repository. The production Pi agents
must follow this version 1.4 contract. Run `bun run mock:hardware` from
`socket-server` to test the complete application without physical hardware.

The Server expects exactly two hardware clients. Do not run more than two
hardware agents (simulators and/or production Pis) against the same server.
Each agent must use a distinct `client_id` such as `raspberry-pi-1` and
`raspberry-pi-2`. The Tablet shows a single combined Raspberry Pi online status
that requires both agents to be ready. Dedicated Lighting control is model-routed;
Area/Zone/Sub-zone and Stop remain broadcast to both.
