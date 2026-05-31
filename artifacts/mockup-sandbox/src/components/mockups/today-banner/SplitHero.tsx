import React from 'react';
import './_group.css';

export function SplitHero() {
  const progress = 0.60;
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div className="w-full max-w-sm mx-auto bg-slate-900 rounded-3xl overflow-hidden relative border border-slate-800 shadow-2xl font-sans">
      
      {/* Animated Water Background - 60% fill */}
      <div className="absolute inset-0 top-[40%] bg-sky-500/10 pointer-events-none animate-rise border-t border-sky-500/20">
        <div className="absolute top-0 left-0 right-[-100%] h-8 -mt-8 opacity-50">
          <svg viewBox="0 0 800 32" className="w-full h-full fill-sky-500/10 animate-wave-fill" preserveAspectRatio="none">
            <path d="M0,32L80,21.3C160,11,320,-11,480,5.3C640,21,800,43,880,53.3L960,64L960,32L880,32C800,32,640,32,480,32C320,32,160,32,80,32L0,32Z"></path>
          </svg>
        </div>
        <div className="absolute top-0 left-0 right-[-100%] h-8 -mt-8 opacity-30">
          <svg viewBox="0 0 800 32" className="w-full h-full fill-sky-500/20 animate-wave-fill" style={{ animationDirection: 'reverse', animationDuration: '6s' }} preserveAspectRatio="none">
            <path d="M0,10.7L80,16C160,21,320,32,480,26.7C640,21,800,0,880,-10.7L960,-21.3L960,32L880,32C800,32,640,32,480,32C320,32,160,32,80,32L0,32Z"></path>
          </svg>
        </div>
      </div>

      <div className="relative z-10 p-6 flex flex-col gap-8">
        
        {/* Split Layout */}
        <div className="flex items-center justify-between">
          
          {/* Left: Streak */}
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="text-7xl font-bold text-white tracking-tighter leading-none">7</span>
              <span className="text-3xl">🌊</span>
            </div>
            <span className="text-slate-400 font-medium tracking-wide mt-2">day streak</span>
            <div className="mt-4 px-3 py-1 bg-slate-800/80 rounded-full inline-flex items-center self-start border border-slate-700/50">
              <span className="text-xs text-slate-300">Best: 12 days</span>
            </div>
          </div>

          {/* Right: Goal Ring */}
          <div className="flex flex-col items-center">
            <div className="relative w-24 h-24 flex items-center justify-center">
              {/* Background Ring */}
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="transparent"
                  stroke="#1E293B"
                  strokeWidth="8"
                />
                {/* Progress Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="transparent"
                  stroke="#0EA5E9"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              
              <div className="flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white tracking-tight">48</span>
                <span className="text-xs text-sky-400 font-medium">oz</span>
              </div>
            </div>
            
            <div className="mt-3 text-center">
              <span className="text-xs text-slate-400 font-medium block">/ 80 oz goal</span>
              <span className="text-[10px] text-emerald-400 mt-1 flex items-center justify-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Scanned today
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button className="w-full bg-sky-500 hover:bg-sky-400 text-white font-semibold py-4 px-6 rounded-2xl shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-y-0.5 transition-transform">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          Log Water
        </button>

      </div>
    </div>
  );
}