import { z } from 'zod';
import type { AdminEntityDefinition } from './types.js';
import { ADMIN_NO_CREATE, zodToFields } from './fieldTypes.js';
import { dateString, looseObjectSchema, loosePartialSchema, objectSchema } from './schemaHelpers.js';

const RO = ['createdAt', 'updatedAt'] as const;

/**
 * Portal username. Write-only sibling `password` is hashed in EntityService.prepareWrite — the
 * plaintext never reaches Prisma and `passwordHash` is never returned.
 */
const SPECIALIST_USERNAME = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-zA-Z0-9._-]+$/, 'Use letters, numbers, dot, underscore or hyphen only.');

const USER_LIST = { select: { name: true, phone: true, email: true } } as const;
const SPECIALIST_LIST = { select: { name: true, key: true } } as const;
const SYMPTOM_LIST = { select: { label: true, key: true, category: true } } as const;
const CARE_PATH_LIST = { select: { label: true, key: true } } as const;

/** Infer Prisma includes from FK fields mentioned on the entity. */
function inferListInclude(
  searchFields: string[],
  filterFields: string[],
  explicit?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (explicit) return explicit;
  const fields = new Set([...searchFields, ...filterFields]);
  const include: Record<string, unknown> = {};
  if (fields.has('userId')) include.user = USER_LIST;
  if (fields.has('specialistId')) include.specialist = SPECIALIST_LIST;
  if (fields.has('uploadedById')) include.uploadedBy = SPECIALIST_LIST;
  if (fields.has('symptomId')) include.symptom = SYMPTOM_LIST;
  if (fields.has('carePathId')) include.carePath = CARE_PATH_LIST;
  return Object.keys(include).length ? include : undefined;
}

function def(
  partial: Omit<AdminEntityDefinition, 'createSchema' | 'updateSchema' | 'readonlyFields' | 'idField'> & {
    createSchema?: AdminEntityDefinition['createSchema'];
    updateSchema?: AdminEntityDefinition['updateSchema'];
    readonlyFields?: string[];
    idField?: string;
  },
): AdminEntityDefinition {
  const { createSchema, updateSchema, readonlyFields, idField, listInclude, ...rest } = partial;
  return {
    idField: idField ?? 'id',
    readonlyFields: readonlyFields ?? [...RO],
    createSchema: createSchema ?? looseObjectSchema,
    updateSchema: updateSchema ?? loosePartialSchema,
    ...rest,
    listInclude: inferListInclude(rest.searchFields, rest.filterFields, listInclude),
  };
}

/**
 * Complete registry of every Prisma model exposed through /admin.
 * Keep resource names stable — they are the public API surface.
 */
export const ADMIN_ENTITIES: AdminEntityDefinition[] = [
  // ── Auth & user ──────────────────────────────────────────
  def({
    resource: 'users',
    label: 'Users',
    prismaModel: 'user',
    group: 'Auth & Users',
    searchFields: ['phone', 'name', 'email', 'id'],
    filterFields: ['onboardingCompleted', 'dieticianPlanAssigned', 'familyFeatureOptOut'],
    sortableFields: ['createdAt', 'updatedAt', 'phone', 'name'],
    defaultSort: 'createdAt',
    listFields: ['name', 'phone', 'email', 'onboardingCompleted', 'createdAt'],
    createSchema: objectSchema({
      phone: z.string().min(5).max(32),
      name: z.string().min(1).max(200).nullable().optional(),
      email: z.string().email().nullable().optional(),
      phoneVerifiedAt: dateString.nullable().optional(),
      onboardingCompleted: z.boolean().optional(),
      dieticianPlanAssigned: z.boolean().optional(),
      familyFeatureOptOut: z.boolean().optional(),
    }),
    updateSchema: objectSchema(
      {
        phone: z.string().min(5).max(32),
        name: z.string().min(1).max(200).nullable(),
        email: z.string().email().nullable(),
        phoneVerifiedAt: dateString.nullable(),
        onboardingCompleted: z.boolean(),
        dieticianPlanAssigned: z.boolean(),
        familyFeatureOptOut: z.boolean(),
      },
      true,
    ),
  }),
  def({
    resource: 'sessions',
    label: 'Sessions',
    prismaModel: 'session',
    group: 'Auth & Users',
    searchFields: ['id', 'userId'],
    filterFields: ['userId'],
    sortableFields: ['createdAt', 'expiresAt', 'lastSeenAt'],
    defaultSort: 'createdAt',
    listFields: ['user', 'lastSeenAt', 'expiresAt', 'createdAt'],
    readonlyFields: [...RO, 'tokenHash'],
    createSchema: objectSchema({
      tokenHash: z.string().min(16),
      userId: z.string().min(1),
      expiresAt: dateString,
      lastSeenAt: dateString.optional(),
    }),
    updateSchema: objectSchema(
      {
        expiresAt: dateString,
        lastSeenAt: dateString,
      },
      true,
    ),
  }),
  /**
   * Doctor portal sessions. Read and delete are the point of exposing them — deleting a row signs
   * that device out — so there is no create path and nothing here is editable.
   */
  def({
    resource: 'specialist-sessions',
    label: 'Specialist Sessions',
    prismaModel: 'specialistSession',
    group: 'Bookings',
    searchFields: ['id', 'specialistId'],
    filterFields: ['specialistId'],
    sortableFields: ['createdAt', 'expiresAt', 'lastSeenAt'],
    defaultSort: 'createdAt',
    listFields: ['specialist', 'lastSeenAt', 'expiresAt', 'createdAt'],
    readonlyFields: [...RO, 'tokenHash'],
    createSchema: objectSchema({}),
    updateSchema: objectSchema({ expiresAt: dateString }, true),
  }),
  def({
    resource: 'otp-challenges',
    label: 'OTP Challenges',
    prismaModel: 'otpChallenge',
    group: 'Auth & Users',
    searchFields: ['phone', 'id', 'userId'],
    filterFields: ['status', 'purpose', 'phone', 'userId'],
    sortableFields: ['createdAt', 'expiresAt', 'updatedAt'],
    defaultSort: 'createdAt',
    listFields: ['phone', 'purpose', 'status', 'attemptCount', 'expiresAt', 'createdAt'],
    createSchema: objectSchema({
      phone: z.string().min(5),
      userId: z.string().nullable().optional(),
      purpose: z.enum(['login', 'signup']),
      provider: z.string().min(1),
      providerSessionId: z.string().min(1),
      status: z.enum(['pending', 'verified', 'expired', 'failed']).optional(),
      attemptCount: z.number().int().min(0).optional(),
      expiresAt: dateString,
      verifiedAt: dateString.nullable().optional(),
    }),
    updateSchema: objectSchema(
      {
        status: z.enum(['pending', 'verified', 'expired', 'failed']),
        attemptCount: z.number().int().min(0),
        expiresAt: dateString,
        verifiedAt: dateString.nullable(),
        userId: z.string().nullable(),
      },
      true,
    ),
  }),
  def({
    resource: 'fcm-tokens',
    label: 'FCM Tokens',
    prismaModel: 'fcmToken',
    group: 'Auth & Users',
    searchFields: ['token', 'userId', 'deviceId', 'id'],
    filterFields: ['userId', 'platform', 'status'],
    sortableFields: ['createdAt', 'updatedAt'],
    defaultSort: 'createdAt',
    listFields: ['user', 'platform', 'status', 'deviceId', 'updatedAt'],
    activeField: undefined,
    actions: [
      { key: 'activate', label: 'Activate', description: 'Set status to ACTIVE' },
      { key: 'deactivate', label: 'Deactivate', description: 'Set status to INACTIVE' },
    ],
    createSchema: objectSchema({
      userId: z.string().min(1),
      token: z.string().min(10),
      platform: z.enum(['WEB', 'ANDROID', 'IOS']),
      status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      deviceId: z.string().nullable().optional(),
    }),
    updateSchema: objectSchema(
      {
        token: z.string().min(10),
        platform: z.enum(['WEB', 'ANDROID', 'IOS']),
        status: z.enum(['ACTIVE', 'INACTIVE']),
        deviceId: z.string().nullable(),
      },
      true,
    ),
  }),
  def({
    resource: 'health-profiles',
    label: 'Health Profiles',
    prismaModel: 'healthProfile',
    group: 'Auth & Users',
    searchFields: ['userId', 'id'],
    filterFields: ['userId', 'menopauseStage'],
    sortableFields: ['updatedAt'],
    defaultSort: 'updatedAt',
    listFields: ['user', 'menopauseStage', 'dateOfBirth', 'cycleStartDate', 'updatedAt'],
    createSchema: objectSchema({
      userId: z.string().min(1),
      dateOfBirth: dateString.nullable().optional(),
      menopauseStage: z
        .enum(['premenopause', 'perimenopause', 'menopause', 'postmenopause'])
        .nullable()
        .optional(),
      cycleStartDate: dateString.nullable().optional(),
    }),
    updateSchema: objectSchema(
      {
        dateOfBirth: dateString.nullable(),
        menopauseStage: z
          .enum(['premenopause', 'perimenopause', 'menopause', 'postmenopause'])
          .nullable(),
        cycleStartDate: dateString.nullable(),
      },
      true,
    ),
  }),

  // ── Assessments ──────────────────────────────────────────
  def({
    resource: 'assessment-questions',
    label: 'Assessment Questions',
    prismaModel: 'assessmentQuestion',
    group: 'Assessments',
    searchFields: ['key', 'prompt', 'id'],
    filterFields: [],
    sortableFields: ['order', 'key'],
    defaultSort: 'order',
    listFields: ['key', 'prompt', 'order'],
    createSchema: objectSchema({
      key: z.string().min(1),
      prompt: z.string().min(1),
      order: z.number().int(),
    }),
    updateSchema: objectSchema(
      {
        key: z.string().min(1),
        prompt: z.string().min(1),
        order: z.number().int(),
      },
      true,
    ),
  }),
  def({
    resource: 'assessment-options',
    label: 'Assessment Options',
    prismaModel: 'assessmentOption',
    group: 'Assessments',
    searchFields: ['label', 'questionId', 'id'],
    filterFields: ['questionId'],
    sortableFields: ['order', 'score'],
    defaultSort: 'order',
    listFields: ['question', 'label', 'score', 'order'],
    listInclude: {
      question: { select: { key: true, prompt: true } },
    },
    createSchema: objectSchema({
      questionId: z.string().min(1),
      label: z.string().min(1),
      score: z.number().int(),
      order: z.number().int(),
    }),
    updateSchema: objectSchema(
      {
        label: z.string().min(1),
        score: z.number().int(),
        order: z.number().int(),
      },
      true,
    ),
  }),
  def({
    resource: 'assessments',
    label: 'Assessments',
    prismaModel: 'assessment',
    group: 'Assessments',
    searchFields: ['userId', 'id'],
    filterFields: ['userId', 'status'],
    sortableFields: ['completedAt', 'score'],
    defaultSort: 'completedAt',
    listFields: ['user', 'score', 'status', 'threshold', 'completedAt'],
    createSchema: objectSchema({
      userId: z.string().min(1),
      score: z.number().int(),
      threshold: z.number().int().optional(),
      status: z.enum(['in_control', 'further_assessment']),
      completedAt: dateString.optional(),
    }),
    updateSchema: objectSchema(
      {
        score: z.number().int(),
        threshold: z.number().int(),
        status: z.enum(['in_control', 'further_assessment']),
        completedAt: dateString,
      },
      true,
    ),
  }),
  def({
    resource: 'assessment-answers',
    label: 'Assessment Answers',
    prismaModel: 'assessmentAnswer',
    group: 'Assessments',
    searchFields: ['assessmentId', 'questionId', 'id'],
    filterFields: ['assessmentId', 'questionId'],
    sortableFields: ['score', 'optionIndex'],
    defaultSort: 'score',
    listFields: ['assessment', 'question', 'optionLabel', 'score', 'optionIndex'],
    listInclude: {
      assessment: { select: { score: true, user: USER_LIST } },
      question: { select: { key: true, prompt: true } },
    },
    createSchema: objectSchema({
      assessmentId: z.string().min(1),
      questionId: z.string().min(1),
      optionIndex: z.number().int(),
      optionLabel: z.string().min(1),
      score: z.number().int(),
    }),
    updateSchema: objectSchema(
      {
        optionIndex: z.number().int(),
        optionLabel: z.string().min(1),
        score: z.number().int(),
      },
      true,
    ),
  }),
  def({
    resource: 'detailed-assessments',
    label: 'Detailed Assessments',
    prismaModel: 'detailedAssessment',
    group: 'Assessments',
    searchFields: ['userId', 'id'],
    filterFields: ['userId', 'status'],
    sortableFields: ['startedAt', 'completedAt', 'updatedAt'],
    defaultSort: 'updatedAt',
    listFields: ['user', 'status', 'startedAt', 'completedAt', 'updatedAt'],
    createSchema: objectSchema({
      userId: z.string().min(1),
      status: z.enum(['in_progress', 'completed']).optional(),
      startedAt: dateString.optional(),
      completedAt: dateString.nullable().optional(),
    }),
    updateSchema: objectSchema(
      {
        status: z.enum(['in_progress', 'completed']),
        completedAt: dateString.nullable(),
      },
      true,
    ),
  }),
  def({
    resource: 'detailed-answers',
    label: 'Detailed Answers',
    prismaModel: 'detailedAnswer',
    group: 'Assessments',
    searchFields: ['assessmentId', 'questionKey', 'id'],
    filterFields: ['assessmentId', 'questionKey'],
    sortableFields: ['questionKey'],
    defaultSort: 'questionKey',
    listFields: ['questionKey', 'value', 'assessment'],
    listInclude: {
      assessment: { select: { status: true, user: USER_LIST } },
    },
    createSchema: objectSchema({
      assessmentId: z.string().min(1),
      questionKey: z.string().min(1),
      value: z.string(),
    }),
    updateSchema: objectSchema({ value: z.string() }, true),
  }),

  // ── Subscription & dashboard ─────────────────────────────
  def({
    resource: 'subscriptions',
    label: 'Subscriptions',
    prismaModel: 'subscription',
    group: 'Subscriptions',
    searchFields: ['userId', 'id'],
    filterFields: ['userId', 'plan', 'status'],
    sortableFields: ['startedAt', 'renewsAt', 'trialEndsAt'],
    defaultSort: 'startedAt',
    listFields: ['user', 'plan', 'status', 'startedAt', 'renewsAt', 'trialEndsAt'],
    createSchema: objectSchema({
      userId: z.string().min(1),
      plan: z.enum(['monthly', 'annual']).nullable().optional(),
      status: z.enum(['trialing', 'active', 'past_due', 'canceled']).optional(),
      startedAt: dateString.optional(),
      trialEndsAt: dateString.nullable().optional(),
      renewsAt: dateString.nullable().optional(),
    }),
    updateSchema: objectSchema(
      {
        plan: z.enum(['monthly', 'annual']).nullable(),
        status: z.enum(['trialing', 'active', 'past_due', 'canceled']),
        trialEndsAt: dateString.nullable(),
        renewsAt: dateString.nullable(),
      },
      true,
    ),
  }),
  def({
    resource: 'wellness-snapshots',
    label: 'Wellness Snapshots',
    prismaModel: 'wellnessSnapshot',
    group: 'Dashboard',
    searchFields: ['userId', 'id'],
    filterFields: ['userId'],
    sortableFields: ['date', 'balanceScore'],
    defaultSort: 'date',
    listFields: ['user', 'date', 'balanceScore', 'summary'],
    createSchema: objectSchema({
      userId: z.string().min(1),
      date: dateString,
      balanceScore: z.number().int(),
      summary: z.string().nullable().optional(),
    }),
    updateSchema: objectSchema(
      {
        date: dateString,
        balanceScore: z.number().int(),
        summary: z.string().nullable(),
      },
      true,
    ),
  }),
  def({
    resource: 'daily-insights',
    label: 'Daily Insights',
    prismaModel: 'dailyInsight',
    group: 'Dashboard',
    searchFields: ['body', 'authorName', 'id'],
    filterFields: [],
    sortableFields: ['date', 'createdAt'],
    defaultSort: 'date',
    createSchema: objectSchema({
      date: dateString,
      body: z.string().min(1),
      authorName: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
    }),
    updateSchema: objectSchema(
      {
        date: dateString,
        body: z.string().min(1),
        authorName: z.string().nullable(),
        source: z.string().nullable(),
      },
      true,
    ),
  }),

  // ── Symptoms ─────────────────────────────────────────────
  def({
    resource: 'symptoms',
    label: 'Symptoms',
    prismaModel: 'symptom',
    group: 'Symptoms',
    searchFields: ['key', 'label', 'id'],
    filterFields: ['category', 'active'],
    sortableFields: ['key', 'label', 'category'],
    defaultSort: 'key',
    listFields: ['label', 'key', 'category', 'active'],
    activeField: 'active',
    actions: [
      { key: 'enable', label: 'Enable' },
      { key: 'disable', label: 'Disable' },
    ],
    createSchema: objectSchema({
      key: z.string().min(1),
      label: z.string().min(1),
      category: z.enum(['vasomotor', 'sleep', 'mood', 'lifestyle']),
      active: z.boolean().optional(),
    }),
    updateSchema: objectSchema(
      {
        key: z.string().min(1),
        label: z.string().min(1),
        category: z.enum(['vasomotor', 'sleep', 'mood', 'lifestyle']),
        active: z.boolean(),
      },
      true,
    ),
  }),
  def({
    resource: 'symptom-logs',
    label: 'Symptom Logs',
    prismaModel: 'symptomLog',
    group: 'Symptoms',
    searchFields: ['userId', 'id'],
    filterFields: ['userId'],
    sortableFields: ['date', 'createdAt', 'intensity'],
    defaultSort: 'date',
    listFields: ['user', 'date', 'intensity', 'note', 'createdAt'],
    createSchema: objectSchema({
      userId: z.string().min(1),
      date: dateString,
      intensity: z.number().int().min(1).max(7),
      note: z.string().nullable().optional(),
    }),
    updateSchema: objectSchema(
      {
        date: dateString,
        intensity: z.number().int().min(1).max(7),
        note: z.string().nullable(),
      },
      true,
    ),
  }),
  def({
    resource: 'symptom-log-entries',
    label: 'Symptom Log Entries',
    prismaModel: 'symptomLogEntry',
    group: 'Symptoms',
    searchFields: ['logId', 'symptomId', 'id'],
    filterFields: ['logId', 'symptomId'],
    sortableFields: ['id'],
    defaultSort: 'id',
    listFields: ['symptom', 'log'],
    listInclude: {
      symptom: SYMPTOM_LIST,
      log: { select: { date: true, user: USER_LIST } },
    },
    createSchema: objectSchema({
      logId: z.string().min(1),
      symptomId: z.string().min(1),
    }),
    updateSchema: objectSchema(
      {
        logId: z.string().min(1),
        symptomId: z.string().min(1),
      },
      true,
    ),
  }),

  // ── Weekly report ────────────────────────────────────────
  def({
    resource: 'weekly-reports',
    label: 'Weekly Reports',
    prismaModel: 'weeklyReport',
    group: 'Reports',
    searchFields: ['userId', 'cohort', 'id'],
    filterFields: ['userId'],
    sortableFields: ['weekStart', 'createdAt'],
    defaultSort: 'weekStart',
    listFields: ['user', 'weekStart', 'weekEnd', 'cohort', 'createdAt'],
    createSchema: objectSchema({
      userId: z.string().min(1),
      weekStart: dateString,
      weekEnd: dateString,
      cohort: z.string().nullable().optional(),
    }),
    updateSchema: objectSchema(
      {
        weekStart: dateString,
        weekEnd: dateString,
        cohort: z.string().nullable(),
      },
      true,
    ),
  }),
  def({
    resource: 'weekly-metrics',
    label: 'Weekly Metrics',
    prismaModel: 'weeklyMetric',
    group: 'Reports',
    searchFields: ['reportId', 'label', 'id'],
    filterFields: ['reportId', 'kind'],
    sortableFields: ['label', 'value'],
    defaultSort: 'label',
    listFields: ['report', 'kind', 'label', 'value', 'unit', 'delta'],
    listInclude: {
      report: { select: { weekStart: true, user: USER_LIST } },
    },
    createSchema: objectSchema({
      reportId: z.string().min(1),
      kind: z.enum(['benchmark', 'stat']),
      label: z.string().min(1),
      value: z.number(),
      unit: z.string().nullable().optional(),
      delta: z.string().nullable().optional(),
      cohortMedup: z.number().nullable().optional(),
      trend: z.array(z.number().int()).optional(),
    }),
    updateSchema: objectSchema(
      {
        kind: z.enum(['benchmark', 'stat']),
        label: z.string().min(1),
        value: z.number(),
        unit: z.string().nullable(),
        delta: z.string().nullable(),
        cohortMedup: z.number().nullable(),
        trend: z.array(z.number().int()),
      },
      true,
    ),
  }),

  // ── Care ─────────────────────────────────────────────────
  def({
    resource: 'care-paths',
    label: 'Care Paths',
    prismaModel: 'carePath',
    group: 'Care',
    searchFields: ['key', 'label', 'id'],
    filterFields: [],
    sortableFields: ['key', 'label'],
    defaultSort: 'key',
    listFields: ['label', 'key', 'tag', 'description'],
    createSchema: objectSchema({
      key: z.string().min(1),
      label: z.string().min(1),
      tag: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
    }),
    updateSchema: objectSchema(
      {
        key: z.string().min(1),
        label: z.string().min(1),
        tag: z.string().nullable(),
        description: z.string().nullable(),
      },
      true,
    ),
  }),
  def({
    resource: 'user-care-paths',
    label: 'User Care Paths',
    prismaModel: 'userCarePath',
    group: 'Care',
    searchFields: ['userId', 'carePathId', 'id'],
    filterFields: ['userId', 'carePathId', 'status'],
    sortableFields: ['createdAt'],
    defaultSort: 'createdAt',
    listFields: ['user', 'carePath', 'status', 'focusTags', 'createdAt'],
    createSchema: objectSchema({
      userId: z.string().min(1),
      carePathId: z.string().min(1),
      status: z.enum(['recommended', 'selected', 'active', 'completed']).optional(),
      focusTags: z.array(z.string()).optional(),
    }),
    updateSchema: objectSchema(
      {
        status: z.enum(['recommended', 'selected', 'active', 'completed']),
        focusTags: z.array(z.string()),
      },
      true,
    ),
  }),
  def({
    resource: 'care-journey-stages',
    label: 'Care Journey Stages',
    prismaModel: 'careJourneyStage',
    group: 'Care',
    searchFields: ['userId', 'stage', 'id'],
    filterFields: ['userId', 'status'],
    sortableFields: ['order', 'stage'],
    defaultSort: 'order',
    listFields: ['user', 'stage', 'status', 'order'],
    createSchema: objectSchema({
      userId: z.string().min(1),
      stage: z.string().min(1),
      status: z.enum(['done', 'active', 'upcoming']).optional(),
      order: z.number().int(),
    }),
    updateSchema: objectSchema(
      {
        stage: z.string().min(1),
        status: z.enum(['done', 'active', 'upcoming']),
        order: z.number().int(),
      },
      true,
    ),
  }),

  // ── Specialists & bookings ───────────────────────────────
  def({
    resource: 'specialists',
    label: 'Specialists',
    prismaModel: 'specialist',
    group: 'Bookings',
    searchFields: ['key', 'name', 'role', 'username', 'id'],
    filterFields: ['active', 'portalRole'],
    sortableFields: ['name', 'key', 'lastLoginAt'],
    defaultSort: 'name',
    listFields: ['name', 'key', 'role', 'username', 'active'],
    activeField: 'active',
    readonlyFields: [
      ...RO,
      'passwordHash',
      'passwordUpdatedAt',
      'lastLoginAt',
      'failedLoginCount',
      'lockedUntil',
    ],
    actions: [
      { key: 'enable', label: 'Enable' },
      { key: 'disable', label: 'Disable' },
      {
        key: 'revoke-sessions',
        label: 'Sign out everywhere',
        description: 'Deletes every portal session for this specialist',
      },
    ],
    createSchema: objectSchema({
      key: z.string().min(1),
      name: z.string().min(1),
      portalRole: z.enum(['doctor', 'admin']).optional(),
      username: SPECIALIST_USERNAME.nullable().optional(),
      password: z.string().min(10).max(200).nullable().optional(),
      subtitle: z.string().nullable().optional(),
      role: z.string().nullable().optional(),
      specialization: z.string().nullable().optional(),
      summary: z.string().nullable().optional(),
      experience: z.string().nullable().optional(),
      tag: z.string().nullable().optional(),
      imageUrl: z.string().nullable().optional(),
      active: z.boolean().optional(),
    }),
    updateSchema: objectSchema(
      {
        key: z.string().min(1),
        name: z.string().min(1),
        portalRole: z.enum(['doctor', 'admin']),
        username: SPECIALIST_USERNAME.nullable(),
        password: z.string().min(10).max(200).nullable(),
        subtitle: z.string().nullable(),
        role: z.string().nullable(),
        specialization: z.string().nullable(),
        summary: z.string().nullable(),
        experience: z.string().nullable(),
        tag: z.string().nullable(),
        imageUrl: z.string().nullable(),
        active: z.boolean(),
      },
      true,
    ),
  }),
  def({
    resource: 'specialist-qualifications',
    label: 'Specialist Qualifications',
    prismaModel: 'specialistQualification',
    group: 'Bookings',
    searchFields: ['label', 'specialistId', 'id'],
    filterFields: ['specialistId'],
    sortableFields: ['label'],
    defaultSort: 'label',
    listFields: ['specialist', 'label'],
    createSchema: objectSchema({
      specialistId: z.string().min(1),
      label: z.string().min(1),
    }),
    updateSchema: objectSchema({ label: z.string().min(1) }, true),
  }),
  def({
    resource: 'consultations',
    label: 'Consultations',
    prismaModel: 'consultation',
    group: 'Bookings',
    searchFields: ['userId', 'specialistId', 'id'],
    filterFields: ['userId', 'specialistId', 'status', 'isFree'],
    sortableFields: ['scheduledAt', 'createdAt'],
    defaultSort: 'scheduledAt',
    listFields: ['user', 'specialist', 'scheduledAt', 'status', 'isFree'],
    createSchema: objectSchema({
      userId: z.string().min(1),
      specialistId: z.string().min(1),
      scheduledAt: dateString,
      status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']).optional(),
      isFree: z.boolean().optional(),
    }),
    updateSchema: objectSchema(
      {
        scheduledAt: dateString,
        status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']),
        isFree: z.boolean(),
        specialistId: z.string().min(1),
      },
      true,
    ),
  }),
  def({
    resource: 'consultation-documents',
    label: 'Consultation Documents',
    prismaModel: 'consultationDocument',
    group: 'Bookings',
    searchFields: ['consultationId', 'originalName', 'title', 'id'],
    filterFields: ['consultationId', 'kind', 'uploadedById'],
    sortableFields: ['createdAt', 'updatedAt'],
    defaultSort: 'createdAt',
    listFields: ['title', 'kind', 'originalName', 'uploadedBy', 'consultation', 'createdAt'],
    listInclude: {
      uploadedBy: SPECIALIST_LIST,
      consultation: {
        select: {
          scheduledAt: true,
          status: true,
          user: USER_LIST,
          specialist: SPECIALIST_LIST,
        },
      },
    },
    softDeleteField: 'deletedAt',
    actions: [
      { key: 'archive', label: 'Archive (soft delete)' },
      { key: 'restore', label: 'Restore' },
    ],
    createSchema: objectSchema({
      consultationId: z.string().min(1),
      kind: z.enum(['prescription', 'diet_plan', 'care_plan', 'suggestion']),
      title: z.string().nullable().optional(),
      originalName: z.string().min(1),
      mimeType: z.string().min(1),
      sizeBytes: z.number().int().min(0),
      storagePath: z.string().min(1),
      uploadedById: z.string().min(1),
      deletedAt: dateString.nullable().optional(),
    }),
    updateSchema: objectSchema(
      {
        kind: z.enum(['prescription', 'diet_plan', 'care_plan', 'suggestion']),
        title: z.string().nullable(),
        originalName: z.string().min(1),
        mimeType: z.string().min(1),
        sizeBytes: z.number().int().min(0),
        deletedAt: dateString.nullable(),
      },
      true,
    ),
  }),
  def({
    resource: 'consultation-calls',
    label: 'Consultation Calls',
    prismaModel: 'consultationCall',
    group: 'Bookings',
    searchFields: ['consultationId', 'roomName', 'id'],
    filterFields: ['status', 'provider'],
    sortableFields: ['createdAt', 'updatedAt', 'endedAt'],
    defaultSort: 'createdAt',
    listFields: ['consultation', 'status', 'provider', 'roomName', 'endedAt', 'createdAt'],
    listInclude: {
      consultation: {
        select: {
          scheduledAt: true,
          status: true,
          user: USER_LIST,
          specialist: SPECIALIST_LIST,
        },
      },
    },
    createSchema: objectSchema({
      consultationId: z.string().min(1),
      provider: z.enum(['livekit']).optional(),
      roomName: z.string().min(1),
      status: z.enum(['waiting', 'active', 'ended', 'failed']).optional(),
      doctorStartedAt: dateString.nullable().optional(),
      patientJoinedAt: dateString.nullable().optional(),
      recordingStartedAt: dateString.nullable().optional(),
      endedAt: dateString.nullable().optional(),
    }),
    updateSchema: objectSchema(
      {
        status: z.enum(['waiting', 'active', 'ended', 'failed']),
        doctorStartedAt: dateString.nullable(),
        patientJoinedAt: dateString.nullable(),
        recordingStartedAt: dateString.nullable(),
        endedAt: dateString.nullable(),
      },
      true,
    ),
  }),
  def({
    resource: 'consultation-recordings',
    label: 'Consultation Recordings',
    prismaModel: 'consultationRecording',
    group: 'Bookings',
    searchFields: ['consultationCallId', 'egressId', 'id'],
    filterFields: ['consultationCallId', 'status', 'participantRole'],
    sortableFields: ['createdAt', 'startedAt', 'completedAt'],
    defaultSort: 'createdAt',
    createSchema: objectSchema({
      consultationCallId: z.string().min(1),
      participantRole: z.enum(['doctor', 'patient', 'mixed']),
      participantIdentity: z.string().min(1),
      egressId: z.string().nullable().optional(),
      status: z.enum(['starting', 'recording', 'processing', 'ready', 'failed']).optional(),
      storagePath: z.string().nullable().optional(),
      startedAt: dateString.nullable().optional(),
      completedAt: dateString.nullable().optional(),
      durationSeconds: z.number().int().nullable().optional(),
      errorMessage: z.string().nullable().optional(),
    }),
    updateSchema: objectSchema(
      {
        status: z.enum(['starting', 'recording', 'processing', 'ready', 'failed']),
        storagePath: z.string().nullable(),
        startedAt: dateString.nullable(),
        completedAt: dateString.nullable(),
        durationSeconds: z.number().int().nullable(),
        errorMessage: z.string().nullable(),
        egressId: z.string().nullable(),
      },
      true,
    ),
  }),
  def({
    resource: 'consultation-call-consents',
    label: 'Call Consents',
    prismaModel: 'consultationCallConsent',
    group: 'Bookings',
    searchFields: ['consultationCallId', 'userId', 'id'],
    filterFields: ['consultationCallId', 'userId'],
    sortableFields: ['consentedAt'],
    defaultSort: 'consentedAt',
    createSchema: objectSchema({
      consultationCallId: z.string().min(1),
      userId: z.string().min(1),
      consentTextVersion: z.string().min(1),
      consentedAt: dateString.optional(),
    }),
    updateSchema: objectSchema(
      {
        consentTextVersion: z.string().min(1),
        consentedAt: dateString,
      },
      true,
    ),
  }),
  def({
    resource: 'consultation-slots',
    label: 'Consultation Slots',
    prismaModel: 'consultationSlot',
    group: 'Bookings',
    searchFields: ['specialistId', 'consultationId', 'id'],
    filterFields: ['specialistId', 'isBooked'],
    sortableFields: ['startsAt', 'endsAt', 'createdAt'],
    defaultSort: 'startsAt',
    listFields: ['specialist', 'startsAt', 'endsAt', 'isBooked'],
    createSchema: objectSchema({
      specialistId: z.string().min(1),
      startsAt: dateString,
      endsAt: dateString,
      isBooked: z.boolean().optional(),
      consultationId: z.string().nullable().optional(),
    }),
    updateSchema: objectSchema(
      {
        startsAt: dateString,
        endsAt: dateString,
        isBooked: z.boolean(),
        consultationId: z.string().nullable(),
      },
      true,
    ),
  }),

  // ── Library & Q&A ────────────────────────────────────────
  def({
    resource: 'articles',
    label: 'Articles',
    prismaModel: 'article',
    group: 'Content',
    searchFields: ['slug', 'title', 'category', 'id'],
    filterFields: ['category', 'featured'],
    sortableFields: ['publishedAt', 'createdAt', 'title'],
    defaultSort: 'createdAt',
    listFields: ['title', 'category', 'slug', 'featured', 'publishedAt'],
    createSchema: objectSchema({
      slug: z.string().min(1),
      category: z.string().min(1),
      title: z.string().min(1),
      excerpt: z.string().nullable().optional(),
      body: z.string().nullable().optional(),
      readMinutes: z.number().int().nullable().optional(),
      authorName: z.string().nullable().optional(),
      featured: z.boolean().optional(),
      publishedAt: dateString.nullable().optional(),
    }),
    updateSchema: objectSchema(
      {
        slug: z.string().min(1),
        category: z.string().min(1),
        title: z.string().min(1),
        excerpt: z.string().nullable(),
        body: z.string().nullable(),
        readMinutes: z.number().int().nullable(),
        authorName: z.string().nullable(),
        featured: z.boolean(),
        publishedAt: dateString.nullable(),
      },
      true,
    ),
  }),
  def({
    resource: 'masterclasses',
    label: 'Masterclasses',
    prismaModel: 'masterclass',
    group: 'Content',
    searchFields: ['title', 'id'],
    filterFields: ['isFree', 'isLive'],
    sortableFields: ['scheduledAt', 'createdAt'],
    defaultSort: 'scheduledAt',
    createSchema: objectSchema({
      title: z.string().min(1),
      scheduledAt: dateString,
      isFree: z.boolean().optional(),
      isLive: z.boolean().optional(),
    }),
    updateSchema: objectSchema(
      {
        title: z.string().min(1),
        scheduledAt: dateString,
        isFree: z.boolean(),
        isLive: z.boolean(),
      },
      true,
    ),
  }),
  def({
    resource: 'anonymous-questions',
    label: 'Anonymous Questions',
    prismaModel: 'anonymousQuestion',
    group: 'Content',
    searchFields: ['topic', 'body', 'userId', 'id'],
    filterFields: ['status', 'topic', 'userId'],
    sortableFields: ['createdAt', 'answeredAt'],
    defaultSort: 'createdAt',
    listFields: ['topic', 'body', 'status', 'user', 'createdAt', 'answeredAt'],
    createSchema: objectSchema({
      userId: z.string().nullable().optional(),
      topic: z.string().min(1),
      body: z.string().min(1),
      status: z.enum(['pending', 'answered']).optional(),
      answeredAt: dateString.nullable().optional(),
    }),
    updateSchema: objectSchema(
      {
        topic: z.string().min(1),
        body: z.string().min(1),
        status: z.enum(['pending', 'answered']),
        answeredAt: dateString.nullable(),
        userId: z.string().nullable(),
      },
      true,
    ),
  }),
  def({
    resource: 'expert-answers',
    label: 'Expert Answers',
    prismaModel: 'expertAnswer',
    group: 'Content',
    searchFields: ['questionId', 'expertName', 'id'],
    filterFields: ['questionId', 'specialistId', 'verified'],
    sortableFields: ['answeredAt'],
    defaultSort: 'answeredAt',
    listFields: ['expertName', 'expertRole', 'question', 'verified', 'answeredAt'],
    listInclude: {
      question: { select: { topic: true, body: true } },
      specialist: SPECIALIST_LIST,
    },
    createSchema: objectSchema({
      questionId: z.string().min(1),
      specialistId: z.string().nullable().optional(),
      expertName: z.string().min(1),
      expertRole: z.string().nullable().optional(),
      body: z.string().min(1),
      verified: z.boolean().optional(),
      answeredAt: dateString.optional(),
    }),
    updateSchema: objectSchema(
      {
        specialistId: z.string().nullable(),
        expertName: z.string().min(1),
        expertRole: z.string().nullable(),
        body: z.string().min(1),
        verified: z.boolean(),
        answeredAt: dateString,
      },
      true,
    ),
  }),

  // ── Support ──────────────────────────────────────────────
  // Help requests written from the app. Nothing here is emailed anywhere — the reply typed into
  // `response` is what she reads back in the PWA. `purgeAfter` is set by the API at creation and
  // is deliberately editable here only for a deletion honoured early, never to extend retention.
  def({
    resource: 'support-tickets',
    label: 'Support Tickets',
    prismaModel: 'supportTicket',
    group: 'Support',
    searchFields: ['reference', 'subject', 'contactEmail', 'userId', 'id'],
    filterFields: ['status', 'category', 'userId'],
    sortableFields: ['createdAt', 'respondedAt', 'purgeAfter'],
    defaultSort: 'createdAt',
    listFields: ['reference', 'user', 'category', 'subject', 'status', 'createdAt'],
    listInclude: { user: USER_LIST },
    // No createSchema of substance: tickets are opened by the member, not by staff.
    createSchema: objectSchema({
      userId: z.string().nullable().optional(),
      category: z.enum([
        'account',
        'consultation',
        'subscription',
        'technical',
        'privacy',
        'other',
      ]),
      subject: z.string().min(1),
      message: z.string().min(1),
      contactEmail: z.string().nullable().optional(),
      consentVersion: z.string().min(1),
      purgeAfter: dateString,
    }),
    updateSchema: objectSchema(
      {
        status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
        response: z.string().nullable(),
        respondedAt: dateString.nullable(),
        purgeAfter: dateString,
      },
      true,
    ),
  }),

  // ── Chat ─────────────────────────────────────────────────
  def({
    resource: 'chat-threads',
    label: 'Chat Threads',
    prismaModel: 'chatThread',
    group: 'Chat',
    searchFields: ['userId', 'id'],
    filterFields: ['userId'],
    sortableFields: ['createdAt'],
    defaultSort: 'createdAt',
    listFields: ['user', 'createdAt'],
    createSchema: objectSchema({ userId: z.string().min(1) }),
    updateSchema: objectSchema({ userId: z.string().min(1) }, true),
  }),
  def({
    resource: 'chat-messages',
    label: 'Chat Messages',
    prismaModel: 'chatMessage',
    group: 'Chat',
    searchFields: ['threadId', 'body', 'id'],
    filterFields: ['threadId', 'role'],
    sortableFields: ['createdAt'],
    defaultSort: 'createdAt',
    listFields: ['thread', 'role', 'body', 'createdAt'],
    listInclude: {
      thread: { select: { createdAt: true, user: USER_LIST } },
    },
    createSchema: objectSchema({
      threadId: z.string().min(1),
      role: z.enum(['user', 'anu']),
      body: z.string().min(1),
    }),
    updateSchema: objectSchema(
      {
        role: z.enum(['user', 'anu']),
        body: z.string().min(1),
      },
      true,
    ),
  }),
  def({
    resource: 'anu-chat-turns',
    label: 'ANU Chat Turns',
    prismaModel: 'anuChatTurn',
    group: 'Chat',
    searchFields: ['userId', 'userMessage', 'symptom', 'id'],
    filterFields: ['userId', 'source', 'symptom'],
    sortableFields: ['createdAt'],
    defaultSort: 'createdAt',
    createSchema: objectSchema({
      userId: z.string().min(1),
      userMessage: z.string().min(1),
      reply: z.string().min(1),
      suggestions: z.array(z.string()).optional(),
      symptom: z.string().nullable().optional(),
      source: z.enum(['red_flag', 'cache', 'model']),
      redFlagArea: z.string().nullable().optional(),
      cacheHitId: z.string().nullable().optional(),
      similarity: z.number().nullable().optional(),
      promptVersion: z.number().int(),
    }),
    updateSchema: objectSchema(
      {
        reply: z.string().min(1),
        suggestions: z.array(z.string()),
        symptom: z.string().nullable(),
        redFlagArea: z.string().nullable(),
      },
      true,
    ),
  }),
  def({
    resource: 'anu-response-cache',
    label: 'ANU Response Cache',
    prismaModel: 'anuResponseCache',
    group: 'Chat',
    searchFields: ['question', 'symptom', 'id'],
    filterFields: ['promptVersion', 'symptom'],
    sortableFields: ['lastUsedAt', 'createdAt', 'hits'],
    defaultSort: 'lastUsedAt',
    createSchema: objectSchema({
      question: z.string().min(1),
      reply: z.string().min(1),
      suggestions: z.array(z.string()).optional(),
      symptom: z.string().nullable().optional(),
      embedding: z.string().min(1), // base64
      promptVersion: z.number().int(),
      hits: z.number().int().optional(),
      lastUsedAt: dateString.optional(),
    }),
    updateSchema: objectSchema(
      {
        question: z.string().min(1),
        reply: z.string().min(1),
        suggestions: z.array(z.string()),
        symptom: z.string().nullable(),
        embedding: z.string().min(1),
        promptVersion: z.number().int(),
        hits: z.number().int(),
        lastUsedAt: dateString,
      },
      true,
    ),
  }),

  // ── Cycle & lifestyle logs ───────────────────────────────
  def({
    resource: 'cycle-settings',
    label: 'Cycle Settings',
    prismaModel: 'cycleSettings',
    group: 'Tracking',
    searchFields: ['userId', 'id'],
    filterFields: ['userId'],
    sortableFields: ['updatedAt'],
    defaultSort: 'updatedAt',
    createSchema: objectSchema({
      userId: z.string().min(1),
      cycleLength: z.number().int().min(1).optional(),
      periodLength: z.number().int().min(1).optional(),
    }),
    updateSchema: objectSchema(
      {
        cycleLength: z.number().int().min(1),
        periodLength: z.number().int().min(1),
      },
      true,
    ),
  }),
  def({
    resource: 'period-logs',
    label: 'Period Logs',
    prismaModel: 'periodLog',
    group: 'Tracking',
    searchFields: ['userId', 'id'],
    filterFields: ['userId'],
    sortableFields: ['startDate', 'createdAt'],
    defaultSort: 'startDate',
    createSchema: objectSchema({
      userId: z.string().min(1),
      startDate: dateString,
      endDate: dateString.nullable().optional(),
    }),
    updateSchema: objectSchema(
      {
        startDate: dateString,
        endDate: dateString.nullable(),
      },
      true,
    ),
  }),
  def({
    resource: 'mood-logs',
    label: 'Mood Logs',
    prismaModel: 'moodLog',
    group: 'Tracking',
    searchFields: ['userId', 'id', 'category', 'slot'],
    filterFields: ['userId', 'slot'],
    sortableFields: ['loggedAt', 'createdAt'],
    defaultSort: 'loggedAt',
  }),
  def({
    resource: 'sleep-logs',
    label: 'Sleep Logs',
    prismaModel: 'sleepLog',
    group: 'Tracking',
    searchFields: ['userId', 'id', 'category'],
    filterFields: ['userId'],
    sortableFields: ['loggedAt', 'createdAt'],
    defaultSort: 'loggedAt',
  }),
  def({
    resource: 'quick-symptom-logs',
    label: 'Quick Symptom Logs',
    prismaModel: 'quickSymptomLog',
    group: 'Tracking',
    searchFields: ['userId', 'symptom', 'id'],
    filterFields: ['userId', 'symptom'],
    sortableFields: ['loggedAt'],
    defaultSort: 'loggedAt',
  }),

  // Same daily shape, but the answer column is `flow`, not `category`, so it cannot ride
  // makeDailyLogEntities below.
  def({
    resource: 'period-flow-logs',
    label: 'Period Flow Logs',
    prismaModel: 'periodFlowLog',
    group: 'Tracking',
    searchFields: ['userId', 'flow', 'id'],
    filterFields: ['userId', 'source', 'flow'],
    sortableFields: ['date', 'loggedAt', 'createdAt'],
    defaultSort: 'date',
  }),

  // Nudge daily tracker logs (same shape family)
  ...makeDailyLogEntities([
    ['energy-logs', 'Energy Logs', 'energyLog'],
    ['stress-logs', 'Stress Logs', 'stressLog'],
    ['hot-flash-daily-logs', 'Hot Flash Daily Logs', 'hotFlashDailyLog'],
    ['period-daily-statuses', 'Period Daily Statuses', 'periodDailyStatus'],
    ['plan-adherence-logs', 'Plan Adherence Logs', 'planAdherenceLog'],
    ['hydration-logs', 'Hydration Logs', 'hydrationLog'],
    ['cravings-logs', 'Cravings Logs', 'cravingsLog'],
    ['movement-logs', 'Movement Logs', 'movementLog'],
    ['me-time-logs', 'Me Time Logs', 'meTimeLog'],
    ['food-rhythm-logs', 'Food Rhythm Logs', 'foodRhythmLog'],
    ['family-support-logs', 'Family Support Logs', 'familySupportLog'],
    ['weekly-mood-review-logs', 'Weekly Mood Review Logs', 'weeklyMoodReviewLog'],
    ['brain-fog-logs', 'Brain Fog Logs', 'brainFogLog'],
    ['bloating-logs', 'Bloating Logs', 'bloatingLog'],
    ['pain-logs', 'Pain Logs', 'painLog'],
  ]),

  // ── Nudge governor ───────────────────────────────────────
  def({
    resource: 'nudge-daily-states',
    label: 'Nudge Daily States',
    prismaModel: 'nudgeDailyState',
    group: 'Nudges',
    searchFields: ['userId', 'id'],
    filterFields: ['userId', 'distressFlag'],
    sortableFields: ['date', 'updatedAt'],
    defaultSort: 'date',
  }),
  def({
    resource: 'nudge-send-logs',
    label: 'Nudge Send Logs',
    prismaModel: 'nudgeSendLog',
    group: 'Nudges',
    searchFields: ['userId', 'nudgeId', 'id'],
    filterFields: ['userId', 'nudgeId', 'layer', 'slot'],
    sortableFields: ['sentAt'],
    defaultSort: 'sentAt',
  }),
  def({
    resource: 'l3-trigger-logs',
    label: 'L3 Trigger Logs',
    prismaModel: 'l3TriggerLog',
    group: 'Nudges',
    searchFields: ['userId', 'triggerId', 'id'],
    filterFields: ['userId', 'triggerId'],
    sortableFields: ['firedAt'],
    defaultSort: 'firedAt',
  }),
];

function makeDailyLogEntities(
  items: Array<[resource: string, label: string, prismaModel: string]>,
): AdminEntityDefinition[] {
  return items.map(([resource, label, prismaModel]) =>
    def({
      resource,
      label,
      prismaModel,
      group: 'Tracking',
      searchFields: ['userId', 'category', 'id'],
      filterFields: ['userId', 'source', 'category'],
      sortableFields: ['date', 'loggedAt', 'createdAt'],
      defaultSort: 'date',
      listFields: ['user', 'date', 'category', 'source', 'loggedAt'],
      createSchema: objectSchema({
        userId: z.string().min(1),
        date: dateString,
        category: z.string().min(1),
        source: z.string().optional(),
        loggedAt: dateString.optional(),
        // optional extras present on some models
        count: z.number().int().nullable().optional(),
        overwhelmed: z.boolean().optional(),
        nightSweatFlag: z.boolean().optional(),
      }),
      updateSchema: objectSchema(
        {
          date: dateString,
          category: z.string().min(1),
          source: z.string(),
          loggedAt: dateString,
          count: z.number().int().nullable(),
          overwhelmed: z.boolean(),
        },
        true,
      ),
    }),
  );
}

const byResource = new Map(ADMIN_ENTITIES.map((e) => [e.resource, e]));

export function getEntityByResource(resource: string): AdminEntityDefinition | undefined {
  return byResource.get(resource);
}

export function listEntityMeta() {
  return ADMIN_ENTITIES.map((e) => {
    let createFields = zodToFields(e.createSchema);
    let updateFields = zodToFields(e.updateSchema);

    // Q&A answers point at anonymous questions, not assessment questions.
    if (e.resource === 'expert-answers') {
      const remap = (fields: typeof createFields) =>
        fields?.map((f) =>
          f.name === 'questionId'
            ? {
                ...f,
                relation: {
                  resource: 'anonymous-questions',
                  labelFields: ['topic', 'body'],
                },
              }
            : f,
        ) ?? null;
      createFields = remap(createFields);
      updateFields = remap(updateFields);
    }

    const canCreate =
      e.canCreate ?? (Boolean(createFields?.length) && !ADMIN_NO_CREATE.has(e.resource));

    return {
      resource: e.resource,
      label: e.label,
      group: e.group,
      searchFields: e.searchFields,
      filterFields: e.filterFields,
      sortableFields: e.sortableFields,
      defaultSort: e.defaultSort,
      listFields: e.listFields ?? null,
      softDeleteField: e.softDeleteField ?? null,
      activeField: e.activeField ?? null,
      actions: e.actions ?? [],
      canCreate,
      createFields,
      updateFields,
    };
  });
}
