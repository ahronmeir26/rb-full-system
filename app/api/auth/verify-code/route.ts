import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/auth-admin";

export async function POST(request: Request) {
  const { email, code, password } = await request.json();
  if (typeof email !== "string" || typeof code !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Email, verification code, and password are required." }, { status: 400 });
  }
  if (password.length < 10) {
    return NextResponse.json({ error: "Use a password with at least 10 characters." }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return NextResponse.json({ error: "Authentication is not configured." }, { status: 500 });

  const authClient = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await authClient.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: "email",
  });
  if (error || !data.user || !data.session) {
    return NextResponse.json({ error: "The verification code is invalid or expired." }, { status: 400 });
  }

  const service = getServiceClient();
  const { data: profile, error: profileError } = await service
    .from("user_profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError || !profile || !["admin", "program_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "This account does not have Admin access." }, { status: 403 });
  }

  const { error: passwordError } = await service.auth.admin.updateUserById(data.user.id, {
    password,
    email_confirm: true,
  });
  if (passwordError) return NextResponse.json({ error: "Unable to save the password." }, { status: 500 });

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
