import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hotel Indice — Find a stay that fits",
  description: "Discover hotels by telling us where you're going and what matters most. Explore thoughtful matches on a list or a map.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
