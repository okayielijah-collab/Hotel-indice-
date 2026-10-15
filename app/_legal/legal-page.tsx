import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL } from "./legal-config";
import "./legal.css";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="legal">
      <header className="legal-top">
        <div className="legal-wrap">
          <Link href="/" className="legal-brand">Hotel <em>Indice</em></Link>
        </div>
      </header>
      <main className="legal-wrap">
        <h1>{title}</h1>
        <p className="legal-updated">Last updated {LEGAL.updated}</p>
        {children}
      </main>
      <footer className="legal-foot">
        <div className="legal-wrap">
          <nav aria-label="Site pages">
            <Link href="/">Find a stay</Link>
            <Link href="/about">About</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
