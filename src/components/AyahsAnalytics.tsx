/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Ayah } from '../types';
import { surahs } from '../../data/surahs';
import { CardHeritageFrame, GoldDivider } from './ThemeOrnaments';
import { GraduationCap, MapPin, BookMarked } from 'lucide-react';

interface AyahsAnalyticsProps {
  ayahs: Ayah[];
  translate: (key: string) => string;
}

const SURAH_REVELATION_MAP = new Map<number, 'Meccan' | 'Medinan'>(
  surahs.map(s => [s.number, s.revelationPlace === 'Medinan' ? 'Medinan' : 'Meccan'])
);
const TOTAL_QURAN_VERSES = surahs.reduce((sum, s) => sum + s.verses, 0); // 6,236
const TOTAL_MECCAN_VERSES = surahs
  .filter(s => s.revelationPlace === 'Meccan')
  .reduce((sum, s) => sum + s.verses, 0);
const TOTAL_MEDINAN_VERSES = surahs
  .filter(s => s.revelationPlace === 'Medinan')
  .reduce((sum, s) => sum + s.verses, 0);

export function AyahsAnalytics({ ayahs, translate }: AyahsAnalyticsProps) {
  // Full Quranic Corpus Counts + User Progress
  const totalA = Math.max(TOTAL_QURAN_VERSES, ayahs.length);
  const knownA = ayahs.filter(a => a.learnedState === 'known' || a.learnedState === 'mastered').length;
  const learningA = ayahs.filter(a => a.learnedState === 'learning').length;
  const reviewA = ayahs.filter(a => a.learnedState === 'review').length;
  const newA = Math.max(0, totalA - knownA - learningA - reviewA);

  // Revelation period breakdown against full Quranic Meccan/Medinan totals
  const knownMeccan = ayahs.filter(a => {
    const period = a.revelationPeriod || SURAH_REVELATION_MAP.get(a.surah) || 'Meccan';
    return period === 'Meccan' && (a.learnedState === 'known' || a.learnedState === 'mastered');
  }).length;
  const knownMedinan = ayahs.filter(a => {
    const period = a.revelationPeriod || SURAH_REVELATION_MAP.get(a.surah) || 'Meccan';
    return period === 'Medinan' && (a.learnedState === 'known' || a.learnedState === 'mastered');
  }).length;

  const meccanPercentage = TOTAL_MECCAN_VERSES > 0 ? Math.round((knownMeccan / TOTAL_MECCAN_VERSES) * 100) : 0;
  const medinanPercentage = TOTAL_MEDINAN_VERSES > 0 ? Math.round((knownMedinan / TOTAL_MEDINAN_VERSES) * 100) : 0;

  // Surah coverage across all 114 Surahs
  const totalSurahsCount = surahs.length; // 114
  const surahsWithProgress = new Set(
    ayahs
      .filter(a => a.learnedState === 'known' || a.learnedState === 'mastered')
      .map(a => a.surah)
  );

  // Math percentages
  const ayahPercentage = totalA > 0 ? Math.round((knownA / totalA) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="text-center py-2">
        <h2 className="text-2xl font-bold font-serif-eng text-[#3E2723] flex items-center justify-center gap-2">
          <GraduationCap className="w-6 h-6 text-[#D4A574]" /> {translate('analytics.ayahsTitle')}
        </h2>
        <p className="text-[#795548] text-xs font-serif-eng italic mt-1">
          {translate('analytics.ayahsSubtitle')}
        </p>
      </div>

      {/* Overall Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <CardHeritageFrame isKnown={true} className="flex flex-col items-center justify-center text-center p-6">
          <h3 className="text-sm font-bold text-[#3E2723] font-serif-eng mb-4">{translate('analytics.verseProgress')}</h3>
          
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r="60"
                stroke="#E8DCC8"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="72"
                cy="72"
                r="60"
                stroke="#D4A574"
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={376.8}
                strokeDashoffset={376.8 - (376.8 * ayahPercentage) / 100}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-[#8B3A3A] font-mono leading-none">{ayahPercentage}%</span>
              <span className="text-[9px] text-[#795548] font-bold uppercase tracking-wider mt-1">{translate('analytics.versesMastered')}</span>
            </div>
          </div>

          <div className="mt-4 text-xs text-[#795548] space-y-1">
            <p className="font-bold text-[#3E2723]">{knownA} of {totalA} {translate('analytics.totalVerses')}</p>
            <p className="italic text-[10px]">{translate('analytics.verseDescription')}</p>
          </div>
        </CardHeritageFrame>

        {/* Status Breakdown */}
        <div className="bg-[#FAF6F1] border border-[#E8DCC8] rounded-lg p-6 flex flex-col justify-center">
          <h3 className="text-sm font-bold text-[#3E2723] font-serif-eng mb-4 uppercase tracking-wide">
            {translate('analytics.statusBreakdown')}
          </h3>

          <div className="space-y-4">
            <div className="bg-white border border-[#E8DCC8] p-4 rounded-lg space-y-1.5">
              <div className="flex justify-between items-center text-xs text-[#3E2723] font-bold">
                <span className="flex items-center gap-1">📖 {translate('analytics.verseLessons')}</span>
                <span className="font-mono">{knownA} / {totalA} {translate('analytics.mastered')} ({ayahPercentage}%)</span>
              </div>
              <div className="h-3 w-full bg-[#E8DCC8] rounded-full overflow-hidden">
                <div className="h-full bg-[#3E2723] rounded-full transition-all" style={{ width: `${ayahPercentage}%` }}></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-[#E8DCC8] p-3 rounded-lg text-center">
                <p className="text-[#8B3A3A] font-mono font-bold text-xl">{newA}</p>
                <p className="text-[10px] text-[#795548] uppercase tracking-wide">{translate('analytics.newRemaining')}</p>
              </div>
              <div className="bg-white border border-[#E8DCC8] p-3 rounded-lg text-center">
                <p className="text-amber-500 font-mono font-bold text-xl">{learningA}</p>
                <p className="text-[10px] text-[#795548] uppercase tracking-wide">{translate('analytics.activeStudy')}</p>
              </div>
              <div className="bg-white border border-[#E8DCC8] p-3 rounded-lg text-center">
                <p className="text-[#D4A574] font-mono font-bold text-xl">{knownA}</p>
                <p className="text-[10px] text-[#795548] uppercase tracking-wide">{translate('analytics.known')}</p>
              </div>
              <div className="bg-white border border-[#E8DCC8] p-3 rounded-lg text-center">
                <p className="text-blue-500 font-mono font-bold text-xl">{reviewA}</p>
                <p className="text-[10px] text-[#795548] uppercase tracking-wide">{translate('analytics.review')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <GoldDivider />

      {/* Revelation Period Analysis */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-[#3E2723] font-serif-eng uppercase tracking-wide border-b border-[#E8DCC8] pb-1">
          {translate('analytics.revelationTitle')}
        </h3>
        <p className="text-xs text-[#795548] italic">
          {translate('analytics.revelationSubtitle')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-[#E8DCC8] rounded-lg p-4 hover:border-[#D4A574] transition-colors shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-[#D4A574]" />
              <span className="text-xs font-bold text-[#8B3A3A]">{translate('analytics.meccan')}</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#795548]">{translate('analytics.total')}:</span>
                <span className="font-mono font-bold text-[#3E2723]">{TOTAL_MECCAN_VERSES.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#795548]">{translate('analytics.mastered')}:</span>
                <span className="font-mono font-bold text-[#D4A574]">{knownMeccan}</span>
              </div>
              <div className="h-2 w-full bg-[#E8DCC8] rounded-full overflow-hidden">
                <div className="h-full bg-[#8B3A3A] rounded-full" style={{ width: `${meccanPercentage}%` }}></div>
              </div>
              <p className="text-[10px] text-right font-mono text-[#795548]">{meccanPercentage}%</p>
            </div>
          </div>

          <div className="bg-white border border-[#E8DCC8] rounded-lg p-4 hover:border-[#D4A574] transition-colors shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <BookMarked className="w-4 h-4 text-[#D4A574]" />
              <span className="text-xs font-bold text-[#8B3A3A]">{translate('analytics.medinan')}</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#795548]">{translate('analytics.total')}:</span>
                <span className="font-mono font-bold text-[#3E2723]">{TOTAL_MEDINAN_VERSES.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#795548]">{translate('analytics.mastered')}:</span>
                <span className="font-mono font-bold text-[#D4A574]">{knownMedinan}</span>
              </div>
              <div className="h-2 w-full bg-[#E8DCC8] rounded-full overflow-hidden">
                <div className="h-full bg-[#D4A574] rounded-full" style={{ width: `${medinanPercentage}%` }}></div>
              </div>
              <p className="text-[10px] text-right font-mono text-[#795548]">{medinanPercentage}%</p>
            </div>
          </div>
        </div>
      </div>

      <GoldDivider />

      {/* Surah Coverage */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-[#3E2723] font-serif-eng uppercase tracking-wide border-b border-[#E8DCC8] pb-1">
          {translate('analytics.surahCoverage')}
        </h3>
        <p className="text-xs text-[#795548] italic">
          {translate('analytics.surahSubtitle')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-[#E8DCC8] rounded-lg p-4 text-center">
            <p className="text-3xl font-mono font-bold text-[#8B3A3A]">{totalSurahsCount}</p>
            <p className="text-[10px] text-[#795548] uppercase tracking-wide mt-1">{translate('analytics.uniqueSurahs')}</p>
          </div>
          <div className="bg-white border border-[#E8DCC8] rounded-lg p-4 text-center">
            <p className="text-3xl font-mono font-bold text-[#D4A574]">{surahsWithProgress.size}</p>
            <p className="text-[10px] text-[#795548] uppercase tracking-wide mt-1">{translate('analytics.surahsWithProgress')}</p>
          </div>
          <div className="bg-white border border-[#E8DCC8] rounded-lg p-4 text-center">
            <p className="text-3xl font-mono font-bold text-[#3E2723]">
              {totalSurahsCount > 0 ? Math.round((surahsWithProgress.size / totalSurahsCount) * 100) : 0}%
            </p>
            <p className="text-[10px] text-[#795548] uppercase tracking-wide mt-1">{translate('analytics.surahCoverageRate')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
