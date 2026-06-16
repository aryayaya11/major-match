"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Search, Loader2, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface JurusanData {
  jurusan: string;
  kategori: string;
  karier?: string;
  skor: number;
}

interface DetailJurusanData {
  jurusan: string;
  kategori: string;
  gaji: {
    min: number;
    max: number;
    currency: string;
  };
  skills: string;
  deskripsi: string;
  karier: string;
}

const ICON_MAP: Record<string, string> = {
  "Komputer & Informatika": "💻",
  "Matematika & IPA": "🔬",
  "Ekonomi & Bisnis": "📈",
  "Ilmu Teknik & Industri": "⚙️",
  "Kesehatan & Ilmu Keolahragaan": "🏥",
  "Ilmu Sosial, Hukum & Politik": "⚖️",
  "Ilmu Pendidikan & Agama Islam": "📚",
  "Seni, Desain & Musik": "🎨",
  "Sipil & Bangunan": "🏗️",
  "Pertanian": "🌾",
  "Kelautan & Perikanan": "🐟",
  "Filsafat & Ilmu Budaya": "🎭",
  "Geografi & Kebumian": "🌍",
  "Pariwisata & Perhotelan": "🏨",
  "Kehutanan & Peternakan": "🌲",
  "Kedinasan & Lainnya": "🏛️",
};

const INTEREST_MAP: Record<string, { label: string; categories: string[] }> = {
  stem: {
    label: "Teknologi & Sains (STEM)",
    categories: ['Komputer & Informatika', 'Matematika & IPA', 'Ilmu Teknik & Industri', 'Sipil & Bangunan']
  },
  bisnis: {
    label: "Bisnis & Keuangan",
    categories: ['Ekonomi & Bisnis', 'Pariwisata & Perhotelan']
  },
  kreatif: {
    label: "Kreatif & Seni",
    categories: ['Seni, Desain & Musik']
  },
  sosial: {
    label: "Sosial & Hukum",
    categories: ['Ilmu Sosial, Hukum & Politik', 'Ilmu Pendidikan & Agama Islam', 'Filsafat & Ilmu Budaya', 'Kedinasan & Lainnya']
  },
  kesehatan: {
    label: "Kesehatan & Medis",
    categories: ['Kesehatan & Ilmu Keolahragaan']
  },
  lingkungan: {
    label: "Lingkungan & Alam",
    categories: ['Pertanian', 'Kelautan & Perikanan', 'Geografi & Kebumian', 'Kehutanan & Peternakan']
  }
};

export default function Explore() {
  const router = useRouter();
  const [categories, setCategories] = useState<string[]>([]);
  const [activeKat, setActiveKat] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [allData, setAllData] = useState<JurusanData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Compare states
  const [compareList, setCompareList] = useState<string[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareData, setCompareData] = useState<DetailJurusanData[]>([]);
  const [isCompareLoading, setIsCompareLoading] = useState(false);

  // Interest filter state
  const [activeInterest, setActiveInterest] = useState<string | null>(null);

  const toggleCompare = (major: string) => {
    setCompareList(prev => {
      if (prev.includes(major)) {
        return prev.filter(m => m !== major);
      }
      if (prev.length >= 2) {
        alert("Kamu hanya bisa membandingkan maksimal 2 jurusan!");
        return prev;
      }
      return [...prev, major];
    });
  };

  const startComparison = async () => {
    if (compareList.length !== 2) return;
    setCompareModalOpen(true);
    setIsCompareLoading(true);
    try {
      const fetches = compareList.map(major => 
        fetch(`/api/detail/${encodeURIComponent(major)}`).then(res => {
          if (!res.ok) throw new Error("Gagal mengambil data");
          return res.json();
        })
      );
      const results = await Promise.all(fetches);
      setCompareData(results);
    } catch (e) {
      console.error(e);
      alert("Gagal memuat data perbandingan.");
      setCompareModalOpen(false);
    } finally {
      setIsCompareLoading(false);
    }
  };

  const clearCompare = () => {
    setCompareList([]);
    setCompareData([]);
  };

  useEffect(() => {
    const init = async () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const interest = params.get("interest");
        if (interest) {
          setActiveInterest(interest);
        }
      }
      try {
        let likedTags = [];
        if (typeof window !== "undefined") {
          const savedSession = localStorage.getItem("major_match_session");
          if (savedSession) {
            try {
              const parsed = JSON.parse(savedSession);
              if (parsed.likedTags) likedTags = parsed.likedTags;
            } catch (e) {
              console.error(e);
            }
          }
        }

        const [katRes, dataRes] = await Promise.all([
          fetch("/api/kategori"),
          fetch("/api/explore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ liked_tags: likedTags }),
          }),
        ]);
        if (!katRes.ok || !dataRes.ok) {
          throw new Error("Failed to fetch data from API proxy. Is the Flask backend running?");
        }
        const katData = await katRes.json();
        const dataJson = await dataRes.json();
        setCategories(["Semua", ...(katData.kategori || [])]);
        setAllData(dataJson.jurusan || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const filtered = allData.filter((j) => {
    if (activeInterest && INTEREST_MAP[activeInterest]) {
      const allowedCategories = INTEREST_MAP[activeInterest].categories;
      if (!allowedCategories.includes(j.kategori)) {
        return false;
      }
    }
    const matchKat = activeKat === "Semua" || j.kategori === activeKat;
    const matchQ = !searchQuery || j.jurusan.toLowerCase().includes(searchQuery.toLowerCase()) || j.kategori.toLowerCase().includes(searchQuery.toLowerCase());
    return matchKat && matchQ;
  });

  return (
    <div style={{ width: "100%", maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Top Bar */}
      <div style={{ 
        position: "sticky", 
        top: 0, 
        zIndex: 100, 
        padding: "16px 20px 8px", 
        background: "rgba(248, 250, 252, 0.4)", 
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}>
        <div className="glass" style={{ 
          padding: "16px 20px",
          borderRadius: "24px",
          boxShadow: "var(--shadow)",
          border: "1px solid var(--glass-border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
            <button
              id="btn-back-home"
              onClick={() => router.back()}
              style={{ 
                width: 38, 
                height: 38, 
                background: "white", 
                border: "1px solid #E2E8F0", 
                color: "var(--text)", 
                borderRadius: "50%", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                cursor: "pointer", 
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                transition: "transform 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
              <ArrowLeft size={18} />
            </button>
            <div className="text-gradient" style={{ fontFamily: "var(--font-nunito)", fontSize: "1.25rem", fontWeight: 900, flex: 1 }}>Explore Jurusan</div>
          </div>
          <div style={{ position: "relative" }}>
            <Search size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              type="text"
              id="input-search-explore"
              placeholder="Cari jurusan kuliah..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-vibrant"
              style={{ 
                paddingLeft: 46,
                paddingRight: searchQuery ? 40 : 16,
                borderRadius: "16px",
                height: "46px",
                background: "rgba(255,255,255,0.9)",
                fontSize: "0.95rem"
              }}
            />
            {searchQuery && (
              <button
                id="btn-clear-search"
                className="clear-search-btn"
                onClick={() => setSearchQuery("")}
                title="Hapus pencarian"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {activeInterest && INTEREST_MAP[activeInterest] && (
        <div className="glass" style={{ 
          margin: "16px 20px 0", 
          padding: "14px 20px", 
          borderLeft: "4px solid var(--blue)", 
          borderRadius: "16px", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between",
          boxShadow: "var(--shadow-sm)"
        }}>
          <span style={{ fontSize: "0.88rem", color: "var(--navy)", fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
            🎯 Minat: <strong className="text-gradient" style={{ fontWeight: 900 }}>{INTEREST_MAP[activeInterest].label}</strong>
          </span>
          <button 
            id="btn-clear-interest-filter"
            onClick={() => {
              setActiveInterest(null);
              setActiveKat("Semua");
            }}
            style={{ 
              background: "rgba(239, 68, 68, 0.08)", 
              border: "1px solid rgba(239, 68, 68, 0.15)", 
              borderRadius: "99px",
              padding: "4px 12px",
              color: "var(--red)", 
              fontSize: "0.78rem", 
              fontWeight: 900, 
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--red)";
              e.currentTarget.style.color = "white";
              e.currentTarget.style.borderColor = "transparent";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
              e.currentTarget.style.color = "var(--red)";
              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.15)";
            }}
          >
            ✕ Hapus
          </button>
        </div>
      )}

      {/* Categories */}
      <div style={{ padding: "16px 20px", overflowX: "auto", display: "flex", gap: 10, scrollbarWidth: "none", flexShrink: 0 }}>
        {(activeInterest && INTEREST_MAP[activeInterest]
          ? ["Semua", ...INTEREST_MAP[activeInterest].categories]
          : categories
        ).map((c) => (
          <button
            key={c}
            id={`btn-category-${c.replace(/\s+/g, '-').toLowerCase()}`}
            onClick={() => setActiveKat(c)}
            style={{
              whiteSpace: "nowrap", padding: "8px 18px", borderRadius: 99, 
              border: activeKat === c ? "1px solid transparent" : "1px solid rgba(0,0,0,0.06)",
              background: activeKat === c ? "linear-gradient(135deg, var(--blue), var(--purple))" : "white",
              color: activeKat === c ? "white" : "var(--muted)",
              boxShadow: activeKat === c ? "0 4px 12px rgba(59,130,246,.3)" : "0 2px 6px rgba(0,0,0,0.02)",
              fontFamily: "var(--font-nunito)", fontSize: "0.85rem", fontWeight: 800, cursor: "pointer", transition: "all .2s cubic-bezier(0.4, 0, 0.2, 1)"
            }}
            onMouseEnter={(e) => {
              if (activeKat !== c) {
                e.currentTarget.style.borderColor = "var(--blue)";
                e.currentTarget.style.color = "var(--blue2)";
              }
            }}
            onMouseLeave={(e) => {
              if (activeKat !== c) {
                e.currentTarget.style.borderColor = "rgba(0,0,0,0.06)";
                e.currentTarget.style.color = "var(--muted)";
              }
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ padding: "4px 20px 100px", flex: 1, overflowY: "auto" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
          {filtered.length} JURUSAN DITEMUKAN
        </div>

        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontFamily: "var(--font-nunito)", fontWeight: 800 }}>
            <Loader2 size={40} className="animate-spin" style={{ margin: "0 auto 12px", color: "var(--blue)" }} />
            Meracik daftar jurusan...
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass" style={{ textAlign: "center", padding: 32, color: "var(--muted)", borderRadius: 20 }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🔍</div>
            <div>Jurusan tidak ditemukan. Silakan gunakan filter atau pencarian lain.</div>
          </div>
        ) : (
          filtered.map((j, i) => {
            const matchPercentage = j.skor > 0 ? Math.min(Math.round(j.skor * 300), 99) : 0;
            const isSelected = compareList.includes(j.jurusan);
            
            // Dynamic Match Badge styling
            let matchColor = "var(--muted)";
            let matchBg = "rgba(0,0,0,0.04)";
            let matchBorder = "rgba(0,0,0,0.06)";
            let matchEmoji = "✨";
            
            if (matchPercentage >= 80) {
              matchColor = "var(--green)";
              matchBg = "var(--green-light)";
              matchBorder = "rgba(16, 185, 129, 0.2)";
              matchEmoji = "🔥";
            } else if (matchPercentage >= 50) {
              matchColor = "var(--blue2)";
              matchBg = "var(--blue-light)";
              matchBorder = "rgba(59, 130, 246, 0.2)";
              matchEmoji = "⚡";
            }
            
            return (
              <Link key={i} href={`/detail/${encodeURIComponent(j.jurusan)}`} style={{ textDecoration: "none", color: "inherit" }} id={`major-link-${j.jurusan.replace(/\s+/g, '-').toLowerCase()}`}>
                <div 
                  className="glass animate-slide-up major-card" 
                  style={{
                    padding: "16px 18px", 
                    marginBottom: 14,
                    display: "flex", 
                    flexDirection: "column",
                    gap: 12, 
                    animationDelay: `${Math.min(i * 0.05, 0.5)}s`,
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "20px",
                    boxShadow: "var(--shadow-sm)"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = "var(--shadow)";
                    e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                    e.currentTarget.style.borderColor = "var(--glass-border)";
                  }}
                >
                  {/* Top info area */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ 
                      width: 48, 
                      height: 48, 
                      borderRadius: 14, 
                      background: "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)", 
                      border: "1px solid rgba(59, 130, 246, 0.1)",
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      fontSize: "1.35rem", 
                      flexShrink: 0, 
                      boxShadow: "inset 0 2px 4px rgba(255,255,255,0.6)" 
                    }}>
                      {ICON_MAP[j.kategori] || "📖"}
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                        <h3 style={{ 
                          fontFamily: "var(--font-nunito)", 
                          fontSize: "1.05rem", 
                          fontWeight: 900, 
                          color: "var(--navy)",
                          margin: 0,
                          lineHeight: 1.3,
                          wordBreak: "break-word"
                        }}>
                          {j.jurusan}
                        </h3>
                        {matchPercentage > 0 && (
                          <span style={{
                            fontFamily: "var(--font-nunito)",
                            fontSize: "0.68rem",
                            fontWeight: 900,
                            color: matchColor,
                            background: matchBg,
                            padding: "2px 6px",
                            borderRadius: 6,
                            border: `1px solid ${matchBorder}`,
                            flexShrink: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 2,
                            boxShadow: "0 2px 4px rgba(0,0,0,0.01)"
                          }}>
                            {matchEmoji} {matchPercentage}%
                          </span>
                        )}
                      </div>
                      <div>
                        <span style={{ 
                          display: "inline-block", 
                          background: "rgba(0, 0, 0, 0.03)", 
                          border: "1px solid rgba(0, 0, 0, 0.04)", 
                          color: "var(--muted)", 
                          borderRadius: 99, 
                          padding: "2px 10px", 
                          fontSize: "0.7rem", 
                          fontWeight: 800 
                        }}>
                          {j.kategori}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Career tags section */}
                  {j.karier && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      {j.karier.split(",").slice(0, 3).map((kar, idx) => {
                        const trimmedKar = kar.trim();
                        return (
                          <button
                            key={idx}
                            id={`btn-career-badge-${i}-${idx}`}
                            className="career-badge"
                            style={{
                              fontSize: "0.7rem",
                              padding: "3px 8px",
                              borderRadius: "8px"
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSearchQuery(trimmedKar);
                            }}
                          >
                            💼 {trimmedKar}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Bottom divider and action buttons */}
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between", 
                    marginTop: 4, 
                    paddingTop: 10, 
                    borderTop: "1px solid rgba(0, 0, 0, 0.04)" 
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--blue2)", fontSize: "0.78rem", fontWeight: 800 }}>
                      Lihat Detail <ChevronRight size={14} className="detail-arrow" />
                    </div>
                    
                    <button
                      id={`btn-compare-${j.jurusan.replace(/\s+/g, '-').toLowerCase()}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleCompare(j.jurusan);
                      }}
                      style={{
                        background: isSelected ? "linear-gradient(135deg, var(--blue), var(--blue2))" : "rgba(0,0,0,0.03)",
                        border: `1px solid ${isSelected ? "transparent" : "rgba(0,0,0,0.08)"}`,
                        color: isSelected ? "white" : "var(--muted)",
                        borderRadius: 10,
                        padding: "6px 12px",
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        boxShadow: isSelected ? "0 4px 10px rgba(59,130,246,0.15)" : "none",
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = "var(--blue-light)";
                          e.currentTarget.style.color = "var(--blue2)";
                          e.currentTarget.style.borderColor = "var(--blue)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = "rgba(0,0,0,0.03)";
                          e.currentTarget.style.color = "var(--muted)";
                          e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)";
                        }
                      }}
                    >
                      {isSelected ? "✓ Terpilih" : "⚖️ Bandingkan"}
                    </button>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* FLOATING COMPARE BAR */}
      {compareList.length > 0 && (
        <div className="compare-floating-bar animate-slide-up" id="compare-floating-bar-explore">
          <div className="compare-bar-text">
            ⚖️ Bandingkan ({compareList.length}/2 terpilih)
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button 
              id="btn-cancel-compare-explore"
              className="btn-secondary" 
              style={{ padding: "6px 12px", width: "auto", fontSize: "0.8rem" }} 
              onClick={clearCompare}
            >
              Batal
            </button>
            <button 
              id="btn-floating-compare-explore"
              className="compare-bar-btn" 
              disabled={compareList.length !== 2} 
              style={{ opacity: compareList.length === 2 ? 1 : 0.5, cursor: compareList.length === 2 ? "pointer" : "not-allowed" }}
              onClick={startComparison}
            >
              Bandingkan
            </button>
          </div>
        </div>
      )}

      {/* COMPARISON MODAL */}
      {compareModalOpen && (
        <div className="compare-modal-overlay" onClick={() => setCompareModalOpen(false)} id="compare-modal-overlay-explore">
          <div className="compare-modal-content animate-slide-up" onClick={(e) => e.stopPropagation()} id="compare-modal-content-explore">
            <div className="compare-modal-header">
              <div className="compare-modal-title">⚖️ Perbandingan Jurusan</div>
              <button className="compare-modal-close" onClick={() => setCompareModalOpen(false)} id="btn-close-compare-modal-explore">✕</button>
            </div>
            <div className="compare-modal-body">
              {isCompareLoading ? (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <Loader2 size={40} className="animate-spin" style={{ margin: "0 auto 12px", color: "var(--blue)" }} />
                  Memuat data perbandingan...
                </div>
              ) : compareData.length === 2 ? (
                (() => {
                  const skillsA = compareData[0]?.skills ? compareData[0].skills.split(",").map((s: string) => s.trim()) : [];
                  const skillsB = compareData[1]?.skills ? compareData[1].skills.split(",").map((s: string) => s.trim()) : [];
                  const skillsALower = skillsA.map((s: string) => s.toLowerCase());
                  const skillsBLower = skillsB.map((s: string) => s.toLowerCase());

                  return (
                    <div className="compare-grid">
                      {/* Jurusan 1 */}
                      <div className="compare-box" id="compare-box-major-1-explore">
                        <div className="compare-val bold">{compareData[0].jurusan}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 800 }}>{compareData[0].kategori}</div>
                      </div>
                      {/* Jurusan 2 */}
                      <div className="compare-box" id="compare-box-major-2-explore">
                        <div className="compare-val bold">{compareData[1].jurusan}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 800 }}>{compareData[1].kategori}</div>
                      </div>

                      {/* Estimasi Gaji */}
                      <div className="compare-section">
                        <div className="compare-section-title">Estimasi Gaji</div>
                      </div>
                      <div className="compare-box" id="compare-salary-box-1-explore">
                        <div className="compare-val bold" style={{ color: "var(--yellow2)", fontSize: "1.05rem" }}>
                          {compareData[0].gaji.min} - {compareData[0].gaji.max}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginBottom: 4 }}>{compareData[0].gaji.currency}</div>
                        
                        <div className="salary-bar-container" title={`Rentang Gaji: ${compareData[0].gaji.min} - ${compareData[0].gaji.max} juta/bulan`}>
                          <div 
                            className="salary-bar-fill" 
                            style={{ 
                              left: `${(compareData[0].gaji.min / 30) * 100}%`, 
                              width: `${((compareData[0].gaji.max - compareData[0].gaji.min) / 30) * 100}%` 
                            }} 
                          />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", color: "var(--muted)", marginTop: 2 }}>
                          <span>0</span>
                          <span>15jt</span>
                          <span>30jt</span>
                        </div>
                      </div>
                      <div className="compare-box" id="compare-salary-box-2-explore">
                        <div className="compare-val bold" style={{ color: "var(--yellow2)", fontSize: "1.05rem" }}>
                          {compareData[1].gaji.min} - {compareData[1].gaji.max}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginBottom: 4 }}>{compareData[1].gaji.currency}</div>
                        
                        <div className="salary-bar-container" title={`Rentang Gaji: ${compareData[1].gaji.min} - ${compareData[1].gaji.max} juta/bulan`}>
                          <div 
                            className="salary-bar-fill" 
                            style={{ 
                              left: `${(compareData[1].gaji.min / 30) * 100}%`, 
                              width: `${((compareData[1].gaji.max - compareData[1].gaji.min) / 30) * 100}%` 
                            }} 
                          />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", color: "var(--muted)", marginTop: 2 }}>
                          <span>0</span>
                          <span>15jt</span>
                          <span>30jt</span>
                        </div>
                      </div>

                      {/* Skills */}
                      <div className="compare-section">
                        <div className="compare-section-title">Skills yang Dipelajari</div>
                      </div>
                      <div className="compare-box" id="compare-skills-box-1-explore">
                        <div className="compare-val" style={{ fontSize: "0.8rem", display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {skillsA.map((s: string, idx: number) => {
                            const isUnique = !skillsBLower.includes(s.toLowerCase());
                            return (
                              <span 
                                key={idx} 
                                className={isUnique ? "skill-badge-unique" : "skill-badge-common"}
                                title={isUnique ? "Keahlian unik jurusan ini!" : "Keahlian umum kedua jurusan"}
                              >
                                {s} {isUnique && "⭐"}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="compare-box" id="compare-skills-box-2-explore">
                        <div className="compare-val" style={{ fontSize: "0.8rem", display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {skillsB.map((s: string, idx: number) => {
                            const isUnique = !skillsALower.includes(s.toLowerCase());
                            return (
                              <span 
                                key={idx} 
                                className={isUnique ? "skill-badge-unique" : "skill-badge-common"}
                                title={isUnique ? "Keahlian unik jurusan ini!" : "Keahlian umum kedua jurusan"}
                              >
                                {s} {isUnique && "⭐"}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Deskripsi */}
                      <div className="compare-section">
                        <div className="compare-section-title">Tentang Jurusan</div>
                      </div>
                      <div className="compare-box" id="compare-desc-box-1-explore">
                        <div className="compare-val" style={{ fontSize: "0.78rem" }}>{compareData[0].deskripsi}</div>
                      </div>
                      <div className="compare-box" id="compare-desc-box-2-explore">
                        <div className="compare-val" style={{ fontSize: "0.78rem" }}>{compareData[1].deskripsi}</div>
                      </div>

                      {/* Prospek Karir */}
                      <div className="compare-section">
                        <div className="compare-section-title">Prospek Karier</div>
                      </div>
                      <div className="compare-box" id="compare-career-box-1-explore">
                        <div className="compare-val" style={{ fontSize: "0.78rem" }}>{compareData[0].karier}</div>
                      </div>
                      <div className="compare-box" id="compare-career-box-2-explore">
                        <div className="compare-val" style={{ fontSize: "0.78rem" }}>{compareData[1].karier}</div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div style={{ textAlign: "center", padding: 20 }}>Terjadi kesalahan saat memuat perbandingan.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
