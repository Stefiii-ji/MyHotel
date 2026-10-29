import { z } from 'zod';

const supportedCities = ['Mumbai', 'Navi Mumbai'];
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  });

export const groupIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
export const memberIdSchema = z.string().uuid();
export const hotelIdSchema = z.string().regex(/^[a-f\d]{24}$/i);

export const createGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    creatorName: z.string().trim().min(1).max(40),
    cities: z.array(z.enum(supportedCities)).min(1).max(2).refine((values) => new Set(values).size === values.length),
    localities: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
    checkIn: dateSchema.optional(),
    checkOut: dateSchema.optional(),
    budgetPerNight: z.number().finite().int().min(1).max(10_000_000),
    minimumRating: z.never().optional(),
  })
  .strict()
  .refine(
    (value) => Boolean(value.checkIn) === Boolean(value.checkOut),
    { message: 'Both check-in and check-out dates are required when dates are provided' },
  )
  .refine(
    (value) => !value.checkIn || value.checkOut > value.checkIn,
    { message: 'Check-out must be after check-in' },
  );

export const joinGroupSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    displayName: z.string().trim().min(1).max(40),
  })
  .strict();

export const readySchema = z.object({ ready: z.boolean() }).strict();
export const swipeSchema = z
  .object({
    hotelId: hotelIdSchema,
    action: z.enum(['like', 'reject']),
  })
  .strict();

export const emptyBodySchema = z.object({}).strict();

export { supportedCities };
