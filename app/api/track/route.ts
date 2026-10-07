import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

// Anonymous usage events: what people search for, and which stays they check rates on.
// No IP address, account or cookie is stored.
const schema = z.object({
  kind: z.enum(["search", "rates_open", "partner_click"]),
  query: z.string().trim().max(200).optional(),
  destination: z.string().trim().max(100).optional(),
  results: z.number().int().min(0).max(1000).optional(),
  hotel_id: z.string().trim().max(80).optional(),
  partner: z.string().trim().max(40).optional(),
});

// Best-effort limit per server instance: 120 events per hour per visitor.
const recent = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((time) => now - time < 60 * 60 * 1000);
  if (hits.length >= 120) { recent.set(ip, hits); return true; }
  recent.set(ip, [...hits, now]);
  return false;
}

export async function POST(request: NextRequest) {
  try {
    // Respect "Do Not Track".
    if (request.headers.get("dnt") === "1") return new NextResponse(null, { status: 204 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return new NextResponse(null, { status: 204 });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (limited(ip)) return new NextResponse(null, { status: 204 });

    const url = process.env.SUPABASE_URL;
    const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
    const key = publishable || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return new NextResponse(null, { status: 204 });

    const data = parsed.data;

    // Analytics are best-effort and must never block the request.
    void fetch(`${url.replace(/\/$/, "")}/rest/v1/usage_events`, {
      method: "POST",
      headers: {
        apikey: key,
        ...(publishable ? {} : { Authorization: `Bearer ${key}` }),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        kind: data.kind,
        query: data.query || null,
        destination: data.destination || null,
        results: data.results ?? null,
        hotel_id: data.hotel_id || null,
        partner: data.partner || null,
      }),
      signal: AbortSignal.timeout(1000),
    }).catch(() => {
      // Tracking failure is intentionally ignored.
    });

  } catch (error) {
    console.error("Usage event error:", error);
  }
  // Tracking never reports problems to the visitor.
  return new NextResponse(null, { status: 204 });
}
