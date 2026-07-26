You can save this specification by copying the block below and creating a file named `SYSTEM_SPECIFICATION.md`.

```markdown
# AUTHORITATIVE SYSTEM ARCHITECTURE & INTERFACE SPECIFICATION
## Project: Real-Time Integrated Media & Hardware Automation Framework
**Document Status:** Revised Production Draft

---

## 1. Architectural System Overview

This specification defines the complete structural blueprint for a real-time, low-latency media deployment and physical hardware automation ecosystem. The architecture separates structural sequencing, network routing, and asynchronous timeline tracking from the front-end rendering and independent hardware execution layers.


```

┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 [ Subnet: 192.168.1.0/24 ]                             │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
            ┌───────────────────────────────┼──────────────────────────────┐
            ▼ (Wi-Fi 5GHz)                  ▼ (Cat6 Ethernet)              ▼ (Cat6 Ethernet)
            ┌─────────────────────────┐     ┌─────────────────────────┐    ┌─────────────────────────┐
            │   Tablet Control UI     │     │     Central Laptop      │    │  Large Monitor Display  │
            │  Next.js App (Port 3000)│     │  Node.js Server (P4000) │    │  Next.js App (Port 3001)│
            │     IP: Dynamic DHCP    │     │    IP: 192.168.1.15     │    │     IP: Static/DHCP     │
            └─────────────────────────┘     └─────────────────────────┘    └─────────────────────────┘
            │
            ▼ (Cat6 / Wi-Fi)
            ┌─────────────────────────┐
            │ External Hardware Agent │
            │  Independent Developer  │
            │    IP: 192.168.1.50     │
            └─────────────────────────┘

```

The system isolates business logic and state tracking entirely to a high-performance **Central Laptop Server**. Frontend signages and external hardware elements function as stateless rendering and actuation endpoints, communicating instantaneously via persistent, bidirectional WebSockets.

---

## 2. Network Topology & Port Mapping

The local area network (LAN) is configured as a dedicated subnet to minimize routing hops and enforce predictable packet delivery over TCP via WebSockets.

### Physical Link Stratification
*   **Central Laptop Server (`192.168.1.15:4000`):** Functions as the master automation core, routing node, and central timing loop clock. Hardwired via physical Cat6 Ethernet.
*   **Large Monitor Display (Local Port `3001`):** Hardwired via physical Cat6 Ethernet directly to the primary hardware switch layer. This dedicated link isolates high-throughput video triggers from wireless network degradation.
*   **Tablet Controller (Local Port `3000`):** Connects to a dedicated, high-speed 5GHz wireless access point, giving operators full mobility throughout the installation environment.
*   **External Hardware Agents (`raspberry-pi-1`, `raspberry-pi-2`):** Managed by an independent hardware development team. Exactly two agents connect via Cat6 Ethernet or local 5GHz Wi-Fi with distinct `client_id` values and receive identical standardized control packets.

---

## 3. Configuration & Shared Data Structure (`config.json`)

To maximize retrieval speed, all spatial maps, event sequences, and execution parameters are maintained in a flat `config.json` text file parsed directly into the Central Laptop’s volatile memory (RAM) at boot time. 

Media properties (`video_url` and `video_duration_ms`) are mapped directly to the **Zone** container level. Each sub-zone represents exactly one controllable light/physical element and defines that element's lighting behavior. There is no separate Light entity in the shared data model.

```json
{
  "areas": [
    {
      "id": 1,
      "sequence_order": 1,
      "name": "Entrance Experience",
      "zones": [
        {
          "id": "foyer-welcome",
          "sequence_order": 1,
          "name": "Foyer Light & Welcome",
          "video_url": "/videos/welcome_intro.mp4",
          "video_duration_ms": 12000,
          "video_crossfade_duration_ms": 500,
          "subZones": [
            {
              "element_id": "foyer_accent",
              "intensity": 0.8,
              "animation_duration_ms": 500
            },
            {
              "element_id": "foyer_ceiling",
              "intensity": 0.65,
              "animation_duration_ms": 700
            }
          ]
        },
        {
          "id": "corridor-reveal",
          "sequence_order": 2,
          "name": "Main Corridor Reveal",
          "video_url": "/videos/corridor-reveal.mp4",
          "video_duration_ms": 18000,
          "video_crossfade_duration_ms": 750,
          "subZones": [
            {
              "element_id": "corridor_wall_left",
              "intensity": 1,
              "animation_duration_ms": 750
            },
            {
              "element_id": "corridor_wall_right",
              "intensity": 0.9,
              "animation_duration_ms": 750
            }
          ]
        }
      ]
    }
  ]
}

```

### Hierarchical Data Rules

* **Areas:** Macroscopic environments acting as the structural parent container for sequence chains. Each Area has a `sequence_order` used by continuous playback.
* **Zones:** Ordered elements within an Area that carry a stable machine-readable `id` and an explicit `sequence_order` ranking. Each Zone acts as a single cohesive media block—storing its own `video_url`, `video_duration_ms`, and `video_crossfade_duration_ms`. IDs are used for network and hardware lookups; display names must never be treated as identifiers.
* **Sub-Zones (Lights):** Component partitions nested inside a Zone. Each sub-zone represents exactly one controllable light/physical element and defines its `element_id`, requested `intensity` (`0`–`1`), and `animation_duration_ms`. A Zone can contain multiple sub-zones, so activating a Zone can control multiple lights together. A separate Light entity is not used. Raw GPIO/pin properties remain inside the Raspberry Pi configuration so the shared data stays hardware-agnostic.
* **Lighting Validation:** `intensity` must be a number from `0` through `1`; and `animation_duration_ms` must be a non-negative integer. Without a separate animation type, the duration always means a linear transition from the current output value to the requested value.
* **Video Transition Validation:** `video_crossfade_duration_ms` must be a non-negative integer no greater than `video_duration_ms`. The next Zone starts at `video_duration_ms - video_crossfade_duration_ms`, allowing the fade to finish exactly when the outgoing video duration ends.
* **Timing Units:** All protocol and configuration durations use milliseconds to avoid floating-point conversion and ambiguity.

---

## 4. Real-Time Transactional WebSocket Protocol

Communication between nodes relies on a strict, bidirectional **Transactional Acknowledgement (ACK) Protocol** over persistent TCP connections to prevent desynchronization, duplicated execution, or silent failures.

```
[ Tablet UI ] ── 1. area-activation (callback) ──► [ Laptop Server ]
                                                           │
                                    2. hardware-readiness-check
                                                           ▼
                                                [ Raspberry Pi Agent ]
                                                           │
                              3. ready ACK within configurable timeout
                                                           ▼
[ Tablet UI ] ◄── 4. verified / failure callback ── [ Laptop Server ]

```

### Data Framing & Transaction Lifecycles

* **`system-layout` (Server ➔ Tablet UI):** Broadcasts the raw structural metadata graph at initial connection, allowing the Tablet UI to dynamically generate control elements.
* **`area-activation` [With Callback] (Tablet UI ➔ Server ➔ Tablet UI):** Starts continuous playback from the selected Area. The server plays every Zone in that Area, continues through subsequent Areas by `sequence_order`, and loops from the final Zone of the final Area back to the first Zone of the first Area. The server verifies hardware and display readiness before returning success.
* **`zone-activation` [With Callback] (Tablet UI ➔ Server ➔ Tablet UI):** Runs one selected Zone independently, including its video and all configured sub-zone lights. It does not continue to the next Zone.
* **`subzone-control` [With Callback] (Tablet UI ➔ Server ➔ Raspberry Pi):** Overrides the current sequence, controls one selected sub-zone using its `element_id`, `action`, `intensity`, and `animation_duration_ms`, and plays that sub-zone's parent Zone video on the display.
* **`sequence-stop` [With Callback] (Tablet UI ➔ Server ➔ Tablet UI):** Performs a normal operator stop. The server invalidates all active timelines, sends an empty replacement lighting state to both Pis, stops display playback, and returns success only after both nodes confirm.
* **`hardware-readiness-check` [With Callback] (Server ➔ Raspberry Pi ➔ Server):** Confirms that the Pi is connected, its hardware registry is loaded, and it can accept commands. It does not energize any output. Exactly two hardware clients must pass readiness before combined hardware status is online.
* **`hardware-apply-state` [With Callback] (Server ➔ Raspberry Pi ➔ Server):** Atomically replaces the complete lighting state. The same payload is broadcast to both connected Pis. Each Pi validates and schedules the command, applies all listed outputs together at `execute_at_ms`, and then returns one callback with status `success`. Both ACKs must succeed. This single response per Pi represents both receipt and software-side application; it does not prove that a physical lamp energized unless separate electrical feedback hardware is installed.
* **`hardware-heartbeat` (Raspberry Pi ➔ Server):** Emitted every **5 seconds** with Pi uptime and current status. If no heartbeat arrives for **30 seconds** from either Pi, or either socket disconnects, the server marks combined hardware offline and broadcasts `hardware-status` to the Tablet.
* **`server-heartbeat` (Server ➔ Raspberry Pi):** Emitted every **5 seconds** to every connected Pi. If a Pi receives no server heartbeat for **30 seconds**, its local watchdog cancels queued work and drives all outputs to their safe off state.
* **`hardware-status` (Server ➔ Tablet UI):** Reports a single combined online/offline state for both Pis. Online requires both agents ready. On an offline transition, the Tablet shows a persistent `"Raspberry Pi Offline"` popup until communication recovers.
* **`display-readiness-check` [With Callback] (Server ➔ Large Monitor Display ➔ Server):** Confirms that the display heartbeat is active, both video buffers are available, and the media engine can accept preparation and playback commands.
* **`play-video-transition` [With Callback] (Server ➔ Large Monitor Display ➔ Server):** Directs the display to run its dual-buffer fade at `execute_at_ms`. After the first frame is presented onscreen, the display returns one callback with status `success`.
* **`prepare-video` [With Callback] (Server ➔ Large Monitor Display ➔ Server):** Preloads and decodes the next video. The display must acknowledge `ready` before the server schedules the transition.
* **`stop-video` [With Callback] (Server ➔ Large Monitor Display ➔ Server):** Stops both video buffers, clears their media sources, displays a black frame, and returns `success`.
* **`display-heartbeat` (Large Monitor Display ➔ Server):** Emitted every **5 seconds** with display uptime and playback status. A socket disconnect or 30 seconds without a heartbeat marks the display offline.
* **`display-status` (Server ➔ Tablet UI):** Reports display online/offline state and controls the persistent `"TV Offline"` popup.
* **`global-emergency-stop` (Tablet UI ➔ Server):** Instantly invalidates all active timing operations at the server level.
* **`hardware-emergency-shutdown` (Server ➔ External Hardware Agent):** A master override broadcast forcing the immediate grounding of all active physical elements.

Every transactional command must contain a globally unique `transaction_id`. Receivers must cache recently processed IDs and return the previous result without executing a duplicate command again.

Area, Zone, and sub-zone controls are mutually exclusive. Selecting an individual Zone or sub-zone overrides everything currently running. The server invalidates the active timeline, sends one atomic replacement state to the Pi, and replaces the display content. A Zone override sends one `lights` array item for each sub-zone in that Zone and plays the Zone video. A sub-zone override sends a one-item `lights` array for only that sub-zone and plays its parent Zone video. In this hardware payload, `lights` is a transport collection of sub-zone states, not a separate domain entity.

---

## 5. Architectural Component Responsibilities

### A. Central Laptop Server (Decoupled State Machine)

* **Volatile Storage Tracking:** Maintains the single source of truth for runtime statuses, active zone indexes, and interrupt tokens in application memory.
* **Asynchronous Timeline Engine:** Manages execution sequencing through high-precision JavaScript asynchronous patterns and timers. It handles transition thresholds by executing zone adjustments strictly matching the zone data tiers inside `config.json`.
* **Scheduled Dispatcher:** Coordinates display and hardware events against a shared future `execute_at_ms` target. It dispatches each message early enough for the receiving node to prepare, rather than assuming that packets sent simultaneously will execute simultaneously.
* **Interrupt Token Verification:** Implements a strict validation step prior to moving between sequence nodes. If an execution loop detects a compromised status token, it rejects immediately and clears the system stack.
* **Heartbeat Supervisor:** Tracks Pi heartbeats and uptime. It marks the Pi offline after 30 seconds without a heartbeat, aborts active playback, and notifies every connected Tablet.

### B. Tablet Controller (Dynamic Management Node)

* **Interface Generation:** Evaluates incoming server data structures to build runtime interfaces without manual interface mapping.
* **Hierarchical Controls:** Generates a Play control for each Area, an independent control for every Zone, and an independent control for every sub-zone.
* **Operational Interlock Control:** Locks out user input components while a sequence is running to prevent conflicting timeline activations.
* **Toast Integration:** Monitors the transactional ACK callback status to generate responsive, real-time feedback notifications:
* *Success:* Triggers a success toast ("Hardware Ready. Initializing...") after both the Pi and display pass readiness checks.
* *Error/Timeout:* Triggers an error toast ("Hardware Agent Timeout. Aborting.") and immediately unlocks the interface without modifying the physical environment.
* **Offline Alert:** Shows a persistent `"Raspberry Pi Offline"` popup when `hardware-status` changes to offline and dismisses it only after heartbeat recovery.
* **Playback Alert:** Shows `"TV Playback Failed"` and unlocks the interface if the display returns an error or does not confirm its first rendered frame before the playback deadline.
* **Display Offline Alert:** Shows a persistent `"TV Offline"` popup when `display-status` changes to offline and clears it only after the display reconnects and passes readiness.



### C. Large Monitor Display (Dual-Buffer Media Engine)

* **Media Localization:** Caches all heavy video assets directly within its local storage path (`/public/videos/`). This isolates playback dependencies, ensuring zero buffering or stuttering.
* **Dual-Buffer Layout:** Mounts two overlapping, absolutely positioned HTML5 video player elements—a **Primary Foreground Buffer** and a **Secondary Background Buffer**.
* **Hardware-Accelerated Transitions:** Executes smooth transitions between video tracks by applying hardware-accelerated opacity alterations, seamlessly blending old content out while faded assets emerge on screen.
* **Display Heartbeat:** Emits `display-heartbeat` every 5 seconds with display uptime, readiness, current Zone, and playback state. If no `server-heartbeat` arrives for 30 seconds, it stops both video buffers and displays black.
```json
{
  "display_id": "large-monitor-1",
  "uptime_ms": 86400000,
  "status": "ready",
  "playback_state": "playing",
  "active_zone_id": "foyer-welcome",
  "sent_at_ms": 1784655005000
}
```
* **Playback Confirmation:** Uses `HTMLVideoElement.requestVideoFrameCallback()` to detect the first frame actually presented by Chromium. It then executes the `play-video-transition` callback once:
```json
{
  "transaction_id": "video-174001",
  "status": "success",
  "started_at_ms": 1784655000124
}
```
The recommended callback deadline is `execute_at_ms + 1000ms`. Playback rejection, decoding failure, missing media, or deadline expiry returns `status: "error"` with an `error_code`.

---

## 6. Synchronized Transition & Latency Compensation Mechanics

To deliver synchronous performance where visual components dissolve smoothly and environments light up exactly as video frames appear, the system applies specialized timing controls:

```
                       [ CENTRAL LAPTOP TIMELINE ENGINE ]
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼ (Scheduled for Target Time)                         ▼ (Prepared Before Target)
┌───────────────────────────────────────┐            ┌───────────────────────────────────┐
│ WebSocket: hardware-apply-state       │            │ WebSocket: play-video-transition  │
│ Target: External Hardware Agent       │            │ Target: Large Monitor (Signage)   │
└───────────────────────────────────────┘            └───────────────────────────────────┘
            │                                                     │
    Takes ~2-5ms to Actuate                         Video is preloaded and decoded in advance
            │                                                     │
            └───────────────► BOTH ACTIVATE IN PERFECT SYNC ◄─────┘

```

### Network Latency Compensation

1. **Hardware Path Delay (Low Latency):** Actuation packets targeted at the hardware agent process rapidly. The hardware layer normally switches physical outputs within 2 to 5 milliseconds of the scheduled target.
2. **Media Preparation (Higher Latency):** Browser video decoding may take 30 to 50 milliseconds or longer. The display must preload, seek, and decode the next video before it returns a `ready` ACK.
3. **Shared Execution Target:** After all required nodes report ready, the server chooses a future `execute_at_ms` value with enough lead time for network jitter. Both display and Pi schedule execution against that target. The server must never delay the slower video path after activating the faster hardware path.
4. **Clock Alignment:** The server periodically measures each client's clock offset and round-trip latency. If reliable clock alignment is unavailable, the display transition begins first and the hardware command is delayed by a measured, configurable offset.

---

## 7. End-to-End Operational Execution Lifecycles

### A. Normalized Success & Transition Sequence

1. **Operator Interaction:** The operator triggers "Area 1" via the Tablet UI. The UI locks its buttons and initiates the transactional handshake loop.
2. **Readiness Verification:** The Central Laptop Server checks both Raspberry Pis and the display. Each Pi validates that its registry and output drivers are available; the display confirms that its media engine is ready. Each returns an ACK within the configured readiness timeout.
3. **UI Feedback:** The server executes the Tablet UI's callback. The Tablet renders a **Success Toast Notification** and shifts into active runtime mode.
4. **Zone 1 Preparation and Actuation:** The server sends `prepare-video` and waits for the display's `ready` ACK. It then broadcasts one atomic `hardware-apply-state` transaction to both Pis and one `play-video-transition` transaction containing the same `execute_at_ms`. After execution, each Pi returns `success` when its output transition begins and the display returns `success` after presenting its first frame.
5. **Look-Ahead Pre-Caching:** While Zone 1 executes, the server checks the upcoming sequence node. It instructs the display node to cache and decode the **Zone 2** video file (`/videos/corridor-reveal.mp4`) into the hidden secondary background buffer, positioning it at frame zero at an opacity level of `0.0`. The display returns `ready` when preparation completes.
6. **The Cross-Fade Threshold:** For a 12000ms video with a 500ms cross-fade, the server starts the next Zone at `12000 - 500 = 11500ms` after the current Zone began:
* It broadcasts one replacement state containing the `corridor-reveal` elements to both Pis. Each Pi transitions omitted foyer outputs off while applying the new intensities in one scheduled operation, preventing an intermediate or duplicated state.
* It commands the display to execute a hardware-accelerated fade. Over a 500ms window, the primary foreground buffer fades to an opacity of `0.0` while the background buffer fades up to `1.0`.


7. **Realignment & Continuous Loop:** The display alters its internal node references, mapping the secondary buffer as the new primary tracker. After the final Zone of an Area, the server starts the first Zone of the next Area. After the final Zone of the final Area, it loops to the first Zone of the first Area. Playback continues until overridden or stopped.

### B. Individual Zone Control Lifecycle

1. **Operator Interaction:** The operator selects a Zone and triggers its independent Play control.
2. **Override:** The server invalidates any active Area, Zone, or sub-zone timeline.
3. **Readiness and Preparation:** The server checks the Pi and display, prepares the selected Zone's video, and waits for the required ACKs.
4. **Zone Execution:** The server replaces the display with the selected Zone video and atomically replaces the Pi state with all configured lights from that Zone using a shared `execute_at_ms`. Both nodes must return `success`.
5. **Completion:** After `video_duration_ms`, the selected video ends and no next Zone starts. The selected Zone's lighting state remains active until another Area, Zone, sub-zone, normal stop, emergency stop, or fail-safe command replaces it.

### C. Individual Sub-Zone Control Lifecycle

1. **Operator Interaction:** The operator selects a sub-zone and chooses activate or deactivate.
2. **Override:** The server invalidates any active Area, Zone, or sub-zone timeline.
3. **Command Dispatch:** The server broadcasts an atomic replacement state containing only the selected `element_id`, intensity, animation duration, action, transaction ID, and execution timestamp to both Pis. Every other Pi output is transitioned to its safe off state.
4. **Acknowledgement:** After beginning the requested output transition, the Pi returns one callback with `success` or an error status.
5. **Parent Video:** The display prepares and plays the selected sub-zone's parent Zone video using the same execution timestamp, then returns `success` after its first frame is presented.
6. **Completion:** When the parent video ends, the selected sub-zone light remains active until another control, normal stop, emergency stop, or fail-safe replaces it.

### D. Normal Stop Lifecycle

1. **Operator Interaction:** The operator presses Stop on the Tablet.
2. **Timeline Invalidation:** The server cancels Area looping, Zone playback, sub-zone overrides, pending transitions, and look-ahead preparation.
3. **Safe State Dispatch:** The server sends the Pi an immediate `hardware-apply-state` replacement with `scope: "system"` and an empty `lights` array, then sends `stop-video` to the display.
4. **Completion:** The Tablet receives success after the Pi confirms its outputs were commanded off and the display confirms both buffers were cleared. This normal stop does not use the emergency-stop event.

### E. Transactional Failure Lifecycle

1. **Trigger Request:** The Tablet UI requests activation and enters a pending state.
2. **Node Failure:** The Pi or display returns an error, disconnects, or fails to return its required callback before the configured deadline.
3. **Transaction Abort:** The server terminates the timeline, commands the Pi to enter its safe off state, stops display playback, and returns a structured failure to the Tablet.
4. **UI Reset & Alert:** The Tablet unlocks its controls and shows either `"Hardware Control Failed"` or `"TV Playback Failed"` according to the failed node.

### F. Master Emergency Interruption Lifecycle

1. **E-Stop Trigger:** The operator strikes the global Emergency Halt component on the Tablet UI.
2. **Timeline Invalidation:** The Central Laptop catches the `global-emergency-stop` payload, alters its internal verification token to `COMPROMISED`, and forcefully breaks the active execution queue.
3. **Hardware Reset Broadcast:** The server repeatedly broadcasts a high-priority `hardware-emergency-shutdown` command across the network layer for a short bounded interval.
4. **Bulk Output Shutdown:** The hardware agent handles the emergency signal through its highest-priority execution path. It bypasses normal sequencing and immediately drives every registered output to its safe off state.
5. **Best-Effort Confirmation:** After outputs are safe, the Pi emits an `emergency-shutdown-result` status. The shutdown operation never waits for this response.

### G. Startup and Reconnection Recovery

1. **No Automatic Resume:** A server, Pi, or display restart invalidates the previous runtime state. The system never resumes an old Area, Zone, sub-zone, timestamp, or queued transaction automatically.
2. **Pi Recovery:** On startup or reconnection, the Pi cancels stale work, drives every output to its safe off state, starts its watchdog, and waits for `hardware-readiness-check`.
3. **Display Recovery:** On startup or reconnection, the display stops and clears both buffers, displays black, starts `display-heartbeat`, and waits to pass `display-readiness-check` before accepting new preparation and playback commands.
4. **Server Recovery:** The server starts in an idle state. As clients reconnect, it performs readiness checks and broadcasts current `hardware-status` and `display-status` values to every Tablet.
5. **Tablet Recovery:** A reconnected Tablet requests the current layout and node statuses. Controls remain disabled until required nodes are ready; playback starts only after a new operator command.

---

## 8. Front-End Signage & Linux OS Optimization

To ensure commercial-grade visual presentation stability, the Large Monitor Display environment applies strict application and operating-system-level constraints:

### Chromium Kiosk Execution

The web browser on the display node runs inside a locked down container enforced by specific runtime configurations:

* **Fullscreen Enforcement (`--kiosk`):** Forces the browser window to span the absolute edge boundaries of the display screen, completely removing window controls, title sections, and address fields.
* **Interface Overlay Suppression (`--noerrdialogs` / `--disable-infobars`):** Suppresses all runtime warnings, application update reminders, extension alerts, and crash recovery bubbles.
* **Feature Disabling (`--disable-features=Translate`):** Disables internal page translation prompts when working with dynamic interface elements.

### Operating System Infrastructure Tweaks

* **Cursor Hiding (`unclutter`):** A system background daemon constantly tracks mouse input. If the pointer remains stationary for 1 second, it is dynamically hidden from the video layer.
* **Power Optimization:** The display machine must disable screensavers, display power management signaling (DPMS), and low-power sleep behaviors to maintain constant operational readiness.

---

## 9. Multi-Service Containerized Orchestration Framework

Application lifecycles, network isolation, and local volume persistence are unified inside a multi-container Docker infrastructure managed via the master root orchestration schema below.

```yaml
version: '3.8'

services:
  # 1. Centralized Orchestration Core
  central-server:
    build: ./central-server
    container_name: central-server
    ports:
      - "4000:4000"
    volumes:
      - ./central-server/config.json:/app/config.json
    restart: always
    networks:
      - automation-network

  # 2. Mobile Operator Tablet Control Interface
  tablet-ui:
    build: ./tablet-ui
    container_name: tablet-ui
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SERVER_URL=[http://192.168.1.15:4000](http://192.168.1.15:4000)
    depends_on:
      - central-server
    restart: always
    networks:
      - automation-network

  # 3. Signage Media Rendering Unit
  signage-display:
    build: ./signage-display
    container_name: signage-display
    ports:
      - "3001:3001"
    environment:
      - NEXT_PUBLIC_SERVER_URL=[http://192.168.1.15:4000](http://192.168.1.15:4000)
    volumes:
      - ./signage-display/public/videos:/app/public/videos
    depends_on:
      - central-server
    restart: always
    networks:
      - automation-network

networks:
  automation-network:
    driver: bridge

```

---

## 10. External Hardware Integration Contract

*This contractual section defines the exact interface requirements to be delivered to the independent engineering team developing the physical hardware actuation layers.*

### A. Connection Protocol & Endpoint

* **Protocol:** WebSockets via Socket.io Client v4.x Engine
* **Target Connection URI:** `http://192.168.1.15:4000`
* **Role Constraint:** The hardware node must connect as a persistent socket client, implementing an auto-reconnection safety algorithm to handle local power resets or routing updates.

### B. Atomic Lighting State Event

* **Event Protocol Hook:** `hardware-apply-state`
* **Inbound Payload Graph from Server:**
```json
{
  "transaction_id": "cmd-174001",
  "area_id": 1,
  "zone_id": "foyer-welcome",
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


*(`scope` is constrained to `"area"`, `"zone"`, `"subzone"`, or `"system"`; `"system"` is used for a normal all-off stop and requires `area_id` and `zone_id` to be `null`. `mode` is always `"replace"`. Each `lights` item is the desired hardware state of one sub-zone, not a separate Light entity, and its `action` is constrained to `"activate"` or `"deactivate"`. The array supports sending every sub-zone in a Zone atomically; a single sub-zone command contains one item, and `[]` means all outputs off. Every registered output omitted from `lights` must transition to its safe off state. The server and Pis must reject invalid intensity, duration, timestamp, or element values. The Server broadcasts the identical payload to both connected hardware clients.)*
* **Mandatory Hardware Execution Steps:**
1. Intercept the inbound network message frame.
2. Validate the complete payload and map each stable `element_id` against the Pi's internal GPIO/output registry.
3. Check `transaction_id`. If it was already completed, return the cached callback without driving the outputs again.
4. Validate and schedule the command without returning an early acceptance callback.
5. Cancel pending non-emergency lighting work. At `execute_at_ms`, atomically transition omitted outputs off and apply all listed outputs as one replacement state.
6. After the Pi software begins applying the requested transition to its output drivers, execute the Socket.IO callback once:
```json
{
  "transaction_id": "cmd-174001",
  "status": "success",
  "applied_at_ms": 1784655000125
}
```

On failure, the same callback returns `status: "error"` with an `error_code`. Allowed error codes include `invalid_payload`, `unknown_element`, `busy`, `missed_deadline`, and `hardware_error`.


> ⚠️ **Success Timeout Warning:** Because no early acceptance ACK is used, the command callback deadline must be relative to its scheduled execution time. The recommended starting deadline is `execute_at_ms + 1000ms`. A `success` response confirms that Pi software started applying the requested output transition; it does not electrically prove that a lamp or relay operated.

### C. Heartbeat and Watchdog Contract

* **Pi Event:** `hardware-heartbeat`
* **Interval:** Every 5 seconds
* **Pi Payload:**
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

* The server records `uptime_ms` and the heartbeat receipt time.
* A socket disconnect marks the Pi offline immediately. Otherwise, 30 seconds without a heartbeat marks it offline.
* On an offline transition, the server aborts active playback and sends `hardware-status` with `{ "online": false }` to every Tablet, which displays a persistent popup.
* Heartbeat recovery sends `{ "online": true }` and clears the popup only after the Pi passes `hardware-readiness-check`.
* The server emits `server-heartbeat` every 5 seconds. The Pi's independent watchdog drives all outputs to their safe off state after 30 seconds without a server heartbeat.

### D. Master Emergency Stop Broadcast

* **Event Protocol Hook:** `hardware-emergency-shutdown`
* **Inbound Payload Graph from Server:**
```json
{
  "signal": "emergency-halt"
}

```


* **Mandatory Hardware Execution Steps:**
1. Interrupt all running transitions and queued executions immediately.
2. Drive every registered physical output to its configured safe off state as quickly as the hardware allows.
3. Only after outputs are safe, emit a best-effort `emergency-shutdown-result` status. The server must not delay or depend on this response.



```

```