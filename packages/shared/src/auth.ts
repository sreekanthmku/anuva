import { z } from 'zod';

export const authPurposeSchema = z.enum(['login', 'signup']);

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
