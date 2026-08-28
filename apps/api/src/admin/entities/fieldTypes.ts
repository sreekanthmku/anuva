import type { z } from 'zod';

export type AdminFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'date'
  | 'string[]'
  | 'number[]'
  | 'json';

export type AdminFieldRelation = {
  resource: string;
  /** Prefer these fields when building option labels */
  labelFields: string[];
};

export type AdminField = {
  name: string;
  label: string;
  type: AdminFieldType;
  required: boolean;
  nullable: boolean;
  enumValues?: string[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  /** Longer text fields (body, prompt, summary, …) */
  multiline?: boolean;
  relation?: AdminFieldRelation;
};

type ZodDef = {
  typeName?: string;
  description?: string;
  innerType?: z.ZodTypeAny;
  type?: z.ZodTypeAny;
  schema?: z.ZodTypeAny;
  values?: string[] | Record<string, string | number>;
  checks?: Array<{ kind: string; value?: number; regex?: RegExp }>;
  options?: z.ZodTypeAny[];
};

function asDef(schema: z.ZodTypeAny): ZodDef {
  return (schema as unknown as { _def: ZodDef })._def ?? {};
}

function humanLabel(key: string): string {
  return key
    .replace(/Id$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

const RELATION_BY_FIELD: Record<string, AdminFieldRelation> = {
  userId: { resource: 'users', labelFields: ['name', 'phone', 'email'] },
  specialistId: { resource: 'specialists', labelFields: ['name', 'key'] },
  uploadedById: { resource: 'specialists', labelFields: ['name', 'key'] },
  carePathId: { resource: 'care-paths', labelFields: ['label', 'key'] },
  symptomId: { resource: 'symptoms', labelFields: ['label', 'key'] },
  questionId: { resource: 'assessment-questions', labelFields: ['key', 'prompt'] },
  assessmentId: { resource: 'assessments', labelFields: ['status', 'score'] },
  consultationId: { resource: 'consultations', labelFields: ['scheduledAt', 'status'] },
  reportId: { resource: 'weekly-reports', labelFields: ['weekStart', 'cohort'] },
  logId: { resource: 'symptom-logs', labelFields: ['date', 'intensity'] },
  threadId: { resource: 'chat-threads', labelFields: ['createdAt'] },
};

const MULTILINE_FIELDS = new Set([
  'body',
  'prompt',
  'summary',
  'description',
  'excerpt',
  'note',
  'content',
  'response',
  'errorMessage',
]);

function unwrap(
  schema: z.ZodTypeAny,
): { schema: z.ZodTypeAny; optional: boolean; nullable: boolean } {
  let current = schema;
  let optional = false;
  let nullable = false;

  for (let i = 0; i < 8; i++) {
    const def = asDef(current);
    if (def.typeName === 'ZodOptional' && def.innerType) {
      optional = true;
      current = def.innerType;
      continue;
    }
    if (def.typeName === 'ZodNullable' && def.innerType) {
      nullable = true;
      current = def.innerType;
      continue;
    }
    if (def.typeName === 'ZodDefault' && def.innerType) {
      optional = true;
      current = def.innerType;
      continue;
    }
    if (def.typeName === 'ZodEffects' && def.schema) {
      current = def.schema;
      continue;
    }
    break;
  }

  return { schema: current, optional, nullable };
}

function isDateSchema(schema: z.ZodTypeAny): boolean {
  const def = asDef(schema);
  if (def.description === 'admin:date') return true;
  if (def.typeName === 'ZodUnion' && Array.isArray(def.options)) {
    // dateString = datetime | YYYY-MM-DD regex
    return def.options.every((opt) => asDef(opt).typeName === 'ZodString');
  }
  if (def.typeName === 'ZodString' && Array.isArray(def.checks)) {
    return def.checks.some((c) => c.kind === 'datetime' || (c.kind === 'regex' && String(c.regex).includes('\\d{4}')));
  }
  return false;
}

function readStringChecks(schema: z.ZodTypeAny): { minLength?: number; maxLength?: number } {
  const def = asDef(schema);
  const out: { minLength?: number; maxLength?: number } = {};
  for (const check of def.checks ?? []) {
    if (check.kind === 'min' && typeof check.value === 'number') out.minLength = check.value;
    if (check.kind === 'max' && typeof check.value === 'number') out.maxLength = check.value;
  }
  return out;
}

function readNumberChecks(schema: z.ZodTypeAny): { min?: number; max?: number } {
  const def = asDef(schema);
  const out: { min?: number; max?: number } = {};
  for (const check of def.checks ?? []) {
    if (check.kind === 'min' && typeof check.value === 'number') out.min = check.value;
    if (check.kind === 'max' && typeof check.value === 'number') out.max = check.value;
  }
  return out;
}

function mapInnerType(
  name: string,
  schema: z.ZodTypeAny,
  required: boolean,
  nullable: boolean,
): AdminField | null {
  const def = asDef(schema);

  if (isDateSchema(schema)) {
    return {
      name,
      label: humanLabel(name),
      type: 'date',
      required,
      nullable,
    };
  }

  if (def.typeName === 'ZodEnum' && Array.isArray(def.values)) {
    return {
      name,
      label: humanLabel(name),
      type: 'enum',
      required,
      nullable,
      enumValues: def.values as string[],
    };
  }

  if (def.typeName === 'ZodNativeEnum' && def.values && typeof def.values === 'object') {
    const vals = Object.values(def.values).filter((v): v is string => typeof v === 'string');
    return {
      name,
      label: humanLabel(name),
      type: 'enum',
      required,
      nullable,
      enumValues: vals,
    };
  }

  if (def.typeName === 'ZodBoolean') {
    return { name, label: humanLabel(name), type: 'boolean', required, nullable };
  }

  if (def.typeName === 'ZodNumber') {
    return {
      name,
      label: humanLabel(name),
      type: 'number',
      required,
      nullable,
      ...readNumberChecks(schema),
    };
  }

  if (def.typeName === 'ZodString') {
    const field: AdminField = {
      name,
      label: humanLabel(name),
      type: 'string',
      required,
      nullable,
      multiline: MULTILINE_FIELDS.has(name),
      ...readStringChecks(schema),
    };
    if (RELATION_BY_FIELD[name]) {
      field.relation = RELATION_BY_FIELD[name];
      field.label = humanLabel(name);
    }
    return field;
  }

  if (def.typeName === 'ZodArray' && def.type) {
    const inner = unwrap(def.type).schema;
    const innerDef = asDef(inner);
    if (innerDef.typeName === 'ZodString') {
      return { name, label: humanLabel(name), type: 'string[]', required, nullable };
    }
    if (innerDef.typeName === 'ZodNumber') {
      return { name, label: humanLabel(name), type: 'number[]', required, nullable };
    }
    return { name, label: humanLabel(name), type: 'json', required, nullable };
  }

  if (def.typeName === 'ZodUnion' && Array.isArray(def.options)) {
    // nullable unions already unwrapped; leftover unions → json
    return { name, label: humanLabel(name), type: 'json', required, nullable };
  }

  return { name, label: humanLabel(name), type: 'json', required, nullable };
}

/**
 * Derive admin form fields from a Zod object schema.
 * Returns null when the schema is not a structured object (e.g. loose record).
 */
export function zodToFields(schema: z.ZodTypeAny): AdminField[] | null {
  const unwrapped = unwrap(schema).schema;
  const def = asDef(unwrapped);

  if (def.typeName !== 'ZodObject') return null;

  const shape = (unwrapped as z.ZodObject<z.ZodRawShape>).shape;
  const fields: AdminField[] = [];

  for (const [name, fieldSchema] of Object.entries(shape)) {
    const { schema: inner, optional, nullable } = unwrap(fieldSchema as z.ZodTypeAny);
    const mapped = mapInnerType(name, inner, !optional, nullable);
    if (mapped) fields.push(mapped);
  }

  return fields.length ? fields : null;
}

/** Resources staff should not create from the generic form (system / telemetry). */
export const ADMIN_NO_CREATE = new Set([
  'sessions',
  'otp-challenges',
  'fcm-tokens',
  'chat-threads',
  'chat-messages',
  'anu-chat-turns',
  'consultation-recordings',
  'consultation-call-consents',
  'consultation-calls',
  'nudge-send-logs',
  'anu-home-card-logs',
  'l3-trigger-logs',
  'nudge-daily-states',
  'specialist-sessions',
  'support-tickets',
]);
