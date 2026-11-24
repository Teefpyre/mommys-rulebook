export const STUDIO_PASSWORD = 'demo-password';

const UNLOCK_KEY = 'daily_rulebook_studio_v1';

export function isStudioPassword(candidate: string): boolean {
  return candidate.trim() === STUDIO_PASSWORD;
}

export function isStudioRemembered(): boolean {
  try {
    return window.localStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export function setStudioRemembered(remember: boolean): void {
  try {
    if (remember) window.localStorage.setItem(UNLOCK_KEY, '1');
    else window.localStorage.removeItem(UNLOCK_KEY);
  } catch {
    // Ignore storage access errors in restricted modes.
  }
}
