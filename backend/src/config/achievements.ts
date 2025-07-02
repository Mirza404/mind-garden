import type { AchievementData } from '../types/Achievement';

const firstSteps: AchievementData = {
  id: 1,
  title: 'First Steps',
  description: 'Complete your first check-in',
};
const weekWarrior: AchievementData = {
  id: 2,
  title: 'Week Warrior',
  description: 'Complete 7 consecutive daily check-ins',
};

const mindfullnessMaster: AchievementData = {
  id: 3,
  title: 'Mindfulness Master',
  description: 'Complete 30 daily check-ins',
};

const reflectionGuru: AchievementData = {
  id: 4,
  title: 'Reflection Guru',
  description: 'Write 10 journal entries',
};

const selfCareChampion: AchievementData = {
  id: 5,
  title: 'Self-Care Champion',
  description: 'Report 5 consecutive days of positive mood',
};

export const achievements: AchievementData[] = [
  firstSteps,
  weekWarrior,
  mindfullnessMaster,
  reflectionGuru,
  selfCareChampion,
];
