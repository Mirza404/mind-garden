import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../src/index';
import { fetchCheckInsForUser } from '../../../src/controllers/dailyCheckInController';
import type { DailyCheckIn } from '../../../src/entities/DailyCheckIn';

jest.mock('../../../src/controllers/dailyCheckInController', () => {
  const actual = jest.requireActual<
    typeof import('../../../src/controllers/dailyCheckInController')
  >('../../../src/controllers/dailyCheckInController');
  return {
    ...actual,
    fetchCheckInsForUser: jest.fn(),
  };
});

const mockedFetch = fetchCheckInsForUser as jest.MockedFunction<typeof fetchCheckInsForUser>;

describe('Achievement Routes', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('builds achievement payloads based on user history', async () => {
    const baseDate = new Date('2024-07-01T10:00:00Z');
    const generateCheckIn = (offsetDays: number, data?: Partial<DailyCheckIn>): DailyCheckIn => {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + offsetDays);
      return {
        id: offsetDays + 1,
        userId: 7,
        checkInDate: date,
        createdAt: date,
        mood: 'good',
        stressLevel: 3,
        journalEntry: offsetDays < 10 ? 'Entry' : '',
        user: null,
        ...data,
      };
    };

    const streakEntries = Array.from({ length: 7 }, (_, idx) => generateCheckIn(idx));
    const journalEntries = Array.from({ length: 10 }, (_, idx) =>
      generateCheckIn(idx + 7, { journalEntry: 'Dear diary' })
    );
    const positiveStreak = Array.from({ length: 5 }, (_, idx) =>
      generateCheckIn(idx + 17, { mood: 'great' })
    );
    mockedFetch.mockResolvedValue([...streakEntries, ...journalEntries, ...positiveStreak]);

    const response = await request(app)
      .get('/api/achievements')
      .set('user-email', 'demo@example.com');

    expect(response.status).toBe(200);
    const achievements = response.body.results.achievements;
    expect(achievements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, unlocked: true }),
        expect.objectContaining({ id: 2, unlocked: true }),
        expect.objectContaining({ id: 4, unlocked: true }),
        expect.objectContaining({ id: 5, unlocked: true }),
      ])
    );
    expect(mockedFetch).toHaveBeenCalledWith('demo@example.com');
  });

  it('requires an email header', async () => {
    const response = await request(app).get('/api/achievements');

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Missing email/i);
  });
});
