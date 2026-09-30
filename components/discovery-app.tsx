"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { z } from "zod";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Compass,
  Globe2,
  LayoutGrid,
  Map as MapIcon,
  MapPin,
  Moon,
  Search,
  SlidersHorizontal,
  Check,
  Sparkles,
  Star,
  Sun,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapView } from "@/components/map-view";
import { amenityLabels, cities, vibeLabels, type Hotel } from "@/lib/hotels";
import { interpretTrip, type Match, type TripRequest } from "@/lib/matching";

const blankTrip: TripRequest = {
  destination: "",
  party: "",
  vibe: "",
  budget: "Any",
  amenities: [],
  query: "",
};
const amenityChoices = [
  "fast_wifi",
  "pool",
  "breakfast",
  "spa",
  "gym",
  "workspace",
  "family_rooms",
  "parking",
];
const currencyRates: Record<string, number> = {
  USD: 1,
  EUR: 0.91,
  GBP: 0.78,
  NGN: 1475,
  JPY: 147,
};
const examples = [
  "A romantic weekend in Paris with a spa",
  "A work-friendly stay in Lagos with fast Wi-Fi",
  "A quiet Bali escape with a pool under $180",
];
const RECENT_TRIPS_KEY = "hotel-indice:recent-trips:v1";
const MAX_RECENT_TRIPS = 6;

type SavedTrip = {
  id: string;
  trip: TripRequest;
  createdAt: number;
};

type InterpretedTrip = ReturnType<typeof interpretTrip>;

type MatchResponse = {
  matches: Match[];
  total: number;
  source: "supabase" | "demo";
  enhanced: boolean;
  interpreted?: InterpretedTrip;
  error?: string;
};
const toolInput = z
  .object({
    destination: z.string().max(100).optional(),
    party: z.string().max(40).optional(),
    vibe: z.string().max(40).optional(),
    budget: z.enum(["Any", "Budget", "Mid-range", "Luxury"]).optional(),
    amenities: z.array(z.string().max(40)).max(12).optional(),
    query: z.string().max(600).optional(),
  })
  .strict();

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

function tripTitle(trip: TripRequest): string {
  const interpreted = interpretTrip(trip);
  const destination = interpreted.destination || "Your next stay";
  const purpose = interpreted.party === "couple"
    ? "Couple's trip"
    : interpreted.party === "family"
      ? "Family trip"
      : interpreted.party === "business"
        ? "Work trip"
        : interpreted.party === "solo"
          ? "Solo trip"
          : interpreted.vibe
            ? vibeLabels[interpreted.vibe] || "Trip"
            : "Hotel search";
  return `${destination} · ${purpose}`;
}

function tripSummary(trip: TripRequest): string {
  const interpreted = interpretTrip(trip);
  const tags: string[] = [];
  if (interpreted.vibe && vibeLabels[interpreted.vibe]) tags.push(vibeLabels[interpreted.vibe]);
  if (interpreted.amenities.length) {
    tags.push(...interpreted.amenities.slice(0, 2).map((amenity) => amenityLabels[amenity] || amenity));
  }
  if (interpreted.budget !== "Any") tags.push(interpreted.budget);
  return tags.slice(0, 3).join(" · ") || trip.query.trim() || "Personalized hotel search";
}

function partnerLinks(hotel: Hotel): { label: string; href: string }[] {
  return [
    { label: "Booking.com", href: trackedLink(hotel) },
    { label: "Agoda", href: agodaSearchLink(hotel) },
  ];
}

type DetailTab = "ratings" | "info" | "photos" | "pros" | "amenities";

function ratingBar(value: number, max = 5) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="rating-bar">
      <div className="rating-bar-fill" style={{ width: `${pct}%` }} />
      <span>{value.toFixed(1)}</span>
    </div>
  );
}

function HotelDetailDialog({
  detail,
  photoIndex,
  setPhotoIndex,
  detailTab,
  setDetailTab,
  price,
  onClose,
  onBook,
  onMap,
}: {
  detail: { hotel: Hotel; match?: Match } | null;
  photoIndex: number;
  setPhotoIndex: (index: number) => void;
  detailTab: DetailTab;
  setDetailTab: (tab: DetailTab) => void;
  price: (usd: number) => string;
  onClose: () => void;
  onBook: (hotel: Hotel) => void;
  onMap: (id: string) => void;
}) {
  if (!detail) return null;
  const { hotel, match } = detail;
  return (
    <Dialog
      open={!!detail}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="detail-dialog" showCloseButton={false}>
        <div
          className="detail-hero"
          style={{ backgroundImage: `url(${hotel.image_urls[0]})` }}
        >
          <button
            type="button"
            className="gallery-close detail-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={21} />
          </button>
          <span className="detail-rating-badge">{hotel.rating.toFixed(1)}</span>
          <DialogHeader className="sr-only">
            <DialogTitle>{hotel.name}</DialogTitle>
            <DialogDescription>
              {hotel.city}, {hotel.country}
            </DialogDescription>
          </DialogHeader>
          <h2 className="detail-hero-title">{hotel.name}</h2>
          <Button className="detail-hero-book" onClick={() => onBook(hotel)}>
            Book this hotel
          </Button>
        </div>
        <Tabs
          value={detailTab}
          onValueChange={(value) => setDetailTab(value as DetailTab)}
          className="detail-tabs"
        >
          <TabsList className="detail-tablist">
            <TabsTrigger value="ratings">Ratings</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="pros">Pros and Cons</TabsTrigger>
            <TabsTrigger value="amenities">Amenities</TabsTrigger>
          </TabsList>
          <div className="detail-tab-body">
            <TabsContent value="ratings">
              <p className="detail-row-label">Guest rating</p>
              {ratingBar(hotel.rating)}
              <p className="detail-meta-line">
                {hotel.review_count.toLocaleString()} reviews ·{" "}
                {hotel.price_tier}
              </p>
            </TabsContent>
            <TabsContent value="info">
              <p className="hotel-location">
                <MapPin size={13} /> {hotel.city}, {hotel.country}
              </p>
              <p className="detail-price-line">
                <strong>{price(hotel.estimated_price_per_night)}</strong>{" "}
                estimated / night
              </p>
              <p className="detail-editorial">{hotel.editorial_notes}</p>
              <button
                type="button"
                className="map-lookup"
                onClick={() => onMap(hotel.id)}
              >
                <MapIcon size={16} /> Show on map
              </button>
            </TabsContent>
            <TabsContent value="photos">
              <div className="gallery-stage">
                <img
                  src={hotel.image_urls[photoIndex]}
                  alt={`${hotel.name} gallery image ${photoIndex + 1} of ${hotel.image_urls.length}; illustrative`}
                />
                <button
                  type="button"
                  className="gallery-arrow gallery-prev"
                  onClick={() =>
                    setPhotoIndex(
                      (photoIndex + hotel.image_urls.length - 1) %
                        hotel.image_urls.length,
                    )
                  }
                  aria-label="Previous image"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  type="button"
                  className="gallery-arrow gallery-next"
                  onClick={() =>
                    setPhotoIndex((photoIndex + 1) % hotel.image_urls.length)
                  }
                  aria-label="Next image"
                >
                  <ChevronRight size={24} />
                </button>
                <span className="gallery-counter">
                  {photoIndex + 1} / {hotel.image_urls.length}
                </span>
              </div>
              <div className="gallery-thumbs">
                {hotel.image_urls.map((url, index) => (
                  <button
                    type="button"
                    key={url}
                    className={index === photoIndex ? "active" : ""}
                    onClick={() => setPhotoIndex(index)}
                    aria-label={`Show gallery image ${index + 1}`}
                  >
                    <img src={url} alt="" />
                  </button>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="pros">
              {match ? (
                <>
                  <p className="detail-row-label">Why it fits</p>
                  <p className="detail-pro">{match.why_it_matches}</p>
                  <p className="detail-row-label">Good to know</p>
                  <p className="detail-con">{match.things_to_know}</p>
                </>
              ) : (
                <p className="detail-meta-line">
                  Run a search to see personalized fit notes for this stay.
                </p>
              )}
            </TabsContent>
            <TabsContent value="amenities">
              <div className="detail-amenity-grid">
                {hotel.amenities.map((amenity) => (
                  <span key={amenity} className="detail-amenity-chip">
                    {amenityLabels[amenity] || amenity}
                  </span>
                ))}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function TripForm({
  trip,
  setTrip,
  onSubmit,
  busy,
}: {
  trip: TripRequest;
  setTrip: (trip: TripRequest) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  const id = useId();
  const update = (changes: Partial<TripRequest>) =>
    setTrip({ ...trip, ...changes });
  const toggleAmenity = (amenity: string) =>
    update({
      amenities: trip.amenities.includes(amenity)
        ? trip.amenities.filter((item) => item !== amenity)
        : [...trip.amenities, amenity],
    });
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    console.log("[HotelIndice] TripForm submitted", trip);
    onSubmit();
  };
  return (
    <form className="trip-form" onSubmit={handleSubmit}>
      <div className="form-intro">
        <span className="eyebrow">
          <Sparkles size={13} /> YOUR TRIP, YOUR WAY
        </span>
        <h2>Tell us what feels right.</h2>
        <p>One detail or the whole plan. We&apos;ll make sense of it.</p>
      </div>
      <label className="field-label" htmlFor={`${id}-prompt`}>
        Describe your stay
      </label>
      <div className="prompt-wrap">
        <textarea
          id={`${id}-prompt`}
          value={trip.query}
          onChange={(event) => update({ query: event.target.value })}
          placeholder="A quiet hotel in Tokyo with great breakfast…"
          rows={3}
          maxLength={600}
        />
      </div>
      <div className="form-divider">
        <span>OR BUILD YOUR TRIP</span>
      </div>
      <div className="form-row">
        <div className="field-block">
          <label className="field-label" htmlFor={`${id}-destination`}>
            Destination
          </label>
          <Select
            value={trip.destination || "any"}
            onValueChange={(value) =>
              update({ destination: value === "any" ? "" : value })
            }
          >
            <SelectTrigger id={`${id}-destination`} className="form-select">
              <SelectValue placeholder="Anywhere" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Anywhere</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="form-row two-cols">
        <div className="field-block">
          <label className="field-label" htmlFor={`${id}-party`}>
            Traveling as
          </label>
          <Select
            value={trip.party || "any"}
            onValueChange={(value) =>
              update({ party: value === "any" ? "" : value })
            }
          >
            <SelectTrigger id={`${id}-party`} className="form-select">
              <SelectValue placeholder="Anyone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Anyone</SelectItem>
              <SelectItem value="solo">Solo</SelectItem>
              <SelectItem value="couple">Couple</SelectItem>
              <SelectItem value="family">Family</SelectItem>
              <SelectItem value="business">Business</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="field-block">
          <label className="field-label" htmlFor={`${id}-budget`}>
            Budget tier
          </label>
          <Select
            value={trip.budget}
            onValueChange={(value) =>
              update({ budget: value as TripRequest["budget"] })
            }
          >
            <SelectTrigger id={`${id}-budget`} className="form-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Any", "Budget", "Mid-range", "Luxury"].map((tier) => (
                <SelectItem key={tier} value={tier}>
                  {tier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="field-block">
        <label className="field-label" htmlFor={`${id}-vibe`}>
          Your kind of place
        </label>
        <Select
          value={trip.vibe || "any"}
          onValueChange={(value) =>
            update({ vibe: value === "any" ? "" : value })
          }
        >
          <SelectTrigger id={`${id}-vibe`} className="form-select">
            <SelectValue placeholder="Any vibe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any vibe</SelectItem>
            {[
              "romantic",
              "boutique",
              "design_led",
              "remote_work",
              "family_friendly",
              "quiet",
              "wellness",
              "beach",
              "nightlife",
              "cultural",
            ].map((vibe) => (
              <SelectItem key={vibe} value={vibe}>
                {vibeLabels[vibe]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <fieldset className="amenity-fieldset">
        <legend className="field-label">Must-haves</legend>
        <div className="amenity-grid">
          {amenityChoices.map((amenity) => (
            <label className="amenity-choice" key={amenity}>
              <Checkbox
                checked={trip.amenities.includes(amenity)}
                onCheckedChange={() => toggleAmenity(amenity)}
              />
              <span>{amenityLabels[amenity]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" disabled={busy} className="find-button">
        {busy ? "Finding your stays…" : "Find my stays"}
        <ArrowRight size={17} />
      </Button>
      <p className="form-note">Thoughtful matches, with the trade-offs too.</p>
    </form>
  );
}

function BookingButton({
  hotel,
  compact = false,
  onOpen,
}: {
  hotel: Hotel;
  compact?: boolean;
  onOpen: (hotel: Hotel) => void;
}) {
  return (
    <button
      type="button"
      className={
        compact ? "booking-button booking-button-compact" : "booking-button"
      }
      onClick={() => onOpen(hotel)}
      aria-label={`Check rates and book in ${hotel.city}`}
    >
      Check rates &amp; book <ArrowUpRight size={17} />
    </button>
  );
}

function TripUnderstanding({
  trip,
  interpreted,
  onRemove,
  onApply,
  busy,
}: {
  trip: TripRequest;
  interpreted: InterpretedTrip;
  onRemove: (kind: "destination" | "party" | "vibe" | "budget" | "amenity", value?: string) => void;
  onApply: () => void;
  busy: boolean;
}) {
  const requirementTags: { label: string; kind: "destination" | "budget" | "amenity"; value?: string }[] = [];
  const preferenceTags: { label: string; kind: "party" | "vibe" | "amenity"; value?: string }[] = [];

  if (interpreted.destination) requirementTags.push({ label: interpreted.destination, kind: "destination" });
  if (interpreted.maxPrice !== null) {
    requirementTags.push({
      label: `Up to $${interpreted.maxPrice}/night`,
      kind: "budget",
    });
  } else if (interpreted.budget !== "Any") {
    requirementTags.push({
      label: interpreted.budget,
      kind: "budget",
    });
  }
  for (const amenity of interpreted.requiredAmenities) {
    requirementTags.push({ label: amenityLabels[amenity] || amenity, kind: "amenity", value: amenity });
  }
  for (const amenity of interpreted.preferredAmenities) {
    preferenceTags.push({ label: amenityLabels[amenity] || amenity, kind: "amenity", value: amenity });
  }

  const signalLabels: Record<string, string> = {
    near_restaurants: "Near restaurants",
    central: "Central",
    near_beach: "Near the beach",
    quiet: "Quiet",
    good_room: "Good rooms",
    romantic: "Romantic",
    family_suitable: "Family-friendly",
    work_friendly: "Work-friendly",
    walkable: "Walkable",
  };

  for (const signal of interpreted.preferredSignals) {
    if (signal === interpreted.vibe) continue;

    preferenceTags.push({
      label: signalLabels[signal] || signal.replace(/_/g, " "),
      kind: "vibe",
      value: signal,
    });
  }
  if (interpreted.party) preferenceTags.push({
    label: interpreted.party === "couple" ? "Couple's trip" : interpreted.party === "family" ? "Family trip" : interpreted.party === "business" ? "Work trip" : interpreted.party === "solo" ? "Solo trip" : interpreted.party,
    kind: "party",
  });
  if (interpreted.vibe) preferenceTags.push({ label: vibeLabels[interpreted.vibe] || interpreted.vibe, kind: "vibe" });

  const avoidLabels: Record<string, string> = {
    quiet: "Noisy areas",
    romantic: "Unromantic stays",
    work_friendly: "Poor work setup",
    family_suitable: "Poor family fit",
    near_restaurants: "Far from restaurants",
    central: "Non-central areas",
    near_beach: "Far from the beach",
    nightlife: "Nightlife",
  };

  const avoidTags = interpreted.avoidSignals.map((signal) => ({
    label: avoidLabels[signal] || signal.replace(/_/g, " "),
    value: signal,
  }));

  const hasTags =
    requirementTags.length > 0 ||
    preferenceTags.length > 0 ||
    avoidTags.length > 0;
  if (!hasTags) return null;

  return (
    <section className="trip-understanding" aria-labelledby="trip-understanding-title">
      <div className="trip-understanding-head">
        <div>
          <span className="eyebrow"><Sparkles size={12} /> INDICE UNDERSTANDS</span>
          <h2 id="trip-understanding-title">Your trip, translated.</h2>
          <p>We turned your description into the details we use to find and rank stays.</p>
        </div>
        <span className="trip-understanding-query">{trip.query.trim() || "Your selected preferences"}</span>
      </div>
      <div className="trip-understanding-groups">
        {requirementTags.length > 0 && (
          <div className="understanding-group">
            <span className="understanding-label">MUST-HAVES</span>
            <div className="understanding-tags">
              {requirementTags.map((tag) => (
                <button
                  key={`${tag.kind}-${tag.value || tag.label}`}
                  type="button"
                  className="understanding-tag"
                  onClick={() => onRemove(tag.kind, tag.value)}
                  title={`Remove ${tag.label}`}
                >
                  <Check size={12} /> {tag.label}<X size={12} />
                </button>
              ))}
            </div>
          </div>
        )}
        {preferenceTags.length > 0 && (
          <div className="understanding-group">
            <span className="understanding-label">PREFERENCES</span>
            <div className="understanding-tags">
              {preferenceTags.map((tag) => (
                <button
                  key={`${tag.kind}-${tag.label}`}
                  type="button"
                  className="understanding-tag preference"
                  onClick={() => onRemove(tag.kind, tag.value)}
                  title={`Remove ${tag.label}`}
                >
                  <Sparkles size={12} /> {tag.label}<X size={12} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="trip-understanding-footer">
        <span>Change a tag if Indice misunderstood something, then update your matches.</span>
        <Button type="button" size="sm" onClick={onApply} disabled={busy}>
          {busy ? "Updating…" : "Update matches"} <ArrowRight size={14} />
        </Button>
      </div>
    
      {avoidTags.length > 0 && (
        <div className="understanding-group">
          <span className="understanding-label">AVOID</span>
          <div className="understanding-tags">
            {avoidTags.map((tag) => (
              <span
                key={`avoid-${tag.value}`}
                className="understanding-tag avoid"
              >
                {tag.label}
              </span>
            ))}
          </div>
        </div>
      )}
</section>
  );
}

function HotelCard({
  match,
  index,
  price,
  onGallery,
  onMap,
  onBook,
}: {
  match: Match;
  index: number;
  price: (usd: number) => string;
  onGallery: (detail: { hotel: Hotel; match?: Match }) => void;
  onMap: (id: string) => void;
  onBook: (hotel: Hotel) => void;
}) {
  const { hotel } = match;
  return (
    <article className="hotel-card">
      <div className="hotel-photo-wrap">
        <button
          className="hotel-photo-button"
          type="button"
          onClick={() => onGallery({ hotel, match })}
          aria-label={`View details of ${hotel.name}`}
        >
          <img
            src={hotel.image_urls[0]}
            alt={`Illustrative view for ${hotel.name}`}
            loading={index > 1 ? "lazy" : "eager"}
          />
        </button>
        <span className="card-rank">
          {String(index + 1).padStart(2, "0")} / YOUR MATCH
        </span>
        <span className="rating-pill">
          <Star size={13} fill="currentColor" /> {hotel.rating.toFixed(1)}
        </span>
      </div>
      <div className="hotel-details">
        <div className="hotel-heading">
          <div>
            <p className="hotel-location">
              <MapPin size={13} /> {hotel.city}, {hotel.country}
            </p>
            <button
              type="button"
              className="hotel-title-button"
              onClick={() => onGallery({ hotel, match })}
            >
              <h3>{hotel.name}</h3>
            </button>
          </div>
          <button
            type="button"
            className="map-lookup"
            onClick={() => onMap(hotel.id)}
            aria-label={`Show ${hotel.name} on map`}
          >
            <MapIcon size={16} /> Map
          </button>
        </div>
        <div className="hotel-tags">
          <span>{hotel.price_tier}</span>
          {hotel.vibe_tags.slice(0, 2).map((tag) => (
            <span key={tag}>{vibeLabels[tag] || tag}</span>
          ))}
        </div>
        <div className="match-copy">
          <p className="match-kicker">
            <Sparkles size={13} /> WHY IT FITS
          </p>
          <p>{match.why_it_matches}</p>

              {match.evidence?.some((item) => item.type === "match") && (
                <div className="match-evidence">
                  {match.evidence
                    .filter((item) => item.type === "match")
                    .map((item, i) => (
                      <span
                        key={`match-${i}`}
                        className="match-evidence-positive"
                        title={item.detail}
                      >
                        <span className="evidence-check">✓</span>
                        {item.label}
                      </span>
                    ))}
                </div>
              )}

              {match.evidence?.some((item) => item.type !== "match") && (
                <>
                  <p className="know-label">REALITY CHECK</p>
                  <div className="match-evidence match-evidence-reality">
                    {match.evidence
                      .filter((item) => item.type !== "match")
                      .map((item, i) => (
                        <span
                          key={`tradeoff-${i}`}
                          className="match-evidence-warning"
                          title={item.detail}
                        >
                          <span className="evidence-warning">!</span>
                          <strong>{item.label}</strong>
                          <span>{item.detail}</span>
                        </span>
                      ))}
                  </div>
                </>
              )}
          <p className="know-label">GOOD TO KNOW</p>
          <p className="know-copy">{match.things_to_know}</p>
        </div>
        <div className="card-bottom">
          <div className="price-block">
            <strong>{price(hotel.estimated_price_per_night)}</strong>
            <span>estimated / night</span>
          </div>
          <BookingButton hotel={hotel} onOpen={onBook} />
        </div>
      </div>
    </article>
  );
}

export function DiscoveryApp({
  initialMatches,
  source,
  catalogError,
}: {
  initialMatches: Match[];
  source: "supabase" | "demo";
  catalogError?: string;
}) {
  const [trip, setTrip] = useState<TripRequest>(blankTrip);
  const [matches, setMatches] = useState(initialMatches);
  const [total, setTotal] = useState(initialMatches.length);
  const [searched, setSearched] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [currentSource, setCurrentSource] = useState(source);
  const [view, setView] = useState<"list" | "map">("list");
  const [currency, setCurrency] = useState("USD");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialMatches[0]?.hotel.id || null,
  );
  const [detail, setDetail] = useState<{ hotel: Hotel; match?: Match } | null>(
    null,
  );
  const [photoIndex, setPhotoIndex] = useState(0);
  const [detailTab, setDetailTab] = useState<DetailTab>("ratings");
  const [bookingHotel, setBookingHotel] = useState<Hotel | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [askText, setAskText] = useState("");
  const [conversation, setConversation] = useState<
    { role: "you" | "indice"; text: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(catalogError || "");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [recentTrips, setRecentTrips] = useState<SavedTrip[]>([]);
  const [savedTripNotice, setSavedTripNotice] = useState(false);
  const [interpretedTrip, setInterpretedTrip] = useState<InterpretedTrip | null>(null);

  // Keep the page locked to the viewport while any overlay is open. This
  // prevents touch/page scrolling from making dialogs and sheets appear to
  // move with the underlying document, especially on iOS Safari.
  useEffect(() => {
    const overlayOpen = Boolean(detail || bookingHotel || filtersOpen || askOpen);
    if (!overlayOpen) return;

    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyPaddingRight: body.style.paddingRight,
      bodyTouchAction: body.style.touchAction,
    };
    const scrollbarWidth = window.innerWidth - html.clientWidth;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.touchAction = "none";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.width = previous.bodyWidth;
      body.style.paddingRight = previous.bodyPaddingRight;
      body.style.touchAction = previous.bodyTouchAction;
      window.scrollTo(0, scrollY);
    };
  }, [detail, bookingHotel, filtersOpen, askOpen]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_TRIPS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedTrip[];
      if (Array.isArray(parsed)) setRecentTrips(parsed.slice(0, MAX_RECENT_TRIPS));
    } catch {
      window.localStorage.removeItem(RECENT_TRIPS_KEY);
    }
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("theme");
    const initial =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(initial);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  const formatPrice = useCallback(
    (usd: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(Math.round(usd * currencyRates[currency])),
    [currency],
  );
  const selectedMatch =
    matches.find((match) => match.hotel.id === selectedId) || matches[0];

  const saveRecentTrip = useCallback((nextTrip: TripRequest) => {
    if (!nextTrip.query.trim() && !nextTrip.destination && !nextTrip.party && !nextTrip.vibe && nextTrip.amenities.length === 0) return;
    const id = JSON.stringify(nextTrip);
    setRecentTrips((current) => {
      const next: SavedTrip[] = [
        { id, trip: nextTrip, createdAt: Date.now() },
        ...current.filter((item) => item.id !== id),
      ].slice(0, MAX_RECENT_TRIPS);
      window.localStorage.setItem(RECENT_TRIPS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  async function findStays(
    nextTrip: TripRequest,
    fromAsk = false,
  ): Promise<{ data: MatchResponse } | { error: string }> {
    setBusy(true);
    setError("");
    setTrip(nextTrip);
    if (fromAsk)
      setConversation((items) => [
        ...items,
        { role: "you", text: nextTrip.query },
      ]);
    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextTrip),
      });
      const data = (await response.json()) as MatchResponse;
      if (!response.ok)
        throw new Error(data.error || "We couldn't find stays right now.");
      setMatches(data.matches);
      setTotal(data.total);
      setCurrentSource(data.source);
      setEnhanced(data.enhanced);
      setInterpretedTrip(data.interpreted || interpretTrip(nextTrip));
      setSearched(true);
      setSelectedId(data.matches[0]?.hotel.id || null);
      saveRecentTrip(nextTrip);
      setSavedTripNotice(true);
      window.setTimeout(() => setSavedTripNotice(false), 3200);
      setFiltersOpen(false);
      if (fromAsk)
        setConversation((items) => [
          ...items,
          {
            role: "indice",
            text: data.matches.length
              ? `I found ${data.total} stay${data.total === 1 ? "" : "s"} that fit. My top picks are ${data.matches
                  .slice(0, 3)
                  .map((item: Match) => item.hotel.name)
                  .join(
                    ", ",
                  )}. Explore the cards for the reasons and trade-offs.`
              : "I couldn't find a stay that meets every detail. Try a different destination, budget, or fewer must-haves.",
          },
        ]);
      return { data };
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Something went wrong. Please try again.";
      setError(message);
      if (fromAsk)
        setConversation((items) => [
          ...items,
          { role: "indice", text: message },
        ]);
      return { error: message };
    } finally {
      setBusy(false);
    }
  }

  const searchRef = useRef(findStays);
  useEffect(() => {
    searchRef.current = findStays;
  });
  useEffect(() => {
    type ToolContext = {
      registerTool: (
        tool: {
          name: string;
          title: string;
          description: string;
          inputSchema: object;
          annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
          execute: (input: unknown) => Promise<unknown>;
        },
        options: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: ToolContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const registration = context.registerTool(
      {
        name: "find_hotel_matches",
        title: "Find hotel matches",
        description:
          "Search Hotel Indice by destination, trip description, budget, party, vibe, and must-have amenities. Updates the visible hotel shortlist.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            destination: { type: "string" },
            party: { type: "string" },
            vibe: { type: "string" },
            budget: {
              type: "string",
              enum: ["Any", "Budget", "Mid-range", "Luxury"],
            },
            amenities: { type: "array", items: { type: "string" } },
            query: { type: "string" },
          },
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        async execute(input) {
          const parsed = toolInput.safeParse(input);
          if (!parsed.success) throw new Error("Invalid trip details");
          const result = await searchRef.current({
            ...blankTrip,
            ...parsed.data,
          });
          if ("error" in result) throw new Error(result.error);
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
          return {
            total: result.data.total,
            hotels: result.data.matches.map(
              ({ hotel, why_it_matches, things_to_know }) => ({
                id: hotel.id,
                name: hotel.name,
                city: hotel.city,
                estimated_price_per_night_usd: hotel.estimated_price_per_night,
                why_it_matches,
                things_to_know,
              }),
            ),
            enhanced: result.data.enhanced,
          };
        },
      },
      { signal: lifecycle.signal },
    );
    Promise.resolve(registration).catch((reason) =>
      console.error("Hotel tool registration failed", reason),
    );
    return () => lifecycle.abort();
  }, []);

  const updateInterpretedTrip = useCallback((kind: "destination" | "party" | "vibe" | "budget" | "amenity", value?: string) => {
    setTrip((current) => {
      if (kind === "amenity" && value) return { ...current, amenities: current.amenities.filter((item) => item !== value) };
      if (kind === "destination") return { ...current, destination: "" };
      if (kind === "party") return { ...current, party: "" };
      if (kind === "vibe") return { ...current, vibe: "" };
      if (kind === "budget") return { ...current, budget: "Any" };
      return current;
    });
    setInterpretedTrip((current) => {
      if (!current) return current;
      if (kind === "amenity" && value) return { ...current, amenities: current.amenities.filter((item) => item !== value) };
      if (kind === "destination") return { ...current, destination: "" };
      if (kind === "party") return { ...current, party: "" };
      if (kind === "vibe") return { ...current, vibe: "" };
      if (kind === "budget") return { ...current, budget: "Any", maxPrice: null };
      return current;
    });
  }, []);

  const applyInterpretedTrip = useCallback(() => {
    if (!interpretedTrip) return;
    const hasManualInterpretation =
      interpretedTrip.destination !== interpretTrip(trip).destination ||
      interpretedTrip.party !== interpretTrip(trip).party ||
      interpretedTrip.vibe !== interpretTrip(trip).vibe ||
      interpretedTrip.budget !== interpretTrip(trip).budget ||
      interpretedTrip.amenities.join("|") !== interpretTrip(trip).amenities.join("|");
    const nextTrip = hasManualInterpretation
      ? {
          ...trip,
          destination: interpretedTrip.destination,
          party: interpretedTrip.party,
          vibe: interpretedTrip.vibe,
          budget: interpretedTrip.budget,
          amenities: interpretedTrip.amenities,
          query: "",
        }
      : trip;
    findStays(nextTrip);
  }, [interpretedTrip, trip]);

  const rerunRecentTrip = useCallback((saved: SavedTrip) => {
    setView("list");
    findStays(saved.trip);
  }, []);

  function openDetail(next: { hotel: Hotel; match?: Match }) {
    setDetail(next);
    setPhotoIndex(0);
    setDetailTab("ratings");
  }
  function showOnMap(id: string) {
    setSelectedId(id);
    setView("map");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function askSubmit(event: FormEvent) {
    event.preventDefault();
    const query = askText.trim();
    if (!query || busy) return;
    setAskText("");
    findStays({ ...trip, query }, true);
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/" aria-label="Hotel Indice home">
            <span className="brand-mark">
              H<span className="brand-mark-dot">.</span>
            </span>
            <span>
              Hotel <em>Indice</em>
            </span>
          </Link>
          <div className="header-middle">
            <span className="header-line" /> THE ART OF FINDING YOUR STAY{" "}
            <span className="header-line" />
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="theme-toggle-single"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <div className="currency-wrap">
              <Globe2 size={16} />
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger
                  className="currency-select"
                  aria-label="Currency"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(currencyRates).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              className="mobile-filter-button"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal size={16} /> Filters
            </Button>
            <Button className="ask-button" onClick={() => setAskOpen(true)}>
              <Sparkles size={16} /> Ask Indice
            </Button>
          </div>
        </div>
      </header>

      <div className="workspace">
        <aside className="filters-sidebar">
          <TripForm
            trip={trip}
            setTrip={setTrip}
            onSubmit={() => findStays(trip)}
            busy={busy}
          />
        </aside>
        <main className="results-area">
          <div className="results-intro">
            <div className="intro-copy">
              <div className="intro-eyebrow">
                <span className="intro-dash" /> HOTEL DISCOVERY, REIMAGINED
              </div>
              <h1>
                {searched
                  ? "Your stay, narrowed down."
                  : "Find a stay that fits."}
              </h1>
              <p>
                {searched
                  ? "The places below align with your trip. Here’s what makes each one worth considering."
                  : "Describe what you have in mind, or choose a few details. We’ll handle the shortlist."}
              </p>
            </div>
            <div className="intro-stamp">
              <Compass size={25} strokeWidth={1.4} />
              <span>
                GOOD PLACES.
                <br />
                BETTER MATCHES.
              </span>
            </div>
          </div>
          {searched && interpretedTrip && (
            <TripUnderstanding
              trip={trip}
              interpreted={interpretedTrip}
              onRemove={updateInterpretedTrip}
              onApply={applyInterpretedTrip}
              busy={busy}
            />
          )}
          {!searched && recentTrips.length > 0 && (
            <section className="recent-trips" aria-labelledby="recent-trips-title">
              <div className="recent-trips-heading">
                <div>
                  <span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
                  <h2 id="recent-trips-title">Your recent trips</h2>
                </div>
                <span className="recent-trips-note">Saved on this device</span>
              </div>
              <div className="recent-trips-list">
                {recentTrips.map((saved) => (
                  <button
                    key={saved.id}
                    type="button"
                    className="recent-trip-card"
                    onClick={() => rerunRecentTrip(saved)}
                  >
                    <span className="recent-trip-copy">
                      <strong>{tripTitle(saved.trip)}</strong>
                      <span>{tripSummary(saved.trip)}</span>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
            </section>
          )}
          {searched && savedTripNotice && (
            <div className="saved-trip-notice" role="status" aria-live="polite">
              <span>Trip saved</span>
              <span>Ready for your next visit on this device.</span>
            </div>
          )}
          <div className="results-toolbar">
            <div>
              <span className="eyebrow results-kicker">
                {searched ? "YOUR SHORTLIST" : "THE GLOBAL EDIT"}
              </span>
              <h2>
                {matches.length
                  ? searched
                    ? `${total} matching stay${total === 1 ? "" : "s"}`
                    : "Explore the collection"
                  : "No stays to show"}
              </h2>
              <p className="results-meta">
                {currentSource === "demo"
                  ? "Illustrative properties and nightly estimates"
                  : "Curated hotel catalog and nightly estimates"}
                {enhanced ? " · AI refined" : " · Preference matched"}
              </p>
            </div>
            <button
              type="button"
              className="view-toggle-single"
              onClick={() => setView(view === "list" ? "map" : "list")}
              aria-label={`Switch to ${view === "list" ? "map" : "list"} view`}
            >
              {view === "list" ? (
                <>
                  <MapIcon size={16} /> Map
                </>
              ) : (
                <>
                  <LayoutGrid size={16} /> List
                </>
              )}
            </button>
            <div className="results-count">
              {matches.length
                ? `${matches.length} ${searched ? "top picks" : "stays"}`
                : "0 stays"}
            </div>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button
                type="button"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                <X size={17} />
              </button>
            </div>
          )}
          <Tabs
            value={view}
            onValueChange={(value) => setView(value as "list" | "map")}
            className="view-tabs"
          >
            <TabsContent value="list" className="view-content">
              {matches.length ? (
                <div className="hotel-grid">
                  {matches.map((match, index) => (
                    <HotelCard
                      key={match.hotel.id}
                      match={match}
                      index={index}
                      price={formatPrice}
                      onGallery={openDetail}
                      onMap={showOnMap}
                      onBook={setBookingHotel}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-results">
                  <Search size={32} />
                  <h3>Nothing quite fits yet.</h3>
                  <p>
                    Try a wider budget or remove a must-have. A different
                    destination may open up more options.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTrip(blankTrip);
                      findStays(blankTrip);
                    }}
                  >
                    Clear trip details
                  </Button>
                </div>
              )}
            </TabsContent>
            <TabsContent value="map" className="view-content">
              <div className="map-layout">
                <MapView
                  matches={matches}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  formatPrice={formatPrice}
                />
                {selectedMatch && (
                  <div className="map-detail">
                    <button
                      className="map-detail-image"
                      type="button"
                      onClick={() =>
                        openDetail({
                          hotel: selectedMatch.hotel,
                          match: selectedMatch,
                        })
                      }
                      aria-label={`View photos of ${selectedMatch.hotel.name}`}
                    >
                      <img
                        src={selectedMatch.hotel.image_urls[0]}
                        alt={`Illustrative view for ${selectedMatch.hotel.name}`}
                      />
                    </button>
                    <div className="map-detail-body">
                      <p className="hotel-location">
                        <MapPin size={13} /> {selectedMatch.hotel.city},{" "}
                        {selectedMatch.hotel.country}{" "}
                        <span className="map-rating">
                          <Star size={12} fill="currentColor" />{" "}
                          {selectedMatch.hotel.rating.toFixed(1)}
                        </span>
                      </p>
                      <h3>{selectedMatch.hotel.name}</h3>
                      <p>{selectedMatch.why_it_matches}</p>
                      <div className="map-detail-bottom">
                        <span>
                          <strong>
                            {formatPrice(
                              selectedMatch.hotel.estimated_price_per_night,
                            )}
                          </strong>{" "}
                          / night est.
                        </span>
                        <BookingButton
                          hotel={selectedMatch.hotel}
                          compact
                          onOpen={setBookingHotel}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
          <p className="disclosure">
            Rates are estimates, may differ at checkout, and are shown in
            approximate converted currencies. Photos and hotel profiles in the
            sample catalog are illustrative. Booking opens a partner search;
            availability is confirmed there.
          </p>
        </main>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="filter-sheet">
          <SheetHeader>
            <SheetTitle>Find your stay</SheetTitle>
            <SheetDescription>Tell us what matters to you.</SheetDescription>
          </SheetHeader>
          <div className="sheet-scroll">
            <TripForm
              trip={trip}
              setTrip={setTrip}
              onSubmit={() => findStays(trip)}
              busy={busy}
            />
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={askOpen} onOpenChange={setAskOpen}>
        <SheetContent side="right" className="ask-sheet">
          <SheetHeader className="ask-header">
            <span className="ask-avatar">
              <Sparkles size={20} />
            </span>
            <SheetTitle>Ask Indice</SheetTitle>
            <SheetDescription>
              Your hotel concierge. Tell me the trip, the mood, or what you
              can&apos;t do without.
            </SheetDescription>
          </SheetHeader>
          <div className="ask-messages">
            <div className="concierge-message">
              <span className="mini-avatar">H.</span>
              <p>
                Where are you heading? Describe your ideal stay and I&apos;ll
                pick out a few good fits.
              </p>
            </div>
            {conversation.map((item, index) => (
              <div className={`chat-message ${item.role}`} key={index}>
                <span>{item.role === "you" ? "YOU" : "INDICE"}</span>
                <p>{item.text}</p>
              </div>
            ))}
            {busy && (
              <div className="chat-message indice">
                <span>INDICE</span>
                <p>Looking through the collection…</p>
              </div>
            )}
            {conversation.length > 0 && !busy && matches.length > 0 && (
              <Button
                variant="outline"
                className="see-matches"
                onClick={() => setAskOpen(false)}
              >
                See the matches <ArrowRight size={16} />
              </Button>
            )}
            {conversation.length === 0 && (
              <div className="ask-examples">
                <span>TRY ASKING</span>
                {examples.map((example) => (
                  <button
                    type="button"
                    key={example}
                    onClick={() => setAskText(example)}
                  >
                    {example}
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <form className="ask-compose" onSubmit={askSubmit}>
            <label className="sr-only" htmlFor="ask-input">
              Ask about your trip
            </label>
            <textarea
              id="ask-input"
              value={askText}
              onChange={(event) => setAskText(event.target.value)}
              placeholder="Tell me about your trip…"
              rows={2}
              maxLength={600}
            />
            <Button
              type="submit"
              disabled={!askText.trim() || busy}
              aria-label="Send message"
            >
              <ArrowRight size={18} />
            </Button>
          </form>
        </SheetContent>
      </Sheet>
      <HotelDetailDialog
        detail={detail}
        photoIndex={photoIndex}
        setPhotoIndex={setPhotoIndex}
        detailTab={detailTab}
        setDetailTab={setDetailTab}
        price={formatPrice}
        onClose={() => setDetail(null)}
        onBook={setBookingHotel}
        onMap={showOnMap}
      />
      <Dialog
        open={!!bookingHotel}
        onOpenChange={(open) => {
          if (!open) setBookingHotel(null);
        }}
      >
        <DialogContent className="booking-dialog">
          {bookingHotel && (
            <>
              <DialogHeader>
                <DialogTitle>Check prices for {bookingHotel.name}</DialogTitle>
                <DialogDescription>
                  {bookingHotel.city}, {bookingHotel.country}
                </DialogDescription>
              </DialogHeader>
              <div className="booking-options">
                {partnerLinks(bookingHotel).map((partner) => (
                  <a
                    key={partner.label}
                    className="booking-option"
                    href={partner.href}
                    target="_blank"
                    rel="sponsored noopener noreferrer"
                    onClick={() => setBookingHotel(null)}
                  >
                    {partner.label} <ArrowUpRight size={16} />
                  </a>
                ))}
              </div>
              <p className="booking-disclosure">
                Some links may earn Hotel Indice a commission. This never
                affects ratings or rankings.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
