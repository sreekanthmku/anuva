import { describe, expect, it } from 'vitest';
import {
  ADMIN_ENTITIES,
  getEntityByResource,
  listEntityMeta,
} from '../../src/admin/entities/registry.js';

/** Every Prisma model that must be manageable via /admin. */
const PRISMA_MODELS = [
  'user',
  'fcmToken',
  'session',
  'otpChallenge',
  'healthProfile',
  'assessmentQuestion',
  'assessmentOption',
  'assessment',
  'assessmentAnswer',
  'subscription',
  'wellnessSnapshot',
  'dailyInsight',
  'symptom',
  'symptomLog',
  'symptomLogEntry',
  'weeklyReport',
  'weeklyMetric',
  'carePath',
  'userCarePath',
  'careJourneyStage',
  'specialist',
  'specialistQualification',
  'specialistSession',
  'consultation',
  'consultationDocument',
  'consultationCall',
  'consultationRecording',
  'consultationCallConsent',
  'consultationSlot',
  'article',
  'masterclass',
  'anonymousQuestion',
  'expertAnswer',
  'chatThread',
  'chatMessage',
  'cycleSettings',
  'periodLog',
  'periodFlowLog',
  'moodLog',
  'sleepLog',
  'quickSymptomLog',
  'detailedAssessment',
  'detailedAnswer',
  'energyLog',
  'stressLog',
  'hotFlashDailyLog',
  'periodDailyStatus',
  'planAdherenceLog',
  'hydrationLog',
  'cravingsLog',
  'movementLog',
  'meTimeLog',
  'foodRhythmLog',
  'familySupportLog',
  'weeklyMoodReviewLog',
  'brainFogLog',
  'bloatingLog',
  'painLog',
  'nudgeDailyState',
  'nudgeSendLog',
  'l3TriggerLog',
  'anuChatTurn',
  'anuResponseCache',
  'supportTicket',
] as const;

describe('ADMIN_ENTITIES registry', () => {
  it('registers every Prisma model exactly once', () => {
    const registered = ADMIN_ENTITIES.map((e) => e.prismaModel).sort();
    expect(registered).toEqual([...PRISMA_MODELS].sort());
  });

  it('has unique resource names', () => {
    const resources = ADMIN_ENTITIES.map((e) => e.resource);
    expect(new Set(resources).size).toBe(resources.length);
  });

  it('getEntityByResource resolves known and unknown resources', () => {
    expect(getEntityByResource('users')?.prismaModel).toBe('user');
    expect(getEntityByResource('nope')).toBeUndefined();
  });

  it('listEntityMeta exposes UI-safe fields without schemas', () => {
    const meta = listEntityMeta();
    expect(meta.length).toBe(ADMIN_ENTITIES.length);
    expect(meta[0]).toHaveProperty('resource');
    expect(meta[0]).toHaveProperty('actions');
    expect(meta[0]).not.toHaveProperty('createSchema');
  });
});
