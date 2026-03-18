import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import 'express-async-errors';
import request from 'supertest';
import express from 'express';
import type { DataSource, Repository } from 'typeorm';
import { AppDataSource } from '../../../src/data-source';
import type { DailyCheckIn } from '../../../src/entities/DailyCheckIn';
import wpRoutes from '../../../src/routes/wpRoutes';
import { errorHandler } from '../../../src/middleware/errorMiddleware';

jest.mock('../../../src/middleware/authMiddleware', () => ({
  authMiddleware: jest.fn(
    (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()
  ),
}));

jest.mock('../../../src/utils/rateLimiter', () => ({
  rateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next(),
}));

jest.mock('../../../src/data-source', () => ({
  AppDataSource: {
    initialize: jest.fn(() => Promise.resolve()),
    getRepository: jest.fn(),
  },
}));

describe('WP Routes', () => {
  const findMock = jest.fn() as jest.MockedFunction<Repository<DailyCheckIn>['find']>;
  const mockedAppDataSource = AppDataSource as unknown as jest.Mocked<DataSource>;
  const app = express();

  app.use(express.json());
  app.use('/api/wp', wpRoutes);
  app.use(errorHandler);

  beforeEach(() => {
    findMock.mockReset();
    mockedAppDataSource.getRepository.mockReturnValue({
      find: findMock,
    } as unknown as Repository<DailyCheckIn>);
  });

  it('computes WP status based on historical check-ins', async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const checkIns: Partial<DailyCheckIn>[] = [{ createdAt: yesterday }, { createdAt: today }];
    findMock.mockResolvedValue(
      checkIns.map((ci, index) => ({
        id: index + 1,
        userId: 42,
        mood: 'good',
        stressLevel: 2,
        journalEntry: '',
        checkInDate: ci.createdAt,
        user: null,
        ...ci,
      })) as DailyCheckIn[]
    );

    const response = await request(app)
      .get('/api/wp/wp-status')
      .set('user-email', 'demo@example.com');

    expect(response.status).toBe(200);
    expect(response.body.results).toEqual({ wp: 20 });
  });

  it('returns 400 when header is missing', async () => {
    const response = await request(app).get('/api/wp/wp-status');

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Missing user email/i);
  });
});
