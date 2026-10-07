/** Pure helpers for syncing saved trips and stays between devices. No React in here, so they are easy to test. */

export type SyncableStore = {
  trips: { id: string; at: number }[];
  stays: { hotel: { id: string } }[];
};

const LIMIT = 30;

/** Union of this device and the account. The newer copy of a trip wins. */
export function mergeStores<S extends SyncableStore>(local: S, remote: unknown): S {
  const incoming = (remote && typeof remote === "object" ? remote : {}) as Partial<SyncableStore>;
  const remoteTrips = Array.isArray(incoming.trips) ? incoming.trips : [];
  const remoteStays = Array.isArray(incoming.stays) ? incoming.stays : [];

  const trips = new Map<string, S["trips"][number]>();
  for (const item of [...local.trips, ...(remoteTrips as S["trips"])]) {
    if (!item || typeof item.id !== "string") continue;
    const current = trips.get(item.id);
    if (!current || (Number(item.at) || 0) > (Number(current.at) || 0)) trips.set(item.id, item);
  }

  const stays = new Map<string, S["stays"][number]>();
  for (const item of [...local.stays, ...(remoteStays as S["stays"])]) {
    const id = item?.hotel?.id;
    if (typeof id === "string" && !stays.has(id)) stays.set(id, item);
  }

  return {
    ...local,
    trips: [...trips.values()].sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0)).slice(0, LIMIT),
    stays: [...stays.values()].slice(0, LIMIT),
  };
}

/** Reads the user id from a Supabase access token. The database still checks the token itself. */
export function userIdFromToken(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const padded = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const sub = (JSON.parse(atob(padded)) as { sub?: unknown }).sub;
    return typeof sub === "string" && /^[0-9a-f-]{36}$/i.test(sub) ? sub : null;
  } catch {
    return null;
  }
}

/** Accepts only what the app itself saves, and caps the size. */
export function cleanStoreData(data: unknown): { trips: unknown[]; stays: unknown[] } | null {
  if (!data || typeof data !== "object") return null;
  const { trips, stays } = data as { trips?: unknown; stays?: unknown };
  if (!Array.isArray(trips) || !Array.isArray(stays)) return null;
  const clean = { trips: trips.slice(0, 60), stays: stays.slice(0, 60) };
  return JSON.stringify(clean).length <= 500_000 ? clean : null;
}
