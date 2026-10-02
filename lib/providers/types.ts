import type { Hotel } from "@/lib/hotels";
import type { HotelInventory, Offer, Room } from "@/lib/inventory";

export type ProviderHotel = Pick<
  Hotel,
  "id" | "name" | "city" | "country" | "latitude" | "longitude"
>;

export type ProviderRoom = Omit<Room, "id">;

export type ProviderOffer = Omit<Offer, "id" | "room_id"> & {
  provider_room_id: string;
};

export type ProviderInventory = {
  hotel_id: string;
  rooms: ProviderRoom[];
  offers: ProviderOffer[];
};

export type ProviderSearchRequest = {
  hotelIds: string[];
  destination?: string;
  adults: number;
  children: number;
  checkIn: string;
  checkOut: string;
  currency?: string;
};

export type ProviderSearchResult = {
  provider: string;
  hotels: ProviderInventory[];
  catalogHotels?: Hotel[];
  fetchedAt: string;
};

export type ProviderError = {
  provider: string;
  code:
    | "AUTHENTICATION"
    | "RATE_LIMIT"
    | "TIMEOUT"
    | "UNAVAILABLE"
    | "INVALID_REQUEST"
    | "UNKNOWN";
  message: string;
  retryable: boolean;
};

export type HotelProvider = {
  id: string;

  searchInventory(
    input: ProviderSearchRequest,
  ): Promise<ProviderSearchResult>;
};

export function normalizeProviderInventory(
  inventory: ProviderInventory[],
): HotelInventory[] {
  return inventory.map((hotel) => {
    const roomIdByProviderRoomId = new Map<string, string>();

    const rooms: Room[] = hotel.rooms.map((room) => {
      const id = `${room.provider}:${room.provider_room_id}`;

      roomIdByProviderRoomId.set(room.provider_room_id, id);

      return {
        ...room,
        id,
      };
    });

    const offers: Offer[] = hotel.offers
      .map((offer): Offer | null => {
        const roomId = roomIdByProviderRoomId.get(
          offer.provider_room_id,
        );

        if (!roomId) {
          return null;
        }

        return {
          id: `${offer.provider}:${offer.provider_offer_id}`,
          room_id: roomId,
          provider: offer.provider,
          provider_offer_id: offer.provider_offer_id,
          check_in: offer.check_in,
          check_out: offer.check_out,
          adults: offer.adults,
          children: offer.children,
          currency: offer.currency,
          total_price: offer.total_price,
          price_per_night: offer.price_per_night,
          available: offer.available,
          cancellation_policy: offer.cancellation_policy,
          meal_plan: offer.meal_plan,
          booking_url: offer.booking_url,
          expires_at: offer.expires_at,
        };
      })
      .filter((offer): offer is Offer => offer !== null);

    return {
      hotel_id: hotel.hotel_id,
      rooms,
      offers,
    };
  });
}
