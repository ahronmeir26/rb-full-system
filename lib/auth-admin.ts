import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export function getServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Supabase server credentials are not configured.");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function findAuthUser(supabase: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 100) return null;
  }
  return null;
}

export async function findAdminAccount(emailInput: string): Promise<User | null> {
  const email = emailInput.trim().toLowerCase();
  const supabase = getServiceClient();
  const user = await findAuthUser(supabase, email);
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return profile && ["admin", "program_admin"].includes(profile.role) ? user : null;
}
