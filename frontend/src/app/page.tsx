"use client";

import React, { useState, useEffect, useRef } from "react";
import SwipeCard, { CardData } from "@/components/SwipeCard";
import { Loader2, CheckCircle2, Search, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

type ScreenState = "landing" | "onboarding" | "swipe" | "loading" | "result";

interface SwipeResult {
  id: string;
  liked: boolean;
}

interface Recommendation {
  jurusan: string;
  kategori: string;
  skor: number;
  skills: string;
  karier: string;
  deskripsi: string;
  url: string;
  alasan?: string;
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

interface QuizSessionState {
  userName: string;
  history: SwipeResult[];
  likedTags: string[];
  dislikedTags: string[];
  results: Recommendation[];
  screen: ScreenState;
  sessionId: string;
  isLowConfidence: boolean;
  swipeStatus: string;
  total: number;
  transitionModalOpen?: boolean;
  transitionRumpun?: string;
  transitionRumpunId?: string;
  webRating?: number;
  webComment?: string;
  // Beta testing fields
  onboardingData?: OnboardingData;
  questionTimings?: Record<string, number>;
  betaFeedbackSent?: boolean;
}

interface OnboardingData {
  gender: string;
  kelas: string;
  jurusan_sma: string;
  provinsi: string;
  tipe_sekolah: string;
  jurusan_impian: string;
  jurusan_diminati_1: string;
  jurusan_diminati_2: string;
  jurusan_diminati_3: string;
  tingkat_keyakinan: number;
  sudah_riset: boolean;
  sumber_info: string[];
}

interface InterestCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  percentage: number;
}

// Per-jurusan feedback
interface PerJurusanFeedback {
  rating_tertarik: number;
  pertimbangkan: boolean | null;
  sudah_tahu: boolean | null;
}

const calculateInterestProfile = (tags: string[]): InterestCategory[] => {
  const categories = [
    {
      id: "stem",
      name: "Teknologi & Sains (STEM)",
      icon: "💻",
      color: "linear-gradient(90deg, #3B82F6, #6366F1)",
      keywords: ['komputer', 'informatika', 'matematika', 'sains', 'teknik', 'robotika', 'coding', 'data', 'statistik', 'elektro', 'mesin', 'kimia', 'biologi', 'fisika', 'laboratorium', 'logic', 'logika', 'analisis data']
    },
    {
      id: "bisnis",
      name: "Bisnis & Keuangan",
      icon: "📈",
      color: "linear-gradient(90deg, #10B981, #059669)",
      keywords: ['ekonomi', 'bisnis', 'keuangan', 'marketing', 'manajemen', 'akuntansi', 'investasi', 'wirausaha', 'saham', 'pasar', 'jual']
    },
    {
      id: "kreatif",
      name: "Kreatif & Seni",
      icon: "🎨",
      color: "linear-gradient(90deg, #EC4899, #F43F5E)",
      keywords: ['seni', 'desain', 'musik', 'kreatif', 'film', 'gambar', 'menulis', 'arsitektur', 'fashion', 'visual', 'sastra', 'budaya']
    },
    {
      id: "sosial",
      name: "Sosial & Hukum",
      icon: "⚖️",
      color: "linear-gradient(90deg, #8B5CF6, #6D28D9)",
      keywords: ['sosial', 'hukum', 'politik', 'komunikasi', 'sejarah', 'psikologi', 'sosiologi', 'bahasa', 'hubungan internasional', 'masyarakat', 'publik']
    },
    {
      id: "kesehatan",
      name: "Kesehatan & Medis",
      icon: "🏥",
      color: "linear-gradient(90deg, #EF4444, #DC2626)",
      keywords: ['kesehatan', 'medis', 'kedokteran', 'farmasi', 'keperawatan', 'olahraga', 'gizi', 'klinis', 'obat', 'tubuh']
    },
    {
      id: "lingkungan",
      name: "Lingkungan & Alam",
      icon: "🌿",
      color: "linear-gradient(90deg, #10B981, #84CC16)",
      keywords: ['pertanian', 'perikanan', 'kelautan', 'kehutanan', 'lingkungan', 'geografi', 'hewan', 'tanaman', 'alam', 'bumi', 'tanah']
    }
  ];

  if (tags.length === 0) {
    return categories.map(c => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, percentage: 0 }));
  }

  const counts = categories.map(cat => {
    let count = 0;
    tags.forEach(t => {
      const lowerTag = t.toLowerCase();
      if (cat.keywords.some(kw => lowerTag.includes(kw))) {
        count++;
      }
    });
    return count;
  });

  const total = counts.reduce((a, b) => a + b, 0);

  if (total === 0) {
    return categories.map(c => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, percentage: 0 }));
  }

  return categories.map((cat, i) => ({
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    percentage: Math.round((counts[i] / total) * 100)
  })).sort((a, b) => b.percentage - a.percentage);
};

export default function Home() {
  const router = useRouter();
  const [screen, setScreen] = useState<ScreenState>("landing");
  const [userName, setUserName] = useState("");
  const [history, setHistory] = useState<SwipeResult[]>([]);
  const [likedTags, setLikedTags] = useState<string[]>([]);
  const [dislikedTags, setDislikedTags] = useState<string[]>([]);
  const [currentCard, setCurrentCard] = useState<CardData | null>(null);
  const [count, setCount] = useState(1);
  const [total, setTotal] = useState(20);
  const [isFetching, setIsFetching] = useState(false);
  
  // Results
  const [results, setResults] = useState<Recommendation[]>([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackJurusan, setFeedbackJurusan] = useState("");
  
  const [isLowConfidence, setIsLowConfidence] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [itemFeedbacks, setItemFeedbacks] = useState<Record<string, string>>({});
  const [swipeStatus, setSwipeStatus] = useState<string>("ok");
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [transitionModalOpen, setTransitionModalOpen] = useState(false);
  const [transitionRumpun, setTransitionRumpun] = useState("");
  const [transitionRumpunId, setTransitionRumpunId] = useState("");
  const [webRating, setWebRating] = useState(0);
  const [webComment, setWebComment] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Compare states
  const [compareList, setCompareList] = useState<string[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareData, setCompareData] = useState<DetailJurusanData[]>([]);
  const [isCompareLoading, setIsCompareLoading] = useState(false);

  // ── Beta Testing States ──
  const [onboardingStep, setOnboardingStep] = useState(0); // 0=demografi, 1=ground truth
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    gender: '', kelas: '', jurusan_sma: '', provinsi: '', tipe_sekolah: '',
    jurusan_impian: '', jurusan_diminati_1: '', jurusan_diminati_2: '', jurusan_diminati_3: '',
    tingkat_keyakinan: 0, sudah_riset: false, sumber_info: []
  });
  const [jurusanList, setJurusanList] = useState<string[]>([]);
  const [jurusanSearch, setJurusanSearch] = useState('');
  const [jurusanSearchField, setJurusanSearchField] = useState<string>('');
  const [cardShownTimestamp, setCardShownTimestamp] = useState<number>(Date.now());
  const [questionTimings, setQuestionTimings] = useState<{qid: string, response: string, time_ms: number, order: number, phase: string}[]>([]);
  const [quizStartTimestamp, setQuizStartTimestamp] = useState<number>(0);
  
  // Per-jurusan beta feedback
  const [perJurusanFeedback, setPerJurusanFeedback] = useState<Record<string, PerJurusanFeedback>>({});
  
  // Session evaluation
  const [evalKesesuaian, setEvalKesesuaian] = useState(0);
  const [evalKepuasan, setEvalKepuasan] = useState(0);
  const [evalWawasan, setEvalWawasan] = useState(0);
  const [evalNps, setEvalNps] = useState(-1);
  const [evalJurusanSeharusnya, setEvalJurusanSeharusnya] = useState('');
  const [evalKomentar, setEvalKomentar] = useState('');
  const [betaFeedbackSent, setBetaFeedbackSent] = useState(false);
  const [betaFeedbackStep, setBetaFeedbackStep] = useState(0); // 0=per-jurusan, 1=overall

  // Fetch jurusan list for autocomplete
  useEffect(() => {
    fetch('/api/jurusan-list')
      .then(res => res.json())
      .then(data => setJurusanList(data.jurusan || []))
      .catch(() => {});
  }, []);

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

  const isLoadedRef = useRef(false);
  const [pendingSession, setPendingSession] = useState<QuizSessionState | null>(null);
  const [selectedInterestCategory, setSelectedInterestCategory] = useState<string | null>(null);

  // Load state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("major_match_session");
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setTimeout(() => {
          if (state.screen === "result") {
            // Restore finished results screen directly
            if (state.userName) setUserName(state.userName);
            if (state.history) setHistory(state.history);
            if (state.likedTags) setLikedTags(state.likedTags);
            if (state.dislikedTags) setDislikedTags(state.dislikedTags);
            if (state.results) setResults(state.results);
            if (state.screen) setScreen(state.screen);
            if (state.sessionId) setSessionId(state.sessionId);
            if (state.isLowConfidence !== undefined) setIsLowConfidence(state.isLowConfidence);
            if (state.swipeStatus) setSwipeStatus(state.swipeStatus);
            if (state.total) setTotal(state.total);
            if (state.betaFeedbackSent) setBetaFeedbackSent(state.betaFeedbackSent);
          } else if (state.screen === "swipe" && state.history && state.history.length > 0) {
            // Incomplete session found. Hold it to show the resume banner.
            setPendingSession(state);
          }
        }, 0);
      } catch (e) {
        console.error("Failed to load session state", e);
      }
    }
    isLoadedRef.current = true;
  }, []);

  // Save state to localStorage when it changes
  useEffect(() => {
    if (!isLoadedRef.current) return;
    
    if (screen !== "landing") {
      const state = {
        userName,
        history,
        likedTags,
        dislikedTags,
        results,
        screen,
        sessionId,
        isLowConfidence,
        swipeStatus,
        total,
        transitionModalOpen,
        transitionRumpun,
        transitionRumpunId,
        webRating,
        webComment,
        onboardingData,
        betaFeedbackSent,
      };
      localStorage.setItem("major_match_session", JSON.stringify(state));
    } else {
      // Keep pending session in storage if we haven't started or overwritten it yet
      if (!pendingSession) {
        localStorage.removeItem("major_match_session");
      }
    }
  }, [userName, history, likedTags, dislikedTags, results, screen, sessionId, isLowConfidence, swipeStatus, total, transitionModalOpen, transitionRumpun, transitionRumpunId, webRating, webComment, pendingSession, onboardingData, betaFeedbackSent]);

  const resumeSession = () => {
    if (!pendingSession) return;
    setUserName(pendingSession.userName || "");
    setHistory(pendingSession.history || []);
    setLikedTags(pendingSession.likedTags || []);
    setDislikedTags(pendingSession.dislikedTags || []);
    setTotal(pendingSession.total || 20);
    setTransitionModalOpen(pendingSession.transitionModalOpen || false);
    setTransitionRumpun(pendingSession.transitionRumpun || "");
    setTransitionRumpunId(pendingSession.transitionRumpunId || "");
    setWebRating(pendingSession.webRating || 0);
    setWebComment(pendingSession.webComment || "");
    if (pendingSession.onboardingData) setOnboardingData(pendingSession.onboardingData);
    setScreen("swipe");
    setPendingSession(null);
    fetchNextCard(pendingSession.history || [], pendingSession.likedTags || [], pendingSession.dislikedTags || [], pendingSession.total || 20);
  };

  const discardPendingSession = () => {
    localStorage.removeItem("major_match_session");
    setPendingSession(null);
  };

  const exitQuizMidway = () => {
    if (window.confirm("Apakah kamu yakin ingin keluar dari kuis? Seluruh progres kuis saat ini akan dihapus dan direset dari awal.")) {
      resetApp();
    }
  };

  // ── Onboarding Flow ──
  const startOnboarding = () => {
    if (!userName.trim()) return;
    setErrorMsg(null);
    setOnboardingStep(0);
    setScreen("onboarding");
  };

  const canProceedOnboarding = () => {
    if (onboardingStep === 0) {
      return onboardingData.gender && onboardingData.kelas && onboardingData.jurusan_sma;
    }
    if (onboardingStep === 1) {
      return onboardingData.jurusan_impian && onboardingData.tingkat_keyakinan > 0;
    }
    return false;
  };

  const handleOnboardingNext = async () => {
    if (onboardingStep === 0) {
      setOnboardingStep(1);
      return;
    }
    // Step 1 complete: save profile and start quiz
    const sid = `beta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sid,
          ...onboardingData,
        })
      });
    } catch (e) {
      console.error("Failed to save user profile:", e);
    }
    // Start quiz
    setQuizStartTimestamp(Date.now());
    setSessionId(sid);
    setScreen("swipe");
    setHistory([]);
    setLikedTags([]);
    setDislikedTags([]);
    setQuestionTimings([]);
    await fetchNextCard([], [], []);
  };

  const startSwipe = async () => {
    if (!userName.trim()) return;
    setErrorMsg(null);
    startOnboarding();
  };

  const fetchNextCard = async (currentHistory: SwipeResult[], currentLiked: string[] = likedTags, currentDisliked: string[] = dislikedTags, currentTotal: number = total) => {
    if (isFetching) return;
    setIsFetching(true);
    try {
      const res = await fetch("/api/next-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: currentHistory, liked_tags: currentLiked, disliked_tags: currentDisliked, limit: currentTotal }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("Terlalu banyak permintaan! Silakan coba lagi nanti dalam beberapa menit.");
        }
        throw new Error(`Gagal memuat pertanyaan (Server error ${res.status}).`);
      }
      const data = await res.json();
      if (data.done) {
        finishSwipe(currentHistory, currentLiked, currentDisliked);
      } else {
        setCurrentCard(data.card);
        setCount(data.count);
        setTotal(data.total);
        setCardShownTimestamp(Date.now()); // Track when card was shown
        if (data.phase_transition) {
          setTransitionRumpun(data.top_rumpun || "");
          setTransitionRumpunId(data.rumpun_id || "");
          setTransitionModalOpen(true);
        }
      }
    } catch (e) {
      console.error(e);
      const errMsg = e instanceof Error ? e.message : "Terjadi kesalahan koneksi saat memuat pertanyaan.";
      setErrorMsg(errMsg);
      if (currentHistory.length === 0) {
        setScreen("landing");
      }
    } finally {
      setIsFetching(false);
    }
  };

  const finishSwipe = async (finalHistory: SwipeResult[], currentLiked: string[] = likedTags, currentDisliked: string[] = dislikedTags) => {
    setScreen("loading");

    // Send question timings to backend (batch)
    if (questionTimings.length > 0 && sessionId) {
      try {
        await fetch('/api/question-response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            responses: questionTimings.map(qt => ({
              question_id: qt.qid,
              response: qt.response,
              response_time_ms: qt.time_ms,
              question_order: qt.order,
              phase: qt.phase,
            })),
          }),
        });
      } catch (e) {
        console.error("Failed to save question timings:", e);
      }
    }

    try {
      // get recommendation
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: userName, history: finalHistory, liked_tags: currentLiked, disliked_tags: currentDisliked }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("Terlalu banyak permintaan! Silakan coba lagi nanti dalam beberapa menit.");
        }
        throw new Error(`Gagal mendapatkan rekomendasi (Server error ${res.status}).`);
      }
      const data = await res.json();

      if (data.status === "extend") {
        setTotal(data.new_total);
        setExtendModalOpen(true);
      } else {
        setSwipeStatus(data.status || "ok");
        setResults(data.hasil || []);
        // Keep existing sessionId from onboarding if available, else use the one from recommend
        if (!sessionId) {
          setSessionId(data.session_id || "");
        }
        
        const maxScore = data.hasil && data.hasil.length > 0 ? Math.max(...data.hasil.map((h: Recommendation) => h.skor)) : 0;
        setIsLowConfidence(maxScore < 60 && data.hasil?.length > 0);

        if (data.hasil && data.hasil.length > 0) {
          setFeedbackJurusan(data.hasil[0].jurusan);
        }
        setScreen("result");
      }
    } catch (e) {
      console.error(e);
      const errMsg = e instanceof Error ? e.message : "Terjadi kesalahan koneksi saat menghitung rekomendasi.";
      setErrorMsg(errMsg);
      setScreen("landing");
    }
  };

  const sendItemFeedback = async (jurusan: string, fb: "like" | "dislike") => {
    if (!sessionId) return;
    try {
      await fetch("/api/item-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, rekomendasi_jurusan: jurusan, feedback: fb }),
      });
      setItemFeedbacks(prev => ({...prev, [jurusan]: fb}));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSwipe = async (liked: boolean) => {
    if (!currentCard) return;

    // Track response time
    const responseTime = Date.now() - cardShownTimestamp;
    const phase = count <= 8 ? 'opening' : (count <= 20 ? 'exploration' : 'detail');
    setQuestionTimings(prev => [...prev, {
      qid: currentCard.id,
      response: liked ? 'like' : 'skip',
      time_ms: responseTime,
      order: count,
      phase: phase,
    }]);

    const newHist = [...history, { id: currentCard.id, liked }];
    setHistory(newHist);
    
    let newLikedTags = [...likedTags];
    let newDislikedTags = [...dislikedTags];
    if (currentCard.tags) {
      if (liked) {
        newLikedTags = [...newLikedTags, ...currentCard.tags];
      } else {
        newDislikedTags = [...newDislikedTags, ...currentCard.tags];
      }
    }
    setLikedTags(newLikedTags);
    setDislikedTags(newDislikedTags);

    // Fetch next after a short delay for animation
    setTimeout(() => {
      fetchNextCard(newHist, newLikedTags, newDislikedTags);
    }, 200);
  };

  // ── Beta Feedback Submission ──
  const submitBetaFeedback = async () => {
    // Validate per-jurusan feedback
    for (const r of results.slice(0, 3)) {
      const fb = perJurusanFeedback[r.jurusan];
      if (!fb || fb.rating_tertarik === 0 || fb.pertimbangkan === null || fb.sudah_tahu === null) {
        alert(`Mohon lengkapi feedback untuk jurusan "${r.jurusan}" terlebih dahulu.`);
        return;
      }
    }
    setBetaFeedbackStep(1);
  };

  const submitSessionEvaluation = async () => {
    if (evalKesesuaian === 0 || evalKepuasan === 0 || evalWawasan === 0 || evalNps === -1) {
      alert("Mohon lengkapi semua rating evaluasi terlebih dahulu.");
      return;
    }

    const durasiDetik = quizStartTimestamp > 0 ? Math.round((Date.now() - quizStartTimestamp) / 1000) : 0;

    try {
      // Save recommendation feedback
      await fetch('/api/recommendation-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          feedbacks: results.slice(0, 3).map((r, i) => ({
            jurusan: r.jurusan,
            rank: i + 1,
            rating_tertarik: perJurusanFeedback[r.jurusan]?.rating_tertarik || 0,
            pertimbangkan: perJurusanFeedback[r.jurusan]?.pertimbangkan ?? false,
            sudah_tahu: perJurusanFeedback[r.jurusan]?.sudah_tahu ?? false,
          })),
        }),
      });

      // Save session evaluation
      await fetch('/api/session-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          rating_kesesuaian: evalKesesuaian,
          rating_kepuasan: evalKepuasan,
          rating_wawasan: evalWawasan,
          nps_score: evalNps,
          jurusan_seharusnya: evalJurusanSeharusnya,
          komentar: evalKomentar,
          durasi_total_detik: durasiDetik,
        }),
      });

      setBetaFeedbackSent(true);
    } catch (e) {
      console.error(e);
      alert("Gagal mengirim evaluasi. Silakan coba lagi.");
    }
  };

  const submitFeedback = async () => {
    if (rating === 0) return alert("Pilih rating bintang untuk akurasi rekomendasi terlebih dahulu!");
    if (webRating === 0) return alert("Pilih rating bintang untuk penggunaan website terlebih dahulu!");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          session_id: sessionId,
          rating, 
          komentar: comment,
          web_rating: webRating,
          web_komentar: webComment
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${await res.text()}`);
      setFeedbackSent(true);
    } catch (e) {
      console.error(e);
      alert("Gagal mengirimkan feedback. Silakan coba lagi.");
    }
  };

  const resetApp = () => {
    localStorage.removeItem("major_match_session");
    setPendingSession(null);
    setSelectedInterestCategory(null);
    setUserName("");
    setHistory([]);
    setLikedTags([]);
    setDislikedTags([]);
    setResults([]);
    setSwipeStatus("ok");
    setExtendModalOpen(false);
    setTransitionModalOpen(false);
    setTransitionRumpun("");
    setTransitionRumpunId("");
    setWebRating(0);
    setWebComment("");
    setTotal(20);
    setErrorMsg(null);
    setRating(0);
    setComment("");
    setFeedbackSent(false);
    setIsLowConfidence(false);
    setItemFeedbacks({});
    setSessionId("");
    clearCompare();
    // Reset beta testing states
    setOnboardingStep(0);
    setOnboardingData({
      gender: '', kelas: '', jurusan_sma: '', provinsi: '', tipe_sekolah: '',
      jurusan_impian: '', jurusan_diminati_1: '', jurusan_diminati_2: '', jurusan_diminati_3: '',
      tingkat_keyakinan: 0, sudah_riset: false, sumber_info: []
    });
    setQuestionTimings([]);
    setPerJurusanFeedback({});
    setEvalKesesuaian(0);
    setEvalKepuasan(0);
    setEvalWawasan(0);
    setEvalNps(-1);
    setEvalJurusanSeharusnya('');
    setEvalKomentar('');
    setBetaFeedbackSent(false);
    setBetaFeedbackStep(0);
    setScreen("landing");
  };

  const renderError = () => {
    if (!errorMsg) return null;
    return (
      <div style={{
        width: "100%", 
        background: "#FEF2F2", 
        border: "1px solid #FECACA", 
        color: "var(--red)", 
        padding: "14px 18px", 
        borderRadius: 16, 
        fontSize: "0.9rem", 
        lineHeight: 1.5, 
        marginBottom: 20, 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        boxShadow: "var(--shadow-sm)",
        animation: "fade-in 0.3s ease"
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>⚠️</span> 
          <span>{errorMsg}</span>
        </span>
        <button 
          onClick={() => setErrorMsg(null)} 
          style={{ 
            background: "none", 
            border: "none", 
            color: "var(--red)", 
            fontWeight: "bold", 
            cursor: "pointer", 
            fontSize: "1.1rem", 
            padding: "0 6px",
            lineHeight: 1
          }}
        >
          ✕
        </button>
      </div>
    );
  };

  // ── Autocomplete Helper ──
  const filteredJurusan = jurusanSearch.length >= 2 
    ? jurusanList.filter(j => j.toLowerCase().includes(jurusanSearch.toLowerCase())).slice(0, 8)
    : [];

  const renderJurusanAutocomplete = (
    value: string,
    fieldName: string,
    placeholder: string,
    onChange: (val: string) => void
  ) => (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={jurusanSearchField === fieldName ? jurusanSearch : value}
        onChange={(e) => {
          setJurusanSearch(e.target.value);
          setJurusanSearchField(fieldName);
          onChange(e.target.value);
        }}
        onFocus={() => {
          setJurusanSearchField(fieldName);
          setJurusanSearch(value);
        }}
        placeholder={placeholder}
        className="input-vibrant"
        style={{ border: '1px solid #E2E8F0', fontSize: '0.85rem' }}
      />
      {jurusanSearchField === fieldName && filteredJurusan.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'white', border: '1px solid #E2E8F0', borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto',
          marginTop: 4
        }}>
          {filteredJurusan.map((j, i) => (
            <div key={i} onClick={() => {
              onChange(j);
              setJurusanSearch('');
              setJurusanSearchField('');
            }} style={{
              padding: '10px 14px', cursor: 'pointer', fontSize: '0.85rem',
              borderBottom: i < filteredJurusan.length - 1 ? '1px solid #F1F5F9' : 'none',
              transition: '0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--blue-light)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
            >
              {j}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* LANDING */}
      {screen === "landing" && (
        <div className="screen animate-slide-up" style={{ gap: 0 }}>
          {renderError()}

          {pendingSession && (
            <div className="resume-banner" id="resume-banner-container" style={{ width: "100%" }}>
              <div style={{ fontFamily: "var(--font-nunito)", fontWeight: 900, fontSize: "1.05rem", color: "var(--blue2)", marginBottom: 8 }}>
                👋 Sesi Kuis Terhenti Ditemukan
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.5, marginBottom: 14 }}>
                Halo <strong>{pendingSession.userName}</strong>! Kami menemukan sesi kuis terakhirmu terhenti di pertanyaan ke-<strong>{pendingSession.history.length + 1}</strong>. Apakah kamu ingin melanjutkannya?
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button 
                  id="btn-resume-session" 
                  className="btn-primary" 
                  style={{ padding: "10px 16px", fontSize: "0.85rem", borderRadius: "10px", width: "auto", flex: 1 }}
                  onClick={resumeSession}
                >
                  Lanjutkan
                </button>
                <button 
                  id="btn-discard-session" 
                  className="btn-outline" 
                  style={{ padding: "10px 16px", fontSize: "0.85rem", borderRadius: "10px", width: "auto", flex: 1 }}
                  onClick={discardPendingSession}
                >
                  Mulai Baru
                </button>
              </div>
            </div>
          )}

          <div className="glass" style={{
            width: "100%", padding: "40px 28px",
            position: "relative", overflow: "hidden", marginBottom: 24, textAlign: "center"
          }}>
            {/* Beta Testing Banner */}
            <div style={{
              background: "linear-gradient(135deg, #F59E0B, #F97316)",
              color: "white",
              padding: "6px 14px",
              borderRadius: 99,
              fontSize: "0.7rem",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              display: "inline-block",
              marginBottom: 16,
              boxShadow: "0 2px 8px rgba(249, 115, 22, 0.3)",
            }}>
              🧪 Beta Testing v2.0
            </div>

            <h1 id="brand-title" className="text-gradient" style={{
              fontFamily: "var(--font-nunito)", fontSize: "2.8rem", fontWeight: 900,
              lineHeight: 1.1, marginBottom: 16, position: "relative", zIndex: 1
            }}>
              Major <span style={{ color: "var(--yellow2)" }}>&amp;</span> Match
            </h1>
            <p style={{ fontSize: "1rem", lineHeight: 1.6, color: "var(--muted)", position: "relative", zIndex: 1, marginBottom: 28, fontWeight: 600 }}>
              Temukan jurusan kuliah yang paling cocok denganmu —
              cukup jawab beberapa pertanyaan, tanpa kuesioner membosankan.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, position: "relative", zIndex: 1 }}>
              {["Cepat & Mudah", "Akurat", "236+ Jurusan", "Gratis"].map(b => (
                <span key={b} style={{
                  background: "var(--blue-light)", color: "var(--blue2)",
                  borderRadius: 99, padding: "6px 16px", fontSize: "0.8rem", fontWeight: 800
                }}>
                  {b}
                </span>
              ))}
            </div>
          </div>

          <div style={{ width: "100%", marginBottom: 16 }}>
            <div style={{
              fontFamily: "var(--font-nunito)", fontSize: "0.85rem", fontWeight: 800,
              color: "var(--blue2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, paddingLeft: 4
            }}>
              Siapa namamu?
            </div>
            <input
              type="text"
              id="input-name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startSwipe()}
              placeholder="Tulis namamu di sini..."
              className="input-vibrant"
            />
          </div>

          <button id="btn-start-quiz" className="btn-primary" onClick={startSwipe}>
            MULAI SEKARANG
          </button>
          
          <button id="btn-goto-explore" className="btn-outline" style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", width: "100%", marginTop: 12 }} onClick={() => router.push("/explore")}>
            <Search size={18} /> EXPLOR JURUSAN DULU
          </button>

          <p style={{ textAlign: "center", marginTop: 14, fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.5 }}>
            🧪 Versi beta testing — bantu kami meningkatkan akurasi rekomendasi dengan mengisi feedback di akhir kuis.
          </p>
        </div>
      )}

      {/* ONBOARDING */}
      {screen === "onboarding" && (
        <div className="screen animate-slide-up" style={{ gap: 0 }}>
          <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <button
              onClick={() => { if (onboardingStep === 0) setScreen("landing"); else setOnboardingStep(0); }}
              style={{
                background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.15)",
                borderRadius: 12, padding: "6px 14px", color: "var(--blue2)", fontSize: "0.82rem",
                fontWeight: 900, cursor: "pointer", transition: "all 0.2s"
              }}
            >
              ← Kembali
            </button>
            <span style={{ fontFamily: "var(--font-nunito)", fontWeight: 900, fontSize: "0.9rem", color: "var(--blue2)", background: "var(--blue-light)", padding: "4px 12px", borderRadius: 99 }}>
              {onboardingStep + 1} / 2
            </span>
          </div>

          {/* Step Progress */}
          <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.8)", borderRadius: 99, overflow: "hidden", marginBottom: 24, boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ height: "100%", background: "linear-gradient(90deg, var(--blue), var(--purple))", borderRadius: 99, transition: "width .4s cubic-bezier(0.4, 0, 0.2, 1)", width: `${(onboardingStep + 1) * 50}%` }} />
          </div>

          {onboardingStep === 0 && (
            <div className="glass-panel animate-slide-up" style={{ width: "100%", padding: 24 }}>
              <div style={{ fontFamily: "var(--font-nunito)", fontSize: "1.2rem", fontWeight: 900, marginBottom: 4, color: "var(--navy)" }}>
                👤 Data Diri
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: 20 }}>
                Informasi ini digunakan untuk analisis dan peningkatan akurasi rekomendasi.
              </div>

              {/* Gender */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--navy)", marginBottom: 8 }}>Gender *</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[{v: 'L', l: '👦 Laki-laki'}, {v: 'P', l: '👧 Perempuan'}, {v: 'Lainnya', l: '🌟 Lainnya'}].map(opt => (
                    <button key={opt.v} onClick={() => setOnboardingData(p => ({...p, gender: opt.v}))}
                      style={{
                        flex: 1, padding: "10px 8px", borderRadius: 12, fontSize: "0.8rem", fontWeight: 700,
                        cursor: "pointer", transition: "all 0.2s",
                        background: onboardingData.gender === opt.v ? "var(--blue-light)" : "white",
                        border: `2px solid ${onboardingData.gender === opt.v ? "var(--blue)" : "#E2E8F0"}`,
                        color: onboardingData.gender === opt.v ? "var(--blue2)" : "var(--muted)",
                      }}
                    >{opt.l}</button>
                  ))}
                </div>
              </div>

              {/* Kelas */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--navy)", marginBottom: 8 }}>Kelas *</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {['10', '11', '12', 'Alumni'].map(k => (
                    <button key={k} onClick={() => setOnboardingData(p => ({...p, kelas: k}))}
                      style={{
                        flex: 1, padding: "10px 8px", borderRadius: 12, fontSize: "0.85rem", fontWeight: 700,
                        cursor: "pointer", transition: "all 0.2s",
                        background: onboardingData.kelas === k ? "var(--blue-light)" : "white",
                        border: `2px solid ${onboardingData.kelas === k ? "var(--blue)" : "#E2E8F0"}`,
                        color: onboardingData.kelas === k ? "var(--blue2)" : "var(--muted)",
                      }}
                    >{k}</button>
                  ))}
                </div>
              </div>

              {/* Jurusan SMA */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--navy)", marginBottom: 8 }}>Jurusan SMA *</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {['IPA', 'IPS', 'Bahasa', 'Lainnya'].map(j => (
                    <button key={j} onClick={() => setOnboardingData(p => ({...p, jurusan_sma: j}))}
                      style={{
                        flex: "1 1 45%", padding: "10px 8px", borderRadius: 12, fontSize: "0.85rem", fontWeight: 700,
                        cursor: "pointer", transition: "all 0.2s",
                        background: onboardingData.jurusan_sma === j ? "var(--blue-light)" : "white",
                        border: `2px solid ${onboardingData.jurusan_sma === j ? "var(--blue)" : "#E2E8F0"}`,
                        color: onboardingData.jurusan_sma === j ? "var(--blue2)" : "var(--muted)",
                      }}
                    >{j}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {onboardingStep === 1 && (
            <div className="glass-panel animate-slide-up" style={{ width: "100%", padding: 24 }}>
              <div style={{ fontFamily: "var(--font-nunito)", fontSize: "1.2rem", fontWeight: 900, marginBottom: 4, color: "var(--navy)" }}>
                🎯 Minat Jurusan Awal
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: 20 }}>
                Beri tahu kami jurusan yang kamu minati saat ini. Data ini digunakan untuk mengukur akurasi rekomendasi.
              </div>

              {/* Jurusan Impian */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--navy)", marginBottom: 8 }}>Jurusan impian utama *</div>
                {renderJurusanAutocomplete(
                  onboardingData.jurusan_impian,
                  'jurusan_impian',
                  'Ketik nama jurusan...',
                  (val) => setOnboardingData(p => ({...p, jurusan_impian: val}))
                )}
              </div>

              {/* Top 3 Diminati */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--navy)", marginBottom: 4 }}>3 Jurusan yang diminati</div>
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: 8 }}>Opsional — bisa sama atau berbeda dari jurusan impian</div>
                {[1, 2, 3].map(n => (
                  <div key={n} style={{ marginBottom: 8 }}>
                    {renderJurusanAutocomplete(
                      onboardingData[`jurusan_diminati_${n}` as keyof OnboardingData] as string,
                      `jurusan_diminati_${n}`,
                      `Jurusan diminati ${n} (opsional)`,
                      (val) => setOnboardingData(p => ({...p, [`jurusan_diminati_${n}`]: val}))
                    )}
                  </div>
                ))}
              </div>

              {/* Tingkat Keyakinan */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--navy)", marginBottom: 8 }}>Seberapa yakin kamu dengan pilihan jurusan saat ini? *</div>
                <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setOnboardingData(p => ({...p, tingkat_keyakinan: n}))}
                      style={{
                        width: 48, height: 48, borderRadius: 12, fontSize: "0.9rem", fontWeight: 800,
                        cursor: "pointer", transition: "all 0.2s",
                        background: onboardingData.tingkat_keyakinan >= n ? "var(--blue-light)" : "white",
                        border: `2px solid ${onboardingData.tingkat_keyakinan >= n ? "var(--blue)" : "#E2E8F0"}`,
                        color: onboardingData.tingkat_keyakinan >= n ? "var(--blue2)" : "var(--muted)",
                      }}
                    >{n}</button>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--muted)", marginTop: 4, padding: "0 4px" }}>
                  <span>Sangat Tidak Yakin</span>
                  <span>Sangat Yakin</span>
                </div>
              </div>

              {/* Sudah Riset */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--navy)", marginBottom: 8 }}>Apakah kamu sudah pernah riset jurusan sebelumnya?</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[{v: true, l: '✅ Sudah'}, {v: false, l: '❌ Belum'}].map(opt => (
                    <button key={String(opt.v)} onClick={() => setOnboardingData(p => ({...p, sudah_riset: opt.v}))}
                      style={{
                        flex: 1, padding: "10px 8px", borderRadius: 12, fontSize: "0.85rem", fontWeight: 700,
                        cursor: "pointer", transition: "all 0.2s",
                        background: onboardingData.sudah_riset === opt.v ? "var(--blue-light)" : "white",
                        border: `2px solid ${onboardingData.sudah_riset === opt.v ? "var(--blue)" : "#E2E8F0"}`,
                        color: onboardingData.sudah_riset === opt.v ? "var(--blue2)" : "var(--muted)",
                      }}
                    >{opt.l}</button>
                  ))}
                </div>
              </div>

              {/* Sumber Info */}
              <div style={{ marginBottom: 0 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--navy)", marginBottom: 8 }}>Dari mana kamu mendapat info jurusan?</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {['Orang tua', 'Guru BK', 'Internet', 'Teman', 'Lainnya'].map(src => {
                    const selected = onboardingData.sumber_info.includes(src);
                    return (
                      <button key={src}
                        onClick={() => setOnboardingData(p => ({
                          ...p,
                          sumber_info: selected ? p.sumber_info.filter(s => s !== src) : [...p.sumber_info, src]
                        }))}
                        style={{
                          padding: "8px 14px", borderRadius: 99, fontSize: "0.78rem", fontWeight: 700,
                          cursor: "pointer", transition: "all 0.2s",
                          background: selected ? "var(--blue-light)" : "white",
                          border: `1.5px solid ${selected ? "var(--blue)" : "#E2E8F0"}`,
                          color: selected ? "var(--blue2)" : "var(--muted)",
                        }}
                      >{src}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <button className="btn-primary" onClick={handleOnboardingNext}
            disabled={!canProceedOnboarding()}
            style={{ marginTop: 20, opacity: canProceedOnboarding() ? 1 : 0.5, cursor: canProceedOnboarding() ? "pointer" : "not-allowed" }}
          >
            {onboardingStep === 0 ? "Lanjut →" : "🚀 Mulai Kuis"}
          </button>
        </div>
      )}

      {/* SWIPE */}
      {screen === "swipe" && (
        <div className="screen animate-slide-up" style={{ gap: 0 }}>
          {renderError()}
          <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <button
              id="btn-exit-quiz"
              onClick={exitQuizMidway}
              style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.15)",
                borderRadius: "12px",
                padding: "6px 12px",
                color: "var(--red)",
                fontSize: "0.82rem",
                fontWeight: 900,
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                gap: 4
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
              🚪 Keluar
            </button>
            <span style={{ fontFamily: "var(--font-nunito)", fontWeight: 900, fontSize: "0.9rem", color: "var(--blue2)", background: "var(--blue-light)", padding: "4px 12px", borderRadius: 99 }}>
              {count} / {total}
            </span>
          </div>
          <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.8)", borderRadius: 99, overflow: "hidden", marginBottom: 24, boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ height: "100%", background: "linear-gradient(90deg, var(--blue), var(--purple))", borderRadius: 99, transition: "width .4s cubic-bezier(0.4, 0, 0.2, 1)", width: `${Math.round(((count - 1) / total) * 100)}%` }} />
          </div>

          <div style={{ position: "relative", width: "100%", height: 320, marginBottom: 32 }}>
            <div className="glass-panel" style={{ position: "absolute", inset: 0, transform: "scale(.92) translateY(16px)", opacity: 0.5 }} />
            <div className="glass-panel" style={{ position: "absolute", inset: 0, transform: "scale(.96) translateY(8px)", opacity: 0.8 }} />
            {currentCard && (
              <SwipeCard
                key={currentCard.id}
                card={currentCard}
                onSwipe={handleSwipe}
                index={0}
              />
            )}
          </div>

          <div style={{ display: "flex", gap: 24, justifyContent: "center", width: "100%", marginBottom: 16 }}>
            <button
              id="btn-swipe-dislike"
              onClick={() => handleSwipe(false)}
              style={{
                width: 72, height: 72, borderRadius: "50%", border: "none",
                background: "white", color: "var(--red)", fontSize: "1.8rem", fontWeight: 900,
                cursor: "pointer", boxShadow: "0 10px 25px rgba(239,68,68,.2)", transition: "all .2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
              ✕
            </button>
            <button
              id="btn-swipe-like"
              onClick={() => handleSwipe(true)}
              style={{
                width: 72, height: 72, borderRadius: "50%", border: "none",
                background: "linear-gradient(135deg, #10B981, #34D399)", color: "white", fontSize: "1.8rem", fontWeight: 900,
                cursor: "pointer", boxShadow: "0 10px 25px rgba(16,185,129,.3)", transition: "all .2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
              ♥
            </button>
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--muted)", textAlign: "center" }}>
            Geser kartu atau klik tombol &nbsp;·&nbsp; ✕ Tidak &nbsp; ♥ Iya
          </p>
        </div>
      )}

      {/* LOADING */}
      {screen === "loading" && (
        <div className="screen animate-slide-up" style={{ minHeight: "60vh", justifyContent: "center", gap: 24, textAlign: "center" }}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", inset: -10, background: "var(--blue-light)", borderRadius: "50%", filter: "blur(20px)", animation: "pulse-glow 2s infinite" }} />
            <Loader2 size={64} className="animate-spin" style={{ color: "var(--blue)", position: "relative", zIndex: 1 }} />
          </div>
          <div>
            <div className="text-gradient" style={{ fontFamily: "var(--font-nunito)", fontSize: "1.3rem", fontWeight: 900, marginBottom: 8 }}>Mencocokkan profilmu...</div>
            <div style={{ color: "var(--muted)", fontSize: "0.95rem", fontWeight: 600 }}>Model AI sedang meracik yang terbaik</div>
          </div>
        </div>
      )}

      {/* RESULT */}
      {screen === "result" && (
        <div className="screen animate-slide-up" style={{ gap: 20 }}>
          {renderError()}
          {swipeStatus === "invalid_all_liked" ? (
            <div className="glass" style={{ width: "100%", padding: "40px 28px", textAlign: "center" }}>
              <div style={{ fontSize: "4rem", marginBottom: 16 }}>🧐</div>
              <h2 className="text-gradient" style={{ fontFamily: "var(--font-nunito)", fontSize: "1.8rem", fontWeight: 900, marginBottom: 12 }}>Minatmu Terlalu Luas!</h2>
              <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: 24 }}>
                Halo <strong>{userName}</strong>, kamu menyukai semua pertanyaan yang kami berikan. Karena minatmu mencakup semua bidang, sistem tidak dapat menentukan jurusan spesifik yang paling cocok untukmu.
              </p>
              <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: 24 }}>
                Cobalah ulangi tes dan pilih <strong>&quot;Iya&quot;</strong> hanya pada hal-hal yang benar-benar kamu sukai atau kuasai.
              </p>
              <button className="btn-primary" onClick={resetApp} style={{ marginBottom: 12 }}>Mulai Ulang Tes</button>
              <button className="btn-outline" style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", width: "100%" }} onClick={() => router.push("/explore")}>
                <Search size={18} /> Jelajahi Semua Jurusan
              </button>
            </div>
          ) : swipeStatus === "invalid_all_disliked" ? (
            <div className="glass" style={{ width: "100%", padding: "40px 28px", textAlign: "center" }}>
              <div style={{ fontSize: "4rem", marginBottom: 16 }}>🤷‍♂️</div>
              <h2 className="text-gradient" style={{ fontFamily: "var(--font-nunito)", fontSize: "1.8rem", fontWeight: 900, marginBottom: 12 }}>Belum Ada Minat Terdeteksi</h2>
              <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: 24 }}>
                Halo <strong>{userName}</strong>, kamu menolak semua pertanyaan yang diberikan. Karena tidak ada minat yang dipilih, kami tidak dapat mencocokkan profilmu dengan jurusan kuliah mana pun.
              </p>
              <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: 24 }}>
                Cobalah ulangi tes dan pilih <strong>&quot;Iya&quot;</strong> pada hal-hal yang setidaknya menarik perhatianmu atau ingin kamu pelajari.
              </p>
              <button className="btn-primary" onClick={resetApp} style={{ marginBottom: 12 }}>Mulai Ulang Tes</button>
              <button className="btn-outline" style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", width: "100%" }} onClick={() => router.push("/explore")}>
                <Search size={18} /> Jelajahi Semua Jurusan
              </button>
            </div>
          ) : (
            <>
              <div className="glass" style={{ width: "100%", padding: "32px 24px", textAlign: "center", position: "relative", overflow: "hidden", border: "1px solid rgba(255,255,255,0.8)" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 12, position: "relative", zIndex: 1, filter: "drop-shadow(0 10px 15px rgba(0,0,0,0.1))" }}>🎉</div>
            <div className="text-gradient" style={{ fontFamily: "var(--font-nunito)", fontSize: "1.8rem", fontWeight: 900, marginBottom: 6, position: "relative", zIndex: 1 }}>
              Match Terbaikmu!
            </div>
            <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: "0.95rem", position: "relative", zIndex: 1 }}>
              Berdasarkan profil <span style={{ color: "var(--blue2)" }}>{userName}</span>
            </div>
          </div>

          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
            {isLowConfidence && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "var(--red)", padding: "16px", borderRadius: 16, fontSize: "0.9rem", lineHeight: 1.5, boxShadow: "var(--shadow-sm)" }}>
                <strong>⚠️ Peringatan:</strong> Sistem tidak menemukan rekomendasi dengan tingkat keyakinan yang tinggi. Silakan ulangi tes dan berikan minat yang lebih jelas atau beragam.
              </div>
            )}

            {/* Interest Profile Analytics Dashboard */}
            {likedTags.length > 0 && (
              <div className="glass-panel animate-slide-up" style={{ width: "100%", padding: 24, marginBottom: 8 }}>
                <div style={{ fontFamily: "var(--font-nunito)", fontSize: "1.1rem", fontWeight: 900, marginBottom: 4, color: "var(--navy)" }}>
                  📊 Analisis Profil Minatmu
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: 16 }}>
                  Kecenderungan minat berdasarkan kuis (Klik bar untuk info detail & rekomendasi karir)
                </div>
                <div className="interest-profile-container" style={{ padding: 0, margin: 0 }}>
                  {calculateInterestProfile(likedTags).map((cat, idx) => {
                    if (cat.percentage === 0) return null;
                    return (
                      <div 
                        key={idx} 
                        id={`btn-interest-bar-${cat.id}`}
                        className="interest-item"
                        onClick={() => setSelectedInterestCategory(cat.id)}
                        style={{ cursor: "pointer" }}
                        title={`Lihat penjelasan detail minat ${cat.name}`}
                      >
                        <div className="interest-label-container">
                          <span>{cat.icon} {cat.name} <span style={{ fontSize: "0.75rem", color: "var(--blue)", marginLeft: 6 }}>→ Info Detail</span></span>
                          <span>{cat.percentage}%</span>
                        </div>
                        <div className="interest-bar-wrapper">
                          <div className="interest-bar-fill" style={{ width: `${cat.percentage}%`, background: cat.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {results.map((j, i) => (
              <div key={i} className="glass-panel animate-slide-up" style={{ width: "100%", padding: 24, animationDelay: `${i * 0.1}s` }} id={`result-major-card-${i}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 900, color: "var(--blue)", background: "var(--blue-light)", padding: "4px 10px", borderRadius: 8, textTransform: "uppercase", letterSpacing: 1 }}>#{i + 1} MATCH</span>
                  <span className="text-gradient" style={{ fontFamily: "var(--font-nunito)", fontSize: "1.2rem", fontWeight: 900 }}>
                    {j.skor}%
                  </span>
                </div>
                <div style={{ fontFamily: "var(--font-nunito)", fontSize: "1.3rem", fontWeight: 900, marginBottom: 6, color: "var(--navy)" }}>{j.jurusan}</div>
                <div style={{ display: "inline-block", background: "#F1F5F9", color: "var(--muted)", borderRadius: 99, padding: "4px 12px", fontSize: "0.75rem", fontWeight: 800, marginBottom: 16 }}>{j.kategori}</div>
                
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <div style={{ flex: 1, height: 10, background: "#E2E8F0", borderRadius: 99, overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)" }}>
                    <div style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg, var(--blue), var(--purple))", width: `${j.skor}%` }} />
                  </div>
                </div>

                {j.alasan && (
                  <div style={{ background: "var(--bg)", border: "1px solid white", borderRadius: 12, padding: 14, marginBottom: 16, fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                    <strong>💡 Mengapa ini direkomendasikan?</strong><br/>
                    {j.alasan}
                  </div>
                )}

                <div style={{ fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.6, marginBottom: 20 }}>
                  <strong style={{ color: "var(--navy)" }}>Prospek Karier:</strong> {j.karier}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                  <button id={`btn-detail-lengkap-${i}`} className="btn-secondary" style={{ flex: 1, padding: "12px", minWidth: 120 }} onClick={() => router.push(`/detail/${encodeURIComponent(j.jurusan)}`)}>
                    Detail Lengkap
                  </button>
                  <button 
                    id={`btn-compare-${j.jurusan.replace(/\s+/g, '-').toLowerCase()}`}
                    onClick={() => toggleCompare(j.jurusan)}
                    className="btn-outline" 
                    style={{ 
                      flex: 1, 
                      padding: "12px", 
                      minWidth: 120,
                      background: compareList.includes(j.jurusan) ? "var(--blue-light)" : "white",
                      borderColor: compareList.includes(j.jurusan) ? "var(--blue)" : "#E2E8F0",
                      color: compareList.includes(j.jurusan) ? "var(--blue2)" : "var(--muted)"
                    }}
                  >
                    {compareList.includes(j.jurusan) ? "✓ Terpilih" : "⚖️ Bandingkan"}
                  </button>
                </div>

                {/* ── Beta Testing: Per-Jurusan Feedback ── */}
                {!betaFeedbackSent && (
                  <div style={{ borderTop: "1px dashed #E2E8F0", paddingTop: 14, marginTop: 4 }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--blue2)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
                      📋 Feedback untuk jurusan ini
                    </div>

                    {/* Rating Ketertarikan */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 6 }}>Seberapa tertarik kamu?</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <button key={star}
                            onClick={() => setPerJurusanFeedback(prev => ({
                              ...prev,
                              [j.jurusan]: { ...prev[j.jurusan], rating_tertarik: star, pertimbangkan: prev[j.jurusan]?.pertimbangkan ?? null, sudah_tahu: prev[j.jurusan]?.sudah_tahu ?? null }
                            }))}
                            style={{
                              width: 36, height: 36, borderRadius: 10,
                              border: `2px solid ${(perJurusanFeedback[j.jurusan]?.rating_tertarik || 0) >= star ? "var(--yellow2)" : "#E2E8F0"}`,
                              background: (perJurusanFeedback[j.jurusan]?.rating_tertarik || 0) >= star ? "#FEF9C3" : "white",
                              fontSize: "1rem", cursor: "pointer", transition: "all .2s",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transform: (perJurusanFeedback[j.jurusan]?.rating_tertarik || 0) >= star ? "scale(1.05)" : "scale(1)",
                            }}
                          >⭐</button>
                        ))}
                      </div>
                    </div>

                    {/* Pertimbangkan */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 6 }}>Pertimbangkan mengambil jurusan ini?</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {[{v: true, l: '✅ Ya'}, {v: false, l: '❌ Tidak'}].map(opt => (
                          <button key={String(opt.v)}
                            onClick={() => setPerJurusanFeedback(prev => ({
                              ...prev,
                              [j.jurusan]: { ...prev[j.jurusan], pertimbangkan: opt.v, rating_tertarik: prev[j.jurusan]?.rating_tertarik || 0, sudah_tahu: prev[j.jurusan]?.sudah_tahu ?? null }
                            }))}
                            style={{
                              flex: 1, padding: "8px", borderRadius: 10, fontSize: "0.8rem", fontWeight: 700,
                              cursor: "pointer", transition: "all 0.2s",
                              background: perJurusanFeedback[j.jurusan]?.pertimbangkan === opt.v ? "var(--blue-light)" : "white",
                              border: `1.5px solid ${perJurusanFeedback[j.jurusan]?.pertimbangkan === opt.v ? "var(--blue)" : "#E2E8F0"}`,
                              color: perJurusanFeedback[j.jurusan]?.pertimbangkan === opt.v ? "var(--blue2)" : "var(--muted)",
                            }}
                          >{opt.l}</button>
                        ))}
                      </div>
                    </div>

                    {/* Sudah Tahu */}
                    <div>
                      <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 6 }}>Apakah kamu sudah tahu jurusan ini sebelumnya?</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {[{v: true, l: '✅ Sudah'}, {v: false, l: '❌ Belum'}].map(opt => (
                          <button key={String(opt.v)}
                            onClick={() => setPerJurusanFeedback(prev => ({
                              ...prev,
                              [j.jurusan]: { ...prev[j.jurusan], sudah_tahu: opt.v, rating_tertarik: prev[j.jurusan]?.rating_tertarik || 0, pertimbangkan: prev[j.jurusan]?.pertimbangkan ?? null }
                            }))}
                            style={{
                              flex: 1, padding: "8px", borderRadius: 10, fontSize: "0.8rem", fontWeight: 700,
                              cursor: "pointer", transition: "all 0.2s",
                              background: perJurusanFeedback[j.jurusan]?.sudah_tahu === opt.v ? "var(--blue-light)" : "white",
                              border: `1.5px solid ${perJurusanFeedback[j.jurusan]?.sudah_tahu === opt.v ? "var(--blue)" : "#E2E8F0"}`,
                              color: perJurusanFeedback[j.jurusan]?.sudah_tahu === opt.v ? "var(--blue2)" : "var(--muted)",
                            }}
                          >{opt.l}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Beta Testing: Session Evaluation ── */}
          {!betaFeedbackSent && (
            <div className="glass-panel" style={{ width: "100%", padding: 24 }} id="beta-feedback-form">
              {betaFeedbackStep === 0 ? (
                <>
                  <div style={{ fontFamily: "var(--font-nunito)", fontSize: "1.1rem", fontWeight: 900, marginBottom: 4, color: "var(--navy)" }}>
                    📝 Evaluasi Hasil Rekomendasi
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: 16 }}>
                    Lengkapi feedback per-jurusan di atas, lalu klik tombol di bawah.
                  </div>
                  <button className="btn-primary" onClick={submitBetaFeedback}>
                    Lanjut ke Evaluasi Keseluruhan →
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: "var(--font-nunito)", fontSize: "1.1rem", fontWeight: 900, marginBottom: 4, color: "var(--navy)" }}>
                    📊 Evaluasi Keseluruhan
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: 20 }}>
                    Bantu kami meningkatkan akurasi sistem dengan memberikan evaluasi jujur.
                  </div>

                  {/* Rating Kesesuaian */}
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>Seberapa sesuai hasil rekomendasi dengan minat kamu? *</div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => setEvalKesesuaian(n)}
                          style={{
                            width: 44, height: 44, borderRadius: 12, fontSize: "1.1rem", cursor: "pointer", transition: "all .2s",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            border: `2px solid ${evalKesesuaian >= n ? "var(--yellow2)" : "#E2E8F0"}`,
                            background: evalKesesuaian >= n ? "#FEF9C3" : "white",
                            transform: evalKesesuaian >= n ? "scale(1.1)" : "scale(1)",
                          }}
                        >⭐</button>
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--muted)", marginTop: 4 }}>
                      <span>Tidak Sesuai</span><span>Sangat Sesuai</span>
                    </div>
                  </div>

                  {/* Rating Kepuasan */}
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>Seberapa puas kamu dengan hasil rekomendasi? *</div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => setEvalKepuasan(n)}
                          style={{
                            width: 44, height: 44, borderRadius: 12, fontSize: "1.1rem", cursor: "pointer", transition: "all .2s",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            border: `2px solid ${evalKepuasan >= n ? "var(--yellow2)" : "#E2E8F0"}`,
                            background: evalKepuasan >= n ? "#FEF9C3" : "white",
                            transform: evalKepuasan >= n ? "scale(1.1)" : "scale(1)",
                          }}
                        >⭐</button>
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--muted)", marginTop: 4 }}>
                      <span>Tidak Puas</span><span>Sangat Puas</span>
                    </div>
                  </div>

                  {/* Rating Wawasan */}
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>Apakah hasil rekomendasi memberikan wawasan baru? *</div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => setEvalWawasan(n)}
                          style={{
                            width: 44, height: 44, borderRadius: 12, fontSize: "1.1rem", cursor: "pointer", transition: "all .2s",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            border: `2px solid ${evalWawasan >= n ? "var(--yellow2)" : "#E2E8F0"}`,
                            background: evalWawasan >= n ? "#FEF9C3" : "white",
                            transform: evalWawasan >= n ? "scale(1.1)" : "scale(1)",
                          }}
                        >⭐</button>
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--muted)", marginTop: 4 }}>
                      <span>Tidak Sama Sekali</span><span>Sangat Banyak</span>
                    </div>
                  </div>

                  {/* NPS */}
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>Seberapa besar kemungkinan kamu merekomendasikan web ini ke teman? *</div>
                    <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                      {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                        <button key={n} onClick={() => setEvalNps(n)}
                          style={{
                            width: 36, height: 36, borderRadius: 10, fontSize: "0.8rem", fontWeight: 800,
                            cursor: "pointer", transition: "all .2s",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            border: `2px solid ${evalNps === n ? (n <= 6 ? "#EF4444" : n <= 8 ? "#F59E0B" : "#10B981") : "#E2E8F0"}`,
                            background: evalNps === n ? (n <= 6 ? "#FEF2F2" : n <= 8 ? "#FFFBEB" : "#F0FDF4") : "white",
                            color: evalNps === n ? (n <= 6 ? "#EF4444" : n <= 8 ? "#F59E0B" : "#10B981") : "var(--muted)",
                          }}
                        >{n}</button>
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--muted)", marginTop: 4 }}>
                      <span>Sangat Tidak Mungkin</span><span>Sangat Mungkin</span>
                    </div>
                  </div>

                  {/* Jurusan Seharusnya */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>Jurusan apa yang menurut kamu seharusnya muncul tapi tidak ada?</div>
                    {renderJurusanAutocomplete(
                      evalJurusanSeharusnya,
                      'eval_jurusan_seharusnya',
                      'Ketik nama jurusan (opsional)...',
                      (val) => setEvalJurusanSeharusnya(val)
                    )}
                  </div>

                  {/* Komentar */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>Komentar atau masukan lainnya</div>
                    <textarea
                      value={evalKomentar}
                      onChange={(e) => setEvalKomentar(e.target.value)}
                      placeholder="Tulis komentar, masukan, atau saran..."
                      className="input-vibrant"
                      style={{ padding: "12px 14px", minHeight: 80, resize: "none", border: "1px solid #E2E8F0", fontSize: "0.85rem" }}
                    />
                  </div>

                  <button className="btn-primary" onClick={submitSessionEvaluation}>
                    📨 Kirim Evaluasi
                  </button>
                </>
              )}
            </div>
          )}

          {/* Success message after beta feedback sent */}
          {betaFeedbackSent && (
            <div className="glass-panel" style={{ width: "100%", padding: 24, textAlign: "center" }}>
              <CheckCircle2 size={56} color="var(--green)" style={{ margin: "0 auto 12px" }} />
              <div className="text-gradient" style={{ fontFamily: "var(--font-nunito)", fontWeight: 900, fontSize: "1.2rem", marginBottom: 4 }}>
                Terima kasih atas evaluasimu! 🎉
              </div>
              <div style={{ fontSize: "0.9rem", color: "var(--muted)", fontWeight: 600, marginBottom: 4 }}>
                Feedback kamu sangat berarti untuk meningkatkan akurasi rekomendasi.
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--blue2)", fontWeight: 700 }}>
                🧪 Data beta testing berhasil tercatat.
              </div>
            </div>
          )}

          <button id="btn-explore-majors-bottom" className="btn-primary" style={{ display: "flex", gap: 10, alignItems: "center" }} onClick={() => router.push("/explore")}>
            <Search size={20} /> Explore Semua Jurusan
          </button>
          <button id="btn-restart-quiz" className="btn-outline" style={{ display: "flex", gap: 10, alignItems: "center" }} onClick={resetApp}>
            <RotateCcw size={18} /> Mulai Ulang
          </button>
            </>
          )}
        </div>
      )}

      {/* FLOATING COMPARE BAR */}
      {compareList.length > 0 && (
        <div className="compare-floating-bar animate-slide-up" id="compare-floating-bar-result">
          <div className="compare-bar-text">
            ⚖️ Bandingkan ({compareList.length}/2 terpilih)
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button 
              id="btn-cancel-compare-result"
              className="btn-secondary" 
              style={{ padding: "6px 12px", width: "auto", fontSize: "0.8rem" }} 
              onClick={clearCompare}
            >
              Batal
            </button>
            <button 
              id="btn-floating-compare-result"
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
        <div className="compare-modal-overlay" onClick={() => setCompareModalOpen(false)} id="compare-modal-overlay-result">
          <div className="compare-modal-content animate-slide-up" onClick={(e) => e.stopPropagation()} id="compare-modal-content-result">
            <div className="compare-modal-header">
              <div className="compare-modal-title">⚖️ Perbandingan Jurusan</div>
              <button className="compare-modal-close" onClick={() => setCompareModalOpen(false)} id="btn-close-compare-modal-result">✕</button>
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
                      <div className="compare-box" id="compare-box-major-1-result">
                        <div className="compare-val bold">{compareData[0].jurusan}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 800 }}>{compareData[0].kategori}</div>
                      </div>
                      {/* Jurusan 2 */}
                      <div className="compare-box" id="compare-box-major-2-result">
                        <div className="compare-val bold">{compareData[1].jurusan}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 800 }}>{compareData[1].kategori}</div>
                      </div>

                      {/* Skor Match */}
                      <div className="compare-section">
                        <div className="compare-section-title">Match Score</div>
                      </div>
                      <div className="compare-box" style={{ alignItems: "center" }} id="compare-score-box-1-result">
                        <div className="compare-val bold" style={{ color: "var(--blue)" }}>
                          {results.find(r => r.jurusan === compareData[0].jurusan)?.skor ?? 0}%
                        </div>
                      </div>
                      <div className="compare-box" style={{ alignItems: "center" }} id="compare-score-box-2-result">
                        <div className="compare-val bold" style={{ color: "var(--blue)" }}>
                          {results.find(r => r.jurusan === compareData[1].jurusan)?.skor ?? 0}%
                        </div>
                      </div>

                      {/* Estimasi Gaji */}
                      <div className="compare-section">
                        <div className="compare-section-title">Estimasi Gaji</div>
                      </div>
                      <div className="compare-box" id="compare-salary-box-1-result">
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
                      <div className="compare-box" id="compare-salary-box-2-result">
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
                      <div className="compare-box" id="compare-skills-box-1-result">
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
                      <div className="compare-box" id="compare-skills-box-2-result">
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
                      <div className="compare-box" id="compare-desc-box-1-result">
                        <div className="compare-val" style={{ fontSize: "0.78rem" }}>{compareData[0].deskripsi}</div>
                      </div>
                      <div className="compare-box" id="compare-desc-box-2-result">
                        <div className="compare-val" style={{ fontSize: "0.78rem" }}>{compareData[1].deskripsi}</div>
                      </div>

                      {/* Prospek Karir */}
                      <div className="compare-section">
                        <div className="compare-section-title">Prospek Karier</div>
                      </div>
                      <div className="compare-box" id="compare-career-box-1-result">
                        <div className="compare-val" style={{ fontSize: "0.78rem" }}>{compareData[0].karier}</div>
                      </div>
                      <div className="compare-box" id="compare-career-box-2-result">
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

      {/* EXTEND TEST MODAL */}
      {extendModalOpen && (
        <div className="compare-modal-overlay" id="extend-test-modal-overlay">
          <div className="compare-modal-content animate-slide-up" style={{ maxWidth: 450, padding: 32, textAlign: "center" }} id="extend-test-modal-content">
            <div style={{ fontSize: "4rem", marginBottom: 16 }}>🎯</div>
            <h2 className="text-gradient" style={{ fontFamily: "var(--font-nunito)", fontSize: "1.6rem", fontWeight: 900, marginBottom: 12 }}>
              Butuh Sedikit Analisis Tambahan!
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: 24 }}>
              Halo <strong>{userName}</strong>, minatmu terlihat cukup bervariasi dan seimbang (50-50). Kami memerlukan <strong>5 pertanyaan ekstra</strong> untuk membedakan kecocokan jurusanmu secara lebih presisi.
            </p>
            <button 
              id="btn-extend-test-confirm"
              className="btn-primary" 
              onClick={async () => {
                setExtendModalOpen(false);
                setScreen("swipe");
                await fetchNextCard(history, likedTags, dislikedTags, 20);
              }}
            >
              Lanjutkan Tes (+5 Soal)
            </button>
          </div>
        </div>
      )}

      {/* PHASE TRANSITION MODAL */}
      {transitionModalOpen && (
        <div className="compare-modal-overlay" id="transition-modal-overlay">
          <div className="compare-modal-content animate-slide-up" style={{ maxWidth: 450, padding: 32, textAlign: "center" }} id="transition-modal-content">
            <div style={{ fontSize: "4.5rem", marginBottom: 16, filter: "drop-shadow(0 10px 15px rgba(0,0,0,0.15))" }}>🎯</div>
            <h2 className="text-gradient" style={{ fontFamily: "var(--font-nunito)", fontSize: "1.7rem", fontWeight: 900, marginBottom: 12 }}>
              Rumpun Minat Ditemukan!
            </h2>
            <p style={{ color: "var(--text)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: 20 }}>
              Berdasarkan jawabanmu sejauh ini, kamu memiliki potensi dan kecenderungan yang sangat kuat di bidang:
            </p>
            <div style={{
              display: "inline-block",
              background: "var(--blue-light)",
              color: "var(--blue2)",
              fontFamily: "var(--font-nunito)",
              fontWeight: 900,
              fontSize: "1.1rem",
              padding: "10px 24px",
              borderRadius: 16,
              border: "1px solid rgba(59, 130, 246, 0.15)",
              marginBottom: 24,
              boxShadow: "0 4px 12px rgba(59, 130, 246, 0.1)"
            }}>
              {transitionRumpun}
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.5, marginBottom: 24 }}>
              Mari lanjut ke <strong>Fase 2 (+10 pertanyaan detail)</strong> untuk mengerucutkan program studi dan prospek karier yang paling sesuai dengan kepribadianmu.
            </p>
            <button 
              id="btn-transition-confirm"
              className="btn-primary" 
              onClick={() => {
                setTransitionModalOpen(false);
              }}
            >
              Lanjutkan ke Fase 2
            </button>
          </div>
        </div>
      )}

      {/* INTEREST PROFILE DETAIL MODAL */}
      {selectedInterestCategory && INTEREST_DETAILS[selectedInterestCategory] && (
        <div className="detail-modal-overlay" onClick={() => setSelectedInterestCategory(null)} id="interest-modal-overlay">
          <div className="detail-modal-content animate-slide-up" onClick={(e) => e.stopPropagation()} id="interest-modal-content">
            <div className="compare-modal-header">
              <div className="compare-modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>{INTEREST_DETAILS[selectedInterestCategory].icon}</span>
                <span>{INTEREST_DETAILS[selectedInterestCategory].name}</span>
              </div>
              <button className="compare-modal-close" onClick={() => setSelectedInterestCategory(null)} id="btn-close-interest-modal">✕</button>
            </div>
            <div className="compare-modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: "0.92rem", lineHeight: 1.6, color: "var(--text)" }}>
                {INTEREST_DETAILS[selectedInterestCategory].description}
              </p>
              
              <div>
                <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--blue2)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                  Karakteristik Utama:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {INTEREST_DETAILS[selectedInterestCategory].traits.map((t, i) => (
                    <span key={i} style={{ background: "rgba(59, 130, 246, 0.08)", color: "var(--blue2)", padding: "4px 10px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 700 }}>
                      ✓ {t}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--green)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                  Karier Populer:
                </div>
                <ul style={{ paddingLeft: 20, margin: 0, fontSize: "0.88rem", color: "var(--muted)", lineHeight: 1.5 }}>
                  {INTEREST_DETAILS[selectedInterestCategory].careers.map((c, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{c}</li>
                  ))}
                </ul>
              </div>
              
              <button 
                id="btn-goto-explore-interest"
                className="btn-primary" 
                style={{ marginTop: 8 }}
                onClick={() => {
                  router.push(`/explore?interest=${selectedInterestCategory}`);
                  setSelectedInterestCategory(null);
                }}
              >
                Lihat Daftar Jurusan Terkait
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Interest profiles detail database mapping
const INTEREST_DETAILS: Record<string, {
  name: string;
  icon: string;
  description: string;
  traits: string[];
  careers: string[];
}> = {
  stem: {
    name: "Teknologi & Sains (STEM)",
    icon: "💻",
    description: "Kategori ini berfokus pada pemecahan masalah secara logis, pemikiran kritis, dan penerapan metode ilmiah. Sangat cocok bagi individu yang menyukai matematika, coding, analisis data, eksperimen sains, dan rekayasa teknologi.",
    traits: ["Logis & Sistematis", "Gemar Memecahkan Masalah", "Kritis & Analitis", "Suka Bereksperimen"],
    careers: ["Software Engineer", "Data Scientist", "System Analyst", "Peneliti Laboratorium", "Teknisi Mesin/Elektro"]
  },
  bisnis: {
    name: "Bisnis & Keuangan",
    icon: "📈",
    description: "Kategori ini melibatkan pengelolaan sumber daya, analisis pasar, strategi pemasaran, dan perencanaan finansial. Cocok untuk mereka yang menyukai kepemimpinan, negosiasi, kewirausahaan, investasi, dan akuntansi.",
    traits: ["Berjiwa Wirausaha", "Piawai Bernegosiasi", "Strategis & Visioner", "Teliti dengan Angka"],
    careers: ["Financial Analyst", "Pemasar Digital (Digital Marketer)", "Business Developer", "Akuntan Publik", "Wirausahawan"]
  },
  kreatif: {
    name: "Kreatif & Seni",
    icon: "🎨",
    description: "Kategori ini berpusat pada ekspresi diri, estetika, inovasi visual, dan penciptaan karya baru. Sangat cocok bagi orang yang berimajinasi tinggi, menyukai desain grafis, musik, film, sastra, fashion, dan arsitektur.",
    traits: ["Imajinatif & Ekspresif", "Inovatif", "Peka Terhadap Estetika", "Mandiri & Fleksibel"],
    careers: ["Graphic Designer", "Creative Director", "Copywriter/Penulis", "Arsitek", "Kreator Konten (Content Creator)"]
  },
  sosial: {
    name: "Sosial & Hukum",
    icon: "⚖️",
    description: "Kategori ini memfokuskan diri pada hubungan antarmanusia, keadilan sosial, komunikasi publik, hukum, tata negara, kebijakan publik, dan pemahaman budaya. Cocok bagi yang suka bersosialisasi dan membantu sesama.",
    traits: ["Empati Tinggi", "Komunikatif & Persuasif", "Peduli Keadilan Sosial", "Pendengar yang Baik"],
    careers: ["Pengacara/Konsultan Hukum", "Psikolog", "Hubungan Masyarakat (PR)", "Diplomat", "Sosiolog/Peneliti Sosial"]
  },
  kesehatan: {
    name: "Kesehatan & Medis",
    icon: "🏥",
    description: "Kategori ini berkaitan erat dengan perawatan medis, pengobatan penyakit, nutrisi, farmasi, anatomi tubuh, dan pelayanan klinis. Sangat tepat untuk individu yang berdedikasi membantu orang sakit dan menjaga kebugaran tubuh.",
    traits: ["Penuh Kasih Sayang", "Tenang di Bawah Tekanan", "Detail-Oriented", "Suka Menolong"],
    careers: ["Dokter Umum/Spesialis", "Apoteker", "Perawat", "Ahli Gizi", "Fisioterapis"]
  },
  lingkungan: {
    name: "Lingkungan & Alam",
    icon: "🌿",
    description: "Kategori ini mencakup pelestarian alam, pemanfaatan sumber daya bumi secara berkelanjutan, pertanian, kelautan, kehutanan, dan mitigasi perubahan iklim. Sangat cocok bagi pencinta alam bebas dan konservasi lingkungan.",
    traits: ["Peduli Lingkungan", "Suka Kegiatan Outdoor", "Observan terhadap Alam", "Praktis & Solutif"],
    careers: ["Konservasionis Alam", "Agronom/Ahli Pertanian", "Marine Biologist", "Geolog", "Spesialis Kehutanan"]
  }
};
