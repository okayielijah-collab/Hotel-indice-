import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCatalog } from "@/lib/hotels";
import { interpretTrip, rankHotels, refineWithAI } from "@/lib/matching";

export const runtime = "edge";

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
    const ranked = rankHotels(catalog.hotels, parsed.data);
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
