import type { Metadata } from "next";
import { Nunito, Nunito_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { ErrorBoundaryWrapper } from "./ErrorBoundaryWrapper";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Major & Match — Rekomendasi Jurusan Kuliah Akurat",
  description:
    "Temukan jurusan kuliah yang paling cocok dengan minat dan kepribadianmu. Analisis AI interaktif dengan 236+ jurusan dari semua bidang ilmu. Gratis, cepat, dan akurat.",
  keywords: [
    "jurusan kuliah",
    "rekomendasi jurusan",
    "tes minat bakat",
    "kalkulator jurusan",
    "karir",
    "mahasiswa baru",
    "major match",
    "pilih jurusan",
    "tes jurusan",
  ],
  authors: [{ name: "MajorMatch Team" }],
  robots: "index, follow",
  openGraph: {
    title: "Major & Match — Rekomendasi Jurusan Kuliah",
    description: "Temukan jurusan kuliah yang paling cocok denganmu — cukup jawab beberapa pertanyaan.",
    type: "website",
    locale: "id_ID",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${nunito.variable} ${nunitoSans.variable}`}>
      <body suppressHydrationWarning>
        <a href="#main-content" className="skip-to-content">
          Langsung ke konten
        </a>
        <main id="main-content">
          <ErrorBoundaryWrapper>{children}</ErrorBoundaryWrapper>
        </main>
        <Analytics />
      </body>
    </html>
  );
}
