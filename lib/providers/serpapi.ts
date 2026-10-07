import type { Hotel, PriceTier } from "@/lib/hotels";
import type {
  HotelProvider,
  ProviderInventory,
  ProviderOffer,
  ProviderRoom,
  ProviderSearchRequest,
  ProviderSearchResult,
} from "@/lib/providers/types";

type SerpApiImage = {
  thumbnail?: string;
  original_image?: string;
};

type SerpApiPrice = {
  source?: string;
  link?: string;
  official?: boolean;
  rate_per_night?: {
    extracted_lowest?: number;
  };
  total_rate?: {
    extracted_lowest?: number;
  };
};

type SerpApiProperty = {
  name?: string;
  type?: string;
  description?: string;
  link?: string;
  overall_rating?: number;
  reviews?: number;
  amenities?: string[];
  gps_coordinates?: {
    latitude?: number;
    longitude?: number;
  };
  rate_per_night?: {
    lowest?: string;
    extracted_lowest?: number;
  };
  total_rate?: {
    lowest?: string;
    extracted_lowest?: number;
  };
  prices?: SerpApiPrice[];
  images?: SerpApiImage[];
  hotel_class?: string;
  extracted_hotel_class?: number;
};

type SerpApiResponse = {
  properties?: SerpApiProperty[];
  error?: string;
  serpapi_pagination?: { next_page_token?: string };
};

function parsePrice(property: SerpApiProperty): number | null {
  const extracted = property.rate_per_night?.extracted_lowest;

  if (typeof extracted === "number" && Number.isFinite(extracted)) {
    return extracted;
  }

  const raw = property.rate_per_night?.lowest;

  if (!raw) return null;

  const numeric = Number(raw.replace(/[^0-9.]/g, ""));

  return Number.isFinite(numeric) ? numeric : null;
}

function parseTotalPrice(
  property: SerpApiProperty,
  pricePerNight: number | null,
  checkIn: string,
  checkOut: string,
): number | null {
  const extracted = property.total_rate?.extracted_lowest;

  if (typeof extracted === "number" && Number.isFinite(extracted)) {
    return extracted;
  }

  if (pricePerNight === null) return null;

  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return pricePerNight;
  }

  const nights = Math.max(1, Math.round((end - start) / 86_400_000));

  return pricePerNight * nights;
}

function normalizeUrl(link?: string): string | null {
  if (!link) return null;

  const markdown = link.match(/^\[([^\]]+)\]\((.+)\)$/);

  return markdown ? markdown[2] : link;
}

function stableHotelId(property: SerpApiProperty): string {
  const name = property.name?.trim().toLowerCase() || "hotel";
  const location = property.gps_coordinates;

  const slug = name
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);

  if (
    typeof location?.latitude === "number" &&
    typeof location?.longitude === "number"
  ) {
    return `serpapi-${slug}-${location.latitude.toFixed(4)}-${location.longitude.toFixed(4)}`;
  }

  return `serpapi-${slug}`;
}

function cityFromDestination(destination: string): string {
  return destination.split(",")[0]?.trim() || destination.trim();
}

function countryFromDestination(destination: string): string {
  const parts = destination
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    return parts[parts.length - 1];
  }

  const countries: Record<string, string> = {
    tokyo: "Japan",
    paris: "France",
    london: "United Kingdom",
    "new york": "United States",
    lagos: "Nigeria",
    bali: "Indonesia",
  };

  return countries[destination.trim().toLowerCase()] || "";
}

function priceTier(price: number | null): PriceTier {
  if (price === null) return "Mid-range";
  if (price < 150) return "Budget";
  if (price < 300) return "Mid-range";
  return "Luxury";
}

function normalizeAmenities(amenities: string[]): string[] {
  const text = amenities.join(" ").toLowerCase();
  const result = new Set<string>();

  if (/wi[- ]?fi|wireless/.test(text)) result.add("fast_wifi");
  if (/breakfast/.test(text)) result.add("breakfast");
  if (/pool/.test(text)) result.add("pool");
  if (/spa|wellness/.test(text)) result.add("spa");
  if (/fitness|gym/.test(text)) result.add("gym");
  if (/business centre|business center|workspace/.test(text)) {
    result.add("workspace");
  }
  if (/family room|family-friendly|kid-friendly|child-friendly/.test(text)) {
    result.add("family_rooms");
  }
  if (/parking/.test(text)) result.add("parking");
  if (/airport shuttle|airport transfer/.test(text)) {
    result.add("airport_transfer");
  }
  if (/room service/.test(text)) result.add("room_service");
  if (/laundry/.test(text)) result.add("laundry");

  return [...result];
}

function inferVibes(property: SerpApiProperty): string[] {
  const text = [
    property.name || "",
    property.description || "",
    ...(property.amenities || []),
  ]
    .join(" ")
    .toLowerCase();

  const vibes = new Set<string>();

  if (/spa|wellness/.test(text)) vibes.add("wellness");
  if (/beach|beachfront|seaside/.test(text)) vibes.add("beach");
  if (/business centre|business center/.test(text)) vibes.add("business");
  if (/kid-friendly|child-friendly|family/.test(text)) {
    vibes.add("family_friendly");
  }

  return [...vibes];
}

function imageUrls(property: SerpApiProperty): string[] {
  return (property.images || [])
    .map((image) => image.original_image || image.thumbnail)
    .filter((url): url is string => Boolean(url));
}

function bookingUrl(property: SerpApiProperty): string | null {
  const partner = property.prices?.find((price) => price.link)?.link;

  return normalizeUrl(partner || property.link);
}

function toHotel(
  property: SerpApiProperty,
  destination: string,
): Hotel {
  const id = stableHotelId(property);
  const price = parsePrice(property);
  const amenities = normalizeAmenities(property.amenities || []);

  return {
    id,
    name: property.name || "Hotel",
    city: cityFromDestination(destination),
    country: countryFromDestination(destination),
    latitude: property.gps_coordinates?.latitude || 0,
    longitude: property.gps_coordinates?.longitude || 0,
    price_tier: priceTier(price),
    estimated_price_per_night: price || 0,
    rating:
      typeof property.overall_rating === "number"
        ? property.overall_rating
        : 0,
    review_count:
      typeof property.reviews === "number"
        ? property.reviews
        : 0,
    amenities,
    vibe_tags: inferVibes(property),
    editorial_notes:
      property.description ||
      "Live property information from Google Hotels.",
    image_urls: imageUrls(property),
    affiliate_booking_link: bookingUrl(property) || "",
  };
}

function toProviderInventory(
  property: SerpApiProperty,
  input: ProviderSearchRequest,
): ProviderInventory {
  const hotelId = stableHotelId(property);
  const providerRoomId = `${hotelId}-property-rate`;

  const pricePerNight = parsePrice(property);
  const totalPrice = parseTotalPrice(
    property,
    pricePerNight,
    input.checkIn,
    input.checkOut,
  );

  const room: ProviderRoom = {
    hotel_id: hotelId,
    provider: "serpapi",
    provider_room_id: providerRoomId,
    name: "Available rate",
    room_size_sqm: null,
    max_occupancy: null,
    max_adults: null,
    max_children: null,
    beds: [],
    amenities: [],
  };

  const offers: ProviderOffer[] =
    pricePerNight !== null && totalPrice !== null
      ? [
          {
            provider: "serpapi",
            provider_offer_id: `${hotelId}-rate-${input.checkIn}-${input.checkOut}`,
            provider_room_id: providerRoomId,
            check_in: input.checkIn,
            check_out: input.checkOut,
            adults: input.adults,
            children: input.children,
            currency: input.currency || "USD",
            total_price: totalPrice,
            price_per_night: pricePerNight,
            available: true,
            cancellation_policy: null,
            meal_plan: null,
            booking_url: bookingUrl(property),
            expires_at: null,
          },
        ]
      : [];

  return {
    hotel_id: hotelId,
    rooms: [room],
    offers,
  };
}

export const serpApiProvider: HotelProvider = {
  id: "serpapi",

  async searchInventory(
    input: ProviderSearchRequest,
  ): Promise<ProviderSearchResult> {
    const apiKey = process.env.SERPAPI_KEY;

    if (!apiKey) {
      throw new Error("SERPAPI_KEY is not configured");
    }

    if (!input.destination?.trim()) {
      throw new Error("SERPAPI requires a destination");
    }

    const url = new URL("https://serpapi.com/search.json");

    url.searchParams.set("engine", "google_hotels");
    url.searchParams.set("q", `hotels in ${input.destination}`);
    url.searchParams.set("check_in_date", input.checkIn);
    url.searchParams.set("check_out_date", input.checkOut);
    url.searchParams.set("adults", String(input.adults));
    url.searchParams.set("children", String(input.children));
    url.searchParams.set("currency", input.currency || "USD");
    url.searchParams.set("hl", "en");
    url.searchParams.set("api_key", apiKey);

    // Google returns about 20 stays per page. Read a second page too (set SERPAPI_MAX_PAGES=1 to turn off).
    const maxPages = 1;
    const properties: SerpApiProperty[] = [];
    const seen = new Set<string>();
    let pageUrl = url;

    for (let page = 0; page < maxPages; page++) {
      let data: SerpApiResponse = {};
      try {
        const response = await fetchWithRetry(pageUrl);
        data = (await response.json()) as SerpApiResponse;
        if (!response.ok || data.error) {
          throw new Error(data.error || `SERPAPI request failed (${response.status})`);
        }
      } catch (error) {
        // The first page is required. If a later page fails, keep what we already have.
        if (page === 0) throw error;
        console.error("Extra results page unavailable:", error);
        break;
      }

      for (const property of Array.isArray(data.properties) ? data.properties : []) {
        const key = `${property.name ?? ""}|${property.gps_coordinates?.latitude ?? ""}|${property.gps_coordinates?.longitude ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        properties.push(property);
      }

      const token = data.serpapi_pagination?.next_page_token;
      if (!token) break;
      pageUrl = new URL(url.toString());
      pageUrl.searchParams.set("next_page_token", token);
    }

    const catalogHotels = properties.map((property) =>
      toHotel(property, input.destination || ""),
    );

    return {
      provider: "serpapi",
      hotels: properties.map((property) =>
        toProviderInventory(property, input),
      ),
      catalogHotels,
      fetchedAt: new Date().toISOString(),
    };
  },
};

/** One quick retry, so a single slow connection does not blank the whole search. */
async function fetchWithRetry(url: URL, attempts = 2): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      return await fetch(url, { cache: "no-store", signal: controller.signal });
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}
