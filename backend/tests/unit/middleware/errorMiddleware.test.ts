import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { AppError, errorHandler } from '../../../src/middleware/errorMiddleware';

const createMockResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  return res as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
};

describe('errorHandler', () => {
  const mockRequest = {} as Request;
  const mockNext = jest.fn() as NextFunction;
  let mockResponse: ReturnType<typeof createMockResponse>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResponse = createMockResponse();
  });

  it('responds with AppError status and message when custom error is thrown', () => {
    const appError = new AppError('Forbidden', 403);
    process.env.NODE_ENV = 'test';

    errorHandler(appError, mockRequest, mockResponse, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      message: 'Forbidden',
      stack: undefined,
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('responds with 500 and exposes stack in development for unexpected errors', () => {
    const genericError = new Error('Boom');
    process.env.NODE_ENV = 'development';

    errorHandler(genericError, mockRequest, mockResponse, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Boom',
        stack: expect.stringContaining('Error: Boom'),
      })
    );
  });

  it('hides stack traces when not in development mode', () => {
    const genericError = new Error('Boom');
    process.env.NODE_ENV = 'production';

    errorHandler(genericError, mockRequest, mockResponse, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      message: 'Boom',
      stack: undefined,
    });
  });
});
