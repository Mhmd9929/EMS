import { z } from "zod";
import { password, requiredEmail } from "./common";

export const loginSchema = z.object({
  email: requiredEmail,
  password: z.string().min(1, "Required").max(128),
  callbackUrl: z.string().optional(),
});

export const forgotPasswordSchema = z.object({ email: requiredEmail });

export const setPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Required").max(128),
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" })
  .refine((v) => v.password !== v.currentPassword, { path: ["password"], message: "Choose a different password" });
