import { describe, it, expect, jest } from '@jest/globals';
import type { Options as RateLimitOptions } from 'express-rate-limit';

const loadRateLimiter = (returnValue: symbol = Symbol('rate-limit')) => {
  let capturedOptions: RateLimitOptions | undefined;
  let exportedModule: typeof import('../../../src/utils/rateLimiter');

  jest.isolateModules(() => {
    jest.doMock('express-rate-limit', () => {
      const mock = jest.fn((options: RateLimitOptions) => {
        capturedOptions = options;
        return returnValue;
      });
      return {
        __esModule: true,
        default: mock,
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports -- need dynamic require while module is mocked
    exportedModule =
      require('../../../src/utils/rateLimiter') as typeof import('../../../src/utils/rateLimiter');
  });

  return { exportedModule: exportedModule!, capturedOptions };
};

describe('rateLimiter utility', () => {
  it('configures express-rate-limit with expected defaults', () => {
    const { capturedOptions } = loadRateLimiter();

    expect(capturedOptions).toMatchObject({
      windowMs: 60 * 1000,
      max: 100,
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
  });

  it('exports the middleware returned by express-rate-limit', () => {
    const middlewareSymbol = Symbol('rate-limit-middle');
    const { exportedModule } = loadRateLimiter(middlewareSymbol);

    expect(exportedModule.rateLimiter).toBe(middlewareSymbol);
  });
});
