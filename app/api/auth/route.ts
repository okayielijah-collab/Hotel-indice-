/** Email code sign in, through Supabase Auth. No passwords. */

const baseUrl = () => (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const apiKey = () => process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";

type AuthReply = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  user?: { email?: string };
};

function toSession(data: AuthReply, email: string) {
  return {
    accessToken: data.access_token ?? "",
    refreshToken: data.refresh_token ?? "",
    expiresAt: Number(data.expires_at) || Math.floor(Date.now() / 1000) + (Number(data.expires_in) || 3600),
    email: data.user?.email ?? email,
  };
}

const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function POST(request: Request) {
  const base = baseUrl();
  const key = apiKey();
  if (!base || !key) return fail("Sign in is not set up yet.", 503);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("That request did not make sense.", 400);
  }

  const send = (path: string, payload: Record<string, unknown>) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  try {
    if (body.action === "start") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.", 400);
      const res = await send("/auth/v1/otp", { email, create_user: true });
      if (res.status === 429) return fail("Please wait a minute before asking for another code.", 429);
      if (!res.ok) return fail("We could not send the code. Try again in a moment.", 502);
      return Response.json({ ok: true });
    }

    if (body.action === "verify") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const code = String(body.code ?? "").trim();
      if (!/^\d{6,10}$/.test(code)) return fail("The code is numbers only.", 400);
      const res = await send("/auth/v1/verify", { type: "email", email, token: code });
      if (!res.ok) return fail("That code is not right or has expired.", 401);
      const session = toSession((await res.json()) as AuthReply, email);
      if (!session.accessToken) return fail("Sign in did not finish. Try again.", 502);
      return Response.json({ session });
    }

    if (body.action === "refresh") {
      const refreshToken = String(body.refreshToken ?? "");
      if (!refreshToken) return fail("Please sign in again.", 401);
      const res = await send("/auth/v1/token?grant_type=refresh_token", { refresh_token: refreshToken });
      if (res.status === 400 || res.status === 401 || res.status === 403) return fail("Please sign in again.", 401);
      if (!res.ok) return fail("Could not refresh just now.", 502);
      return Response.json({ session: toSession((await res.json()) as AuthReply, "") });
    }
  } catch {
    return fail("Network problem. Try again.", 502);
  }

  return fail("Unknown request.", 400);
}
