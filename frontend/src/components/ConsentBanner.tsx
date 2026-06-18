"use client";

import React from "react";

interface ConsentBannerProps {
  accepted: boolean;
  onAccept: (accepted: boolean) => void;
}

export default function ConsentBanner({ accepted, onAccept }: ConsentBannerProps) {
  return (
    <div
      id="consent-banner"
      style={{
        width: "100%",
        background: "linear-gradient(135deg, rgba(59, 130, 246, 0.04) 0%, rgba(139, 92, 246, 0.04) 100%)",
        border: "1.5px solid rgba(59, 130, 246, 0.15)",
        borderRadius: 16,
        padding: "16px 18px",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-nunito)",
          fontSize: "0.82rem",
          fontWeight: 900,
          color: "#2563EB",
          textTransform: "uppercase",
          letterSpacing: 0.8,
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        📋 Persetujuan Pengumpulan Data
      </div>
      <p
        style={{
          fontSize: "0.78rem",
          color: "#64748B",
          lineHeight: 1.55,
          marginBottom: 12,
        }}
      >
        Dengan melanjutkan, kamu menyetujui bahwa data yang kamu berikan (jawaban kuis, data demografi, dan feedback)
        akan dikumpulkan secara <strong>anonim</strong> untuk keperluan <strong>penelitian akademik</strong> dan
        peningkatan akurasi sistem rekomendasi. Data tidak akan dibagikan kepada pihak ketiga.{" "}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#2563EB", fontWeight: 700, textDecoration: "underline" }}
        >
          Baca Kebijakan Privasi →
        </a>
      </p>
      <label
        htmlFor="consent-checkbox"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          padding: "10px 14px",
          background: accepted ? "rgba(16, 185, 129, 0.08)" : "white",
          border: `2px solid ${accepted ? "#10B981" : "#E2E8F0"}`,
          borderRadius: 12,
          transition: "all 0.2s",
        }}
      >
        <input
          type="checkbox"
          id="consent-checkbox"
          checked={accepted}
          onChange={(e) => onAccept(e.target.checked)}
          style={{
            width: 20,
            height: 20,
            accentColor: "#10B981",
            cursor: "pointer",
          }}
          aria-label="Setuju dengan pengumpulan data untuk penelitian"
        />
        <span
          style={{
            fontSize: "0.82rem",
            fontWeight: 700,
            color: accepted ? "#059669" : "#64748B",
          }}
        >
          Saya setuju data saya digunakan untuk penelitian
        </span>
      </label>
    </div>
  );
}
