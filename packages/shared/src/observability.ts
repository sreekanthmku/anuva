/**
 * What is allowed to leave the apps and reach Sentry.
 *
 * This lives in `@anuva/shared` rather than beside each `Sentry.init` for one reason: there are four
 * apps reporting into one Sentry project, and a redaction rule that exists in three of them is a
 * leak in the fourth. It deliberately depends on no Sentry package — the shapes below are
 * structural, so the API (`@sentry/node`) and the three PWAs (`@sentry/react`) can share it.
 *
 * The rules encode a boundary the rest of the codebase already draws by hand:
 *
 *   - `apps/api/src/family/messages.ts` says a family note is "never stored. Not in Postgres, and
 *     not in the logs." A crash report is a log. So HTTP bodies are dropped wholesale — not
 *     filtered, dropped — because the note, her Anu chat turns, and her symptom entries all travel
 *     as request bodies and none of them belong in an error tracker.
 *   - The invite token and a delivered note live in the URL *fragment* precisely so they never
 *     reach a server. Sentry captures URLs, so every URL is stripped of its fragment here.
 *     `/family/join/preview` is the one route that carries the token in the query string instead,
 *     which is why query parameters are redacted by name as well.
 *   - `sendDefaultPii` is off in every init, but a phone number can still arrive inside an `extra`
 *     or a breadcrumb, so keys are redacted recursively wherever they appear.
 *
 * The bias throughout is to lose debugging detail rather than risk leaking health data.
 */

export const REDACTED = '[redacted]';

/** Matched as a substring, case-insensitively: anything credential-shaped, wherever it appears. */
const SENSITIVE_PATTERNS = [
  'password',
  'secret',
  'token',
  'otp',
  'authorization',
  'cookie',
  'session',
  'credential',
  'apikey',
  'api_key',
  'signature',
];

/**
 * Matched as whole keys. These are not credentials — they are her, and the things she wrote. A
 * family note (`text`), an Anu chat turn (`message`, `content`), a Q&A body (`question`, `answer`),
 * and the identifiers that tie any of it back to a person.
 */
const REDACTED_KEYS = new Set(
  [
    'phone',
    'phonenumber',
    'email',
    'name',
    'firstname',
    'lastname',
    'fullname',
    'dateofbirth',
    'dob',
    'address',
    'text',
    'message',
    'content',
    'body',
    'note',
    'question',
    'answer',
    'transcript',
    'familymessage',
    'familyfrom',
    'familygift',
    'fcmtoken',
    'maskedphone',
  ].map((key) => key.toLowerCase()),
);

/**
 * Keys whose *value* is a URL. These are not redacted — a path is what tells you which screen broke
 * — but they are run through `scrubUrl`, because a URL in this codebase can carry an invite token
 * or a delivered note in its fragment.
 *
 * This matters more than it looks. Sentry populates `contexts.request.url` itself, and `url` is not
 * a sensitive key by name, so without this a fragment survives anywhere outside `event.request`.
 */
const URL_KEYS = new Set(['url', 'href', 'to', 'from', 'referer', 'referrer', 'location']);

/** Guards against a cyclic or pathologically deep object turning redaction into a hang. */
const MAX_DEPTH = 6;

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (REDACTED_KEYS.has(lower)) return true;
  return SENSITIVE_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Recursively replaces the value of any sensitive key with `[redacted]`, leaving the key itself in
 * place — knowing that a phone number *was* present is useful; knowing which one is not.
 */
export function redactDeep(value: unknown, depth = 0): unknown {
  if (depth >= MAX_DEPTH || value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      out[key] = REDACTED;
    } else if (URL_KEYS.has(key.toLowerCase()) && typeof item === 'string') {
      out[key] = scrubUrl(item);
    } else {
      out[key] = redactDeep(item, depth + 1);
    }
  }
  return out;
}

/**
 * Drops the fragment and redacts sensitive query parameters, keeping origin and path so an error is
 * still attributable to a screen.
 *
 * Hand-parsed rather than via `URL`, which is in neither this package's `lib` (ES2022, no DOM) nor
 * its dependencies — and widening the lib to get it would put DOM globals in front of the API,
 * which consumes this package too. The shape being parsed is simple enough that the trade is worth
 * it: everything from the first `#` is discarded, then the query is rewritten pair by pair.
 */
export function scrubUrl(url: string): string {
  if (!url) return url;

  const withoutFragment = url.split('#')[0] ?? '';
  const queryStart = withoutFragment.indexOf('?');
  if (queryStart === -1) {
    return withoutFragment;
  }

  const base = withoutFragment.slice(0, queryStart);
  const query = withoutFragment.slice(queryStart + 1);
  if (!query) return base;

  const scrubbed = query
    .split('&')
    .map((pair) => {
      if (!pair) return pair;
      const separator = pair.indexOf('=');
      // A bare flag has no value to redact, only a name — and the name is not the secret.
      if (separator === -1) return pair;

      const key = pair.slice(0, separator);
      let decoded = key;
      try {
        decoded = decodeURIComponent(key);
      } catch {
        // A malformed escape is not a reason to drop the whole URL; match on the raw key instead.
      }

      return isSensitiveKey(decoded) ? `${key}=${REDACTED}` : pair;
    })
    .join('&');

  return `${base}?${scrubbed}`;
}

/** The subset of a Sentry event this module touches. Structural, so neither SDK is a dependency. */
export type ScrubbableEvent = {
  request?: {
    url?: string;
    query_string?: unknown;
    data?: unknown;
    cookies?: unknown;
    headers?: Record<string, string>;
  };
  user?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  breadcrumbs?: ScrubbableBreadcrumb[];
  [key: string]: unknown;
};

export type ScrubbableBreadcrumb = {
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

/**
 * A breadcrumb is the riskiest thing Sentry collects by default: `console` breadcrumbs capture
 * whatever was logged, and `fetch` breadcrumbs capture the URL. Console breadcrumbs are dropped
 * entirely rather than filtered — there is no way to know what a future `console.log` will contain,
 * and this codebase logs objects freely in development.
 */
export function scrubBreadcrumb<T extends object>(input: T): T | null {
  const breadcrumb = input as ScrubbableBreadcrumb;

  if (breadcrumb.category === 'console') {
    return null;
  }

  if (!breadcrumb.data) {
    return input;
  }

  // `redactDeep` handles the url-shaped keys (`url`, `to`, `from`) itself, so a navigation
  // breadcrumb's fragment is stripped here without this function knowing the field names.
  const data = redactDeep(breadcrumb.data) as Record<string, unknown>;

  return { ...input, data };
}

/**
 * The single `beforeSend` shared by all four apps. Returns the event to send, always — nothing here
 * decides *whether* to report a crash, only what the report is allowed to carry.
 */
export function scrubEvent<T extends object>(input: T): T {
  // Aliased rather than parameterised on `ScrubbableEvent`: an SDK's `Event` has no string index
  // signature, so requiring one here would force a cast at all four call sites — the places least
  // worth adding friction to. Mutating through the alias mutates the caller's object.
  const event = input as ScrubbableEvent;

  if (event.request) {
    const request = { ...event.request };

    // Bodies are never sent. See the module comment: this is the rule the family module states
    // about its own logs, applied to crash reports.
    delete request.data;
    delete request.cookies;

    if (typeof request.url === 'string') {
      request.url = scrubUrl(request.url);
    }
    if (typeof request.query_string === 'string') {
      request.query_string = scrubUrl(`/?${request.query_string}`).replace(/^\/\?/, '');
    } else if (request.query_string) {
      request.query_string = redactDeep(request.query_string);
    }
    if (request.headers) {
      request.headers = redactDeep(request.headers) as Record<string, string>;
    }

    event.request = request;
  }

  // An id is enough to tell "one user, forty times" from "forty users, once". Everything else about
  // a person is noise with a downside.
  if (event.user) {
    const id = event.user.id;
    event.user = id === undefined ? {} : { id };
  }

  if (event.extra) {
    event.extra = redactDeep(event.extra) as Record<string, unknown>;
  }
  if (event.contexts) {
    event.contexts = redactDeep(event.contexts) as Record<string, unknown>;
  }
  if (event.tags) {
    event.tags = redactDeep(event.tags) as Record<string, unknown>;
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((crumb): crumb is ScrubbableBreadcrumb => crumb !== null);
  }

  return input;
}

/**
 * Sample rates, in one place so the four apps cannot drift.
 *
 * Traces at 100% in development and 10% in production: a trace is emitted per page load and per API
 * call, and this is a subscription app on a free-tier-shaped budget. Replays only ever run masked
 * (see each app's init), and the session rate stays low because the error rate is what matters —
 * `onError` at 100% is what actually gets a bug reproduced.
 */
export function sentrySampleRates(isProduction: boolean) {
  return {
    tracesSampleRate: isProduction ? 0.1 : 1,
    replaysSessionSampleRate: isProduction ? 0.05 : 0,
    replaysOnErrorSampleRate: 1,
  };
}
