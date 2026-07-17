import type { Metadata } from "next";
import { AdminApp } from "./admin-app";
import { LoginForm } from "./login-form";
import { getViewer } from "@/lib/auth";
import { loadSchools } from "@/lib/school-data";

export const metadata: Metadata = {
  title: "Appreciation Initiative — Admin",
  description:
    "The central Admin workspace for school eligibility, forms, correspondence, and order fulfillment.",
};

export default async function Home() {
  const viewer = await getViewer();
  if (!viewer) return <LoginForm />;
  const { schools, source } = await loadSchools();
  return <AdminApp initialSchools={schools} dataSource={source} viewer={viewer} />;
}
