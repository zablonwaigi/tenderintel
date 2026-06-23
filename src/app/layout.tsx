import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: {
    default: "TenderIntel — Match your business to SA government tenders",
    template: "%s · TenderIntel",
  },
  description:
    "TenderIntel by GrowYourBiz helps South African SMMEs match their company profile to live government tenders, understand requirements in plain English, track deadlines, and prepare bid packs.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://growyourbizsa.co.za"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
