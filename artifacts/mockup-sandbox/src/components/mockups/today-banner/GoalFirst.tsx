import React from "react";
import { Plus } from "lucide-react";
import "./_group.css";

// ── constants ──────────────────────────────────────────────────────────────────
const PROGRESS = 0.6;
const RING_SIZE = 190;
const RING_STROKE = 10;

const DROP_W = 280;
const DROP_H = 300;
const DROP_R = DROP_W / 2;        // 140 — bottom circle radius
const DROP_CX = DROP_W / 2;       // 140
const CIRCLE_CY = DROP_H - DROP_R; // 160

// Softer, more organic blob-drop — rounded tip, subtle asymmetric control points
function buildDropPath(): string {
  const cx = DROP_CX;
  const h = DROP_H;
  const w = DROP_W;
  const r = DROP_R;
  const cy = CIRCLE_CY;
  return (
    // Soft rounded tip (smaller, more rounded bezier horns)
    `M ${cx} 6 ` +
    `C ${w * 0.64} ${h * 0.18}, ${w * 0.92} ${h * 0.44}, ${w} ${cy} ` +
    `A ${r} ${r} 0 0 1 0 ${cy} ` +
    `C ${w * 0.08} ${h * 0.44}, ${w * 0.36} ${h * 0.18}, ${cx} 6 Z`
  );
}

// Wave: 2× drop width for seamless SMIL loop
function buildWave(y: number, amp: number): string {
  const W = DROP_W;
  return (
    `M 0 ${y} ` +
    `C ${W * 0.25} ${y - amp}, ${W * 0.75} ${y + amp}, ${W} ${y} ` +
    `C ${W * 1.25} ${y - amp}, ${W * 1.75} ${y + amp}, ${W * 2} ${y} ` +
    `V ${DROP_H} H 0 Z`
  );
}

export function GoalFirst() {
  const normalizedRadius = RING_SIZE / 2 - RING_STROKE;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference * (1 - PROGRESS);

  const dropPath = buildDropPath();
  const waveY = DROP_H * (1 - PROGRESS); // 120 at 60%

  return (
    <div
      className="w-full max-w-sm mx-auto rounded-3xl overflow-hidden relative shadow-2xl border border-slate-800"
      style={{ background: "#0F172A", fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Water-drop SVG ───────────────────────────────────────────────────── */}
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
        <svg
          width={DROP_W}
          height={DROP_H}
          style={{ overflow: "visible" }}
        >
          <defs>
            {/* Hard clip for wave content */}
            <clipPath id="gf-drop-clip">
              <path d={dropPath} />
            </clipPath>

            {/* Radial gradient — bright cyan core fading outward */}
            <radialGradient id="gf-water-core" cx="50%" cy="45%" r="55%">
              <stop offset="0%"   stopColor="#38BDF8" stopOpacity="0.18" />
              <stop offset="55%"  stopColor="#0EA5E9" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#075985" stopOpacity="0.02" />
            </radialGradient>

            {/* Soft-edge blur filter — drawn OUTSIDE clip so edges bleed/feather */}
            <filter id="gf-feather" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="14" />
            </filter>

            {/* Subtle inner shimmer highlight */}
            <radialGradient id="gf-shimmer" cx="38%" cy="28%" r="35%">
              <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"   />
            </radialGradient>
          </defs>

          {/* ── 1. Feathered outer glow (no clip — intentionally bleeds) ── */}
          <path
            d={dropPath}
            fill="#0EA5E9"
            fillOpacity="0.10"
            filter="url(#gf-feather)"
          />

          {/* ── 2. Second softer halo, slightly larger ── */}
          <path
            d={dropPath}
            fill="#38BDF8"
            fillOpacity="0.06"
            filter="url(#gf-feather)"
            transform={`translate(${-DROP_W * 0.04} ${-DROP_H * 0.03}) scale(1.08)`}
            style={{ transformOrigin: `${DROP_CX}px ${CIRCLE_CY}px` }}
          />

          {/* ── 3. Radial gradient base fill (inside shape) ── */}
          <path
            d={dropPath}
            fill="url(#gf-water-core)"
          />

          {/* ── 4. Animated waves — clipped ── */}
          <g clipPath="url(#gf-drop-clip)">
            {/* Static fill base */}
            <rect
              x={0} y={waveY}
              width={DROP_W} height={DROP_H - waveY + 10}
              fill="#0EA5E916"
            />

            {/* Primary wave */}
            <path d={buildWave(waveY, 9)} fill="#0EA5E930">
              <animateTransform
                attributeName="transform" type="translate"
                from="0 0" to={`-${DROP_W} 0`}
                dur="4s" repeatCount="indefinite"
              />
            </path>

            {/* Secondary wave — offset phase, softer */}
            <path d={buildWave(waveY + 8, 7)} fill="#38BDF820">
              <animateTransform
                attributeName="transform" type="translate"
                from={`-${DROP_W * 0.4} 0`} to={`-${DROP_W * 1.4} 0`}
                dur="6.5s" repeatCount="indefinite"
              />
            </path>

            {/* Tertiary micro-wave — lightest */}
            <path d={buildWave(waveY + 4, 5)} fill="#7DD3FC18">
              <animateTransform
                attributeName="transform" type="translate"
                from={`-${DROP_W * 0.7} 0`} to={`-${DROP_W * 1.7} 0`}
                dur="5s" repeatCount="indefinite"
              />
            </path>
          </g>

          {/* ── 5. Caustic shimmer highlight (top-left of drop) ── */}
          <ellipse
            cx={DROP_CX * 0.70}
            cy={DROP_H * 0.22}
            rx={45} ry={22}
            fill="url(#gf-shimmer)"
            clipPath="url(#gf-drop-clip)"
          />

          {/* ── 6. Very faint crisp border — barely visible ── */}
          <path
            d={dropPath}
            fill="none"
            stroke="#38BDF8"
            strokeWidth={1}
            strokeOpacity="0.12"
          />
        </svg>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div
        className="relative flex flex-col items-center px-6 pt-8 pb-6"
        style={{ zIndex: 1 }}
      >
        {/* Progress Ring */}
        <div
          className="relative flex items-center justify-center"
          style={{ width: RING_SIZE, height: RING_SIZE, marginBottom: 10 }}
        >
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            style={{ transform: "rotate(-90deg)", position: "absolute", inset: 0 }}
          >
            <circle
              stroke="#1E293B"
              fill="transparent"
              strokeWidth={RING_STROKE}
              r={normalizedRadius}
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
            />
            <circle
              stroke="#0EA5E9"
              fill="transparent"
              strokeWidth={RING_STROKE}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeLinecap="round"
              style={{
                strokeDashoffset,
                filter: "drop-shadow(0 0 8px #0EA5E970)",
                transition: "stroke-dashoffset 1s ease-out",
              }}
              r={normalizedRadius}
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
            />
          </svg>

          {/* Centre: oz */}
          <div className="flex flex-col items-center text-center gap-0.5">
            <span className="font-extrabold text-white" style={{ fontSize: 30, lineHeight: 1 }}>
              48
            </span>
            <span className="text-slate-400 font-medium" style={{ fontSize: 12 }}>
              / 80 oz
            </span>
          </div>
        </div>

        {/* % below ring */}
        <div className="flex flex-col items-center" style={{ marginBottom: 18 }}>
          <span
            className="font-extrabold text-[#38BDF8]"
            style={{
              fontSize: 44,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              textShadow: "0 0 20px #0EA5E950",
            }}
          >
            60%
          </span>
          <span
            className="text-slate-400 uppercase tracking-widest font-medium"
            style={{ fontSize: 11, marginTop: 5 }}
          >
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
        <button
          className="w-full flex items-center justify-center gap-2 font-semibold text-white rounded-2xl"
          style={{
            background: "linear-gradient(135deg, #0EA5E9, #0284C7)",
            padding: "14px 24px",
            fontSize: 15,
            boxShadow: "0 4px 24px #0EA5E940",
          }}
        >
          <Plus size={20} strokeWidth={2.5} />
          Log Water
        </button>
      </div>
    </div>
  );
}
