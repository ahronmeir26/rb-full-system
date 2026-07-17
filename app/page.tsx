import type { Metadata } from "next";
import { PortalApp } from "./portal-app";
import { LoginForm } from "./login-form";
import { getViewer } from "@/lib/auth";
import { loadSchools } from "@/lib/school-data";

export const metadata: Metadata = {
  title: "Appreciation Initiative — Program Operations",
  description:
    "A clear workspace for school eligibility, forms, correspondence, and order fulfillment.",
};

export default async function Home() {
  const viewer = await getViewer();
  if (!viewer) return <LoginForm />;
  const { schools, source } = await loadSchools(viewer.schoolId);
  return <PortalApp initialSchools={schools} dataSource={source} viewer={viewer} />;
}
