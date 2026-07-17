import { createClient } from "@supabase/supabase-js";
import { getViewer } from "@/lib/auth";
import { loadDiscountProgram, mapDiscountProgram } from "@/lib/discount-program";
import { shopifyConnectionStatus, syncShopifyDiscount } from "@/lib/shopify";

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST() {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });
  const supabase = serviceClient();
  if (!supabase) return Response.json({ error: "Shopify synchronization requires Supabase." }, { status: 503 });
  const connection = shopifyConnectionStatus();
  if (!connection.connected || !connection.functionConfigured) {
    return Response.json({ error: "Complete the Shopify connection and Discount Function setup before syncing." }, { status: 409 });
  }

  const program = await loadDiscountProgram();
  if (!program.id) return Response.json({ error: "Save the 2026 discount settings before syncing." }, { status: 409 });
  const { data: schools, error: schoolsError } = await supabase
    .from("schools")
    .select("id,code")
    .not("code", "is", null);
  if (schoolsError) return Response.json({ error: "Unable to load the 2026 school codes." }, { status: 500 });

  const codedSchools = (schools || [])
    .map((school) => ({ id: Number(school.id), code: String(school.code || "").trim().toUpperCase() }))
    .filter((school) => school.code);
  const uniqueCodes = new Set(codedSchools.map((school) => school.code));
  if (uniqueCodes.size !== codedSchools.length) {
    return Response.json({ error: "Two or more schools share the same 2026 code. Make every school code unique before syncing." }, { status: 409 });
  }

  await supabase.from("discount_programs").update({
    sync_status: "pending",
    last_sync_error: null,
  }).eq("id", program.id);

  try {
    const result = await syncShopifyDiscount(program, codedSchools.map((school) => school.code));
    const existingByCode = new Map(result.existingCodes.map((item) => [item.code.toUpperCase(), item.id]));
    const hasJobs = result.jobIds.length > 0;
    const codeRows = codedSchools.map((school) => ({
      discount_program_id: program.id,
      school_id: school.id,
      program_year: 2026,
      code: school.code,
      shopify_redeem_code_id: existingByCode.get(school.code) || null,
      sync_status: existingByCode.has(school.code) ? "synced" : "pending",
      last_synced_at: existingByCode.has(school.code) ? new Date().toISOString() : null,
      last_sync_error: null,
    }));
    if (codeRows.length) {
      const { error: codesError } = await supabase
        .from("discount_school_codes")
        .upsert(codeRows, { onConflict: "school_id,program_year" });
      if (codesError) throw new Error("Shopify updated, but the school-code sync records could not be saved.");
    }

    const currentSchoolIds = new Set(codedSchools.map((school) => school.id));
    const { data: storedRows } = await supabase
      .from("discount_school_codes")
      .select("id,school_id")
      .eq("discount_program_id", program.id);
    const staleIds = (storedRows || []).filter((row) => !currentSchoolIds.has(Number(row.school_id))).map((row) => row.id);
    if (staleIds.length) await supabase.from("discount_school_codes").delete().in("id", staleIds);

    const { data: saved, error: saveError } = await supabase
      .from("discount_programs")
      .update({
        shopify_discount_id: result.discountId,
        shopify_status: result.shopifyStatus,
        sync_status: hasJobs ? "pending" : "synced",
        sync_job_ids: result.jobIds,
        last_synced_at: new Date().toISOString(),
        last_sync_error: null,
      })
      .eq("id", program.id)
      .select("*")
      .single();
    if (saveError) throw new Error("Shopify updated, but the program sync result could not be saved.");

    return Response.json({
      program: mapDiscountProgram(saved),
      summary: {
        assignedSchoolCodes: codedSchools.length,
        totalShopifyCodes: result.totalDesiredCodes,
        codesQueuedForAdd: result.codesToAdd.length,
        codesQueuedForRemoval: result.codeIdsToDelete.length,
        pending: hasJobs,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to synchronize Shopify.";
    console.error("Unable to synchronize the 2026 Shopify discount", error);
    await supabase.from("discount_programs").update({
      sync_status: "error",
      last_sync_error: message,
    }).eq("id", program.id);
    return Response.json({ error: message }, { status: 502 });
  }
}
