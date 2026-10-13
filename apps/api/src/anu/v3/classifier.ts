// Pre-reply safety classification. A separate call from the reply on purpose:
// the model writing in ANU's voice should not also be the one deciding how
// risky a message is, or the tone it is reaching for can soften the rating.

import { z } from 'zod';
import { CLASSIFIER_PROMPT } from './prompt.js';
import { chatJson, v3Env, type ChatMessage } from './llm.js';

export const RISK_LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

const PATHWAYS = [
  'emergency',
  'gynecologist',
  'psychologist',
  'dietitian',
  'menopause_coach',
  'physiotherapist',
  'general_physician',
] as const;

const classificationSchema = z.object({
  risk_level: z.enum(RISK_LEVELS),
  flags: z.array(z.string()),
  requires_emergency_escalation: z.boolean(),
  crisis: z.boolean(),
  recommended_pathway: z.enum(PATHWAYS).nullable(),
});

export type SafetyClassification = z.infer<typeof classificationSchema>;

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['risk_level', 'flags', 'requires_emergency_escalation', 'crisis', 'recommended_pathway'],
  properties: {
    risk_level: { type: 'string', enum: [...RISK_LEVELS] },
    flags: { type: 'array', items: { type: 'string' } },
    requires_emergency_escalation: { type: 'boolean' },
    crisis: { type: 'boolean' },
    recommended_pathway: { anyOf: [{ type: 'string', enum: [...PATHWAYS] }, { type: 'null' }] },
  },
};

export function riskRank(level: string): number {
  const index = (RISK_LEVELS as readonly string[]).indexOf(level);
  return index === -1 ? -1 : index;
}

export async function classify(
  userMessage: string,
  thread: ChatMessage[],
): Promise<SafetyClassification> {
  // The last two exchanges are enough to read "yes" or "it's getting worse"
  // correctly; anything older only dilutes the rubric.
  const recent = thread.slice(-4);
  const transcript = recent
    .map((m) => `${m.role === 'user' ? 'USER' : m.role === 'system' ? 'APP' : 'ANU'}: ${m.content}`)
    .join('\n');
  const raw = await chatJson({
    model: v3Env.classifierModel(),
    effort: v3Env.classifierEffort(),
    temperature: 0,
    schemaName: 'anu_safety_classification',
    schema: JSON_SCHEMA,
    messages: [
      { role: 'system', content: CLASSIFIER_PROMPT },
      {
        role: 'user',
        content: `${transcript ? `RECENT CONVERSATION:\n${transcript}\n\n` : ''}LATEST USER MESSAGE:\n${userMessage}`,
      },
    ],
  });
  const parsed = classificationSchema.parse(raw);
  // Keep the two emergency fields consistent with the level whichever way the
  // model got it wrong: an escalation or a crisis can only ever raise the level.
  if (parsed.requires_emergency_escalation || parsed.crisis) {
    return { ...parsed, risk_level: 'L4', requires_emergency_escalation: true };
  }
  return parsed;
}
