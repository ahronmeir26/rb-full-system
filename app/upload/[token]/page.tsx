import Image from "next/image";
import type { Metadata } from "next";
import { getSchoolForUploadToken } from "@/lib/school-upload";
import { SchoolUploadForm } from "./upload-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Secure form upload — Appreciation Initiative",
  description: "Upload school forms securely to the Appreciation Initiative program team.",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

export default async function SchoolUploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const school = await getSchoolForUploadToken(token);
  return <main className="school-upload-page">
    <section className="school-upload-card">
      <div className="school-upload-brand">
        <Image src="/wordmark.png" alt="A.I.STONE" width={190} height={44} priority unoptimized />
        <span>Appreciation Initiative</span>
      </div>
      {school ? <>
        <div className="school-upload-heading"><p>Secure school portal</p><h1>Upload your forms</h1><span>Send completed program documents directly to the Appreciation Initiative team.</span></div>
        <SchoolUploadForm token={token} schoolName={school.name} couponCode={school.code} />
      </> : <div className="school-upload-invalid">
        <h1>This link is no longer active</h1>
        <p>Ask the Appreciation Initiative program team for your school&apos;s current upload link.</p>
      </div>}
    </section>
  </main>;
}
