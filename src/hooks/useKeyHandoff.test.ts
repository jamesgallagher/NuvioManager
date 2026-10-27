import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { useKeyHandoff } from './useKeyHandoff';

function b64url(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Build a fake JWT (header.payload.signature) with a dummy signature. */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  return `${header}.${body}.fakesignature`;
}

const anonKey = fakeJwt({ role: 'anon' });
const serviceRoleKey = fakeJwt({ role: 'service_role' });

// No JSX (this file is .ts): build the test component with React.createElement.
function TestComponent() {
  const { result, dismiss } = useKeyHandoff();
  return React.createElement(
    'div',
    null,
    React.createElement(
      'span',
      { 'data-testid': 'result' },
      result ? (result.ok ? `ok:${result.masked}` : `fail:${result.reason}`) : 'none'
    ),
    React.createElement(
      'button',
      { 'data-testid': 'dismiss', onClick: dismiss },
      'dismiss'
    )
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
  vi.restoreAllMocks();
});

describe('useKeyHandoff', () => {
  it('a valid fragment saves the key, returns the masked result, and removes the fragment', () => {
    window.location.hash = `#nuvio-key=${encodeURIComponent(anonKey)}`;
    render(React.createElement(TestComponent));
    const masked = anonKey.slice(0, 8) + '…' + anonKey.slice(-4);
    expect(screen.getByTestId('result').textContent).toBe(`ok:${masked}`);
    expect(window.location.hash).toBe('');
    const settings = JSON.parse(localStorage.getItem('nuvio_server_settings_v1')!);
    expect(settings.supabaseAnonKey).toBe(anonKey);
  });

  it('a service_role fragment returns fail role, saves nothing, and removes the fragment', () => {
    window.location.hash = `#nuvio-key=${encodeURIComponent(serviceRoleKey)}`;
    render(React.createElement(TestComponent));
    expect(screen.getByTestId('result').textContent).toBe('fail:role');
    expect(window.location.hash).toBe('');
    expect(localStorage.getItem('nuvio_server_settings_v1')).toBeNull();
  });

  it('a garbage fragment → failure, removed, nothing saved', () => {
    window.location.hash = '#nuvio-key=garbage';
    render(React.createElement(TestComponent));
    expect(screen.getByTestId('result').textContent).toBe('fail:format');
    expect(window.location.hash).toBe('');
    expect(localStorage.getItem('nuvio_server_settings_v1')).toBeNull();
  });

  it('no fragment → result null and replaceState not called', () => {
    const spy = vi.spyOn(window.history, 'replaceState');
    render(React.createElement(TestComponent));
    expect(screen.getByTestId('result').textContent).toBe('none');
    expect(spy).not.toHaveBeenCalled();
  });

  it('dismiss() clears the result', async () => {
    const user = userEvent.setup();
    window.location.hash = `#nuvio-key=${encodeURIComponent(anonKey)}`;
    render(React.createElement(TestComponent));
    expect(screen.getByTestId('result').textContent).toMatch(/^ok:/);
    await user.click(screen.getByTestId('dismiss'));
    expect(screen.getByTestId('result').textContent).toBe('none');
  });
});
