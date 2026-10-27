/**
 * Convert an unknown error into a string message, falling back to a default.
 */
export function toErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}
