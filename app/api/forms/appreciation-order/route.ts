import { customizeAppreciationOrderForm } from "@/lib/appreciation-order-form";
import { getViewer } from "@/lib/auth";
import { loadSchools } from "@/lib/school-data";

async function loadTemplate(request: Request) {
  const response = await fetch(new URL("/forms/ai-stone-appreciation-order-form-template.pdf", request.url));
  if (!response.ok) throw new Error("The order-form template could not be loaded.");
  return new Uint8Array(await response.arrayBuffer());
}

function safeFilenamePart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "school";
}

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });

  const url = new URL(request.url);
  const requestedSchoolId = Number(url.searchParams.get("schoolId"));
  const schoolId = requestedSchoolId;
  if (!schoolId || !Number.isInteger(schoolId) || schoolId < 1) {
    return Response.json({ error: "A valid school is required." }, { status: 400 });
  }

  const { schools } = await loadSchools(schoolId);
  const school = schools.find((item) => item.id === schoolId);
  if (!school) return Response.json({ error: "School not found." }, { status: 404 });
  const couponCode = school.code.trim();
  if (!couponCode) {
    return Response.json({ error: "This school does not have a 2026 coupon code yet." }, { status: 409 });
  }

  try {
    const customized = await customizeAppreciationOrderForm(
      await loadTemplate(request),
      couponCode,
    );
    const filename = `ai-stone-order-form-${safeFilenamePart(school.name)}.pdf`;
    return new Response(customized as BodyInit, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/pdf",
      },
    });
  } catch (error) {
    console.error("Unable to generate appreciation order form", error);
    return Response.json({ error: "The customized order form could not be generated." }, { status: 500 });
  }
}
