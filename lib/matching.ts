import { popularDestinations } from "@/lib/destinations";
import type { Hotel, PriceTier } from "@/lib/hotels";
import { HotelInventory, roomMeetsRequirements } from "@/lib/inventory";
import { amenityLabels, cities, vibeLabels } from "@/lib/hotels";

export type TripRequest = {
  destination: string;
  party: string;
  vibe: string;
  budget: PriceTier | "Any";
  amenities: string[];
  query: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  maxPrice?: number | null;
  minRoomSizeSqm?: number | null;
};

export type MatchEvidence = {
  type: "match" | "tradeoff" | "missing";
  label: string;
  detail: string;
};

export type Match = {
  tripadvisor?: {
    id: number;
    name: string;
    rating: number | null;
    reviewCount: number;
    ratingIconUrl: string | null;
    photoCount: number;
    address: string | null;
    url: string | null;
    latitude: number | null;
    longitude: number | null;
    subratings: Array<{
      type: string;
      typeName: string;
      rating: number;
      count: number;
    }>;
  } | null;

  hotel: Hotel;
  why_it_matches: string;
  things_to_know: string;
  score: number;
  /** share of the trip request this hotel covers, 1 to 99. Missing when the search has no filters. */
  fit_percent?: number;
  evidence: MatchEvidence[];
  liveRate?: boolean;
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

export type TripSignal =
  | "near_restaurants"
  | "central"
  | "near_beach"
  | "quiet"
  | "good_room"
  | "romantic"
  | "family_suitable"
  | "work_friendly"
  | "walkable";

const signalWords: Record<TripSignal, string[]> = {
  near_restaurants: ["restaurant", "restaurants", "dining", "food", "foodie", "eatery", "eateries"],
  central: ["central", "city center", "city centre", "downtown", "heart of", "in the center", "in the centre"],
  near_beach: ["near the beach", "close to the beach", "by the beach", "beachfront", "beach front"],
  quiet: ["quiet", "peaceful", "calm", "tranquil", "away from the noise", "not noisy", "noisy", "noise"],
  good_room: ["good room", "nice room", "great room", "comfortable room", "spacious room", "room quality"],
  romantic: ["romantic", "honeymoon", "anniversary", "date night"],
  family_suitable: ["family", "kids", "children", "with my kids"],
  work_friendly: ["remote work", "work from", "digital nomad", "work-friendly", "work friendly", "business trip"],
  walkable: ["walkable", "walk to", "walking distance", "on foot"],
};

const hardAmenityPhrases: Record<string, string[]> = {
  pool: ["with a pool", "with pool", "has a pool", "has pool", "need a pool", "must have a pool", "must have pool"],
  breakfast: ["with breakfast", "breakfast included", "includes breakfast", "need breakfast", "must have breakfast"],
  spa: ["with a spa", "with spa", "has a spa", "has spa", "need a spa", "must have a spa"],
  gym: ["with a gym", "with gym", "has a gym", "has gym", "need a gym", "must have a gym"],
  fast_wifi: ["with wifi", "with wi-fi", "with wi fi", "need wifi", "need wi-fi", "must have wifi"],
  parking: ["with parking", "has parking", "need parking", "must have parking"],
  workspace: ["with a workspace", "with workspace", "has a workspace", "need a workspace", "must have workspace"],
  family_rooms: ["with family rooms", "has family rooms", "need family rooms", "must have family rooms"],
  airport_transfer: ["with airport transfer", "airport shuttle", "need airport transfer", "must have airport transfer"],
};

export type AITripIntent = {
  purpose: string;
  requiredSignals: TripSignal[];
  preferredSignals: TripSignal[];
  avoidSignals: TripSignal[];
  minRoomSizeSqm: number | null;
};

export type TripIntent = {
  destination: string;
  party: string;
  purpose: string;
  budget: PriceTier | "Any";
  maxPrice: number | null;
  minRoomSizeSqm: number | null;

  requirements: {
    amenities: string[];
    signals: TripSignal[];
  };

  preferences: {
    amenities: string[];
    signals: TripSignal[];
  };

  avoid: TripSignal[];

  confidence: {
    destination: number;
    party: number;
    purpose: number;
    budget: number;
  };
};

function containsTerm(text: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`, "i").test(text);
}

function hasCue(text: string, cue: RegExp) {
  return cue.test(text);
}

function isRequiredLanguage(text: string) {
  return hasCue(
    text,
    /\b(?:need|needs|required|require|must|essential|necessary|have to|has to|can't do without|cannot do without)\b/i,
  );
}

function isPreferenceLanguage(text: string) {
  return hasCue(
    text,
    /\b(?:want|wants|would like|i'd like|ideally|prefer|preferably|love|nice to have|would be nice|looking for|somewhere|someplace)\b/i,
  );
}

function isAvoidLanguage(text: string) {
  return hasCue(
    text,
    /\b(?:avoid|avoiding|don't want|do not want|dont want|no |not |without|away from)\b/i,
  );
}

/**
 * Returns the part of the user's sentence immediately surrounding a term.
 * This lets "I need Wi-Fi, a workspace and somewhere quiet" share the
 * same requirement context without requiring "need" before every item.
 */
function contextAround(text: string, term: string) {
  const index = text.indexOf(term);
  if (index < 0) return "";

  // Only inspect the text leading up to the matched term.
  // This prevents a later "don't want..." clause from
  // incorrectly applying to an earlier requirement.
  const start = Math.max(
    text.lastIndexOf(".", index),
    text.lastIndexOf(",", index),
    text.lastIndexOf(";", index),
  );

  return text.slice(
    Math.max(0, start + 1),
    index + term.length,
  );
}

function classifyMention(text: string, term: string): "required" | "preferred" | "avoid" {
  const context = contextAround(text, term);

  if (isAvoidLanguage(context)) return "avoid";
  if (isRequiredLanguage(context)) return "required";

  /*
   * Coordinated language:
   *
   * "I need Wi-Fi, a workspace and somewhere quiet"
   * "must have breakfast and parking"
   * "looking for a quiet hotel with a pool"
   */
  const firstRequirement = text.search(
    /\b(?:need|needs|required|require|must|essential|necessary|have to|has to)\b/i,
  );

  if (firstRequirement >= 0) {
    const afterRequirement = text.slice(firstRequirement);

    const stop = afterRequirement.search(
      /\b(?:but|however|although|except|unless|instead)\b/i,
    );

    const requirementClause =
      stop >= 0 ? afterRequirement.slice(0, stop) : afterRequirement;

    if (requirementClause.includes(term)) return "required";
  }

  return "preferred";
}

function inferPurpose(q: string) {
  if (
    /\b(?:work|working|remote work|work trip|business|business trip|digital nomad|laptop|working remotely)\b/i.test(q)
  ) {
    return "remote_work";
  }

  if (
    /\b(?:honeymoon|anniversary|date night|romantic|girlfriend|boyfriend|partner|couple)\b/i.test(q)
  ) {
    return "romantic";
  }

  if (
    /\b(?:kids|children|family|with my kids|with the children)\b/i.test(q)
  ) {
    return "family";
  }

  if (/\b(?:wellness|wellbeing|retreat|spa retreat)\b/i.test(q)) {
    return "wellness";
  }

  if (/\b(?:museum|museums|culture|cultural|sightseeing|history)\b/i.test(q)) {
    return "culture";
  }

  return "";
}

function inferParty(q: string) {
  const numericParty = q.match(/\b(\d{1,2})\s+(?:people|persons|guests|travelers|travellers)\b/i);
  if (numericParty) {
    return `${Number(numericParty[1])} people`;
  }

  if (/\b(?:me and my kids|my kids|children|family|with the kids)\b/i.test(q)) {
    return "family";
  }

  if (
    /\b(?:me and my girlfriend|me and my boyfriend|my girlfriend|my boyfriend|my partner|couple|honeymoon|anniversary)\b/i.test(q)
  ) {
    return "couple";
  }

  if (/\b(?:alone|solo|just me|by myself)\b/i.test(q)) {
    return "solo";
  }

  if (/\b(?:business trip|work trip|travelling for work|traveling for work)\b/i.test(q)) {
    return "business";
  }

  if (/\b(?:friends|friend group|with friends)\b/i.test(q)) {
    return "friends";
  }

  return "";
}

function inferBudget(q: string): PriceTier | "Any" {
  if (/\b(?:luxury|luxurious|five star|5 star|high end)\b/i.test(q)) {
    return "Luxury";
  }

  if (/\b(?:budget|cheap|cheapest|affordable|low cost|inexpensive)\b/i.test(q)) {
    return "Budget";
  }

  if (/\b(?:mid range|mid-range|midrange)\b/i.test(q)) {
    return "Mid-range";
  }

  return "Any";
}

function inferMaxPrice(q: string) {
  const match = q.match(
    /(?:under|below|less than|max(?:imum)?|up to|no more than|at most|(?:don['’]t|do not|never)\s+(?:want\s+to\s+)?spend\s+more\s+than|spend\s+no\s+more\s+than|spend\s+less\s+than)\s*\$?\s*(\d{2,5})/i,
  );

  return match ? Number(match[1]) : null;
}

function inferSignalStrength(q: string, signal: TripSignal) {
  const words = signalWords[signal] || [];

  for (const word of words) {
    if (!containsTerm(q, word)) continue;

    const kind = classifyMention(q, word);

    if (kind === "avoid") {
      return "avoid" as const;
    }

    return kind;
  }

  return null;
}

function inferAmenityStrength(q: string, amenity: string) {
  const words = amenityWords[amenity] || [];

  for (const word of words) {
    if (!containsTerm(q, word)) continue;

    const escaped = word.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");

    // Treat natural hotel-feature phrasing as a requirement:
    // "with a pool", "with a spa", "with Wi-Fi", etc.
    const withCue = new RegExp(
      `\\bwith\\s+(?:a|an|the)\\s+(?:\\w+\\s+){0,2}${escaped}\\b`,
      "i",
    );

    if (withCue.test(q)) return "required";

    // Direct feature phrasing commonly means the traveler expects the amenity,
    // e.g. "fast Wi-Fi", "breakfast included", "parking", or "a workspace".
    const directRequirement = new RegExp(
      `\\b(?:fast\\s+)?${escaped}\\b(?:\\s+(?:included|available))?`,
      "i",
    );

    if (directRequirement.test(q)) {
      const context = contextAround(q, word);
      if (!isAvoidLanguage(context)) return "required";
    }

    return classifyMention(q, word);
  }

  return null;
}

function inferMinRoomSizeSqm(q: string): number | null {
  const match = q.match(
    /(?:at least|minimum|min\.?|no smaller than|bigger than|larger than|over)\s*(\d+(?:\.\d+)?)\s*(?:sqm|sq\.?\s*m|m²|square\s*meters?|square\s*metres?)/i,
  );

  if (match) {
    return Number(match[1]);
  }

  const reverseMatch = q.match(
    /(\d+(?:\.\d+)?)\s*(?:sqm|sq\.?\s*m|m²|square\s*meters?|square\s*metres?)\s*(?:or\s+more|and\s+up|minimum)?/i,
  );

  if (
    reverseMatch &&
    /\b(?:room|rooms|bedroom|bedrooms|suite|suites)\b/i.test(q)
  ) {
    return Number(reverseMatch[1]);
  }

  return null;
}

export function interpretTrip(
  request: TripRequest,
  aiIntent?: AITripIntent,
) {
  const q = request.query.trim().toLowerCase();

  const foundCity = cities.find((city) =>
    aliases[city]?.some((alias) => containsTerm(q, alias)),
  );

  const foundPopular = popularDestinations.find((place) => containsTerm(q, place.name.toLowerCase()))?.name;
  const destination = request.destination || foundCity || foundPopular || "";

  const mentionedAmenities = Object.entries(amenityWords)
    .filter(([, words]) =>
      words.some((word) => containsTerm(q, word)),
    )
    .map(([key]) => key);

  const amenities = [
    ...new Set([
      ...request.amenities,
      ...mentionedAmenities,
    ]),
  ];

  const requiredAmenities: string[] = [];
  const preferredAmenities: string[] = [];

  for (const amenity of amenities) {
    if (request.amenities.includes(amenity)) {
      requiredAmenities.push(amenity);
      continue;
    }

    const strength = inferAmenityStrength(q, amenity);

    if (strength === "required") requiredAmenities.push(amenity);
    else if (strength === "preferred") preferredAmenities.push(amenity);
  }

  const requiredSignals: TripSignal[] = [];
  const preferredSignals: TripSignal[] = [];
  const avoidSignals: TripSignal[] = [];

  for (const signal of Object.keys(signalWords) as TripSignal[]) {
    const strength = inferSignalStrength(q, signal);

    if (strength === "required") requiredSignals.push(signal);
    else if (strength === "preferred") preferredSignals.push(signal);
    else if (strength === "avoid") avoidSignals.push(signal);
  }

  const foundVibe = Object.entries(vibeWords).find(([, words]) =>
    words.some((word) => containsTerm(q, word)),
  )?.[0] || "";

  const vibe = request.vibe || foundVibe;

  const party = request.party || inferParty(q);

  const deterministicPurpose = inferPurpose(q);
  const purpose = deterministicPurpose || aiIntent?.purpose || "";

  const mergedRequiredSignals = [
    ...requiredSignals,
    ...(aiIntent?.requiredSignals ?? []),
  ];

  const mergedPreferredSignals = [
    ...preferredSignals,
    ...(aiIntent?.preferredSignals ?? []),
  ];

  const mergedAvoidSignals = [
    ...avoidSignals,
    ...(aiIntent?.avoidSignals ?? []),
  ];

  const requiredSignalSet = new Set(mergedRequiredSignals);

  const preferredSignalSet = new Set(
    mergedPreferredSignals.filter(
      (signal) => !requiredSignalSet.has(signal),
    ),
  );

  const finalAvoidSignals = [
    ...new Set(
      mergedAvoidSignals.filter(
        (signal) =>
          !requiredSignalSet.has(signal) &&
          !preferredSignalSet.has(signal),
      ),
    ),
  ];

  const finalRequiredSignals = [...requiredSignalSet];
  const finalPreferredSignals = [...preferredSignalSet];

  const foundBudget = inferBudget(q);
  const budget = request.budget !== "Any" ? request.budget : foundBudget;

  const parsedMaxPrice = inferMaxPrice(q);
  const parsedMinRoomSizeSqm = inferMinRoomSizeSqm(q);

  const maxPrice =
    request.maxPrice !== undefined ? request.maxPrice : parsedMaxPrice;

  const minRoomSizeSqm =
    request.minRoomSizeSqm !== undefined
      ? request.minRoomSizeSqm
      : aiIntent?.minRoomSizeSqm ?? parsedMinRoomSizeSqm;

  const signals = [
    ...new Set([
      ...finalRequiredSignals,
      ...finalPreferredSignals,
    ]),
  ];

  const intent: TripIntent = {
    destination,
    party,
    purpose,
    budget,
    maxPrice,
    minRoomSizeSqm,

    requirements: {
      amenities: requiredAmenities,
      signals: finalRequiredSignals,
    },

    preferences: {
      amenities: preferredAmenities,
      signals: finalPreferredSignals,
    },

    avoid: finalAvoidSignals,

    confidence: {
      destination: destination ? 1 : 0,
      party: party ? 0.95 : 0,
      purpose: purpose ? 0.9 : 0,
      budget: budget !== "Any" || maxPrice !== null ? 0.95 : 0,
    },
  };

  return {
    destination,
    amenities,
    requiredAmenities,
    preferredAmenities,
    vibe,
    party,
    budget,
    maxPrice,
    minRoomSizeSqm,
    signals,
    requiredSignals: finalRequiredSignals,
    preferredSignals: finalPreferredSignals,
    avoidSignals: finalAvoidSignals,
    purpose,
    intent,
    query: request.query,
  };
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function hotelEvidence(hotel: Hotel) {
  return `${hotel.name} ${hotel.city} ${hotel.country} ${hotel.amenities.join(" ")} ${hotel.vibe_tags.join(" ")} ${hotel.editorial_notes}`.toLowerCase();
}

function signalFit(signal: TripSignal, hotel: Hotel, evidence: string) {
  switch (signal) {
    case "quiet":
      return hotel.vibe_tags.includes("quiet") ||
        /\bquiet|peaceful|calm|tranquil|low[- ]key\b/.test(evidence);

    case "romantic":
      return hotel.vibe_tags.includes("romantic");

    case "family_suitable":
      return hotel.vibe_tags.includes("family_friendly") ||
        hotel.amenities.includes("family_rooms");

    case "work_friendly":
      return hotel.vibe_tags.includes("remote_work") ||
        hotel.vibe_tags.includes("business") ||
        hotel.amenities.includes("workspace");

    case "near_restaurants":
      return /\brestaurant|restaurants|dining|food|eatery|eateries\b/.test(evidence);

    case "central":
      return /\bcentral|city center|city centre|downtown|heart of\b/.test(evidence);

    case "near_beach":
      return hotel.vibe_tags.includes("beach") ||
        /beachfront|beach front|near the beach|ocean/.test(evidence);

    case "walkable":
      return /walkable|walking distance|on foot/.test(evidence);

    case "good_room":
      return /spacious room|comfortable room|large room|suite|room quality/.test(evidence);
  }
}

const signalLabels: Record<TripSignal, string> = {
  romantic: "Romantic",
  quiet: "Quiet",
  work_friendly: "Work-friendly",
  family_suitable: "Family-friendly",
  near_restaurants: "Near restaurants",
  central: "Central",
  near_beach: "Near the beach",
  walkable: "Walkable",
  good_room: "Room comfort",
};

function signalDetail(signal: TripSignal) {
  return {
    romantic: "The hotel's romantic positioning supports a couples stay.",
    quiet: "The available hotel data supports a quieter stay.",
    work_friendly: "The available hotel data supports working from the hotel.",
    family_suitable: "The hotel has family-friendly signals in the available data.",
    near_restaurants: "The available hotel data mentions nearby dining or restaurants.",
    central: "The available hotel data supports a central location.",
    near_beach: "The available hotel data supports beach access.",
    walkable: "The available hotel data supports walkability.",
    good_room: "The available hotel data supports room comfort.",
  }[signal];
}

export function rankHotels(
  catalog: Hotel[],
  request: TripRequest,
  inventory: HotelInventory[] = [],
  aiIntent?: AITripIntent,
): Match[] {
  const trip = interpretTrip(request, aiIntent);

  const inventoryByHotel = new Map<string, HotelInventory>(
    inventory.map((item) => [item.hotel_id, item]),
  );

  /*
   * Only genuine requirements filter candidates.
   * Preferences, vibes and contextual signals affect ranking instead.
   */
  const filtered = catalog.filter((hotel) => {
    const place = normalized(`${hotel.city} ${hotel.country}`);

    if (trip.destination && !place.includes(normalized(trip.destination))) {
      return false;
    }

    if (trip.budget !== "Any" && hotel.price_tier !== trip.budget) {
      return false;
    }

    if (
      trip.maxPrice !== null &&
      hotel.estimated_price_per_night > trip.maxPrice
    ) {
      return false;
    }

    if (
      !trip.requiredAmenities.every((amenity) =>
        hotel.amenities.includes(amenity),
      )
    ) {
      return false;
    }

    if (
      !trip.requiredSignals.every((signal) =>
        signalFit(signal, hotel, hotelEvidence(hotel)),
      )
    ) {
      return false;
    }

    if (trip.minRoomSizeSqm !== null) {
      const hotelInventory = inventoryByHotel.get(hotel.id);

      if (!hotelInventory || hotelInventory.rooms.length === 0) {
        return false;
      }

      const hasQualifyingRoom = hotelInventory.rooms.some((room) =>
        roomMeetsRequirements(room, {
          minSizeSqm: trip.minRoomSizeSqm,
          minOccupancy: null,
          minAdults: null,
          minChildren: null,
        }),
      );

      if (!hasQualifyingRoom) {
        return false;
      }
    }

    return true;
  });

  return filtered
    .map((hotel) => {
      const evidence = hotelEvidence(hotel);

      const vibeFit =
        !!trip.vibe && hotel.vibe_tags.includes(trip.vibe);

      const partyFit =
        trip.party === "family"
          ? hotel.vibe_tags.includes("family_friendly") ||
            hotel.amenities.includes("family_rooms")
          : trip.party === "couple"
            ? hotel.vibe_tags.includes("romantic")
            : trip.party === "solo"
              ? hotel.vibe_tags.includes("solo")
              : trip.party === "business"
                ? hotel.vibe_tags.includes("business") ||
                  hotel.vibe_tags.includes("remote_work")
                : false;

      const preferredAmenityFits =
        trip.preferredAmenities.filter((amenity) =>
          hotel.amenities.includes(amenity),
        ).length;

      const preferredSignalFits =
        trip.preferredSignals.filter((signal) =>
          signalFit(signal, hotel, evidence),
        );

      const avoidedConflicts =
        trip.avoidSignals.filter((signal) =>
          signalFit(signal, hotel, evidence),
        );

      /*
       * Hotel Indice weighted decision score.
       *
       * Match percentage and ranking should reflect the traveler's
       * actual intent, not raw points from unrelated signals.
       *
       * Unknown evidence is neutral:
       * if the listing cannot confirm something, we do not treat
       * that as proof that the hotel fails the requirement.
       *
       * Ranking still rewards stronger matches and penalizes
       * explicit conflicts.
       */
      const requiredCriteria =
        trip.requiredAmenities.length +
        trip.requiredSignals.length;

      const preferenceCriteria =
        trip.preferredAmenities.length +
        trip.preferredSignals.length;

      const requiredMatches =
        trip.requiredAmenities.length +
        trip.requiredSignals.length;

      const preferenceMatches =
        preferredAmenityFits +
        preferredSignalFits.length;

      const requiredWeight = requiredCriteria * 30;
      const requiredFitWeight = requiredMatches * 30;

      const preferenceWeight = preferenceCriteria * 20;
      const preferenceFitWeight = preferenceMatches * 20;

      const vibeWeight = trip.vibe ? 15 : 0;
      const vibeFitWeight = vibeFit ? 15 : 0;

      const partyWeight = trip.party ? 10 : 0;
      const partyFitWeight = partyFit ? 10 : 0;

      const budgetRequested = trip.maxPrice !== null;
      const withinBudget =
        budgetRequested &&
        hotel.estimated_price_per_night > 0 &&
        hotel.estimated_price_per_night <= trip.maxPrice!;

      const budgetWeight = budgetRequested ? 10 : 0;
      const budgetFitWeight = withinBudget ? 10 : 0;

      const roomSizeRequested = trip.minRoomSizeSqm !== null;
      const roomSizeWeight = roomSizeRequested ? 15 : 0;

      let roomSizeFitWeight = 0;

      if (roomSizeRequested) {
        const hotelInventory = inventoryByHotel.get(hotel.id);

        const hasQualifyingRoom =
          hotelInventory?.rooms.some((room) =>
            roomMeetsRequirements(room, {
              minSizeSqm: trip.minRoomSizeSqm,
              minOccupancy: null,
              minAdults: null,
              minChildren: null,
            }),
          ) ?? false;

        roomSizeFitWeight = hasQualifyingRoom ? 15 : 0;
      }

      const avoidancePenalty = avoidedConflicts.length * 20;

      /*
       * Rating is deliberately a small ranking signal.
       * It should break ties rather than overpower traveler intent.
       */
      const ratingSignal = Math.min(15, Math.max(0, hotel.rating * 3));

      const score = Math.round(
        requiredFitWeight +
        preferenceFitWeight +
        vibeFitWeight +
        partyFitWeight +
        budgetFitWeight +
        roomSizeFitWeight +
        ratingSignal -
        avoidancePenalty,
      );

      const matchDenominator =
        requiredWeight +
        preferenceWeight +
        vibeWeight +
        partyWeight +
        budgetWeight +
        roomSizeWeight;

      const matchNumerator =
        requiredFitWeight +
        preferenceFitWeight +
        vibeFitWeight +
        partyFitWeight +
        budgetFitWeight +
        roomSizeFitWeight;

      const fit_percent =
        matchDenominator > 0
          ? Math.max(
              1,
              Math.min(
                99,
                Math.round(
                  ((matchNumerator - avoidancePenalty) /
                    matchDenominator) *
                    100,
                ),
              ),
            )
          : undefined;

      const matchEvidence: MatchEvidence[] = [];

      for (const amenity of trip.requiredAmenities) {
        const label = amenityLabels[amenity] || amenity;

        matchEvidence.push({
          type: "match",
          label,
          detail: `${label} is required and available at this hotel.`,
        });
      }

      for (const amenity of trip.preferredAmenities) {
        const label = amenityLabels[amenity] || amenity;

        if (hotel.amenities.includes(amenity)) {
          matchEvidence.push({
            type: "match",
            label,
            detail: `${label} matches your preference.`,
          });
        } else {
          matchEvidence.push({
            type: "tradeoff",
            label,
            detail: `The available hotel data does not show ${label.toLowerCase()}.`,
          });
        }
      }

      for (const signal of trip.requiredSignals) {
        matchEvidence.push({
          type: "match",
          label: signalLabels[signal],
          detail: signalDetail(signal),
        });
      }

      for (const signal of trip.preferredSignals) {
        if (preferredSignalFits.includes(signal)) {
          matchEvidence.push({
            type: "match",
            label: signalLabels[signal],
            detail: signalDetail(signal),
          });
        } else {
          matchEvidence.push({
            type: "tradeoff",
            label: signalLabels[signal],
            detail: "The available hotel data does not provide enough evidence to confirm this.",
          });
        }
      }

      for (const signal of trip.avoidSignals) {
        if (avoidedConflicts.includes(signal)) {
          matchEvidence.push({
            type: "tradeoff",
            label: `Avoid: ${signalLabels[signal]}`,
            detail: `This hotel has signals that may conflict with your preference to avoid ${signalLabels[signal].toLowerCase()}.`,
          });
        }
      }

      if (trip.party && partyFit) {
        matchEvidence.push({
          type: "match",
          label:
            trip.party === "family"
              ? "Family fit"
              : trip.party === "couple"
                ? "Couples"
                : trip.party === "solo"
                  ? "Solo"
                  : trip.party === "business"
                    ? "Work trip"
                    : trip.party,
          detail: "The hotel's available data supports this type of stay.",
        });
      }

      if (trip.maxPrice !== null && hotel.estimated_price_per_night > 0) {
        matchEvidence.push({
          type: "match",
          label: "Within budget",
          detail: `Estimated at $${hotel.estimated_price_per_night}/night.`,
        });
      }

      if (trip.minRoomSizeSqm !== null) {
        const hotelInventory = inventoryByHotel.get(hotel.id);

        const qualifyingRoom = hotelInventory?.rooms.find((room) =>
          roomMeetsRequirements(room, {
            minSizeSqm: trip.minRoomSizeSqm,
            minOccupancy: null,
            minAdults: null,
            minChildren: null,
          }),
        );

        if (qualifyingRoom) {
          matchEvidence.push({
            type: "match",
            label: `Room ≥ ${trip.minRoomSizeSqm} sqm`,
            detail: `${qualifyingRoom.name} is ${qualifyingRoom.room_size_sqm} sqm.`,
          });
        }
      }

      const positiveLabels = matchEvidence
        .filter((item) => item.type === "match")
        .map((item) => item.label)
        .slice(0, 4);

      const opening =
        trip.purpose === "remote_work"
          ? "A practical base for working remotely"
          : trip.purpose === "romantic"
            ? "A stay suited to a romantic trip"
            : trip.purpose === "family"
              ? "A stay suited to a family trip"
              : vibeFit
                ? `A ${vibeLabels[trip.vibe]?.toLowerCase() || "well-matched"} stay`
                : "";

      // Only ever say things the hotel's own data supports. Empty means the card hides the block.
      const labelsText = positiveLabels
        .filter((label) => !opening.toLowerCase().includes(label.toLowerCase()))
        .slice(0, 2)
        .join(" and ")
        .toLowerCase();
      const hotelFacts = () => {
        const amenityNames = hotel.amenities
          .slice(0, 2)
          .map((amenity) => (amenityLabels[amenity] || amenity.replaceAll("_", " ")).toLowerCase());
        const tier = hotel.price_tier ? hotel.price_tier.toLowerCase() : "";
        if (tier && amenityNames.length) {
          return `A ${tier} stay in ${hotel.city} with ${amenityNames.join(" and ")}.`;
        }
        if (amenityNames.length) {
          return `A stay in ${hotel.city} with ${amenityNames.join(" and ")}.`;
        }
        if (hotel.review_count > 0 && hotel.rating > 0) {
          return `Rated ${hotel.rating.toFixed(1)} from ${hotel.review_count} reviews.`;
        }
        return "";
      };

      const why = opening
        ? labelsText
          ? `${opening} with ${labelsText}.`
          : `${opening}.`
        : labelsText
          ? `Fits your search on ${labelsText}.`
          : hotelFacts();

      /*
       * Match percentage measures how much of the traveler's
       * stated request this hotel actually satisfies.
       *
       * Score decides ranking.
       * fit_percent explains request coverage.
       */
      const tradeoffs = matchEvidence
        .filter((item) => item.type !== "match")
        .map((item) => item.detail)
        .slice(0, 2);

      const caveat =
        tradeoffs.length > 0
          ? tradeoffs.join(" ")
          : hotel.editorial_notes;

      return {
        hotel,
        score,
        fit_percent,
        why_it_matches: why,
        things_to_know: caveat,
        evidence: matchEvidence,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.hotel.estimated_price_per_night || Number.MAX_SAFE_INTEGER) -
          (b.hotel.estimated_price_per_night || Number.MAX_SAFE_INTEGER),
    );
}

type AIItem = { hotel_id: string; why_it_matches: string; things_to_know: string };

/** AI can refine the shortlist but can only select IDs from the filtered catalog. */
export async function refineWithAI(
  matches: Match[],
  request: TripRequest,
  aiIntent?: AITripIntent,
): Promise<{ matches: Match[]; enhanced: boolean }> {
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
          input: JSON.stringify({
            trip: interpretTrip(request, aiIntent),
            candidates,
          }),
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
