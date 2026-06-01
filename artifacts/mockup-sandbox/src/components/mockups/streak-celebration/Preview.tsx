import { useState, useEffect, useCallback } from "react";
import "./_group.css";

const MILESTONE_MESSAGES: Record<number, { headline: string; sub: string }> = {
  3:  { headline: "3 days in a row!",  sub: "You're building a real habit." },
  7:  { headline: "One full week!",     sub: "Consistency is paying off." },
  14: { headline: "Two weeks strong!", sub: "Your body is thanking you." },
  30: { headline: "30 day streak!",    sub: "Elite-level consistency." },
};

function getMessage(streak: number) {
  return MILESTONE_MESSAGES[streak] ?? { headline: `${streak} day streak!`, sub: "Keep scanning every day." };
}

const PRESETS = [2, 3, 7, 14, 30];

export function Preview() {
  const [streak, setStreak] = useState(7);
  const [animKey, setAnimKey] = useState(0);
  const [phase, setPhase] = useState<"in" | "hold" | "out" | "idle">("idle");

  const play = useCallback((s?: number) => {
    if (s !== undefined) setStreak(s);
    setPhase("idle");
    requestAnimationFrame(() => {
      setAnimKey((k) => k + 1);
      setPhase("in");
    });
  }, []);

  useEffect(() => {
    if (phase === "in")   { const t = setTimeout(() => setPhase("hold"), 500); return () => clearTimeout(t); }
    if (phase === "hold") { const t = setTimeout(() => setPhase("out"),  2800); return () => clearTimeout(t); }
    if (phase === "out")  { const t = setTimeout(() => setPhase("idle"), 350); return () => clearTimeout(t); }
  }, [phase]);

  useEffect(() => { play(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const msg = getMessage(streak);
  const visible = phase !== "idle";

  return (
    <div className="min-h-screen bg-[#080D12] flex flex-col items-center justify-center gap-6 p-6 select-none">

      {/* Backdrop */}
      <div
        className="fixed inset-0 pointer-events-none transition-colors duration-300"
        style={{ backgroundColor: visible ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0)", zIndex: 10 }}
      />

      {/* Card */}
      {visible && (
        <div
          key={animKey}
          className="fixed inset-0 flex items-center justify-center px-8 z-20"
          style={{ pointerEvents: "none" }}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-[28px] border"
            style={{
              backgroundColor: "#0D1520",
              borderColor: "rgba(14,165,233,0.3)",
              boxShadow: "0 0 80px rgba(14,165,233,0.12), 0 24px 48px rgba(0,0,0,0.5)",
              animation: phase === "out"
                ? "celebOut 0.35s ease forwards"
                : "celebIn 0.5s cubic-bezier(0.34,1.48,0.64,1) forwards",
            }}
          >
            {/* Geyser image */}
            <div className="relative w-full overflow-hidden" style={{ height: 220 }}>
              <img
                src="/__mockup/images/geyser.png"
                alt="Geyser"
                className="w-full h-full object-cover"
                style={{
                  animation: phase === "in" ? "geyserZoom 3.2s ease-out forwards" : undefined,
                }}
              />
              {/* Overlay gradient */}
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0) 40%, #0D1520 100%)" }}
              />
              {/* Day badge */}
              <div
                className="absolute top-3 right-3 rounded-full px-3 py-1 text-xs font-bold tracking-wide"
                style={{ backgroundColor: "rgba(14,165,233,0.9)", color: "#fff", fontFamily: "'Inter', sans-serif" }}
              >
                Day {streak}
              </div>
            </div>

            {/* Content */}
            <div className="flex flex-col items-center gap-2 px-7 pb-7 pt-3">
              <span
                className="font-black leading-none"
                style={{ fontSize: 60, color: "#0EA5E9", fontFamily: "'Inter', sans-serif", letterSpacing: -2, lineHeight: 1 }}
              >
                {streak}
              </span>
              <span
                className="text-lg font-bold text-center"
                style={{ color: "#F1F5F9", fontFamily: "'Inter', sans-serif" }}
              >
                {msg.headline}
              </span>
              <span
                className="text-sm text-center leading-snug"
                style={{ color: "#64748B", fontFamily: "'Inter', sans-serif" }}
              >
                {msg.sub}
              </span>
              <div className="flex gap-1 mt-2">
                {Array.from({ length: Math.min(streak, 7) }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full"
                    style={{
                      width: 8, height: 8,
                      backgroundColor: "#0EA5E9",
                      opacity: 0.4 + (i / Math.min(streak, 7)) * 0.6,
                      animation: `dotPop 0.3s ${i * 0.05}s ease both`,
                    }}
                  />
                ))}
              </div>
              <span className="text-xs mt-1" style={{ color: "#475569", fontFamily: "'Inter', sans-serif" }}>
                Tap to dismiss
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="relative z-30 flex flex-col items-center gap-4 mt-auto">
        <p className="text-[#475569] text-xs uppercase tracking-widest">Preview streak value</p>
        <div className="flex gap-2 flex-wrap justify-center">
          {PRESETS.map((n) => (
            <button
              key={n}
              onClick={() => play(n)}
              className="rounded-full px-4 py-1.5 text-sm font-semibold transition-all"
              style={{
                backgroundColor: streak === n ? "#0EA5E9" : "rgba(14,165,233,0.1)",
                color: streak === n ? "#fff" : "#0EA5E9",
                border: "1px solid rgba(14,165,233,0.25)",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {n}d
            </button>
          ))}
        </div>
        <button
          onClick={() => play()}
          className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold"
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            color: "#94A3B8",
            border: "1px solid rgba(255,255,255,0.08)",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
          </svg>
          Replay
        </button>
      </div>
    </div>
  );
}
