
"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Loader2, ThumbsUp, ThumbsDown, BarChart2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface FeedbackDetail {
  id: number;
  nama: string;
  liked_tags: string;
  hasil: string[];
  rating: number;
  komentar: string;
  web_rating: number;
  web_komentar: string;
  timestamp: string | null;
}

interface StatsData {
  total: number;
  rata_rating: number;
  rata_rating_web?: number;
  detail?: FeedbackDetail[];
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
              <div style={{ color: "var(--muted)", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Rating Rekomendasi</div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--yellow2)" }}>{data.rata_rating} ⭐</div>
            </div>
            <div style={{ background: "white", padding: 20, borderRadius: 16, border: "2px solid #E2E8F0", boxShadow: "var(--shadow)" }}>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Rating Website</div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--yellow2)" }}>{data.rata_rating_web ?? 0} ⭐</div>
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

          {data.detail && data.detail.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h2 style={{ fontFamily: "var(--font-nunito)", fontSize: "1.4rem", fontWeight: 800, color: "var(--blue)", marginBottom: 16 }}>
                Feedback Terbaru
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {data.detail.map((item) => (
                  <div key={item.id} style={{ background: "white", padding: 20, borderRadius: 16, border: "2px solid #E2E8F0", boxShadow: "var(--shadow)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontWeight: 800, color: "var(--navy)" }}>{item.nama}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        {item.timestamp ? new Date(item.timestamp).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, background: "#F8FAFC", padding: 12, borderRadius: 12 }}>
                      <div>
                        <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--blue2)", marginBottom: 4 }}>1. Rekomendasi Jurusan</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>{item.rating}</span>
                          <span style={{ color: "var(--yellow2)" }}>{"⭐".repeat(item.rating)}</span>
                        </div>
                        {item.komentar ? (
                          <p style={{ fontSize: "0.8rem", color: "var(--text)", margin: 0, fontStyle: "italic" }}>&ldquo;{item.komentar}&rdquo;</p>
                        ) : (
                          <span style={{ fontSize: "0.78rem", color: "var(--muted)", fontStyle: "italic" }}>Tidak ada komentar</span>
                        )}
                        {item.hasil && item.hasil.length > 0 && (
                          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 6 }}>
                            <strong>Rekomendasi:</strong> {item.hasil.filter(Boolean).join(", ")}
                          </div>
                        )}
                      </div>

                      <div style={{ borderLeft: "1px dashed #E2E8F0", paddingLeft: 16 }}>
                        <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--blue2)", marginBottom: 4 }}>2. Penggunaan Website</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>{item.web_rating}</span>
                          <span style={{ color: "var(--yellow2)" }}>{"⭐".repeat(item.web_rating)}</span>
                        </div>
                        {item.web_komentar ? (
                          <p style={{ fontSize: "0.8rem", color: "var(--text)", margin: 0, fontStyle: "italic" }}>&ldquo;{item.web_komentar}&rdquo;</p>
                        ) : (
                          <span style={{ fontSize: "0.78rem", color: "var(--muted)", fontStyle: "italic" }}>Tidak ada komentar</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Gagal memuat data.</div>
      )}
    </div>
  );
}
