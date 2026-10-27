import { describe, it, expect } from 'vitest';
import { toErrorMessage } from './errors';

describe('toErrorMessage', () => {
  it('for Error', () => {
    expect(toErrorMessage(new Error('test error'), 'fallback')).toBe('test error');
  });

  it('for string', () => {
    expect(toErrorMessage('string error', 'fallback')).toBe('string error');
  });

  it('for object with message', () => {
    expect(toErrorMessage({ message: 'object error' }, 'fallback')).toBe('object error');
  });

  it('for null', () => {
    expect(toErrorMessage(null, 'fallback')).toBe('fallback');
  });

  it('with the fallback', () => {
    expect(toErrorMessage(123, 'fallback')).toBe('fallback');
  });
});
