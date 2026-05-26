# Push notifications (FCM) — setup guide

Anuva registers **FCM device tokens** only. Sending notifications is a separate step (Firebase Console test message, or API + service account later).

## 1. Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com/) → your project (or create one).
2. **Project settings** → **General** → add a **Web** app if you have not already.
3. Copy the web app config (`apiKey`, `authDomain`, `projectId`, `messagingSenderId`, `appId`).
4. **Project settings** → **Cloud Messaging**:
   - Under **Web configuration**, generate or copy the **Web Push certificates** key pair → this is your **VAPID key** (`VITE_FIREBASE_VAPID_KEY`).
5. Enable **Cloud Messaging API** in [Google Cloud Console](https://console.cloud.google.com/apis/library/fcm.googleapis.com) for the same project.

## 2. Environment variables

Add to the repo root `.env` (see `.env.example`):

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
```

Restart `pnpm dev` after changing env vars. Vite writes `apps/pwa/public/firebase-config.js` for the service worker from these values.

## 3. Database migration

```bash
pnpm db:migrate
# or: pnpm db:push
```

Creates the `FcmToken` table.

## 4. Run the stack

```bash
pnpm dev
```

1. Sign in (OTP).
2. Open **Home** (`/home`).
3. Accept the notification prompt → browser permission → token saved via `POST /api/register-fcm`.

Verify in Postgres:

```sql
SELECT token, platform, status, "deviceId", "updatedAt" FROM "FcmToken";
```

## 5. Test a real notification

### Option A — Firebase Console (quickest)

1. Firebase → **Engage** → **Messaging** → **Create campaign** → **Firebase Notification messages**.
2. Send test message to a **single device** using the FCM token from the database (or from DevTools → Application → Local Storage → `anuva-fcm-token`).

### Option B — HTTP v1 API (for automation later)

1. **Project settings** → **Service accounts** → **Generate new private key** (JSON).
2. Store as `FIREBASE_SERVICE_ACCOUNT_JSON` (not wired in Anuva API yet).
3. Use [FCM HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api) with OAuth2 from that JSON.

Example payload shape:

```json
{
  "message": {
    "token": "<FCM_TOKEN_FROM_DB>",
    "notification": {
      "title": "Time to log symptoms",
      "body": "A quick check-in helps your weekly report."
    },
    "data": {
      "url": "/track"
    }
  }
}
```

Background messages use `data.url` for `notificationclick` in `firebase-messaging-sw.js`.

## Architecture (what is implemented)

| Layer | Responsibility |
|--------|----------------|
| **PWA home** | Permission dialog only on `/home` |
| **`firebase.ts`** | `getToken`, register with API, foreground `onMessage` |
| **`firebase-messaging-sw.js`** | Background display + click → open `data.url` |
| **Workbox SW** | Imports FCM handlers (single SW, no conflict) |
| **API** | `POST /register-fcm`, `POST /unregister-fcm`, logout deactivates token |
| **DB** | `FcmToken` per user / device |

## Troubleshooting

| Issue | Check |
|--------|--------|
| Agreed but no popup again | **Normal.** Browser only asks once. Permission is already `granted`. Use **Home → Retry registration** banner or **Profile → Notifications**. You do **not** need to delete anything in Firebase Console. |
| Agreed but not in database | Server error on `POST /api/register-fcm` (401, 500). Stay logged in, open Home, tap **Retry registration**. Check API logs. |
| No prompt on home | Logged in? Permission already granted/denied? Cleared `anuva-notification-prompt-dismissed` in localStorage? |
| `getToken` fails | HTTPS or `localhost`; VAPID key matches Firebase Console; env vars set; hard refresh after env change |
| Token not in DB | Network tab → `POST /api/register-fcm` 200; session cookie present |
| No background notification | App in background; payload has `notification` field; SW updated (unregister old SW in DevTools → Application) |
| iOS Safari | Web push on iOS requires Add to Home Screen (installed PWA) and iOS 16.4+ |

## Broadcast test endpoint

`GET /push/hello-world?secret=<PUSH_BROADCAST_SECRET>`

Sends **Hello world** to every `FcmToken` with `status = ACTIVE`.

Requires in `.env`:

- `PUSH_BROADCAST_SECRET` — query param must match
- `FIREBASE_SERVICE_ACCOUNT_PATH` — path to downloaded service account JSON (recommended), e.g. `firebase-service-account.json` in repo root  
  **or** `FIREBASE_SERVICE_ACCOUNT_JSON` — same JSON pasted as one line

Example (API on port 3001):

```bash
curl "http://localhost:3001/push/hello-world?secret=anuva-dev-broadcast"
```

Response:

```json
{
  "ok": true,
  "title": "Anuva",
  "body": "Hello world",
  "targeted": 1,
  "successCount": 1,
  "failureCount": 0
}
```

## Not implemented yet

- Topic subscriptions
- Admin panel UI
- Scheduled / queued sends
