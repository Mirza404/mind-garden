import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { Response } from 'express';
import { sendSuccess, throwError } from '../../../src/utils/responseHandlers';
import { AppError } from '../../../src/middleware/errorMiddleware';
import type { SpyInstance } from 'jest-mock';

const createMockResponse = () => {
  const json = jest.fn();
  const res = {
    status: jest.fn().mockReturnThis(),
    json,
  };
  return res as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
};

describe('responseHandlers', () => {
  let mockResponse: ReturnType<typeof createMockResponse>;
  let consoleSpy: SpyInstance;

  beforeEach(() => {
    mockResponse = createMockResponse();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('sendSuccess', () => {
    it('sends default status 200 payload', () => {
      const payload = { message: 'ok' };
      sendSuccess(mockResponse, payload);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        results: payload,
      });
    });

    it('allows overriding the status code', () => {
      sendSuccess(mockResponse, { created: true }, 201);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });
  });

  describe('throwError', () => {
    it('logs and throws an AppError with the provided message/status', () => {
      let capturedError: AppError | undefined;
      try {
        throwError('Boom!', 422);
      } catch (error) {
        capturedError = error as AppError;
      }

      expect(capturedError).toBeInstanceOf(AppError);
      expect(capturedError?.message).toBe('Boom!');
      expect(capturedError?.statusCode).toBe(422);
      expect(consoleSpy).toHaveBeenCalledWith('Error: Boom! (Status Code: 422)');
    });
  });
});
