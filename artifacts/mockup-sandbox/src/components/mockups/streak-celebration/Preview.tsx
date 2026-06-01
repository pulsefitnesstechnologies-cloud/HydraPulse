import { useState, useEffect, useCallback } from "react";
import "./_group.css";

const MILESTONE: Record<number, { headline: string; sub: string }> = {
  3:  { headline: "3 days in a row!",  sub: "You're building a real habit." },
  7:  { headline: "One full week!",     sub: "Consistency is paying off." },
  14: { headline: "Two weeks strong!", sub: "Your body is thanking you." },
  30: { headline: "30 day streak!",    sub: "Elite-level consistency." },
};
const getMsg = (n: number) =>
  MILESTONE[n] ?? { headline: `${n} day streak!`, sub: "Keep scanning every day." };

const PRESETS = [2, 3, 7, 14, 30];

// ── Splash droplets — arc out from the column mid-point ───────────────────────
const DROPS = [
  // [angle from vertical °, reach px, size, speed s, delay s]
  // Left side
  { ax: -110, ay: -55,  r: 5, spd: 0.90, del: 0.0  },
  { ax: -130, ay: -30,  r: 4, spd: 0.80, del: 0.15 },
  { ax: -100, ay: -70,  r: 3, spd: 1.00, del: 0.30 },
  { ax: -145, ay: -15,  r: 3, spd: 0.75, del: 0.45 },
  { ax: -90,  ay: -85,  r: 4, spd: 1.10, del: 0.10 },
  { ax: -120, ay: -45,  r: 3, spd: 0.85, del: 0.55 },
  // Right side (mirror)
  { ax:  110, ay: -55,  r: 5, spd: 0.90, del: 0.05 },
  { ax:  130, ay: -30,  r: 4, spd: 0.80, del: 0.20 },
  { ax:  100, ay: -70,  r: 3, spd: 1.00, del: 0.35 },
  { ax:  145, ay: -15,  r: 3, spd: 0.75, del: 0.50 },
  { ax:  90,  ay: -85,  r: 4, spd: 1.10, del: 0.15 },
  { ax:  120, ay: -45,  r: 3, spd: 0.85, del: 0.60 },
  // Top sprays (near vertical)
  { ax: -20,  ay: -110, r: 3, spd: 1.10, del: 0.05 },
  { ax:  20,  ay: -110, r: 3, spd: 1.10, del: 0.10 },
  { ax: -40,  ay: -105, r: 2, spd: 0.95, del: 0.25 },
  { ax:  40,  ay: -105, r: 2, spd: 0.95, del: 0.30 },
];

// ── Flow lines inside the column ──────────────────────────────────────────────
const FLOW_LINES = [
  { x: -12, w: 4, dur: 0.55, del: 0.00 },
  { x:  0,  w: 6, dur: 0.50, del: 0.10 },
  { x:  12, w: 4, dur: 0.55, del: 0.20 },
  { x: -6,  w: 3, dur: 0.60, del: 0.30 },
  { x:  6,  w: 3, dur: 0.60, del: 0.40 },
];

function GeyserScene({ active }: { active: boolean }) {
  return (
    <div style={{
      position: "relative", width: "100%", height: 250,
      overflow: "hidden",
    }}>

      {/* ── Cave / rocky background ─────────────────────────────────────── */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(160deg, #2A2218 0%, #1E1C1A 40%, #1A1F26 70%, #141820 100%)",
      }} />

      {/* Rock vein / crack lines */}
      {[
        { left: "18%", top: "5%",  w: 1, h: "45%", rot: "12deg",  op: 0.15 },
        { left: "72%", top: "8%",  w: 1, h: "38%", rot: "-18deg", op: 0.12 },
        { left: "35%", top: "2%",  w: 1, h: "28%", rot: "5deg",   op: 0.10 },
        { left: "60%", top: "15%", w: 1, h: "35%", rot: "-8deg",  op: 0.13 },
      ].map((c, i) => (
        <div key={i} style={{
          position: "absolute", left: c.left, top: c.top,
          width: c.w, height: c.h,
          background: "rgba(200,180,140,0.6)",
          transform: `rotate(${c.rot})`,
          opacity: c.op,
          borderRadius: 1,
        }} />
      ))}

      {/* ── Ground — warm rocky terrain ─────────────────────────────────── */}
      {/* Back ridge */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 72,
        background: "linear-gradient(to top, #1C1510 0%, #2B2018 60%, transparent 100%)",
      }} />
      {/* Left rock mass */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, width: "38%", height: 60,
        background: "linear-gradient(135deg, #3D2E18 0%, #5A4225 50%, #2E2214 100%)",
        borderRadius: "0 60% 0 0",
      }} />
      {/* Left rock highlight */}
      <div style={{
        position: "absolute", bottom: 25, left: "8%", width: "22%", height: 20,
        background: "linear-gradient(135deg, #7A6035 0%, #9C7840 60%, transparent 100%)",
        borderRadius: "0 50% 50% 0",
        opacity: 0.7,
      }} />
      {/* Right rock mass */}
      <div style={{
        position: "absolute", bottom: 0, right: 0, width: "38%", height: 60,
        background: "linear-gradient(225deg, #3D2E18 0%, #5A4225 50%, #2E2214 100%)",
        borderRadius: "60% 0 0 0",
      }} />
      {/* Right rock highlight */}
      <div style={{
        position: "absolute", bottom: 25, right: "8%", width: "22%", height: 20,
        background: "linear-gradient(225deg, #7A6035 0%, #9C7840 60%, transparent 100%)",
        borderRadius: "50% 0 0 50%",
        opacity: 0.7,
      }} />
      {/* Center rock / vent platform */}
      <div style={{
        position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: 130, height: 40,
        background: "radial-gradient(ellipse at 50% 100%, #3A2D1A 0%, #231A0C 100%)",
        borderRadius: "50% 50% 0 0",
      }} />

      {/* ── Teal water pool ──────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
        width: 110, height: 30,
        background: "radial-gradient(ellipse at 50% 60%, #1ABECE 60%, #0A8898 100%)",
        borderRadius: "50%",
        boxShadow: active ? "0 0 18px 4px rgba(18,200,220,0.35)" : undefined,
      }} />

      {/* ── Ripple rings ─────────────────────────────────────────────────── */}
      {active && [0, 0.4, 0.8].map((del) => (
        <div key={del} style={{
          position: "absolute", bottom: 26, left: "50%",
          transform: "translateX(-50%)",
          width: 110, height: 30,
          borderRadius: "50%",
          border: "1.5px solid rgba(18,200,220,0.7)",
          animation: `rippleRing 1.2s ${del}s ease-out infinite`,
          pointerEvents: "none",
        }} />
      ))}

      {/* ── Main water column (SVG) ───────────────────────────────────────── */}
      <svg
        style={{ position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", overflow: "visible" }}
        width="120" height="200" viewBox="0 0 120 200"
      >
        <defs>
          {/* Outer column gradient — teal body */}
          <linearGradient id="colOuter" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#0898A8" />
            <stop offset="30%"  stopColor="#0CC0D4" />
            <stop offset="50%"  stopColor="#18D4E8" />
            <stop offset="70%"  stopColor="#0CC0D4" />
            <stop offset="100%" stopColor="#0898A8" />
          </linearGradient>
          {/* Inner highlight — bright core */}
          <linearGradient id="colInner" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="rgba(120,240,255,0)" />
            <stop offset="35%"  stopColor="rgba(180,248,255,0.55)" />
            <stop offset="50%"  stopColor="rgba(220,252,255,0.80)" />
            <stop offset="65%"  stopColor="rgba(180,248,255,0.55)" />
            <stop offset="100%" stopColor="rgba(120,240,255,0)" />
          </linearGradient>
          {/* Top froth gradient */}
          <radialGradient id="frothGrad" cx="50%" cy="80%" r="60%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.95)" />
            <stop offset="60%"  stopColor="rgba(180,248,255,0.7)" />
            <stop offset="100%" stopColor="rgba(12,192,212,0)" />
          </radialGradient>
          {/* Side arch stream gradient */}
          <linearGradient id="archL" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="rgba(12,192,212,0.9)" />
            <stop offset="100%" stopColor="rgba(12,192,212,0)" />
          </linearGradient>
          <linearGradient id="archR" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="rgba(12,192,212,0.9)" />
            <stop offset="100%" stopColor="rgba(12,192,212,0)" />
          </linearGradient>
        </defs>

        {/* Main body — column widens toward top like a fountain crown */}
        <path
          d="M 44 198 C 40 160 28 100 22 50 C 20 30 30 8 60 2 C 90 8 100 30 98 50 C 92 100 80 160 76 198 Z"
          fill="url(#colOuter)"
          opacity={active ? 1 : 0}
          style={{ animation: active ? "colSurge 0.7s ease-in-out infinite alternate" : undefined }}
        />

        {/* Inner highlight */}
        <path
          d="M 50 195 C 48 158 40 98 38 50 C 37 32 45 14 60 10 C 75 14 83 32 82 50 C 80 98 72 158 70 195 Z"
          fill="url(#colInner)"
          opacity={active ? 1 : 0}
        />

        {/* Froth blob at the top */}
        {active && (
          <>
            <ellipse cx="60" cy="12" rx="38" ry="14" fill="url(#frothGrad)"
              style={{ animation: "frothPulse 0.65s ease-in-out infinite alternate" }} />
            <ellipse cx="42" cy="18" rx="18" ry="8" fill="rgba(255,255,255,0.55)"
              style={{ animation: "frothPulse 0.65s 0.1s ease-in-out infinite alternate" }} />
            <ellipse cx="78" cy="18" rx="18" ry="8" fill="rgba(255,255,255,0.55)"
              style={{ animation: "frothPulse 0.65s 0.2s ease-in-out infinite alternate" }} />
          </>
        )}
      </svg>

      {/* ── Inner flow lines (moving upward inside column) ─────────────── */}
      {active && (
        <div style={{
          position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)",
          width: 38, height: 180, overflow: "hidden",
          borderRadius: "30% 30% 0 0",
        }}>
          {FLOW_LINES.map((fl, i) => (
            <div key={i} style={{
              position: "absolute",
              left: `calc(50% + ${fl.x}px)`,
              width: fl.w,
              height: 50,
              borderRadius: 9,
              background: "linear-gradient(to top, rgba(255,255,255,0) 0%, rgba(220,252,255,0.7) 50%, rgba(255,255,255,0) 100%)",
              animation: `flowLine ${fl.dur}s ${fl.del}s linear infinite`,
            }} />
          ))}
        </div>
      )}

      {/* ── Splash droplets (fly out from column) ────────────────────────── */}
      {active && DROPS.map((d, i) => (
        <div key={i} style={{
          position: "absolute",
          bottom: 100,           // origin: mid-column height
          left: "50%",
          width: d.r * 2,
          height: d.r * 2,
          marginLeft: -d.r,
          marginBottom: -d.r,
          borderRadius: "50%",
          backgroundColor: i % 4 === 0 ? "rgba(255,255,255,0.92)" : "rgba(12,210,230,0.88)",
          ["--tx" as string]: `${d.ax}px`,
          ["--ty" as string]: `${d.ay}px`,
          animationName: "splashDrop",
          animationDuration: `${d.spd}s`,
          animationDelay: `${d.del}s`,
          animationTimingFunction: "cubic-bezier(0.25,0.46,0.45,0.94)",
          animationIterationCount: "infinite",
          animationFillMode: "both",
        }} />
      ))}

      {/* ── Scene fade overlay to card bg ──────────────────────────────── */}
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
    if (phase === "hold") { const t = setTimeout(() => setPhase("out"),  3500); return () => clearTimeout(t); }
    if (phase === "out")  { const t = setTimeout(() => setPhase("idle"), 350);  return () => clearTimeout(t); }
  }, [phase]);

  useEffect(() => { play(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const m       = getMsg(streak);
  const visible = phase !== "idle";

  return (
    <div className="min-h-screen bg-[#080D12] flex flex-col items-center justify-center gap-6 p-6 select-none">

      {/* Backdrop */}
      <div className="fixed inset-0 pointer-events-none transition-colors duration-300"
           style={{ backgroundColor: visible ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0)", zIndex: 10 }} />

      {visible && (
        <div key={animKey} className="fixed inset-0 flex items-center justify-center px-6 z-20"
             style={{ pointerEvents: "none" }}>
          <div className="w-full max-w-sm overflow-hidden rounded-[28px] border"
               style={{
                 backgroundColor: "#0D1520",
                 borderColor: "rgba(12,192,212,0.35)",
                 boxShadow: "0 0 80px rgba(12,192,212,0.15), 0 24px 48px rgba(0,0,0,0.6)",
                 animation: phase === "out"
                   ? "celebOut 0.35s ease forwards"
                   : "celebIn 0.5s cubic-bezier(0.34,1.48,0.64,1) forwards",
               }}>

            <GeyserScene active={phase === "hold"} />

            {/* Day badge */}
            <div style={{
              position: "relative", marginTop: -26, marginRight: 12,
              display: "flex", justifyContent: "flex-end",
            }}>
              <span style={{
                backgroundColor: "rgba(12,192,212,0.92)", color: "#fff",
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
                fontSize: 62, color: "#0CC8DC", fontFamily: "'Inter', sans-serif",
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
                    backgroundColor: "#0CC8DC",
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
          letterSpacing: 3, fontFamily: "'Inter', sans-serif",
        }}>
          Preview streak day
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {PRESETS.map((n) => (
            <button key={n} onClick={() => play(n)} style={{
              borderRadius: 99, padding: "6px 16px", fontSize: 13, fontWeight: 600,
              backgroundColor: streak === n ? "#0CC8DC" : "rgba(12,200,220,0.1)",
              color: streak === n ? "#fff" : "#0CC8DC",
              border: "1px solid rgba(12,200,220,0.3)",
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
