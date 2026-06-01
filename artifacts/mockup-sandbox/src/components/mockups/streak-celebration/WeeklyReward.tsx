import { useState, useEffect, useCallback } from "react";
import "./_group.css";

function getTierLabel(total: number): { headline: string; sub: string; color: string } {
  if (total >= 90)  return { headline: "Legendary hydrator",   sub: `${total} days without missing a scan. Remarkable.`,        color: "#F59E0B" };
  if (total >= 60)  return { headline: "Hydration elite",      sub: `${total} total days of consistency. Keep it up.`,           color: "#10B981" };
  if (total >= 30)  return { headline: "One month strong",     sub: `${total} days and counting. Your body thanks you.`,         color: "#10B981" };
  if (total >= 21)  return { headline: "3 weeks of habit",     sub: `${total} days not missed. The habit is real now.`,          color: "#0EA5E9" };
  if (total >= 14)  return { headline: "Two week milestone",   sub: `${total} consecutive scan days. You're on a roll.`,         color: "#0EA5E9" };
  return                    { headline: "Solid start",          sub: `${total} days without missing a scan. Keep going.`,         color: "#0EA5E9" };
}

const PRESETS = [7, 14, 21, 30, 60, 90];

export function WeeklyReward() {
  const [total, setTotal] = useState(21);
  const [animKey, setAnimKey] = useState(0);
  const [phase, setPhase] = useState<"in" | "hold" | "out" | "idle">("idle");
  const [countDisplay, setCountDisplay] = useState(0);

  const play = useCallback((t?: number) => {
    if (t !== undefined) setTotal(t);
    setPhase("idle");
    setCountDisplay(0);
    requestAnimationFrame(() => {
      setAnimKey((k) => k + 1);
      setPhase("in");
    });
  }, []);

  useEffect(() => {
    if (phase === "in")   { const t = setTimeout(() => setPhase("hold"), 500); return () => clearTimeout(t); }
    if (phase === "hold") { const t = setTimeout(() => setPhase("out"),  3600); return () => clearTimeout(t); }
    if (phase === "out")  { const t = setTimeout(() => setPhase("idle"), 350);  return () => clearTimeout(t); }
  }, [phase]);

  // Count-up animation
  useEffect(() => {
    if (phase !== "hold") return;
    const target   = total;
    const duration = 1000; // ms
    const startAt  = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startAt;
      const pct     = Math.min(elapsed / duration, 1);
      const eased   = 1 - Math.pow(1 - pct, 3); // ease-out cubic
      setCountDisplay(Math.round(eased * target));
      if (pct < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [phase, total]);

  useEffect(() => { play(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tier    = getTierLabel(total);
  const visible = phase !== "idle";

  return (
    <div className="min-h-screen bg-[#080D12] flex flex-col items-center justify-center gap-6 p-6 select-none">
      {/* Backdrop */}
      <div className="fixed inset-0 pointer-events-none transition-colors duration-300"
           style={{ backgroundColor: visible ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0)", zIndex: 10 }} />

      {visible && (
        <div key={animKey} className="fixed inset-0 flex items-center justify-center px-8 z-20"
             style={{ pointerEvents: "none" }}>
          <div className="w-full max-w-sm overflow-hidden rounded-[28px] border"
               style={{
                 backgroundColor: "#0D1520",
                 borderColor: `${tier.color}40`,
                 boxShadow: `0 0 80px ${tier.color}18, 0 24px 48px rgba(0,0,0,0.5)`,
                 animation: phase === "out"
                   ? "celebOut 0.35s ease forwards"
                   : "celebIn 0.5s cubic-bezier(0.34,1.48,0.64,1) forwards",
               }}>

            {/* Drinking water image */}
            <div style={{ position: "relative", width: "100%", height: 210, overflow: "hidden" }}>
              <img src="/__mockup/images/drinking-water.png" alt="Person drinking water"
                   style={{ width: "100%", height: "100%", objectFit: "cover",
                     animation: phase === "in" ? "geyserZoom 3.5s ease-out forwards" : undefined }} />
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to bottom, rgba(0,0,0,0) 30%, #0D1520 100%)",
              }} />
              {/* Weekly badge */}
              <div style={{
                position: "absolute", top: 12, left: 12,
                backgroundColor: `${tier.color}e8`, color: "#fff",
                fontSize: 11, fontWeight: 700, letterSpacing: 1,
                padding: "4px 12px", borderRadius: 99,
                fontFamily: "'Inter', sans-serif",
              }}>
                WEEKLY REVIEW
              </div>
            </div>

            {/* Content */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
              gap: 4, padding: "12px 28px 28px" }}>

              {/* Big count-up number */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{
                  fontSize: 64, fontWeight: 900, lineHeight: 1, letterSpacing: -3,
                  color: tier.color, fontFamily: "'Inter', sans-serif",
                }}>
                  {phase === "hold" ? countDisplay : (phase === "out" ? total : 0)}
                </span>
              </div>

              <span style={{
                fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: 2, color: tier.color, fontFamily: "'Inter', sans-serif",
                marginTop: -2,
              }}>
                total days not missed
              </span>

              <span style={{
                fontSize: 17, fontWeight: 700, textAlign: "center", color: "#F1F5F9",
                fontFamily: "'Inter', sans-serif", marginTop: 4,
              }}>
                {tier.headline}
              </span>
              <span style={{
                fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 1.45,
                fontFamily: "'Inter', sans-serif",
              }}>
                {tier.sub}
              </span>

              {/* Progress bar — days towards next 30-day milestone */}
              <div style={{ width: "100%", marginTop: 10 }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 10, color: "#475569", fontFamily: "'Inter', sans-serif",
                  marginBottom: 5, textTransform: "uppercase", letterSpacing: 1,
                }}>
                  <span>Progress to {Math.ceil(total / 30) * 30}d</span>
                  <span>{total % 30 === 0 ? 30 : total % 30} / 30</span>
                </div>
                <div style={{
                  width: "100%", height: 5, borderRadius: 3,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", borderRadius: 3,
                    width: `${((total % 30 === 0 ? 30 : total % 30) / 30) * 100}%`,
                    backgroundColor: tier.color,
                    animation: "barGrow 1.2s 0.4s ease both",
                    transformOrigin: "left",
                  }} />
                </div>
              </div>

              <span style={{
                fontSize: 11, color: "#334155", fontFamily: "'Inter', sans-serif", marginTop: 6,
              }}>
                Tap to dismiss
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="relative z-30 flex flex-col items-center gap-4 mt-auto">
        <p style={{ color: "#475569", fontSize: 11, textTransform: "uppercase",
          letterSpacing: 3, fontFamily: "'Inter', sans-serif" }}>
          Total days not missed
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {PRESETS.map((n) => {
            const c = getTierLabel(n).color;
            return (
              <button key={n} onClick={() => play(n)} style={{
                borderRadius: 99, padding: "6px 16px", fontSize: 13, fontWeight: 600,
                backgroundColor: total === n ? c : `${c}18`,
                color: total === n ? "#fff" : c,
                border: `1px solid ${c}40`,
                fontFamily: "'Inter', sans-serif", cursor: "pointer",
              }}>
                {n}d
              </button>
            );
          })}
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
