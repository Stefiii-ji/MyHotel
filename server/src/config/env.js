import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CLIENT_ORIGIN: z
    .string()
    .url()
    .refine((value) => new URL(value).origin === value, 'CLIENT_ORIGIN must be an origin without a path')
    .default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI must not be empty'),
  OVERPASS_URL: z
    .string()
    .url()
    .refine((value) => new URL(value).protocol === 'https:', 'OVERPASS_URL must use HTTPS')
    .default('https://overpass-api.de/api/interpreter'),
  HOTEL_IMPORT_TOKEN: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(32).optional(),
  ),
  HOTEL_OFFERS_PROVIDER: z.enum(['none', 'amadeus']).default('none'),
  HOTEL_OFFERS_MODE: z.enum(['test', 'production']).default('test'),
  AMADEUS_CLIENT_ID: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  AMADEUS_CLIENT_SECRET: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  HOTEL_OFFERS_TIMEOUT_MS: z.coerce.number().int().min(500).max(30000).default(8000),
  HOTEL_OFFERS_CACHE_TTL_MS: z.coerce.number().int().min(0).max(3600000).default(300000),
}).superRefine((values, context) => {
  if (values.NODE_ENV === 'production' && new URL(values.CLIENT_ORIGIN).protocol !== 'https:') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CLIENT_ORIGIN'],
      message: 'CLIENT_ORIGIN must use HTTPS in production',
    });
  }
  if (Boolean(values.AMADEUS_CLIENT_ID) !== Boolean(values.AMADEUS_CLIENT_SECRET)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['AMADEUS_CLIENT_SECRET'],
      message: 'AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET must be configured together',
    });
  }
  if (
    values.HOTEL_OFFERS_PROVIDER === 'amadeus' &&
    values.HOTEL_OFFERS_MODE === 'production' &&
    values.NODE_ENV !== 'production'
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['HOTEL_OFFERS_MODE'],
      message: 'Production hotel offers require NODE_ENV=production',
    });
  }
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid server environment configuration: ${details}`);
}

export const env = result.data;
