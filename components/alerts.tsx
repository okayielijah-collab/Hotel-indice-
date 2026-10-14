"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { Bell, Trash2 } from "lucide-react";
import type { Hotel } from "@/lib/hotels";
import type { Account } from "./account";
import { getTranslations, type SiteLanguage } from "@/lib/i18n";

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

const day = (iso: string, language: SiteLanguage = "en") =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(language === "es" ? "es-ES" : language === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function useAlerts(account: Account, language: SiteLanguage = "en"): Alerts {
  const t = getTranslations(language);
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
        if (!res) return t.signInAgain;
        const data = (await res.json().catch(() => ({}))) as { alert?: PriceAlert; error?: string };
        if (!res.ok || !data.alert) return data.error || t.couldNotSaveAlert;
        const saved = data.alert;
        setAlerts((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        return "";
      } catch {
        return t.networkProblem;
      }
    },
    [authedFetch, t.signInAgain, t.couldNotSaveAlert, t.networkProblem],
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
  language = "en",
}: {
  hotel: Hotel;
  dates: { checkIn: string; checkOut: string } | null;
  adults: number;
  children: number;
  signedIn: boolean;
  alerts: Alerts;
  onNeedSignIn: () => void;
  language?: SiteLanguage;
}) {
  const t = getTranslations(language);
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
    setNote(dates ? "" : t.pickDatesFirst);
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
        <Bell size={15} aria-hidden /> {existing ? t.watchingPrice : t.watchPrice}
      </button>
      {open && (
        <div className="cc-watch-form" role="group" aria-label={t.priceAlert}>
          <p>{t.emailWhenPriceDrops}</p>
          {dates && <small>{day(dates.checkIn, language)} {t.to} {day(dates.checkOut, language)}{price > 0 ? `. ${t.rightNowAbout} $${Math.round(price)}.` : "."}</small>}
          <div className="cc-watch-row">
            <span aria-hidden>$</span>
            <input inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ""))} aria-label={t.targetPriceNightUsd} disabled={!dates} />
            <button type="button" onClick={() => void save()} disabled={busy || !dates || !(Number(target) > 0)}>{busy ? t.savingAlert : existing ? t.updateAlert : t.saveAlert}</button>
            <button type="button" className="cc-watch-cancel" onClick={() => setOpen(false)}>{t.stopWatching}</button>
          </div>
          {note && <p className="cc-watch-note" role="status">{note}</p>}
        </div>
      )}
    </>
  );
}

/** The Alerts tab inside Trips. */
export function AlertsTab({ alerts, signedIn, formatPrice, language = "en" }: { alerts: Alerts; signedIn: boolean; formatPrice: (usd: number) => string; language?: SiteLanguage }) {
  const t = getTranslations(language);
  if (!signedIn) return <p className="cc-drawer-empty">{t.signInToWatch}</p>;
  if (!alerts.alerts.length) return <p className="cc-drawer-empty">{t.emptyAlerts}</p>;
  return (
    <>
      {alerts.alerts.map((item) => (
        <div className="cc-trip cc-alert" key={item.id}>
          <div className="cc-trip-main cc-alert-main">
            <strong>{item.hotel_name}</strong>
            <span>
              {item.city ? `${item.city}. ` : ""}{day(item.check_in, language)} {t.to} {day(item.check_out, language)}
            </span>
            <span>
              {t.tellMeBelow} {formatPrice(Number(item.target_price))}.{" "}
              {item.last_price ? ` ${t.lastSeen}: ${formatPrice(Number(item.last_price))}.` : t.notCheckedYet}
            </span>
          </div>
          <button type="button" className="cc-trip-icon" aria-label={`${t.stopWatchingHotel} ${item.hotel_name}`} onClick={() => void alerts.remove(item.id)}>
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      ))}
    </>
  );
}
