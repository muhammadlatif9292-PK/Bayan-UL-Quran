/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Word, Murakkab, Ayah, LearnedState, LanguageCode } from '../types';
import { IslamicStar, QuranLogo, GoldDivider } from './ThemeOrnaments';
import { surahs as ALL_SURAHS } from '../../data/surahs';
import { 
  Book, 
  BookOpen, 
  ChevronRight, 
  Sparkles, 
  BarChart3, 
  Layers, 
  Search, 
  Play, 
  History, 
  Volume2, 
  ArrowRight,
  GraduationCap
} from 'lucide-react';

interface RecitationHistoryItem {
  type: 'surah' | 'para';
  id: number;
  name: string;
  arabicName?: string;
  scrollY: number;
  timestamp: number;
}

interface DashboardProps {
  words?: Word[];
  phrases?: Murakkab[];
  ayahs?: Ayah[];
  onToggleState?: (id: string, type: 'word' | 'phrase' | 'ayah', newState: LearnedState) => void;
  onNavigate: (tab: string) => void;
  translate: (key: string) => string;
  isRtl?: boolean;
  language?: LanguageCode;
  recentRecitations?: RecitationHistoryItem[];
  onContinueRecitation?: (type: 'surah' | 'para', id: number) => void;
}

const POPULAR_SURAHS = [
  { id: 1, name: 'Al-Fatihah', arabic: 'الفاتحة', meaning: 'The Opening', ayahs: 7 },
  { id: 18, name: 'Al-Kahf', arabic: 'الكهف', meaning: 'The Cave', ayahs: 110 },
  { id: 36, name: 'Ya-Sin', arabic: 'يس', meaning: 'Ya-Sin', ayahs: 83 },
  { id: 55, name: 'Ar-Rahman', arabic: 'الرحمن', meaning: 'The Beneficent', ayahs: 78 },
  { id: 67, name: 'Al-Mulk', arabic: 'الملك', meaning: 'The Sovereignty', ayahs: 30 },
  { id: 112, name: 'Al-Ikhlas', arabic: 'الإخلاص', meaning: 'Sincerity', ayahs: 4 },
  { id: 113, name: 'Al-Falaq', arabic: 'الفلق', meaning: 'The Daybreak', ayahs: 5 },
  { id: 114, name: 'An-Nas', arabic: 'الناس', meaning: 'Mankind', ayahs: 6 },
];

const DAILY_AYAH = {
  surahNumber: 94,
  verseNumber: 5,
  arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا • إِنَّ مَعَ الْعُسْرِ يُسْرًا',
  transliteration: 'Fa inna ma\'al usri yusra. Inna ma\'al usri yusra.',
  translation: 'For indeed, with hardship comes ease. Indeed, with hardship comes ease.',
  surahName: 'Surah Ash-Sharh (94:5-6)',
  arabicSurahName: 'سورة الشرح'
};

export function Dashboard({
  onNavigate,
  translate,
  recentRecitations = [],
  onContinueRecitation
}: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamic welcome time-of-day in Arabic
  const getArabicGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return 'صباح الخير والبركة'; // Good morning
    if (hrs < 18) return 'مساء النور والسرور'; // Good afternoon
    return 'طاب مساؤكم بذكر الله'; // Good evening
  };

  const filteredSurahs = searchQuery.trim()
    ? ALL_SURAHS.filter(s => {
        const q = searchQuery.trim().toLowerCase();
        return (
          s.number.toString() === q ||
          s.nameEnglish.toLowerCase().includes(q) ||
          s.meaning.toLowerCase().includes(q) ||
          s.nameArabic.includes(searchQuery.trim())
        );
      })
        .slice(0, 16)
        .map(s => ({
          id: s.number,
          name: s.nameEnglish,
          arabic: s.nameArabic,
          meaning: s.meaning,
          ayahs: s.verses
        }))
    : POPULAR_SURAHS;

  return (
    <div className="space-y-8 pb-12 max-w-6xl mx-auto px-2 sm:px-4">
      
      {/* 1. Header Banner & Welcome Arch */}
      <div className="relative text-center py-7 px-4 sm:px-8 bg-gradient-to-b from-[#FAF6F1] via-white to-[#FAF6F1] rounded-2xl border border-[#E8DCC8]/40 shadow-xs overflow-hidden">
        <div className="absolute top-0 inset-x-0 flex justify-center opacity-[0.05] select-none pointer-events-none">
          <span className="text-8xl font-bold text-[#D4A574] font-arabic leading-none">اقْرَأْ</span>
        </div>
        
        {/* Arabic Greeting */}
        <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#8B3A3A] uppercase tracking-wider mb-1 font-mono">
          <span className="text-[#D4A574]">✦</span>
          <span>{getArabicGreeting()}</span>
          <span className="text-[#D4A574]">✦</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-[#3E2723] font-serif-eng tracking-tight relative z-10">
          {translate('app.title')}
        </h1>
        
        <p className="text-[#795548] mt-1.5 font-serif-eng text-xs sm:text-sm max-w-xl mx-auto relative z-10 italic leading-relaxed">
          "{translate('app.subtitle')}"
        </p>

        {/* Intricate Gold Arch Ornament */}
        <div className="flex items-center justify-center gap-3 mt-3">
          <div className="w-16 h-0.5 bg-gradient-to-r from-transparent to-[#D4A574] rounded-full"></div>
          <IslamicStar className="w-4 h-4 text-[#D4A574]" />
          <div className="w-16 h-0.5 bg-gradient-to-l from-transparent to-[#D4A574] rounded-full"></div>
        </div>

        {/* Quick Search Bar */}
        <div className="mt-5 max-w-md mx-auto relative z-10">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[#795548] absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all 114 Surahs by name, meaning, or #..."
              className="w-full bg-white/90 border border-[#E8DCC8] focus:border-[#8B3A3A] rounded-xl pl-10 pr-14 py-2.5 text-xs text-[#3E2723] placeholder-[#795548]/60 shadow-xs focus:ring-2 focus:ring-[#8B3A3A]/10 transition-all outline-none"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-xs text-[#795548] hover:text-[#3E2723] font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {searchQuery.trim() && (
            <div className="mt-2 bg-white border border-[#E8DCC8] rounded-xl p-2.5 shadow-md text-left max-h-60 overflow-y-auto space-y-1.5">
              {filteredSurahs.length > 0 ? (
                filteredSurahs.slice(0, 8).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onContinueRecitation?.('surah', s.id)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#FAF6F1] border border-transparent hover:border-[#E8DCC8] transition-colors text-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-[#8B3A3A]/10 text-[#8B3A3A] font-mono font-bold text-[10px] flex items-center justify-center">
                        {s.id}
                      </span>
                      <div>
                        <span className="font-bold text-[#3E2723] block">{s.name}</span>
                        <span className="text-[10px] text-[#795548] italic">{s.meaning} • {s.ayahs} verses</span>
                      </div>
                    </div>
                    <span className="font-arabic font-bold text-base text-[#8B3A3A]">{s.arabic}</span>
                  </button>
                ))
              ) : (
                <p className="text-xs text-[#795548] text-center py-2 italic">
                  No Surah found matching "{searchQuery}"
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. HERO SECTION: Noble Quran Reciter Card & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Main Majestic Quran Cover (7 Cols on LG) */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div 
            onClick={() => onNavigate('quran')}
            className="group relative w-full h-full min-h-[420px] rounded-2xl bg-gradient-to-b from-[#5c1c1c] via-[#8B3A3A] to-[#3a1010] text-white cursor-pointer transition-all duration-500 ease-out flex flex-col justify-between p-7 sm:p-9 overflow-hidden shadow-[0_15px_40px_rgba(139,58,58,0.28)] hover:shadow-[0_22px_55px_rgba(139,58,58,0.4)] border-2 border-[#D4A574] hover:border-[#FAF6F1] transform hover:-translate-y-1"
            id="quran-recitation-vertical-cover"
          >
            {/* Corner Borders */}
            <div className="absolute inset-3 border border-[#D4A574]/30 rounded-xl pointer-events-none"></div>
            <div className="absolute inset-4 border border-[#FAF6F1]/10 rounded-xl pointer-events-none"></div>
            
            {/* Corner Ornaments */}
            <div className="absolute top-5 left-5 text-[#D4A574]/60 font-serif text-lg select-none">🕃</div>
            <div className="absolute top-5 right-5 text-[#D4A574]/60 font-serif text-lg select-none">🕄</div>
            <div className="absolute bottom-5 left-5 text-[#D4A574]/60 font-serif text-lg select-none">🕀</div>
            <div className="absolute bottom-5 right-5 text-[#D4A574]/60 font-serif text-lg select-none">🕁</div>

            {/* Header */}
            <div className="text-center relative z-10 pt-1">
              <span className="text-[10px] uppercase font-bold tracking-[0.25em] text-[#FAF0D7]/80 block font-mono">
                The Holy Quran
              </span>
              <div className="w-8 h-[1px] bg-[#D4A574] mx-auto mt-1.5"></div>
            </div>

            {/* Shamsa Medallion */}
            <div className="flex flex-col items-center justify-center my-auto py-3 relative z-10">
              <div className="w-32 h-32 relative flex items-center justify-center transition-all duration-500 group-hover:scale-105">
                <div className="absolute inset-0 bg-[#D4A574]/15 rounded-full blur-xl group-hover:bg-[#D4A574]/25 transition-all duration-500"></div>
                
                <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-[0_4px_10px_rgba(0,0,0,0.3)] animate-[spin_120s_linear_infinite]">
                  <g transform="translate(60,60)">
                    <circle r="46" fill="none" stroke="#D4A574" strokeWidth="0.8" strokeDasharray="3,3" />
                    <circle r="38" fill="none" stroke="#D4A574" strokeWidth="1" />
                    <circle r="29" fill="#5c1c1c" stroke="#FAF0D7" strokeWidth="1.5" />
                    <circle r="18" fill="#FAF0D7" stroke="#D4A574" strokeWidth="1" />
                    
                    {Array.from({ length: 16 }).map((_, i) => (
                      <path
                        key={i}
                        d="M 0 -29 L 4 -37 L 0 -46 L -4 -37 Z"
                        transform={`rotate(${i * (360 / 16)})`}
                        fill="#D4A574"
                        stroke="#8B3A3A"
                        strokeWidth="0.5"
                      />
                    ))}
                    
                    {Array.from({ length: 16 }).map((_, i) => (
                      <circle
                        key={`dot-${i}`}
                        cx="0"
                        cy="-23"
                        r="1.2"
                        transform={`rotate(${i * (360 / 16) + 11.25})`}
                        fill="#FAF0D7"
                      />
                    ))}
                  </g>
                </svg>

                <div className="absolute w-12 h-12 flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
                  <QuranLogo className="w-10 h-10 text-[#8B3A3A]" />
                </div>
              </div>

              <h2 className="text-3xl font-bold font-arabic text-[#FAF0D7] tracking-wide mt-4 text-shadow-md drop-shadow-md select-none">
                القرآن الكريم
              </h2>
              <p className="text-[11px] font-serif-eng italic text-[#FAF6F1]/80 mt-1 tracking-wider">
                114 Surahs • 30 Juz • Audio Recitations
              </p>
            </div>

            {/* Action Button */}
            <div className="relative z-10 pt-2">
              <button className="w-full bg-[#D4A574] hover:bg-[#FAF0D7] text-[#3E2723] font-extrabold text-xs tracking-wider uppercase py-3 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(212,165,116,0.3)] group-hover:shadow-[0_6px_20px_rgba(212,165,116,0.5)] cursor-pointer">
                <Book className="w-4 h-4 fill-current" />
                <span>Open Quran Reciter</span>
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>

        {/* Side Panel: Recent Recitations & Daily Ayah (5 Cols on LG) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-5">
          
          {/* Continue Recitation Card */}
          <div className="bg-white border border-[#E8DCC8] rounded-2xl p-5 shadow-xs flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between border-b border-[#E8DCC8]/40 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#8B3A3A]" />
                  <h3 className="text-xs font-extrabold text-[#3E2723] uppercase font-serif-eng tracking-wider">
                    Recent Recitation
                  </h3>
                </div>
                {recentRecitations.length > 0 && (
                  <span className="text-[10px] font-mono text-[#795548] bg-[#FAF6F1] px-2 py-0.5 rounded-full border border-[#E8DCC8]/60">
                    {recentRecitations.length} Saved
                  </span>
                )}
              </div>

              {recentRecitations && recentRecitations.length > 0 ? (
                <div className="space-y-2.5">
                  {recentRecitations.slice(0, 3).map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => onContinueRecitation?.(item.type, item.id)}
                      className="group bg-[#FAF6F1]/60 hover:bg-amber-50/70 border border-[#E8DCC8]/70 hover:border-[#8B3A3A] rounded-xl p-3 cursor-pointer transition-all duration-200 flex items-center justify-between shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#8B3A3A]/10 border border-[#8B3A3A]/20 flex items-center justify-center shrink-0 group-hover:bg-[#8B3A3A] group-hover:text-white text-[#8B3A3A] transition-colors">
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-mono font-bold uppercase text-[#8B3A3A] bg-[#8B3A3A]/5 px-1.5 py-0.2 rounded">
                              {item.type === 'surah' ? 'Surah' : 'Juz'} {item.id}
                            </span>
                            {item.arabicName && (
                              <span className="text-xs font-arabic font-bold text-[#3E2723]">{item.arabicName}</span>
                            )}
                          </div>
                          <p className="text-xs font-extrabold text-[#3E2723] truncate mt-0.5 group-hover:text-[#8B3A3A] transition-colors">
                            {item.name}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 text-[10px] font-bold text-[#8B3A3A] shrink-0 pl-2">
                        <span>Resume</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 px-3 bg-[#FAF6F1]/50 rounded-xl border border-dashed border-[#E8DCC8] my-auto">
                  <BookOpen className="w-6 h-6 text-[#D4A574] mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-extrabold text-[#3E2723] font-serif-eng">No Recitation History Yet</p>
                  <p className="text-[11px] text-[#795548] mt-1 font-serif-eng italic">
                    Start reading or listening to any Surah to automatically save your progress.
                  </p>
                  <button 
                    onClick={() => onNavigate('quran')}
                    className="mt-3 px-3.5 py-1.5 text-[11px] font-bold text-[#8B3A3A] bg-white border border-[#E8DCC8] hover:border-[#8B3A3A] rounded-lg shadow-2xs transition-all cursor-pointer"
                  >
                    Browse Quran
                  </button>
                </div>
              )}
            </div>

            {/* Daily Ayah Plaque */}
            <div className="mt-4 pt-3 border-t border-[#E8DCC8]/40">
              <div className="bg-gradient-to-r from-amber-50/60 to-[#FAF6F1] border border-[#D4A574]/40 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#8B3A3A] flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#D4A574]" />
                    Ayah of the Day
                  </span>
                  <span className="text-[10px] font-serif-eng italic text-[#795548]">
                    {DAILY_AYAH.surahName}
                  </span>
                </div>
                <p className="font-arabic text-sm text-[#3E2723] text-right font-bold leading-relaxed" dir="rtl">
                  {DAILY_AYAH.arabic}
                </p>
                <p className="text-[11px] text-[#795548] font-serif-eng italic mt-1.5 leading-snug">
                  "{DAILY_AYAH.translation}"
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SMART QUICK ACCESS FEATURE GRID */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-extrabold text-[#3E2723] font-serif-eng flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D4A574]" />
              Core Application Features
            </h2>
            <p className="text-xs text-[#795548] font-serif-eng italic">
              Direct access to Quranic linguistics, vocabulary, phrases, and learning tools
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Quran Recitation */}
          <div 
            onClick={() => onNavigate('quran')}
            className="group bg-white hover:bg-amber-50/50 border border-[#E8DCC8] hover:border-[#8B3A3A] rounded-xl p-4 cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#8B3A3A]/10 border border-[#8B3A3A]/20 flex items-center justify-center text-[#8B3A3A] mb-3 group-hover:bg-[#8B3A3A] group-hover:text-white transition-colors">
                <Book className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-extrabold text-[#3E2723] group-hover:text-[#8B3A3A] transition-colors font-serif-eng">
                Quran Reciter & Reader
              </h3>
              <p className="text-[11px] text-[#795548] mt-1 leading-normal font-serif-eng">
                Interactive Mushaf reading with word-by-word audio, multi-qari downloads, and tajweed timing.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E8DCC8]/40 flex items-center justify-between text-xs font-bold text-[#8B3A3A]">
              <span>Read & Recite</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 2: Vocabulary Library */}
          <div 
            onClick={() => onNavigate('words')}
            className="group bg-white hover:bg-amber-50/50 border border-[#E8DCC8] hover:border-[#D4A574] rounded-xl p-4 cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#D4A574]/15 border border-[#D4A574]/30 flex items-center justify-center text-[#3E2723] mb-3 group-hover:bg-[#D4A574] group-hover:text-white transition-colors">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-extrabold text-[#3E2723] group-hover:text-[#8B3A3A] transition-colors font-serif-eng">
                Vocabulary Library
              </h3>
              <p className="text-[11px] text-[#795548] mt-1 leading-normal font-serif-eng">
                Browse 800+ core Quranic root words, frequency rankings, translations, and root classifications.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E8DCC8]/40 flex items-center justify-between text-xs font-bold text-[#8B3A3A]">
              <span>Explore Words</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 3: Murakkabat & Phrases */}
          <div 
            onClick={() => onNavigate('phrases')}
            className="group bg-white hover:bg-amber-50/50 border border-[#E8DCC8] hover:border-[#8B3A3A] rounded-xl p-4 cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-100/60 border border-amber-200 flex items-center justify-center text-[#8B3A3A] mb-3 group-hover:bg-[#8B3A3A] group-hover:text-white transition-colors">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-extrabold text-[#3E2723] group-hover:text-[#8B3A3A] transition-colors font-serif-eng">
                Quranic Phrases
              </h3>
              <p className="text-[11px] text-[#795548] mt-1 leading-normal font-serif-eng">
                Study Murakkabat, compound constructions, adjective-noun phrases, and grammatical patterns.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E8DCC8]/40 flex items-center justify-between text-xs font-bold text-[#8B3A3A]">
              <span>Study Phrases</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 4: Progress Analytics */}
          <div 
            onClick={() => onNavigate('analytics')}
            className="group bg-white hover:bg-amber-50/50 border border-[#E8DCC8] hover:border-[#D4A574] rounded-xl p-4 cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#3E2723]/10 border border-[#3E2723]/20 flex items-center justify-center text-[#3E2723] mb-3 group-hover:bg-[#3E2723] group-hover:text-white transition-colors">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-extrabold text-[#3E2723] group-hover:text-[#8B3A3A] transition-colors font-serif-eng">
                Learning Analytics
              </h3>
              <p className="text-[11px] text-[#795548] mt-1 leading-normal font-serif-eng">
                Track your vocabulary mastery percentage, review statuses, and learning statistics.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E8DCC8]/40 flex items-center justify-between text-xs font-bold text-[#8B3A3A]">
              <span>View Analytics</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

        </div>
      </div>

      <GoldDivider />

      {/* 4. POPULAR SURAHS QUICK LAUNCH BAR */}
      <div className="bg-white border border-[#E8DCC8] rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h3 className="text-sm font-extrabold text-[#3E2723] font-serif-eng flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#8B3A3A]" />
              Quick Launch Popular Surahs
            </h3>
            <p className="text-xs text-[#795548] font-serif-eng italic">
              Click any Surah to jump straight into audio recitation & interlinear reading
            </p>
          </div>
          <button 
            onClick={() => onNavigate('quran')}
            className="text-xs font-bold text-[#8B3A3A] hover:text-[#D4A574] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>All 114 Surahs</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {filteredSurahs.map((surah) => (
            <button
              key={surah.id}
              onClick={() => onContinueRecitation?.('surah', surah.id)}
              className="bg-[#FAF6F1]/80 hover:bg-amber-50 border border-[#E8DCC8]/80 hover:border-[#8B3A3A] rounded-xl p-2.5 text-center transition-all duration-200 group cursor-pointer flex flex-col justify-between hover:shadow-xs"
            >
              <div>
                <span className="text-[9px] font-mono text-[#795548] font-bold block">
                  Surah {surah.id}
                </span>
                <span className="text-sm font-arabic font-bold text-[#8B3A3A] block mt-0.5 group-hover:scale-105 transition-transform">
                  {surah.arabic}
                </span>
              </div>
              <div className="mt-1 pt-1 border-t border-[#E8DCC8]/40">
                <span className="text-[10px] font-bold text-[#3E2723] block truncate">
                  {surah.name}
                </span>
                <span className="text-[8.5px] text-[#795548] block truncate italic">
                  {surah.ayahs} Verses
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
