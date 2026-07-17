import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const managerEmail = process.env.SEED_MANAGER_EMAIL;
const managerPassword = process.env.SEED_MANAGER_PASSWORD;
const schoolAdminEmail = process.env.SEED_SCHOOL_ADMIN_EMAIL;
const schoolAdminPassword = process.env.SEED_SCHOOL_ADMIN_PASSWORD;
const schoolId = Number(process.env.SEED_SCHOOL_ID || 1);

if (!url || !secret) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
if (!managerEmail || !managerPassword || !schoolAdminEmail || !schoolAdminPassword) {
  throw new Error("Seed-user credentials are required.");
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

const manager = await ensureUser(managerEmail, managerPassword, "Managing Administrator", "program_admin");
const schoolAdmin = await ensureUser(schoolAdminEmail, schoolAdminPassword, "Seed School Administrator", "school_admin");

const { data: school, error: schoolError } = await supabase
  .from("schools")
  .select("id,name")
  .eq("id", schoolId)
  .single();
if (schoolError) throw schoolError;

const { error: contactError } = await supabase.from("school_contacts").upsert({
  school_id: schoolId,
  user_id: schoolAdmin.id,
  name: null,
  email: schoolAdminEmail,
  title: "Seed login",
  is_primary: false,
}, { onConflict: "school_id,email" });
if (contactError) throw contactError;

console.log(JSON.stringify({
  manager: { id: manager.id, email: managerEmail, role: "program_admin" },
  schoolAdmin: { id: schoolAdmin.id, email: schoolAdminEmail, role: "school_admin", schoolId, school: school.name },
}, null, 2));
