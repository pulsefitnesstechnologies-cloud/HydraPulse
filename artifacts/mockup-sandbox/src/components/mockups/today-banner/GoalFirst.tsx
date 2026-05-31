import React from "react";
import { Plus } from "lucide-react";
import "./_group.css";

// ── constants ──────────────────────────────────────────────────────────────────
const PROGRESS = 0.6;
const RING_SIZE = 190;
const RING_STROKE = 10;
const DROP_W = 280;
const DROP_H = 300;
const DROP_R = DROP_W / 2;         // 140 — bottom circle radius
const DROP_CX = DROP_W / 2;        // 140
const CIRCLE_CY = DROP_H - DROP_R; // 160 — centre Y of bottom circle

// ── Smooth teardrop shape ─────────────────────────────────────────────────────
// Key: P2 of each cubic is directly above the arc tangent point (same X) so
// the curve arrives vertically, joining the circle with zero kink.
function buildDropPath(): string {
  const cx = DROP_CX; // 140
  const W  = DROP_W;  // 280
  const H  = DROP_H;  // 300
  const cy = CIRCLE_CY; // 160
  const r  = DROP_R;    // 140

  return (
    `M ${cx} 8 ` +
    // right side: tip → right tangent of circle. P2 must be (W, something) so
    // the bezier arrives with a vertical tangent matching the circle.
    `C ${W * 0.70} ${H * 0.06}, ${W} ${H * 0.26}, ${W} ${cy} ` +
    // bottom semicircle
    `A ${r} ${r} 0 0 1 0 ${cy} ` +
    // left side: left tangent → tip. P1 is (0, *) for vertical departure.
    `C 0 ${H * 0.26}, ${W * 0.30} ${H * 0.06}, ${cx} 8 Z`
  );
}

// ── Wave path: 2× drop width so SMIL horizontal loop is seamless ──────────────
function buildWave(y: number, amp: number): string {
  const W = DROP_W;
  return (
    `M 0 ${y} ` +
    `C ${W * 0.25} ${y - amp} ${W * 0.75} ${y + amp} ${W} ${y} ` +
    `C ${W * 1.25} ${y - amp} ${W * 1.75} ${y + amp} ${W * 2} ${y} ` +
    `V ${DROP_H} H 0 Z`
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function GoalFirst() {
  const normalizedRadius = RING_SIZE / 2 - RING_STROKE;
  const circumference    = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference * (1 - PROGRESS);

  const dropPath = buildDropPath();
  const waveY    = DROP_H * (1 - PROGRESS); // 120 at 60 %

  // Wave paths: start flat at the very bottom of the drop, end at fill level
  const waveFlat = buildWave(DROP_H + 20, 0); // invisible starting position
  const wave1End = buildWave(waveY,     9);
  const wave2End = buildWave(waveY + 8, 7);
  const wave3End = buildWave(waveY + 4, 5);

  const RISE = "1.8s";
  const EASE = "0.22 0.1 0.25 1"; // fast-out ease

  return (
    <div
      className="w-full max-w-sm mx-auto rounded-3xl overflow-hidden relative shadow-2xl border border-slate-800"
      style={{ background: "#0F172A", fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Water-drop SVG ───────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 14,
          left: "50%",
          transform: "translateX(-50%)",
          width: DROP_W,
          height: DROP_H,
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        <svg width={DROP_W} height={DROP_H} style={{ overflow: "visible" }}>
          <defs>
            <clipPath id="gf-clip">
              <path d={dropPath} />
            </clipPath>

            {/* Radial gradient — bright cyan core fading out */}
            <radialGradient id="gf-grad" cx="50%" cy="45%" r="55%">
              <stop offset="0%"   stopColor="#38BDF8" stopOpacity="0.18" />
              <stop offset="55%"  stopColor="#0EA5E9" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#075985" stopOpacity="0.02" />
            </radialGradient>

            {/* Feather filter — drawn outside clip so edges bleed softly */}
            <filter id="gf-feather" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="14" />
            </filter>

            {/* Caustic shimmer highlight */}
            <radialGradient id="gf-shimmer" cx="38%" cy="28%" r="35%">
              <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.11" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"    />
            </radialGradient>
          </defs>

          {/* 1. Feathered outer glow — no clip, intentionally bleeds */}
          <path d={dropPath} fill="#0EA5E9" fillOpacity="0.09" filter="url(#gf-feather)" />

          {/* 2. Radial-gradient base fill */}
          <path d={dropPath} fill="url(#gf-grad)" />

          {/* 3. Rising fill — bottom → 60 % level, then horizontal wave */}
          <g clipPath="url(#gf-clip)">

            {/* Static fill rect that rises with the water */}
            <rect x="0" width={DROP_W} fill="#0EA5E914">
              <animate attributeName="y"
                from={DROP_H + 20} to={waveY}
                dur={RISE} calcMode="spline" keySplines={EASE} fill="freeze" />
              <animate attributeName="height"
                from="0" to={DROP_H - waveY + 10}
                dur={RISE} calcMode="spline" keySplines={EASE} fill="freeze" />
            </rect>

            {/* Wave 1 — rises then scrolls left */}
            <g>
              <animateTransform attributeName="transform" type="translate"
                from="0 0" to={`-${DROP_W} 0`}
                begin={RISE} dur="4s" repeatCount="indefinite" />
              <path fill="#0EA5E932">
                <animate attributeName="d"
                  from={waveFlat} to={wave1End}
                  dur={RISE} calcMode="spline" keySplines={EASE} fill="freeze" />
              </path>
            </g>

            {/* Wave 2 — slightly offset phase for depth */}
            <g>
              <animateTransform attributeName="transform" type="translate"
                from={`-${DROP_W * 0.4} 0`} to={`-${DROP_W * 1.4} 0`}
                begin={RISE} dur="6.5s" repeatCount="indefinite" />
              <path fill="#38BDF822">
                <animate attributeName="d"
                  from={waveFlat} to={wave2End}
                  dur={RISE} calcMode="spline" keySplines={EASE} fill="freeze" />
              </path>
            </g>

            {/* Wave 3 — micro layer */}
            <g>
              <animateTransform attributeName="transform" type="translate"
                from={`-${DROP_W * 0.7} 0`} to={`-${DROP_W * 1.7} 0`}
                begin={RISE} dur="5s" repeatCount="indefinite" />
              <path fill="#7DD3FC1A">
                <animate attributeName="d"
                  from={waveFlat} to={wave3End}
                  dur={RISE} calcMode="spline" keySplines={EASE} fill="freeze" />
              </path>
            </g>
          </g>

          {/* 4. Caustic shimmer highlight */}
          <ellipse
            cx={DROP_CX * 0.68} cy={DROP_H * 0.21}
            rx={46} ry={22}
            fill="url(#gf-shimmer)"
            clipPath="url(#gf-clip)"
          />

          {/* 5. Barely-there border */}
          <path d={dropPath} fill="none" stroke="#38BDF8"
                strokeWidth={1} strokeOpacity="0.14" />
        </svg>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center px-6 pt-8 pb-6" style={{ zIndex: 1 }}>

        {/* Progress Ring */}
        <div className="relative flex items-center justify-center"
             style={{ width: RING_SIZE, height: RING_SIZE, marginBottom: 10 }}>
          <svg width={RING_SIZE} height={RING_SIZE}
               style={{ transform: "rotate(-90deg)", position: "absolute", inset: 0 }}>
            <circle stroke="#1E293B" fill="transparent"
                    strokeWidth={RING_STROKE}
                    r={normalizedRadius} cx={RING_SIZE / 2} cy={RING_SIZE / 2} />
            <circle stroke="#0EA5E9" fill="transparent"
                    strokeWidth={RING_STROKE}
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeLinecap="round"
                    style={{
                      strokeDashoffset,
                      filter: "drop-shadow(0 0 8px #0EA5E970)",
                      transition: "stroke-dashoffset 1s ease-out",
                    }}
                    r={normalizedRadius} cx={RING_SIZE / 2} cy={RING_SIZE / 2} />
          </svg>

          {/* Centre: oz */}
          <div className="flex flex-col items-center text-center gap-0.5">
            <span className="font-extrabold text-white" style={{ fontSize: 30, lineHeight: 1 }}>48</span>
            <span className="text-slate-400 font-medium" style={{ fontSize: 12 }}>/ 80 oz</span>
          </div>
        </div>

        {/* % — below ring */}
        <div className="flex flex-col items-center" style={{ marginBottom: 18 }}>
          <span className="font-extrabold text-[#38BDF8]"
                style={{ fontSize: 44, lineHeight: 1, letterSpacing: "-0.02em",
                         textShadow: "0 0 20px #0EA5E950" }}>
            60%
          </span>
          <span className="text-slate-400 uppercase tracking-widest font-medium"
                style={{ fontSize: 11, marginTop: 5 }}>
            of daily goal
          </span>
        </div>

        {/* Stats row */}
        <div className="w-full flex items-center justify-between px-1" style={{ marginBottom: 18 }}>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-bold" style={{ fontSize: 26 }}>7</span>
              <span style={{ fontSize: 24 }}>🌊</span>
            </div>
            <span className="text-slate-400 font-medium" style={{ fontSize: 12 }}>Day Streak</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-semibold text-emerald-400" style={{ fontSize: 13 }}>Scanned today</span>
            <span className="text-slate-500" style={{ fontSize: 11 }}>Best: 12 days</span>
          </div>
        </div>

        {/* Log Water */}
        <button className="w-full flex items-center justify-center gap-2 font-semibold text-white rounded-2xl"
                style={{ background: "linear-gradient(135deg,#0EA5E9,#0284C7)",
                         padding: "14px 24px", fontSize: 15,
                         boxShadow: "0 4px 24px #0EA5E940" }}>
          <Plus size={20} strokeWidth={2.5} />
          Log Water
        </button>
      </div>
    </div>
  );
}
