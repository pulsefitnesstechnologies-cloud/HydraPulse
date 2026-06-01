import { useState, useEffect, useCallback } from "react";
import "./_group.css";

const WEEK_MESSAGES: Record<number, { headline: string; badge: string; sub: string }> = {
  7:  { headline: "Perfect week!",        badge: "7 / 7",  sub: "Not a single day missed. Outstanding." },
  6:  { headline: "Almost perfect!",      badge: "6 / 7",  sub: "One missed day — still elite." },
  5:  { headline: "Strong week",          badge: "5 / 7",  sub: "Keep pushing — you're nearly there." },
  4:  { headline: "Halfway there",        badge: "4 / 7",  sub: "A solid foundation. Build on it." },
};

function getMessage(days: number) {
  return (
    WEEK_MESSAGES[days] ?? {
      headline: `${days} days this week`,
      badge: `${days} / 7`,
      sub: "Every scan counts. Keep the momentum.",
    }
  );
}

const PRESETS = [4, 5, 6, 7];

export function WeeklyReward() {
  const [days, setDays] = useState(7);
  const [animKey, setAnimKey] = useState(0);
  const [phase, setPhase] = useState<"in" | "hold" | "out" | "idle">("idle");

  const play = useCallback((d?: number) => {
    if (d !== undefined) setDays(d);
    setPhase("idle");
    requestAnimationFrame(() => {
      setAnimKey((k) => k + 1);
      setPhase("in");
    });
  }, []);

  useEffect(() => {
    if (phase === "in")   { const t = setTimeout(() => setPhase("hold"), 500); return () => clearTimeout(t); }
    if (phase === "hold") { const t = setTimeout(() => setPhase("out"),  3200); return () => clearTimeout(t); }
    if (phase === "out")  { const t = setTimeout(() => setPhase("idle"), 350);  return () => clearTimeout(t); }
  }, [phase]);

  useEffect(() => { play(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const msg = getMessage(days);
  const visible = phase !== "idle";
  const isPerfect = days === 7;

  return (
    <div className="min-h-screen bg-[#080D12] flex flex-col items-center justify-center gap-6 p-6 select-none">

      {/* Backdrop */}
      <div
        className="fixed inset-0 pointer-events-none transition-colors duration-300"
        style={{ backgroundColor: visible ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0)", zIndex: 10 }}
      />

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
              borderColor: isPerfect ? "rgba(16,185,129,0.35)" : "rgba(14,165,233,0.25)",
              boxShadow: isPerfect
                ? "0 0 80px rgba(16,185,129,0.14), 0 24px 48px rgba(0,0,0,0.5)"
                : "0 0 60px rgba(14,165,233,0.1), 0 24px 48px rgba(0,0,0,0.5)",
              animation: phase === "out"
                ? "celebOut 0.35s ease forwards"
                : "celebIn 0.5s cubic-bezier(0.34,1.48,0.64,1) forwards",
            }}
          >
            {/* Person drinking water image */}
            <div className="relative w-full overflow-hidden" style={{ height: 220 }}>
              <img
                src="/__mockup/images/drinking-water.png"
                alt="Person drinking water"
                className="w-full h-full object-cover"
                style={{
                  animation: phase === "in" ? "geyserZoom 3.5s ease-out forwards" : undefined,
                  filter: isPerfect ? "brightness(1.05) saturate(1.1)" : "brightness(0.95)",
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to bottom, rgba(0,0,0,0) 30%, #0D1520 100%)`,
                }}
              />
              {/* Week badge */}
              <div
                className="absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-bold tracking-wide"
                style={{
                  backgroundColor: isPerfect ? "rgba(16,185,129,0.9)" : "rgba(14,165,233,0.85)",
                  color: "#fff",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Weekly Review
              </div>
            </div>

            {/* Content */}
            <div className="flex flex-col items-center gap-2 px-7 pb-7 pt-3">
              {/* Days count */}
              <div className="flex items-baseline gap-1">
                <span
                  className="font-black leading-none"
                  style={{
                    fontSize: 56,
                    color: isPerfect ? "#10B981" : "#0EA5E9",
                    fontFamily: "'Inter', sans-serif",
                    letterSpacing: -2,
                    lineHeight: 1,
                  }}
                >
                  {days}
                </span>
                <span
                  className="font-semibold"
                  style={{ fontSize: 22, color: "#334155", fontFamily: "'Inter', sans-serif" }}
                >
                  / 7
                </span>
              </div>

              <span
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: isPerfect ? "#10B981" : "#0EA5E9", fontFamily: "'Inter', sans-serif" }}
              >
                days this week
              </span>

              <span
                className="text-lg font-bold text-center mt-1"
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

              {/* Day dots */}
              <div className="flex gap-2 mt-2">
                {Array.from({ length: 7 }).map((_, i) => {
                  const filled = i < days;
                  return (
                    <div
                      key={i}
                      className="rounded-full flex items-center justify-center"
                      style={{
                        width: 28, height: 28,
                        backgroundColor: filled
                          ? isPerfect ? "rgba(16,185,129,0.2)" : "rgba(14,165,233,0.15)"
                          : "rgba(255,255,255,0.04)",
                        border: filled
                          ? `1.5px solid ${isPerfect ? "#10B981" : "#0EA5E9"}`
                          : "1.5px solid rgba(255,255,255,0.08)",
                        animation: filled ? `dotPop 0.3s ${i * 0.06}s ease both` : undefined,
                      }}
                    >
                      {filled && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill={isPerfect ? "#10B981" : "#0EA5E9"}>
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>

              <span className="text-xs mt-2" style={{ color: "#475569", fontFamily: "'Inter', sans-serif" }}>
                Tap to dismiss
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="relative z-30 flex flex-col items-center gap-4 mt-auto">
        <p className="text-[#475569] text-xs uppercase tracking-widest">Days not missed</p>
        <div className="flex gap-2">
          {PRESETS.map((n) => (
            <button
              key={n}
              onClick={() => play(n)}
              className="rounded-full px-4 py-1.5 text-sm font-semibold transition-all"
              style={{
                backgroundColor: days === n
                  ? (n === 7 ? "#10B981" : "#0EA5E9")
                  : (n === 7 ? "rgba(16,185,129,0.1)" : "rgba(14,165,233,0.1)"),
                color: days === n ? "#fff" : (n === 7 ? "#10B981" : "#0EA5E9"),
                border: `1px solid ${n === 7 ? "rgba(16,185,129,0.3)" : "rgba(14,165,233,0.25)"}`,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {n}/7
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
