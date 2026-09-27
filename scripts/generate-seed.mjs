import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hotels = JSON.parse(readFileSync(join(root, "data/hotels.json"), "utf8"));
const fields = ["id", "name", "city", "country", "latitude", "longitude", "price_tier", "estimated_price_per_night", "amenities", "vibe_tags", "editorial_notes", "image_urls", "affiliate_booking_link", "rating", "review_count"];
const quote = (text) => `'${String(text).replaceAll("'", "''")}'`;
const value = (field, input) => Array.isArray(input) ? `ARRAY[${input.map(quote).join(",")}]::text[]` : typeof input === "number" ? String(input) : field === "id" ? `${quote(input)}::uuid` : quote(input);
const rows = hotels.map((hotel) => `  (${fields.map((field) => value(field, hotel[field])).join(", ")})`).join(",\n");
const updates = fields.filter((field) => field !== "id").map((field) => `${field} = excluded.${field}`).join(",\n  ");
const sql = `-- Generated from data/hotels.json by npm run seed:generate.\n-- Fictional demo hotels: replace with licensed, verified properties before launch.\ninsert into public.hotels (${fields.join(", ")})\nvalues\n${rows}\non conflict (id) do update set\n  ${updates};\n`;
writeFileSync(join(root, "supabase/seed.sql"), sql);
console.log(`Wrote ${hotels.length} demo hotels to supabase/seed.sql`);
