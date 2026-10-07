import type { HotelProvider, ProviderSearchRequest, ProviderSearchResult } from "@/lib/providers/types";

/**
 * Remembers recent live-rate searches, so the same place, dates and guests do not spend another
 * SerpApi search.
 *
 * - Memory only. Each server instance keeps its own copy, and it resets on a restart or cold start.
 * - Results are kept for PROVIDER_CACHE_MINUTES (default 60). Set it to 0 to turn the cache off.
 *   Keep it short: prices shown as live rates should not be hours old.
 * - Failed or empty searches are never kept, so a bad moment is not repeated for everyone.
 * - Identical searches running at the same time share one provider call.
 */
const store = new Map<string, { at: number; value: ProviderSearchResult }>();
const inflight = new Map<string, Promise<ProviderSearchResult>>();
const MAX_ENTRIES = 200;

function ttlMs(): number {
  const raw = process.env.PROVIDER_CACHE_MINUTES;
  const minutes = raw === undefined || raw === "" ? 60 : Number(raw);
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 * 1000 : 0;
}

/** Small stable fingerprint, so a changed hotel list gives a different key without a very long key. */
function fingerprint(ids: string[]): string {
  let hash = 5381;
  for (const id of [...ids].sort()) {
    for (let i = 0; i < id.length; i++) hash = ((hash * 33) ^ id.charCodeAt(i)) >>> 0;
    hash = ((hash * 33) ^ 124) >>> 0;
  }
  return `${ids.length}:${hash.toString(36)}`;
}

function cacheKey(provider: HotelProvider, input: ProviderSearchRequest): string {
  return [
    provider.id,
    (input.destination ?? "").trim().toLowerCase().replace(/\s+/g, " "),
    input.checkIn,
    input.checkOut,
    input.adults,
    input.children,
    input.currency ?? "USD",
    // Reading more result pages gives a different result, so it is part of the key.
    process.env.SERPAPI_MAX_PAGES ?? "",
    fingerprint(input.hotelIds ?? []),
  ].join("|");
}

function hasStays(result: ProviderSearchResult): boolean {
  return Boolean(result.catalogHotels?.length || result.hotels?.length);
}

export async function cachedSearchInventory(
  provider: HotelProvider,
  input: ProviderSearchRequest,
): Promise<ProviderSearchResult> {
  const ttl = ttlMs();
  if (!ttl) return provider.searchInventory(input);

  const key = cacheKey(provider, input);
  const now = Date.now();

  const hit = store.get(key);
  if (hit && now - hit.at < ttl) return structuredClone(hit.value);
  if (hit) store.delete(key);

  const running = inflight.get(key);
  if (running) return structuredClone(await running);

  const search = provider.searchInventory(input);
  inflight.set(key, search);
  try {
    const value = await search;
    if (hasStays(value)) {
      for (const [oldKey, entry] of store) {
        if (now - entry.at >= ttl) store.delete(oldKey);
      }
      while (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value as string);
      store.set(key, { at: Date.now(), value: structuredClone(value) });
    }
    return structuredClone(value);
  } finally {
    inflight.delete(key);
  }
}
