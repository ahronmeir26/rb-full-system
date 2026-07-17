import type { Metadata } from "next";
import { AdminApp } from "./admin-app";
import { LoginForm } from "./login-form";
import { getViewer } from "@/lib/auth";
import { loadDiscountProgram } from "@/lib/discount-program";
import { loadOutreachStatuses, loadSchools } from "@/lib/school-data";

export const metadata: Metadata = {
  title: "Appreciation Initiative — Admin",
  description:
    "The central Admin workspace for school eligibility, forms, correspondence, and order fulfillment.",
};

export default async function Home() {
  const viewer = await getViewer();
  if (!viewer) return <LoginForm />;
  const [{ schools, source }, outreachStatuses, discountProgram] = await Promise.all([
    loadSchools(),
    loadOutreachStatuses(),
    loadDiscountProgram(),
  ]);
  return <AdminApp initialSchools={schools} initialOutreachStatuses={outreachStatuses} initialDiscountProgram={discountProgram} dataSource={source} viewer={viewer} />;
}
