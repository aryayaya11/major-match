"use client";

import React, { useEffect, useState, use } from "react";
import { ArrowLeft, Loader2, Link as LinkIcon, Briefcase, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";

interface DetailData {
  jurusan: string;
  kategori: string;
  deskripsi: string;
  skills: string;
  karier: string;
  url: string;
  gaji: { min: number; max: number; currency: string };
  error?: string;
}

export default function Detail({ params }: { params: Promise<{ nama_jurusan: string }> }) {
  const router = useRouter();
  const { nama_jurusan } = use(params);
  const [data, setData] = useState<DetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const decodedName = decodeURIComponent(nama_jurusan);
        const res = await fetch(`/api/detail/${encodeURIComponent(decodedName)}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch detail: ${res.statusText}`);
        }
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [nama_jurusan]);

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-gradient)" }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", inset: -10, background: "var(--blue-light)", borderRadius: "50%", filter: "blur(20px)", animation: "pulse-glow 2s infinite" }} />
          <Loader2 size={48} className="animate-spin" style={{ color: "var(--blue)", position: "relative", zIndex: 1 }} />
        </div>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="glass-panel" style={{ margin: "40px auto", maxWidth: 400, padding: 40, textAlign: "center", color: "var(--muted)" }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>😢</div>
        <div style={{ fontFamily: "var(--font-nunito)", fontSize: "1.2rem", fontWeight: 800, marginBottom: 24 }}>Jurusan tidak ditemukan.</div>
        <button className="btn-primary" onClick={() => router.back()}>Kembali ke Menu</button>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: 600, margin: "0 auto", paddingBottom: 60, minHeight: "100vh" }}>
      {/* Top Bar */}
      <div style={{ padding: "20px", display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 100, background: "var(--glass-bg)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--glass-border)", boxShadow: "var(--shadow-sm)" }}>
        <button
          id="btn-back-detail"
          onClick={() => router.back()}
          style={{ width: 40, height: 40, background: "white", border: "1px solid #E2E8F0", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,.05)" }}
        >
          <ArrowLeft size={20} color="var(--text)" />
        </button>
        <div className="text-gradient" style={{ fontFamily: "var(--font-nunito)", fontSize: "1.3rem", fontWeight: 900 }}>Detail Jurusan</div>
      </div>

      <div style={{ padding: "0 20px" }}>
        {/* Header Card */}
        <div className="animate-slide-up" style={{ background: "linear-gradient(135deg, var(--blue), var(--purple))", borderRadius: 24, padding: "32px 24px", color: "white", marginBottom: 24, boxShadow: "0 12px 32px rgba(59,130,246,0.3)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, background: "rgba(255,255,255,0.1)", borderRadius: "50%", filter: "blur(20px)" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "inline-block", background: "rgba(255,255,255,.2)", borderRadius: 99, padding: "4px 14px", fontSize: "0.8rem", fontWeight: 800, marginBottom: 14, backdropFilter: "blur(8px)" }}>
              {data.kategori}
            </div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 900, marginBottom: 20, lineHeight: 1.3, textShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>{data.jurusan}</h1>
            
            <div style={{ display: "flex", gap: 16, background: "rgba(255,255,255,.15)", backdropFilter: "blur(10px)", borderRadius: 16, padding: "16px 20px", border: "1px solid rgba(255,255,255,0.2)" }}>
              <div>
                <div style={{ fontSize: "0.75rem", opacity: 0.9, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Estimasi Gaji</div>
                <div style={{ fontFamily: "var(--font-nunito)", fontSize: "1.2rem", fontWeight: 900, color: "var(--yellow)" }}>
                  {data.gaji.min} - {data.gaji.max} <span style={{ fontSize: "0.8rem", fontWeight: 800, opacity: 0.9, color: "white" }}>{data.gaji.currency}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div className="glass-panel" style={{ padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 900, marginBottom: 14, display: "flex", alignItems: "center", gap: 8, color: "var(--navy)" }}>
              <span style={{ fontSize: "1.4rem" }}>💡</span> Tentang Jurusan Ini
            </h2>
            <p style={{ color: "var(--muted)", lineHeight: 1.7, fontSize: "0.95rem" }}>{data.deskripsi}</p>
          </div>

          <div className="glass-panel" style={{ padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 900, marginBottom: 14, display: "flex", alignItems: "center", gap: 8, color: "var(--blue)" }}>
              <BookOpen size={22} color="var(--blue)" /> Skills yang Dipelajari
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {data.skills.split(",").map((s, i) => (
                <span key={i} style={{ background: "var(--blue-light)", color: "var(--blue2)", padding: "6px 14px", borderRadius: 99, fontSize: "0.85rem", fontWeight: 700 }}>
                  {s.trim()}
                </span>
              ))}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: 24, marginBottom: 28 }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 900, marginBottom: 14, display: "flex", alignItems: "center", gap: 8, color: "var(--green)" }}>
              <Briefcase size={22} color="var(--green)" /> Prospek Karier
            </h2>
            <p style={{ color: "var(--muted)", lineHeight: 1.7, fontSize: "0.95rem" }}>{data.karier}</p>
          </div>

          {data.url && (
            <a href={data.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              <button id="btn-kampushub-detail" className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <LinkIcon size={18} /> Baca Selengkapnya di KampusHub
              </button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
