import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCatalog } from "@/lib/hotels";
import { interpretTrip, rankHotels, refineWithAI } from "@/lib/matching";
import { aiAllowed, interpretWithAI } from "@/lib/interpret";
import { getHotelInventory } from "@/lib/inventory";
import { getHotelProvider } from "@/lib/providers";
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
    if (!parsed.success) return NextResponse.json({ error: "Please check your trip details." }, { status: 400 });
    if (!parsed.data.checkIn || !parsed.data.checkOut) {
      const start = new Date();
      start.setDate(start.getDate() + 30);
      const end = new Date(start);
      end.setDate(end.getDate() + 2);
      parsed.data.checkIn = start.toISOString().slice(0, 10);
      parsed.data.checkOut = end.toISOString().slice(0, 10);
    }
    const visitor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const useAI = aiAllowed(visitor);
    const [catalog, ai] = await Promise.all([
      getCatalog(),
      useAI ? interpretWithAI(parsed.data) : Promise.resolve(null),
    ]);

    if (ai?.category === "other") {
      return NextResponse.json({
        matches: [], total: 0, enhanced: true, source: catalog.source,
        understood: ai.understood,
        notice: "Hotel Indice finds places to stay for now. Tell us where you're going and what the stay should feel like.",
      });
    }
    // Form choices stay as typed; the AI only fills in what a description implies.
    const trip = ai?.request ?? parsed.data;

    const hotelIds = catalog.hotels.map((hotel) => hotel.id);
    const interpretedTrip = interpretTrip(trip);

    const provider = getHotelProvider();

    const hasStayDates = Boolean(trip.checkIn && trip.checkOut);

    const providerResult =
      catalog.source === "supabase" && provider && hasStayDates
        ? await provider.searchInventory({
            hotelIds,
            destination:
              interpretedTrip.destination || trip.destination,
            adults: trip.adults || (Number(trip.party) || 2),
            children: trip.children || 0,
            checkIn: trip.checkIn!,
            checkOut: trip.checkOut!,
            currency: "USD",
          }).catch((error) => {
            console.error("Live rates unavailable, using the saved catalog:", error);
            return null;
          })
        : null;

    const inventory = providerResult
      ? normalizeProviderInventory(providerResult.hotels)
      : catalog.source === "supabase"
        ? await getHotelInventory(hotelIds)
        : [];

    const hotelsForRanking =
      providerResult?.catalogHotels?.length
        ? providerResult.catalogHotels
        : catalog.hotels;

    const ranked = rankHotels(
      hotelsForRanking,
      trip,
      inventory,
      ai?.intent,
    );

    const result = useAI
      ? await refineWithAI(ranked, trip, ai?.intent)
      : { matches: ranked.slice(0, 9), enhanced: false };

    // Tripadvisor is an enrichment layer, not the hotel inventory provider.
    // Only enrich the hotels actually shown to the user.
    let tripadvisorByHotelId = new Map<
      string,
      import("@/lib/tripadvisor").TripadvisorHotelSummary
    >();

    try {
      const visibleHotels = result.matches
        .map((match) => match.hotel)
        .filter(Boolean)
        .map((hotel) => ({
          id: hotel.id,
          name: hotel.name,
          latitude: hotel.latitude,
          longitude: hotel.longitude,
        }));

      const tripadvisorIds = await findTripadvisorIdsForHotels(visibleHotels);

      if (tripadvisorIds.size) {
        const summaries = await getTripadvisorHotels(
          [...tripadvisorIds.values()],
        );

        const summariesByTripadvisorId = new Map(
          summaries.map((summary) => [summary.id, summary]),
        );

        tripadvisorByHotelId = new Map(
          [...tripadvisorIds.entries()]
            .map(([hotelId, tripadvisorId]) => {
              const summary = summariesByTripadvisorId.get(tripadvisorId);

              return summary ? [hotelId, summary] : null;
            })
            .filter(
              (
                item,
              ): item is [
                string,
                import("@/lib/tripadvisor").TripadvisorHotelSummary,
              ] => Boolean(item),
            ),
        );
      }
    } catch (error) {
      console.error("Tripadvisor enrichment unavailable:", error);
    }

    const enrichedMatches = result.matches.map((match) => ({
      ...match,
      liveRate: providerResult?.catalogHotels?.length
        ? true
        : undefined,
      tripadvisor: tripadvisorByHotelId.get(match.hotel.id) || null,
    }));

    return NextResponse.json({
      ...result,
      matches: enrichedMatches,
      total: ranked.length,
      source: providerResult?.catalogHotels?.length
        ? "provider"
        : catalog.source,
      interpreted: interpretTrip(trip, ai?.intent),
      understood: ai?.understood || "",
    });
  } catch (error) {
    console.error("Hotel matching failed:", error);
    return NextResponse.json({ error: "We couldn't load stays right now. Please try again." }, { status: 503 });
  }
}
