/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Murakkab, LearnedState, LanguageCode } from '../types';
import { CardHeritageFrame } from './ThemeOrnaments';
import { SearchInput } from './SearchInput';
import { Sparkles, ArrowRight, NotebookPen, MapPin, Check, Plus, Layers, Info, ChevronRight, HelpCircle } from 'lucide-react';
import { normalizeArabicText, normalizeVocalizedArabic, getGrammarNoteText, getTranslationText } from '../lib/quranUtils';
import { analyzeMurakkabSyntax, removeDiacritics } from '../lib/arabicMorphology';
import { PhraseOccurrencesScreen } from './PhraseOccurrencesScreen';
import { AyahOccurrencesScreen } from './AyahOccurrencesScreen';

interface PhraseListProps {
  phrases: Murakkab[];
  onToggleState: (id: string, type: 'word' | 'phrase' | 'ayah', newState: LearnedState) => void;
  onSearchChange: (query: string) => void;
  searchQuery: string;
  lang: string;
  isRtl: boolean;
  translate: (key: string) => string;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export function PhraseList({
  phrases,
  onToggleState,
  onSearchChange,
  searchQuery,
  lang,
  isRtl,
  translate,
  hasMore,
  onLoadMore
}: PhraseListProps) {
  const [viewMode, setViewMode] = useState<'basic' | 'advanced'>('basic');
  const [selectedPhrase, setSelectedPhrase] = useState<string | null>(null);
  const [selectedPhraseData, setSelectedPhraseData] = useState<Murakkab | null>(null);
  
  // Occurrences screen modal states
  const [viewOccurrences, setViewOccurrences] = useState<boolean>(false);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll using Intersection Observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || !onLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    observer.observe(sentinel);

    return () => {
      if (sentinel) observer.unobserve(sentinel);
    };
  }, [hasMore, onLoadMore]);

  // Status markings
  const handleToggle = (id: string, currentState: LearnedState) => {
    const nextState: LearnedState = currentState === 'known' || currentState === 'mastered' ? 'new' : 'known';
    onToggleState(id, 'phrase', nextState);
  };

  const handlePhraseCardClick = (phrase: Murakkab) => {
    setSelectedPhraseData(phrase);
    setSelectedPhrase(phrase.id);
  };

  const handleOpenOccurrences = (phrase: Murakkab, variantForm?: string) => {
    setSelectedPhraseData(phrase);
    setSelectedPhrase(phrase.id);
    setSelectedVariant(variantForm || null);
    setSelectedSurah(null);
    setViewOccurrences(true);
  };

  // Adaptive Arabic font sizing for multi-word Quranic phrases
  const getAdaptivePhraseSizeClass = (arabicText: string) => {
    const baseLength = removeDiacritics(arabicText || '').replace(/\s+/g, '').length;
    if (baseLength <= 10) return 'text-2xl sm:text-3xl';
    if (baseLength <= 18) return 'text-xl sm:text-2xl';
    return 'text-lg sm:text-xl';
  };

  return (
    <div className="space-y-4">
      {/* Top Chrome Header for phrases */}
      <div className="flex justify-between items-center bg-[#FAF6F1] border border-[#E8DCC8] rounded-lg p-3">
        <div className="flex items-center space-x-2 space-x-reverse">
          <Sparkles className="w-5 h-5 text-[#8B3A3A]" />
          <span className="text-lg font-bold font-serif-eng text-[#3E2723]">
            {translate('tab.phrases')} <span className="text-xs font-mono font-normal">({phrases.length} loaded)</span>
          </span>
        </div>

        <div className="bg-[#E8DCC8]/40 p-1 rounded-md flex items-center text-[10px] font-bold">
          <button
            onClick={() => setViewMode('basic')}
            className={`px-3 py-1 rounded transition-all ${
              viewMode === 'basic' 
                ? 'bg-[#8B3A3A] text-white shadow-sm' 
                : 'text-[#3E2723] hover:bg-[#E8DCC8]'
            }`}
          >
            {translate('ling.basic')}
          </button>
          <button
            onClick={() => setViewMode('advanced')}
            className={`px-3 py-1 rounded transition-all ${
              viewMode === 'advanced' 
                ? 'bg-[#8B3A3A] text-white shadow-sm' 
                : 'text-[#3E2723] hover:bg-[#E8DCC8]'
            }`}
          >
            {translate('ling.advanced')}
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="bg-white border border-[#E8DCC8] rounded-lg p-3">
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder={translate('search.placeholder')}
          isRtl={isRtl}
          translate={translate}
        />
      </div>

      {/* Active Search Indicator */}
      {searchQuery && (
        <div className="flex items-center gap-1.5 p-1 bg-amber-50/40 rounded-md border border-[#E8DCC8]/45">
          <span className="text-[10px] text-[#795548] uppercase font-bold px-1 select-none">{translate('search.active')}:</span>
          <span className="text-[10px] font-bold bg-[#E8DCC8] text-[#3E2723] px-2 py-0.5 rounded-full">
            "{searchQuery}"
          </span>
        </div>
      )}

      <div className="space-y-4">
        {phrases.length > 0 ? (
          phrases.map((phrase) => {
            const isKnown = phrase.learnedState === 'known' || phrase.learnedState === 'mastered';
            const isSelected = selectedPhrase === phrase.id || viewMode === 'advanced';
            const variants = phrase.variants || [];
            const firstOcc = phrase.occurrences?.[0] as any;
            const syntaxAnalysis = analyzeMurakkabSyntax(
              normalizeVocalizedArabic(phrase.arabic),
              getGrammarNoteText(phrase.grammarNotes, lang),
              Array.isArray(firstOcc?.roots) ? firstOcc.roots : undefined,
              Array.isArray(firstOcc?.lemmas) ? firstOcc.lemmas : undefined
            );

            const displayArabic = normalizeVocalizedArabic(phrase.arabic);
            const primaryTranslation = getTranslationText(phrase.translations, lang);
            const constituentRoots = Array.isArray(firstOcc?.roots)
              ? firstOcc.roots.filter((r: string) => r && r !== 'N/A')
              : syntaxAnalysis.wordRoles.map((w) => w.root).filter((r) => r && r !== 'N/A');

            return (
              <div key={phrase.id}>
                <CardHeritageFrame 
                  isKnown={isKnown}
                  className="hover:scale-[1.003] transition-all cursor-pointer"
                  onClick={() => handlePhraseCardClick(phrase)}
                >
                  <div className="space-y-3.5">
                    {/* 1. Dedicated Top Calligraphic Plaque */}
                    <div className="bg-white border border-[#E8DCC8] rounded-xl p-3.5 sm:p-4 shadow-xs relative overflow-hidden">
                      {/* Plaque Header Bar: Syntactic Category Badge + Arabic Tarakeeb Label + Mastery Button */}
                      <div className={`flex items-center justify-between gap-2 mb-1.5 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`flex items-center flex-wrap gap-1.5 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span className="text-[10px] font-bold bg-[#8B3A3A]/10 text-[#8B3A3A] border border-[#8B3A3A]/25 px-2.5 py-0.5 rounded-full font-serif-eng">
                            {syntaxAnalysis.categoryBadge}
                          </span>
                          <span
                            dir="rtl"
                            className="text-[11px] font-arabic font-bold bg-[#FAF6F1] text-[#3E2723] px-2.5 py-0.5 rounded-full border border-[#E8DCC8] whitespace-nowrap"
                          >
                            {syntaxAnalysis.tarakeebArabic}
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggle(phrase.id, phrase.learnedState);
                          }}
                          className={`h-9 px-3 rounded-full border flex items-center gap-1.5 transition-all duration-200 shadow-2xs shrink-0 ${
                            isKnown 
                              ? 'bg-[#8B3A3A] text-white border-[#8B3A3A] hover:bg-[#8B3A3A]/85' 
                              : 'bg-[#FAF6F1] border-[#E8DCC8] text-[#795548] hover:border-[#8B3A3A] hover:text-[#8B3A3A]'
                          }`}
                          title="Mark Phrase Known"
                        >
                          <span className="text-xs leading-none">{isKnown ? '✓' : '+'}</span>
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider leading-none">
                            {isKnown ? 'Learned' : 'Study'}
                          </span>
                        </button>
                      </div>

                      {/* Centered Calligraphic Phrase Showcase */}
                      <div className="py-2 sm:py-3 text-center" dir="rtl">
                        <span
                          className={`${getAdaptivePhraseSizeClass(displayArabic)} font-bold text-[#3E2723] font-arabic leading-relaxed inline-block max-w-full break-words px-2`}
                        >
                          {displayArabic}
                        </span>
                      </div>
                    </div>

                    {/* 2. Full-Width Transliteration & Meaning Block */}
                    <div className={`px-0.5 ${isRtl ? 'text-right' : 'text-left'}`}>
                      <div className={`flex flex-wrap items-baseline gap-x-2.5 gap-y-1 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                        <h3 className="text-base sm:text-lg font-bold text-[#3E2723] font-serif-eng">
                          {phrase.transliteration}
                        </h3>
                        <span className="text-[#D4A574] font-bold select-none">•</span>
                        <p className="font-serif-eng text-[#5D4037] text-sm sm:text-base italic leading-snug break-words">
                          {primaryTranslation}
                        </p>
                      </div>
                    </div>

                    {/* 3. Structured Two-Row Metadata Grid (2x2 on Mobile, 4-col on Desktop) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {/* Cell 1: Syntactic Construction */}
                      <div className="bg-white/90 border border-[#E8DCC8] rounded-lg px-3 py-2 flex flex-col justify-between min-w-0">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-[#795548] font-bold">
                          Construction
                        </span>
                        <span className="text-xs font-bold text-[#3E2723] font-serif-eng mt-0.5 truncate" title={syntaxAnalysis.tarakeebEnglish}>
                          {syntaxAnalysis.tarakeebEnglish}
                        </span>
                      </div>

                      {/* Cell 2: Occurrences */}
                      <div className="bg-amber-50/50 border border-amber-200/70 rounded-lg px-3 py-2 flex flex-col justify-between min-w-0">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-[#795548] font-bold">
                          Occurrences
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <strong className="font-mono text-sm sm:text-base text-[#8B3A3A] font-extrabold">
                            {phrase.frequency}
                          </strong>
                          <span className="text-[10px] text-[#795548] font-serif-eng">verses</span>
                        </div>
                      </div>

                      {/* Cell 3: Variants */}
                      <div className="bg-white/90 border border-[#E8DCC8] rounded-lg px-3 py-2 flex flex-col justify-between min-w-0">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-[#795548] font-bold">
                          Surface Forms
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-[#3E2723] font-mono mt-0.5">
                          {variants.length > 0 ? `${variants.length} variant${variants.length > 1 ? 's' : ''}` : '1 form'}
                        </span>
                      </div>

                      {/* Cell 4: Constituent Words / Roots */}
                      <div className="bg-white/90 border border-[#E8DCC8] rounded-lg px-3 py-2 flex flex-col justify-between min-w-0">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-[#795548] font-bold">
                          Composition
                        </span>
                        {constituentRoots.length > 0 ? (
                          <span
                            dir="rtl"
                            className="text-xs sm:text-sm font-arabic font-bold text-[#8B3A3A] whitespace-nowrap overflow-hidden text-ellipsis mt-0.5 text-left"
                          >
                            {constituentRoots.slice(0, 2).join(' • ')}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-[#3E2723] font-mono mt-0.5">
                            {phrase.n || syntaxAnalysis.wordRoles.length || 2} words
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 4. Bottom Themes & Action Buttons */}
                    <div className={`flex flex-wrap items-center justify-between gap-2 pt-1 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {phrase.themes && phrase.themes.map((theme) => (
                          <span
                            key={theme}
                            className="text-[10px] font-medium bg-[#E8DCC8]/45 text-[#5D4037] px-2.5 py-0.5 rounded-full border border-[#E8DCC8]"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>

                      <div className={`flex items-center gap-2 w-full sm:w-auto justify-end ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenOccurrences(phrase);
                          }}
                          className="flex-1 sm:flex-initial justify-center text-xs text-[#8B3A3A] hover:bg-[#8B3A3A] hover:text-white py-1.5 px-3 rounded-lg border border-[#E8DCC8] bg-amber-50/60 font-bold transition-all flex items-center gap-1.5"
                          title="View all verse locations of this phrase"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Occurrences ({phrase.frequency})</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPhrase(selectedPhrase === phrase.id ? null : phrase.id);
                          }}
                          className="flex-1 sm:flex-initial justify-center text-xs text-[#795548] hover:text-[#8B3A3A] py-1.5 px-3 rounded-lg border border-[#E8DCC8] bg-white font-bold transition-all flex items-center gap-1.5"
                        >
                          <NotebookPen className="w-3.5 h-3.5" />
                          <span>{isSelected ? 'Hide Syntax' : 'Syntax Notes'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                {/* Composition I'rab Analysis / Tarakeeb Information */}
                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-[#E8DCC8] space-y-3 text-xs transition-opacity">
                    <div className="bg-[#FAF6F1] p-3.5 rounded-xl border border-[#E8DCC8]/70 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8DCC8]/60 pb-2">
                        <h4 className="font-bold text-[#8B3A3A] uppercase tracking-wide flex items-center gap-1.5">
                          <span>❖</span>
                          <span>{translate('ling.tarakeeb')} — {syntaxAnalysis.tarakeebEnglish}</span>
                        </h4>
                        <span className="font-arabic font-bold text-sm text-[#3E2723] bg-white px-2.5 py-0.5 rounded border border-[#E8DCC8]" dir="rtl">
                          {syntaxAnalysis.tarakeebArabic}
                        </span>
                      </div>

                      <p className="text-slate-700 leading-relaxed font-serif-eng text-xs sm:text-sm italic p-2.5 bg-white/80 rounded-lg border border-[#E8DCC8]/40">
                        {syntaxAnalysis.scholarlyExplanation}
                      </p>

                      {/* Constituent Word-by-Word Syntactic Role & I'rab Breakdown */}
                      {syntaxAnalysis.wordRoles.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <div className="text-[10px] font-mono font-bold uppercase text-[#795548]">
                            Constituent Syntactic Breakdown (التحليل النحوي والصرفي للمفردات):
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {syntaxAnalysis.wordRoles.map((wr, wrIdx) => (
                              <div
                                key={wrIdx}
                                className="bg-white p-2.5 rounded-lg border border-[#E8DCC8]/70 flex items-start justify-between gap-3"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-mono font-bold bg-[#8B3A3A]/10 text-[#8B3A3A] px-1.5 py-0.5 rounded">
                                      #{wrIdx + 1}
                                    </span>
                                    <span className="text-xs font-bold text-[#3E2723] font-serif-eng">
                                      {wr.roleEnglish}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-[#795548] font-serif-eng">
                                    {wr.irabNote}
                                  </div>
                                  {wr.root && wr.root !== 'N/A' && (
                                    <div className="text-[10px] text-[#8B3A3A] font-mono pt-0.5">
                                      Root: <span className="font-arabic font-bold">{wr.root}</span> • {wr.baab} • <span className="font-arabic font-bold">{wr.wazan}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="text-right shrink-0" dir="rtl">
                                  <span className="font-arabic font-bold text-lg text-[#3E2723] block leading-tight">
                                    {wr.word}
                                  </span>
                                  <span className="font-arabic text-[11px] font-bold text-[#8B3A3A] block">
                                    {wr.roleArabic}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Variants Breakdown Panel */}
                    {variants.length > 0 && (
                      <div className="bg-[#FAF6F1] p-3.5 rounded-xl border border-[#E8DCC8]/70 space-y-2">
                        <h4 className="font-bold text-[#8B3A3A] uppercase tracking-wide flex items-center gap-1 font-mono text-[11px]">
                          <Layers className="w-3.5 h-3.5 text-[#D4A574]" /> Phrase Forms & Grammatical Variants ({variants.length})
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {variants.map((v, vIdx) => (
                            <div 
                              key={vIdx}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenOccurrences(phrase, v.arabic);
                              }}
                              className="bg-white p-2.5 rounded-lg border border-[#E8DCC8]/60 hover:border-[#8B3A3A] hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-2"
                            >
                              <div className="space-y-0.5">
                                <span className="font-arabic font-bold text-base text-[#3E2723] block leading-tight" dir="rtl">
                                  {normalizeVocalizedArabic(v.arabic)}
                                </span>
                                {v.transliteration && (
                                  <span className="text-[10px] text-[#795548] font-mono block italic">
                                    {v.transliteration}
                                  </span>
                                )}
                              </div>
                              <span className="bg-amber-50 text-[#8B3A3A] text-[10px] font-mono font-bold px-2 py-1 rounded border border-amber-200/60 flex items-center gap-1">
                                <span>{v.frequency}</span>
                                <ChevronRight className="w-3 h-3" />
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Occurrence Quick Context list */}
                    {phrase.occurrences.length > 0 && (
                      <div className="bg-[#FAF6F1] p-3.5 rounded-xl border border-[#E8DCC8]/70 space-y-2">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-[#8B3A3A] uppercase tracking-wide flex items-center gap-1 font-serif-eng">
                            <MapPin className="w-3.5 h-3.5 text-[#D4A574]" /> Active Occurrence Contexts
                          </h4>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenOccurrences(phrase);
                            }}
                            className="text-[11px] font-bold text-[#8B3A3A] hover:underline flex items-center gap-1"
                          >
                            <span>View All ({phrase.occurrences.length})</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {phrase.occurrences.slice(0, 3).map((occ, idx) => (
                            <div 
                              key={idx} 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenOccurrences(phrase);
                              }}
                              className="bg-white/80 p-2.5 rounded-lg border border-[#E8DCC8]/40 hover:border-[#8B3A3A] transition-all cursor-pointer"
                            >
                              <div className="flex justify-between items-center text-[10px] text-[#795548] font-bold font-mono mb-1">
                                <span>Surah {occ.surahName} ({occ.surah}) • Verse {occ.ayah}</span>
                              </div>
                              <p className="text-right text-base font-arabic text-[#3E2723] font-bold" dir="rtl">
                                {occ.context ? normalizeArabicText(occ.context) : normalizeVocalizedArabic(occ.surface || '')}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardHeritageFrame>
              </div>
            );
          })
        ) : (
          <div className="bg-[#FAF6F1] border border-[#E8DCC8] rounded-lg p-10 text-center text-[#795548]">
            <HelpCircle className="w-12 h-12 text-[#D4A574] mx-auto mb-3" />
            <p className="font-serif-eng text-base font-bold text-[#3E2723]">No phrases found matching search query</p>
            <p className="text-xs text-[#795548] mt-1">Try relaxing your search query or entering an Arabic word / transliteration.</p>
          </div>
        )}

        {/* Infinite Scroll Sentinel */}
        {hasMore && onLoadMore && (
          <div ref={sentinelRef} className="h-4" />
        )}
      </div>

      {/* Phrase Occurrence Overlay Screens */}
      {viewOccurrences && selectedPhraseData && selectedSurah === null && (
        <div className="fixed inset-0 z-50 bg-[#FAF6F1] overflow-y-auto h-full">
          <PhraseOccurrencesScreen
            phrase={selectedPhraseData}
            lang={lang}
            initialVariant={selectedVariant}
            onBack={() => {
              setViewOccurrences(false);
              setSelectedVariant(null);
            }}
            onSurahClick={(surah, variantForm) => {
              setSelectedSurah(surah);
              setSelectedVariant(variantForm || null);
            }}
          />
        </div>
      )}

      {viewOccurrences && selectedPhraseData && selectedSurah !== null && (
        <div className="fixed inset-0 z-50 bg-[#FAF6F1] overflow-y-auto h-full">
          <AyahOccurrencesScreen
            phrase={selectedPhraseData}
            surah={selectedSurah}
            variantForm={selectedVariant || undefined}
            lang={lang}
            onBack={() => setSelectedSurah(null)}
          />
        </div>
      )}
    </div>
  );
}
