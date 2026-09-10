const DEVICE_ID_KEY = 'anuva-family-device-id';

/** Its own key, not the patient app's: the two apps may well be installed on the same phone. */
export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }

    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
