import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCatalog } from "@/lib/hotels";
import { interpretTrip, rankHotels, refineWithAI } from "@/lib/matching";
import { aiAllowed, interpretWithAI } from "@/lib/interpret";
import { getHotelInventory } from "@/lib/inventory";
import { getHotelProvider } from "@/lib/providers";
import { normalizeProviderInventory } from "@/lib/providers/types";

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

    const ranked = rankHotels(hotelsForRanking, trip, inventory);
    const result = useAI ? await refineWithAI(ranked, trip) : { matches: ranked.slice(0, 9), enhanced: false };

    const responseResult = providerResult?.catalogHotels?.length
      ? {
          ...result,
          matches: result.matches.map((match) => ({
            ...match,
            liveRate: true,
          })),
        }
      : result;

    return NextResponse.json({
      ...responseResult,
      total: ranked.length,
      source: providerResult?.catalogHotels?.length ? "provider" : catalog.source,
      interpreted: interpretTrip(trip),
      understood: ai?.understood || "",
    });
  } catch (error) {
    console.error("Hotel matching failed:", error);
    return NextResponse.json({ error: "We couldn't load stays right now. Please try again." }, { status: 503 });
  }
}
