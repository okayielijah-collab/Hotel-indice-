import seedHotels from "@/data/hotels.json";

export type PriceTier = "Budget" | "Mid-range" | "Luxury";

export type Hotel = {
  id: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  price_tier: PriceTier;
  estimated_price_per_night: number;
  rating: number;
  review_count: number;
  amenities: string[];
  vibe_tags: string[];
  editorial_notes: string;
  image_urls: string[];
  affiliate_booking_link: string;
};

export type Catalog = { hotels: Hotel[]; source: "supabase" | "demo" };

export const demoHotels = seedHotels as Hotel[];

/** Reads the public hotel catalog on the server. A missing Supabase configuration
 * deliberately keeps the deployed demo usable. Configuration/query failures are
 * surfaced rather than silently showing stale sample data. */
export async function getCatalog(): Promise<Catalog> {
  const url = process.env.SUPABASE_URL;
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  const key = publishable || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return { hotels: demoHotels, source: "demo" };

  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/hotels?select=*&order=rating.desc`, {
    headers: publishable ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Hotel catalog unavailable (${response.status})`);
  const hotels = (await response.json()) as Hotel[];
  return { hotels, source: "supabase" };
}

export const amenityLabels: Record<string, string> = {
  fast_wifi: "Fast Wi-Fi",
  breakfast: "Breakfast",
  pool: "Pool",
  spa: "Spa",
  gym: "Gym",
  workspace: "Workspace",
  family_rooms: "Family rooms",
  parking: "Parking",
  airport_transfer: "Airport transfer",
  room_service: "Room service",
  laundry: "Laundry",
  yoga: "Yoga",
};

export const vibeLabels: Record<string, string> = {
  romantic: "Romantic",
  boutique: "Boutique",
  design_led: "Design-led",
  remote_work: "Work-friendly",
  cultural: "Culture",
  nightlife: "Nightlife",
  solo: "Solo travel",
  family_friendly: "Family-friendly",
  business: "Business",
  quiet: "Quiet",
  wellness: "Wellness",
  beach: "Beach",
};

export const cities = ["Paris", "Tokyo", "New York", "Lagos", "Bali", "London"] as const;
