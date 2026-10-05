import { CommandCenter } from "@/components/command-center";
import { getCatalog } from "@/lib/hotels";
import { rankHotels, type TripRequest } from "@/lib/matching";
import {
  findTripadvisorIdsForHotels,
  getTripadvisorHotels,
} from "@/lib/tripadvisor";

export const dynamic = "force-dynamic";

const initialTrip: TripRequest = { destination: "", party: "", vibe: "", budget: "Any", amenities: [], query: "" };

export default async function Home() {
  let matches = [] as ReturnType<typeof rankHotels>;
  let source: "supabase" | "demo" | "provider" = "supabase";
  let catalogError: string | undefined;
  try {
    const catalog = await getCatalog();
    matches = rankHotels(catalog.hotels, initialTrip);
    source = catalog.source;

    try {
      const visibleHotels = matches
        .map((match) => match.hotel)
        .filter(Boolean)
        .map((hotel) => ({
          id: hotel.id,
          name: hotel.name,
          latitude: hotel.latitude,
          longitude: hotel.longitude,
        }));

      const tripadvisorIds =
        await findTripadvisorIdsForHotels(visibleHotels);

      if (tripadvisorIds.size) {
        const summaries = await getTripadvisorHotels([
          ...tripadvisorIds.values(),
        ]);

        const summariesByTripadvisorId = new Map(
          summaries.map((summary) => [summary.id, summary]),
        );

        const tripadvisorByHotelId = new Map(
          [...tripadvisorIds.entries()]
            .map(([hotelId, tripadvisorId]) => {
              const summary =
                summariesByTripadvisorId.get(tripadvisorId);

              return summary ? [hotelId, summary] : null;
            })
            .filter(
              (
                item,
              ): item is [
                string,
                import("@/lib/tripadvisor").TripadvisorHotelSummary,
              ] => Boolean(item),
            ),
        );

        matches = matches.map((match) => ({
          ...match,
          tripadvisor:
            tripadvisorByHotelId.get(match.hotel.id) || null,
        }));
      }
    } catch (error) {
      console.error(
        "Tripadvisor initial-page enrichment unavailable:",
        error,
      );
    }
  } catch {
    catalogError = "The hotel catalog is temporarily unavailable. Please check your Supabase connection and try again.";
  }
  return (
    <CommandCenter
      initialMatches={matches}
      source={source}
      catalogError={matches.length === 0 ? catalogError : undefined}
    />
  );
}
