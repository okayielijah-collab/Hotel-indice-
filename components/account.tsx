"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { mergeStores, type SyncableStore } from "@/lib/sync";

const SESSION_KEY = "hotel-indice:session:v1";

type Session = { accessToken: string; refreshToken: string; expiresAt: number; email: string };

export type Account = {
  session: Session | null;
  step: "email" | "code";
  email: string;
  setEmail: (value: string) => void;
  code: string;
  setCode: (value: string) => void;
  busy: boolean;
  note: string;
  sendCode: () => Promise<void>;
  verify: () => Promise<void>;
  signOut: () => void;
  back: () => void;
  authedFetch: (path: string, init?: RequestInit) => Promise<Response | null>;
};

class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function callAuth(body: Record<string, unknown>): Promise<{ session?: Session }> {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; session?: Session };
  if (!res.ok) throw new AuthError(data.error || "Something went wrong. Try again.", res.status);
  return data;
}

/** Sign in with an email code, then keep saved trips and stays in step across devices. */
export function useAccount<S extends SyncableStore>(
  store: S,
  setStore: Dispatch<SetStateAction<S>>,
  ready: boolean,
): Account {
  const [session, setSession] = useState<Session | null>(null);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [synced, setSynced] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const lastPushed = useRef("");

  const keep = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSession(next);
    try {
      if (next) window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(SESSION_KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const freshToken = useCallback(async (): Promise<string | null> => {
    const current = sessionRef.current;
    if (!current) return null;
    if (current.expiresAt - Date.now() / 1000 > 60) return current.accessToken;
    try {
      const data = await callAuth({ action: "refresh", refreshToken: current.refreshToken });
      if (!data.session) throw new AuthError("Please sign in again.", 401);
      const next = { ...data.session, email: current.email };
      keep(next);
      return next.accessToken;
    } catch (error) {
      if (error instanceof AuthError && error.status === 401) {
        keep(null);
        setSynced(false);
        setNote("Please sign in again.");
      }
      return null;
    }
  }, [keep]);

  const pull = useCallback(async () => {
    const token = await freshToken();
    if (!token) return;
    try {
      const res = await fetch("/api/sync", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const { data } = (await res.json()) as { data: unknown };
      setStore((current) => mergeStores(current, data));
      setSynced(true);
    } catch {
      setNote("Could not sync just now. Your trips are safe on this device.");
    }
  }, [freshToken, setStore]);

  // Pick up a saved session once the local trips have loaded.
  useEffect(() => {
    if (!ready) return;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(SESSION_KEY);
    } catch {
      /* storage unavailable */
    }
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Session;
      if (saved?.accessToken && saved?.refreshToken) {
        sessionRef.current = saved;
        setSession(saved);
        void pull();
      }
    } catch {
      /* damaged session, ignore */
    }
  }, [ready, pull]);

  // Send changes to the account a moment after they happen.
  useEffect(() => {
    if (!ready || !synced || !sessionRef.current) return;
    const data = { trips: store.trips, stays: store.stays };
    const payload = JSON.stringify(data);
    if (payload === lastPushed.current) return;
    const timer = setTimeout(async () => {
      const token = await freshToken();
      if (!token) return;
      try {
        const res = await fetch("/api/sync", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ data }),
        });
        if (res.ok) lastPushed.current = payload;
      } catch {
        /* try again on the next change */
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [store, ready, synced, freshToken]);

  /** Calls one of our own routes with the signed in token. Returns null when not signed in. */
  const authedFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = await freshToken();
      if (!token) return null;
      return fetch(path, { ...init, cache: "no-store", headers: { ...((init.headers as Record<string, string>) ?? {}), Authorization: `Bearer ${token}` } });
    },
    [freshToken],
  );

  const sendCode = useCallback(async () => {
    setBusy(true);
    setNote("");
    try {
      await callAuth({ action: "start", email: email.trim() });
      setStep("code");
      setNote("We sent a code to your email.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }, [email]);

  const verify = useCallback(async () => {
    setBusy(true);
    setNote("");
    try {
      const data = await callAuth({ action: "verify", email: email.trim(), code: code.trim() });
      if (!data.session) throw new AuthError("Sign in did not finish. Try again.", 502);
      keep({ ...data.session, email: data.session.email || email.trim() });
      setCode("");
      setStep("email");
      await pull();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }, [email, code, keep, pull]);

  const signOut = useCallback(() => {
    keep(null);
    setSynced(false);
    lastPushed.current = "";
    setNote("Signed out. Your trips stay on this device.");
  }, [keep]);

  const back = useCallback(() => {
    setStep("email");
    setCode("");
    setNote("");
  }, []);

  return { session, step, email, setEmail, code, setCode, busy, note, sendCode, verify, signOut, back, authedFetch };
}

export function AccountPanel({ account }: { account: Account }) {
  const { session, step, email, setEmail, code, setCode, busy, note, sendCode, verify, signOut, back } = account;
  return (
    <section className="cc-account" aria-label="Your account">
      {session ? (
        <>
          <p className="cc-account-title">Signed in as {session.email}</p>
          <p className="cc-account-sub">Your trips and saved stays follow you to any device.</p>
          <button type="button" className="cc-account-link" onClick={signOut}>Sign out</button>
        </>
      ) : step === "email" ? (
        <form onSubmit={(event) => { event.preventDefault(); void sendCode(); }}>
          <p className="cc-account-title">Keep your trips on every device</p>
          <p className="cc-account-sub">Enter your email and we send you a code. No password.</p>
          <div className="cc-account-row">
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email address" />
            <button type="submit" disabled={busy || !email.includes("@")}>{busy ? "Sending" : "Send code"}</button>
          </div>
        </form>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); void verify(); }}>
          <p className="cc-account-title">Enter your code</p>
          <p className="cc-account-sub">We sent it to {email}</p>
          <div className="cc-account-row">
            <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" aria-label="Code from your email" />
            <button type="submit" disabled={busy || code.length < 6}>{busy ? "Checking" : "Sign in"}</button>
          </div>
          <button type="button" className="cc-account-link" onClick={back}>Use a different email</button>
        </form>
      )}
      {note && <p className="cc-account-note" role="status">{note}</p>}
    </section>
  );
}
