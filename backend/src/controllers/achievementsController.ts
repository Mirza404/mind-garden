import { Request, Response } from 'express';
import { fetchCheckInsForUser } from './dailyCheckInController';
import { sendSuccess, throwError } from '../utils/responseHandlers';
import { achievements } from '../config/achievements';

export function getStreakDate(
  records: Array<{ checkInDate: Date; createdAt: Date }>,
  requiredStreak: number
): string | null {
  if (records.length < requiredStreak) return null;

  const sortedRecords = [...records].sort(
    (a, b) => new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()
  );

  let streak = 1;
  let earliestStreakDate: string | null = null;

  for (let i = 1; i < sortedRecords.length; i++) {
    const prevDate = new Date(sortedRecords[i - 1].checkInDate);
    const currDate = new Date(sortedRecords[i].checkInDate);

    const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      streak++;
      if (streak >= requiredStreak) {
        const currentStreakEndDate = sortedRecords[i].createdAt.toISOString();
        if (!earliestStreakDate || currentStreakEndDate < earliestStreakDate) {
          earliestStreakDate = currentStreakEndDate;
        }
      }
    } else if (diffDays > 1) {
      streak = 1;
    }
  }

  return earliestStreakDate;
}

export const getAchievements = async (req: Request, res: Response): Promise<void> => {
  const email = req.headers['user-email'] as string;
  if (!email) {
    throwError('Missing email. Log in!', 400);
  }

  const checkInsResponse = await fetchCheckInsForUser(email);
  const checkIns = checkInsResponse as Array<{
    checkInDate: Date;
    createdAt: Date;
    mood: string;
    journalEntry: string;
  }>;

  const achievementsData = achievements.map((achievement) => {
    switch (achievement.id) {
      case 1: // First Steps
        return {
          ...achievement,
          unlocked: checkIns.length >= 1,
          date: checkIns.length >= 1 ? new Date(checkIns[0].createdAt).toISOString() : null,
        };
      case 2: {
        // Week Warrior
        const weekWarriorDate = getStreakDate(checkIns, 7);
        return {
          ...achievement,
          unlocked: weekWarriorDate !== null,
          date: weekWarriorDate,
        };
      }
      case 4: {
        // Reflection Guru
        const journalEntries = checkIns.filter((checkIn) => checkIn.journalEntry);
        return {
          ...achievement,
          unlocked: journalEntries.length >= 10,
          date:
            journalEntries.length >= 10
              ? new Date(journalEntries[9].createdAt).toISOString()
              : null,
        };
      }
      case 5: {
        // Self-Care Champion
        const positiveCheckIns = checkIns.filter((checkIn) =>
          ['great', 'good'].includes(checkIn.mood.toLowerCase())
        );
        const selfCareDate = getStreakDate(positiveCheckIns, 5);
        return {
          ...achievement,
          unlocked: selfCareDate !== null,
          date: selfCareDate,
        };
      }
      default:
        return achievement;
    }
  });
  sendSuccess(res, { achievements: achievementsData }, 200);
};
