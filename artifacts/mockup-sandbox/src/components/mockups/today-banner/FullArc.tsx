import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Scan } from 'lucide-react';
import './_group.css';

export function FullArc() {
  const currentStreak = 7;
  const todayTotalOz = 48;
  const dailyGoalOz = 80;
  const progress = todayTotalOz / dailyGoalOz; // 0.6
  const percentage = Math.round(progress * 100);

  // SVG parameters
  const size = 300;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  // Circumference of half circle = PI * r
  // Wait, we want a 270 degree arc, so 0.75 of a full circle.
  // Full circumference = 2 * PI * r
  // Let's do a simple 180 degree arc for simplicity and good looking.
  const circumference = Math.PI * radius;
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950 p-4 font-sans text-slate-50">
      <Card className="w-full max-w-sm bg-slate-900 border-slate-800 overflow-hidden rounded-3xl shadow-2xl p-6 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-500 to-emerald-400" />
        
        {/* Top Arc Section */}
        <div className="relative flex flex-col items-center justify-center pt-4 pb-8 fade-in-up">
          <div className="relative w-48 h-24 overflow-hidden">
            <svg
              className="w-48 h-48 absolute top-0 left-0 transform"
              viewBox={`0 0 ${size} ${size}`}
            >
              <path
                d={`M ${strokeWidth/2} ${center} A ${radius} ${radius} 0 0 1 ${size - strokeWidth/2} ${center}`}
                fill="none"
                stroke="#1E293B" // slate-800
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
              <path
                d={`M ${strokeWidth/2} ${center} A ${radius} ${radius} 0 0 1 ${size - strokeWidth/2} ${center}`}
                fill="none"
                stroke="url(#arcGradient)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                className="animate-arc"
                style={{ 
                  strokeDasharray: circumference,
                  strokeDashoffset: circumference * (1 - progress)
                }}
              />
              <defs>
                <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0EA5E9" />
                  <stop offset="100%" stopColor="#10B981" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute bottom-0 left-0 w-full text-center pb-2">
              <span className="text-4xl font-extrabold tracking-tighter text-white">
                {percentage}%
              </span>
              <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-widest">
                {todayTotalOz} / {dailyGoalOz} oz
              </p>
            </div>
          </div>
        </div>

        {/* Stats Columns */}
        <div className="grid grid-cols-2 gap-4 mt-2">
          {/* Left Column */}
          <div className="bg-slate-800/50 rounded-2xl p-4 flex flex-col justify-center items-center border border-slate-800/80 fade-in-up delay-100">
            <span className="text-3xl font-black text-white">{currentStreak} 🌊</span>
            <span className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-wider">Day Streak</span>
          </div>

          {/* Right Column */}
          <div className="bg-slate-800/50 rounded-2xl p-4 flex flex-col justify-between items-center border border-slate-800/80 fade-in-up delay-200">
            <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full text-xs font-bold mb-3">
              <Scan className="w-3 h-3" />
              Scanned Today
            </div>
            <Button className="w-full bg-sky-500 hover:bg-sky-400 text-white rounded-xl font-bold shadow-lg shadow-sky-500/20">
              <Plus className="w-4 h-4 mr-1" />
              Log Water
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}