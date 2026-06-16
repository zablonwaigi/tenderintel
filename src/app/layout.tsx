import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: {
    default: "TenderIntel — South African Government Tender Intelligence",
    template: "%s · TenderIntel",
  },
  description:
    "Find, understand and win South African government tenders. Search 150,000+ tenders, download documents, and learn the SBD/MBD forms.",
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
