# Server Migration Runbook

How to stand up every Anuva service on a new VPS. Written after doing it once — the
verification steps and troubleshooting entries are the failures that actually happened, not
hypotheticals.

**Order matters.** DNS before TLS, firewall before LiveKit, LiveKit before a test call.

---

## 0. What runs where

| Service | Where | Notes |
|---|---|---|
| API (`@anuva/api`) | Coolify resource, repo-root `Dockerfile` | Needs ffmpeg + recordings mount |
| Postgres | Coolify database, or managed | |
| LiveKit + Egress + Redis | Coolify **Docker Compose** resource | `apps/livekit/docker-compose.prod.yml` |
| Patient PWA | Vercel | build-time env only |
| Doctor PWA | Vercel | build-time env only |

**The API and Egress must be on the same host.** The ffmpeg mixdown reads the recording files
off local disk. Split them and the per-speaker files still work, but the combined track is never
produced.

---

## 1. DNS

Point A records at the new VPS **before** creating anything in Coolify — Let's Encrypt fails if
the name does not resolve yet.

| Record | Serves |
|---|---|
| `api.<domain>` | API |
| `livekit.<domain>` | LiveKit signaling (WebSocket) |
| `app.<domain>` | Patient PWA (or Vercel domain) |
| `doctor.<domain>` | Doctor PWA |

Verify before moving on:

```bash
dig +short api.<domain>
dig +short livekit.<domain>
```

Expected: the new VPS IP, both times. If you get the old server's IP, TTL has not expired —
wait, do not proceed.

---

## 2. Firewall

Coolify's proxy owns 80/443. The call stack needs three more ports opened at the **OVH/provider
firewall** and, if you run one, `ufw`:

| Port | Carries | Can it go through the proxy? |
|---|---|---|
| `7880/tcp` | Signaling (WebSocket) | Yes — Coolify proxies this |
| `7881/tcp` | WebRTC over TCP, fallback for locked-down networks | **No** |
| `7882/udp` | **All** WebRTC media | **No** |

Traefik is an HTTP proxy. It cannot carry UDP, so media has to reach the host directly. This is
why 7881/7882 are published straight from the container instead of getting a domain.

```bash
sudo ufw allow 7881/tcp
sudo ufw allow 7882/udp
sudo ufw status | grep -E '7881|7882'
```

Expected: both listed as `ALLOW`.

### Why one UDP port and not a range

The LiveKit default is a `50000-60000` range — over ten thousand published ports, which Docker
handles badly (a `docker-proxy` process per port, slow starts, heavy memory). The compose file
uses LiveKit's single-port mux (`rtc.udp_port`) instead, so every participant's media is
multiplexed over `7882/udp` alone.

### Testing UDP reachability — read this before you run it

You can check the port is open with netcat, but **the listener must be killed afterwards or it
will hold 7882 and LiveKit will refuse to start.** Use a self-terminating form:

```bash
# on the VPS — exits by itself after 10s
timeout 10 nc -ulp 7882
```

Never leave a bare `nc -ulp 7882` running. See troubleshooting: *address already in use*.

---

## 3. Recordings directory

Create it before deploying, so Docker does not create it root-owned:

```bash
sudo mkdir -p /data/anuva/recordings
sudo chmod 777 /data/anuva/recordings
ls -ld /data/anuva/recordings
```

Expected: `drwxrwxrwx ... /data/anuva/recordings`

777 is deliberate. The Egress container writes as **uid 1001** and the API container reads as a
different user; both need access. Tighten to a shared group later if you care.

> These are medical recordings. This directory is staging, not storage — see §9.

---

## 4. LiveKit API keys

```bash
docker run --rm livekit/livekit-server generate-keys
```

Expected: an `API Key` (starts `API…`) and a long `Secret`. Save both.

**Never ship `devkey`/`devsecret`.** Anyone holding them can mint a join token for any
consultation and enter a live doctor–patient call.

---

## 5. Deploy the call stack

Coolify → **+ New Resource → Docker Compose**, pointing at your repo.

- Compose file path: `apps/livekit/docker-compose.prod.yml`

Environment variables on **this resource**:

```bash
LIVEKIT_API_KEY=<from step 4>
LIVEKIT_API_SECRET=<from step 4>
LIVEKIT_NODE_IP=<VPS public IPv4>
API_WEBHOOK_URL=https://api.<domain>/livekit/webhook
```

### Why `LIVEKIT_NODE_IP` is not optional

A container cannot discover the host's public address. This value is what LiveKit advertises to
browsers as the destination for their media. Get it wrong and **calls connect, both sides show
as joined, and nobody hears anything** — the single most common self-hosted LiveKit failure.

### Why the webhook uses a public URL

The API is a *separate* Coolify resource. Separate resources do not share a Docker network by
default, so container-name DNS between them is unreliable. The public HTTPS URL always resolves.

The webhook is not cosmetic: **recording is started by the `track_published` event.** No
webhook, no recording, ever — calls will work fine and nothing will be captured.

### Domain for the `livekit` service

Set a domain on the **`livekit` service specifically**:

```
https://livekit.<domain>:7880
```

The `:7880` is Coolify's convention for *which container port to proxy to* — not a public port.
Coolify serves it on 443 with TLS and forwards internally. Nobody ever types `:7880` in a
browser. Traefik handles the WebSocket upgrade automatically.

### Verify the stack came up

```bash
sudo docker ps --format '{{.Names}}\t{{.Status}}' | grep -E 'livekit-|egress-|redis-'
```

Expected: **three** containers, all `Up`, redis showing `(healthy)`.

If `livekit-` is missing, it exited. Get the reason:

```bash
sudo docker logs $(sudo docker ps -a --format '{{.Names}}' | grep '^livekit-' | head -1) --tail 40
```

Note the `^livekit-` anchor — without it the grep also matches the `egress` container (its image
is `livekit/egress`) and hides the one you want.

Expected in a healthy log:

```
starting LiveKit server  {"portHttp": 7880, "nodeIP": "<your public IP>",
                          "rtc.portTCP": 7881, "rtc.portUDP": {"Start":7882,"End":0}}
```

Check three things in that line:
- `nodeIP` is your **public** IP, not `172.x` / `10.x` — a private IP means silent calls
- `portUDP.Start` is `7882` with `End: 0` — confirms single-port mux is active
- no `keys` error — an empty `keys:` block means the API key/secret env vars did not reach the
  container, and LiveKit exits immediately (redis and egress will start fine regardless, so
  "two of three containers up" is the signature of this)

### Verify the recordings mount — do not skip this

```bash
EG=$(sudo docker ps --format '{{.Names}}' | grep '^egress-' | head -1)
sudo docker inspect "$EG" --format '{{json .Mounts}}' | python3 -m json.tool
```

Expected:

```json
[{ "Type": "bind", "Source": "/data/anuva/recordings", "Destination": "/out", "RW": true }]
```

**If `"Type"` is `"volume"`, recording is broken.** Coolify does not interpolate variables inside
a compose `volumes:` entry — given `${RECORDINGS_HOST_DIR}:/out` it reads the *variable name* as
a volume name and silently creates a named Docker volume. Recordings then land in
`/var/lib/docker/volumes/...` where the API cannot reach them, and Egress cannot write at all
because that volume is root-owned. This is why the path is written literally in the compose file.

Confirm Egress can actually write:

```bash
sudo docker exec "$EG" touch /out/testfile && echo "WRITE OK"
ls -la /data/anuva/recordings/     # testfile must appear HERE, owned by 1001
sudo docker exec "$EG" rm /out/testfile
```

Expected: `WRITE OK`, and `testfile` visible on the host owned by uid `1001`.

---

## 6. Deploy the API

Coolify → **+ New Resource → Dockerfile**, same repo, `/Dockerfile`.

- Domain: `https://api.<domain>`
- Port: `3001`

**Storages → add a Directory Mount** (a bind mount — *not* "Volume Mount", which creates a named
volume Egress cannot share):

```
/data/anuva/recordings   →   /recordings
```

Environment:

```bash
DATABASE_URL=postgres://...
PORT=3001

LIVEKIT_URL=wss://livekit.<domain>
LIVEKIT_API_KEY=<same as step 4>
LIVEKIT_API_SECRET=<same as step 4>
LIVEKIT_TOKEN_TTL=2h
LIVEKIT_RECORDING_ENABLED=true
LIVEKIT_RECORDING_AUDIO_ONLY=true
LIVEKIT_RECORDING_FILE_PREFIX=/out        # path INSIDE the egress container
RECORDING_LOCAL_DIR=/recordings           # path INSIDE the api container
CALL_CONSENT_TEXT_VERSION=recording-consent-v1

DOCTOR_SESSION_COOKIE_NAME=anuva_doctor_session
DOCTOR_SESSION_TTL_HOURS=12

SESSION_COOKIE_SAME_SITE=none
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_DOMAIN=.<domain>

TWOFACTOR_API_KEY=...
FIREBASE_SERVICE_ACCOUNT_JSON=<service account JSON, single line>
PUSH_BROADCAST_SECRET=<random>
NUDGE_TIMEZONE=Asia/Kolkata
OPENAI_API_KEY=...                        # omit and /anu/chat returns 503
```

Notes on the ones that bite:

- **`LIVEKIT_URL` must be the public `wss://` URL.** The API hands this value straight to the
  browser in the join response, so an internal hostname breaks every client. The server SDK
  converts it to `https://` for its own control-plane calls, so one value covers both uses.
- **The two recording paths differ on purpose.** Egress writes at `/out`, the API reads at
  `/recordings`, both backed by the same host directory. The mixdown matches files by basename,
  so the mount points do not need to agree.
- **`SESSION_COOKIE_*`** — the PWA and API are different subdomains. Without `SameSite=None`,
  `Secure`, and a parent-domain cookie, login silently fails and patients cannot fetch their own
  recordings.

Migrations run automatically: the Dockerfile `CMD` runs `prisma migrate deploy` before starting.

### Verify the API

```bash
curl https://api.<domain>/health
```
Expected: `{"ok":true}`

```bash
curl -o /dev/null -w '%{http_code}\n' https://api.<domain>/doctor/consultations
curl -o /dev/null -w '%{http_code}\n' -X POST https://api.<domain>/livekit/webhook
```
Expected: **401** for both.

A **404** means an old build is deployed — those routes do not exist in it. `/doctor/*` 401s without
a valid session cookie by design; sessions come from `POST /doctor/auth/login`, and the
credentials behind them are set in the admin panel under **Specialist Logins**.

```bash
API=<api-container-name>
sudo docker exec "$API" ffmpeg -version | head -1
sudo docker exec "$API" ls -la /recordings
```
Expected: an ffmpeg version line, and `/recordings` listing the same contents Egress sees. No
ffmpeg means no combined recording — the image must be built from a commit that includes the
`apk add ffmpeg` line in the Dockerfile.

---

## 7. Deploy the PWAs (Vercel)

Two projects, each with **Root Directory** set:

| Project | Root Directory |
|---|---|
| Patient | `apps/pwa` |
| Doctor | `apps/doctor-pwa` |

Enable **"Include files outside of the Root Directory"** — both apps import the `@anuva/shared`
workspace package, and the doctor app's Vite `publicDir` points at `apps/pwa/public`.

Build-time environment (`VITE_*` values are inlined at build, so **changing one needs a rebuild,
not a restart**):

```bash
VITE_API_URL=https://api.<domain>
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...
VITE_FREE_TRIAL_DAYS=14
```

Two traps, both of which produce a *successful build* that misbehaves at runtime:

1. **In `vercel.json`, build variables go under `build.env`, not top-level `env`.** Top-level
   `env` declares runtime variables for Serverless Functions; a static Vite build never reads it.
2. **`turbo.json` must declare the variables.** Turborepo filters task environments and strips
   anything undeclared. The `build` task carries `"env": ["VITE_*"]` for this reason.

If either is wrong, `VITE_API_URL` is `undefined`, `API_BASE_URL` falls back to `''`, and the app
calls **its own origin** — the SPA rewrite then serves `index.html`, so requests return `200`/`304`
HTML instead of failing loudly. Verify the value actually shipped:

```bash
JS=$(curl -s https://doctor.<domain>/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
curl -s "https://doctor.<domain>$JS" | grep -c "api\.<domain>"
```
Expected: `1` or more. `0` means the variable was stripped.

---

## 8. End-to-end acceptance test

Place a real consultation call:

1. Patient app → sign in → book a consultation.
2. Doctor app (separate browser profile — the two must not share a mic prompt) → sign in with that
   doctor's username and password (or an `admin` account for the all-bookings view) → **Start
   call**.
3. Patient → open the consultation → consent → join.
4. Talk for ~30 seconds. Confirm two-way audio.
5. Doctor → **End call**. The patient should be disconnected automatically.

```bash
ls -la /data/anuva/recordings/
```

Expected **three** `.ogg` files plus `EG_*.json` manifests:

```
consultation_<id>-doctor-<time>.ogg
consultation_<id>-patient-<time>.ogg
consultation_<id>-mixed.ogg
```

Per-speaker files are separate by design — Phase 2 transcription gets speaker attribution
without diarization. The `-mixed` file is what the patient plays back.

Then confirm the database agrees:

```sql
SELECT "participantRole", status, "durationSeconds", "storagePath"
FROM "ConsultationRecording" ORDER BY "createdAt" DESC LIMIT 3;
```

Expected: three rows, all `ready`. A `storagePath` still containing the literal `{time}`
placeholder means Egress never reported completion.

Finally, in the patient app: **Profile → Your consultations → Past → Play recording.**

---

## 9. Before real patients

- **Give each doctor their own login, and keep `portalRole = admin` rows with ops.** An admin row
  sees *every* patient's name and phone number, so set a username and password per bookable
  specialist in the admin panel (**Specialist Logins**) — those are scoped to that doctor's own
  consultations. Passwords are hashed with scrypt; a doctor can change their own from the portal,
  which signs out their other devices.
- **No TURN is configured.** Roughly 10–15% of users on strict corporate or mobile NATs will not
  connect. LiveKit's built-in TURN wants port 443, which Coolify's proxy owns, so it needs 5349
  with its own certificate.
- **Recordings are PHI and accumulate on local disk.** ~1 MB per minute per speaker. Archive to
  private object storage, encrypt at rest, set a retention policy, and log access.
- **Remove the public 7880 publish** once the domain works. Leaving `- '7880:7880'` in the
  compose file means signaling is also reachable unencrypted at `http://<VPS_IP>:7880`,
  bypassing TLS. Drop that one line (keep 7881/7882) and confirm `wss://livekit.<domain>` still
  connects.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `failed to bind host port 0.0.0.0:7882/udp: address already in use` | A leftover `nc -ulp 7882` from firewall testing, or a stale container | `sudo fuser -k 7882/udp`, confirm `sudo ss -ulpn \| grep 7882` prints **nothing**, redeploy |
| Two of three containers up, `livekit-` missing | Empty `keys:` — API key/secret env vars not set on the resource | Set them, redeploy |
| Call connects, both sides joined, **no audio** | `LIVEKIT_NODE_IP` wrong, or 7882/udp blocked | Check the `nodeIP` in the startup log is the public IP |
| Calls work, **nothing ever records** | Webhook not reaching the API | Check `API_WEBHOOK_URL`; `sudo docker logs <livekit> \| grep webhook` should show sends |
| `Local upload failed: ... permission denied` | `/out` is a named volume, not a bind mount | See §5 mount verification |
| Two speaker files, **no `-mixed.ogg`** | API cannot read the files, or ffmpeg missing | Check the API's `/recordings` mount and `ffmpeg -version` |
| Nothing records and no consent row exists | Consent gates **every** recording, the doctor's included | Patient must pass the consent screen |
| PWA calls its own domain instead of the API | `VITE_API_URL` stripped | See §7 — `build.env` and `turbo.json` |
| Patient login fails on the PWA | Cross-subdomain cookies | `SESSION_COOKIE_SAME_SITE=none`, `SECURE=true`, `DOMAIN=.<domain>` |
| Vercel build fails `ERR_PNPM_OUTDATED_LOCKFILE` | `pnpm-lock.yaml` out of sync with a `package.json` | `pnpm install` locally, commit the lockfile |

### Useful one-liners

```bash
# who holds the media port
sudo ss -ulpn | grep 7882

# livekit startup line (nodeIP, ports, keys)
sudo docker logs $(sudo docker ps -a --format '{{.Names}}' | grep '^livekit-' | head -1) --tail 30

# did livekit deliver webhooks, and did any egress fail
sudo docker logs $(sudo docker ps --format '{{.Names}}' | grep '^livekit-' | head -1) 2>&1 \
  | grep -iE 'webhook|egress_ended'

# can livekit reach the API at all (expect 401 — signature rejected, which proves reachability)
sudo docker exec $(sudo docker ps --format '{{.Names}}' | grep '^livekit-' | head -1) \
  wget -qS -O- --post-data='{}' https://api.<domain>/livekit/webhook 2>&1 | head -3
```
