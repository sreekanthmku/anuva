# Consultation Calls Architecture

## Phase 1 Scope

Doctor-initiated audio/video consultation calls are implemented with self-hosted LiveKit. The API creates rooms, issues short-lived join tokens, stores call state, records consultation audio on the server with LiveKit Egress, and exposes simple call state to the doctor and patient PWAs.

Phase 1 does not include speech-to-text, LLM transcript cleanup, summaries, or clinical note extraction. Those should be added as a separate Phase 2 pipeline after recording storage and access controls are finalized.

## Components

- `apps/api`: Owns LiveKit credentials, room creation, access tokens, patient consent, audio recording start/stop, call state, and push notifications.
- `apps/doctor-pwa`: Lists all bookings and lets the doctor start or resume a call.
- `apps/pwa`: Lets the patient open a consultation call deep link, consent to recording, and join.
- `apps/livekit`: Runs the same-machine LiveKit stack as local host processes, not Docker.
- `packages/database`: Stores `ConsultationCall`, `ConsultationRecording`, and `ConsultationCallConsent`.
- `packages/shared`: Defines the call response schemas consumed by both PWAs.
- Self-hosted LiveKit server: Handles WebRTC signaling and SFU media routing, and posts webhooks back to the API.
- Self-hosted LiveKit Egress worker: Records each participant's audio on server infrastructure.
- Redis: Required by LiveKit Egress coordination, but runs as a local-only process on the same server. It is not a separate server and is not exposed publicly.

## Recording Model

Each participant is recorded separately with **participant egress**, producing one audio file per speaker:

```
consultation-recordings/consultation_<id>-doctor-{time}.mp3
consultation-recordings/consultation_<id>-patient-{time}.mp3
```

Two properties follow from this, and both are the reason for the choice:

- **No headless Chrome.** Only room composite and web egress render a page in Chrome. Participant egress muxes a single publisher's tracks directly, which cuts CPU per recording by roughly an order of magnitude. An MP3 output keeps it audio-only.
- **Speaker-separated audio.** Phase 2 transcription gets each speaker in its own file, so doctor and patient utterances can be attributed without a diarization step.

`ConsultationRecording` therefore holds one row per participant, keyed by `(consultationCallId, participantRole)`. Clients still see a single aggregated recording status; the API collapses the rows before serializing.

## Data Flow

1. Doctor opens a booking in `doctor-pwa` and taps `Start call`.
2. `apps/api` creates or reuses a `ConsultationCall`, creates the LiveKit room, returns a doctor token, and sends the patient a push deep link.
3. Patient opens `/consultations/:id/call`.
4. Patient sees the recording consent screen.
5. After consent, `apps/api` records `ConsultationCallConsent`, returns a patient token, and marks the call active.
6. As each participant publishes a microphone track, LiveKit posts `track_published` to the API, which starts participant egress for that speaker.
7. Doctor ends the call.
8. `apps/api` marks the call ended and stops every egress for the call. Recording status moves through `processing` to `ready`, driven by LiveKit's `egress_updated` / `egress_ended` webhooks.

### Why recording starts on a webhook

Egress can only attach to a track that already exists. When the patient calls `/join` the token has only just been minted, so the patient is not yet in the room and has no microphone track to record. LiveKit's `track_published` event is the first moment a participant is actually recordable, so that is when egress starts.

`reconcileCallRecordings()` is the single entry point and is idempotent — it starts egress for every consented, publishing participant that is not recorded yet. `/join` calls it too (the doctor is usually already publishing by then), and the unique index on `(consultationCallId, participantRole)` is what makes concurrent webhooks safe: the loser of the insert race simply bails out.

**Consent gates every recording in the room, the doctor's included.** No egress starts for anyone until the patient's `ConsultationCallConsent` row exists.

## API Endpoints

- `GET /doctor/consultations`: Lists bookings with `callStatus` and `recordingStatus`.
- `POST /doctor/consultations/:id/call/start`: Starts or resumes the doctor's room and returns a LiveKit token.
- `GET /doctor/consultations/:id/call`: Returns a doctor LiveKit token for an already-started call.
- `POST /doctor/consultations/:id/call/end`: Ends the call and stops audio recording.
- `GET /consultations/:id/call`: Returns patient-visible call state.
- `POST /consultations/:id/call/consent`: Stores patient recording consent.
- `POST /consultations/:id/call/join`: Joins the patient and reconciles recordings.
- `POST /livekit/webhook`: Consumed by LiveKit only. Starts participant egress on `track_published` and updates recording status on `egress_updated` / `egress_ended`.

`/livekit/webhook` verifies LiveKit's signature (a JWT carrying a SHA-256 of the raw body), so it is registered ahead of `express.json()` — the signature covers the unparsed bytes. It always acks with 200 before doing any work, because LiveKit retries non-2xx responses.

## Environment

Set these on `apps/api`:

```bash
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=devsecret
LIVEKIT_TOKEN_TTL=2h
LIVEKIT_RECORDING_ENABLED=true
LIVEKIT_RECORDING_AUDIO_ONLY=true
LIVEKIT_RECORDING_FILE_PREFIX=consultation-recordings
CALL_CONSENT_TEXT_VERSION=recording-consent-v1

# Shared key for the /doctor routes, sent by the doctor PWA as the x-doctor-key header.
DOCTOR_ACCESS_KEY=<long random string>
```

The `/doctor` routes expose patient names, phone numbers, and the ability to mint a LiveKit token for any consultation, so they are gated behind `DOCTOR_ACCESS_KEY`. The check **fails closed**: if the variable is unset the routes return 503 rather than serving unauthenticated. This is a shared key, not per-doctor identity — the schema has no doctor accounts yet. Replace it with real accounts before there is more than one doctor.

No extra secret is needed for the webhook — LiveKit signs it with the same API key/secret pair. It does need to know where to send it, which is configured in `apps/livekit/livekit.yaml`:

```yaml
webhook:
  api_key: devkey
  urls:
    - http://127.0.0.1:3001/livekit/webhook
```

If this block is missing, calls still connect but **nothing is ever recorded** — the API never learns that a track was published.

For production, use `wss://` for `LIVEKIT_URL`, terminate TLS correctly, and archive recordings from local disk to private storage.

## Running The LiveKit Stack

The stack is Redis + `livekit-server` + the Egress worker.

```bash
brew install redis livekit
```

**Egress has no macOS build.** It needs GStreamer, Chrome and Xvfb, and LiveKit ships it as a Linux container only — there is no Homebrew formula and building from source on darwin does not work. So:

| Platform | Redis | livekit-server | Egress |
|---|---|---|---|
| Linux (production) | native | native | native — `pnpm --filter @anuva/livekit start` |
| macOS (local dev) | Docker | native | **Docker** — `apps/livekit/docker-compose.egress.yml` |

`pnpm --filter @anuva/livekit start` launches all three as host processes and is the production path. On a Mac it will always report `egress: missing`, which is expected.

## Deploying To A Single VPS (Coolify)

Everything runs on one OVH VPS: the API as its own Coolify resource, and the call stack
(LiveKit + Egress + Redis) as a Coolify **Docker Compose** resource from
`apps/livekit/docker-compose.prod.yml`.

Keeping them on one host matters for one specific reason: **the ffmpeg mixdown reads the
recording files off local disk.** Split the API and Egress across machines and the API can no
longer see what Egress wrote, so the combined track is never produced. Same host, shared bind
mount, no problem.

### Ports to open in the OVH firewall

| Port | Purpose |
|---|---|
| `7880/tcp` | Signaling. Put behind Coolify's proxy for TLS, so browsers get `wss://`. |
| `7881/tcp` | WebRTC over TCP — the fallback for restrictive corporate networks. |
| `7882/udp` | **All** WebRTC media. |

A single UDP port carries every participant, because the config uses LiveKit's single-port mux
(`rtc.udp_port`) instead of the usual `50000-60000` range. Publishing thousands of ports through
Docker is slow and memory-hungry; one port avoids that entirely.

### Environment for the compose resource

```bash
LIVEKIT_API_KEY=...          # livekit-server generate-keys
LIVEKIT_API_SECRET=...       # never ship devkey/devsecret
LIVEKIT_NODE_IP=<VPS public IPv4>
API_WEBHOOK_URL=https://api.<domain>/livekit/webhook
RECORDINGS_HOST_DIR=/data/anuva/recordings
```

`LIVEKIT_NODE_IP` is not optional. A container cannot discover the host's public address, and
this is what clients are told to send media to — wrong value means calls connect but stay silent.

### Environment for the API resource

```bash
LIVEKIT_URL=wss://livekit.<domain>
LIVEKIT_API_KEY=<same as above>
LIVEKIT_API_SECRET=<same as above>
LIVEKIT_RECORDING_FILE_PREFIX=/out          # the path Egress writes to
RECORDING_LOCAL_DIR=/recordings             # where the API reads the same files
DOCTOR_ACCESS_KEY=<long random string>
```

`LIVEKIT_URL` must be the **public** `wss://` URL, not an internal hostname: the API hands this
value straight to the browser in the join response, so it has to be reachable from the client.
The server SDK converts it to `https://` for its own control-plane calls, so one value covers both.

Mount the recordings directory into the API container in Coolify:

```
/data/anuva/recordings  ->  /recordings
```

Egress sees the same files at `/out`. The two paths differ, which is fine — the mixdown matches
on filename, not full path.

### Wiring in Coolify

1. Deploy the compose resource. Give the `livekit` service a domain (`livekit.<domain>`) pointing
   at container port **7880** so Coolify's proxy terminates TLS.
2. Deploy the API resource from the repo-root `Dockerfile` with a domain (`api.<domain>`).
3. Add the bind mount and env vars above to each.

The webhook goes out through the public URL rather than an internal container hostname. The two
resources are separate Coolify projects and do not share a Docker network by default, so
container DNS between them is not reliable — the public URL always resolves.

### Known gaps before real traffic

- **No TURN.** Roughly 10–15% of users on strict corporate or mobile NATs cannot connect without
  it. LiveKit's built-in TURN wants port 443, which Coolify's proxy already owns, so it needs
  port 5349 with its own certificate. Worth doing before launch.
- **Recordings accumulate on local disk.** They are PHI. Archive them to private object storage
  and set a retention policy; `/data/anuva/recordings` is a staging area, not storage.

## How To Test Placing A Call

Do this in two stages. Stage 1 proves the call itself and needs no Egress at all, so it works natively on a Mac. Stage 2 adds recording and is the part that needs Docker.

### One-time setup

```bash
pnpm --filter @anuva/database db:migrate
pnpm --filter @anuva/database db:generate
pnpm seed                      # specialists + bookable slots
```

`.env` needs `DOCTOR_ACCESS_KEY` — the `/doctor` routes are gated behind it and **fail closed**, so an unset key means the doctor app gets 401 on everything:

```bash
DOCTOR_ACCESS_KEY="<any long random string>"
```

The doctor PWA prompts for this on first load and keeps it in localStorage.

> `apps/admin` and `apps/doctor-pwa` are both configured on port **5174**, so `pnpm dev` cannot run them together. Start the apps individually as below.

### Stage 1 — a real call, no recording

Turn recording off, so nothing needs Egress:

```bash
# .env
LIVEKIT_RECORDING_ENABLED="false"
```

Four terminals:

```bash
redis-server apps/livekit/redis.conf
livekit-server --config apps/livekit/livekit.yaml
pnpm --filter @anuva/api dev            # :3001
pnpm --filter @anuva/pwa dev            # :5173
pnpm --filter @anuva/doctor-pwa dev     # :5174
```

Then:

1. **Patient** — open `http://localhost:5173`, sign in, book a consultation.
2. **Doctor** — open `http://localhost:5174` in a *separate browser profile or a private window* (the two apps must not share a mic-permission prompt or a tab). Enter the `DOCTOR_ACCESS_KEY`. The booking appears; tap `Start call`.
3. **Patient** — open `/consultations/<consultationId>/call`. With recording disabled there is no consent gate; join directly.
4. Confirm two-way audio/video. Grant mic access in both windows.
5. **Doctor** — `End call`. The call row moves to `ended`.

If the two sides connect but hear nothing, it is almost always `use_external_ip: false` in `livekit.yaml` — fine on localhost, broken on any real network.

### Stage 2 — add recording

Recording needs the Egress worker, so start Docker Desktop, then:

```bash
# .env
LIVEKIT_RECORDING_ENABLED="true"
LIVEKIT_RECORDING_FILE_PREFIX="/out"    # the path INSIDE the egress container
```

`/out` is mounted to `apps/livekit/consultation-recordings` by the compose file, so the files land in the repo. Bring up Redis + Egress in Docker, and point the native `livekit-server` at the containerised Redis on 6380:

```bash
docker compose -f apps/livekit/docker-compose.egress.yml up

# NOT the native redis — it would collide on 6379
livekit-server --config apps/livekit/livekit.yaml --redis-host 127.0.0.1:6380
```

Egress and `livekit-server` must share one Redis: that is how Egress receives jobs.

Now repeat the call. This time the patient sees the **consent screen** before joining. After both sides publish their microphones, expect:

- **two** `ConsultationRecording` rows for the call, `participantRole` `doctor` and `patient`
- **two** files in `apps/livekit/consultation-recordings`, one per speaker

```sql
SELECT "participantRole", status, "storagePath", "durationSeconds"
FROM "ConsultationRecording"
ORDER BY "createdAt" DESC LIMIT 2;
```

Both rows should reach `ready` shortly after the doctor ends the call.

### When recording does not start

Work down this list — the failure is nearly always one of these:

1. **No `webhook` block in `livekit.yaml`.** The call connects fine but nothing records, because the API is never told a track was published. This is the single most common cause.
2. **Patient has not consented.** Consent gates every recording in the room, the doctor's included. No consent row, no egress.
3. **Egress cannot reach the SFU.** Check `docker compose logs egress` for connection errors to `host.docker.internal:7880`.
4. **`LIVEKIT_RECORDING_FILE_PREFIX` still points at a host path.** Egress writes inside the container; it must be `/out`.

Container-to-host UDP media on Docker Desktop can be finicky. If Egress connects but produces silent or empty files, that is the likely cause — the reliable answer is to run Egress on a Linux host, which is what production does anyway.

## Scaling Notes

This Phase 1 design is intentionally simple: one LiveKit server, one local-only Redis process, and one Egress worker on the same VM.

Concurrency is bounded by how many doctors are on a call at once, not by registered user count — calls are 1:1 (`max_participants: 2`). At ~3,000 registered users that is realistically 5–15 concurrent calls at peak.

Because participant egress does not run Chrome, the egress worker costs roughly **0.15 vCPU per recorded speaker** (~0.3 vCPU per call) rather than the ~2 vCPU per call that room composite needed. A 4 vCPU / 8 GB egress worker covers the peak above with headroom.

Suggested split at that scale:

| Component | Spec |
|---|---|
| API | 2 vCPU / 4 GB |
| Postgres | 2 vCPU / 4 GB, 80 GB SSD |
| LiveKit SFU + Redis | 2 vCPU / 4 GB, high bandwidth, public IP, UDP 50000–50100 |
| Egress | 4 vCPU / 8 GB |

The SFU's constraint is **bandwidth, not CPU** — it does not transcode. A 1:1 video call is roughly 4 Mbps of server egress, so 15 concurrent calls is ~60 Mbps sustained. Prefer a host with generous included transfer.

Everything can start on a single 4 vCPU / 16 GB VM. Split Egress out first when CPU stays above 70%.

### Storage

Audio runs about 1 MB per minute per speaker, so a 30-minute consultation produces ~60 MB across the two files. Local disk is a staging area only — archive to private object storage. This is PHI: encrypt at rest, set a retention policy, and log access.
