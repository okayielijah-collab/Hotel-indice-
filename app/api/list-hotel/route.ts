import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  hotel_name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(80),
  country: z.string().trim().min(2).max(80),
  contact_name: z.string().trim().min(2).max(80),
  contact_email: z.string().trim().email().max(120),
  role: z.enum(["Owner", "Manager", "Agent", "Other"]).default("Owner"),
  website: z.string().trim().max(300).default(""),
  price_from_usd: z.number().positive().max(100000).nullable().default(null),
  amenities: z.array(z.string().max(40)).max(12).default([]),
  description: z.string().trim().max(600).default(""),
  // Honeypot: real visitors never see or fill this field.
  company: z.string().max(200).optional(),
});

// Best-effort limit per server instance: 5 submissions per hour per visitor.
const recent = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const hits = (recent.get(ip) ?? []).filter((time) => now - time < hour);
  if (hits.length >= 5) { recent.set(ip, hits); return true; }
  recent.set(ip, [...hits, now]);
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Please check the highlighted details and try again." }, { status: 400 });
    const data = parsed.data;

    // A filled honeypot means a bot: pretend it worked and store nothing.
    if (data.company) return NextResponse.json({ ok: true });

    let website = data.website;
    if (website) {
      try {
        const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("bad protocol");
        website = url.toString();
      } catch {
        return NextResponse.json({ error: "That website address doesn't look right." }, { status: 400 });
      }
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (limited(ip)) return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 });

    const url = process.env.SUPABASE_URL;
    const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
    const key = publishable || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return NextResponse.json({ error: "Listings are not open yet. Please try again soon." }, { status: 503 });

    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/hotel_submissions`, {
      method: "POST",
      headers: {
        apikey: key,
        ...(publishable ? {} : { Authorization: `Bearer ${key}` }),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        hotel_name: data.hotel_name,
        city: data.city,
        country: data.country,
        contact_name: data.contact_name,
        contact_email: data.contact_email,
        role: data.role,
        website: website || null,
        price_from_usd: data.price_from_usd,
        amenities: data.amenities,
        description: data.description,
      }),
    });
    if (!response.ok) {
      console.error("Hotel submission failed:", response.status, await response.text().catch(() => ""));
      return NextResponse.json({ error: "We couldn't save your hotel right now. Please try again." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Hotel submission error:", error);
    return NextResponse.json({ error: "We couldn't save your hotel right now. Please try again." }, { status: 503 });
  }
}
