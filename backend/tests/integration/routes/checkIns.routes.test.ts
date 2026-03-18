import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import type { DataSource, Repository } from 'typeorm';
import app from '../../../src/index';
import { AppDataSource } from '../../../src/data-source';
import { getUserByEmail } from '../../../src/utils/idHandler';
import type { DailyCheckIn } from '../../../src/entities/DailyCheckIn';
import type { User } from '../../../src/entities/User';
import * as dailyCheckInController from '../../../src/controllers/dailyCheckInController';

jest.mock('../../../src/data-source', () => ({
  AppDataSource: {
    initialize: jest.fn(() => Promise.resolve()),
    getRepository: jest.fn(),
  },
}));

jest.mock('../../../src/utils/idHandler', () => ({
  getUserByEmail: jest.fn(),
}));

describe('Daily Check-In Routes', () => {
  const createMock = jest.fn();
  const saveMock = jest.fn();
  const findMock = jest.fn() as jest.MockedFunction<Repository<DailyCheckIn>['find']>;
  const findOneMock = jest.fn() as jest.MockedFunction<Repository<DailyCheckIn>['findOne']>;
  const repoMock = {
    create: createMock,
    save: saveMock,
    find: findMock,
    findOne: findOneMock,
  };
  const mockedAppDataSource = AppDataSource as unknown as jest.Mocked<DataSource>;
  const mockedGetUserByEmail = getUserByEmail as jest.MockedFunction<typeof getUserByEmail>;
  const calculateStreakSpy = jest.spyOn(dailyCheckInController, 'calculateStreak');

  beforeEach(() => {
    Object.values(repoMock).forEach((mockFn) => mockFn.mockReset());
    calculateStreakSpy.mockReset();
    mockedAppDataSource.getRepository.mockReturnValue(
      repoMock as unknown as Repository<DailyCheckIn>
    );
    mockedGetUserByEmail.mockResolvedValue({ id: 42 } as User);
  });

  afterAll(() => {
    calculateStreakSpy.mockRestore();
  });

  it('creates a daily check-in when payload is valid', async () => {
    type MoodType = DailyCheckIn['mood'];
    const payload: { mood: MoodType; stressLevel: number; journalEntry: string } = {
      mood: 'good',
      stressLevel: 3,
      journalEntry: 'Meditation session',
    };
    const fakeCheckIn: DailyCheckIn = {
      id: 1,
      userId: 42,
      mood: payload.mood,
      stressLevel: payload.stressLevel,
      journalEntry: payload.journalEntry,
      createdAt: new Date('2024-07-01T10:00:00Z'),
      checkInDate: new Date('2024-07-01T00:00:00Z'),
      user: null,
    };

    createMock.mockReturnValue(fakeCheckIn);
    saveMock.mockImplementation(async () => fakeCheckIn);

    const response = await request(app)
      .post('/api/check-ins')
      .set('user-email', 'demo@example.com')
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      results: {
        ...fakeCheckIn,
        createdAt: fakeCheckIn.createdAt.toISOString(),
        checkInDate: fakeCheckIn.checkInDate.toISOString(),
      },
    });
    expect(mockedGetUserByEmail).toHaveBeenCalledWith('demo@example.com');
    expect(createMock).toHaveBeenCalledWith({
      userId: 42,
      mood: 'good',
      stressLevel: 3,
      journalEntry: 'Meditation session',
    });
    expect(saveMock).toHaveBeenCalledWith(fakeCheckIn);
  });

  it('returns 400 when payload is missing required fields', async () => {
    const response = await request(app)
      .post('/api/check-ins')
      .set('user-email', 'demo@example.com')
      .send({ stressLevel: 4 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/Missing required fields/i);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects invalid mood values', async () => {
    const response = await request(app)
      .post('/api/check-ins')
      .set('user-email', 'demo@example.com')
      .send({ mood: 'amazing', stressLevel: 3 });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Invalid mood value/i);
  });

  it('rejects stress levels outside 1-5', async () => {
    const response = await request(app)
      .post('/api/check-ins')
      .set('user-email', 'demo@example.com')
      .send({ mood: 'good', stressLevel: 7 });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Stress level must be between 1 and 5/i);
  });

  it('returns the latest check-in when querying GET /api/check-ins', async () => {
    const latestCheckIn: DailyCheckIn = {
      id: 2,
      userId: 42,
      mood: 'great',
      stressLevel: 1,
      journalEntry: 'Feeling good',
      createdAt: new Date('2024-08-01T10:00:00Z'),
      checkInDate: new Date('2024-08-01'),
      user: null,
    };
    findOneMock.mockResolvedValue(latestCheckIn);

    const response = await request(app).get('/api/check-ins').set('user-email', 'demo@example.com');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.results).toMatchObject({
      ...latestCheckIn,
      createdAt: latestCheckIn.createdAt.toISOString(),
      checkInDate: latestCheckIn.checkInDate.toISOString(),
    });
    expect(findOneMock).toHaveBeenCalledWith({
      where: { userId: 42 },
      order: { createdAt: 'DESC' },
    });
  });

  it('requires an email header for GET requests', async () => {
    const response = await request(app).get('/api/check-ins');

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Missing email/i);
  });

  it('returns history ordered ascending for GET /history', async () => {
    const records: DailyCheckIn[] = [
      {
        id: 1,
        userId: 42,
        mood: 'good',
        stressLevel: 3,
        journalEntry: '',
        createdAt: new Date('2024-07-01T10:00:00Z'),
        checkInDate: new Date('2024-07-01'),
        user: null,
      },
      {
        id: 2,
        userId: 42,
        mood: 'great',
        stressLevel: 2,
        journalEntry: 'Nice day',
        createdAt: new Date('2024-07-02T10:00:00Z'),
        checkInDate: new Date('2024-07-02'),
        user: null,
      },
    ];
    findMock.mockResolvedValue(records);

    const response = await request(app)
      .get('/api/check-ins/history')
      .set('user-email', 'demo@example.com');

    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(2);
    expect(findMock).toHaveBeenCalledWith({
      where: { userId: 42 },
      order: { createdAt: 'ASC' },
    });
  });

  it('returns the computed streak when hitting /streak', async () => {
    jest.useFakeTimers();
    try {
      const baseDate = new Date('2024-07-10T12:00:00Z');
      jest.setSystemTime(baseDate);
      const repoResults: DailyCheckIn[] = Array.from({ length: 5 }, (_, idx) => {
        const date = new Date(baseDate);
        date.setUTCDate(baseDate.getUTCDate() - idx);
        return {
          id: idx + 1,
          userId: 42,
          mood: 'good',
          stressLevel: 2,
          journalEntry: '',
          createdAt: date,
          checkInDate: date,
          user: null,
        };
      });
      calculateStreakSpy.mockReturnValue(5);
      findMock.mockResolvedValue(repoResults);

      const response = await request(app)
        .get('/api/check-ins/streak')
        .set('user-email', 'demo@example.com');

      expect(response.status).toBe(200);
      expect(response.body.results).toEqual({ streak: 5 });
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns a 7-day mood history with null placeholders', async () => {
    jest.useFakeTimers();
    const today = new Date('2024-07-07T12:00:00Z');
    jest.setSystemTime(today);
    const entries: DailyCheckIn[] = [
      {
        id: 10,
        userId: 42,
        mood: 'good',
        stressLevel: 2,
        journalEntry: '',
        createdAt: today,
        checkInDate: today,
        user: null,
      },
      {
        id: 11,
        userId: 42,
        mood: 'down',
        stressLevel: 4,
        journalEntry: '',
        createdAt: new Date('2024-07-05T12:00:00Z'),
        checkInDate: new Date('2024-07-05T00:00:00Z'),
        user: null,
      },
    ];
    findMock.mockResolvedValue(entries);

    try {
      const response = await request(app)
        .get('/api/check-ins/mood')
        .set('user-email', 'demo@example.com');

      expect(response.status).toBe(200);
      expect(response.body.results).toHaveLength(7);
      const todayEntry = response.body.results[response.body.results.length - 1];
      expect(todayEntry).toMatchObject({ mood: 'good', stressLevel: 2 });

      const missingDay = response.body.results.find(
        (item: { date: string }) => item.date === '2024-07-06'
      );
      expect(missingDay).toMatchObject({ mood: null, stressLevel: null });
    } finally {
      jest.useRealTimers();
    }
  });
});
