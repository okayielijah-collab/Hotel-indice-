import type { Hotel, PriceTier } from "@/lib/hotels";
import { amenityLabels, cities, vibeLabels } from "@/lib/hotels";

export type TripRequest = {
  destination: string;
  party: string;
  vibe: string;
  budget: PriceTier | "Any";
  amenities: string[];
  query: string;
};

export type Match = {
  hotel: Hotel;
  why_it_matches: string;
  things_to_know: string;
  score: number;
};

const aliases: Record<string, string[]> = {
  Paris: ["paris"], Tokyo: ["tokyo"], "New York": ["new york", "nyc", "manhattan"],
  Lagos: ["lagos"], Bali: ["bali", "ubud", "canggu", "sanur"], London: ["london"],
};
const amenityWords: Record<string, string[]> = {
  fast_wifi: ["wifi", "wi-fi", "internet"], breakfast: ["breakfast"],
  pool: ["pool", "swimming"], spa: ["spa", "massage"], gym: ["gym", "fitness"],
  workspace: ["workspace", "cowork", "work space"], family_rooms: ["family room"],
  parking: ["parking"], airport_transfer: ["airport transfer", "airport shuttle"],
};
const amenityPhrases: Record<string, string> = {
  fast_wifi: "fast Wi-Fi", breakfast: "breakfast", pool: "a pool", spa: "a spa",
  gym: "a gym", workspace: "a workspace", family_rooms: "family rooms", parking: "parking",
  airport_transfer: "airport transfer", room_service: "room service", laundry: "laundry", yoga: "yoga",
};
const vibeWords: Record<string, string[]> = {
  romantic: ["romantic", "honeymoon", "anniversary"], boutique: ["boutique"],
  design_led: ["design", "stylish"], remote_work: ["remote work", "work from", "digital nomad", "work-friendly", "work friendly"],
  cultural: ["culture", "museum", "sightseeing"], nightlife: ["nightlife", "night out"],
  family_friendly: ["family", "kids", "children"], quiet: ["quiet", "peaceful"],
  wellness: ["wellness", "wellbeing", "retreat"], beach: ["beach", "ocean"],
};

export function interpretTrip(request: TripRequest) {
  const q = request.query.trim().toLowerCase();
  const foundCity = cities.find((city) => aliases[city].some((alias) => q.includes(alias)));
  const destination = request.destination || foundCity || "";
  const mentionedAmenities = Object.entries(amenityWords)
    .filter(([, words]) => words.some((word) => q.includes(word)))
    .map(([key]) => key);
  const amenities = [...new Set([...request.amenities, ...mentionedAmenities])];
  const foundVibe = Object.entries(vibeWords).find(([, words]) => words.some((word) => q.includes(word)))?.[0];
  const vibe = request.vibe || foundVibe || "";
  const party = request.party || (q.match(/family|kids|children/) ? "family" : q.match(/honeymoon|couple|partner/) ? "couple" : q.match(/solo|alone/) ? "solo" : q.match(/business|work trip/) ? "business" : "");
  const foundBudget: PriceTier | "Any" = q.match(/luxury|five.star|5.star/) ? "Luxury" : q.match(/budget|affordable|cheap/) ? "Budget" : q.match(/mid.range|midrange/) ? "Mid-range" : "Any";
  const budget = request.budget !== "Any" ? request.budget : foundBudget;
  const maxPriceMatch = q.match(/(?:under|below|less than|max(?:imum)?|up to)\s*\$?\s*(\d{2,5})/);
  const maxPrice = maxPriceMatch ? Number(maxPriceMatch[1]) : null;
  return { destination, amenities, vibe, party, budget, maxPrice, query: request.query };
}

function normalized(value: string) { return value.toLowerCase().replace(/[^a-z]/g, ""); }

export function rankHotels(catalog: Hotel[], request: TripRequest): Match[] {
  const trip = interpretTrip(request);
  const filtered = catalog.filter((hotel) => {
    const place = normalized(`${hotel.city} ${hotel.country}`);
    return (!trip.destination || place.includes(normalized(trip.destination))) &&
      (trip.budget === "Any" || hotel.price_tier === trip.budget) &&
      (trip.maxPrice === null || hotel.estimated_price_per_night <= trip.maxPrice) &&
      trip.amenities.every((amenity) => hotel.amenities.includes(amenity));
  });
  return filtered.map((hotel) => {
    const vibeFit = trip.vibe && hotel.vibe_tags.includes(trip.vibe);
    const partyFit = trip.party === "family" ? hotel.vibe_tags.includes("family_friendly") :
      trip.party === "couple" ? hotel.vibe_tags.includes("romantic") :
      trip.party === "solo" ? hotel.vibe_tags.includes("solo") :
      trip.party === "business" ? hotel.vibe_tags.includes("business") || hotel.vibe_tags.includes("remote_work") : false;
    const score = Math.round(hotel.rating * 10 + (vibeFit ? 24 : 0) + (partyFit ? 18 : 0) + trip.amenities.length * 9 + (hotel.price_tier === "Budget" ? 2 : 0));
    const opening = vibeFit ? `A ${vibeLabels[trip.vibe].toLowerCase()} stay` : partyFit ? `A good fit for ${trip.party === "family" ? "families" : trip.party === "business" ? "work trips" : `${trip.party} travelers`}` : `A ${vibeLabels[hotel.vibe_tags[0]]?.toLowerCase() || "thoughtful"} stay`;
    const amenityPhrase = trip.amenities.map((a) => amenityPhrases[a] || amenityLabels[a]?.toLowerCase() || a).join(" and ");
    return {
      hotel, score,
      why_it_matches: `${opening}${amenityPhrase ? ` with ${amenityPhrase}` : ` with a ${hotel.rating.toFixed(1)} guest rating`}.`,
      things_to_know: hotel.editorial_notes,
    };
  }).sort((a, b) => b.score - a.score || a.hotel.estimated_price_per_night - b.hotel.estimated_price_per_night);
}

type AIItem = { hotel_id: string; why_it_matches: string; things_to_know: string };

/** AI can refine the shortlist but can only select IDs from the filtered catalog. */
export async function refineWithAI(matches: Match[], request: TripRequest): Promise<{ matches: Match[]; enhanced: boolean }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !matches.length) return { matches: matches.slice(0, 9), enhanced: false };
  const candidates = matches.slice(0, 12).map(({ hotel }) => ({
    id: hotel.id, name: hotel.name, city: hotel.city, country: hotel.country,
    tier: hotel.price_tier, price_usd: hotel.estimated_price_per_night,
    amenities: hotel.amenities, vibe_tags: hotel.vibe_tags, editorial_notes: hotel.editorial_notes,
  }));
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST", signal: controller.signal,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
          instructions: "You are a concise hotel concierge. Rank only candidate hotel IDs, best first. Return up to 9 recommendations, including every candidate when there are 9 or fewer. Use only the provided hotel facts. Explain how each hotel fits the trip in one sentence. Mention a useful, factual trade-off from editorial_notes in things_to_know. Do not invent availability, verified prices, amenities, reviews, or neighborhood facts. Return JSON only.",
          input: JSON.stringify({ trip: interpretTrip(request), candidates }),
          text: { format: { type: "json_schema", name: "hotel_recommendations", strict: true, schema: {
            type: "object", additionalProperties: false, properties: {
              recommendations: { type: "array", items: { type: "object", additionalProperties: false, properties: {
                hotel_id: { type: "string" }, why_it_matches: { type: "string" }, things_to_know: { type: "string" },
              }, required: ["hotel_id", "why_it_matches", "things_to_know"] } },
            }, required: ["recommendations"],
          } } },
        }),
      });
    } finally { clearTimeout(timer); }
    if (!response.ok) throw new Error(`AI response ${response.status}`);
    const result = await response.json() as { output?: { content?: { type: string; text?: string }[] }[] };
    const content = result.output?.flatMap((part) => part.content || []).find((part) => part.type === "output_text")?.text;
    if (!content) throw new Error("Empty AI response");
    const parsed = JSON.parse(content) as { recommendations: AIItem[] };
    const byId = new Map(matches.map((match) => [match.hotel.id, match]));
    const seen = new Set<string>();
    const refined: Match[] = [];
    for (const item of parsed.recommendations) {
      const original = byId.get(item.hotel_id);
      if (!original || seen.has(item.hotel_id)) continue;
      seen.add(item.hotel_id);
      refined.push({ ...original,
        why_it_matches: item.why_it_matches.slice(0, 220),
        things_to_know: item.things_to_know.slice(0, 280),
      });
      if (refined.length === 9) break;
    }
    if (!refined.length) throw new Error("No valid recommendations");
    for (const match of matches) {
      if (refined.length >= 9) break;
      if (!seen.has(match.hotel.id)) refined.push(match);
    }
    return { matches: refined, enhanced: true };
  } catch (error) {
    console.error("AI matching unavailable:", error);
    return { matches: matches.slice(0, 9), enhanced: false };
  }
}
