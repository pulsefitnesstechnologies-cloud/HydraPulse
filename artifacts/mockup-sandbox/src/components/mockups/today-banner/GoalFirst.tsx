import React from "react";
import { Plus } from "lucide-react";
import "./_group.css";

export function GoalFirst() {
  const radius = 70;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - 0.6 * circumference;

  return (
    <div className="w-full max-w-sm mx-auto bg-[#0F172A] rounded-3xl overflow-hidden relative shadow-2xl border border-slate-800 font-sans">
      {/* Animated water background fill */}
      <div className="absolute inset-0 bg-sky-900/20 opacity-50 z-0 animate-goal-water-rise" />
      
      <div className="relative z-10 p-6 flex flex-col items-center pt-8">
        
        {/* Progress Ring */}
        <div className="relative w-[160px] h-[160px] flex items-center justify-center mb-6">
          <svg
            height="160"
            width="160"
            className="transform -rotate-90 absolute inset-0 drop-shadow-lg"
          >
            {/* Background circle */}
            <circle
              stroke="#1E293B"
              fill="transparent"
              strokeWidth={stroke}
              r={normalizedRadius}
              cx="80"
              cy="80"
            />
            {/* Progress circle */}
            <circle
              stroke="#0EA5E9"
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={circumference + " " + circumference}
              style={{ strokeDashoffset, transition: "stroke-dashoffset 1s ease-out" }}
              strokeLinecap="round"
              r={normalizedRadius}
              cx="80"
              cy="80"
            />
          </svg>
          <div className="flex flex-col items-center text-center mt-2">
            <span className="text-4xl font-extrabold text-white tracking-tighter leading-none mb-1">60%</span>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Hydrated</span>
          </div>
        </div>

        {/* Info Row */}
        <div className="w-full flex items-center justify-between mt-2 px-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-slate-100 font-bold text-lg">7</span>
              <span className="text-lg leading-none">🌊</span>
            </div>
            <span className="text-xs text-slate-400 font-medium">Day Streak</span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-slate-100 font-bold text-lg">48<span className="text-sm font-semibold text-slate-400 ml-1">/80 oz</span></span>
            <span className="text-xs text-slate-400 font-medium">Today</span>
          </div>
        </div>

        {/* Log Action */}
        <button className="mt-8 w-full bg-[#0EA5E9] hover:bg-sky-400 active:bg-sky-500 text-white font-semibold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-sky-900/30">
          <Plus size={20} strokeWidth={2.5} />
          <span>Log Water</span>
        </button>

      </div>
    </div>
  );
}
