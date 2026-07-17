import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export type Viewer = {
  id: string;
  email: string;
  displayName: string;
  role: "admin";
};

export const ADMIN_ROLES = ["admin", "program_admin"] as const;

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getViewer(): Promise<Viewer | null> {
  const token = (await cookies()).get("appreciation-initiative-access-token")?.value;
  const supabase = serviceClient();
  if (!token || !supabase) return null;

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user?.email) return null;

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("display_name,role")
    .eq("id", userData.user.id)
    .single();
  if (profileError || !profile || !ADMIN_ROLES.includes(profile.role)) return null;

  return {
    id: userData.user.id,
    email: userData.user.email,
    displayName: profile.display_name || userData.user.email,
    role: "admin",
  };
}
