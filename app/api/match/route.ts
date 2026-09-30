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
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Please check your trip details." }, { status: 400 });
    const catalog = await getCatalog();

    const hotelIds = catalog.hotels.map((hotel) => hotel.id);
    const provider = getHotelProvider();

    const inventory = await (
      catalog.source === "supabase"
        ? (() => {
            const provider = getHotelProvider();

            if (!provider) {
              return getHotelInventory(hotelIds);
            }

            return provider.searchInventory({
              hotelIds,
              adults: Number(parsed.data.party) || 2,
              children: 0,
              checkIn: "2026-10-10",
              checkOut: "2026-10-14",
              currency: "USD",
            }).then((result) => normalizeProviderInventory(result.hotels));
          })()
        : []
    );

    const ranked = rankHotels(catalog.hotels, parsed.data, inventory);
    const result = await refineWithAI(ranked, parsed.data);
    return NextResponse.json({
      ...result,
      total: ranked.length,
      source: catalog.source,
      interpreted: interpretTrip(parsed.data),
    });
  } catch (error) {
    console.error("Hotel matching failed:", error);
    return NextResponse.json({ error: "We couldn't load stays right now. Please try again." }, { status: 503 });
  }
}
