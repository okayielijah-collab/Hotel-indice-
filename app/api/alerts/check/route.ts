/**
 * The daily price check. A scheduler calls this once a day with a secret.
 * It searches each place once, finds every watched stay, and emails people whose price reached their target.
 * Add ?dry=1 to see what it would do without sending anything.
 */
import { serpApiProvider } from "@/lib/providers/serpapi";
import { buildEmail, groupKey, shouldNotify, type StoredAlert } from "@/lib/alerts";

const baseUrl = () => (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");

function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sendEmail(to: string, mail: { subject: string; text: string; html: string }): Promise<boolean> {
  const from = process.env.ALERT_FROM_EMAIL ?? "";
  if (!from) throw new Error("ALERT_FROM_EMAIL is not set");
  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `Hotel Indice <${from}>`, to: [to], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    return res.ok;
  }
  if (process.env.BREVO_API_KEY) {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { name: "Hotel Indice", email: from }, to: [{ email: to }], subject: mail.subject, htmlContent: mail.html, textContent: mail.text }),
    });
    return res.ok;
  }
  throw new Error("No email service is set up");
}

export async function POST(request: Request) {
  const secret = process.env.ALERTS_CRON_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (secret.length < 16 || !same(given, secret)) return Response.json({ error: "Not allowed." }, { status: 401 });

  const url = baseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return Response.json({ error: "The checker is not set up yet." }, { status: 503 });

  const dry = new URL(request.url).searchParams.get("dry") === "1";
  const siteUrl = process.env.ALERT_SITE_URL || new URL(request.url).origin;
  const maxSearches = Math.min(20, Math.max(1, Number(process.env.ALERTS_MAX_SEARCHES) || 8));
  const pages = Math.min(3, Math.max(1, Number(process.env.SERPAPI_MAX_PAGES) || 2));
  let budget = 45; // outside calls allowed in one run, so a small hosting plan is never overrun

  const db = (path: string, init: RequestInit = {}) => {
    budget -= 1;
    return fetch(`${url}${path}`, {
      ...init,
      cache: "no-store",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...((init.headers as Record<string, string>) ?? {}) },
    });
  };

  const today = new Date().toISOString().slice(0, 10);
  const report = { alerts: 0, searches: 0, emailed: 0, wouldEmail: 0, skipped: 0, failed: 0, dry, notes: [] as string[] };

  try {
    if (!dry) await db(`/rest/v1/price_alerts?active=eq.true&check_out=lt.${today}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ active: false }) });
    const list = await db(
      "/rest/v1/price_alerts?active=eq.true&select=id,user_id,hotel_id,hotel_name,city,check_in,check_out,adults,children,target_price,last_notified_at,last_notified_price&order=created_at.asc&limit=500",
    );
    if (!list.ok) return Response.json({ error: "Could not read the alerts." }, { status: 502 });
    const alerts = (await list.json()) as StoredAlert[];
    report.alerts = alerts.length;

    const groups = new Map<string, StoredAlert[]>();
    for (const alert of alerts) groups.set(groupKey(alert), [...(groups.get(groupKey(alert)) ?? []), alert]);
    const ordered = [...groups.values()].sort((a, b) => b.length - a.length);

    const emails = new Map<string, string | null>();
    const emailFor = async (userId: string) => {
      if (emails.has(userId)) return emails.get(userId) ?? null;
      const res = await db(`/auth/v1/admin/users/${userId}`);
      const email = res.ok ? ((await res.json()) as { email?: string }).email ?? null : null;
      emails.set(userId, email);
      return email;
    };

    for (const group of ordered.slice(0, maxSearches)) {
      if (budget < pages + group.length * 3 + 2) {
        report.skipped += group.length;
        continue;
      }
      const first = group[0];
      let prices: Map<string, number>;
      try {
        budget -= pages;
        report.searches += 1;
        const result = await serpApiProvider.searchInventory({
          hotelIds: [],
          destination: first.city,
          adults: first.adults,
          children: first.children,
          checkIn: first.check_in,
          checkOut: first.check_out,
          currency: "USD",
        });
        prices = new Map((result.catalogHotels ?? []).map((hotel) => [hotel.id, hotel.estimated_price_per_night]));
      } catch {
        report.failed += group.length;
        continue;
      }

      for (const alert of group) {
        const price = prices.get(alert.hotel_id) ?? 0;
        const notify = shouldNotify(alert, price);
        if (dry) {
          if (notify) report.wouldEmail += 1;
          report.notes.push(`${alert.hotel_name}: ${price > 0 ? `$${price}` : "not found"}, target $${alert.target_price}${notify ? ", would email" : ""}`);
          continue;
        }
        const update: Record<string, unknown> = { last_checked_at: new Date().toISOString() };
        if (price > 0) update.last_price = price;
        if (notify) {
          try {
            const to = await emailFor(alert.user_id);
            if (to && (await sendEmail(to, buildEmail(alert, price, siteUrl)))) {
              update.last_notified_at = new Date().toISOString();
              update.last_notified_price = price;
              report.emailed += 1;
            } else {
              report.failed += 1;
            }
          } catch (error) {
            report.failed += 1;
            report.notes.push(error instanceof Error ? error.message : "Email failed");
          }
        }
        await db(`/rest/v1/price_alerts?id=eq.${alert.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(update) });
      }
    }
    report.skipped += ordered.slice(maxSearches).reduce((sum, g) => sum + g.length, 0);
    return Response.json(report);
  } catch {
    return Response.json({ error: "The check did not finish.", ...report }, { status: 502 });
  }
}
