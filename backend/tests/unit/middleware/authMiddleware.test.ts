import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../../src/middleware/authMiddleware';
import { throwError } from '../../../src/utils/responseHandlers';

jest.mock('../../../src/utils/responseHandlers', () => ({
  throwError: jest.fn(),
}));

describe('authMiddleware', () => {
  const mockNext = jest.fn() as NextFunction;
  const mockResponse = {} as Response;
  const mockThrowError = throwError as jest.MockedFunction<typeof throwError>;

  beforeEach(() => {
    jest.clearAllMocks();
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
});
