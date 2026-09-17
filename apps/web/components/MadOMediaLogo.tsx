'use client';
import React from 'react';

export interface MadOMediaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'dark' | 'light';
  className?: string;
  badgeText?: string;
  showBadge?: boolean;
  variant?: 'full' | 'icon';
}

export default function MadOMediaLogo({
  size = 'md',
  theme = 'light',
  className = '',
  badgeText = 'AGENCY OS',
  showBadge = true,
  variant = 'full',
}: MadOMediaLogoProps) {
  const isDark = theme === 'dark';

  // Balanced icon sizing
  const iconHeights = {
    sm: 'h-5 sm:h-[22px]',
    md: 'h-6 sm:h-[26px]',
    lg: 'h-8 sm:h-9',
    xl: 'h-11 sm:h-12',
  };

  // Space Grotesk typography
  const textSizes = {
    sm: 'text-[12.5px] sm:text-[13.5px] font-bold tracking-[0.11em]',
    md: 'text-[13.5px] sm:text-[14.5px] font-bold tracking-[0.12em]',
    lg: 'text-lg sm:text-xl font-extrabold tracking-[0.14em]',
    xl: 'text-2xl sm:text-3xl font-black tracking-[0.15em]',
  };

  const dividerHeights = {
    sm: 'h-3.5',
    md: 'h-4',
    lg: 'h-5.5',
    xl: 'h-7',
  };

  const badgeSizes = {
    sm: 'text-[9px] px-1.5 py-[1px]',
    md: 'text-[9.5px] px-1.5 py-[1.5px]',
    lg: 'text-[11px] px-2 py-0.5',
    xl: 'text-xs px-2.5 py-1',
  };

  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <img
          src="/mad-o-media-mark.png"
          srcSet="/mad-o-media-mark.png 1x, /mad-o-media-mark@4x.png 2x"
          alt="MAD O MEDIA Icon"
          className={`${iconHeights[size]} w-auto object-contain drop-shadow-xs transition-transform duration-200 hover:scale-105`}
        />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 sm:gap-2.5 select-none ${className}`}>
      {/* Crisp Brand Mark Icon */}
      <img
        src="/mad-o-media-mark.png"
        srcSet="/mad-o-media-mark.png 1x, /mad-o-media-mark@4x.png 2x"
        alt="MAD O MEDIA"
        className={`${iconHeights[size]} w-auto object-contain shrink-0 transition-transform duration-200 hover:scale-105`}
      />

      {/* Modern Slim Divider */}
      <span
        className={`${dividerHeights[size]} w-[1px] shrink-0 transition-colors ${
          isDark ? 'bg-white/20' : 'bg-stone-300/80'
        }`}
        aria-hidden="true"
      />

      {/* Brand Name Typography */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span
          className={`uppercase whitespace-nowrap transition-colors ${textSizes[size]} ${
            isDark
              ? 'text-[#00B4FF] drop-shadow-[0_0_10px_rgba(0,180,255,0.3)]'
              : 'text-[#0284C7]'
          }`}
          style={{ fontFamily: "'Space Grotesk', system-ui, -apple-system, sans-serif" }}
        >
          MAD O MEDIA
        </span>

        {showBadge && (
          <span
            className={`rounded font-bold tracking-wider uppercase transition-colors ${badgeSizes[size]} ${
              isDark
                ? 'bg-[#00B4FF]/15 text-[#00B4FF] border border-[#00B4FF]/30 shadow-[0_0_8px_rgba(0,180,255,0.15)]'
                : 'bg-sky-50 text-sky-700 border border-sky-200/80'
            }`}
          >
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
}
