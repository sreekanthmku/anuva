/** In-memory Storage stand-in for Node vitest (no real localStorage). */
export function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map<string, string>(Object.entries(initial));

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

/** Storage that throws on every access — exercises catch fallbacks. */
export function createThrowingStorage(): Storage {
  const boom = () => {
    throw new Error('localStorage unavailable');
  };
  return {
    get length() {
      return boom() as never;
    },
    clear: boom,
    getItem: boom,
    key: boom,
    removeItem: boom,
    setItem: boom,
  };
}
