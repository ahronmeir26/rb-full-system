import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const adminEmail = process.env.SEED_ADMIN_EMAIL || process.env.SEED_MANAGER_EMAIL;
const adminPassword = process.env.SEED_ADMIN_PASSWORD || process.env.SEED_MANAGER_PASSWORD;

if (!url || !secret) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
if (!adminEmail || !adminPassword) {
  throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required.");
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUser(email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 100) return null;
  }
  return null;
}

async function ensureUser(email, password, displayName, role) {
  let user = await findUser(email);
  if (user) {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, role },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, role },
    });
    if (error) throw error;
    user = data.user;
  }

  const { error: profileError } = await supabase.from("user_profiles").upsert({
    id: user.id,
    display_name: displayName,
    role,
  });
  if (profileError) throw profileError;
  return user;
}

const admin = await ensureUser(adminEmail, adminPassword, "Administrator", "admin");

console.log(JSON.stringify({
  admin: { id: admin.id, email: adminEmail, role: "admin" },
}, null, 2));
