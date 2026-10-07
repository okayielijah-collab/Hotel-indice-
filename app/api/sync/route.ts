/** Saves and loads one person's trips and stays. The database checks that the token owns the row. */
import { cleanStoreData, userIdFromToken } from "@/lib/sync";

const baseUrl = () => (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const apiKey = () => process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";

const fail = (error: string, status: number) => Response.json({ error }, { status });

function bearer(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

export async function GET(request: Request) {
  const base = baseUrl();
  const key = apiKey();
  const token = bearer(request);
  if (!base || !key) return fail("Sync is not set up yet.", 503);
  if (!token) return fail("Please sign in.", 401);

  try {
    const res = await fetch(`${base}/rest/v1/user_stores?select=data&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) return fail("Please sign in again.", 401);
    if (!res.ok) return fail("Could not load your trips.", 502);
    const rows = (await res.json()) as { data?: unknown }[];
    return Response.json({ data: rows[0]?.data ?? null });
  } catch {
    return fail("Network problem. Try again.", 502);
  }
}

export async function PUT(request: Request) {
  const base = baseUrl();
  const key = apiKey();
  const token = bearer(request);
  if (!base || !key) return fail("Sync is not set up yet.", 503);
  const userId = userIdFromToken(token);
  if (!userId) return fail("Please sign in.", 401);

  let data: ReturnType<typeof cleanStoreData>;
  try {
    data = cleanStoreData(((await request.json()) as { data?: unknown }).data);
  } catch {
    return fail("That request did not make sense.", 400);
  }
  if (!data) return fail("Your saved trips are too large to sync.", 413);

  try {
    const res = await fetch(`${base}/rest/v1/user_stores?on_conflict=user_id`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ user_id: userId, data, updated_at: new Date().toISOString() }),
    });
    if (res.status === 401 || res.status === 403) return fail("Please sign in again.", 401);
    if (!res.ok) return fail("Could not save your trips.", 502);
    return Response.json({ ok: true });
  } catch {
    return fail("Network problem. Try again.", 502);
  }
}
