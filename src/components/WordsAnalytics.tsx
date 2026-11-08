/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Word, LearnedState } from '../types';
import { CardHeritageFrame, GoldDivider } from './ThemeOrnaments';
import { THEME_TAXONOMY, GRAMMAR_POS_OPTIONS } from '../data/quranData';
import { Trophy, Star, BookOpen, Target } from 'lucide-react';

interface WordsAnalyticsProps {
  words: Word[];
  translate: (key: string) => string;
}

export function WordsAnalytics({ words, translate }: WordsAnalyticsProps) {
  // Counts
  const totalW = words.length;
  const knownW = words.filter(w => w.learnedState === 'known' || w.learnedState === 'mastered').length;
  const learningW = words.filter(w => w.learnedState === 'learning').length;
  const reviewW = words.filter(w => w.learnedState === 'review').length;
  const newW = words.filter(w => w.learnedState === 'new').length;

  // Core vocabulary coverage
  const coreWords = words.filter(w => w.isCore);
  const totalCoreWords = coreWords.length;
  const learnedCoreWords = coreWords.filter(w => w.learnedState === 'known' || w.learnedState === 'mastered').length;
  const solvedPercentage = totalCoreWords > 0 ? ((learnedCoreWords / totalCoreWords) * 100).toFixed(1) : '0.0';

  // Math percentages
  const wordPercentage = totalW > 0 ? Math.round((knownW / totalW) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="text-center py-2">
        <h2 className="text-2xl font-bold font-serif-eng text-[#3E2723] flex items-center justify-center gap-2">
          <BookOpen className="w-6 h-6 text-[#D4A574]" /> {translate('analytics.wordsTitle')}
        </h2>
        <p className="text-[#795548] text-xs font-serif-eng italic mt-1">
          {translate('analytics.wordsSubtitle')}
        </p>
      </div>

      {/* Core Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <CardHeritageFrame isKnown={true} className="flex flex-col items-center justify-center text-center p-6">
          <h3 className="text-sm font-bold text-[#3E2723] font-serif-eng mb-4">{translate('analytics.coreProgress')}</h3>
          
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
                strokeDashoffset={376.8 - (376.8 * Number(solvedPercentage)) / 100}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-[#8B3A3A] font-mono leading-none">{solvedPercentage}%</span>
              <span className="text-[9px] text-[#795548] font-bold uppercase tracking-wider mt-1">{translate('analytics.quranCover')}</span>
            </div>
          </div>

          <div className="mt-4 text-xs text-[#795548] space-y-1">
            <p className="font-bold text-[#3E2723]">{learnedCoreWords} of {totalCoreWords} {translate('analytics.coreWordsMastered')}</p>
            <p className="italic text-[10px]">{translate('analytics.coreDescription')}</p>
          </div>
        </CardHeritageFrame>

        {/* Overall Progress */}
        <div className="bg-[#FAF6F1] border border-[#E8DCC8] rounded-lg p-6 flex flex-col justify-center">
          <h3 className="text-sm font-bold text-[#3E2723] font-serif-eng mb-4 uppercase tracking-wide">
            {translate('analytics.overallProgress')}
          </h3>

          <div className="space-y-4">
            <div className="bg-white border border-[#E8DCC8] p-4 rounded-lg space-y-1.5">
              <div className="flex justify-between items-center text-xs text-[#3E2723] font-bold">
                <span className="flex items-center gap-1">📚 {translate('analytics.uniqueRoots')}</span>
                <span className="font-mono">{knownW} / {totalW} {translate('analytics.mastered')} ({wordPercentage}%)</span>
              </div>
              <div className="h-3 w-full bg-[#E8DCC8] rounded-full overflow-hidden">
                <div className="h-full bg-[#8B3A3A] rounded-full transition-all" style={{ width: `${wordPercentage}%` }}></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-[#E8DCC8] p-3 rounded-lg text-center">
                <p className="text-[#8B3A3A] font-mono font-bold text-xl">{newW}</p>
                <p className="text-[10px] text-[#795548] uppercase tracking-wide">{translate('analytics.newRemaining')}</p>
              </div>
              <div className="bg-white border border-[#E8DCC8] p-3 rounded-lg text-center">
                <p className="text-amber-500 font-mono font-bold text-xl">{learningW}</p>
                <p className="text-[10px] text-[#795548] uppercase tracking-wide">{translate('analytics.activeStudy')}</p>
              </div>
              <div className="bg-white border border-[#E8DCC8] p-3 rounded-lg text-center">
                <p className="text-[#D4A574] font-mono font-bold text-xl">{knownW}</p>
                <p className="text-[10px] text-[#795548] uppercase tracking-wide">{translate('analytics.known')}</p>
              </div>
              <div className="bg-white border border-[#E8DCC8] p-3 rounded-lg text-center">
                <p className="text-blue-500 font-mono font-bold text-xl">{reviewW}</p>
                <p className="text-[10px] text-[#795548] uppercase tracking-wide">{translate('analytics.review')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <GoldDivider />

      {/* Grammar Performance */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-[#3E2723] font-serif-eng uppercase tracking-wide border-b border-[#E8DCC8] pb-1">
          {translate('analytics.grammarTitle')}
        </h3>
        <p className="text-xs text-[#795548] italic">
          {translate('analytics.grammarSubtitle')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {GRAMMAR_POS_OPTIONS.map(pos => {
            const matchingWords = words.filter(w => w.pos === pos.id);
            const totalForPos = matchingWords.length;
            const knownForPos = matchingWords.filter(w => w.learnedState === 'known' || w.learnedState === 'mastered').length;
            const ratio = totalForPos > 0 ? (knownForPos / totalForPos) * 100 : 0;

            return (
              <div key={pos.id} className="bg-white border border-[#E8DCC8] rounded-lg p-4 flex flex-col justify-between hover:border-[#D4A574] transition-colors shadow-xs">
                <div>
                  <span className="text-xs font-bold text-[#8B3A3A] block">{pos.labels.en}</span>
                  <span className="text-[10px] text-[#795548] block">{translate('analytics.grammarGroup')}</span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="w-full bg-[#E8DCC8] h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-[#D4A574] rounded-full" style={{ width: `${ratio}%` }}></div>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#3E2723] shrink-0">
                    {knownForPos} / {totalForPos}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <GoldDivider />

      {/* Thematic Coverage */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-[#3E2723] font-serif-eng uppercase tracking-wide border-b border-[#E8DCC8] pb-1">
          {translate('analytics.themesTitle')}
        </h3>
        <p className="text-xs text-[#795548] italic">
          {translate('analytics.themesSubtitle')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {THEME_TAXONOMY.map(theme => {
            const matchingWords = words.filter(w => w.themes.includes(theme.id));
            const totalForT = matchingWords.length;
            const knownForT = matchingWords.filter(w => w.learnedState === 'known' || w.learnedState === 'mastered').length;
            const ratio = totalForT > 0 ? (knownForT / totalForT) * 100 : 0;

            return (
              <div key={theme.id} className="bg-white border border-[#E8DCC8] rounded-lg p-4 flex flex-col justify-between hover:border-[#D4A574] transition-colors shadow-sm">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <span className="text-xl">{theme.emoji}</span>
                  <div>
                    <span className="text-xs font-bold text-[#3E2723] block">{theme.labels.en}</span>
                    <span className="text-[10px] text-stone-400 font-mono block">{translate('analytics.taxonomyId')}: {theme.id}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="w-full bg-[#E8DCC8] h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-[#8B3A3A] rounded-full" style={{ width: `${ratio}%` }}></div>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#3E2723] shrink-0">
                    {knownForT} / {totalForT}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
