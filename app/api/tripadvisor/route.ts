import { NextRequest, NextResponse } from "next/server";
import { getTripadvisorLocation, getTripadvisorReviews } from "@/lib/tripadvisor";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "A valid Tripadvisor location id is required." }, { status: 400 });
  try {
    const [location, reviews] = await Promise.all([getTripadvisorLocation(id), getTripadvisorReviews(id)]);
    return NextResponse.json({ location, reviews });
  } catch (error) {
    console.error("Tripadvisor lookup failed:", error);
    return NextResponse.json({ error: "Tripadvisor data is temporarily unavailable." }, { status: 503 });
  }
}
