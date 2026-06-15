"use client";

import React, { useState } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";

export interface CardData {
  id: string;
  text: string;
  tags?: string[];
}

interface SwipeCardProps {
  card: CardData;
  onSwipe: (liked: boolean) => void;
  index: number; // 0 for front card, 1 for back
}

export default function SwipeCard({ card, onSwipe, index }: SwipeCardProps) {
  const [exitX, setExitX] = useState(0);
  const x = useMotionValue(0);

  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  // Stamp opacities
  const nopeOpacity = useTransform(x, [-100, -50, 0], [1, 0, 0]);
  const likeOpacity = useTransform(x, [0, 50, 100], [0, 0, 1]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 100) {
      setExitX(250);
      onSwipe(true);
    } else if (info.offset.x < -100) {
      setExitX(-250);
      onSwipe(false);
    }
  };

  const isFront = index === 0;

  return (
    <motion.div
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        background: "white",
        borderRadius: 24,
        boxShadow: isFront ? "0 16px 40px rgba(59,130,246,.15), 0 4px 12px rgba(0,0,0,.05)" : "none",
        border: "1px solid rgba(226, 232, 240, 0.8)",
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        cursor: isFront ? "grab" : "auto",
        zIndex: isFront ? 10 : 0,
        x: isFront ? x : 0,
        rotate: isFront ? rotate : 0,
        opacity: isFront ? opacity : 1,
        scale: isFront ? 1 : 0.96,
        y: isFront ? 0 : 8,
      }}
      drag={isFront ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileTap={isFront ? { cursor: "grabbing", scale: 0.98 } : {}}
      animate={exitX ? { x: exitX, opacity: 0 } : {}}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {isFront && (
        <>
          <motion.div
            style={{
              position: "absolute",
              top: 24,
              left: 20,
              opacity: likeOpacity,
              color: "#10B981",
              border: "3px solid #10B981",
              borderRadius: 12,
              padding: "6px 18px",
              fontWeight: 900,
              fontSize: "1.2rem",
              fontFamily: "var(--font-nunito)",
              transform: "rotate(-12deg)",
              letterSpacing: 2,
              pointerEvents: "none",
              boxShadow: "0 0 20px rgba(16,185,129,.4), inset 0 0 10px rgba(16,185,129,.2)",
              textShadow: "0 0 8px rgba(16,185,129,.4)",
              background: "rgba(255,255,255,0.8)",
              backdropFilter: "blur(4px)"
            }}
          >
            IYA
          </motion.div>
          <motion.div
            style={{
              position: "absolute",
              top: 24,
              right: 20,
              opacity: nopeOpacity,
              color: "#EF4444",
              border: "3px solid #EF4444",
              borderRadius: 12,
              padding: "6px 18px",
              fontWeight: 900,
              fontSize: "1.2rem",
              fontFamily: "var(--font-nunito)",
              transform: "rotate(12deg)",
              letterSpacing: 2,
              pointerEvents: "none",
              boxShadow: "0 0 20px rgba(239,68,68,.4), inset 0 0 10px rgba(239,68,68,.2)",
              textShadow: "0 0 8px rgba(239,68,68,.4)",
              background: "rgba(255,255,255,0.8)",
              backdropFilter: "blur(4px)"
            }}
          >
            TIDAK
          </motion.div>
        </>
      )}

      <div style={{
        fontSize: "0.72rem",
        fontWeight: 800,
        color: "#2563EB",
        letterSpacing: "1.5px",
        textTransform: "uppercase",
        marginBottom: 10,
      }}>
        Pertanyaan
      </div>
      <div style={{
        fontFamily: "var(--font-nunito)",
        fontSize: "1.15rem",
        fontWeight: 800,
        lineHeight: 1.5,
        color: "#1E293B",
      }}>
        {card.text}
      </div>
    </motion.div>
  );
}
