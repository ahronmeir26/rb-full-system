import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/auth-admin";

export async function POST(request: Request) {
  const { currentPassword, newPassword } = await request.json();
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return NextResponse.json({ error: "Current and new passwords are required." }, { status: 400 });
  }
  if (newPassword.length < 10) {
    return NextResponse.json({ error: "Use a new password with at least 10 characters." }, { status: 400 });
  }

  const token = (await cookies()).get("appreciation-initiative-access-token")?.value;
  const service = getServiceClient();
  if (!token) return NextResponse.json({ error: "Sign in again to change your password." }, { status: 401 });
  const { data: userData, error: userError } = await service.auth.getUser(token);
  if (userError || !userData.user?.email) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });

  const url = process.env.SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  const authClient = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInError } = await authClient.auth.signInWithPassword({
    email: userData.user.email,
    password: currentPassword,
  });
  if (signInError) return NextResponse.json({ error: "The current password is incorrect." }, { status: 400 });

  const { error: updateError } = await service.auth.admin.updateUserById(userData.user.id, { password: newPassword });
  if (updateError) return NextResponse.json({ error: "Unable to update the password." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
