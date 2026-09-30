/**
 * Provider-neutral hotel inventory model.
 *
 * Provider adapters normalize their data into these shapes.
 * Matching never depends on provider-specific fields.
 */

export type ProviderId = "tripcom" | "serpapi" | (string & {});

export type Bed = {
  type: string;
  width_m?: number | null;
};

export type Room = {
  id: string;
  hotel_id: string;
  provider: ProviderId;
  provider_room_id: string;
  name: string;
  room_size_sqm: number | null;
  max_occupancy: number | null;
  max_adults: number | null;
  max_children: number | null;
  beds: Bed[];
  amenities: string[];
};

export type Offer = {
  id: string;
  room_id: string;
  provider: ProviderId;
  provider_offer_id: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  currency: string;
  total_price: number;
  price_per_night: number | null;
  available: boolean;
  cancellation_policy: Record<string, unknown> | null;
  meal_plan: string | null;
  booking_url: string | null;
  expires_at: string | null;
};

export type HotelInventory = {
  hotel_id: string;
  rooms: Room[];
  offers: Offer[];
};

export type RoomRequirement = {
  minSizeSqm: number | null;
  minOccupancy: number | null;
  minAdults: number | null;
  minChildren: number | null;
};

export function roomMeetsRequirements(
  room: Room,
  requirement: RoomRequirement,
): boolean {
  if (requirement.minSizeSqm !== null) {
    if (
      room.room_size_sqm === null ||
      room.room_size_sqm < requirement.minSizeSqm
    ) {
      return false;
    }
  }

  if (requirement.minOccupancy !== null) {
    if (
      room.max_occupancy === null ||
      room.max_occupancy < requirement.minOccupancy
    ) {
      return false;
    }
  }

  if (requirement.minAdults !== null) {
    if (
      room.max_adults === null ||
      room.max_adults < requirement.minAdults
    ) {
      return false;
    }
  }

  if (requirement.minChildren !== null) {
    if (
      room.max_children === null ||
      room.max_children < requirement.minChildren
    ) {
      return false;
    }
  }

  return true;
}

export async function getHotelInventory(
  hotelIds: string[],
): Promise<HotelInventory[]> {
  if (!hotelIds.length) return [];

  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) return [];

  const baseUrl = url.replace(/\/$/, "");

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };

  const ids = hotelIds
    .map((id) => `"${id}"`)
    .join(",");

  const roomsResponse = await fetch(
    `${baseUrl}/rest/v1/hotel_rooms?select=*&hotel_id=in.(${ids})`,
    {
      headers,
      cache: "no-store",
    },
  );

  if (!roomsResponse.ok) {
    throw new Error(
      `Hotel room inventory unavailable (${roomsResponse.status})`,
    );
  }

  const rooms = (await roomsResponse.json()) as Room[];

  const inventoryByHotel = new Map<string, HotelInventory>();

  for (const hotelId of hotelIds) {
    inventoryByHotel.set(hotelId, {
      hotel_id: hotelId,
      rooms: [],
      offers: [],
    });
  }

  for (const room of rooms) {
    const inventory = inventoryByHotel.get(room.hotel_id);

    if (inventory) {
      inventory.rooms.push(room);
    }
  }

  return hotelIds
    .map((hotelId) => inventoryByHotel.get(hotelId))
    .filter((item): item is HotelInventory => Boolean(item));
}
