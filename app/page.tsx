import { CommandCenter } from "@/components/command-center";
import { getCatalog } from "@/lib/hotels";
import { rankHotels, type TripRequest } from "@/lib/matching";

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
  } catch {
    catalogError = "The hotel catalog is temporarily unavailable. Please check your Supabase connection and try again.";
  }
  return <CommandCenter initialMatches={matches} source={source} catalogError={catalogError} />;
}
