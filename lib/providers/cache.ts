/**
 * Remembers recent live-rate searches for a few hours, so the same place and dates do not
 * spend another SerpAPI search. Memory only: it resets on restart and on a cold start.
 */
const store = new Map<string, { at: number; value: unknown }>();
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;

type SearchInput = {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  currency?: string;
};

export async function cachedSearchInventory<I extends SearchInput, R>(
  provider: { searchInventory(input: I): Promise<R> },
  input: I,
): Promise<R> {
  const hotelCount = (input as { hotelIds?: unknown[] }).hotelIds?.length ?? 0;
  const key = [
    input.destination.trim().toLowerCase(),
    input.checkIn,
    input.checkOut,
    input.adults,
    input.children,
    input.currency ?? "USD",
    hotelCount,
  ].join("|");

  const hit = store.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as R;

  const value = await provider.searchInventory(input);
  if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value as string);
  store.set(key, { at: Date.now(), value });
  return value;
}
