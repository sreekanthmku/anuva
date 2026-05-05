const AUTH_STORAGE_KEY = 'anuva-auth';

export function getSessionUsername(): string | null {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return getSessionUsername() !== null;
}

export function setSession(username: string): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, username);
  } catch {
    /* ignore */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Demo credentials: username and password both `anuva`. */
export function tryLogin(username: string, password: string): boolean {
  const u = username.trim().toLowerCase();
  if (u === 'anuva' && password === 'anuva') {
    setSession(u);
    return true;
  }
  return false;
}
