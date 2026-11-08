/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Word, Murakkab, Ayah, LearnedState } from '../types';
import { WordsAnalytics } from './WordsAnalytics';
import { PhrasesAnalytics } from './PhrasesAnalytics';
import { AyahsAnalytics } from './AyahsAnalytics';
import { BookOpen, Sparkles, GraduationCap } from 'lucide-react';

interface ProgressStatsProps {
  words: Word[];
  phrases: Murakkab[];
  ayahs: Ayah[];
  translate: (key: string) => string;
}

export function ProgressStats({
  words,
  phrases,
  ayahs,
  translate
}: ProgressStatsProps) {
  const [activeTab, setActiveTab] = useState<'words' | 'phrases' | 'ayahs'>('words');

  return (
    <div className="space-y-6">
      <div className="text-center py-2">
        <h2 className="text-2xl font-bold font-serif-eng text-[#3E2723] flex items-center justify-center gap-2">
          <GraduationCap className="w-6 h-6 text-[#D4A574]" /> {translate('analytics.title')}
        </h2>
        <p className="text-[#795548] text-xs font-serif-eng italic mt-1">
          {translate('analytics.subtitle')}
        </p>
      </div>

      {/* Segment tabs */}
      <div className="flex border-b border-[#E8DCC8] bg-[#FAF6F1] p-1 rounded-lg">
        {[
          { id: 'words', name: translate('tab.words'), icon: BookOpen },
          { id: 'phrases', name: translate('tab.phrases'), icon: Sparkles },
          { id: 'ayahs', name: translate('tab.ayahs'), icon: GraduationCap }
        ].map(tb => {
          const Icon = tb.icon;
          return (
            <button
              key={tb.id}
              onClick={() => setActiveTab(tb.id as any)}
              className={`flex-grow py-2 px-3 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === tb.id
                  ? 'bg-[#8B3A3A] text-white shadow'
                  : 'text-[#3E2723] hover:bg-[#E8DCC8]/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tb.name}
            </button>
          );
        })}
      </div>

      {activeTab === 'words' && <WordsAnalytics words={words} translate={translate} />}
      {activeTab === 'phrases' && <PhrasesAnalytics phrases={phrases} translate={translate} />}
      {activeTab === 'ayahs' && <AyahsAnalytics ayahs={ayahs} translate={translate} />}
    </div>
  );
}
