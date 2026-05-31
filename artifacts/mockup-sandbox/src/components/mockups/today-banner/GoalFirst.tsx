import React from "react";
import { Plus } from "lucide-react";
import "./_group.css";

// ── constants ──────────────────────────────────────────────────────────────────
const PROGRESS = 0.6;
const RING_SIZE = 190;
const RING_STROKE = 10;
const DROP_W = 280;
const DROP_H = 300;
const DROP_R = DROP_W / 2;         // 140
const DROP_CX = DROP_W / 2;        // 140
const CIRCLE_CY = DROP_H - DROP_R; // 160

// ── Smooth teardrop — P2 of each bezier lands directly above arc tangent ──────
function buildDropPath(): string {
  const cx = DROP_CX;
  const W  = DROP_W;
  const H  = DROP_H;
  const cy = CIRCLE_CY;
  const r  = DROP_R;
  return (
    `M ${cx} 8 ` +
    `C ${W * 0.70} ${H * 0.06}, ${W} ${H * 0.26}, ${W} ${cy} ` +
    `A ${r} ${r} 0 0 1 0 ${cy} ` +
    `C 0 ${H * 0.26}, ${W * 0.30} ${H * 0.06}, ${cx} 8 Z`
  );
}

// ── Wave path — 2× drop width so horizontal SMIL loop is seamless ─────────────
function buildWave(y: number, amp: number): string {
  const W = DROP_W;
  return (
    `M 0 ${y} ` +
    `C ${W * 0.25} ${y - amp} ${W * 0.75} ${y + amp} ${W} ${y} ` +
    `C ${W * 1.25} ${y - amp} ${W * 1.75} ${y + amp} ${W * 2} ${y} ` +
    `V ${DROP_H} H 0 Z`
  );
}

export function GoalFirst() {
  const normalizedRadius = RING_SIZE / 2 - RING_STROKE;
  const circumference    = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference * (1 - PROGRESS);

  const dropPath = buildDropPath();
  const waveY    = DROP_H * (1 - PROGRESS); // 120 at 60 %

  // Wave paths at their FINAL resting position — they always scroll horizontally.
  // The bottom-to-top reveal is handled entirely by a rising SVG <mask>.
  const wave1 = buildWave(waveY,     9);
  const wave2 = buildWave(waveY + 8, 7);
  const wave3 = buildWave(waveY + 4, 5);

  // How far the mask rect must travel: starts below the entire drop, ends at waveY
  const maskStartY = DROP_H + 20;
  const maskEndY   = waveY - 12;         // slightly above waveY so the surface is visible
  const maskEndH   = DROP_H - maskEndY + 20;
  const RISE       = "1.8s";
  const EASE       = "0.22 0.1 0.25 1";

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
            {/* Hard clip for wave content */}
            <clipPath id="gf-clip">
              <path d={dropPath} />
            </clipPath>

            {/* Rising mask — a rect that grows upward from the bottom of the drop.
                This is the ONLY thing controlling the bottom-to-top fill reveal.
                Waves inside simply scroll left continuously at their final Y. */}
            <mask id="gf-fill-mask">
              <rect x="-5" width={DROP_W + 10} fill="white">
                <animate
                  attributeName="y"
                  from={maskStartY} to={maskEndY}
                  dur={RISE} calcMode="spline" keySplines={EASE} fill="freeze"
                />
                <animate
                  attributeName="height"
                  from="5" to={maskEndH}
                  dur={RISE} calcMode="spline" keySplines={EASE} fill="freeze"
                />
              </rect>
            </mask>

            {/* Radial gradient — bright cyan core fading to transparent edges */}
            <radialGradient id="gf-grad" cx="50%" cy="45%" r="55%">
              <stop offset="0%"   stopColor="#38BDF8" stopOpacity="0.18" />
              <stop offset="55%"  stopColor="#0EA5E9" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#075985" stopOpacity="0.02" />
            </radialGradient>

            {/* Feather filter — no clip, so glow bleeds into background */}
            <filter id="gf-feather" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="14" />
            </filter>

            {/* Caustic shimmer highlight */}
            <radialGradient id="gf-shimmer" cx="38%" cy="28%" r="35%">
              <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.11" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"    />
            </radialGradient>
          </defs>

          {/* 1. Feathered outer glow — drawn outside clip, bleeds softly */}
          <path d={dropPath} fill="#0EA5E9" fillOpacity="0.09" filter="url(#gf-feather)" />

          {/* 2. Radial-gradient ambient fill */}
          <path d={dropPath} fill="url(#gf-grad)" />

          {/* 3. Fill content: clip to drop shape AND mask by rising rect */}
          <g clipPath="url(#gf-clip)" mask="url(#gf-fill-mask)">

            {/* Static base fill rectangle at the fill level */}
            <rect x="0" y={waveY} width={DROP_W} height={DROP_H - waveY + 10} fill="#0EA5E914" />

            {/* Primary wave — scrolls left continuously */}
            <path d={wave1} fill="#0EA5E932">
              <animateTransform
                attributeName="transform" type="translate"
                from="0 0" to={`-${DROP_W} 0`}
                dur="4s" repeatCount="indefinite"
              />
            </path>

            {/* Secondary wave — offset phase */}
            <path d={wave2} fill="#38BDF822">
              <animateTransform
                attributeName="transform" type="translate"
                from={`-${DROP_W * 0.4} 0`} to={`-${DROP_W * 1.4} 0`}
                dur="6.5s" repeatCount="indefinite"
              />
            </path>

            {/* Tertiary micro wave */}
            <path d={wave3} fill="#7DD3FC1A">
              <animateTransform
                attributeName="transform" type="translate"
                from={`-${DROP_W * 0.7} 0`} to={`-${DROP_W * 1.7} 0`}
                dur="5s" repeatCount="indefinite"
              />
            </path>
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
          <div className="flex flex-col items-center text-center gap-0.5">
            <span className="font-extrabold text-white" style={{ fontSize: 30, lineHeight: 1 }}>48</span>
            <span className="text-slate-400 font-medium" style={{ fontSize: 12 }}>/ 80 oz</span>
          </div>
        </div>

        {/* % label */}
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
