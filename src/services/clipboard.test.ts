import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyText } from './clipboard';

function setSecureContext(value: boolean) {
  Object.defineProperty(window, 'isSecureContext', { value, configurable: true });
}

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

function setExecCommand(fn: unknown) {
  Object.defineProperty(document, 'execCommand', { value: fn, configurable: true });
}

afterEach(() => {
  setSecureContext(false);
  setClipboard(undefined);
  setExecCommand(undefined);
});

describe('copyText', () => {
  it('secure context uses navigator.clipboard.writeText and returns true', async () => {
    setSecureContext(true);
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    const result = await copyText('hello');
    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('insecure context uses the textarea fallback, calls execCommand, removes the textarea and returns true', async () => {
    setSecureContext(false);
    setClipboard(undefined);
    const execCommand = vi.fn().mockReturnValue(true);
    setExecCommand(execCommand);
    const result = await copyText('hello');
    expect(result).toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('secure context with a failing writeText returns false without throwing', async () => {
    setSecureContext(true);
    const writeText = vi.fn().mockRejectedValue(new Error('blocked'));
    setClipboard({ writeText });
    const result = await copyText('hello');
    expect(result).toBe(false);
  });

  it('insecure context with a failing execCommand returns false without throwing', async () => {
    setSecureContext(false);
    setClipboard(undefined);
    const execCommand = vi.fn().mockReturnValue(false);
    setExecCommand(execCommand);
    const result = await copyText('hello');
    expect(result).toBe(false);
  });
});
