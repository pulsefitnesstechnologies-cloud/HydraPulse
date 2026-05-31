import React from "react";
import { Plus } from "lucide-react";
import "./_group.css";

// ── constants ──────────────────────────────────────────────────────────────────
const PROGRESS = 0.6;
const RING_SIZE = 190;
const RING_STROKE = 10;

// Water-drop background dimensions
const DROP_W = 270;
const DROP_H = 290;
const DROP_R = DROP_W / 2;      // 135 — radius of the bottom circle
const DROP_CX = DROP_W / 2;     // 135 — horizontal centre
const CIRCLE_CY = DROP_H - DROP_R; // 155 — centre Y of the bottom circle

function buildDropPath(): string {
  return (
    `M ${DROP_CX} 0 ` +
    `C ${DROP_W * 0.72} ${DROP_H * 0.21}, ${DROP_W} ${DROP_H * 0.48}, ${DROP_W} ${CIRCLE_CY} ` +
    `A ${DROP_R} ${DROP_R} 0 0 1 0 ${CIRCLE_CY} ` +
    `C 0 ${DROP_H * 0.48}, ${DROP_W * 0.28} ${DROP_H * 0.21}, ${DROP_CX} 0 Z`
  );
}

// Wave path: 2× drop width so SMIL translateX(-DROP_W) loops seamlessly
function buildWavePath(waveY: number): string {
  const W = DROP_W;
  const a = 9; // amplitude
  return (
    `M 0 ${waveY} ` +
    `C ${W * 0.25} ${waveY - a}, ${W * 0.75} ${waveY + a}, ${W} ${waveY} ` +
    `C ${W * 1.25} ${waveY - a}, ${W * 1.75} ${waveY + a}, ${W * 2} ${waveY} ` +
    `V ${DROP_H} H 0 Z`
  );
}

export function GoalFirst() {
  const normalizedRadius = RING_SIZE / 2 - RING_STROKE;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference * (1 - PROGRESS);

  const dropPath = buildDropPath();
  // waveY = distance from top of the drop where the water surface sits
  const waveY = DROP_H * (1 - PROGRESS); // 116 px from top at 60 %
  const wavePath = buildWavePath(waveY);

  return (
    <div
      className="w-full max-w-sm mx-auto rounded-3xl overflow-hidden relative shadow-2xl border border-slate-800"
      style={{ background: "#0F172A", fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Water-drop background fill ───────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 18,
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
            <clipPath id="gf-drop">
              <path d={dropPath} />
            </clipPath>
          </defs>

          {/* Faint drop outline */}
          <path d={dropPath} fill="none" stroke="#0EA5E918" strokeWidth={1.5} />

          {/* Static base fill */}
          <rect
            clipPath="url(#gf-drop)"
            x={0}
            y={waveY}
            width={DROP_W}
            height={DROP_H - waveY + 10}
            fill="#0EA5E914"
          />

          {/* Animated wave — SMIL translateX so no CSS transform quirks on SVG */}
          <g clipPath="url(#gf-drop)">
            <path d={wavePath} fill="#0EA5E928">
              <animateTransform
                attributeName="transform"
                type="translate"
                from="0 0"
                to={`-${DROP_W} 0`}
                dur="4s"
                repeatCount="indefinite"
              />
            </path>
          </g>

          {/* Second wave layer, offset phase for depth */}
          <g clipPath="url(#gf-drop)">
            <path d={buildWavePath(waveY + 6)} fill="#0EA5E918">
              <animateTransform
                attributeName="transform"
                type="translate"
                from={`-${DROP_W * 0.4} 0`}
                to={`-${DROP_W * 1.4} 0`}
                dur="6s"
                repeatCount="indefinite"
              />
            </path>
          </g>
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
            {/* Track */}
            <circle
              stroke="#1E293B"
              fill="transparent"
              strokeWidth={RING_STROKE}
              r={normalizedRadius}
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
            />
            {/* Progress */}
            <circle
              stroke="#0EA5E9"
              fill="transparent"
              strokeWidth={RING_STROKE}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeLinecap="round"
              style={{
                strokeDashoffset,
                filter: "drop-shadow(0 0 6px #0EA5E980)",
                transition: "stroke-dashoffset 1s ease-out",
              }}
              r={normalizedRadius}
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
            />
          </svg>

          {/* Centre: oz intake */}
          <div className="flex flex-col items-center text-center gap-0.5">
            <span
              className="font-extrabold text-white"
              style={{ fontSize: 30, lineHeight: 1 }}
            >
              48
            </span>
            <span className="text-slate-400 font-medium" style={{ fontSize: 12 }}>
              / 80 oz
            </span>
          </div>
        </div>

        {/* % — below the ring */}
        <div className="flex flex-col items-center" style={{ marginBottom: 18 }}>
          <span
            className="font-extrabold text-[#0EA5E9]"
            style={{ fontSize: 44, lineHeight: 1, letterSpacing: "-0.02em" }}
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
        <div
          className="w-full flex items-center justify-between px-1"
          style={{ marginBottom: 18 }}
        >
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-bold" style={{ fontSize: 26 }}>
                7
              </span>
              <span style={{ fontSize: 24 }}>🌊</span>
            </div>
            <span className="text-slate-400 font-medium" style={{ fontSize: 12 }}>
              Day Streak
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span
              className="font-semibold text-emerald-400"
              style={{ fontSize: 13 }}
            >
              Scanned today
            </span>
            <span className="text-slate-500" style={{ fontSize: 11 }}>
              Best: 12 days
            </span>
          </div>
        </div>

        {/* Log Water */}
        <button
          className="w-full flex items-center justify-center gap-2 font-semibold text-white rounded-2xl"
          style={{
            background: "#0EA5E9",
            padding: "14px 24px",
            fontSize: 15,
            boxShadow: "0 4px 24px #0EA5E938",
          }}
        >
          <Plus size={20} strokeWidth={2.5} />
          Log Water
        </button>
      </div>
    </div>
  );
}
