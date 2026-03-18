import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import type { DataSource, Repository } from 'typeorm';
import app from '../../../src/index';
import { AppDataSource } from '../../../src/data-source';
import { getUserByEmail } from '../../../src/utils/idHandler';
import type { Chat } from '../../../src/entities/Chat';
import type { User } from '../../../src/entities/User';

type GroqStream = AsyncGenerator<
  { choices: Array<{ delta: { content?: string } }> },
  void,
  unknown
>;

type GlobalWithGroqMocks = typeof globalThis & {
  __groqCreateMock__?: jest.MockedFunction<() => Promise<GroqStream>>;
  __groqConstructor__?: jest.Mock;
};

jest.mock('groq-sdk', () => {
  const create = jest.fn() as unknown as jest.MockedFunction<() => Promise<GroqStream>>;
  const constructorMock = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create,
      },
    },
  }));
  (global as GlobalWithGroqMocks).__groqCreateMock__ = create;
  (global as GlobalWithGroqMocks).__groqConstructor__ = constructorMock;
  return {
    __esModule: true,
    default: constructorMock,
  };
});

const groqCreateMock = (global as GlobalWithGroqMocks).__groqCreateMock__!;
const groqConstructor = (global as GlobalWithGroqMocks).__groqConstructor__!;

jest.mock('../../../src/data-source', () => ({
  AppDataSource: {
    initialize: jest.fn(() => Promise.resolve()),
    getRepository: jest.fn(),
  },
}));

jest.mock('../../../src/utils/idHandler', () => ({
  getUserByEmail: jest.fn(),
}));

const buildStream = (chunks: string[]): GroqStream => {
  async function* generator(): GroqStream {
    for (const content of chunks) {
      yield { choices: [{ delta: { content } }] };
    }
  }
  return generator();
};

describe('Chat Routes', () => {
  const saveMock = jest.fn() as unknown as jest.MockedFunction<Repository<Chat>['save']>;
  const findMock = jest.fn() as unknown as jest.MockedFunction<Repository<Chat>['find']>;
  const findAndCountMock = jest.fn() as unknown as jest.MockedFunction<
    Repository<Chat>['findAndCount']
  >;
  const deleteMock = jest.fn() as unknown as jest.MockedFunction<Repository<Chat>['delete']>;
  const mockedAppDataSource = AppDataSource as unknown as jest.Mocked<DataSource>;
  const mockedGetUserByEmail = getUserByEmail as jest.MockedFunction<typeof getUserByEmail>;

  beforeEach(() => {
    saveMock.mockReset();
    findMock.mockReset();
    findAndCountMock.mockReset();
    deleteMock.mockReset();
    groqCreateMock.mockReset();
    mockedGetUserByEmail.mockResolvedValue({ id: 9 } as User);
    mockedAppDataSource.getRepository.mockReturnValue({
      save: saveMock,
      find: findMock,
      findAndCount: findAndCountMock,
      delete: deleteMock,
    } as unknown as Repository<Chat>);
  });

  it('streams chat completions and stores assistant response', async () => {
    findMock.mockResolvedValue([] as Chat[]);
    groqCreateMock.mockResolvedValue(buildStream(['Hello', ' world']));

    const response = await request(app)
      .post('/api/chat')
      .set('user-email', 'demo@example.com')
      .send({ input: 'Hi there' });

    expect(response.status).toBe(200);
    expect(response.text).toContain('data: Hello');
    expect(response.text).toContain('data: [DONE]');
    expect(saveMock).toHaveBeenCalledTimes(2);
    expect(mockedGetUserByEmail).toHaveBeenCalledWith('demo@example.com');

    const [userMessage] = saveMock.mock.calls[0] as [Chat];
    expect(userMessage.role).toBe('user');
    expect(userMessage.content).toBe('Hi there');

    const [assistantMessage] = saveMock.mock.calls[1] as [Chat];
    expect(assistantMessage.role).toBe('assistant');
    expect(assistantMessage.content).toBe('Hello world');
  });

  it('validates POST payload', async () => {
    const response = await request(app).post('/api/chat').send({ input: 'Missing header' });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Email and input are required/i);
  });

  it('serves chat history with pagination metadata', async () => {
    const chatRecord: Chat = {
      id: 1,
      role: 'assistant',
      content: 'Hi!',
      created_at: new Date('2024-07-01T10:00:00Z'),
      user: { id: 9 } as User,
    };
    findAndCountMock.mockResolvedValue([[chatRecord], 1] as [Chat[], number]);

    const response = await request(app)
      .get('/api/chat/history/?offset=0&limit=1')
      .set('user-email', 'demo@example.com');

    expect(response.status).toBe(200);
    expect(response.body.results.total).toBe(1);
    expect(response.body.results.messages).toEqual([
      expect.objectContaining({
        id: 1,
        content: 'Hi!',
      }),
    ]);
    expect(findAndCountMock).toHaveBeenCalledWith({
      where: { user: { id: 9 } },
      order: { created_at: 'DESC' },
      skip: 0,
      take: 1,
    });
  });

  it('deletes chat history', async () => {
    const deleteResult = { affected: 1 } as Awaited<ReturnType<Repository<Chat>['delete']>>;
    deleteMock.mockResolvedValue(deleteResult);

    const response = await request(app)
      .delete('/api/chat/history/delete')
      .send({ email: 'demo@example.com' });

    expect(response.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith({ user: { id: 9 } });
    expect(response.body.results.message).toMatch(/deleted/i);
  });
});
