"use client";

import React from "react";
import { ArrowLeft, Shield, Database, Lock, Trash2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PrivacyPage() {
  const router = useRouter();

  const sections = [
    {
      icon: <Database size={22} color="var(--blue)" />,
      title: "Data yang Kami Kumpulkan",
      content: [
        "Data demografi dasar (gender, kelas, jurusan SMA) — untuk analisis statistik",
        "Jawaban kuis dan waktu respons — untuk mengukur akurasi sistem rekomendasi",
        "Feedback dan rating — untuk meningkatkan kualitas rekomendasi",
        "Jurusan impian dan jurusan diminati — sebagai ground truth penelitian",
        "Nama (opsional) — digunakan sebagai identifikasi selama sesi kuis saja",
      ],
    },
    {
      icon: <Shield size={22} color="var(--green)" />,
      title: "Bagaimana Kami Menggunakan Data",
      content: [
        "Seluruh data digunakan secara anonim untuk penelitian akademik",
        "Mengukur akurasi dan validitas sistem rekomendasi jurusan",
        "Meningkatkan algoritma pencocokan jurusan berdasarkan minat",
        "Data TIDAK digunakan untuk tujuan komersial",
        "Data TIDAK dijual atau dibagikan kepada pihak ketiga",
      ],
    },
    {
      icon: <Lock size={22} color="var(--purple)" />,
      title: "Keamanan Data",
      content: [
        "Data disimpan di server terenkripsi (PostgreSQL di Railway)",
        "Akses ke data mentah dibatasi hanya untuk tim peneliti",
        "Endpoint ekspor data dilindungi dengan API key",
        "Nama pengguna di-pseudonymize dalam laporan dan statistik",
      ],
    },
    {
      icon: <Trash2 size={22} color="var(--red)" />,
      title: "Hak Pengguna",
      content: [
        "Kamu berhak menolak pengumpulan data dengan tidak mencentang persetujuan",
        "Kamu berhak meminta penghapusan data dengan menghubungi tim peneliti",
        "Data akan dihapus setelah periode penelitian selesai",
        "Kamu bisa menggunakan kuis tanpa memberikan nama asli",
      ],
    },
    {
      icon: <Mail size={22} color="var(--yellow2)" />,
      title: "Kontak",
      content: [
        "Untuk pertanyaan terkait privasi, hubungi tim pengembang melalui repository GitHub project ini.",
        "Terakhir diperbarui: Juni 2026",
      ],
    },
  ];

  return (
    <div style={{ width: "100%", maxWidth: 600, margin: "0 auto", paddingBottom: 60, minHeight: "100vh" }}>
      {/* Top Bar */}
      <div
        style={{
          padding: "20px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "var(--glass-bg)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--glass-border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <button
          id="btn-back-privacy"
          onClick={() => router.back()}
          aria-label="Kembali ke halaman sebelumnya"
          style={{
            width: 40,
            height: 40,
            background: "white",
            border: "1px solid #E2E8F0",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,.05)",
          }}
        >
          <ArrowLeft size={20} color="var(--text)" />
        </button>
        <div
          className="text-gradient"
          style={{ fontFamily: "var(--font-nunito)", fontSize: "1.3rem", fontWeight: 900 }}
        >
          Kebijakan Privasi
        </div>
      </div>

      <div style={{ padding: "0 20px" }}>
        {/* Header */}
        <div
          className="animate-slide-up"
          style={{
            background: "linear-gradient(135deg, var(--blue), var(--purple))",
            borderRadius: 24,
            padding: "32px 24px",
            color: "white",
            marginBottom: 24,
            boxShadow: "0 12px 32px rgba(59,130,246,0.3)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -20,
              right: -20,
              width: 100,
              height: 100,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "50%",
              filter: "blur(20px)",
            }}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔒</div>
            <h1
              style={{
                fontSize: "1.6rem",
                fontWeight: 900,
                marginBottom: 12,
                lineHeight: 1.3,
              }}
            >
              Kebijakan Privasi MajorMatch
            </h1>
            <p style={{ fontSize: "0.9rem", opacity: 0.9, lineHeight: 1.6 }}>
              Kami berkomitmen melindungi privasi dan data pribadi pengguna. Halaman ini menjelaskan bagaimana
              kami mengumpulkan, menggunakan, dan melindungi data Anda.
            </p>
          </div>
        </div>

        {/* Sections */}
        {sections.map((section, idx) => (
          <div
            key={idx}
            className="glass-panel animate-slide-up"
            style={{
              padding: 24,
              marginBottom: 20,
              animationDelay: `${idx * 0.1}s`,
            }}
          >
            <h2
              style={{
                fontSize: "1.1rem",
                fontWeight: 900,
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: "var(--navy)",
              }}
            >
              {section.icon}
              {section.title}
            </h2>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              {section.content.map((item, i) => (
                <li
                  key={i}
                  style={{
                    color: "var(--muted)",
                    lineHeight: 1.7,
                    fontSize: "0.9rem",
                    marginBottom: 6,
                  }}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
