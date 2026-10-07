/** A signed in person's price alerts: list, add and remove. The database only lets them touch their own. */
import { cleanAlert } from "@/lib/alerts";
import { userIdFromToken } from "@/lib/sync";

const baseUrl = () => (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const apiKey = () => process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const COLUMNS = "id,hotel_id,hotel_name,city,check_in,check_out,adults,children,target_price,start_price,last_price,last_checked_at,last_notified_at,active";
const MAX_ALERTS = 20;

const fail = (error: string, status: number) => Response.json({ error }, { status });

function bearer(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function setup(request: Request) {
  const base = baseUrl();
  const key = apiKey();
  const token = bearer(request);
  if (!base || !key) return { error: fail("Alerts are not set up yet.", 503) };
  const userId = userIdFromToken(token);
  if (!userId) return { error: fail("Please sign in.", 401) };
  const send = (path: string, init: RequestInit = {}) =>
    fetch(`${base}${path}`, {
      ...init,
      cache: "no-store",
      headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...((init.headers as Record<string, string>) ?? {}) },
    });
  return { send, userId };
}

export async function GET(request: Request) {
  const s = setup(request);
  if (s.error) return s.error;
  try {
    const res = await s.send(`/rest/v1/price_alerts?select=${COLUMNS}&active=eq.true&order=created_at.desc&limit=${MAX_ALERTS}`);
    if (res.status === 401 || res.status === 403) return fail("Please sign in again.", 401);
    if (!res.ok) return fail("Could not load your alerts.", 502);
    return Response.json({ alerts: await res.json() });
  } catch {
    return fail("Network problem. Try again.", 502);
  }
}

export async function POST(request: Request) {
  const s = setup(request);
  if (s.error) return s.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("That request did not make sense.", 400);
  }
  const checked = cleanAlert(body, new Date().toISOString().slice(0, 10));
  if (!checked.ok) return fail(checked.error, 400);

  try {
    const count = await s.send(`/rest/v1/price_alerts?select=id&active=eq.true&limit=${MAX_ALERTS + 1}`);
    if (count.ok && ((await count.json()) as unknown[]).length >= MAX_ALERTS) {
      const same = await s.send(
        `/rest/v1/price_alerts?select=id&hotel_id=eq.${encodeURIComponent(checked.value.hotel_id)}&check_in=eq.${checked.value.check_in}&check_out=eq.${checked.value.check_out}`,
      );
      const found = same.ok ? ((await same.json()) as unknown[]) : [];
      if (!found.length) return fail(`You can watch up to ${MAX_ALERTS} stays. Remove one first.`, 409);
    }
    const res = await s.send(`/rest/v1/price_alerts?on_conflict=user_id,hotel_id,check_in,check_out&select=${COLUMNS}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ ...checked.value, user_id: s.userId, active: true, last_notified_at: null, last_notified_price: null }),
    });
    if (res.status === 401 || res.status === 403) return fail("Please sign in again.", 401);
    if (!res.ok) return fail("Could not save your alert.", 502);
    const rows = (await res.json()) as unknown[];
    return Response.json({ alert: rows[0] });
  } catch {
    return fail("Network problem. Try again.", 502);
  }
}

export async function DELETE(request: Request) {
  const s = setup(request);
  if (s.error) return s.error;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Unknown alert.", 400);
  try {
    const res = await s.send(`/rest/v1/price_alerts?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    if (res.status === 401 || res.status === 403) return fail("Please sign in again.", 401);
    if (!res.ok) return fail("Could not remove the alert.", 502);
    return Response.json({ ok: true });
  } catch {
    return fail("Network problem. Try again.", 502);
  }
}
