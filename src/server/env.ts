import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).default(60),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).default(12),
  LOGIN_MAX_FAILURES_PER_EMAIL: z.coerce.number().int().min(1).default(5),
  LOGIN_MAX_FAILURES_PER_IP: z.coerce.number().int().min(1).default(20),
  LOGIN_WINDOW_MINUTES: z.coerce.number().int().min(1).default(15),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
  EMAIL_TRANSPORT: z.enum(["console", "smtp"]).default("console"),
  EMAIL_FROM: z.string().default("HSA Employee Portal <no-reply@hrms.local>"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  STORAGE_DIR: z.string().default("./storage"),
  MAX_UPLOAD_MB: z.coerce.number().min(0.1).default(5),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_MICROSOFT_ENTRA_ID_ID: z.string().optional(),
  AUTH_MICROSOFT_ENTRA_ID_SECRET: z.string().optional(),
  AUTH_MICROSOFT_ENTRA_ID_ISSUER: z.string().optional(),
});

export const env = schema.parse(process.env);
