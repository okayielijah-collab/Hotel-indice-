import type { Metadata } from "next";
import { LegalPage } from "../_legal/legal-page";
import { LEGAL } from "../_legal/legal-config";

export const metadata: Metadata = {
  title: "Terms of use for Hotel Indice",
  description: "The rules for using Hotel Indice.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use">
      <p>By using Hotel Indice you agree to these terms. If you do not agree, please do not use the site.</p>

      <h2>What Hotel Indice is</h2>
      <p>Hotel Indice helps you find and compare stays. We are not a hotel and we do not take bookings or payments. When you choose Check rates or continue with a partner, you leave our site. Your booking is a contract between you and the hotel or booking partner, under their terms.</p>

      <h2>Prices and availability</h2>
      <p>Prices on Hotel Indice are estimates. The current rate and availability are shown by the booking partner before you pay, and they can differ from what you saw here. We are not responsible for changes in price or availability.</p>

      <h2>Links that may earn us a fee</h2>
      <p>Some links to booking partners may earn us a commission. This never changes which stays we show or in what order.</p>

      <h2>Matches, ratings and descriptions</h2>
      <p>We build matches from the information available to us, and it can be incomplete or out of date. The notes on what to watch out for are not a full list. Check the details that matter to you with the hotel or partner before you book. Ratings and reviews come from third parties such as Tripadvisor, and they belong to those parties.</p>

      <h2>Accounts and saved items</h2>
      <p>You sign in with a code sent to your email. Keep access to your email private, and tell us if you think someone else has used your account. We may suspend an account that is misused.</p>

      <h2>Price alerts</h2>
      <p>We check watched stays about once a day and email you when the price reaches your target. We do our best, but an alert can be late or missed, so it is not a guarantee that you will see a price drop.</p>

      <h2>Listing your hotel</h2>
      <p>When you send a hotel, you confirm that you own it or are allowed to represent it, and that what you send is accurate. We may edit, refuse or remove a listing at any time. Sending a hotel does not guarantee that it will appear.</p>

      <h2>Using the site fairly</h2>
      <p>Please do not break the site, overload it, copy it in bulk or use it for anything unlawful.</p>

      <h2>Our content</h2>
      <p>The Hotel Indice name, design and text belong to us. Hotel photos, descriptions and ratings belong to their owners.</p>

      <h2>No guarantees and limits on liability</h2>
      <p>Hotel Indice is provided as it is. To the extent the law allows, we are not liable for indirect or consequential losses, or for stays you book with a hotel or partner. Nothing here limits rights you have under law that cannot be limited.</p>

      <h2>Changes</h2>
      <p>We may update these terms. If we change them in a way that matters, we will update the date at the top. Using the site after a change means you accept the new terms.</p>

      <h2>Which law applies</h2>
      <p>These terms are governed by {LEGAL.governingLaw}.</p>

      <h2>Contact</h2>
      <p>{LEGAL.contactEmail}</p>
    </LegalPage>
  );
}
