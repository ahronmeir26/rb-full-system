import type { Metadata } from "next";
import { PortalApp } from "./portal-app";

export const metadata: Metadata = {
  title: "SchoolBridge — Program Operations",
  description:
    "A clear workspace for school eligibility, forms, correspondence, and order fulfillment.",
};

export default function Home() {
  return <PortalApp />;
}
