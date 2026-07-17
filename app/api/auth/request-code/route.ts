import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ensureSchoolAdminAccount } from "@/lib/auth-admin";

export async function POST(request: Request) {
  const { email } = await request.json();
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  try {
    const user = await ensureSchoolAdminAccount(normalizedEmail);
    if (!user) return NextResponse.json({ ok: true });

    const url = process.env.SUPABASE_URL!;
    const secret = process.env.SUPABASE_SECRET_KEY!;
    const authClient = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await authClient.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: false },
    });
    if (error) return NextResponse.json({ error: "Verification email delivery is not configured yet." }, { status: 503 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to start verification right now." }, { status: 500 });
  }
}
