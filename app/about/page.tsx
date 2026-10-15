import type { Metadata } from "next";
import { LegalPage } from "../_legal/legal-page";
import { LEGAL } from "../_legal/legal-config";

export const metadata: Metadata = {
  title: "About Hotel Indice",
  description: "Hotel Indice matches you to a few stays that fit your trip, and tells you what to watch out for.",
};

export default function AboutPage() {
  return (
    <LegalPage title="About Hotel Indice">
      <p>Hotel Indice helps you find a stay that fits the trip you are planning, and tells you what to watch out for before you book.</p>

      <h2>How it works</h2>
      <ul>
        <li>You describe your trip the way you would tell a friend: where you are going, who is coming and what matters.</li>
        <li>We match a few stays. Each one comes with why it fits and what to watch out for.</li>
        <li>You open our booking partner to see today’s price before you decide.</li>
      </ul>

      <h2>What we stand behind</h2>
      <ul>
        <li>Stays are never ranked by commission. Some links may earn us a fee, and that never changes which stays we show or in what order.</li>
        <li>Every match is honest about the downsides, like noise, small rooms or a long trip into town.</li>
        <li>You see the current rate with the booking partner before you pay. Prices on Hotel Indice are estimates until then.</li>
      </ul>

      <h2>Where the information comes from</h2>
      <p>Hotel details come from our catalog and from our partners’ listings. Ratings and review counts come from public rating sources, including Tripadvisor where you see its rating. Our notes try to say what we know and what we do not. If something is not confirmed, we say so.</p>

      <h2>For hotel owners</h2>
      <p>You can send us your hotel with the List your hotel form. We review every submission before anything appears, and sending one does not guarantee a listing.</p>

      <h2>Contact</h2>
      <p>Questions, corrections or requests about your data: {LEGAL.contactEmail}.</p>
    </LegalPage>
  );
}
