import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import type { DataSource, Repository } from 'typeorm';
import app from '../../../src/index';
import { AppDataSource } from '../../../src/data-source';
import { getUserByEmail } from '../../../src/utils/idHandler';
import type { DailyCheckIn } from '../../../src/entities/DailyCheckIn';
import type { User } from '../../../src/entities/User';

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
  const createMock: jest.Mock = jest.fn();
  const saveMock: jest.Mock = jest.fn();
  const mockedAppDataSource = AppDataSource as unknown as jest.Mocked<DataSource>;
  const mockedGetUserByEmail = getUserByEmail as jest.MockedFunction<typeof getUserByEmail>;

  beforeEach(() => {
    createMock.mockReset();
    saveMock.mockReset();
    mockedAppDataSource.getRepository.mockReturnValue({
      create: createMock,
      save: saveMock,
    } as unknown as Repository<DailyCheckIn>);
    mockedGetUserByEmail.mockResolvedValue({ id: 42 } as User);
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
});
