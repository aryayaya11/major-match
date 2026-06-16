import type { Metadata } from "next";
import { Nunito, Nunito_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

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
  title: "Major & Match - Rekomendasi Jurusan Kuliah Akurat",
  description: "Temukan jurusan kuliah yang paling cocok dengan minat dan kepribadianmu menggunakan analisis AI interaktif.",
  keywords: ["jurusan kuliah", "rekomendasi jurusan", "tes minat bakat", "kalkulator jurusan", "karir", "mahasiswa baru", "major match"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${nunito.variable} ${nunitoSans.variable}`}>
      <body suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
