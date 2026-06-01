import { useState, useEffect, useCallback } from "react";
import "./_group.css";

const MILESTONE: Record<number, { headline: string; sub: string }> = {
  3:  { headline: "3 days in a row!",  sub: "You're building a real habit." },
  7:  { headline: "One full week!",     sub: "Consistency is paying off." },
  14: { headline: "Two weeks strong!", sub: "Your body is thanking you." },
  30: { headline: "30 day streak!",    sub: "Elite-level consistency." },
};
const msg = (n: number) => MILESTONE[n] ?? { headline: `${n} day streak!`, sub: "Keep scanning every day." };

const PRESETS = [2, 3, 7, 14, 30];

// ── Water jet config ──────────────────────────────────────────────────────────
// angleDeg = degrees from vertical (0 = straight up, +right, -left)
// Each jet spawns `count` drops with staggered animation delays.
const JETS = [
  // Central column — thick, fast, very elongated
  { angleDeg:   0, reach: 155, count: 8, w: 4,  h: 28, speed: 0.38 },
  { angleDeg:   0, reach: 140, count: 5, w: 3,  h: 22, speed: 0.42 },
  // Inner fan — clear upward streams
  { angleDeg: -12, reach: 130, count: 5, w: 3,  h: 20, speed: 0.40 },
  { angleDeg:  12, reach: 130, count: 5, w: 3,  h: 20, speed: 0.40 },
  { angleDeg: -24, reach: 110, count: 4, w: 3,  h: 17, speed: 0.45 },
  { angleDeg:  24, reach: 110, count: 4, w: 3,  h: 17, speed: 0.45 },
  // Mid fan
  { angleDeg: -38, reach: 88,  count: 3, w: 2,  h: 13, speed: 0.50 },
  { angleDeg:  38, reach: 88,  count: 3, w: 2,  h: 13, speed: 0.50 },
  // Outer spray — finer drops
  { angleDeg: -55, reach: 68,  count: 3, w: 2,  h: 10, speed: 0.55 },
  { angleDeg:  55, reach: 68,  count: 3, w: 2,  h: 10, speed: 0.55 },
  { angleDeg: -72, reach: 48,  count: 2, w: 2,  h: 8,  speed: 0.60 },
  { angleDeg:  72, reach: 48,  count: 2, w: 2,  h: 8,  speed: 0.60 },
];

// Precompute all drops so we don't recalculate on every render
const ALL_DROPS = JETS.flatMap(({ angleDeg, reach, count, w, h, speed }) => {
  const rad = (angleDeg * Math.PI) / 180;
  const tx  = reach * Math.sin(rad);   // x displacement
  const ty  = -reach * Math.cos(rad);  // y displacement (up = negative)
  return Array.from({ length: count }, (_, i) => ({
    tx, ty, w, h, speed,
    delay: (i / count) * speed,          // evenly stagger within the jet cycle
    rotate: angleDeg,
    // Brightness varies slightly per drop for visual interest
    opacity: 0.75 + (i % 3) * 0.08,
  }));
});

function GeyserScene({ active }: { active: boolean }) {
  return (
    <div
      style={{
        position: "relative", width: "100%", height: 220,
        overflow: "hidden", backgroundColor: "#040912",
      }}
    >
      {/* Sky gradient */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 50% 110%, #07233A 0%, #040912 65%)",
      }} />

      {/* Stars */}
      {([
        [8,12],[22,5],[40,18],[58,8],[75,20],[90,10],
        [15,32],[33,25],[52,38],[68,28],[82,35],[95,22],
        [5,50],[28,45],[47,55],[65,48],[88,50],[12,65],
      ] as [number,number][]).map(([x, y], i) => (
        <div key={i} style={{
          position: "absolute", left: `${x}%`, top: `${y}%`,
          width: i % 4 === 0 ? 2 : 1.5,
          height: i % 4 === 0 ? 2 : 1.5,
          borderRadius: "50%",
          backgroundColor: "#fff",
          opacity: 0.2 + (i % 5) * 0.1,
          animation: `starTwinkle ${1.6 + (i % 7) * 0.35}s ${(i % 5) * 0.25}s ease-in-out infinite alternate`,
        }} />
      ))}

      {/* ── Rocky ground ─────────────────────────────────────────────────── */}
      {/* Back ridge */}
      <div style={{
        position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: 260, height: 40,
        background: "linear-gradient(to top, #0A1220, #0D1928)",
        borderRadius: "55% 55% 0 0",
      }} />
      {/* Main rock mound */}
      <div style={{
        position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: 160, height: 62,
        background: "radial-gradient(ellipse at 50% 100%, #17253A 0%, #0C1828 100%)",
        borderRadius: "50% 50% 0 0",
      }} />
      {/* Rock texture highlights */}
      <div style={{
        position: "absolute", bottom: 30, left: "50%", transform: "translateX(-60px)",
        width: 28, height: 8,
        background: "rgba(255,255,255,0.04)",
        borderRadius: 4,
        transform: "translateX(-60px) rotate(-8deg)",
      }} />

      {/* ── Vent opening ─────────────────────────────────────────────────── */}
      {/* Vent glow ring */}
      <div style={{
        position: "absolute", bottom: 52, left: "50%",
        transform: "translateX(-50%)",
        width: 48, height: 22,
        borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(160,225,255,0.22) 0%, transparent 70%)",
        animation: active ? "ventPulse 0.6s ease-in-out infinite alternate" : undefined,
      }} />
      {/* Vent hole */}
      <div style={{
        position: "absolute", bottom: 56, left: "50%",
        transform: "translateX(-50%)",
        width: 20, height: 10,
        borderRadius: "50%",
        backgroundColor: "#060D18",
        boxShadow: active ? "0 0 10px 3px rgba(150,220,255,0.45), inset 0 0 6px rgba(150,220,255,0.3)" : "none",
      }} />

      {/* ── Static water column (background) ─────────────────────────────── */}
      {active && (
        <>
          {/* Outer column glow */}
          <div style={{
            position: "absolute", bottom: 56, left: "50%",
            transform: "translateX(-50%)",
            width: 28, height: 130,
            transformOrigin: "bottom center",
            background: "linear-gradient(to top, rgba(140,215,255,0.18) 0%, transparent 100%)",
            borderRadius: "50% 50% 30% 30%",
            filter: "blur(5px)",
            animation: "columnGlow 0.55s ease-in-out infinite alternate",
          }} />
          {/* Main column core */}
          <div style={{
            position: "absolute", bottom: 56, left: "50%",
            transform: "translateX(-50%)",
            width: 10, height: 110,
            transformOrigin: "bottom center",
            background: "linear-gradient(to top, rgba(215,240,255,0.9) 0%, rgba(215,240,255,0) 100%)",
            borderRadius: "5px 5px 2px 2px",
            animation: "columnCore 0.55s ease-in-out infinite alternate",
          }} />
        </>
      )}

      {/* ── Animated water drops ──────────────────────────────────────────── */}
      {active && ALL_DROPS.map((d, i) => (
        <div key={i} style={{
          position: "absolute",
          bottom: 64,    // just above the vent
          left: "50%",
          width: d.w,
          height: d.h,
          marginLeft: -d.w / 2,
          borderRadius: "50%",
          backgroundColor: "rgba(215,240,255,0.92)",
          boxShadow: "0 0 2px rgba(180,225,255,0.5)",
          transformOrigin: "center center",
          animationName: "waterDrop",
          animationDuration: `${d.speed}s`,
          animationDelay: `${d.delay}s`,
          animationTimingFunction: "ease-out",
          animationIterationCount: "infinite",
          animationFillMode: "both",
          ["--tx" as string]: `${d.tx}px`,
          ["--ty" as string]: `${d.ty}px`,
          ["--rot" as string]: `${d.rotate}deg`,
          opacity: d.opacity,
        }} />
      ))}

      {/* ── Mist at the peak ─────────────────────────────────────────────── */}
      {active && (
        <>
          <div style={{
            position: "absolute", bottom: 160, left: "50%",
            transform: "translateX(-50%)",
            width: 90, height: 50,
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(180,225,255,0.18) 0%, transparent 70%)",
            filter: "blur(8px)",
            animation: "mistPulse 0.9s ease-in-out infinite alternate",
          }} />
          <div style={{
            position: "absolute", bottom: 140, left: "50%",
            transform: "translateX(-50%)",
            width: 50, height: 30,
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(220,242,255,0.25) 0%, transparent 65%)",
            filter: "blur(4px)",
            animation: "mistPulse 0.7s 0.15s ease-in-out infinite alternate",
          }} />
        </>
      )}

      {/* Gradient fade to card bg */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, transparent 50%, #0D1520 100%)",
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
    if (phase === "hold") { const t = setTimeout(() => setPhase("out"),  3200); return () => clearTimeout(t); }
    if (phase === "out")  { const t = setTimeout(() => setPhase("idle"), 350);  return () => clearTimeout(t); }
  }, [phase]);

  useEffect(() => { play(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const m       = msg(streak);
  const visible = phase !== "idle";

  return (
    <div
      className="min-h-screen bg-[#080D12] flex flex-col items-center justify-center gap-6 p-6 select-none"
    >
      <div
        className="fixed inset-0 pointer-events-none transition-colors duration-300"
        style={{ backgroundColor: visible ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0)", zIndex: 10 }}
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
              borderColor: "rgba(14,165,233,0.3)",
              boxShadow: "0 0 80px rgba(14,165,233,0.12), 0 24px 48px rgba(0,0,0,0.5)",
              animation: phase === "out"
                ? "celebOut 0.35s ease forwards"
                : "celebIn 0.5s cubic-bezier(0.34,1.48,0.64,1) forwards",
            }}
          >
            <GeyserScene active={phase === "hold"} />

            {/* Day badge */}
            <div style={{
              position: "relative", marginTop: -26, marginRight: 12,
              display: "flex", justifyContent: "flex-end",
            }}>
              <span style={{
                backgroundColor: "rgba(14,165,233,0.92)", color: "#fff",
                fontSize: 11, fontWeight: 700, letterSpacing: 1,
                padding: "3px 10px", borderRadius: 99,
                fontFamily: "'Inter', sans-serif",
              }}>
                DAY {streak}
              </span>
            </div>

            {/* Content */}
            <div className="flex flex-col items-center gap-2 px-7 pb-7 pt-2">
              <span style={{
                fontSize: 62, color: "#0EA5E9", fontFamily: "'Inter', sans-serif",
                fontWeight: 900, letterSpacing: -2, lineHeight: 1,
              }}>
                {streak}
              </span>
              <span style={{
                fontSize: 18, color: "#F1F5F9", fontFamily: "'Inter', sans-serif",
                fontWeight: 700, textAlign: "center",
              }}>
                {m.headline}
              </span>
              <span style={{
                fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif",
                textAlign: "center", lineHeight: 1.4,
              }}>
                {m.sub}
              </span>
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
              <span style={{
                fontSize: 11, color: "#475569", fontFamily: "'Inter', sans-serif", marginTop: 4,
              }}>
                Tap to dismiss
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="relative z-30 flex flex-col items-center gap-4 mt-auto">
        <p style={{
          color: "#475569", fontSize: 11, textTransform: "uppercase",
          letterSpacing: 3, fontFamily: "'Inter',sans-serif",
        }}>
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
          border: "1px solid rgba(255,255,255,0.08)",
          fontFamily: "'Inter', sans-serif", cursor: "pointer",
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
