import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Repository } from 'typeorm';
import type { User } from '../../../src/entities/User';
import { AppDataSource } from '../../../src/data-source';
import { getUserByEmail } from '../../../src/utils/idHandler';
import { throwError } from '../../../src/utils/responseHandlers';

jest.mock('../../../src/data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../../src/utils/responseHandlers', () => ({
  throwError: jest.fn(),
}));

describe('getUserByEmail', () => {
  const mockedGetRepository = AppDataSource.getRepository as jest.MockedFunction<
    typeof AppDataSource.getRepository
  >;
  const mockedThrowError = throwError as jest.MockedFunction<typeof throwError>;
  const findOne = jest.fn() as jest.MockedFunction<Repository<User>['findOne']>;

  beforeEach(() => {
    jest.clearAllMocks();
    findOne.mockReset();
    mockedGetRepository.mockReturnValue({ findOne } as unknown as Repository<User>);
  });

  it('throws when email is missing', async () => {
    mockedThrowError.mockImplementation((message: string) => {
      throw new Error(message);
    });

    await expect(getUserByEmail('')).rejects.toThrow('User email is required');
    expect(mockedThrowError).toHaveBeenCalledWith('User email is required', 400);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('returns the user when repository finds a record', async () => {
    const fakeUser = { id: 99, email: 'demo@example.com' } as User;
    findOne.mockResolvedValue(fakeUser);

    const result = await getUserByEmail('demo@example.com');

    expect(findOne).toHaveBeenCalledWith({ where: { email: 'demo@example.com' } });
    expect(result).toBe(fakeUser);
    expect(mockedThrowError).not.toHaveBeenCalled();
  });

  it('throws when repository returns null', async () => {
    findOne.mockResolvedValue(null);
    mockedThrowError.mockImplementation((message: string) => {
      throw new Error(message);
    });

    await expect(getUserByEmail('missing@example.com')).rejects.toThrow('User not found');
    expect(mockedThrowError).toHaveBeenCalledWith('User not found', 401);
  });
});
