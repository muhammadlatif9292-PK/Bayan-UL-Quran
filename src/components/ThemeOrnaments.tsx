/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export function IslamicStar({ className = 'w-6 h-6 text-amber-500' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor">
      {/* 8-Pointed Star (Rub el Hizb) */}
      <path d="M50 0 L64.64 35.36 L100 50 L64.64 64.64 L50 100 L35.36 64.64 L0 50 L35.36 35.36 Z" />
      {/* Intersecting squares to perfect the geometry */}
      <rect x="18" y="18" width="64" height="64" transform="rotate(22.5 50 50)" fill="none" stroke="currentColor" strokeWidth="4" />
      <rect x="18" y="18" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="4" />
      {/* Central circular dot */}
      <circle cx="50" cy="50" r="10" />
    </svg>
  );
}

export function QuranLogo({ className = 'w-10 h-10 text-[#8B3A3A]' }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 64 64" 
      fill="none" 
      className={className}
    >
      {/* Cross-legged Wooden Rehal Stand */}
      {/* Left leg */}
      <path 
        d="M20 44 L14 56 C13 58 15 60 17 60 L24 60 L32 48 L26 44 Z" 
        fill="#795548" 
        className="transition-colors duration-300"
      />
      {/* Right leg */}
      <path 
        d="M44 44 L50 56 C51 58 49 60 47 60 L40 60 L32 48 L38 44 Z" 
        fill="#5D4037" 
        className="transition-colors duration-300"
      />
      {/* Elegant base arches/shadow of Rehal stand */}
      <path 
        d="M20 54 L24 60 L40 60 L44 54 L32 49 Z" 
        fill="#3E2723" 
        opacity="0.9"
      />

      {/* Hanging Crimson Ribbon/Bookmark with gold tip */}
      <path 
        d="M31.5 24 L31.5 50 L34.5 46 L31.5 24" 
        fill="#8B3A3A" 
      />
      <path 
        d="M32.5 24 L32.5 52 L35.5 48 L32.5 24" 
        fill="#D4A574" 
      />

      {/* Pages base thickness for 3D look */}
      <path 
        d="M6 22 C6 22 17 17 32 22 C47 17 58 22 58 22 L58 41 C58 41 47 36 32 41 C17 36 6 41 6 41 Z" 
        fill="#D4A574" 
      />
      <path 
        d="M6 23 C6 23 17 18 32 23 C47 18 58 23 58 23 L58 42 C58 42 47 37 32 42 C17 37 6 42 6 42 Z" 
        fill="#BFA36E" 
      />

      {/* Symmetrical Open Pages */}
      {/* Left Page (White/Cream) */}
      <path 
        d="M8 20 C8 20 18.5 16 31.5 21 L31.5 39 C18.5 34 8 38 8 38 Z" 
        fill="#FAF6F1" 
        stroke="#8B3A3A" 
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Right Page (White/Cream) */}
      <path 
        d="M56 20 C56 20 45.5 16 32.5 21 L32.5 39 C45.5 34 56 38 56 38 Z" 
        fill="#FAF6F1" 
        stroke="#8B3A3A" 
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Gold Inner Margin Border on left & right pages */}
      <path 
        d="M10 22 C10 22 18.5 18.5 29.5 23 L29.5 36.5 C18.5 32 10 35.5 10 35.5 Z" 
        fill="none" 
        stroke="#D4A574" 
        strokeWidth="0.8"
      />
      <path 
        d="M54 22 C54 22 45.5 18.5 34.5 23 L34.5 36.5 C45.5 32 54 35.5 54 35.5 Z" 
        fill="none" 
        stroke="#D4A574" 
        strokeWidth="0.8"
      />

      {/* Symmetrical text lines or golden Arabic emblem */}
      {/* Left Page Lines */}
      <line x1="12" y1="25" x2="27" y2="25" stroke="#3E2723" strokeWidth="0.8" opacity="0.55" strokeLinecap="round" />
      <line x1="13" y1="28" x2="26" y2="28" stroke="#3E2723" strokeWidth="0.8" opacity="0.55" strokeLinecap="round" />
      <line x1="12" y1="31" x2="27" y2="31" stroke="#3E2723" strokeWidth="0.8" opacity="0.55" strokeLinecap="round" />
      <line x1="14" y1="34" x2="25" y2="34" stroke="#3E2723" strokeWidth="0.8" opacity="0.55" strokeLinecap="round" />

      {/* Right Page Lines */}
      <line x1="37" y1="25" x2="52" y2="25" stroke="#3E2723" strokeWidth="0.8" opacity="0.55" strokeLinecap="round" />
      <line x1="38" y1="28" x2="51" y2="28" stroke="#3E2723" strokeWidth="0.8" opacity="0.55" strokeLinecap="round" />
      <line x1="37" y1="31" x2="52" y2="31" stroke="#3E2723" strokeWidth="0.8" opacity="0.55" strokeLinecap="round" />
      <line x1="39" y1="34" x2="50" y2="34" stroke="#3E2723" strokeWidth="0.8" opacity="0.55" strokeLinecap="round" />

      {/* Illuminated Golden Emblem or Medallion in center transition of pages */}
      <circle cx="32" cy="21" r="2.5" fill="#FAF6F1" stroke="#D4A574" strokeWidth="0.8" />
      <path d="M32 17.5 L32 24.5 M28.5 21 L35.5 21" stroke="#D4A574" strokeWidth="0.6" />
    </svg>
  );
}

export function GoldDivider({ className = 'w-full' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center my-4 ${className}`}>
      <div className="flex-grow border-t-2 border-[#E8DCC8]"></div>
      <div className="mx-4 flex items-center space-x-1 space-x-reverse text-[#D4A574]">
        <span className="text-[8px] opacity-75">◆</span>
        <IslamicStar className="w-5 h-5 text-[#D4A574]" />
        <span className="text-[8px] opacity-75">◆</span>
      </div>
      <div className="flex-grow border-t-2 border-[#E8DCC8]"></div>
    </div>
  );
}

export function OrnamentalCorner() {
  return (
    <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none opacity-20 text-[#D4A574]">
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M100,0 C80,20 60,10 40,40 C30,50 20,60 0,100" />
        <path d="M100,20 C85,35 70,30 55,55 C45,65 35,75 20,100" />
        <path d="M100,40 C90,50 80,50 70,70 L40,100" />
        <circle cx="90" cy="10" r="3" fill="currentColor" />
        <circle cx="95" cy="5" r="1.5" fill="currentColor" />
      </svg>
    </div>
  );
}

export function IslamicSymmetryBorders() {
  return (
    <div className="w-full flex justify-between h-2 pointer-events-none text-[#D4A574] opacity-40">
      <div className="w-8 h-full border-t border-l border-[#E8DCC8] rounded-tl"></div>
      <div className="flex-grow border-t border-[#E8DCC8] border-dashed mx-1"></div>
      <div className="w-8 h-full border-t border-r border-[#E8DCC8] rounded-tr"></div>
    </div>
  );
}

export function CardHeritageFrame({ children, isKnown, className = '', ...props }: { children: React.ReactNode; isKnown?: boolean; className?: string; [x: string]: any }) {
  // Classical Illuminated Manuscript frame (#FAF6F1 warm parchment, antique gold & crimson accents)
  return (
    <div 
      {...props}
      className={`relative bg-[#FAF6F1] border rounded-xl p-4 sm:p-5 transition-all duration-300 hover:shadow-md group overflow-hidden ${
        isKnown
          ? 'border-[#D4A574] shadow-xs'
          : 'border-[#E8DCC8] hover:border-[#D4A574]/80'
      } ${className}`}
    >
      {/* Top ornamental rule indicating mastery / manuscript header */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 transition-colors ${
          isKnown
            ? 'bg-gradient-to-r from-[#D4A574] via-[#8B3A3A]/70 to-[#D4A574]'
            : 'bg-gradient-to-r from-[#8B3A3A]/75 via-[#D4A574]/60 to-[#8B3A3A]/75'
        }`}
      />

      {/* Subtle corner rub-el-hizb watermarks */}
      <span className="absolute top-1.5 right-2 text-[10px] text-[#D4A574] opacity-25 select-none pointer-events-none">❖</span>
      <span className="absolute bottom-1.5 left-2 text-[10px] text-[#D4A574] opacity-25 select-none pointer-events-none">❖</span>
      
      {children}
    </div>
  );
}

