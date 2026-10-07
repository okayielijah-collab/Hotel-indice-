"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { Bell, Trash2 } from "lucide-react";
import type { Hotel } from "@/lib/hotels";
import type { Account } from "./account";

export type PriceAlert = {
  id: string;
  hotel_id: string;
  hotel_name: string;
  city: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  target_price: number;
  start_price: number | null;
  last_price: number | null;
  last_checked_at: string | null;
  last_notified_at: string | null;
};

type NewAlert = {
  hotelId: string;
  hotelName: string;
  city: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  targetPrice: number;
  startPrice: number;
};

export type Alerts = {
  alerts: PriceAlert[];
  add: (input: NewAlert) => Promise<string>;
  remove: (id: string) => Promise<void>;
};

const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function useAlerts(account: Account): Alerts {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const signedIn = Boolean(account.session);
  const { authedFetch } = account;

  const load = useCallback(async () => {
    if (!signedIn) {
      setAlerts([]);
      return;
    }
    try {
      const res = await authedFetch("/api/alerts");
      if (res?.ok) setAlerts(((await res.json()) as { alerts?: PriceAlert[] }).alerts ?? []);
    } catch {
      /* the list stays as it was */
    }
  }, [signedIn, authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Returns an error message to show, or an empty string when it worked. */
  const add = useCallback(
    async (input: NewAlert) => {
      try {
        const res = await authedFetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
        if (!res) return "Please sign in again.";
        const data = (await res.json().catch(() => ({}))) as { alert?: PriceAlert; error?: string };
        if (!res.ok || !data.alert) return data.error || "Could not save the alert.";
        const saved = data.alert;
        setAlerts((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        return "";
      } catch {
        return "Network problem. Try again.";
      }
    },
    [authedFetch],
  );

  const remove = useCallback(
    async (id: string) => {
      setAlerts((current) => current.filter((item) => item.id !== id));
      try {
        await authedFetch(`/api/alerts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      } catch {
        void load();
      }
    },
    [authedFetch, load],
  );

  return { alerts, add, remove };
}

/** The Watch price button on a stay, with a small form for the target price. */
export function WatchPrice({
  hotel,
  dates,
  adults,
  children,
  signedIn,
  alerts,
  onNeedSignIn,
}: {
  hotel: Hotel;
  dates: { checkIn: string; checkOut: string } | null;
  adults: number;
  children: number;
  signedIn: boolean;
  alerts: Alerts;
  onNeedSignIn: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const price = hotel.estimated_price_per_night;
  const existing = dates
    ? alerts.alerts.find((item) => item.hotel_id === hotel.id && item.check_in === dates.checkIn && item.check_out === dates.checkOut)
    : undefined;

  const begin = () => {
    if (!signedIn) {
      onNeedSignIn();
      return;
    }
    setNote(dates ? "" : "Pick your dates first so we watch the right price.");
    setTarget(String(existing?.target_price ?? (price > 0 ? Math.round(price * 0.9) : "")));
    setOpen((current) => !current);
  };

  const save = async () => {
    if (!dates) return;
    setBusy(true);
    setNote("");
    const message = await alerts.add({
      hotelId: hotel.id,
      hotelName: hotel.name,
      city: hotel.city,
      checkIn: dates.checkIn,
      checkOut: dates.checkOut,
      adults,
      children,
      targetPrice: Number(target),
      startPrice: price,
    });
    setBusy(false);
    if (message) setNote(message);
    else setOpen(false);
  };

  return (
    <>
      <button type="button" className="cc-dm-save cc-dm-watch" aria-pressed={Boolean(existing)} aria-expanded={open} onClick={begin}>
        <Bell size={15} aria-hidden /> {existing ? "Watching" : "Watch price"}
      </button>
      {open && (
        <div className="cc-watch-form" role="group" aria-label="Price alert">
          <p>Email me when the price drops below this amount a night, in US dollars.</p>
          {dates && <small>For {day(dates.checkIn)} to {day(dates.checkOut)}{price > 0 ? `. Right now about $${Math.round(price)}.` : "."}</small>}
          <div className="cc-watch-row">
            <span aria-hidden>$</span>
            <input inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ""))} aria-label="Target price a night in US dollars" disabled={!dates} />
            <button type="button" onClick={() => void save()} disabled={busy || !dates || !(Number(target) > 0)}>{busy ? "Saving" : existing ? "Update" : "Save alert"}</button>
            <button type="button" className="cc-watch-cancel" onClick={() => setOpen(false)}>Cancel</button>
          </div>
          {note && <p className="cc-watch-note" role="status">{note}</p>}
        </div>
      )}
    </>
  );
}

/** The Alerts tab inside Trips. */
export function AlertsTab({ alerts, signedIn, formatPrice }: { alerts: Alerts; signedIn: boolean; formatPrice: (usd: number) => string }) {
  if (!signedIn) return <p className="cc-drawer-empty">Sign in above to watch a stay. We email you when its price drops.</p>;
  if (!alerts.alerts.length) return <p className="cc-drawer-empty">Open a stay and tap Watch price. We check once a day and email you when it drops below your price.</p>;
  return (
    <>
      {alerts.alerts.map((item) => (
        <div className="cc-trip cc-alert" key={item.id}>
          <div className="cc-trip-main cc-alert-main">
            <strong>{item.hotel_name}</strong>
            <span>
              {item.city ? `${item.city}. ` : ""}{day(item.check_in)} to {day(item.check_out)}
            </span>
            <span>
              Tell me below {formatPrice(Number(item.target_price))}.{" "}
              {item.last_price ? `Last seen ${formatPrice(Number(item.last_price))}.` : "Not checked yet."}
            </span>
          </div>
          <button type="button" className="cc-trip-icon" aria-label={`Stop watching ${item.hotel_name}`} onClick={() => void alerts.remove(item.id)}>
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      ))}
    </>
  );
}
