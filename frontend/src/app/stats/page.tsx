"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Loader2, ThumbsUp, ThumbsDown, BarChart2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface StatsData {
  total: number;
  rata_rating: number;
  item_feedback?: {
    total_likes: number;
    total_dislikes: number;
    like_ratio_percent: number;
  };
}

export default function StatsPage() {
  const router = useRouter();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  return (
    <div className="container" style={{ padding: "40px 20px" }}>
      <button 
        onClick={() => router.push("/")}
        style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: "var(--muted)", fontWeight: 700, cursor: "pointer", marginBottom: 24 }}
      >
        <ArrowLeft size={18} /> Kembali
      </button>

      <h1 style={{ fontFamily: "var(--font-nunito)", fontSize: "2rem", fontWeight: 900, color: "var(--blue)", marginBottom: 8 }}>
        Dashboard Evaluasi
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: 32 }}>
        Pantau performa dan tingkat kepuasan pengguna terhadap rekomendasi sistem.
      </p>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={40} className="animate-spin" color="var(--blue)" />
        </div>
      ) : data ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
            <div style={{ background: "white", padding: 20, borderRadius: 16, border: "2px solid #E2E8F0", boxShadow: "var(--shadow)" }}>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Total Sesi</div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--blue)" }}>{data.total}</div>
            </div>
            <div style={{ background: "white", padding: 20, borderRadius: 16, border: "2px solid #E2E8F0", boxShadow: "var(--shadow)" }}>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Rata-rata Rating</div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--yellow2)" }}>{data.rata_rating} ⭐</div>
            </div>
          </div>

          <h2 style={{ fontFamily: "var(--font-nunito)", fontSize: "1.4rem", fontWeight: 800, color: "var(--blue)", marginTop: 16 }}>
            Feedback Rekomendasi Jurusan
          </h2>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
            <div style={{ background: "#F0FDF4", padding: 20, borderRadius: 16, border: "2px solid #A7F3D0", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ background: "#D1FAE5", padding: 12, borderRadius: 12, color: "var(--green)" }}><ThumbsUp size={24} /></div>
              <div>
                <div style={{ color: "var(--green)", fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase" }}>Total Like</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--green)" }}>{data.item_feedback?.total_likes || 0}</div>
              </div>
            </div>
            
            <div style={{ background: "#FEF2F2", padding: 20, borderRadius: 16, border: "2px solid #FECACA", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ background: "#FEE2E2", padding: 12, borderRadius: 12, color: "var(--red)" }}><ThumbsDown size={24} /></div>
              <div>
                <div style={{ color: "var(--red)", fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase" }}>Total Dislike</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--red)" }}>{data.item_feedback?.total_dislikes || 0}</div>
              </div>
            </div>
            
            <div style={{ background: "#EEF2FF", padding: 20, borderRadius: 16, border: "2px solid #BFDBFE", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ background: "#DBEAFE", padding: 12, borderRadius: 12, color: "var(--blue)" }}><BarChart2 size={24} /></div>
              <div>
                <div style={{ color: "var(--blue)", fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase" }}>Like Ratio</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--blue)" }}>{data.item_feedback?.like_ratio_percent || 0}%</div>
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Gagal memuat data.</div>
      )}
    </div>
  );
}
