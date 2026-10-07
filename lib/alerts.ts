/** Helpers for price alerts. No React and no network in here, so they are easy to test. */

export type AlertInput = {
  hotel_id: string;
  hotel_name: string;
  city: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  target_price: number;
  start_price: number | null;
};

export type StoredAlert = {
  id: string;
  user_id: string;
  hotel_id: string;
  hotel_name: string;
  city: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  target_price: number;
  last_notified_at: string | null;
  last_notified_price: number | null;
};

const isoDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

const clip = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

const whole = (value: unknown, low: number, high: number, fallback: number) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(high, Math.max(low, n)) : fallback;
};

/** Checks what the browser sent. Returns the clean alert, or a message to show the person. */
export function cleanAlert(body: unknown, today: string): { ok: true; value: AlertInput } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const hotel_id = clip(b.hotelId, 160);
  const hotel_name = clip(b.hotelName, 160);
  if (!hotel_id || !hotel_name) return { ok: false, error: "Pick a stay to watch." };
  if (!isoDate(b.checkIn) || !isoDate(b.checkOut) || b.checkOut <= b.checkIn) return { ok: false, error: "Pick your dates first." };
  if (b.checkOut < today) return { ok: false, error: "Those dates have already passed." };
  const target = Number(b.targetPrice);
  if (!Number.isFinite(target) || target < 1 || target > 99999) return { ok: false, error: "Enter a price between 1 and 99999." };
  const start = Number(b.startPrice);
  return {
    ok: true,
    value: {
      hotel_id,
      hotel_name,
      city: clip(b.city, 100),
      check_in: b.checkIn,
      check_out: b.checkOut,
      adults: whole(b.adults, 1, 10, 2),
      children: whole(b.children, 0, 6, 0),
      target_price: Math.round(target * 100) / 100,
      start_price: Number.isFinite(start) && start > 0 && start < 100000 ? Math.round(start * 100) / 100 : null,
    },
  };
}

/** Alerts with the same place, dates and guests share one price search. */
export const groupKey = (a: Pick<StoredAlert, "city" | "check_in" | "check_out" | "adults" | "children">) =>
  [a.city.trim().toLowerCase(), a.check_in, a.check_out, a.adults, a.children].join("|");

/** Email when the price is at or under the target. Again only for a real drop, or after a week. */
export function shouldNotify(alert: StoredAlert, price: number, now = Date.now()): boolean {
  if (!(price > 0) || price > Number(alert.target_price)) return false;
  if (!alert.last_notified_at) return true;
  const days = (now - Date.parse(alert.last_notified_at)) / 864e5;
  const before = Number(alert.last_notified_price) || Infinity;
  return price <= before * 0.95 || days >= 7;
}

const esc = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function buildEmail(alert: StoredAlert, price: number, siteUrl: string) {
  const dates = `${day(alert.check_in)} to ${day(alert.check_out)}`;
  const place = alert.city ? ` in ${alert.city}` : "";
  const subject = `Price drop: ${alert.hotel_name} is now $${Math.round(price)} a night`;
  const text = [
    "Good news.",
    `${alert.hotel_name}${place} is now $${Math.round(price)} a night for ${dates}.`,
    `You asked us to tell you when it went below $${Math.round(Number(alert.target_price))}.`,
    "Prices change quickly, so open Hotel Indice to check the live rate:",
    siteUrl,
    "",
    "You are getting this because you set a price alert. Remove it any time from Trips, then Alerts.",
  ].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#183e50">
<h2 style="margin:0 0 12px">Good news</h2>
<p style="font-size:16px;line-height:1.5"><strong>${esc(alert.hotel_name)}</strong>${esc(place)} is now <strong>$${Math.round(price)} a night</strong> for ${esc(dates)}.</p>
<p style="font-size:15px;line-height:1.5">You asked us to tell you when it went below $${Math.round(Number(alert.target_price))}.</p>
<p><a href="${esc(siteUrl)}" style="display:inline-block;padding:12px 20px;background:#183e50;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Check the live rate</a></p>
<p style="font-size:13px;color:#5b6e72">Prices change quickly. You are getting this because you set a price alert. Remove it any time from Trips, then Alerts.</p>
</div>`;
  return { subject, text, html };
}
