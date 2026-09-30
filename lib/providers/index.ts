import type { HotelProvider } from "@/lib/providers/types";
import { fixtureProvider } from "@/lib/providers/fixture";

export function getHotelProvider(): HotelProvider | null {
  if (process.env.HOTELINDICE_PROVIDER === "fixture") {
    return fixtureProvider;
  }

  return null;
}
