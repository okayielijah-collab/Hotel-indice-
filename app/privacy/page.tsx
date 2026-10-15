import type { Metadata } from "next";
import { LegalPage } from "../_legal/legal-page";
import { LEGAL } from "../_legal/legal-config";

export const metadata: Metadata = {
  title: "Privacy at Hotel Indice",
  description: "What Hotel Indice collects, why, and who else handles it.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <p>This page explains what Hotel Indice collects when you use the site, why we collect it and who else handles it. We have kept it specific.</p>

      <h2>Who runs Hotel Indice</h2>
      <p>Hotel Indice is run by {LEGAL.operator}. You can reach us at {LEGAL.contactEmail}.</p>

      <h2>What we collect and why</h2>
      <ul>
        <li><strong>Searches.</strong> When you search, we save the text you typed or said, the destination, how many results came back, and which stays you open rates for or follow to a booking partner. We use this to see what people look for and to fix searches that find nothing. These records are not linked to your IP address, an account or a cookie, and we do not save them if your browser sends Do Not Track.</li>
        <li><strong>Your account.</strong> If you sign in, we collect your email address and send you a sign-in code. We store your saved trips and saved stays so they follow you across devices.</li>
        <li><strong>Price alerts.</strong> If you watch a stay, we store the stay, your dates, the number of guests, your target price and the latest prices we saw. We email you when the price reaches your target.</li>
        <li><strong>Listing a hotel.</strong> If you use List your hotel, we store what you send: the hotel name and location, your name, email and role, the website, a starting price, amenities and a description.</li>
        <li><strong>Voice search.</strong> If you use the microphone, the recording is sent to OpenAI to turn it into text. We do not keep the recording.</li>
        <li><strong>Device location.</strong> If you use the locate button on the map, your browser asks for permission and shows where you are on the map. That location stays in your browser and is not sent to our servers.</li>
        <li><strong>On your device.</strong> Your browser stores a few things so the site works, such as your language choice and, if you sign in, your session.</li>
      </ul>

      <h2>Who else handles your data</h2>
      <ul>
        <li><strong>Supabase</strong> hosts our database and sign-in.</li>
        <li><strong>OpenAI</strong> receives the text of your search, and any voice recording, to understand your request and to help write the explanations for matches.</li>
        <li><strong>An email delivery service</strong> sends price alert emails for us.</li>
        <li><strong>Our hosting provider</strong> runs the site and sees the requests your browser makes to it.</li>
        <li><strong>OpenStreetMap</strong> supplies the map. Map tiles load from its servers in your browser, so it can see your IP address.</li>
        <li><strong>Booking partners.</strong> When you choose Check rates or continue with a partner, you leave Hotel Indice. The partner’s own privacy policy applies from there, and we may earn a commission.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>We keep your account, saved trips and alerts while your account exists. We keep other records until you ask us to delete them or we no longer need them.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Email us to see, correct or delete the data we hold about you. We aim to reply within 30 days.</li>
        <li>Stop watching a stay at any time to end its price alerts.</li>
        <li>Turn on Do Not Track in your browser and we will not save your searches.</li>
        <li>Depending on where you live, you may have more rights under local law, including the right to complain to your data protection regulator.</li>
      </ul>

      <h2>Children</h2>
      <p>Hotel Indice is not meant for children under 16, and we do not knowingly collect their data.</p>

      <h2>Changes</h2>
      <p>If we change this page in a way that matters, we will update the date at the top.</p>

      <h2>Contact</h2>
      <p>{LEGAL.contactEmail}</p>
    </LegalPage>
  );
}
