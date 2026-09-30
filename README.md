# Hotel Indice

A recommendation-first hotel discovery app built with the Next.js App Router, TypeScript, Tailwind CSS, Supabase/PostgreSQL, Leaflet, and an optional LLM API integration. The source uses App Router page and route handlers; the included Sites deployment runs the Next-compatible Vinext runtime on Cloudflare Workers.

## Run locally

```bash
pnpm install
pnpm dev
```

The app works immediately with 18 **fictional sample hotels** in `data/hotels.json`. Photos are illustrative stock imagery; ratings, amenities, prices, and editorial notes are sample content. Never present the sample catalog as verified bookable inventory.

## Connect Supabase

1. Create a Supabase project. Run `supabase/schema.sql` in its SQL editor.
2. Run `supabase/seed.sql` to load the 18 sample records. The seed is idempotent.
3. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as server environment variables (locally, copy `.env.example` to `.env.local`). The public read policy allows the publishable key to select hotels; writes remain blocked for anonymous users. A legacy `SUPABASE_ANON_KEY` is also supported.
4. Replace sample records with verified hotels, licensed photos, current pricing, and property-specific affiliate booking links before production use.

The server fetches `hotels` through Supabase PostgREST. A missing configuration uses the built-in sample catalog; a configured connection failure shows an error instead of silently showing sample data. To change the sample catalog, edit `data/hotels.json` and run `node scripts/generate-seed.mjs`.
The sample map uses OpenStreetMap's public tile service. Configure a production tile provider for sustained traffic.

## Enable LLM matching

Set `OPENAI_API_KEY` in the server environment. `OPENAI_MODEL` defaults to `gpt-4.1-mini`. The `/api/match` route filters destination, budget, price ceiling, and must-have amenities; ranks candidates by vibe and party; and asks the LLM to order the shortlist and explain each match using only the filtered hotel facts. IDs are checked against the shortlisted hotels. If the API key is absent or the LLM is unavailable, the deterministic ranking and editorial notes remain functional.

The server never sends the API key to the browser. The prompt is capped at 600 characters and only 12 candidate records are sent to the LLM. The response has a nine-second timeout and a deterministic fallback.

## Booking links and pricing

`affiliate_booking_link` is the outbound link field. The UI adds `utm_source`, `utm_medium`, `utm_campaign`, and hotel-specific `utm_content` tracking parameters while preserving existing partner parameters. Sample links open destination searches on Booking.com; they do not claim a property reservation or affiliate commission. Add your approved affiliate partner identifiers and verified deep links to each Supabase record to activate a real handoff. USD prices are indicative; currency conversions in the UI are illustrative fixed ratios rather than live exchange rates.

## Routes

- `/` — discovery workspace, filters, AI concierge, list, map, and gallery
- `GET /api/hotels` — current catalog and source
- `POST /api/match` — structured trip input and ranked recommendations

Example request:

```json
{"destination":"Lagos","party":"business","vibe":"remote_work","budget":"Mid-range","amenities":["fast_wifi","workspace"],"query":"A calm place for a work trip"}
```
