import { z } from 'zod';

const accommodationTypes = ['hotel', 'guest_house', 'hostel', 'motel', 'apartment'];

export const hotelQuerySchema = z.object({
  city: z.string().trim().min(1).max(100).optional(),
  region: z.string().trim().min(1).max(100).optional(),
  locality: z.string().trim().min(1).max(100).optional(),
  type: z.enum(accommodationTypes).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const realDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  })
  .refine((value) => value >= new Date().toISOString().slice(0, 10), {
    message: 'Date cannot be in the past',
  });

export const hotelOfferQuerySchema = z
  .object({
    checkIn: realDateSchema,
    checkOut: realDateSchema,
    guests: z.coerce.number().int().min(1).max(8),
    currency: z.enum(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD']),
  })
  .strict()
  .refine((values) => values.checkOut > values.checkIn, {
    path: ['checkOut'],
    message: 'Check-out must be after check-in',
  });

export const refreshSchema = z.object({
  area: z.enum(['Mumbai', 'Navi Mumbai']),
});

export { accommodationTypes };
