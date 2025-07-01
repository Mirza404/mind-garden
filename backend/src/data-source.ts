import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './entities/User';
import { DailyCheckIn } from './entities/DailyCheckIn';
import dotenv from 'dotenv';
import { Chat } from './entities/Chat';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT as string),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  synchronize: false, // Set to false for production
  logging: process.env.NODE_ENV !== 'production',
  entities: [User, DailyCheckIn, Chat],
  migrations: [],
  subscribers: [],
  ssl: process.env.NODE_ENV === 'production',
  extra: process.env.NODE_ENV === 'production' ? { ssl: { rejectUnauthorized: false } } : {},
});
