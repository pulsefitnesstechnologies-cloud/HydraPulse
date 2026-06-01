import { useState, useEffect, useCallback } from "react";
import "./_group.css";

const MILESTONE_MESSAGES: Record<number, { headline: string; sub: string }> = {
  3:  { headline: "3 days in a row!",  sub: "You're building a real habit." },
  7:  { headline: "One full week!",     sub: "Consistency is paying off." },
  14: { headline: "Two weeks strong!", sub: "Your body is thanking you." },
  30: { headline: "30 day streak!",    sub: "Elite-level consistency." },
};

function getMessage(streak: number) {
  return (
    MILESTONE_MESSAGES[streak] ?? {
      headline: `${streak} day streak!`,
      sub: "Keep scanning every day.",
    }
  );
}

const PRESETS = [2, 3, 7, 14, 30];

export function Preview() {
  const [streak, setStreak] = useState(7);
  const [animKey, setAnimKey] = useState(0);
  const [phase, setPhase] = useState<"in" | "hold" | "out" | "idle">("in");

  const play = useCallback((s?: number) => {
    if (s !== undefined) setStreak(s);
    setPhase("idle");
    // tick needed so CSS re-triggers
    requestAnimationFrame(() => {
      setAnimKey((k) => k + 1);
      setPhase("in");
    });
  }, []);

  // auto-advance from "in" → "hold" → "out" → "idle"
  useEffect(() => {
    if (phase === "in") {
      const t = setTimeout(() => setPhase("hold"), 400);
      return () => clearTimeout(t);
    }
    if (phase === "hold") {
      const t = setTimeout(() => setPhase("out"), 2800);
      return () => clearTimeout(t);
    }
    if (phase === "out") {
      const t = setTimeout(() => setPhase("idle"), 300);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // auto-play on mount
  useEffect(() => { play(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const msg = getMessage(streak);
  const visible = phase === "in" || phase === "hold" || phase === "out";

  return (
    <div className="min-h-screen bg-[#0A0F14] flex flex-col items-center justify-center gap-8 p-8 select-none">

      {/* Modal overlay */}
      <div
        className="fixed inset-0 flex items-center justify-center px-10 pointer-events-none"
        style={{
          backgroundColor: visible ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0)",
          transition: "background-color 0.3s ease",
          zIndex: 10,
        }}
      >
        {visible && (
          <div
            key={animKey}
            className="w-full max-w-sm pointer-events-auto"
            style={{
              animation:
                phase === "out"
                  ? "celebFadeOut 0.28s ease forwards"
                  : "celebSpringIn 0.42s cubic-bezier(0.34,1.56,0.64,1) forwards",
            }}
          >
            <div
              className="rounded-[28px] border p-8 flex flex-col items-center gap-2"
              style={{
                backgroundColor: "#111827",
                borderColor: "rgba(16,185,129,0.25)",
                boxShadow: "0 0 60px rgba(16,185,129,0.08)",
              }}
            >
              {/* Flame icon */}
              <div
                className="w-[72px] h-[72px] rounded-[22px] flex items-center justify-center mb-1"
                style={{ backgroundColor: "rgba(16,185,129,0.1)" }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="#10B981">
                  <path d="M12 2C9.5 4.5 8 7.5 8 10c0 1.38.56 2.63 1.46 3.54A3 3 0 0 1 12 11c.83 0 1.58.34 2.12.88C15.02 11.25 16 9.75 16 8c0-2.5-1.5-5-4-6zM10 20c0 1.1.9 2 2 2s2-.9 2-2c0-.7-.36-1.32-.9-1.68C12.74 18.12 12 16.65 12 15c-.83.97-1.5 2.14-1.5 3.5 0 .18.01.35.03.52C10.22 19.23 10 19.6 10 20z"/>
                  <path d="M17.83 8.18A8.99 8.99 0 0 1 18 9.5c0 3.27-1.77 6.13-4.39 7.64C14.47 17.68 15 18.77 15 20c0 1.66-1.34 3-3 3s-3-1.34-3-3c0-1.23.53-2.32 1.39-3.07A9.03 9.03 0 0 1 6 9.5c0-1.08.2-2.12.55-3.08C5.56 7.64 5 9 5 10.5c0 3.87 3.13 7 7 7s7-3.13 7-7c0-1.01-.22-1.97-.6-2.84l-.57.52z" opacity="0"/>
                </svg>
              </div>

              {/* Big streak number */}
              <span
                className="font-black leading-none"
                style={{
                  fontSize: 64,
                  color: "#10B981",
                  fontFamily: "'Inter', sans-serif",
                  lineHeight: 1,
                  letterSpacing: -2,
                }}
              >
                {streak}
              </span>

              {/* Headline */}
              <span
                className="text-xl font-bold text-center mt-1"
                style={{ color: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}
              >
                {msg.headline}
              </span>

              {/* Sub */}
              <span
                className="text-sm text-center leading-snug"
                style={{ color: "#9CA3AF", fontFamily: "'Inter', sans-serif" }}
              >
                {msg.sub}
              </span>

              {/* Dismiss hint */}
              <span
                className="text-xs mt-2"
                style={{ color: "#6B7280", fontFamily: "'Inter', sans-serif" }}
              >
                Tap to dismiss
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Controls (below the modal) */}
      <div className="relative z-20 flex flex-col items-center gap-5 mt-auto pt-4">
        <p className="text-[#6B7280] text-xs uppercase tracking-widest">
          Preview streak value
        </p>

        <div className="flex gap-2 flex-wrap justify-center">
          {PRESETS.map((n) => (
            <button
              key={n}
              onClick={() => play(n)}
              className="rounded-full px-4 py-2 text-sm font-semibold transition-all"
              style={{
                backgroundColor: streak === n ? "#10B981" : "rgba(16,185,129,0.12)",
                color: streak === n ? "#fff" : "#10B981",
                border: "1px solid rgba(16,185,129,0.3)",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {n} {n === 1 ? "day" : "days"}
            </button>
          ))}
        </div>

        <button
          onClick={() => play()}
          className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            color: "#D1D5DB",
            border: "1px solid rgba(255,255,255,0.1)",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
          </svg>
          Replay
        </button>
      </div>
    </div>
  );
}
