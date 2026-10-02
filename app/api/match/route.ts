import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCatalog } from "@/lib/hotels";
import { interpretTrip, rankHotels, refineWithAI } from "@/lib/matching";
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
    const catalog = await getCatalog();

    const hotelIds = catalog.hotels.map((hotel) => hotel.id);
    const interpretedTrip = interpretTrip(parsed.data);

    const provider = getHotelProvider();

    const hasStayDates = Boolean(
      parsed.data.checkIn && parsed.data.checkOut,
    );

    const providerResult =
      catalog.source === "supabase" && provider && hasStayDates
        ? await provider.searchInventory({
            hotelIds,
            destination:
              interpretedTrip.destination || parsed.data.destination,
            adults: parsed.data.adults || (Number(parsed.data.party) || 2),
            children: parsed.data.children || 0,
            checkIn: parsed.data.checkIn!,
            checkOut: parsed.data.checkOut!,
            currency: "USD",
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

    const ranked = rankHotels(hotelsForRanking, parsed.data, inventory);
    const result = await refineWithAI(ranked, parsed.data);

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
      interpreted: interpretTrip(parsed.data),
    });
  } catch (error) {
    console.error("Hotel matching failed:", error);
    return NextResponse.json({ error: "We couldn't load stays right now. Please try again." }, { status: 503 });
  }
}
