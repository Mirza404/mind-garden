import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import type { MockedFunction } from 'jest-mock';
import { authMiddleware } from '../../../src/middleware/authMiddleware';
import { throwError } from '../../../src/utils/responseHandlers';

jest.mock('../../../src/utils/responseHandlers', () => ({
  throwError: jest.fn(),
}));

type MockTicket = { getPayload: () => { email?: string; name?: string } };
type VerifyIdTokenFn = (options: Record<string, unknown>) => Promise<MockTicket>;
type GlobalWithVerifyMock = typeof globalThis & {
  __verifyIdTokenMock__?: MockedFunction<VerifyIdTokenFn>;
};

jest.mock('google-auth-library', () => {
  const verifyIdToken = jest.fn() as MockedFunction<VerifyIdTokenFn>;
  (global as GlobalWithVerifyMock).__verifyIdTokenMock__ = verifyIdToken;
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken,
    })),
  };
});

const verifyIdToken = (global as GlobalWithVerifyMock).__verifyIdTokenMock__!;

describe('authMiddleware', () => {
  const mockNext = jest.fn() as NextFunction;
  const mockResponse = {} as Response;
  const mockThrowError = throwError as jest.MockedFunction<typeof throwError>;

  beforeEach(() => {
    jest.clearAllMocks();
    verifyIdToken.mockReset();
    process.env.NODE_ENV = 'test';
    mockThrowError.mockImplementation((message: string, statusCode = 400) => {
      const error = new Error(message);
      // @ts-expect-error augment error for assertions if needed
      error.statusCode = statusCode;
      throw error;
    });
  });

  it('calls next immediately when NODE_ENV is not production', async () => {
    process.env.NODE_ENV = 'development';
    const mockRequest = {
      headers: {},
    } as Request;

    await authMiddleware(mockRequest, mockResponse, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockThrowError).not.toHaveBeenCalled();
  });

  it('throws 401 when authorization header is missing in production', async () => {
    process.env.NODE_ENV = 'production';
    const mockRequest = {
      headers: {},
    } as Request;

    await expect(authMiddleware(mockRequest, mockResponse, mockNext)).rejects.toThrow(
      /Missing or invalid token/i
    );

    expect(mockThrowError).toHaveBeenCalledWith('Missing or invalid token', 401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('throws when bearer token is missing the JWT segments', async () => {
    process.env.NODE_ENV = 'production';
    const mockRequest = {
      headers: {
        authorization: 'Bearer abc.def',
      },
    } as Request;

    await expect(authMiddleware(mockRequest, mockResponse, mockNext)).rejects.toThrow(
      /Invalid token format/i
    );

    expect(mockThrowError).toHaveBeenCalledWith('Invalid token format', 401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('throws when bearer token is provided without the token string', async () => {
    process.env.NODE_ENV = 'production';
    const mockRequest = {
      headers: {
        authorization: 'Bearer ',
      },
    } as Request;

    await expect(authMiddleware(mockRequest, mockResponse, mockNext)).rejects.toThrow(
      /Missing or invalid token/i
    );

    expect(mockThrowError).toHaveBeenCalledWith('Missing or invalid token', 401);
  });

  it('bubbles up verification errors from Google', async () => {
    process.env.NODE_ENV = 'production';
    verifyIdToken.mockRejectedValue(new Error('Token expired'));
    const mockRequest = {
      headers: {
        authorization: 'Bearer header.payload.signature',
      },
    } as Request;

    await expect(authMiddleware(mockRequest, mockResponse, mockNext)).rejects.toThrow(
      /Error verifying token/i
    );
    expect(mockThrowError).toHaveBeenCalledWith('Error verifying token: Token expired', 401);
  });

  it('attaches the user and calls next when verification succeeds', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GOOGLE_ID = 'test-google-id';
    const payload = { email: 'user@example.com', name: 'Demo User' };
    const fakeTicket: MockTicket = {
      getPayload: () => payload,
    };
    verifyIdToken.mockResolvedValue(fakeTicket);
    const mockRequest = {
      headers: {
        authorization: 'Bearer header.payload.signature',
      },
    } as Request;

    await authMiddleware(mockRequest, mockResponse, mockNext);

    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'header.payload.signature',
      audience: 'test-google-id',
    });
    expect(mockRequest.user).toEqual({
      email: 'user@example.com',
      name: 'Demo User',
    });
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('throws when payload lacks an email', async () => {
    process.env.NODE_ENV = 'production';
    const fakeTicket: MockTicket = {
      getPayload: () => ({}),
    };
    verifyIdToken.mockResolvedValue(fakeTicket);
    const mockRequest = {
      headers: {
        authorization: 'Bearer header.payload.signature',
      },
    } as Request;

    await expect(authMiddleware(mockRequest, mockResponse, mockNext)).rejects.toThrow(
      /Invalid token, no email found/i
    );

    expect(mockThrowError).toHaveBeenCalledWith('Invalid token, no email found', 401);
    expect(mockNext).not.toHaveBeenCalled();
  });
});
