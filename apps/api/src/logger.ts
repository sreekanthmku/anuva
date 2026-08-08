// Structured logging for the API.
//
// Output goes to stdout only — Coolify reads the container's stdout, so anything written
// elsewhere is invisible in the Logs tab.
//
// Format is human-readable (pino-pretty) by default because the only log reader today is
// Coolify's plain `docker logs` tail. Set LOG_FORMAT=json once logs ship to an aggregator.
// pino-pretty runs as a synchronous stream rather than a worker transport so nothing is lost
// when the process exits on a startup failure.

import crypto from 'node:crypto';
import pino from 'pino';
// Named, not default: pino-http is CJS with an ESM-shaped .d.ts, so under NodeNext a default
// import resolves to the module namespace and is not callable.
import { pinoHttp } from 'pino-http';
import pretty from 'pino-pretty';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RequestHandler } from 'express';

const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';
const USE_JSON = process.env.LOG_FORMAT === 'json';

// Cookies (patient and doctor sessions alike) and the admin token are bearer-equivalent: logging
// any of them hands over the account. Request bodies are never logged at all — they carry symptom
// and cycle data, and on the doctor login route they carry a password.
const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-admin-token"]',
  'res.headers["set-cookie"]',
  'headers.cookie',
  'headers.authorization',
  'headers["x-admin-token"]',
];

const stream = USE_JSON
  ? pino.destination({ fd: 1, sync: false })
  : pretty({
      destination: 1,
      sync: false,
      colorize: process.stdout.isTTY === true,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
      // req/res/responseTime are folded into the message line by customSuccessMessage below,
      // and reqId/userId into messageFormat; without this they print again as a JSON block
      // under every entry.
      ignore: 'pid,hostname,req,res,responseTime,reqId,userId',
      messageFormat: '{if reqId}{reqId} {end}{if userId}user={userId} {end}{msg}',
    });

// Trimmed down from pino-http's defaults, which dump every request and response header on every
// line. Must be handed to pinoHttp() as well as pino(): pino-http installs its own req/res
// serializers on the child logger it builds, which would otherwise win.
const SERIALIZERS = {
  req: (req: IncomingMessage & { id?: string; originalUrl?: string }) => ({
    id: req.id,
    method: req.method,
    url: req.originalUrl ?? req.url,
  }),
  res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
};

export const logger = pino(
  {
    level: LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    serializers: SERIALIZERS,
  },
  stream,
);

function describe(req: IncomingMessage, res: ServerResponse, responseTime?: number): string {
  const url = (req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url;
  const ms = typeof responseTime === 'number' ? ` ${Math.round(responseTime)}ms` : '';
  // The id is in the message rather than a field: pino-http builds the response logger before
  // any middleware of ours can bind to it, so a child binding would not reach this line.
  return `${req.id} ${req.method} ${url} ${res.statusCode}${ms}`;
}

const requestLogger = pinoHttp({
  logger,
  serializers: SERIALIZERS,
  genReqId: (req, res) => {
    // An inbound id is honoured so a trace survives across services, but only in a shape that
    // cannot forge log lines: a newline in the pretty output would print as a fake entry, and
    // res.setHeader() throws outright on one.
    const inbound = req.headers['x-request-id'];
    const candidate = Array.isArray(inbound) ? inbound[0] : inbound;
    const id =
      candidate && /^[A-Za-z0-9_-]{1,64}$/.test(candidate)
        ? candidate
        : crypto.randomUUID().slice(0, 8);
    res.setHeader('x-request-id', id);
    return id;
  },
  // The Docker HEALTHCHECK hits /health every 30s. Logging it buries everything else.
  autoLogging: {
    ignore: (req) => req.url === '/health',
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) {
      return 'error';
    }
    if (res.statusCode >= 400) {
      return 'warn';
    }
    return 'info';
  },
  customSuccessMessage: (req, res, responseTime) => describe(req, res, responseTime),
  customErrorMessage: (req, res, err) => `${describe(req, res)} — ${err.message}`,
});

/**
 * Mount once, ahead of every route. Gives each request a `req.log` whose lines all carry the
 * request id, so a handler's own logging lines up with the completion line under concurrency.
 */
export const httpLogger: RequestHandler[] = [
  requestLogger,
  (req, _res, next) => {
    req.log = req.log.child({ reqId: req.id });
    next();
  },
];
