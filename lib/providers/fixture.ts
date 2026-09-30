import type {
  HotelProvider,
  ProviderInventory,
  ProviderRoom,
  ProviderOffer,
  ProviderSearchRequest,
  ProviderSearchResult,
} from "@/lib/providers/types";

const KUMO = "00000000-0000-4000-8000-000000000004";
const NAMI = "00000000-0000-4000-8000-000000000005";
const ASAKUSA = "00000000-0000-4000-8000-000000000006";

const fixtureRooms: Record<string, ProviderRoom[]> = {
  [KUMO]: [
    {
      hotel_id: KUMO,
      provider: "fixture",
      provider_room_id: "kumo-deluxe-king",
      name: "Deluxe King Room",
      room_size_sqm: 30,
      max_occupancy: 2,
      max_adults: 2,
      max_children: 0,
      beds: [{ type: "king" }],
      amenities: ["fast_wifi", "workspace"],
    },
    {
      hotel_id: KUMO,
      provider: "fixture",
      provider_room_id: "kumo-ginza-suite",
      name: "Ginza Suite",
      room_size_sqm: 42,
      max_occupancy: 3,
      max_adults: 2,
      max_children: 1,
      beds: [{ type: "king" }],
      amenities: ["fast_wifi", "workspace", "living_area"],
    },
  ],

  [NAMI]: [
    {
      hotel_id: NAMI,
      provider: "fixture",
      provider_room_id: "nami-standard-double",
      name: "Standard Double Room",
      room_size_sqm: 22,
      max_occupancy: 2,
      max_adults: 2,
      max_children: 0,
      beds: [{ type: "double" }],
      amenities: ["fast_wifi"],
    },
    {
      hotel_id: NAMI,
      provider: "fixture",
      provider_room_id: "nami-corner-king",
      name: "Corner King Room",
      room_size_sqm: 31,
      max_occupancy: 2,
      max_adults: 2,
      max_children: 0,
      beds: [{ type: "king" }],
      amenities: ["fast_wifi", "workspace"],
    },
  ],

  [ASAKUSA]: [
    {
      hotel_id: ASAKUSA,
      provider: "fixture",
      provider_room_id: "asakusa-compact-double",
      name: "Compact Double Room",
      room_size_sqm: 18,
      max_occupancy: 2,
      max_adults: 2,
      max_children: 0,
      beds: [{ type: "double" }],
      amenities: ["fast_wifi"],
    },
  ],
};

const fixtureOffers: Record<string, ProviderOffer[]> = {
  [KUMO]: [
    {
      provider: "fixture",
      provider_offer_id: "kumo-deluxe-offer",
      provider_room_id: "kumo-deluxe-king",
      check_in: "2026-10-10",
      check_out: "2026-10-14",
      adults: 2,
      children: 0,
      currency: "USD",
      total_price: 1368,
      price_per_night: 342,
      available: true,
      cancellation_policy: {
        type: "free_cancellation",
        deadline: "2026-10-07",
      },
      meal_plan: "room_only",
      booking_url: null,
      expires_at: null,
    },
    {
      provider: "fixture",
      provider_offer_id: "kumo-suite-offer",
      provider_room_id: "kumo-ginza-suite",
      check_in: "2026-10-10",
      check_out: "2026-10-14",
      adults: 2,
      children: 0,
      currency: "USD",
      total_price: 1680,
      price_per_night: 420,
      available: true,
      cancellation_policy: {
        type: "free_cancellation",
        deadline: "2026-10-07",
      },
      meal_plan: "room_only",
      booking_url: null,
      expires_at: null,
    },
  ],

  [NAMI]: [
    {
      provider: "fixture",
      provider_offer_id: "nami-standard-offer",
      provider_room_id: "nami-standard-double",
      check_in: "2026-10-10",
      check_out: "2026-10-14",
      adults: 2,
      children: 0,
      currency: "USD",
      total_price: 656,
      price_per_night: 164,
      available: true,
      cancellation_policy: {
        type: "free_cancellation",
        deadline: "2026-10-08",
      },
      meal_plan: "room_only",
      booking_url: null,
      expires_at: null,
    },
    {
      provider: "fixture",
      provider_offer_id: "nami-corner-offer",
      provider_room_id: "nami-corner-king",
      check_in: "2026-10-10",
      check_out: "2026-10-14",
      adults: 2,
      children: 0,
      currency: "USD",
      total_price: 720,
      price_per_night: 180,
      available: true,
      cancellation_policy: {
        type: "free_cancellation",
        deadline: "2026-10-08",
      },
      meal_plan: "room_only",
      booking_url: null,
      expires_at: null,
    },
  ],

  [ASAKUSA]: [
    {
      provider: "fixture",
      provider_offer_id: "asakusa-compact-offer",
      provider_room_id: "asakusa-compact-double",
      check_in: "2026-10-10",
      check_out: "2026-10-14",
      adults: 2,
      children: 0,
      currency: "USD",
      total_price: 420,
      price_per_night: 105,
      available: true,
      cancellation_policy: {
        type: "free_cancellation",
        deadline: "2026-10-08",
      },
      meal_plan: "room_only",
      booking_url: null,
      expires_at: null,
    },
  ],
};

export const fixtureProvider: HotelProvider = {
  id: "fixture",

  async searchInventory(
    input: ProviderSearchRequest,
  ): Promise<ProviderSearchResult> {
    const {
      hotelIds,
      adults,
      children,
      checkIn,
      checkOut,
    } = input;

    const hotels: ProviderInventory[] = hotelIds.map((hotelId) => {
      const rooms = fixtureRooms[hotelId] ?? [];
      const offers = fixtureOffers[hotelId] ?? [];

      return {
        hotel_id: hotelId,
        rooms,
        offers: offers.map((offer) => ({
          ...offer,
          check_in: checkIn,
          check_out: checkOut,
          adults,
          children,
        })),
      };
    });

    return {
      provider: "fixture",
      hotels,
      fetchedAt: new Date().toISOString(),
    };
  },
};
