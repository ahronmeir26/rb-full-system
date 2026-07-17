import { createClient } from "@supabase/supabase-js";
import { getViewer } from "@/lib/auth";
import {
  discountProgramToRow,
  loadDiscountProgram,
  mapDiscountProgram,
  parseDiscountProgramInput,
} from "@/lib/discount-program";

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });
  const program = await loadDiscountProgram();
  return Response.json({ program });
}

export async function PATCH(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });
  const supabase = serviceClient();
  if (!supabase) return Response.json({ error: "Discount settings require a Supabase connection." }, { status: 503 });

  const body = await request.json().catch(() => null);
  const current = await loadDiscountProgram();
  let program;
  try {
    program = parseDiscountProgramInput(body, current);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid discount settings." }, { status: 400 });
  }

  const row = {
    ...discountProgramToRow(program),
    sync_status: current.shopifyDiscountId ? "pending" : "draft",
    last_sync_error: null,
  };
  const { data, error } = await supabase
    .from("discount_programs")
    .upsert(row, { onConflict: "program_year" })
    .select("*")
    .single();

  if (error) {
    console.error("Unable to save 2026 discount settings", error);
    return Response.json({ error: "Unable to save the discount settings in Supabase." }, { status: 500 });
  }
  return Response.json({ program: mapDiscountProgram(data) });
}
