import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { connectToDatabase } from '../src/config/database.js';
import Hotel from '../src/models/Hotel.js';
import { seedDevelopmentHotels } from '../src/services/developmentHotelSeeds.js';

async function main() {
  if (env.NODE_ENV !== 'development') {
    throw new Error('Development hotel seeding is allowed only when NODE_ENV=development.');
  }

  await connectToDatabase();
  try {
    const result = await seedDevelopmentHotels(Hotel);
    console.log(JSON.stringify({ event: 'development_hotels_seeded', ...result }));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    event: 'development_hotel_seed_failed',
    errorName: error?.name ?? 'Error',
  }));
  process.exitCode = 1;
});
