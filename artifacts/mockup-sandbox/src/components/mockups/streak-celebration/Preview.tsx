import { useState, useEffect, useCallback, useRef } from "react";
import "./_group.css";

const MILESTONE: Record<number, { headline: string; sub: string }> = {
  3:  { headline: "3 days in a row!",  sub: "You're building a real habit." },
  7:  { headline: "One full week!",     sub: "Consistency is paying off." },
  14: { headline: "Two weeks strong!", sub: "Your body is thanking you." },
  30: { headline: "30 day streak!",    sub: "Elite-level consistency." },
};
const msg = (n: number) => MILESTONE[n] ?? { headline: `${n} day streak!`, sub: "Keep scanning every day." };

const PRESETS = [2, 3, 7, 14, 30];

// ── Geyser drop config ────────────────────────────────────────────────────────
// Each drop has an angle (degrees from straight up), speed, size, and delay
const DROPS = [
  ...Array.from({ length: 12 }, (_, i) => {
    const spread = 50; // ±50° from vertical
    const angle  = -90 + (i - 5.5) * (spread / 6);
    return { angle, speed: 0.7 + Math.random() * 0.6, size: 4 + Math.random() * 6, delay: Math.random() * 0.9 };
  }),
  ...Array.from({ length: 8 }, (_, i) => {
    const angle = -90 + (i - 3.5) * 14;
    return { angle, speed: 0.5 + Math.random() * 0.4, size: 3 + Math.random() * 4, delay: 0.2 + Math.random() * 0.7 };
  }),
];

function GeyserScene({ active }: { active: boolean }) {
  return (
    <div className="geyser-scene" style={{ position: "relative", width: "100%", height: 220, overflow: "hidden", backgroundColor: "#060C16" }}>
      {/* Sky gradient */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 120%, #0D2844 0%, #060C16 70%)" }} />

      {/* Stars */}
      {[
        [15,18],[45,8],[70,22],[88,12],[30,35],[60,30],[80,42],[20,50],
        [50,55],[92,38],[10,60],[72,15],[38,65],[85,58],[25,75],
      ].map(([x, y], i) => (
        <div key={i} style={{
          position: "absolute", left: `${x}%`, top: `${y}%`,
          width: 2, height: 2, borderRadius: "50%",
          backgroundColor: "#fff",
          opacity: 0.35 + (i % 3) * 0.2,
          animation: `starTwinkle ${1.8 + (i % 5) * 0.4}s ${(i % 7) * 0.3}s ease-in-out infinite alternate`,
        }} />
      ))}

      {/* Geyser vent glow */}
      <div style={{
        position: "absolute", bottom: 44, left: "50%", transform: "translateX(-50%)",
        width: 40, height: 40, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(147,210,255,0.55) 0%, transparent 70%)",
        animation: active ? "ventPulse 0.7s ease-in-out infinite alternate" : undefined,
      }} />

      {/* Main water column */}
      <div style={{
        position: "absolute", bottom: 54, left: "50%", transform: "translateX(-50%)",
        width: 18, transformOrigin: "bottom center",
        background: "linear-gradient(to top, rgba(147,210,255,0.9), rgba(147,210,255,0.15))",
        borderRadius: "9px 9px 4px 4px",
        animation: active ? "columnSurge 0.65s ease-in-out infinite alternate" : "none",
        height: active ? undefined : 20,
      }} />

      {/* Secondary column shimmer */}
      <div style={{
        position: "absolute", bottom: 54, left: "50%", transform: "translateX(-50%)",
        width: 10,
        background: "linear-gradient(to top, rgba(255,255,255,0.8), rgba(255,255,255,0))",
        borderRadius: "5px 5px 2px 2px",
        animation: active ? "columnSurge2 0.65s 0.1s ease-in-out infinite alternate" : "none",
        height: active ? undefined : 12,
      }} />

      {/* Spray droplets */}
      {active && DROPS.map((d, i) => {
        const rad = (d.angle * Math.PI) / 180;
        const tx  = Math.cos(rad) * 120 * d.speed;
        const ty  = Math.sin(rad) * 120 * d.speed;
        return (
          <div key={i} style={{
            position: "absolute",
            bottom: 80,
            left: "50%",
            width: d.size,
            height: d.size,
            marginLeft: -d.size / 2,
            borderRadius: "50%",
            backgroundColor: i % 3 === 0 ? "rgba(147,210,255,0.9)" : "rgba(255,255,255,0.85)",
            animationName: "dropFly",
            animationDuration: `${0.9 + d.speed * 0.5}s`,
            animationDelay: `${d.delay}s`,
            animationTimingFunction: "cubic-bezier(0.2,0.8,0.5,1)",
            animationIterationCount: "infinite",
            ["--tx" as string]: `${tx}px`,
            ["--ty" as string]: `${ty}px`,
          }} />
        );
      })}

      {/* Mist cloud at top of column */}
      {active && (
        <div style={{
          position: "absolute", bottom: 130, left: "50%", transform: "translateX(-50%)",
          width: 80, height: 40,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(147,210,255,0.25) 0%, transparent 70%)",
          filter: "blur(6px)",
          animation: "mistPulse 1.1s ease-in-out infinite alternate",
        }} />
      )}

      {/* Rock base */}
      <div style={{
        position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: 140, height: 58,
        background: "radial-gradient(ellipse at 50% 100%, #1C2535 0%, #0E151F 100%)",
        borderRadius: "50% 50% 0 0",
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: 200, height: 28,
        background: "linear-gradient(to top, #0E151F, #131D2A)",
        borderRadius: "50% 50% 0 0",
      }} />

      {/* Rock crack / vent opening */}
      <div style={{
        position: "absolute", bottom: 48, left: "50%", transform: "translateX(-50%)",
        width: 16, height: 10,
        background: "radial-gradient(ellipse, rgba(147,210,255,0.6) 0%, #080E18 70%)",
        borderRadius: "50%",
        boxShadow: active ? "0 0 12px 4px rgba(147,210,255,0.4)" : "none",
      }} />

      {/* Overlay gradient fade to card bg */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, transparent 55%, #0D1520 100%)",
        pointerEvents: "none",
      }} />
    </div>
  );
}

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
    if (phase === "hold") { const t = setTimeout(() => setPhase("out"),  3000); return () => clearTimeout(t); }
    if (phase === "out")  { const t = setTimeout(() => setPhase("idle"), 350);  return () => clearTimeout(t); }
  }, [phase]);

  useEffect(() => { play(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const m       = msg(streak);
  const visible = phase !== "idle";

  return (
    <div className="min-h-screen bg-[#080D12] flex flex-col items-center justify-center gap-6 p-6 select-none">
      {/* Backdrop */}
      <div className="fixed inset-0 pointer-events-none transition-colors duration-300"
           style={{ backgroundColor: visible ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0)", zIndex: 10 }} />

      {visible && (
        <div key={animKey} className="fixed inset-0 flex items-center justify-center px-8 z-20"
             style={{ pointerEvents: "none" }}>
          <div className="w-full max-w-sm overflow-hidden rounded-[28px] border"
               style={{
                 backgroundColor: "#0D1520",
                 borderColor: "rgba(14,165,233,0.3)",
                 boxShadow: "0 0 80px rgba(14,165,233,0.12), 0 24px 48px rgba(0,0,0,0.5)",
                 animation: phase === "out"
                   ? "celebOut 0.35s ease forwards"
                   : "celebIn 0.5s cubic-bezier(0.34,1.48,0.64,1) forwards",
               }}>

            {/* Animated geyser */}
            <GeyserScene active={phase === "hold"} />

            {/* Day badge overlay */}
            <div style={{
              position: "relative", marginTop: -28, marginRight: 12,
              display: "flex", justifyContent: "flex-end",
            }}>
              <span style={{
                backgroundColor: "rgba(14,165,233,0.92)", color: "#fff",
                fontSize: 11, fontWeight: 700, letterSpacing: 1,
                padding: "3px 10px", borderRadius: 99,
                fontFamily: "'Inter', sans-serif",
              }}>DAY {streak}</span>
            </div>

            {/* Content */}
            <div className="flex flex-col items-center gap-2 px-7 pb-7 pt-2">
              <span style={{ fontSize: 60, color: "#0EA5E9", fontFamily: "'Inter', sans-serif",
                fontWeight: 900, letterSpacing: -2, lineHeight: 1 }}>
                {streak}
              </span>
              <span style={{ fontSize: 18, color: "#F1F5F9", fontFamily: "'Inter', sans-serif",
                fontWeight: 700, textAlign: "center" }}>
                {m.headline}
              </span>
              <span style={{ fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif",
                textAlign: "center", lineHeight: 1.4 }}>
                {m.sub}
              </span>
              {/* Day dots */}
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                {Array.from({ length: Math.min(streak, 7) }).map((_, i) => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: "50%",
                    backgroundColor: "#0EA5E9",
                    opacity: 0.3 + (i / Math.min(streak, 7)) * 0.7,
                    animation: `dotPop 0.3s ${i * 0.05}s ease both`,
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 11, color: "#475569", fontFamily: "'Inter', sans-serif", marginTop: 4 }}>
                Tap to dismiss
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="relative z-30 flex flex-col items-center gap-4 mt-auto">
        <p style={{ color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: 3, fontFamily: "'Inter',sans-serif" }}>
          Preview streak day
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {PRESETS.map((n) => (
            <button key={n} onClick={() => play(n)} style={{
              borderRadius: 99, padding: "6px 16px", fontSize: 13, fontWeight: 600,
              backgroundColor: streak === n ? "#0EA5E9" : "rgba(14,165,233,0.1)",
              color: streak === n ? "#fff" : "#0EA5E9",
              border: "1px solid rgba(14,165,233,0.25)",
              fontFamily: "'Inter', sans-serif", cursor: "pointer",
            }}>
              Day {n}
            </button>
          ))}
        </div>
        <button onClick={() => play()} style={{
          display: "flex", alignItems: "center", gap: 6,
          borderRadius: 99, padding: "8px 20px", fontSize: 13, fontWeight: 600,
          backgroundColor: "rgba(255,255,255,0.05)", color: "#94A3B8",
          border: "1px solid rgba(255,255,255,0.08)", fontFamily: "'Inter', sans-serif", cursor: "pointer",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
          </svg>
          Replay
        </button>
      </div>
    </div>
  );
}
