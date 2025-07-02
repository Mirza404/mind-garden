export type Achievement = {
  id: number;
  title: string;
  description: string;
  unlocked: boolean;
  date: string | null;
};

export type AchievementData = {
  id: number;
  title: string;
  description: string;
};
