"use client";

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}>
          <div style={{
            background: "white",
            borderRadius: 24,
            padding: "40px 32px",
            textAlign: "center",
            maxWidth: 440,
            width: "100%",
            boxShadow: "0 10px 30px rgba(59, 130, 246, 0.12)",
            border: "1px solid rgba(255,255,255,0.8)",
          }}>
            <div style={{ fontSize: "4rem", marginBottom: 16 }}>😵</div>
            <h2 style={{
              fontFamily: "var(--font-nunito), sans-serif",
              fontSize: "1.5rem",
              fontWeight: 900,
              marginBottom: 12,
              background: "linear-gradient(135deg, #2563EB, #8B5CF6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              Oops, terjadi kesalahan!
            </h2>
            <p style={{
              color: "#64748B",
              fontSize: "0.95rem",
              lineHeight: 1.6,
              marginBottom: 24,
            }}>
              Maaf, terjadi kesalahan yang tidak terduga. Silakan muat ulang halaman untuk mencoba lagi.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{
                width: "100%",
                padding: "14px 24px",
                background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
                color: "white",
                border: "none",
                borderRadius: 16,
                fontFamily: "var(--font-nunito), sans-serif",
                fontSize: "1rem",
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(59, 130, 246, 0.4)",
              }}
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
