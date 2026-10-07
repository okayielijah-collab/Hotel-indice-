import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCatalog } from "@/lib/hotels";
import { interpretTrip, rankHotels, refineWithAI } from "@/lib/matching";
import { aiAllowed, interpretWithAI } from "@/lib/interpret";
import { getHotelInventory } from "@/lib/inventory";
import { getHotelProvider } from "@/lib/providers";
import { cachedSearchInventory } from "@/lib/providers/cache";
import { normalizeProviderInventory } from "@/lib/providers/types";
import {
  findTripadvisorIdsForHotels,
  getTripadvisorHotels,
} from "@/lib/tripadvisor";

export const runtime = "nodejs";

const requestSchema = z.object({
  destination: z.string().max(100).default(""),
  party: z.string().max(40).default(""),
  vibe: z.string().max(40).default(""),
  budget: z.enum(["Any", "Budget", "Mid-range", "Luxury"]).default("Any"),
  amenities: z.array(z.string().max(40)).max(12).default([]),
  query: z.string().max(600).default(""),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  adults: z.number().int().min(1).max(20).optional(),
  children: z.number().int().min(0).max(20).optional(),
  maxPrice: z.number().positive().nullable().optional(),
  minRoomSizeSqm: z.number().positive().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please check your trip details." },
        { status: 400 },
      );
    }

    if (!parsed.data.checkIn || !parsed.data.checkOut) {
      const start = new Date();
      start.setDate(start.getDate() + 30);

      const end = new Date(start);
      end.setDate(end.getDate() + 2);

      parsed.data.checkIn = start.toISOString().slice(0, 10);
      parsed.data.checkOut = end.toISOString().slice(0, 10);
    }

    const visitor =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    const useAI = false;

    const aiPromise = useAI
      ? interpretWithAI(parsed.data)
      : Promise.resolve(null);

    const ai = await aiPromise;

    let catalog: Awaited<ReturnType<typeof getCatalog>> = {
      hotels: [],
      source: "demo",
    };

    if (ai?.category === "other") {
      return NextResponse.json({
        matches: [],
        total: 0,
        enhanced: true,
        source: catalog.source,
        understood: ai.understood,
        notice:
          "Hotel Indice finds places to stay for now. Tell us where you're going and what the stay should feel like.",
      });
    }

    // Form choices stay as typed; AI only fills in what a description implies.
    const trip = ai?.request ?? parsed.data;
    const interpretedTrip = interpretTrip(trip, ai?.intent);

    /*
     * SerpAPI is the primary live hotel search.
     *
     * The important difference from the old flow:
     * we do NOT require the destination to already exist in
     * our Supabase catalog.
     *
     * This allows searches such as:
     * Kyoto, Marrakech, Cape Town, Xuzhou, Zanzibar, etc.
     */
    const provider = getHotelProvider();

    const hasStayDates = Boolean(trip.checkIn && trip.checkOut);

    let providerResult: Awaited<
      ReturnType<typeof cachedSearchInventory>
    > | null = null;

    if (provider && hasStayDates) {
      const destination =
        interpretedTrip.destination ||
        trip.destination ||
        "";

      if (destination.trim()) {
        try {
          const providerStartedAt = Date.now();

          providerResult = await cachedSearchInventory(provider, {
            hotelIds: [],
            destination,
            adults: trip.adults || Number(trip.party) || 2,
            children: trip.children || 0,
            checkIn: trip.checkIn!,
            checkOut: trip.checkOut!,
            currency: "USD",
          });

          console.log(
            `[match] Live provider search: ${Date.now() - providerStartedAt}ms`,
          );
        } catch (error) {
          console.error(
            "Live provider search unavailable, using saved catalog:",
            error,
          );
        }
      }
    }

    /*
     * Only load the saved catalog when the live provider did not
     * return usable hotel results.
     */
    if (!providerResult?.catalogHotels?.length) {
      catalog = await getCatalog().catch((error) => {
        console.error(
          "Saved hotel catalog unavailable; continuing without catalog:",
          error,
        );

        return {
          hotels: [],
          source: "demo" as const,
        };
      });
    }

    /*
     * Live provider results become the hotel universe.
     * Supabase remains the fallback when live search fails.
     */
    const inventory = providerResult
      ? normalizeProviderInventory(providerResult.hotels)
      : catalog.source === "supabase"
        ? await getHotelInventory(
            catalog.hotels.map((hotel) => hotel.id),
          )
        : [];

    const hotelsForRanking =
      providerResult?.catalogHotels?.length
        ? providerResult.catalogHotels
        : catalog.hotels;

    const rankingStartedAt = Date.now();

    const ranked = rankHotels(
      hotelsForRanking,
      trip,
      inventory,
      ai?.intent,
    );

    console.log(
      `[match] Hotel ranking: ${Date.now() - rankingStartedAt}ms`,
    );

    const result = useAI
      ? await refineWithAI(ranked, trip, ai?.intent)
      : {
          matches: ranked.slice(0, 9),
          enhanced: false,
        };

    // Tripadvisor enrichment is intentionally disabled in the search path.
    // Live hotel inventory comes from the provider above.
    const tripadvisorByHotelId = new Map<
      string,
      import("@/lib/tripadvisor").TripadvisorHotelSummary
    >();

    const enrichedMatches = result.matches.map((match) => ({
      ...match,
      liveRate: providerResult?.catalogHotels?.length
        ? true
        : undefined,
      tripadvisor:
        tripadvisorByHotelId.get(match.hotel.id) || null,
    }));

    return NextResponse.json({
      ...result,
      matches: enrichedMatches,
      total: ranked.length,
      source: providerResult?.catalogHotels?.length
        ? "provider"
        : catalog.source,
      interpreted: interpretedTrip,
      understood: ai?.understood || "",
    });
  } catch (error) {
    console.error("Hotel matching failed:", error);

    return NextResponse.json(
      {
        error:
          "We couldn't load stays right now. Please try again.",
      },
      { status: 503 },
    );
  }
}
