import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return NextResponse.json({ error: "Authentication is not configured." }, { status: 500 });

  const { email, password } = await request.json();
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const authClient = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.session) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });

  const serviceClient = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await serviceClient
    .from("user_profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "This account does not have portal access." }, { status: 403 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set("appreciation-initiative-access-token", data.session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: data.session.expires_in,
  });
  return response;
}
