import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
}) => {
  const iconSizeClass = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  }[size];

  const textSizeClass = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  }[size];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Standard Dual-Currency Fintech Insignia (Naira ₦ + Dollar $) */}
      <div
        className={`${iconSizeClass} rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-amber-400 p-[1.5px] shadow-lg shadow-emerald-950/50 relative shrink-0 group-hover:scale-105 transition-transform duration-200`}
      >
        <div className="w-full h-full bg-[#080B10] rounded-[10px] flex items-center justify-center relative overflow-hidden">
          {/* Subtle micro grid */}
          <div className="absolute inset-0 bg-[radial-gradient(#10B981_1px,transparent_1px)] [background-size:6px_6px] opacity-15" />

          {/* Standard Dual Currency Emblem: Naira (₦) + Dollar ($) */}
          <svg
            className="w-[85%] h-[85%] relative z-10"
            viewBox="0 0 36 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Left: Standard Nigerian Naira (₦) in Emerald */}
            <g className="text-emerald-400">
              {/* Naira Left Vertical Bar */}
              <line x1="4" y1="5" x2="4" y2="23" stroke="#34D399" strokeWidth="2.2" strokeLinecap="round" />
              {/* Naira Right Vertical Bar */}
              <line x1="14" y1="5" x2="14" y2="23" stroke="#34D399" strokeWidth="2.2" strokeLinecap="round" />
              {/* Naira Diagonal Slash */}
              <line x1="4" y1="5" x2="14" y2="23" stroke="#34D399" strokeWidth="2.2" strokeLinecap="round" />
              {/* Naira Horizontal Crossbars (Standard Double Bar) */}
              <line x1="1.5" y1="11.5" x2="16.5" y2="11.5" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="1.5" y1="16.5" x2="16.5" y2="16.5" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" />
            </g>

            {/* Center Divider / Plus Accent */}
            <circle cx="18.5" cy="14" r="1.2" fill="#94A3B8" opacity="0.6" />

            {/* Right: Standard US Dollar ($) in Gold/Amber */}
            <g className="text-amber-400">
              {/* Dollar Vertical Line */}
              <line x1="27" y1="3.5" x2="27" y2="24.5" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
              {/* Standard Dollar S curves */}
              <path
                d="M32 8.5C32 6.567 30.2 5 27 5C23.8 5 22 6.567 22 8.5C22 10.433 23.8 11.5 27 12.5C30.2 13.5 32 14.567 32 17.5C32 20.433 29.8 22 27 22C23.5 22 22 20 22 17.5"
                stroke="#FCD34D"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </g>
          </svg>
        </div>
      </div>

      {/* Brand Text */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className={`${textSizeClass} font-extrabold tracking-tight text-white font-mono`}>
              Pappy Earning Hub
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ₦ / $
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono -mt-0.5">
            Verified Micro-Tasks &amp; Growth
          </span>
        </div>
      )}
    </div>
  );
};
