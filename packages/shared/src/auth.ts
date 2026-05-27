import { z } from 'zod';

export const authPurposeSchema = z.enum(['login', 'signup']);
export const subscriptionPlanSchema = z.enum(['monthly', 'annual']);
export const subscriptionStatusSchema = z.enum(['trialing', 'active', 'past_due', 'canceled']);
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const requestOtpBodySchema = z
  .object({
    purpose: authPurposeSchema,
    phone: z.string().trim().min(10).max(20),
    name: z.string().trim().min(2).max(80).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.purpose === 'signup' && !value.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'Name is required for signup.',
      });
    }
  });

export type RequestOtpBody = z.infer<typeof requestOtpBodySchema>;

export const requestOtpResponseSchema = z.object({
  challengeId: z.string(),
  phone: z.string(),
  maskedPhone: z.string(),
  resendAfterSeconds: z.number().int().nonnegative(),
});

export type RequestOtpResponse = z.infer<typeof requestOtpResponseSchema>;

export const verifyOtpBodySchema = z
  .object({
    challengeId: z.string().min(1),
    purpose: authPurposeSchema,
    phone: z.string().trim().min(10).max(20),
    otp: z.string().trim().length(6),
    name: z.string().trim().min(2).max(80).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.purpose === 'signup' && !value.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'Name is required for signup.',
      });
    }
  });

export type VerifyOtpBody = z.infer<typeof verifyOtpBodySchema>;

export const authUserSchema = z.object({
  id: z.string(),
  phone: z.string(),
  name: z.string().nullable(),
  email: z.string().email().nullable(),
  onboardingCompleted: z.boolean(),
  subscriptionPlan: subscriptionPlanSchema.nullable(),
  subscriptionStatus: subscriptionStatusSchema.nullable(),
  subscriptionStartedAt: z.string().datetime().nullable(),
  trialEndsAt: z.string().datetime().nullable(),
  renewsAt: z.string().datetime().nullable(),
  hasActiveAccess: z.boolean(),
  trialAvailable: z.boolean(),
  requiresPayment: z.boolean(),
  phoneVerifiedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export const authSessionResponseSchema = z.object({
  user: authUserSchema,
  isNewUser: z.boolean(),
});

export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;

export const completeOnboardingResponseSchema = authUserSchema;

export type CompleteOnboardingResponse = z.infer<typeof completeOnboardingResponseSchema>;

export const logoutResponseSchema = z.object({
  ok: z.literal(true),
});

export type LogoutResponse = z.infer<typeof logoutResponseSchema>;

export const startTrialResponseSchema = authUserSchema;

export type StartTrialResponse = z.infer<typeof startTrialResponseSchema>;

export const activateOneDaySubscriptionResponseSchema = authUserSchema;

export type ActivateOneDaySubscriptionResponse = z.infer<typeof activateOneDaySubscriptionResponseSchema>;
