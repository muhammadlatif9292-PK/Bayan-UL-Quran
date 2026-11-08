/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Murakkab, LearnedState } from '../types';
import { CardHeritageFrame, GoldDivider } from './ThemeOrnaments';
import { Sparkles, Target, TrendingUp } from 'lucide-react';

interface PhrasesAnalyticsProps {
  phrases: Murakkab[];
  translate: (key: string) => string;
}

export function PhrasesAnalytics({ phrases, translate }: PhrasesAnalyticsProps) {
  // Counts
  const totalP = phrases.length;
  const knownP = phrases.filter(p => p.learnedState === 'known' || p.learnedState === 'mastered').length;
  const learningP = phrases.filter(p => p.learnedState === 'learning').length;
  const reviewP = phrases.filter(p => p.learnedState === 'review').length;
  const newP = phrases.filter(p => p.learnedState === 'new').length;

  // High frequency phrases (top 20% by frequency)
  const sortedByFreq = [...phrases].sort((a, b) => b.frequency - a.frequency);
  const highFreqThreshold = Math.max(1, Math.floor(sortedByFreq.length * 0.2));
  const highFreqPhrases = sortedByFreq.slice(0, highFreqThreshold);
  const learnedHighFreq = highFreqPhrases.filter(p => p.learnedState === 'known' || p.learnedState === 'mastered').length;
  const highFreqPercentage = highFreqPhrases.length > 0 ? ((learnedHighFreq / highFreqPhrases.length) * 100).toFixed(1) : '0.0';

  // Math percentages
  const phrasePercentage = totalP > 0 ? Math.round((knownP / totalP) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="text-center py-2">
        <h2 className="text-2xl font-bold font-serif-eng text-[#3E2723] flex items-center justify-center gap-2">
          <Sparkles className="w-6 h-6 text-[#D4A574]" /> {translate('analytics.phrasesTitle')}
        </h2>
        <p className="text-[#795548] text-xs font-serif-eng italic mt-1">
          {translate('analytics.phrasesSubtitle')}
        </p>
      </div>

      {/* High Frequency Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <CardHeritageFrame isKnown={true} className="flex flex-col items-center justify-center text-center p-6">
          <h3 className="text-sm font-bold text-[#3E2723] font-serif-eng mb-4">{translate('analytics.highFreqProgress')}</h3>
          
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
                strokeDashoffset={376.8 - (376.8 * Number(highFreqPercentage)) / 100}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-[#8B3A3A] font-mono leading-none">{highFreqPercentage}%</span>
              <span className="text-[9px] text-[#795548] font-bold uppercase tracking-wider mt-1">{translate('analytics.top20Percent')}</span>
            </div>
          </div>

          <div className="mt-4 text-xs text-[#795548] space-y-1">
            <p className="font-bold text-[#3E2723]">{learnedHighFreq} of {highFreqPhrases.length} {translate('analytics.highFreqMastered')}</p>
            <p className="italic text-[10px]">{translate('analytics.highFreqDescription')}</p>
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
                <span className="flex items-center gap-1">💬 {translate('analytics.murakkabatIndex')}</span>
                <span className="font-mono">{knownP} / {totalP} {translate('analytics.mastered')} ({phrasePercentage}%)</span>
              </div>
              <div className="h-3 w-full bg-[#E8DCC8] rounded-full overflow-hidden">
                <div className="h-full bg-[#D4A574] rounded-full transition-all" style={{ width: `${phrasePercentage}%` }}></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-[#E8DCC8] p-3 rounded-lg text-center">
                <p className="text-[#8B3A3A] font-mono font-bold text-xl">{newP}</p>
                <p className="text-[10px] text-[#795548] uppercase tracking-wide">{translate('analytics.newRemaining')}</p>
              </div>
              <div className="bg-white border border-[#E8DCC8] p-3 rounded-lg text-center">
                <p className="text-amber-500 font-mono font-bold text-xl">{learningP}</p>
                <p className="text-[10px] text-[#795548] uppercase tracking-wide">{translate('analytics.activeStudy')}</p>
              </div>
              <div className="bg-white border border-[#E8DCC8] p-3 rounded-lg text-center">
                <p className="text-[#D4A574] font-mono font-bold text-xl">{knownP}</p>
                <p className="text-[10px] text-[#795548] uppercase tracking-wide">{translate('analytics.known')}</p>
              </div>
              <div className="bg-white border border-[#E8DCC8] p-3 rounded-lg text-center">
                <p className="text-blue-500 font-mono font-bold text-xl">{reviewP}</p>
                <p className="text-[10px] text-[#795548] uppercase tracking-wide">{translate('analytics.review')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <GoldDivider />

      {/* Frequency Distribution */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-[#3E2723] font-serif-eng uppercase tracking-wide border-b border-[#E8DCC8] pb-1">
          {translate('analytics.frequencyDistribution')}
        </h3>
        <p className="text-xs text-[#795548] italic">
          {translate('analytics.frequencySubtitle')}
        </p>

        <div className="bg-white border border-[#E8DCC8] rounded-lg p-4">
          <div className="space-y-3">
            {[
              { label: translate('analytics.veryHigh'), min: 100, color: '#8B3A3A' },
              { label: translate('analytics.high'), min: 50, color: '#D4A574' },
              { label: translate('analytics.medium'), min: 10, color: '#3E2723' },
              { label: translate('analytics.low'), min: 1, color: '#795548' }
            ].map((freq, idx) => {
              const matchingPhrases = phrases.filter(p => p.frequency >= freq.min);
              const totalForFreq = matchingPhrases.length;
              const knownForFreq = matchingPhrases.filter(p => p.learnedState === 'known' || p.learnedState === 'mastered').length;
              const ratio = totalForFreq > 0 ? (knownForFreq / totalForFreq) * 100 : 0;

              return (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[#3E2723] w-24 shrink-0">{freq.label}</span>
                  <div className="flex-grow bg-[#E8DCC8] h-2 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${ratio}%`, backgroundColor: freq.color }}></div>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#3E2723] shrink-0">
                    {knownForFreq} / {totalForFreq}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <GoldDivider />

      {/* Scope Analysis */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-[#3E2723] font-serif-eng uppercase tracking-wide border-b border-[#E8DCC8] pb-1">
          {translate('analytics.scopeTitle')}
        </h3>
        <p className="text-xs text-[#795548] italic">
          {translate('analytics.scopeSubtitle')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-[#E8DCC8] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-[#D4A574]" />
              <span className="text-xs font-bold text-[#3E2723]">{translate('analytics.hapaxLegomena')}</span>
            </div>
            <p className="text-2xl font-mono font-bold text-[#8B3A3A]">
              {phrases.filter(p => p.frequency === 1).length}
            </p>
            <p className="text-[10px] text-[#795548] mt-1">{translate('analytics.hapaxDescription')}</p>
          </div>

          <div className="bg-white border border-[#E8DCC8] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#D4A574]" />
              <span className="text-xs font-bold text-[#3E2723]">{translate('analytics.averageFrequency')}</span>
            </div>
            <p className="text-2xl font-mono font-bold text-[#8B3A3A]">
              {totalP > 0 ? (phrases.reduce((sum, p) => sum + p.frequency, 0) / totalP).toFixed(1) : '0.0'}
            </p>
            <p className="text-[10px] text-[#795548] mt-1">{translate('analytics.averageDescription')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
