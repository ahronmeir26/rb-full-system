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

export async function ensureSchoolAdminAccount(emailInput: string): Promise<User | null> {
  const email = emailInput.trim().toLowerCase();
  const supabase = getServiceClient();
  let user = await findAuthUser(supabase, email);
  if (user) {
    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileLookupError) throw profileLookupError;
    if (existingProfile) return user;
  }

  const { data: contacts, error: contactError } = await supabase
    .from("school_contacts")
    .select("name,school_id")
    .eq("email", email);
  if (contactError) throw contactError;
  if (!contacts?.length) return null;

  const displayName = contacts.find((contact) => contact.name)?.name || "School Administrator";
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { display_name: displayName, role: "school_admin" },
    });
    if (error) throw error;
    user = data.user;
  }

  const { error: profileError } = await supabase.from("user_profiles").upsert({
    id: user.id,
    display_name: displayName,
    role: "school_admin",
  });
  if (profileError) throw profileError;

  const { error: linkError } = await supabase
    .from("school_contacts")
    .update({ user_id: user.id })
    .eq("email", email);
  if (linkError) throw linkError;
  return user;
}
