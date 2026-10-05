import "server-only";

const BASE_URL = "https://terra.tripadvisor.com/api";
const CACHE_TTL = 6 * 60 * 60 * 1000;
const RATE_LIMIT_COOLDOWN = 60 * 1000;

let rateLimitedUntil = 0;

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const cache = new Map<string, CacheEntry<unknown>>();

type TripadvisorCatalogLocation = {
  id?: number;
  name?: string;
  names?: Array<{
    value?: string;
    primary?: boolean;
    language?: string;
  }>;
  coordinates?: {
    latitude?: number;
    longitude?: number;
  };
  traveler_ratings?: {
    overall?: {
      rating?: number;
      count?: number;
    };
  };
  distance?: number;
  category?: string;
};

type TripadvisorCatalogResult = {
  location?: TripadvisorCatalogLocation;
  distance_miles?: number;
  distance_kilometers?: number;
  bearing?: number;
};

export type TripadvisorHotelSummary = {
  id: number;
  name: string;
  rating: number | null;
  reviewCount: number;
  ratingIconUrl: string | null;
  photoCount: number;
  address: string | null;
  url: string | null;
  latitude: number | null;
  longitude: number | null;
  subratings: Array<{
    type: string;
    typeName: string;
    rating: number;
    count: number;
  }>;
};

function getApiKey() {
  const key = process.env.TRIPADVISOR_API_KEY;

  if (!key) {
    throw new Error("TRIPADVISOR_API_KEY is not configured");
  }

  return key;
}

async function terraFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const cacheKey = `${options.method || "GET"}:${path}`;
  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  if (rateLimitedUntil > Date.now()) {
    throw new Error(
      "Tripadvisor API is temporarily rate-limited. Using cached data where available.",
    );
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "X-API-Key": getApiKey(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();

    if (response.status === 429) {
      rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN;
    }

    throw new Error(
      `Tripadvisor API ${response.status}: ${body || response.statusText}`,
    );
  }

  const data = (await response.json()) as T;

  cache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL,
    value: data,
  });

  return data;
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(hotel|hotels|resort|resorts|suites|suite)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameSimilarity(a: string, b: string) {
  const left = normalizeName(a);
  const right = normalizeName(b);

  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9;

  const leftTokens = new Set(left.split(" "));
  const rightTokens = new Set(right.split(" "));

  const intersection = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  );

  const union = new Set([...leftTokens, ...rightTokens]);

  return intersection.length / union.size;
}

function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const earthRadius = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function bestCatalogMatch(
  hotelName: string,
  latitude: number,
  longitude: number,
  locations: TripadvisorCatalogLocation[],
) {
  let best:
    | {
        location: TripadvisorCatalogLocation;
        score: number;
      }
    | undefined;

  for (const location of locations) {
    const candidateName =
      location.names?.find((name) => name.primary)?.value ||
      location.names?.[0]?.value ||
      location.name ||
      "";

    if (!candidateName) continue;

    const candidateLat = location.coordinates?.latitude;
    const candidateLon = location.coordinates?.longitude;

    if (
      typeof candidateLat !== "number" ||
      typeof candidateLon !== "number"
    ) {
      continue;
    }

    const similarity = nameSimilarity(hotelName, candidateName);
    const distance = distanceKm(
      latitude,
      longitude,
      candidateLat,
      candidateLon,
    );

    if (distance > 5) continue;

    const distanceScore = Math.max(0, 1 - distance / 5);
    const score = similarity * 0.75 + distanceScore * 0.25;

    if (!best || score > best.score) {
      best = {
        location,
        score,
      };
    }
  }

  if (!best || best.score < 0.55 || !best.location.id) {
    return null;
  }

  return best.location;
}

export async function findTripadvisorIdsForHotels(
  hotels: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  }>,
) {
  const result = new Map<string, number>();

  if (!hotels.length) {
    return result;
  }

  for (const hotel of hotels) {
    try {
      const params = new URLSearchParams({
        version: "1",
        lat: String(hotel.latitude),
        lon: String(hotel.longitude),
        radius: "2",
        unit: "KM",
        category: "HOTEL",
        size: "20",
        sort: "distance,asc",
      });

      const response = await terraFetch<{
        data?: TripadvisorCatalogResult[];
      }>(`/catalog/locations/nearby?${params.toString()}`);

      const locations = (response.data || [])
        .map((item) => item.location)
        .filter(
          (location): location is TripadvisorCatalogLocation =>
            Boolean(location),
        );

      const match = bestCatalogMatch(
        hotel.name,
        hotel.latitude,
        hotel.longitude,
        locations,
      );

      if (match?.id) {
        result.set(hotel.id, match.id);
      }
    } catch (error) {
      console.error(
        `Tripadvisor ID lookup failed for ${hotel.name}:`,
        error,
      );
    }
  }

  return result;
}

export async function getTripadvisorHotels(
  ids: number[],
): Promise<TripadvisorHotelSummary[]> {
  const uniqueIds = [...new Set(ids)].filter(Number.isFinite);

  if (!uniqueIds.length) return [];

  const params = new URLSearchParams({
    version: "1",
    id: uniqueIds.join(","),
    locale: "en-US",
  });

  const response = await terraFetch<{
    data?: Array<Record<string, unknown>>;
  }>(`/locations?${params.toString()}`);

  return (response.data || []).map((location) => {
    const names = location.names as
      | Array<{ value?: string; primary?: boolean }>
      | undefined;

    const addresses = location.addresses as
      | Array<{ formatted?: string }>
      | undefined;

    const coordinates = location.coordinates as
      | {
          latitude?: number;
          longitude?: number;
        }
      | undefined;

    const travelerRatings = location.traveler_ratings as
      | {
          overall?: {
            rating?: number;
            count?: number;
            icon_url?: string;
          };
          subratings?: Array<{
            type?: string;
            type_name?: string;
            rating?: number;
            count?: number;
          }>;
        }
      | undefined;

    const photos = location.photos as
      | {
          total_count?: number;
        }
      | undefined;

    const urls = location.urls as
      | {
          web?: string;
        }
      | undefined;

    return {
      id: Number(location.id),
      name:
        names?.find((name) => name.primary)?.value ||
        names?.[0]?.value ||
        "Tripadvisor hotel",
      rating: travelerRatings?.overall?.rating ?? null,
      reviewCount: travelerRatings?.overall?.count ?? 0,
      ratingIconUrl: travelerRatings?.overall?.icon_url || null,
      photoCount: photos?.total_count ?? 0,
      address: addresses?.[0]?.formatted || null,
      url: urls?.web || null,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      subratings: (travelerRatings?.subratings || [])
        .filter(
          (item) =>
            typeof item.rating === "number" &&
            typeof item.type === "string",
        )
        .map((item) => ({
          type: item.type!,
          typeName: item.type_name || item.type!,
          rating: item.rating!,
          count: item.count || 0,
        })),
    };
  });
}

export async function getTripadvisorLocation(id: number) {
  return terraFetch<Record<string, unknown>>(
    `/locations/${id}?version=1&locale=en-US`,
  );
}

export async function getTripadvisorReviews(
  id: number,
  options: {
    language?: string;
    sortBy?: "MOST_RECENT" | "HIGHEST_RATED";
    size?: number;
    ratingMin?: number;
    tripType?: string;
  } = {},
) {
  const params = new URLSearchParams({
    version: "1",
    language: options.language || "en",
    sort_by: options.sortBy || "MOST_RECENT",
    size: String(options.size || 5),
  });

  if (options.ratingMin !== undefined) {
    params.set("rating_min", String(options.ratingMin));
  }

  if (options.tripType) {
    params.set("trip_type", options.tripType);
  }

  return terraFetch<Record<string, unknown>>(
    `/locations/${id}/reviews?${params.toString()}`,
  );
}
