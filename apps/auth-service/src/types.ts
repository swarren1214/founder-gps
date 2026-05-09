import { z } from "zod";

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(120)
});

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const UpdateProfileRequestSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  firstName: z.string().min(1).max(80).nullable().optional(),
  lastName: z.string().min(1).max(80).nullable().optional(),
  companyName: z.string().min(1).max(160).nullable().optional(),
  roleTitle: z.string().min(1).max(120).nullable().optional(),
  bio: z.string().min(1).max(2000).nullable().optional(),
  locationCity: z.string().min(1).max(120).nullable().optional(),
  onboardingContext: z
    .object({
      schemaVersion: z.number().int().min(1)
    })
    .catchall(z.unknown())
    .optional(),
  onboardingStatus: z.enum(["not_started", "in_progress", "completed"]).optional()
});

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  companyName: z.string().nullable(),
  roleTitle: z.string().nullable(),
  bio: z.string().nullable(),
  locationCity: z.string().nullable(),
  onboardingContext: z.record(z.unknown()),
  avatarUrl: z.string().nullable(),
  avatarStorageKey: z.string().nullable(),
  onboardingStatus: z.enum(["not_started", "in_progress", "completed"]),
  onboardingCompletedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const AuthUserResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    emailVerifiedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string()
  }),
  profile: UserProfileSchema
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
export type AuthUserResponse = z.infer<typeof AuthUserResponseSchema>;
