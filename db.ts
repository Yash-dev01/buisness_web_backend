import mongoose from 'mongoose';

export const isMongoConfigured = Boolean(
  process.env.MONGODB_URI
);

export let isConnected = false;

let dbStatusInfo = {
  connected: false,
  mode: 'mongodb' as 'mongodb',
  message: 'MongoDB is not connected.',
};

export function getDbStatus() {
  return dbStatusInfo;
}

export async function initDatabase() {
  if (!process.env.MONGODB_URI) {
    isConnected = false;

    dbStatusInfo = {
      connected: false,
      mode: 'mongodb',
      message: 'MONGODB_URI is not configured.',
    };

    console.error(
      'MONGODB_URI is not configured. Backend cannot start without MongoDB.'
    );

    throw new Error('MONGODB_URI is required');
  }

  try {
    console.log('Connecting to MongoDB...');

    mongoose.connection.on('error', (error) => {
      console.error('MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      isConnected = false;

      dbStatusInfo = {
        connected: false,
        mode: 'mongodb',
        message: 'MongoDB connection lost.',
      };

      console.warn('MongoDB connection lost.');
    });

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    isConnected = true;

    dbStatusInfo = {
      connected: true,
      mode: 'mongodb',
      message: 'Connected to MongoDB successfully.',
    };

    console.log('Connected to MongoDB successfully.');
  } catch (error: any) {
    isConnected = false;

    dbStatusInfo = {
      connected: false,
      mode: 'mongodb',
      message: 'MongoDB connection failed.',
    };

    console.error(
      'MongoDB connection failed:',
      error?.message || error
    );

    throw error;
  }
}

export function isDbConnected(): boolean {
  return isConnected;
}