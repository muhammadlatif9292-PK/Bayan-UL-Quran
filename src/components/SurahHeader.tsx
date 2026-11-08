/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Surah } from '../types';
import { ChevronDown, ChevronUp, BookOpen, MapPin, Star } from 'lucide-react';

interface SurahHeaderProps {
  surah: Surah;
  isExpanded: boolean;
  onToggle: () => void;
  lang: string;
  isRtl: boolean;
  translate: (key: string) => string;
}

export function SurahHeader({
  surah,
  isExpanded,
  onToggle,
  lang,
  isRtl,
  translate
}: SurahHeaderProps) {
  const getRevelationColor = (place: string) => {
    return place === 'Meccan' 
      ? 'from-amber-500 to-orange-600' 
      : 'from-emerald-500 to-teal-600';
  };

  const getRevelationIcon = (place: string) => {
    return place === 'Meccan' ? '🕋' : '🕌';
  };

  return (
    <div 
      onClick={onToggle}
      className={`
        relative overflow-hidden rounded-2xl cursor-pointer
        bg-gradient-to-br ${getRevelationColor(surah.revelationPlace)}
        shadow-xl hover:shadow-2xl transition-all duration-300
        border-2 border-white/20 hover:border-white/40
        group
      `}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Decorative pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')]"></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 p-6">
        {/* Top row: Number and Name */}
        <div className="flex items-center justify-between mb-4">
          {/* Surah Number Badge */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30 shadow-lg">
              <span className="text-2xl font-bold text-white">{surah.number}</span>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: 'Amiri, serif' }}>
                {surah.nameArabic}
              </h2>
              <p className="text-white/90 font-semibold text-lg">
                {surah.nameEnglish}
              </p>
            </div>
          </div>

          {/* Expand/Collapse Icon */}
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30 shadow-lg group-hover:bg-white/30 transition-colors">
            {isExpanded ? (
              <ChevronUp className="w-6 h-6 text-white" />
            ) : (
              <ChevronDown className="w-6 h-6 text-white" />
            )}
          </div>
        </div>

        {/* Meaning */}
        <div className="mb-4">
          <p className="text-white/95 text-lg font-medium italic">
            "{surah.meaning}"
          </p>
        </div>

        {/* Info badges row */}
        <div className="flex flex-wrap gap-3">
          {/* Verses count */}
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full border border-white/30">
            <BookOpen className="w-4 h-4 text-white" />
            <span className="text-white font-medium text-sm">
              {surah.verses} {translate('verses')}
            </span>
          </div>

          {/* Revelation place */}
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full border border-white/30">
            <span className="text-lg">{getRevelationIcon(surah.revelationPlace)}</span>
            <span className="text-white font-medium text-sm">
              {translate(surah.revelationPlace.toLowerCase())}
            </span>
          </div>

          {/* Revelation order */}
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full border border-white/30">
            <Star className="w-4 h-4 text-white" />
            <span className="text-white font-medium text-sm">
              #{surah.revelationOrder}
            </span>
          </div>
        </div>

        {/* Progress indicator for expansion */}
        <div className={`mt-4 h-1 bg-white/30 rounded-full overflow-hidden transition-all duration-300 ${isExpanded ? 'opacity-0' : 'opacity-100'}`}>
          <div className="h-full bg-white/60 rounded-full animate-pulse" style={{ width: '60%' }}></div>
        </div>
      </div>

      {/* Bottom accent line */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent transition-all duration-300 ${isExpanded ? 'opacity-0' : 'opacity-100'}`}></div>
    </div>
  );
}
