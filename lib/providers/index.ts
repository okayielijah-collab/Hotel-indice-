import type { HotelProvider } from "@/lib/providers/types";
import { fixtureProvider } from "@/lib/providers/fixture";
import { serpApiProvider } from "@/lib/providers/serpapi";

export function getHotelProvider(): HotelProvider | null {
  switch (process.env.HOTELINDICE_PROVIDER) {
    case "fixture":
      return fixtureProvider;
    case "serpapi":
      return serpApiProvider;
    default:
      return null;
  }
}
