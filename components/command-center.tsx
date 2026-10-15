"use client";

import { AccountPanel, useAccount } from "./account";
import { AlertsTab, WatchPrice, useAlerts } from "./alerts";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Banknote, Bookmark, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Globe2, Languages, Heart, Map as MapIcon, MapPin, MessageSquare, Moon, Search, SlidersHorizontal, Sparkles, Star, Sun, Trash2, X, Mic, Square } from "lucide-react";
import { MapView } from "@/components/map-view";
import { amenityLabels, cities, vibeLabels, type Hotel, type PriceTier } from "@/lib/hotels";
import { popularDestinations } from "@/lib/destinations";
import { interpretTrip } from "@/lib/matching";
import type { Match } from "@/lib/matching";
import { getTranslations, type SiteLanguage } from "@/lib/i18n";

const amenityTranslations: Record<SiteLanguage, Record<string, string>> = {
  en: {
    fast_wifi: "Fast wifi", breakfast: "Breakfast", pool: "Pool", spa: "Spa",
    gym: "Gym", workspace: "Workspace", family_rooms: "Family rooms",
    parking: "Parking", airport_transfer: "Airport transfer",
    room_service: "Room service", laundry: "Laundry", yoga: "Yoga",
  },
  es: {
    fast_wifi: "Wi-Fi rápido", breakfast: "Desayuno", pool: "Piscina", spa: "Spa",
    gym: "Gimnasio", workspace: "Espacio de trabajo", family_rooms: "Habitaciones familiares",
    parking: "Aparcamiento", airport_transfer: "Traslado al aeropuerto",
    room_service: "Servicio de habitaciones", laundry: "Lavandería", yoga: "Yoga",
  },
  fr: {
    fast_wifi: "Wi-Fi rapide", breakfast: "Petit-déjeuner", pool: "Piscine", spa: "Spa",
    gym: "Salle de sport", workspace: "Espace de travail", family_rooms: "Chambres familiales",
    parking: "Parking", airport_transfer: "Transfert aéroport",
    room_service: "Service en chambre", laundry: "Blanchisserie", yoga: "Yoga",
  },
};

const vibeTranslations: Record<SiteLanguage, Record<string, string>> = {
  en: {},
  es: {
    romantic: "Romántico", boutique: "Boutique", design_led: "Diseño",
    remote_work: "Ideal para trabajar", cultural: "Cultura", nightlife: "Vida nocturna",
    solo: "Viajar solo", family_friendly: "Ideal para familias", business: "Negocios",
    quiet: "Tranquilo", wellness: "Bienestar", beach: "Playa",
  },
  fr: {
    romantic: "Romantique", boutique: "Boutique", design_led: "Design",
    remote_work: "Adapté au télétravail", cultural: "Culture", nightlife: "Vie nocturne",
    solo: "Voyage solo", family_friendly: "Adapté aux familles", business: "Affaires",
    quiet: "Calme", wellness: "Bien-être", beach: "Plage",
  },
};

function localizedAmenity(key: string, language: SiteLanguage): string {
  return amenityTranslations[language][key] ?? amenityLabels[key] ?? key.replaceAll("_", " ");
}

function localizedVibe(key: string, language: SiteLanguage): string {
  return vibeTranslations[language][key] ?? vibeLabels[key] ?? key;
}


type Props = {
  initialMatches: Match[];
  source: "supabase" | "demo" | "provider";
  catalogError?: string;
};

type InterpretedTrip = ReturnType<typeof interpretTrip>;

type MatchResponse = {
  matches: Match[];
  error?: string;
  enhanced?: boolean;
  understood?: string;
  interpreted?: InterpretedTrip;
  notice?: string;
};
type SortKey = "match" | "price_asc" | "price_desc" | "rating";
type Range = [number, number];
type DetailTab = "ratings" | "info" | "photos" | "pros" | "amenities" | "match";

const localizedExamples: Record<SiteLanguage, string[]> = {
  en: [
    "A romantic weekend in Paris with a spa",
    "A work trip to Lagos with fast wifi",
    "A Bali escape with a pool under $180",
  ],
  es: [
    "Un fin de semana romántico en París con spa",
    "Un viaje de trabajo a Lagos con wifi rápido",
    "Una escapada a Bali con piscina por menos de 180 $",
  ],
  fr: [
    "Un week-end romantique à Paris avec spa",
    "Un voyage professionnel à Lagos avec un wifi rapide",
    "Une escapade à Bali avec piscine à moins de 180 $",
  ],
};

const examples = [
  "A romantic weekend in Paris with a spa",
  "A work trip to Lagos with fast wifi",
  "A Bali escape with a pool under $180",
];
// Footer links. Change these if your pages live somewhere else. Leave CONTACT_EMAIL empty to hide the Contact link.
const SITE_LINKS = { about: "/about", privacy: "/privacy", terms: "/terms" };
const CONTACT_EMAIL = "";
// Optional: paste a good photo link for a city and the tile uses it. Example: Lisbon: "https://...".
const TILE_PHOTOS: Record<string, string> = {};
const localizedPopularTripTitles: Record<SiteLanguage, Record<string, string>> = {
  en: {
    Paris: "A romantic weekend in Paris",
    Lagos: "A work trip to Lagos",
    Bali: "A Bali escape",
    Tokyo: "A stylish stay in Tokyo",
    London: "A city break in London",
    "New York": "A weekend in New York",
  },
  es: {
    Paris: "Un fin de semana romántico en París",
    Lagos: "Un viaje de trabajo a Lagos",
    Bali: "Una escapada a Bali",
    Tokyo: "Una estancia con estilo en Tokio",
    London: "Una escapada urbana a Londres",
    "New York": "Un fin de semana en Nueva York",
  },
  fr: {
    Paris: "Un week-end romantique à Paris",
    Lagos: "Un voyage professionnel à Lagos",
    Bali: "Une escapade à Bali",
    Tokyo: "Un séjour élégant à Tokyo",
    London: "Une escapade citadine à Londres",
    "New York": "Un week-end à New York",
  },
};

const POPULAR_TRIPS = [
  { city: "Paris", title: "A romantic weekend in Paris", query: "A romantic weekend in Paris with a spa" },
  { city: "Lagos", title: "A work trip to Lagos", query: "A work trip to Lagos with fast wifi" },
  { city: "Bali", title: "A Bali escape", query: "A Bali escape with a pool" },
  { city: "Tokyo", title: "A stylish stay in Tokyo", query: "A stylish stay in Tokyo with breakfast" },
  { city: "London", title: "A city break in London", query: "A city break in London with fast wifi" },
  { city: "New York", title: "A weekend in New York", query: "A weekend in New York with a gym" },
];
const BINS = 44;
const THEME_KEY = "hotel-indice:cc-theme";

// Approximate mid-market rates (USD base, Aug 2026). Fixed values: swap for a live feed before showing them as exact.
const currencyRates: Record<string, number> = { USD: 1, EUR: 0.867, GBP: 0.743, NGN: 1363, JPY: 157.7, INR: 95.4, AED: 3.6725, AUD: 1.4194, CAD: 1.4067, CHF: 0.8091, CNY: 6.7531, DKK: 6.4832, HKD: 7.8428, ILS: 3.0105, NZD: 1.6966, PLN: 3.7264, QAR: 3.6457, SAR: 3.75, SEK: 9.5211, SGD: 1.2823, TRY: 47.55, ZAR: 16.3874, THB: 31.1, MXN: 17.15 };
const amenityChoices = ["fast_wifi", "pool", "breakfast", "spa", "gym", "workspace", "family_rooms", "parking"];
const styleChoices = ["romantic", "boutique", "design_led", "remote_work", "family_friendly", "wellness", "beach", "nightlife", "cultural"];

type TripForm = {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  budget: PriceTier | "Any";
  vibe: string;
  amenities: string[];
};
const blankTrip: TripForm = { destination: "", checkIn: "", checkOut: "", adults: 2, children: 0, budget: "Any", vibe: "", amenities: [] };

/** Three or more words reads as a described stay, not a hotel name. */
const isSentence = (text: string) => text.trim().split(/\s+/).filter(Boolean).length >= 3;

const signalLabels: Record<string, string> = {
  near_restaurants: "Near restaurants",
  central: "Central",
  near_beach: "Near the beach",
  quiet: "Quiet",
  good_room: "Good room",
  romantic: "Romantic",
  family_suitable: "Family-friendly",
  work_friendly: "Work-friendly",
  walkable: "Walkable",
};

const partyLabels: Record<string, string> = {
  couple: "Couple",
  family: "Family",
  solo: "Solo",
  business: "Work trip",
};

function intelligenceLabel(signal: string) {
  return signalLabels[signal] || signal.replace(/_/g, " ");
}

function tripPurposeLabel(intent: InterpretedTrip) {
  if (intent.purpose) {
    return intent.purpose
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  if (intent.vibe && vibeLabels[intent.vibe]) {
    return vibeLabels[intent.vibe];
  }

  return "";
}

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoDay(d);
};
const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Card photo with a calm placeholder, so a dead image link never shows as a grey box. */
function HotelPhoto({ src, name, eager }: { src?: string; name: string; eager: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="cc-photo-fallback" aria-hidden>
        {name.trim().charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Illustrative view for ${name}`}
      referrerPolicy="no-referrer"
      loading={eager ? "eager" : "lazy"}
      onError={() => setFailed(true)}
    />
  );
}

type LastSearch = { kind: "trip"; trip: TripForm } | { kind: "text"; query: string; destination: string };

/** Anonymous usage events (no IP, no account). Failing to send must never affect the visitor. */
function track(event: Record<string, unknown>) {
  try {
    const body = JSON.stringify(event);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
  } catch { /* ignore */ }
}

function shareParams(search: LastSearch): URLSearchParams {
  const params = new URLSearchParams();
  if (search.kind === "text") {
    params.set("q", search.query.slice(0, 300));
    if (search.destination) params.set("where", search.destination);
    return params;
  }
  const trip = search.trip;
  if (trip.destination) params.set("where", trip.destination);
  if (trip.checkIn && trip.checkOut) { params.set("in", trip.checkIn); params.set("out", trip.checkOut); }
  if (trip.adults !== 2) params.set("adults", String(trip.adults));
  if (trip.children) params.set("children", String(trip.children));
  if (trip.budget !== "Any") params.set("budget", trip.budget);
  if (trip.vibe) params.set("style", trip.vibe);
  if (trip.amenities.length) params.set("must", trip.amenities.join(","));
  return params;
}

/** Reads a shared link back into a search. Everything is validated; unknown values are dropped. */
function parseShared(queryString: string): LastSearch | null {
  const params = new URLSearchParams(queryString);
  const where = (params.get("where") ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 100);
  const text = (params.get("q") ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 300);
  if (text) return { kind: "text", query: text, destination: where };
  if (!["where", "in", "out", "adults", "children", "budget", "style", "must"].some((key) => params.has(key))) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const checkIn = iso.test(params.get("in") ?? "") ? (params.get("in") as string) : "";
  const checkOut = iso.test(params.get("out") ?? "") ? (params.get("out") as string) : "";
  const validDates = checkIn && checkOut && checkOut > checkIn;
  const number = (key: string, fallback: number, min: number, max: number) => {
    const value = Number.parseInt(params.get(key) ?? "", 10);
    return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
  };
  const budget = ["Budget", "Mid-range", "Luxury"].includes(params.get("budget") ?? "") ? (params.get("budget") as PriceTier) : "Any";
  const style = styleChoices.includes(params.get("style") ?? "") ? (params.get("style") as string) : "";
  const must = (params.get("must") ?? "").split(",").filter((item) => amenityChoices.includes(item)).slice(0, 8);
  return {
    kind: "trip",
    trip: { ...blankTrip, destination: where, checkIn: validDates ? checkIn : "", checkOut: validDates ? checkOut : "", adults: number("adults", 2, 1, 10), children: number("children", 0, 0, 6), budget, vibe: style, amenities: must },
  };
}

const TRIPS_KEY = "hotel-indice:trips:v1";
type SavedTrip = { id: string; trip: TripForm; label: string; saved: boolean; at: number };
type TripStore = { trips: SavedTrip[]; stays: Match[] };

function tripKey(trip: TripForm): string {
  return JSON.stringify([trip.destination.trim().toLowerCase(), trip.checkIn, trip.checkOut, trip.adults, trip.children, trip.budget, trip.vibe, [...trip.amenities].sort()]);
}
function tripTitle(trip: TripForm): string {
  return trip.destination.trim() || "Anywhere";
}
function tripSummary(trip: TripForm, language: SiteLanguage = "en"): string {
  const t = getTranslations(language);
  const locale = language === "es" ? "es-ES" : language === "fr" ? "fr-FR" : "en-GB";
  const parts: string[] = [];
  if (trip.checkIn && trip.checkOut) {
    parts.push(`${dayLabel(trip.checkIn, language)} - ${dayLabel(trip.checkOut, language)}`);
  }

  const adultsLabel = trip.adults === 1 ? t.adult : t.adults;
  const childrenLabel = trip.children === 1 ? t.child : t.children;
  parts.push(`${trip.adults} ${adultsLabel}${trip.children ? `, ${trip.children} ${childrenLabel}` : ""}`);

  const filters = (trip.budget !== "Any" ? 1 : 0) + (trip.vibe ? 1 : 0) + trip.amenities.length;
  if (filters) {
    const filterLabel = language === "es"
      ? (filters === 1 ? "filtro" : "filtros")
      : language === "fr"
        ? (filters === 1 ? "filtre" : "filtres")
        : (filters === 1 ? "filter" : "filters");
    parts.push(`${filters.toLocaleString(locale)} ${filterLabel}`);
  }
  return parts.join(" · ");
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function fromISO(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
}
function dayLabel(value: string, language: SiteLanguage = "en"): string {
  const date = fromISO(value);
  return date ? date.toLocaleDateString(language === "es" ? "es-ES" : language === "fr" ? "fr-FR" : "en-GB", { weekday: "short", day: "numeric", month: "short" }) : "";
}

/** Two-month range calendar (check in, then check out), in the style of the booking sites. */
function RangeCalendar({ checkIn, checkOut, onPick, onClear, onDone, language }: { checkIn: string; checkOut: string; onPick: (checkIn: string, checkOut: string) => void; onClear: () => void; onDone: () => void; language: SiteLanguage }) {
  const t = getTranslations(language);
  const todayISO = toISO(new Date());
  const [first, setFirst] = useState(() => { const base = fromISO(checkIn) ?? new Date(); return new Date(base.getFullYear(), base.getMonth(), 1); });
  const [hover, setHover] = useState("");

  const pick = (iso: string) => {
    if (!checkIn || checkOut) { onPick(iso, ""); return; }
    if (iso <= checkIn) { onPick(iso, ""); return; }
    onPick(checkIn, iso);
    onDone();
  };
  const rangeEnd = checkOut || (checkIn && hover > checkIn ? hover : "");

  const months = [0, 1].map((offset) => {
    const start = new Date(first.getFullYear(), first.getMonth() + offset, 1);
    const length = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const blanks = (start.getDay() + 6) % 7;
    const days = Array.from({ length }, (_, i) => toISO(new Date(start.getFullYear(), start.getMonth(), i + 1)));
    return { start, blanks, days };
  });

  return (
    <div className="ccb-cal" role="dialog" aria-label={t.dates}>
      <div className="ccb-cal-months">
        {months.map((month, index) => (
          <div className="ccb-month" key={month.start.toISOString()} data-second={index === 1}>
            <div className="ccb-month-head">
              {index === 0 ? <button type="button" className="ccb-nav" aria-label={language === "es" ? "Mes anterior" : language === "fr" ? "Mois précédent" : "Previous month"} disabled={first <= new Date(new Date().getFullYear(), new Date().getMonth(), 1)} onClick={() => setFirst(new Date(first.getFullYear(), first.getMonth() - 1, 1))}><ChevronLeft size={18} aria-hidden /></button> : <span className="ccb-nav-spacer" />}
              <strong>{month.start.toLocaleDateString(language === "es" ? "es-ES" : language === "fr" ? "fr-FR" : "en-GB", { month: "long", year: "numeric" })}</strong>
              {index === 1 ? <button type="button" className="ccb-nav" aria-label={language === "es" ? "Mes siguiente" : language === "fr" ? "Mois suivant" : "Next month"} onClick={() => setFirst(new Date(first.getFullYear(), first.getMonth() + 1, 1))}><ChevronRight size={18} aria-hidden /></button> : <span className="ccb-nav-spacer" />}
            </div>
            <div className="ccb-grid">
              {(language === "es" ? ["lu", "ma", "mi", "ju", "vi", "sá", "do"] : language === "fr" ? ["lu", "ma", "me", "je", "ve", "sa", "di"] : WEEKDAYS).map((name) => <span className="ccb-wd" key={name}>{name}</span>)}
              {Array.from({ length: month.blanks }, (_, i) => <span key={`b-${i}`} />)}
              {month.days.map((iso) => {
                const past = iso < todayISO;
                const isStart = iso === checkIn;
                const isEnd = iso === checkOut;
                const inRange = Boolean(checkIn && rangeEnd && iso > checkIn && iso < rangeEnd);
                return (
                  <button key={iso} type="button" disabled={past} className="ccb-day" data-start={isStart} data-end={isEnd} data-range={inRange || (isStart && Boolean(rangeEnd)) || (iso === rangeEnd && !isEnd)} data-today={iso === todayISO}
                    aria-label={dayLabel(iso, language)} aria-pressed={isStart || isEnd} onMouseEnter={() => setHover(iso)} onClick={() => pick(iso)}>
                    {Number(iso.slice(8))}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="ccb-cal-foot">
        <span>{checkIn ? `${dayLabel(checkIn, language)}${checkOut ? ` ${t.to} ${dayLabel(checkOut, language)}` : t.chooseCheckOut}` : t.chooseCheckIn}</span>
        <div>
          <button type="button" className="ccb-link" onClick={onClear}>{t.clearDates}</button>
          <button type="button" className="ccb-done" onClick={onDone}>{t.done}</button>
        </div>
      </div>
    </div>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="ccb-stepper">
      <span>{label}</span>
      <div>
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <strong aria-live="polite">{value}</strong>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

/** Header search bar from the committed version: destination, dates, guests and a filters panel. */
function HeaderSearch({ trip, setTrip, onSubmit, busy, language }: { trip: TripForm; setTrip: (trip: TripForm) => void; onSubmit: () => void; busy: boolean; language: SiteLanguage }) {
  const t = getTranslations(language);
  const id = useId();
  const [open, setOpen] = useState<"dates" | "guests" | "more" | null>(null);
  const update = (changes: Partial<TripForm>) => setTrip({ ...trip, ...changes });
  const guestText = `${trip.adults} ${trip.adults === 1 ? t.adult : t.adults}${trip.children ? ` ${language === "fr" ? "et" : language === "es" ? "y" : "and"} ${trip.children} ${trip.children === 1 ? t.child : t.children}` : ""}`;
  const moreCount = (trip.budget !== "Any" ? 1 : 0) + (trip.vibe ? 1 : 0) + trip.amenities.length;

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!(event.target as HTMLElement | null)?.closest(".ccb-pop")) setOpen(null); };
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(null); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, []);

  return (
    <form className="ccb" onSubmit={(event) => { event.preventDefault(); setOpen(null); onSubmit(); }}>
      <div className="ccb-field ccb-dest">
        <label className="ccb-label" htmlFor={`${id}-dest`}>{t.whereTo}</label>
        <input spellCheck={false} id={`${id}-dest`} type="text" className="ccb-text" list={`${id}-countries`} value={trip.destination} placeholder={t.destinationPlaceholder} autoComplete="off" maxLength={100}
          onChange={(event) => update({ destination: event.target.value })}
          onBlur={(event) => {
            const typed = event.target.value.trim();
            const known = cities.find((city) => city.toLowerCase() === typed.toLowerCase());
            if ((known || typed) !== trip.destination) update({ destination: known || typed });
          }} />
        <datalist id={`${id}-countries`}>
          {[...new Set([
            ...popularDestinations.map((place) => place.country),
            ...popularDestinations.map((place) => place.name),
            ...popularDestinations.map((place) => `${place.name}, ${place.country}`),
          ])].map((destination) => (
            <option key={destination} value={destination} />
          ))}
        </datalist>
      </div>

      <div className={`ccb-field ccb-pop ccb-dates${open === "dates" ? " is-open" : ""}`}>
        <button type="button" className="ccb-trigger" aria-expanded={open === "dates"} onClick={() => setOpen(open === "dates" ? null : "dates")}>
          <span className="ccb-label">{t.dates}</span>
          <span className="ccb-value ccb-value-row"><CalendarDays size={15} aria-hidden />{trip.checkIn ? `${dayLabel(trip.checkIn, language)} - ${trip.checkOut ? dayLabel(trip.checkOut, language) : t.checkOut}` : <em>{t.addDates}</em>}</span>
        </button>
        {open === "dates" && (
          <RangeCalendar language={language} checkIn={trip.checkIn} checkOut={trip.checkOut}
            onPick={(checkIn, checkOut) => update({ checkIn, checkOut })}
            onClear={() => update({ checkIn: "", checkOut: "" })}
            onDone={() => setOpen(null)} />
        )}
      </div>

      <div className={`ccb-field ccb-pop ccb-guests${open === "guests" ? " is-open" : ""}`}>
        <button type="button" className="ccb-trigger" aria-expanded={open === "guests"} onClick={() => setOpen(open === "guests" ? null : "guests")}>
          <span className="ccb-label">{t.guests}</span>
          <span className="ccb-value">{guestText}</span>
        </button>
        {open === "guests" && (
          <div className="ccb-panel">
            <Stepper label={language === "es" ? "Adultos" : language === "fr" ? "Adultes" : "Adults"} value={trip.adults} min={1} max={10} onChange={(value) => update({ adults: value })} />
            <Stepper label={language === "es" ? "Niños" : language === "fr" ? "Enfants" : "Children"} value={trip.children} min={0} max={6} onChange={(value) => update({ children: value })} />
            <button type="button" className="ccb-done" onClick={() => setOpen(null)}>{t.done}</button>
          </div>
        )}
      </div>

      <div className={`ccb-field ccb-pop ccb-more${open === "more" ? " is-open" : ""}`}>
        <button type="button" className="ccb-trigger ccb-trigger-row" aria-expanded={open === "more"} onClick={() => setOpen(open === "more" ? null : "more")}>
          <SlidersHorizontal size={16} aria-hidden />
          <span className="ccb-value">{t.moreFilters}</span>
          {moreCount > 0 ? <span className="ccb-count">{moreCount}</span> : null}
          <ChevronDown size={14} aria-hidden />
        </button>
        {open === "more" && (
          <div className="ccb-panel ccb-panel-wide">
            <div className="ccb-mobile-filter-head">
              <button type="button" className="ccb-mobile-filter-back" onClick={() => setOpen(null)}>
                <ChevronLeft size={18} aria-hidden />
                <span>{t.filters}</span>
              </button>
              <button
                type="button"
                className="ccb-mobile-filter-reset"
                onClick={() => update({ budget: "Any", vibe: "", amenities: [] })}
              >
                {t.reset}
              </button>
            </div>

            <div className="ccb-pfield">
              <label className="ccb-label" htmlFor={`${id}-budget`}>{t.budget}</label>
              <select id={`${id}-budget`} className="ccb-select" value={trip.budget} onChange={(event) => update({ budget: event.target.value as TripForm["budget"] })}>
                {[
                  ["Any", t.any],
                  ["Budget", language === "es" ? "Económico" : language === "fr" ? "Économique" : "Budget"],
                  ["Mid-range", t.midRange],
                  ["Luxury", t.luxury],
                ].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="ccb-pfield">
              <label className="ccb-label" htmlFor={`${id}-vibe`}>{t.stayStyle}</label>
              <select id={`${id}-vibe`} className="ccb-select" value={trip.vibe} onChange={(event) => update({ vibe: event.target.value })}>
                <option value="">{t.anyStyle}</option>
                {styleChoices.map((v) => <option key={v} value={v}>{localizedVibe(v, language)}</option>)}
              </select>
            </div>
            <div className="ccb-pfield ccb-span">
              <span className="ccb-label">{t.mustHaves}</span>
              <div className="ccb-checks">
                {amenityChoices.map((amenity) => (
                  <label className="ccb-check" key={amenity}>
                    <input type="checkbox" checked={trip.amenities.includes(amenity)} onChange={() => update({ amenities: toggle(trip.amenities, amenity) })} />
                    <span>{localizedAmenity(amenity, language)}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="button" className="ccb-done ccb-span" onClick={() => setOpen(null)}>
              <span className="ccb-desktop-done">{t.done}</span>
              <span className="ccb-mobile-done">{t.showStays}</span>
            </button>
          </div>
        )}
      </div>

      <button type="submit" className="ccb-go" disabled={busy}><Search size={16} aria-hidden /><span>{busy ? t.searching : t.findYourStay}</span></button>
    </form>
  );
}

function trackedLink(hotel: Hotel): string {
  try {
    const url = new URL(hotel.affiliate_booking_link);
    if (url.protocol !== "https:") return "#";
    url.searchParams.set("utm_source", "hotel_indice");
    url.searchParams.set("utm_medium", "referral");
    url.searchParams.set("utm_campaign", "hotel_recommendations");
    url.searchParams.set("utm_content", hotel.id);
    return url.toString();
  } catch {
    return "#";
  }
}

function agodaSearchLink(hotel: Hotel): string {
  const url = new URL("https://www.agoda.com/search");
  url.searchParams.set("q", `${hotel.name} ${hotel.city}`);
  url.searchParams.set("utm_source", "hotel_indice");
  url.searchParams.set("utm_medium", "referral");
  url.searchParams.set("utm_campaign", "hotel_recommendations");
  url.searchParams.set("utm_content", hotel.id);
  return url.toString();
}

function partnerLinks(hotel: Hotel): { label: string; href: string }[] {
  return [
    { label: "Booking.com", href: trackedLink(hotel) },
    { label: "Agoda", href: agodaSearchLink(hotel) },
  ];
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function bounds(values: number[], fallback: Range, round: (v: number, up: boolean) => number): Range {
  if (!values.length) return fallback;
  const lo = round(Math.min(...values), false);
  const hi = round(Math.max(...values), true);
  if (hi > lo) return [lo, hi];
  // A single result still needs room to slide.
  const pad = Math.max(Math.abs(hi) * 0.05, 0.1);
  return [round(lo - pad, false), round(hi + pad, true)];
}

function RangeStrip({ title, summary, values, limits, range, step, onChange, label, icon, tone, format }: {
  title: string; summary: string; values: number[]; limits: Range; range: Range; step: number; onChange: (r: Range) => void; label: string;
  icon: ReactNode; tone: "price" | "rating" | "reviews"; format: (value: number) => string;
}) {
  const [min, max] = limits;
  const span = Math.max(max - min, 1e-9);
  const bins = useMemo(() => {
    const density = new Array<number>(BINS).fill(0);
    // A smooth curve of where the stays sit, so a handful of hotels still reads as a shape.
    const bandwidth = Math.max(span / 16, step);

    values.forEach((value) => {
      for (let i = 0; i < BINS; i++) {
        const mid = min + ((i + 0.5) / BINS) * span;
        const distance = (mid - value) / bandwidth;
        density[i] += Math.exp(-0.5 * distance * distance);
      }
    });

    const peak = Math.max(...density, 1);

    return density.map((count, i) => {
      const mid = min + ((i + 0.5) / BINS) * span;
      const normalized = count / peak;

      return {
        h: 3 + Math.pow(normalized, 0.85) * 97,
        t: i / Math.max(BINS - 1, 1),
        on: mid >= range[0] && mid <= range[1],
      };
    });
  }, [values, min, span, range, step]);
  const ticks = (() => {
    // Round values (for example 100, 200, 300), each placed where it really sits on the slider.
    const raw = span / 5;
    const unit = Math.pow(10, Math.floor(Math.log10(raw)));
    const stepSize = [1, 2, 2.5, 5, 10].map((m) => m * unit).find((s) => s >= raw) ?? raw;
    const out: { label: string; at: number }[] = [];
    for (let i = 0, v = Math.ceil(min / stepSize) * stepSize; i < 12 && v <= max + stepSize * 1e-6; i++, v += stepSize) {
      const value = Number(v.toFixed(6));
      const text = format(value);
      if (!out.some((tick) => tick.label === text)) out.push({ label: text, at: (value - min) / span });
    }
    return out;
  })();
  const left = ((range[0] - min) / span) * 100;
  const right = ((range[1] - min) / span) * 100;
  return (
    <div data-tone={tone}>
      <div className="cc-rng-title"><span className="cc-rng-chip">{icon}{title}</span><b>{summary}</b></div>
      <div className="cc-rng">
        <div className="cc-hist" aria-hidden>{bins.map((b, i) => <i key={i} className={b.on ? "on" : ""} style={{ height: `${b.h}%`, ["--t" as string]: b.t } as CSSProperties} />)}</div>
        <div className="cc-rng-track" aria-hidden><div className="cc-rng-fill" style={{ left: `${left}%`, width: `${Math.max(right - left, 0)}%` }} /></div>
        <input type="range" min={min} max={max} step={step} value={range[0]} aria-label={`Minimum ${label}`}
          onChange={(e) => onChange([Math.min(Number(e.target.value), range[1]), range[1]])} />
        <input type="range" min={min} max={max} step={step} value={range[1]} aria-label={`Maximum ${label}`}
          onChange={(e) => onChange([range[0], Math.max(Number(e.target.value), range[0])])} />
      </div>
      <div className="cc-rng-ticks" aria-hidden>{ticks.map((tick) => <span key={tick.at} style={{ left: `calc(11px + (100% - 22px) * ${tick.at})` }}>{tick.label}</span>)}</div>
    </div>
  );
}


/** The card's two honest lines: what fits, and the catch. */
function fitLine(match: Match): string {
  const { hotel } = match;
  const matched = (match.evidence ?? []).filter((item) => item.type === "match" && !item.label.toLowerCase().startsWith("room ≥")).map((item) => item.label);
  const fromData = hotel.amenities.slice(0, 3).map((a) => amenityLabels[a] ?? a);
  return (matched.length ? matched : fromData).slice(0, 3).join(" · ");
}

function hasFitEvidence(match: Match): boolean {
  return (match.evidence ?? []).some((item) => item.type === "match" && !item.label.toLowerCase().startsWith("room ≥"));
}

/** Shown when nothing in a search matched, or when there is no search yet. Uses the hotel's own editorial note. */
function defaultHook(hotel: Hotel): string {
  const first = (hotel.editorial_notes ?? "").trim().split(/(?<=[.!?])\s+/)[0] ?? "";
  if (first) return first.length > 110 ? first.slice(0, 107).trimEnd() + "…" : first;
  return hotel.vibe_tags.slice(0, 2).map((tag) => vibeLabels[tag] ?? tag).join(" · ");
}

/** A caution built only from the data we have: thin reviews, or a price well above the rest of the results. */
function dataCatch(match: Match, all: Match[]): string {
  const { hotel } = match;
  if (hotel.review_count > 0 && hotel.review_count < 100) return `Only ${hotel.review_count} reviews so far`;
  // Compare only with stays in the same city (or the same country when a city is missing).
  const place = (h: Hotel) => h.city || h.country;
  const peers = all.filter((m) => place(m.hotel) === place(hotel));
  const prices = peers.map((m) => m.hotel.estimated_price_per_night).filter((price) => price > 0);
  if (hotel.estimated_price_per_night > 0 && prices.length >= 4) {
    const cheaper = prices.filter((price) => price < hotel.estimated_price_per_night).length;
    if (cheaper / prices.length >= 0.75) return "Priced above most stays in these results";
  }
  return "";
}

type CatchInfo = { kind: "caution" | "unverified" | "note"; text: string; label: string };

/** Splits "what to know" into a real drawback, an unverified wish, or a plain note. */
function catchInfo(match: Match): CatchInfo | null {
  const reality = (match.evidence ?? []).find((item) => item.type === "tradeoff");
  if (reality) {
    if ((reality.detail ?? "").includes("does not provide enough evidence")) {
      return { kind: "unverified", text: "", label: reality.label };
    }
    return { kind: "caution", text: reality.detail ? `${reality.label}: ${reality.detail}` : reality.label, label: reality.label };
  }
  // Informational hotel facts belong in the details modal, not on result cards.
  return null;
}

function catchLine(match: Match): string {
  const reality = (match.evidence ?? []).find((item) => item.type === "tradeoff");
  if (reality) return reality.detail ? `${reality.label}: ${reality.detail}` : reality.label;
  const notes = (match.things_to_know ?? "").trim();
  if (!notes) return "";
  const sentences = notes.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences[sentences.length - 1] ?? "";
}

export function CommandCenter({ initialMatches, catalogError }: Props) {
  const base = initialMatches;


  const [query, setQuery] = useState("");
  const [rateDates, setRateDates] = useState<{ checkIn: string; checkOut: string; chosen: boolean } | null>(null);
  const [city, setCity] = useState("");
  const [tierSet, setTierSet] = useState<PriceTier[]>([]);
  const [vibe, setVibe] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("match");

  const [aiMatches, setAiMatches] = useState<Match[] | null>(null);
  const [aiQuery, setAiQuery] = useState("");
  const [interpretedTrip, setInterpretedTrip] = useState<InterpretedTrip | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [askText, setAskText] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [photo, setPhoto] = useState(0);
  const [detailTab, setDetailTab] = useState<DetailTab>("ratings");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [stripOpen, setStripOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"price" | "rating" | "reviews" | null>(null);
  const [entered, setEntered] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [heroText, setHeroText] = useState("");
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [voiceError, setVoiceError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [trip, setTrip] = useState<TripForm>(blankTrip);
  const [store, setStore] = useState<TripStore>({ trips: [], stays: [] });
  const [tripsLoaded, setTripsLoaded] = useState(false);
  const [tripsOpen, setTripsOpen] = useState(false);
  const [tripsTab, setTripsTab] = useState<"trips" | "stays" | "alerts">("trips");
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [lastSearch, setLastSearch] = useState<LastSearch | null>(null);
  const [shareNote, setShareNote] = useState("");
  const sharedRan = useRef(false);
  const [aiUsed, setAiUsed] = useState(false);
  const [listState, setListState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [listError, setListError] = useState("");
  const [language, setLanguage] = useState<SiteLanguage>("en");
  const [currency, setCurrency] = useState("USD");
  const t = getTranslations(language);

  const chooseLanguage = (next: SiteLanguage) => {
    setLanguage(next);
    try {
      window.localStorage.setItem("hotel-indice-language", next);
    } catch { /* keep the choice for this session if storage is unavailable */ }
  };
  const formatPrice = useCallback(
    (usd: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(Math.round(usd * (currencyRates[currency] ?? 1))),
    [currency],
  );

  useEffect(() => {
    let next: SiteLanguage = "en";

    try {
      const savedLanguage = window.localStorage.getItem("hotel-indice-language");
      if (savedLanguage === "en" || savedLanguage === "es" || savedLanguage === "fr") {
        next = savedLanguage;
      } else {
        const browserLanguages = window.navigator.languages?.length
          ? window.navigator.languages
          : [window.navigator.language];

        const preferred = browserLanguages
          .map((value) => value.toLowerCase().split("-")[0])
          .find((value) => value === "es" || value === "fr" || value === "en");

        if (preferred === "es" || preferred === "fr" || preferred === "en") {
          next = preferred;
        }
      }
    } catch { /* use English when browser preferences are unavailable */ }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLanguage(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch { /* storage unavailable; keep the default theme */ }
  }, []);

  const switchTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { window.localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
  };
  const listRef = useRef<HTMLDivElement>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TRIPS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<TripStore>;
        setStore({
          trips: Array.isArray(parsed.trips) ? parsed.trips.slice(0, 30) : [],
          stays: Array.isArray(parsed.stays) ? parsed.stays.slice(0, 30) : [],
        });
      }
    } catch { /* storage unavailable or damaged; start empty */ }
    setTripsLoaded(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!tripsLoaded) return;
    try { window.localStorage.setItem(TRIPS_KEY, JSON.stringify(store)); } catch { /* ignore */ }
  }, [store, tripsLoaded]);

  const updateStore = (change: (current: TripStore) => TripStore) => setStore(change);
  const account = useAccount(store, setStore, tripsLoaded);
  const alerts = useAlerts(account);

  async function submitListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (listState === "sending") return;
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    const priceText = text("price");
    setListState("sending");
    setListError("");
    try {
      const response = await fetch("/api/list-hotel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotel_name: text("hotel_name"), city: text("city"), country: text("country"),
          contact_name: text("contact_name"), contact_email: text("contact_email"), role: text("role") || "Owner",
          website: text("website"), price_from_usd: priceText ? Number(priceText) : null,
          amenities: data.getAll("amenities").map(String), description: text("description"), company: text("company"),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || "We couldn't send your hotel. Please try again.");
      setListState("done");
    } catch (error) {
      setListState("error");
      setListError(error instanceof Error ? error.message : "We couldn't send your hotel. Please try again.");
    }
  }
  const openListing = () => { setListState("idle"); setListError(""); setListOpen(true); };

  const recordTrip = (done: TripForm, label: string) => {
    const key = tripKey(done);
    const at = Date.now();
    updateStore((current) => {
      const existing = current.trips.find((item) => item.id === key);
      const entry: SavedTrip = { id: key, trip: done, label, saved: existing?.saved ?? false, at };
      const merged = [entry, ...current.trips.filter((item) => item.id !== key)];
      const trips = [...merged.filter((item) => item.saved).slice(0, 20), ...merged.filter((item) => !item.saved).slice(0, 8)].sort((a, b) => b.at - a.at);
      return { ...current, trips };
    });
    setCurrentTripId(key);
  };
  const toggleSaveTrip = (id: string) => updateStore((current) => ({ ...current, trips: current.trips.map((item) => (item.id === id ? { ...item, saved: !item.saved } : item)) }));
  const removeTrip = (id: string) => updateStore((current) => ({ ...current, trips: current.trips.filter((item) => item.id !== id) }));
  const toggleStay = (match: Match) => updateStore((current) => ({
    ...current,
    stays: current.stays.some((item) => item.hotel.id === match.hotel.id) ? current.stays.filter((item) => item.hotel.id !== match.hotel.id) : [match, ...current.stays].slice(0, 30),
  }));
  const stayIds = new Set(store.stays.map((item) => item.hotel.id));
  const tripCount = store.trips.length + store.stays.length;

  const pool = aiMatches ?? base;

  // Slider limits follow the results on screen, so a search never hides its own hotels.
  const priceLimits = useMemo(() => bounds(pool.map((m) => m.hotel.estimated_price_per_night).filter((p) => p > 0), [0, 500], (v, up) => (up ? Math.ceil(v / 10) * 10 : Math.floor(v / 10) * 10)), [pool]);
  const ratingLimits = useMemo(() => bounds(pool.map((m) => m.hotel.rating), [0, 5], (v, up) => (up ? Math.ceil(v * 10) / 10 : Math.floor(v * 10) / 10)), [pool]);
  const reviewLimits = useMemo(() => bounds(pool.map((m) => m.hotel.review_count), [0, 1000], (v, up) => (up ? Math.ceil(v / 10) * 10 : Math.floor(v / 10) * 10)), [pool]);
  const [priceSel, setPriceSel] = useState<Range | null>(null);
  const [ratingSel, setRatingSel] = useState<Range | null>(null);
  const [reviewSel, setReviewSel] = useState<Range | null>(null);
  const priceRange = priceSel ?? priceLimits;
  const ratingRange = ratingSel ?? ratingLimits;
  const reviewRange = reviewSel ?? reviewLimits;
  const setPriceRange = setPriceSel;
  const setRatingRange = setRatingSel;
  const setReviewRange = setReviewSel;
  const resetRanges = () => { setPriceSel(null); setRatingSel(null); setReviewSel(null); };
  const sameRange = (a: Range, b: Range) => a[0] === b[0] && a[1] === b[1];

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = pool.filter(({ hotel }) => {
      if (q && !isSentence(q) && !`${hotel.name} ${hotel.city} ${hotel.country}`.toLowerCase().includes(q)) return false;
      if (city && hotel.city !== city) return false;
      if (tierSet.length && !tierSet.includes(hotel.price_tier)) return false;
      if (vibe && !hotel.vibe_tags.includes(vibe)) return false;
      if (amenities.length && !amenities.every((a) => hotel.amenities.includes(a))) return false;
      const price = hotel.estimated_price_per_night;
      if (price > 0 && (price < priceRange[0] || price > priceRange[1])) return false;
      if (hotel.rating < ratingRange[0] || hotel.rating > ratingRange[1]) return false;
      if (hotel.review_count < reviewRange[0] || hotel.review_count > reviewRange[1]) return false;
      return true;
    });
    const sorted = [...out];
    if (sort === "price_asc") sorted.sort((a, b) => a.hotel.estimated_price_per_night - b.hotel.estimated_price_per_night);
    if (sort === "price_desc") sorted.sort((a, b) => b.hotel.estimated_price_per_night - a.hotel.estimated_price_per_night);
    if (sort === "rating") sorted.sort((a, b) => b.hotel.rating - a.hotel.rating);
    return sorted;
  }, [pool, query, city, tierSet, vibe, amenities, priceRange, ratingRange, reviewRange, sort]);

  const unverifiedNotes = useMemo(() => {
    const counts = new Map<string, number>();
    shown.forEach((match) => {
      const info = catchInfo(match);
      if (info?.kind === "unverified") counts.set(info.label, (counts.get(info.label) ?? 0) + 1);
    });
    return [...counts.entries()].slice(0, 2);
  }, [shown]);

  const priceValues = useMemo(() => pool.map((m) => m.hotel.estimated_price_per_night).filter((p) => p > 0), [pool]);
  const ratingValues = useMemo(() => pool.map((m) => m.hotel.rating), [pool]);
  const reviewValues = useMemo(() => pool.map((m) => m.hotel.review_count), [pool]);

  const findMatch = useCallback((id: string | null) => (id ? pool.find((m) => m.hotel.id === id) ?? base.find((m) => m.hotel.id === id) ?? store.stays.find((m) => m.hotel.id === id) ?? null : null), [pool, base, store.stays]);
  const detail = useMemo(() => findMatch(detailId), [findMatch, detailId]);
  const bookingHotel = useMemo(() => findMatch(bookingId)?.hotel ?? null, [findMatch, bookingId]);
  const comparing = useMemo(() => compareIds.map((id) => findMatch(id)).filter((m): m is Match => Boolean(m)), [compareIds, findMatch]);

  const filtersActive = Boolean(
    (query && !isSentence(query)) || city || tierSet.length || vibe || amenities.length ||
    !sameRange(priceRange, priceLimits) || !sameRange(ratingRange, ratingLimits) || !sameRange(reviewRange, reviewLimits),
  );

  const resetFilters = () => {
    setQuery(""); setCity(""); setTierSet([]); setVibe(""); setAmenities([]);
    resetRanges(); setSort("match");
  };

  const openHotel = useCallback((id: string) => { setSelectedId(id); setDetailId(id); setPhoto(0); setDetailTab("ratings"); }, []);

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((v) => v !== id);
      if (current.length >= 4) return current;
      return [...current, id];
    });
  }, []);

  const showOnMap = useCallback((id: string) => {
    setDetailId(null);
    setSelectedId(id);
    setView("map");
  }, []);

  const pickOnMap = useCallback((id: string) => {
    setSelectedId(id);
    setView("list");
    window.requestAnimationFrame(() => {
      listRef.current?.querySelector(`[data-hotel="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (bookingId) { setBookingId(null); return; }
      if (listOpen) { setListOpen(false); return; }
      if (tripsOpen) { setTripsOpen(false); return; }
      if (compareOpen) { setCompareOpen(false); return; }
      setDetailId(null);
      setAskOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bookingId, compareOpen, tripsOpen, listOpen]);

  async function runSearch(request: Record<string, unknown>, label: string): Promise<boolean> {
    if (asking) return false;
    setEntered(true);
    setPlannerOpen(false);
    setAsking(true);
    setAskError("");
    try {
      const chosenDates = Boolean(request.checkIn && request.checkOut);
      const sent: Record<string, unknown> = chosenDates ? request : { ...request, checkIn: plusDays(30), checkOut: plusDays(32) };
      const response = await fetch("/api/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sent) });
      const data = (await response.json()) as MatchResponse;
      if (!response.ok) throw new Error(data.error || "We couldn't find stays right now.");
      if (data.notice && data.matches.length === 0) {
        setAskError(data.notice);
        setAskOpen(true);
        return false;
      }
      setAiMatches(data.matches);
      setRateDates({ checkIn: String(sent.checkIn), checkOut: String(sent.checkOut), chosen: chosenDates });
      if (!request.destination && data.matches.length) {
        const found = new Set(data.matches.map((m) => m.hotel.city));
        if (found.size === 1) {
          const only = [...found][0];
          setTrip((current) => ({ ...current, destination: only }));
        }
      }
      setAiQuery(data.understood || label);
      setInterpretedTrip(data.interpreted || interpretTrip({
        destination: String(request.destination ?? ""),
        party: String(request.party ?? ""),
        vibe: String(request.vibe ?? ""),
        budget: (request.budget as PriceTier | "Any") || "Any",
        amenities: Array.isArray(request.amenities) ? request.amenities.map(String) : [],
        query: String(request.query ?? label),
        checkIn: String(sent.checkIn ?? ""),
        checkOut: String(sent.checkOut ?? ""),
      }));
      setAiUsed(Boolean(data.enhanced));
      resetRanges();
      setQuery("");
      setCity("");
      setTierSet([]);
      setVibe("");
      setAmenities([]);
      setSort("match");
      setSelectedId(null);
      setDetailId(null);
      setAskOpen(false);
      track({ kind: "search", query: label.slice(0, 200), destination: String(request.destination ?? "").slice(0, 100), results: data.matches.length });
      return true;
    } catch (error) {
      setAskError(error instanceof Error ? error.message : "We couldn't find stays right now. Try again.");
      setAskOpen(true);
      return false;
    } finally {
      setAsking(false);
    }
  }

  async function searchText(text: string, destination: string) {
    const ok = await runSearch({ query: text, destination, budget: "Any", amenities: [], party: "", vibe: "" }, text);
    if (ok) { setCurrentTripId(null); setLastSearch({ kind: "text", query: text, destination }); }
  }

  async function startVoiceRecording(setTranscript: (text: string) => void = setHeroText) {
  setVoiceError("");

  try {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("Your browser doesn't support audio recording.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]
      .find((type) => MediaRecorder.isTypeSupported(type));

    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    mediaRecorderRef.current = recorder;
    audioChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };

    recorder.onerror = () => {
      stream.getTracks().forEach((track) => track.stop());
      setVoiceState("idle");
      setVoiceError("Recording failed. Please try again.");
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      setVoiceState("transcribing");

      try {
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (!blob.size) throw new Error("No audio was captured. Please try again.");

        const extension = blob.type.includes("mp4") ? "m4a" : "webm";
        const form = new FormData();
        form.append("audio", blob, `hotel-indice-recording.${extension}`);

        const response = await fetch("/api/voice", { method: "POST", body: form });
        const data = await response.json() as { text?: string; error?: string };

        if (!response.ok || !data.text) {
          throw new Error(data.error || "Couldn't transcribe that recording.");
        }

        setTranscript(data.text);
      } catch (error) {
        setVoiceError(error instanceof Error ? error.message : "Voice search failed.");
      } finally {
        setVoiceState("idle");
        mediaRecorderRef.current = null;
      }
    };

    recorder.start();
    setVoiceState("recording");
  } catch (error) {
    setVoiceState("idle");
    setVoiceError(
      error instanceof Error ? error.message : "Couldn't access your microphone.",
    );
  }
}

async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    await searchText(trimmed, trip.destination);
  }

  async function searchTrip(chosen: TripForm = trip) {
    const request: Record<string, unknown> = {
      destination: chosen.destination, party: "", vibe: chosen.vibe, budget: chosen.budget, amenities: chosen.amenities, query: "",
      adults: chosen.adults, children: chosen.children,
    };
    if (chosen.checkIn && chosen.checkOut) { request.checkIn = chosen.checkIn; request.checkOut = chosen.checkOut; }
    const label = [chosen.destination || "Anywhere", chosen.checkIn && chosen.checkOut ? `${chosen.checkIn} to ${chosen.checkOut}` : ""].filter(Boolean).join(", ");
    const ok = await runSearch(request, label);
    if (ok) { recordTrip(chosen, label); setLastSearch({ kind: "trip", trip: chosen }); }
  }

  async function shareSearch() {
    if (!lastSearch) return;
    const url = `${window.location.origin}${window.location.pathname}?${shareParams(lastSearch).toString()}`;
    try {
      if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: "Hotel Indice", text: "Stays I found on Hotel Indice", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNote("Link copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareNote("Couldn't copy the link");
    }
    window.setTimeout(() => setShareNote(""), 2500);
  }

  const openBooking = (id: string) => { setBookingId(id); track({ kind: "rates_open", hotel_id: id.slice(0, 80) }); };

  // A shared link runs its search once when the page opens.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (sharedRan.current) return;
    sharedRan.current = true;
    const shared = parseShared(window.location.search);
    if (!shared) return;
    if (shared.kind === "trip") { setTrip(shared.trip); void searchTrip(shared.trip); }
    else { setTrip((current) => ({ ...current, destination: shared.destination })); void searchText(shared.query, shared.destination); }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  return (
    <div className="cc-root" data-theme={theme} data-view={view} data-strip={stripOpen ? "open" : "closed"} data-entered={entered ? "true" : "false"}>
      <header className="cc-head">
        <div className="cc-brand">
          <a href="/" className="cc-brand-mark cc-home-mark" onClick={(event) => { if (window.location.pathname === "/") { event.preventDefault(); setEntered(false); } }} aria-label={t.homeLabel} title={t.homeTitle}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 11h3v-3h3V5h4v3h3v3h3v9h-6v-6h-4v6H4z" fill="currentColor"/>
              <path d="M10 14h4v6h-4z" fill="var(--cc-signal)"/>
            </svg>
          </a>
          <a href="/" className="cc-brand-name" onClick={(event) => { if (window.location.pathname === "/") { event.preventDefault(); setEntered(false); } }}>Hotel <em>Indice</em></a>
        </div>
        <div className="cc-head-search" data-open={plannerOpen ? "true" : "false"}>
          <button type="button" className="cc-plan-toggle" aria-expanded={plannerOpen} onClick={() => setPlannerOpen((open) => !open)}>
            <Search size={16} aria-hidden /><b>{trip.destination || t.anywhere}</b><span>{trip.adults || 2} {trip.adults === 1 ? t.adult : t.adults}</span><ChevronDown size={16} aria-hidden />
          </button>
          <HeaderSearch trip={trip} setTrip={setTrip} onSubmit={searchTrip} busy={asking} language={language} />
        </div>
        <div className="cc-head-end" aria-live="polite">
          <button type="button" className="cc-theme" onClick={switchTheme} aria-label={theme === "dark" ? t.lightTheme : t.darkTheme}>
            {theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
          </button>
          <label className="cc-language">
            <Languages size={16} aria-hidden />
            <select
              value={language}
              onChange={(event) => chooseLanguage(event.target.value as SiteLanguage)}
              aria-label={t.language}
              title={t.language}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
            </select>
          </label>
          <label className="cc-currency">
            <Globe2 size={16} aria-hidden />
            <select value={currency} onChange={(event) => setCurrency(event.target.value)} aria-label={t.currencyLabel}>
              {Object.keys(currencyRates).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <button type="button" className="cc-fbtn cc-mobile-only" aria-pressed={stripOpen} onClick={() => setStripOpen((v) => !v)}>
            <SlidersHorizontal size={14} aria-hidden /> Ranges
          </button>
          <button type="button" className="cc-listbtn" onClick={openListing}>{t.listYourHotel}</button>
          <button type="button" className="cc-tripsbtn" aria-haspopup="dialog" onClick={() => setTripsOpen(true)}><Bookmark size={16} aria-hidden /> {t.trips}{tripCount > 0 ? <span className="cc-tripcount">{tripCount}</span> : null}</button>
          <button type="button" className="cc-askhead" onClick={() => setAskOpen(true)}><Sparkles size={16} aria-hidden /> {t.askIndice}</button>
        </div>
      </header>

      {!entered && (
        <section className="cc-hero">
          <div className="cc-hero-inner">
            <h1>{t.heroTitle}</h1>
            <p>{t.heroSubtitle}</p>
            <form className="cc-hero-form" onSubmit={(e) => { e.preventDefault(); if (heroText.trim()) void ask(heroText); }}>
              <Search size={18} aria-hidden />
              <input value={heroText} onChange={(e) => setHeroText(e.target.value)} placeholder={t.describeTripPlaceholder} aria-label={t.describeTrip} />
              <button
                type="button"
                className="cc-voice-btn"
                aria-label={voiceState === "recording" ? t.stopRecording : t.recordTrip}
                title={voiceState === "recording" ? t.stopRecording : t.speakTrip}
                disabled={voiceState === "transcribing" || asking}
                onClick={() => {
                  if (voiceState === "recording") mediaRecorderRef.current?.stop();
                  else if (voiceState === "idle") void startVoiceRecording();
                }}
              >
                {voiceState === "recording" ? <Square size={17} aria-hidden /> : <Mic size={18} aria-hidden />}
              </button>
              <button type="submit" disabled={asking || voiceState !== "idle" || !heroText.trim()}>
                {asking ? t.finding : t.findStays}
              </button>
            </form>
            {voiceState !== "idle" && (
              <p className="cc-voice-status" role="status">
                {voiceState === "recording" ? t.recordingStatus : t.translatingRecording}
              </p>
            )}
            {voiceError && <p className="cc-voice-error" role="alert">{voiceError}</p>}
            {heroText.trim() && <p className="cc-voice-hint">{t.reviewDescription}</p>}
            <div className="cc-hero-chips">
              {examples.slice(0, 3).map((ex, index) => <button type="button" key={ex} onClick={() => { setHeroText(ex); void ask(ex); }}>{localizedExamples[language][index]}</button>)}
            </div>
            <div className="cc-hero-links">
              <button type="button" className="cc-hero-browse" onClick={() => setEntered(true)}>{t.browseAllStays} ({base.length})</button>
              <button type="button" className="cc-hero-browse" onClick={() => { setEntered(true); setPlannerOpen(true); }}>{t.pickDatesGuests}</button>
            </div>
          </div>
        </section>
      )}
      {!entered && (
        <div className="cc-landing">
          <section className="cc-sec" aria-labelledby="cc-how">
            <h2 id="cc-how">{t.howItWorks}</h2>
            <ol className="cc-steps">
              <li><b>1</b><h3>{t.stepDescribeTitle}</h3><p>{t.stepDescribeBody}</p></li>
              <li><b>2</b><h3>{t.stepMatchTitle}</h3><p>{t.stepMatchBody}</p></li>
              <li><b>3</b><h3>{t.stepRateTitle}</h3><p>{t.stepRateBody}</p></li>
            </ol>
          </section>

          {(() => {
            const pool = base.filter((m) => m.hotel.review_count >= 100);
            const hasCatch = (m: Match) => /[.!?]\s+\S/.test((m.hotel.editorial_notes ?? "").trim());
            const candidates = (pool.length ? pool : base).filter(hasCatch);
            const example = [...(candidates.length ? candidates : pool.length ? pool : base)].sort((a, b) => b.hotel.rating - a.hotel.rating)[0]?.hotel;
            if (!example) return null;
            const names = example.amenities.slice(0, 2).map((a) => localizedAmenity(a, language).toLowerCase());
            const why = names.length ? `${t.fitsTripThatWants} ${names.join(" and ")}.` : "";
            const notes = (example.editorial_notes ?? "").trim();
            const noteSentences = notes.split(/(?<=[.!?])\s+/).filter(Boolean);
            const catchSentence = noteSentences.length > 1 ? noteSentences[noteSentences.length - 1] : "";
            const watchOutLabel = ({ en: "Watch out", es: "Ten en cuenta", fr: "À surveiller" } as Record<string, string>)[language] ?? "Watch out";
            return (
              <section className="cc-sec" aria-labelledby="cc-ex">
                <h2 id="cc-ex">{t.exampleStayTitle}</h2>
                <p className="cc-sec-sub">{t.exampleStaySubtitle}</p>
                <article className="cc-ex">
                  <div className="cc-ex-photo"><HotelPhoto src={example.image_urls[0]} name={example.name} eager={false} /></div>
                  <div className="cc-ex-body">
                    <small>{[example.city, example.country].filter(Boolean).join(", ")}</small>
                    <h3>{example.name}</h3>
                    <p className="cc-ex-meta">
                      <span>★ {example.rating.toFixed(1)}{example.review_count > 0 ? ` ${t.fromReviews} ${example.review_count} ${t.reviewsLabel}` : ""}</span>
                      <span>{example.estimated_price_per_night > 0 ? `${t.about} ${formatPrice(example.estimated_price_per_night)} ${t.aNight}` : t.rateOnRequest}</span>
                    </p>
                    {why && <><h4>{t.whyItFits}</h4><p>{why}</p></>}
                    {catchSentence && <><h4>{watchOutLabel}</h4><p>{catchSentence}</p></>}
                  </div>
                </article>
              </section>
            );
          })()}

          <section className="cc-sec" aria-labelledby="cc-pop">
            <h2 id="cc-pop">{t.popularTripsTitle}</h2>
            <p className="cc-sec-sub">{t.popularTripsSubtitle}</p>
            <div className="cc-tiles">
              {(() => {
                // A photo is used only once on this row, so a repeated catalog photo never shows twice.
                const used = new Set<string>();
                return POPULAR_TRIPS.map((trip) => {
                  const candidate = TILE_PHOTOS[trip.city];
                  const photo = candidate && !used.has(candidate) ? candidate : undefined;
                  if (photo) used.add(photo);
                  return (
                    <button type="button" key={trip.city} className="cc-tile" disabled={asking} onClick={() => { setHeroText(trip.query); void ask(trip.query); }}>
                      <span className="cc-tile-photo"><HotelPhoto src={photo} name={trip.city} eager={false} /></span>
                      <span className="cc-tile-title">{localizedPopularTripTitles[language][trip.city] ?? trip.title}</span>
                    </button>
                  );
                });
              })()}
            </div>
          </section>

          <section className="cc-sec cc-trust" aria-label={t.trustLabel}>
            <div><h3>{t.noCommissionTitle}</h3><p>{t.noCommissionBody}</p></div>
            <div><h3>{t.liveRatesTitle}</h3><p>{t.liveRatesBody}</p></div>
            <div><h3>{t.honestDownsidesTitle}</h3><p>{t.honestDownsidesBody}</p></div>
            <div><h3>{t.priceAlertsTitle}</h3><p>{t.priceAlertsBody}</p></div>
          </section>

          <section className="cc-sec cc-own">
            <div><h2>{t.ownHotelTitle}</h2><p>{t.ownHotelBody}</p></div>
            <button type="button" onClick={openListing}>{t.listYourHotel}</button>
          </section>

          <footer className="cc-footer">
            <div className="cc-footer-top">
              <div><strong>Hotel Indice</strong><p>{t.footerBrowse}</p></div>
              <nav aria-label="Footer">
                <button type="button" onClick={() => setEntered(true)}>{t.browseAllStays}</button>
                <button type="button" onClick={openListing}>{t.listYourHotel}</button>
                <a href={SITE_LINKS.about}>{t.aboutLink}</a>
                <a href={SITE_LINKS.privacy}>{t.privacyLink}</a>
                <a href={SITE_LINKS.terms}>{t.termsLink}</a>
                {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`}>{t.contactLink}</a>}
              </nav>
            </div>
            <p className="cc-footer-note">{t.footerCommission}</p>
            <p className="cc-footer-note">© {new Date().getFullYear()} Hotel Indice</p>
          </footer>
        </div>
      )}
      {entered && (
        <>
      <div className="cc-strip">
        <div className="cc-filter-tabs" role="group" aria-label="Hotel filters">
          <button type="button" className="cc-filter-tab" aria-expanded={activeFilter === "price"} onClick={() => setActiveFilter(activeFilter === "price" ? null : "price")}>
            <Banknote size={15} aria-hidden />
            <span>{t.pricePerNight}</span>
            <b>{formatPrice(priceRange[0])}–{formatPrice(priceRange[1])}</b>
          </button>
          <button type="button" className="cc-filter-tab" aria-expanded={activeFilter === "rating"} onClick={() => setActiveFilter(activeFilter === "rating" ? null : "rating")}>
            <Star size={15} aria-hidden />
            <span>{t.guestRating}</span>
            <b>{ratingRange[0].toFixed(1)}–{ratingRange[1].toFixed(1)}</b>
          </button>
          <button type="button" className="cc-filter-tab" aria-expanded={activeFilter === "reviews"} onClick={() => setActiveFilter(activeFilter === "reviews" ? null : "reviews")}>
            <MessageSquare size={15} aria-hidden />
            <span>{t.reviews}</span>
            <b>{reviewRange[0].toLocaleString()}–{reviewRange[1].toLocaleString()}</b>
          </button>
        </div>

        {activeFilter === "price" && (
          <div className="cc-filter-panel">
            <RangeStrip icon={<Banknote size={13} aria-hidden />} tone="price" format={(v) => formatPrice(Math.round(v / 5) * 5)} title={t.pricePerNight} label="price" summary={`${formatPrice(priceRange[0])} ${t.to} ${formatPrice(priceRange[1])}`} values={priceValues} limits={priceLimits} range={priceRange} step={5} onChange={setPriceRange} />
          </div>
        )}
        {activeFilter === "rating" && (
          <div className="cc-filter-panel">
            <RangeStrip icon={<Star size={13} aria-hidden />} tone="rating" format={(v) => v.toFixed(1)} title={t.guestRating} label="rating" summary={`${ratingRange[0].toFixed(1)} ${t.to} ${ratingRange[1].toFixed(1)}`} values={ratingValues} limits={ratingLimits} range={ratingRange} step={0.1} onChange={setRatingRange} />
          </div>
        )}
        {activeFilter === "reviews" && (
          <div className="cc-filter-panel">
            <RangeStrip icon={<MessageSquare size={13} aria-hidden />} tone="reviews" format={(v) => Math.round(v).toLocaleString("en-US")} title={t.reviews} label="review count" summary={`${reviewRange[0].toLocaleString(language === "es" ? "es-ES" : language === "fr" ? "fr-FR" : "en-US")} ${t.to} ${reviewRange[1].toLocaleString(language === "es" ? "es-ES" : language === "fr" ? "fr-FR" : "en-US")}`} values={reviewValues} limits={reviewLimits} range={reviewRange} step={10} onChange={setReviewRange} />
          </div>
        )}
      </div>

      <div className="cc-views" role="group" aria-label={t.switchView}>
        <button
          type="button"
          onClick={() => setView(view === "map" ? "list" : "map")}
          aria-label={view === "map" ? t.showHotelList : t.showMap}
        >
          {view === "map" ? "List" : "Map"}
        </button>
      </div>

      <div className="cc-body">
        <section className="cc-list-col" aria-label={t.hotelsLabel}>
          <label className="cc-search">
            <Search size={16} aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && isSentence(query)) { e.preventDefault(); void ask(query); } }}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchHotelsLabel}
            />
            <button
              type="button"
              className="cc-voice-btn cc-results-voice-btn"
              aria-label={voiceState === "recording" ? t.stopRecording : t.speakSearch}
              title={voiceState === "recording" ? t.stopRecording : t.speakSearch}
              disabled={voiceState === "transcribing" || asking}
              onClick={() => {
                if (voiceState === "recording") mediaRecorderRef.current?.stop();
                else if (voiceState === "idle") void startVoiceRecording(setQuery);
              }}
            >
              {voiceState === "recording" ? <Square size={16} aria-hidden /> : <Mic size={17} aria-hidden />}
            </button>
          </label>
          {voiceState !== "idle" && (
            <p className="cc-voice-status" role="status" style={{ paddingLeft: 12 }}>
              {voiceState === "recording" ? t.recordingStatus : t.translatingRecording}
            </p>
          )}
          {voiceError && <p className="cc-voice-error" role="alert" style={{ paddingLeft: 12 }}>{voiceError}</p>}
          {isSentence(query) && <p className="cc-count" style={{ paddingLeft: 12 }}>{asking ? "Finding stays that fit..." : "Press Enter to find stays that fit this"}</p>}
          {!aiMatches && store.trips.length > 0 && (
            <div className="cc-resume">
              <span>{t.pickUpWhereLeftOff}</span>
              <div>
                {store.trips.slice(0, 3).map((item) => (
                  <button key={item.id} type="button" onClick={() => { setTrip(item.trip); void searchTrip(item.trip); }}>
                    <strong>{tripTitle(item.trip)}</strong><small>{tripSummary(item.trip, language)}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
          {aiMatches && (
            <section className="cc-understanding" aria-label={t.tripIntelligence}>
              <div className="cc-understanding-head">
                <span className="cc-understanding-eyebrow">
                  <Sparkles size={12} aria-hidden /> {t.indiceUnderstands}
                </span>

                <div className="cc-understanding-actions">
                  {currentTripId && (() => {
                    const isSaved = store.trips.find((item) => item.id === currentTripId)?.saved ?? false;
                    return (
                      <button
                        type="button"
                        className="cc-savetrip"
                        aria-pressed={isSaved}
                        onClick={() => toggleSaveTrip(currentTripId)}
                      >
                        <Bookmark size={12} fill={isSaved ? "currentColor" : "none"} aria-hidden />
                        {isSaved ? t.saved : t.saveTrip}
                      </button>
                    );
                  })()}

                  {lastSearch && (
                    <button type="button" className="cc-savetrip" onClick={shareSearch}>
                      {shareNote || t.share}
                    </button>
                  )}

                  <button
                    type="button"
                    className="cc-understanding-close"
                    onClick={() => {
                      setAiMatches(null);
                      setAiQuery("");
                      setInterpretedTrip(null);
                      resetRanges();
                      setCurrentTripId(null);
                      setLastSearch(null);
                    }}
                    aria-label={t.clearTripIntelligence}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {interpretedTrip && (
                <div className="cc-understanding-main">
                  <div className="cc-understanding-trip">
                    <div className="cc-understanding-title">
                      {interpretedTrip && [
                        tripPurposeLabel(interpretedTrip),
                        interpretedTrip.destination,
                        interpretedTrip.party ? partyLabels[interpretedTrip.party] || interpretedTrip.party : "",
                      ].filter(Boolean).join(" · ")}
                    </div>

                    <div className="cc-understanding-tags">
                      {(interpretedTrip.maxPrice !== null || interpretedTrip.budget !== "Any") && (
                        <span className="cc-understanding-tag strong">
                          {interpretedTrip.maxPrice !== null
                            ? `Under $${interpretedTrip.maxPrice}/night`
                            : interpretedTrip.budget}
                        </span>
                      )}

                      {interpretedTrip.requiredSignals.map((signal) => (
                        <span className="cc-understanding-tag strong" key={`required-signal-${signal}`}>
                          {intelligenceLabel(signal)}
                        </span>
                      ))}

                      {interpretedTrip.preferredSignals.map((signal) => (
                        <span className="cc-understanding-tag" key={`preferred-signal-${signal}`}>
                          {intelligenceLabel(signal)}
                        </span>
                      ))}

                      {interpretedTrip.requiredAmenities.map((amenity) => (
                        <span className="cc-understanding-tag strong" key={`required-amenity-${amenity}`}>
                          {localizedAmenity(amenity, language)}
                        </span>
                      ))}

                      {interpretedTrip.preferredAmenities.map((amenity) => (
                        <span className="cc-understanding-tag" key={`preferred-amenity-${amenity}`}>
                          {localizedAmenity(amenity, language)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {compareIds.length >= 2 && (
                    <div className="cc-understanding-compare">
                      <div className="cc-understanding-compare-copy">
                        <strong>{compareIds.length} stays selected</strong>
                        <span>
                          {comparing.length > 2
                            ? `${comparing[0].hotel.name} and ${comparing.length - 1} more`
                            : comparing.map((m) => m.hotel.name).join(" and ")}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="cc-tray-go"
                        onClick={() => setCompareOpen(true)}
                      >
                        {t.compareStays} <ArrowRight size={14} aria-hidden />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {!catalogError && (
            <p className="cc-count" aria-live="polite" style={{ paddingLeft: 12 }}>
              {filtersActive ? `${shown.length} ${t.to} ${pool.length} ${t.staysPlural}` : `${shown.length} ${shown.length === 1 ? t.staySingular : t.staysPlural}`}
            </p>
          )}
          <div className="cc-list" ref={listRef}>
            {catalogError && <div className="cc-empty" role="alert">{catalogError}</div>}
            {!catalogError && shown.length === 0 && (
              <div className="cc-empty">
                {aiMatches && aiMatches.length === 0 ? t.noMatches : t.noFilteredHotels}
                {(filtersActive || aiMatches) && <div><button type="button" onClick={() => { resetFilters(); setAiMatches(null); setAiQuery(""); }}>{aiMatches ? t.showAllStays : t.clearFilters}</button></div>}
              </div>
            )}
            {shown.map((match, index) => {
              const { hotel, fit_percent } = match;
              const fitVaries = new Set(shown.map((m) => m.fit_percent)).size > 1;
              const picked = compareIds.includes(hotel.id);
              const fit = fitLine(match);
              const info = catchInfo(match);
              return (
                <article key={hotel.id} className="cc-card" data-hotel={hotel.id} aria-current={selectedId === hotel.id}>
                  <button type="button" className="cc-card-media" onClick={() => openHotel(hotel.id)} aria-label={`View details of ${hotel.name}`}>
                    <HotelPhoto src={hotel.image_urls[0]} name={hotel.name} eager={index < 18} />
                    {fitVaries && typeof fit_percent === "number" ? <span className="cc-rank"><i>{fit_percent}% {t.matchLabel}</i></span> : null}
                    <span className="cc-score"><Star size={12} fill="currentColor" aria-hidden /> {hotel.rating.toFixed(1)}{hotel.review_count > 0 ? <small>({hotel.review_count.toLocaleString("en-US")})</small> : null}</span>
                  </button>
                  <button type="button" className="cc-heart" aria-pressed={stayIds.has(hotel.id)} aria-label={stayIds.has(hotel.id) ? `Remove ${hotel.name} from saved stays` : `Save ${hotel.name}`} onClick={() => toggleStay(match)}>
                    <Heart size={15} fill={stayIds.has(hotel.id) ? "currentColor" : "none"} aria-hidden />
                  </button>
                  <div className="cc-card-body">
                    <p className="cc-card-city"><MapPin size={12} aria-hidden /> {[hotel.city, hotel.country].filter(Boolean).join(", ")}</p>
                    <button type="button" className="cc-card-name" onClick={() => openHotel(hotel.id)}>{hotel.name}</button>

                  {match.tripadvisor && (
                    <div
                      className="cc-tripadvisor"
                      aria-label={`Tripadvisor Traveler Rating ${match.tripadvisor.rating ?? "not available"} from ${match.tripadvisor.reviewCount.toLocaleString("en-US")} reviews`}
                    >
                      <span className="cc-tripadvisor-brand">Tripadvisor</span>

                      {match.tripadvisor.ratingIconUrl ? (
                        <img
                          className="cc-tripadvisor-bubbles"
                          src={match.tripadvisor.ratingIconUrl}
                          alt={
                            match.tripadvisor.rating !== null
                              ? `Tripadvisor Traveler Rating ${match.tripadvisor.rating.toFixed(1)} out of 5`
                              : "Tripadvisor Traveler Rating"
                          }
                        />
                      ) : (
                        <strong>
                          {match.tripadvisor.rating !== null
                            ? match.tripadvisor.rating.toFixed(1)
                            : "—"}
                        </strong>
                      )}

                      <span>
                        {match.tripadvisor.reviewCount.toLocaleString("en-US")} reviews
                      </span>
                    </div>
                  )}

                    {hasFitEvidence(match) && fit
                      ? <p className="cc-fit"><i aria-hidden>✓</i><span>{fit}</span></p>
                      : defaultHook(hotel) ? <p className="cc-hook">{defaultHook(hotel)}</p> : null}
                    {info?.kind === "caution" && <p className="cc-catch"><i aria-hidden>!</i><span>{info.text}</span></p>}
                    {info?.kind === "unverified" && <p className="cc-unsure">{info.label} not confirmed</p>}
                    {info?.kind === "note" && <p className="cc-note-line">{info.text}</p>}
                    {!info && dataCatch(match, shown) && <p className="cc-catch"><i aria-hidden>!</i><span>{dataCatch(match, shown)}</span></p>}
                    <div className="cc-card-foot">
                      <div className="cc-card-price">
                        {hotel.estimated_price_per_night > 0
                          ? <><b>{formatPrice(hotel.estimated_price_per_night)}</b><small>{match.liveRate ? t.liveRateLabel : t.estimatedNightLabel}</small></>
                          : <><b>{t.rateNotShown}</b><small>{t.checkBookingSite}</small></>}
                      </div>
                      <div className="cc-card-actions">
                        <button type="button" className={`cc-compare${picked ? " on" : ""}`} aria-pressed={picked} disabled={compareIds.length >= 4 && !picked} onClick={() => toggleCompare(hotel.id)}>{picked ? t.comparing : t.compare}</button>
                        <button type="button" className="cc-book-btn" onClick={() => openBooking(hotel.id)} aria-label={`Check rates and book ${hotel.name}`}>{t.checkRates} <ArrowUpRight size={13} aria-hidden /></button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
            {shown.length > 0 && (
              <aside className="cc-listcta">
                <div><strong>{t.ownHotelTitle}</strong><span>{t.ownHotelBody}</span></div>
                <button type="button" onClick={openListing}>{t.listYourHotel}</button>
              </aside>
            )}
          </div>
</section>

        <section className="cc-map-col" aria-label={t.mapLabel}>
          <MapView matches={shown} selectedId={selectedId} onSelect={pickOnMap} formatPrice={formatPrice} />
          <div className="cc-vignette" aria-hidden />
          {(() => {
            const picked = findMatch(selectedId);
            if (!picked) return null;
            const stay = picked.hotel;
            return (
              <div className="cc-map-card">
                <button type="button" className="cc-map-card-main" onClick={() => openHotel(stay.id)}>
                  <span className="cc-map-card-photo" style={stay.image_urls[0] ? { backgroundImage: `url("${stay.image_urls[0]}")` } : undefined} />
                  <span className="cc-map-card-text">
                    <strong>{stay.name}</strong>
                    <small>{stay.city}</small>
                    <small>{stay.estimated_price_per_night > 0 ? `${formatPrice(stay.estimated_price_per_night)} ${t.aNight}` : t.seeRate} · {stay.rating.toFixed(1)} {t.starsLabel}</small>
                  </span>
                </button>
                <button type="button" className="cc-map-card-go" onClick={() => openBooking(stay.id)}>{t.checkRates}</button>
              </div>
            );
          })()}

          {askOpen && (
            <div className="cc-ask" role="dialog" aria-label={t.describeTrip}>
              <div className="cc-ask-head"><span>{t.describeTrip}</span><button type="button" onClick={() => setAskOpen(false)} aria-label={t.close}><X size={16} /></button></div>
              <textarea spellCheck={false} value={askText} maxLength={600} onChange={(e) => setAskText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask(askText); }}
                placeholder={t.describeTripPlaceholder} aria-label={t.describeTrip} autoFocus />
              {!askText && (
                <div className="cc-ask-examples">
                  {examples.map((ex) => <button key={ex} type="button" onClick={() => { setAskText(ex); ask(ex); }}>{ex}</button>)}
                </div>
              )}
              {askError && <div className="cc-ask-msg err" role="alert">{askError}</div>}
              <button type="button" className="cc-ask-go" disabled={asking || !askText.trim()} onClick={() => ask(askText)}>{asking ? t.finding : t.findStays}</button>
            </div>
          )}
        </section>
      </div>
        </>
      )}

      {detail && (() => {
        const { hotel } = detail;
        const hasMatch = Boolean(detail.why_it_matches) || detail.evidence.length > 0;
        const tabs: [DetailTab, string][] = [["ratings", t.ratings], ["info", t.info], ["photos", t.photos], ["pros", t.prosAndCons], ["amenities", t.amenities]];
        if (hasMatch) tabs.push(["match", t.whyItFits]);
        const active: DetailTab = tabs.some(([key]) => key === detailTab) ? detailTab : "ratings";
        const good = detail.evidence.filter((item) => item.type === "match");
        const facts = detail.evidence.filter((item) => item.type === "missing");
        const reality = detail.evidence.filter((item) => item.type === "tradeoff");
        return (
          <div className="cc-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetailId(null); }}>
            <div className="cc-modal cc-detail-modal" role="dialog" aria-modal="true" aria-label={`${hotel.name} details`}>
              <div className="cc-dm-hero" style={{ backgroundImage: `url(${hotel.image_urls[photo] ?? hotel.image_urls[0]})` }}>
                <button type="button" className="cc-dm-close" onClick={() => setDetailId(null)} aria-label={t.close} autoFocus><X size={20} /></button>
                <span className="cc-dm-badge">{hotel.rating.toFixed(1)}</span>
                <h2>{hotel.name}</h2>
                <div className="cc-dm-actions">
                  <button type="button" className="cc-dm-book" onClick={() => openBooking(hotel.id)}>{t.bookThisHotel}</button>
                  <button type="button" className="cc-dm-save" aria-pressed={stayIds.has(hotel.id)} onClick={() => toggleStay(detail)}><Heart size={15} fill={stayIds.has(hotel.id) ? "currentColor" : "none"} aria-hidden /> {stayIds.has(hotel.id) ? t.saved : t.saveStay}</button>
                  <WatchPrice
                    language={language}
                    hotel={hotel}
                    dates={trip.checkIn && trip.checkOut ? { checkIn: trip.checkIn, checkOut: trip.checkOut } : rateDates ? { checkIn: rateDates.checkIn, checkOut: rateDates.checkOut } : null}
                    adults={trip.adults || 2}
                    children={trip.children || 0}
                    signedIn={Boolean(account.session)}
                    alerts={alerts}
                    onNeedSignIn={() => { setDetailId(null); setTripsTab("alerts"); setTripsOpen(true); }}
                  />
                </div>
              </div>
              <div className="cc-tabs" role="tablist">
                {tabs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={active === key} onClick={() => setDetailTab(key)}>{label}</button>)}
              </div>
              <div className="cc-tab-body" role="tabpanel">
                {active === "ratings" && (<>
                  <p className="cc-label">{t.hotelIndiceRating}</p>
                  <div className="cc-ratingbar"><div style={{ width: `${Math.max(0, Math.min(100, (hotel.rating / 5) * 100))}%` }} /><span>{hotel.rating.toFixed(1)}</span></div>
                  <p className="cc-meta">{hotel.review_count.toLocaleString(language === "es" ? "es-ES" : language === "fr" ? "fr-FR" : "en-US")} {t.reviewsLabel} · {hotel.price_tier === "Budget" ? t.budget : hotel.price_tier === "Mid-range" ? t.midRange : hotel.price_tier === "Luxury" ? t.luxury : hotel.price_tier}</p>

                  {detail.tripadvisor && (
                    <div className="cc-ta-panel">
                      <div className="cc-ta-panel-head">
                        <div>
                          <p className="cc-label">{t.tripadvisorTravelerRating}</p>
                          <div className="cc-ta-score">
                  {detail.tripadvisor.ratingIconUrl ? (
                    <img
                      className="cc-ta-bubbles"
                      src={detail.tripadvisor.ratingIconUrl}
                      alt={
                        detail.tripadvisor.rating !== null
                          ? `Tripadvisor Traveler Rating ${detail.tripadvisor.rating.toFixed(1)} out of 5`
                          : "Tripadvisor Traveler Rating"
                      }
                    />
                  ) : (
                    <strong>
                      {detail.tripadvisor.rating !== null
                        ? detail.tripadvisor.rating.toFixed(1)
                        : "—"}
                    </strong>
                  )}

                  <span>
                    {detail.tripadvisor.reviewCount.toLocaleString(language === "es" ? "es-ES" : language === "fr" ? "fr-FR" : "en-US")} {t.reviewsLabel}
                  </span>
                  <small className="cc-ta-updated">
                    {t.updatedLabel} {new Date().toLocaleDateString(language === "es" ? "es-ES" : language === "fr" ? "fr-FR" : "en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </small>
                </div>
                        </div>
                      </div>

                      {detail.tripadvisor.subratings.length > 0 && (
                        <div className="cc-ta-subratings">
                          {detail.tripadvisor.subratings.slice(0, 4).map((item) => (
                            <div key={item.type}>
                              <span>{item.typeName}</span>
                              <strong>{item.rating.toFixed(1)}</strong>
                            </div>
                          ))}
                        </div>
                      )}

                      {detail.tripadvisor.url && (
                        <a
                          className="cc-ta-link"
                          href={detail.tripadvisor.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t.viewOnTripadvisor} ↗
                        </a>
                      )}
                    </div>
                  )}
                </>)}
                {active === "info" && (<>
                  <p className="cc-meta"><MapPin size={13} aria-hidden /> {[hotel.city, hotel.country].filter(Boolean).join(", ")}</p>
                  <p className="cc-priceline"><strong>{hotel.estimated_price_per_night > 0 ? formatPrice(hotel.estimated_price_per_night) : t.rateOnRequest}</strong> {t.aNight}</p>
                  <p className="cc-editorial">{hotel.editorial_notes}</p>
                  <button type="button" className="cc-maplink" onClick={() => showOnMap(hotel.id)}><MapIcon size={16} aria-hidden /> {t.showOnMap}</button>
                </>)}
                {active === "photos" && (
                  <div className="cc-photogrid">
                    {hotel.image_urls.map((url, i) => (
                      <button key={url} type="button" aria-pressed={photo === i} aria-label={`View gallery image ${i + 1}`} onClick={() => setPhoto(i)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`${hotel.name} gallery image ${i + 1}; illustrative`} />
                      </button>
                    ))}
                  </div>
                )}
                {active === "pros" && (detail.why_it_matches || detail.things_to_know ? (<>
                  <p className="cc-label">{t.whyItFits}</p>
                  <p className="cc-pro">{detail.why_it_matches}</p>
                  <p className="cc-label">{t.goodToKnow}</p>
                  <p className="cc-con">{detail.things_to_know}</p>
                </>) : <p className="cc-meta">{t.searchForFitNotes}</p>)}
                {active === "amenities" && <div className="cc-chips">{hotel.amenities.map((a) => <span key={a} className="cc-chip">{localizedAmenity(a, language)}</span>)}</div>}
                {active === "match" && (<>
                  <p className="cc-label">{t.whyItFits}</p>
                  <p className="cc-pro">{detail.why_it_matches || "This stay appeared in your results, but we don't have a specific fit explanation yet."}</p>

                  {good.length > 0 && (<>
                    <p className="cc-label">{t.matchesYourTrip}</p>
                    <div className="cc-evlist">{good.map((item, i) => <div key={`g-${i}`} className="cc-ev good"><i aria-hidden>✓</i><div><strong>{item.label}</strong><p>{item.detail}</p></div></div>)}</div>
                  </>)}

                  {facts.length > 0 && (<>
                    <p className="cc-label">{t.hotelDetails}</p>
                    <div className="cc-evlist">{facts.map((item, i) => <div key={`f-${i}`} className="cc-ev"><i aria-hidden>i</i><div><strong>{item.label}</strong><p>{item.detail}</p></div></div>)}</div>
                  </>)}

                  {reality.length > 0 && (<>
                    <p className="cc-label">Reality Check</p>
                    <div className="cc-evlist">{reality.map((item, i) => <div key={`r-${i}`} className="cc-ev warn"><i aria-hidden>!</i><div><strong>{item.label}</strong><p>{item.detail}</p></div></div>)}</div>
                  </>)}

                  {good.length === 0 && facts.length === 0 && reality.length === 0 && (
                    <p className="cc-meta">We don't have enough detail to verify specific matches or trade-offs for this stay. Check the amenities and hotel information before booking.</p>
                  )}
                </>)}
              </div>
            </div>
          </div>
        );
      })()}

      {compareOpen && (
        <div className="cc-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) setCompareOpen(false); }}>
          <div className="cc-modal cc-compare-modal" data-count={comparing.length} role="dialog" aria-modal="true" aria-label={t.compareStays}>
            <button type="button" className="cc-modal-x" onClick={() => setCompareOpen(false)} aria-label={t.close}><X size={18} /></button>
            <h2>{t.compareStays}</h2>
            <p className="cc-meta">{language === "es" ? "Compara lado a lado los detalles importantes para tu viaje." : language === "fr" ? "Comparez côte à côte les détails qui comptent pour votre voyage." : "Compare the details that matter for your trip side by side."}</p>
            <div className="cc-compare-grid" data-count={comparing.length}>
              {comparing.map((match) => {
                const { hotel } = match;
                const isRoom = (label: string) => label.toLowerCase().startsWith("room ≥");
                const matched = match.evidence?.filter((item) => item.type === "match") ?? [];
                const reality = match.evidence?.filter((item) => item.type === "tradeoff") ?? [];
                const room = matched.find((item) => isRoom(item.label));
                const compact = comparing.length > 2;
                const fits = matched.filter((item) => !isRoom(item.label)).slice(0, compact ? 2 : 3);
                return (
                  <section className="cc-cmp" key={hotel.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={hotel.image_urls[0]} alt={hotel.name} />
                    <div className="cc-cmp-body">
                      <div className="cc-cmp-head">
                        <div><p className="cc-cmp-loc">{[hotel.city, hotel.country].filter(Boolean).join(", ")}</p><h3>{hotel.name}</h3></div>
                        <span className="cc-cmp-rate">{hotel.rating.toFixed(1)}</span>
                      </div>
                      <div className="cc-cmp-stats">
                        <div><span>{t.estimatedPerNight}</span><strong>{hotel.estimated_price_per_night > 0 ? formatPrice(hotel.estimated_price_per_night) : "-"}</strong></div>
                        <div><span>{t.guestRating}</span><strong>{hotel.rating.toFixed(1)} / 5</strong></div>
                        <div><span>{t.stayType}</span><strong>{hotel.price_tier}</strong></div>
                      </div>
                      <div className="cc-cmp-sec">
                        <p className="cc-label">{t.roomSize}</p>
                        {room ? <div className="cc-cmp-item"><strong>{room.label}</strong><span>{room.detail}</span></div> : <p className="cc-meta">{t.noRoomSizeVerified}</p>}
                      </div>
                      <div className="cc-cmp-sec">
                        <p className="cc-label">{t.amenities}</p>
                        <div className="cc-chips">{hotel.amenities.length ? hotel.amenities.slice(0, compact ? 4 : 6).map((a) => <span key={a} className="cc-chip">{localizedAmenity(a, language)}</span>) : <span className="cc-chip">{t.noVerifiedAmenities}</span>}</div>
                      </div>
                      <div className="cc-cmp-sec">
                        <p className="cc-label">{t.whyItFits}</p>
                        <p className="cc-meta">{fits.map((item) => item.label).join(" · ") || t.matchesSeveralParts}</p>
                        {!compact && fits.map((item) => <div className="cc-cmp-item" key={`${item.label}-${item.detail}`}><strong>{item.label}</strong><span>{item.detail}</span></div>)}
                      </div>
                      <div className="cc-cmp-sec">
                        <p className="cc-label">{t.realityCheck}</p>
                        {reality.length > 0
                          ? reality.slice(0, compact ? 2 : 4).map((item) => <div className="cc-cmp-item" key={`${item.type}-${item.label}-${item.detail}`}><strong>{item.label}</strong><span>{item.detail}</span></div>)
                          : <div className="cc-cmp-item"><strong>{t.availableContext}</strong><span>{match.things_to_know}</span></div>}
                      </div>
                      <button type="button" className="cc-book-btn cc-cmp-book" onClick={() => { setCompareOpen(false); openBooking(hotel.id); }}>{t.checkRatesBook} <ArrowUpRight size={15} aria-hidden /></button>
                    </div>
                  </section>
                );
              })}
            </div>
            <div className="cc-cmp-foot"><button type="button" className="cc-compare" onClick={() => setCompareOpen(false)}>{t.backToResults}</button></div>
          </div>
        </div>
      )}

      {bookingHotel && (
        <div className="cc-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) setBookingId(null); }}>
          <div className="cc-modal cc-booking-modal" role="dialog" aria-modal="true" aria-label={t.checkRates}>
            <button type="button" className="cc-modal-x" onClick={() => setBookingId(null)} aria-label={t.close}><X size={18} /></button>
            <h2>{t.readyToCheckRates}</h2>
            <p className="cc-meta">{t.checkCurrentPrices} {bookingHotel.name}.</p>
            <div className="cc-handoff">
              <div>
                <p className="cc-label">{t.yourStay}</p>
                <strong>{bookingHotel.name}</strong>
                <span>{[bookingHotel.city, bookingHotel.country].filter(Boolean).join(", ")}</span>
              </div>
              <div className="cc-handoff-price">
                <span>{t.hotelIndiceEstimate}</span>
                <strong>{bookingHotel.estimated_price_per_night > 0 ? formatPrice(bookingHotel.estimated_price_per_night) : "-"}</strong>
                <small>{t.perNight}</small>
              </div>
            </div>
            <div className="cc-note"><strong>{t.checkLiveRate}</strong><p>{t.liveRateNotice}</p></div>
            <div className="cc-options">
              {partnerLinks(bookingHotel).map((partner) => (
                <a key={partner.label} href={partner.href} target="_blank" rel="sponsored noopener noreferrer" onClick={() => { track({ kind: "partner_click", hotel_id: bookingHotel.id.slice(0, 80), partner: partner.label }); setBookingId(null); }}>
                  <span>Continue with {partner.label}</span><ArrowUpRight size={16} aria-hidden />
                </a>
              ))}
            </div>
            <p className="cc-disclosure">{t.footerCommission}</p>
          </div>
        </div>
      )}

      {tripsOpen && (
        <div className="cc-drawer-back" onMouseDown={(e) => { if (e.target === e.currentTarget) setTripsOpen(false); }}>
          <aside className="cc-drawer" role="dialog" aria-modal="true" aria-label={t.yourTrips}>
            <div className="cc-drawer-head">
              <h2>{t.yourTrips}</h2>
              <button type="button" className="cc-modal-x" onClick={() => setTripsOpen(false)} aria-label={t.close} autoFocus><X size={18} /></button>
            </div>
            <AccountPanel account={account} />
            <div className="cc-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={tripsTab === "trips"} onClick={() => setTripsTab("trips")}>{t.tripsTab} ({store.trips.length})</button>
              <button type="button" role="tab" aria-selected={tripsTab === "stays"} onClick={() => setTripsTab("stays")}>{t.savedStaysTab} ({store.stays.length})</button>
              <button type="button" role="tab" aria-selected={tripsTab === "alerts"} onClick={() => setTripsTab("alerts")}>{t.alertsTab} ({alerts.alerts.length})</button>
            </div>
            <div className="cc-drawer-body">
              {tripsTab === "trips" && (store.trips.length === 0
                ? <p className="cc-drawer-empty">{t.emptyTrips}</p>
                : (["saved", "recent"] as const).map((group) => {
                    const rows = store.trips.filter((item) => (group === "saved" ? item.saved : !item.saved));
                    if (!rows.length) return null;
                    return (
                      <section key={group}>
                        <p className="cc-label">{group === "saved" ? t.savedTrips : t.recentSearches}</p>
                        {rows.map((item) => (
                          <div className="cc-trip" key={item.id}>
                            <button type="button" className="cc-trip-main" onClick={() => { setTripsOpen(false); setTrip(item.trip); void searchTrip(item.trip); }}>
                              <strong>{tripTitle(item.trip)}</strong>
                              <span>{tripSummary(item.trip, language)}</span>
                            </button>
                            <button type="button" className="cc-trip-icon" aria-pressed={item.saved} aria-label={item.saved ? t.unsaveTrip : t.saveTrip} onClick={() => toggleSaveTrip(item.id)}><Bookmark size={16} fill={item.saved ? "currentColor" : "none"} aria-hidden /></button>
                            <button type="button" className="cc-trip-icon" aria-label={t.removeTrip} onClick={() => removeTrip(item.id)}><Trash2 size={16} aria-hidden /></button>
                          </div>
                        ))}
                      </section>
                    );
                  }))}
              {tripsTab === "alerts" && <AlertsTab alerts={alerts} signedIn={Boolean(account.session)} formatPrice={formatPrice} language={language} />}
              {tripsTab === "stays" && (store.stays.length === 0
                ? <p className="cc-drawer-empty">{t.emptySavedStays}</p>
                : store.stays.map((item) => (
                    <div className="cc-trip cc-stay" key={item.hotel.id}>
                      <button type="button" className="cc-trip-main cc-stay-main" onClick={() => { setTripsOpen(false); openHotel(item.hotel.id); }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.hotel.image_urls[0]} alt="" />
                        <span><strong>{item.hotel.name}</strong><span>{[item.hotel.city, item.hotel.country].filter(Boolean).join(", ")}{item.hotel.estimated_price_per_night > 0 ? ` · ${formatPrice(item.hotel.estimated_price_per_night)}` : ""}</span></span>
                      </button>
                      <button type="button" className="cc-trip-icon" aria-label={`Remove ${item.hotel.name}`} onClick={() => toggleStay(item)}><Trash2 size={16} aria-hidden /></button>
                    </div>
                  )))}
            </div>
            <p className="cc-drawer-note">{account.session ? t.syncedToAccount : t.savedOnDevice} <button type="button" className="cc-linkbtn" onClick={() => { setTripsOpen(false); openListing(); }}>{t.listYourHotelPrompt}</button></p>
          </aside>
        </div>
      )}

      {listOpen && (
        <div className="cc-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) setListOpen(false); }}>
          <div className="cc-modal cc-listing" role="dialog" aria-modal="true" aria-label={t.listYourHotel}>
            <button type="button" className="cc-modal-x" onClick={() => setListOpen(false)} aria-label={t.close}><X size={18} /></button>
            {listState === "done" ? (
              <div className="cc-listing-done">
                <h2>{t.listingThanks}</h2>
                <p className="cc-meta">{t.listingReviewNotice}</p>
                <button type="button" className="ccb-done" onClick={() => setListOpen(false)}>{t.close}</button>
              </div>
            ) : (
              <form onSubmit={submitListing} noValidate={false}>
                <h2>{t.listYourHotel}</h2>
                <p className="cc-meta">{t.listingIntro}</p>
                <div className="cc-form">
                  <label className="cc-field cc-span2"><span>{t.hotelName}</span><input name="hotel_name" required minLength={2} maxLength={120} autoComplete="organization" /></label>
                  <label className="cc-field"><span>{t.cityLabel}</span><input name="city" required minLength={2} maxLength={80} /></label>
                  <label className="cc-field"><span>{t.countryLabel}</span><input name="country" required minLength={2} maxLength={80} /></label>
                  <label className="cc-field"><span>{t.yourName}</span><input name="contact_name" required minLength={2} maxLength={80} autoComplete="name" /></label>
                  <label className="cc-field"><span>{t.yourRole}</span>
                    <select name="role" defaultValue="Owner"><option value="Owner">{t.ownerRole}</option><option value="Manager">{t.managerRole}</option><option value="Agent">{t.agentRole}</option><option value="Other">{t.otherRole}</option></select>
                  </label>
                  <label className="cc-field cc-span2"><span>{t.emailLabel}</span><input name="contact_email" type="email" required maxLength={120} autoComplete="email" /></label>
                  <label className="cc-field"><span>{t.websiteBookingOptional}</span><input name="website" inputMode="url" maxLength={300} placeholder="https://" /></label>
                  <label className="cc-field"><span>{t.priceFromOptional}</span><input name="price" type="number" min="1" max="100000" step="1" inputMode="numeric" /></label>
                  <div className="cc-field cc-span2">
                    <span>{t.whatDoesItOffer}</span>
                    <div className="ccb-checks">
                      {amenityChoices.map((amenity) => (
                        <label className="ccb-check" key={amenity}><input type="checkbox" name="amenities" value={amenity} /><span>{localizedAmenity(amenity, language)}</span></label>
                      ))}
                    </div>
                  </div>
                  <label className="cc-field cc-span2"><span>{t.descriptionOptional}</span><textarea spellCheck={false} name="description" rows={3} maxLength={600} /></label>
                  <label className="cc-hp" aria-hidden="true">Company<input name="company" tabIndex={-1} autoComplete="off" /></label>
                </div>
                {listState === "error" && <p className="cc-form-error" role="alert">{listError}</p>}
                <div className="cc-form-foot">
                  <button type="button" className="cc-compare" onClick={() => setListOpen(false)}>{t.cancel}</button>
                  <button type="submit" className="ccb-done" disabled={listState === "sending"}>{listState === "sending" ? t.sending : t.sendForReview}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
