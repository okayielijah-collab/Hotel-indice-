import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/hotels";

export const runtime = "edge";

export async function GET() {
  try {
    return NextResponse.json(await getCatalog());
  } catch {
    return NextResponse.json({ error: "Hotel catalog unavailable" }, { status: 503 });
  }
}
