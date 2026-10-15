import type { Metadata } from "next";
import "./globals.css";
import "./command-center.css";
import { SITE_URL } from "./site-config";

const TITLE = "Hotel Indice: Find a stay that fits";
const DESCRIPTION = "Discover hotels by telling us where you're going and what matters most. Explore thoughtful matches on a list or a map.";

export const metadata: Metadata = {
  verification: {
    google: "xPlnzEBIn7tWxw2ubF2YslNqK_fxtURszoHmd6ZhgNc",
  },
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    type: "website",
    siteName: "Hotel Indice",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Hotel Indice: Find the stay that actually fits your trip" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
