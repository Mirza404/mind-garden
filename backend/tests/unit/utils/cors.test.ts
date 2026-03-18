import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { SpyInstance } from 'jest-mock';
import { corsOptions } from '../../../src/utils/cors';

type CorsCallback = (err: Error | null, allowed?: boolean) => void;
type OriginHandler = (origin: string | undefined, callback: CorsCallback) => void;

const getOriginHandler = () => corsOptions.origin as OriginHandler;

describe('corsOptions.origin', () => {
  const whitelistOrigin = 'http://localhost:3000';
  const disallowedOrigin = 'http://malicious.example.com';
  let callback: jest.MockedFunction<CorsCallback>;
  let consoleSpy: SpyInstance;

  beforeEach(() => {
    callback = jest.fn();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('allows undefined origin (non-browser clients)', () => {
    getOriginHandler()(undefined, callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('allows origins present in the whitelist', () => {
    getOriginHandler()(whitelistOrigin, callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('rejects unknown origins and logs the event', () => {
    getOriginHandler()(disallowedOrigin, callback);

    expect(consoleSpy).toHaveBeenCalledWith(
      `Rejecting request from unauthorized origin: ${disallowedOrigin}`
    );
    const errArg = callback.mock.calls[0][0];
    expect(errArg).toBeInstanceOf(Error);
    expect(errArg?.message).toMatch(/not allowed by CORS/i);
  });
});
