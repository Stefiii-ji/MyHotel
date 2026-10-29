import mongoose from 'mongoose';
import './env.js';

export async function connectToDatabase() {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    bufferCommands: false,
  });
}

export function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

export function getDatabaseConnectionError(error) {
  const knownErrorNames = new Set([
    'MongoServerSelectionError',
    'MongoParseError',
    'MongoNetworkError',
    'MongoAuthenticationError',
  ]);
  const errorName = knownErrorNames.has(error?.name) ? error.name : 'MongoDB connection error';

  if (
    errorName === 'MongoAuthenticationError' ||
    (errorName === 'MongoDB connection error' && [18, 8000].includes(error?.code))
  ) {
    return 'MongoDB authentication failed. Verify the Atlas database username and password.';
  }
  if (errorName === 'MongoParseError') {
    return 'MongoDB connection string is invalid. Verify the Atlas connection string format.';
  }
  if (errorName === 'MongoServerSelectionError' || errorName === 'MongoNetworkError') {
    return 'MongoDB Atlas could not be reached. Verify the cluster is available and this machine is allowed in the Atlas network access list.';
  }
  return 'MongoDB connection failed. Verify the Atlas connection string, database user, and network access settings.';
}
