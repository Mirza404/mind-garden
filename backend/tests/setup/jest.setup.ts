import { afterEach, jest } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY ?? 'test-groq-api-key';
process.env.GROQ_CHAT_MODEL = process.env.GROQ_CHAT_MODEL ?? 'mock-model';

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});
