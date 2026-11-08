/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Word, LearnedState, FilterState, LanguageCode } from '../types';
import { CardHeritageFrame, IslamicStar } from './ThemeOrnaments';
import { SearchInput } from './SearchInput';
import { WordOccurrencesScreen } from './WordOccurrencesScreen';
import { AyahOccurrencesScreen } from './AyahOccurrencesScreen';
import { SlidersHorizontal, BookOpen, Star, HelpCircle, Check, MapPin, Eye, EyeOff, Layers, Info, GitBranch } from 'lucide-react';
import { normalizeArabicText, normalizeVocalizedArabic, getTranslationText, getWordMorphologySummary, getRootFamilyWords } from '../lib/quranUtils';
import { removeDiacritics } from '../lib/arabicMorphology';

interface WordListProps {
  words: Word[];
  allWords?: Word[];
  filterState: FilterState;
  onToggleState: (id: string, type: 'word' | 'phrase' | 'ayah', newState: LearnedState) => void;
  onOpenFilters: () => void;
  onSearchChange: (query: string) => void;
  lang: string;
  isRtl: boolean;
  translate: (key: string) => string;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export function WordList({
  words,
  allWords,
  filterState,
  onToggleState,
  onOpenFilters,
  onSearchChange,
  lang,
  isRtl,
  translate,
  hasMore,
  onLoadMore
}: WordListProps) {
  const [viewMode, setViewMode] = useState<'basic' | 'advanced'>('basic');
  const [selectedWordDetails, setSelectedWordDetails] = useState<string | null>(null);
  const [selectedWordData, setSelectedWordData] = useState<Word | null>(null);
  const [viewOccurrences, setViewOccurrences] = useState(false);
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
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

  // Status visual configurations
  const statusConfig: Record<LearnedState, { color: string; bg: string; icon: string; textKey: string }> = {
    new: { color: 'border-gray-300 text-gray-400', bg: 'bg-white', icon: '⭕', textKey: 'state.new' },
    learning: { color: 'border-amber-400 text-amber-500', bg: 'bg-amber-50', icon: '⏳', textKey: 'state.learning' },
    known: { color: 'border-[#D4A574] text-[#D4A574]', bg: 'bg-[#D4A574]/10', icon: '✓', textKey: 'state.known' },
    mastered: { color: 'border-[#8B3A3A] text-[#8B3A3A]', bg: 'bg-[#8B3A3A]/10', icon: '★', textKey: 'state.mastered' },
    review: { color: 'border-indigo-400 text-indigo-500', bg: 'bg-indigo-50', icon: '↻', textKey: 'state.review' }
  };

  // Immediate cycle transition trigger for the main learn toggle button
  const cycleLearnedState = (id: string, currentState: LearnedState) => {
    let nextState: LearnedState = 'new';
    if (currentState === 'new') nextState = 'learning';
    else if (currentState === 'learning') nextState = 'known';
    else if (currentState === 'known') nextState = 'mastered';
    else if (currentState === 'mastered') nextState = 'review';
    else if (currentState === 'review') nextState = 'new';
    onToggleState(id, 'word', nextState);
  };

  const handleWordCardClick = (word: Word) => {
    setSelectedWordData(word);
    setSelectedWordDetails(word.id);
  };

  // Adaptive Arabic font sizing based on base letter count (excluding diacritics)
  const getAdaptiveArabicSizeClass = (arabicText: string) => {
    const baseLength = removeDiacritics(arabicText || '').replace(/\s+/g, '').length;
    if (baseLength <= 4) return 'text-3xl sm:text-4xl';
    if (baseLength <= 7) return 'text-2xl sm:text-3xl';
    return 'text-xl sm:text-2xl';
  };

  return (
    <div className="space-y-4">
      {/* Top Chrome Header containing Minimal Title & Search Icons */}
      <div className="flex justify-between items-center bg-[#FAF6F1] border border-[#E8DCC8] rounded-lg p-3">
        <div className="flex items-center space-x-2 space-x-reverse">
          <BookOpen className="w-5 h-5 text-[#8B3A3A]" />
          <span className="text-lg font-bold font-serif-eng text-[#3E2723]">
            {translate('tab.words')} <span className="text-xs font-mono font-normal">({words.length} items)</span>
          </span>
        </div>

        {/* Basic/Advanced Toggler & Filters Icon Buttons */}
        <div className="flex items-center gap-2">
          {/* Dual Toggle for Study/Research */}
          <div className="bg-[#E8DCC8]/40 p-1 rounded-md flex items-center text-[10px] font-bold">
            <button
              onClick={() => setViewMode('basic')}
              className={`px-2.5 py-1 rounded transition-all select-none ${
                viewMode === 'basic' 
                  ? 'bg-[#8B3A3A] text-white shadow-sm' 
                  : 'text-[#3E2723] hover:bg-[#E8DCC8]'
              }`}
            >
              {translate('ling.basic')}
            </button>
            <button
              onClick={() => setViewMode('advanced')}
              className={`px-2.5 py-1 rounded transition-all select-none ${
                viewMode === 'advanced' 
                  ? 'bg-[#8B3A3A] text-white shadow-sm' 
                  : 'text-[#3E2723] hover:bg-[#E8DCC8]'
              }`}
            >
              {translate('ling.advanced')}
            </button>
          </div>

          <button
            onClick={onOpenFilters}
            className="p-2 border border-[#E8DCC8] hover:border-[#D4A574] rounded-md text-[#3E2723] hover:bg-white transition-all duration-200 relative"
            title={translate('filter.title')}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {(filterState.selectedSurahs.length > 0 || 
              filterState.selectedThemes.length > 0 || 
              filterState.selectedPOS.length > 0 || 
              filterState.selectedProgress.length > 0 ||
              (filterState.selectedBaab && filterState.selectedBaab.length > 0) ||
              Boolean(filterState.rootQuery) ||
              filterState.selectedCore !== 'all') && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#8B3A3A] rounded-full animate-ping"></span>
            )}
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="bg-white border border-[#E8DCC8] rounded-lg p-3">
        <SearchInput
          value={filterState.searchQuery}
          onChange={onSearchChange}
          placeholder={translate('search.placeholder')}
          isRtl={isRtl}
          translate={translate}
        />
      </div>

      {/* Active Filter Chips Scrollable bar */}
      {(filterState.selectedSurahs.length > 0 || 
        filterState.selectedThemes.length > 0 || 
        filterState.selectedPOS.length > 0 || 
        filterState.selectedProgress.length > 0 ||
        (filterState.selectedBaab && filterState.selectedBaab.length > 0) ||
        Boolean(filterState.rootQuery) ||
        filterState.searchQuery ||
        filterState.selectedCore !== 'all') && (
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-amber-50/40 rounded-md border border-[#E8DCC8]/45">
          <span className="text-[10px] text-[#795548] uppercase font-bold px-1 select-none">Filters:</span>
          {filterState.searchQuery && (
            <span className="text-[10px] font-bold bg-[#E8DCC8] text-[#3E2723] px-2 py-0.5 rounded-full">
              Query: "{filterState.searchQuery}"
            </span>
          )}
          {filterState.rootQuery && (
            <span className="text-[10px] font-bold bg-[#8B3A3A] text-white px-2 py-0.5 rounded-full font-arabic">
              Root: {filterState.rootQuery}
            </span>
          )}
          {filterState.selectedBaab && filterState.selectedBaab.map(b => (
            <span key={b} className="text-[10px] font-bold bg-[#8B3A3A] text-white px-2 py-0.5 rounded-full">
              Form {b}
            </span>
          ))}
          {filterState.selectedCore !== 'all' && (
            <span className="text-[10px] font-bold bg-[#E8DCC8] text-[#3E2723] px-2 py-0.5 rounded-full">
              Scope: {filterState.selectedCore === 'core' ? 'Core 800' : 'Non-Core'}
            </span>
          )}
          {filterState.selectedSurahs.map(num => (
            <span key={num} className="text-[10px] font-bold bg-[#8B3A3A] text-white px-2 py-0.5 rounded-full">
              Surah {num}
            </span>
          ))}
          {filterState.selectedThemes.map(theme => (
            <span key={theme} className="text-[10px] font-bold bg-amber-100 text-[#3E2723] px-2 py-0.5 rounded-full">
              {theme}
            </span>
          ))}
          {filterState.selectedPOS.map(pos => (
            <span key={pos} className="text-[10px] font-bold bg-[#D4A574] text-white px-2 py-0.5 rounded-full">
              Part: {pos}
            </span>
          ))}
          {filterState.selectedProgress.map(state => (
            <span key={state} className="text-[10px] font-bold bg-gray-200 text-[#3E2723] px-2 py-0.5 rounded-full">
              {translate(`state.${state}`)}
            </span>
          ))}
        </div>
      )}

      {/* Word Cards Virtualized-Like List */}
      <div className="space-y-4">
        {words.length > 0 ? (
          words.map((word) => {
            const isWordKnown = word.learnedState === 'known' || word.learnedState === 'mastered';
            const showDetails = selectedWordDetails === word.id || viewMode === 'advanced';
            const displayArabic = normalizeVocalizedArabic(word.arabic);
            const morphSummary = getWordMorphologySummary(word.arabic, word);
            const rootText = word.formattedRoot || word.root || morphSummary.root || '—';
            const primaryTranslation = getTranslationText(word.translations, lang);
            const variantCount = word.variants ? word.variants.length : 1;

            return (
              <div key={word.id}>
                <CardHeritageFrame 
                  isKnown={isWordKnown}
                  className="transition-colors hover:bg-neutral-50/40 cursor-pointer"
                  onClick={() => handleWordCardClick(word)}
                >
                  <div className="space-y-3.5">
                    {/* 1. Dedicated Top Calligraphic Plaque */}
                    <div className="bg-white border border-[#E8DCC8] rounded-xl p-3.5 sm:p-4 shadow-xs relative overflow-hidden">
                      {/* Plaque Header Bar: Core + Mastery Status on Left, Interactive Cycle Button on Right */}
                      <div className={`flex items-center justify-between gap-2 mb-1.5 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`flex items-center flex-wrap gap-1.5 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                          {word.isCore && (
                            <span className="text-[10px] font-mono font-bold bg-[#8B3A3A] text-white px-2.5 py-0.5 rounded-full shadow-2xs tracking-wide">
                              ★ CORE
                            </span>
                          )}
                          <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase ${statusConfig[word.learnedState].bg} border ${statusConfig[word.learnedState].color}`}>
                            {statusConfig[word.learnedState].icon} {translate(statusConfig[word.learnedState].textKey)}
                          </span>
                          {morphSummary.wazan && morphSummary.wazan !== 'N/A' && (
                            <span
                              dir="rtl"
                              className="text-[11px] font-arabic font-bold bg-[#FAF6F1] text-[#8B3A3A] px-2.5 py-0.5 rounded-full border border-[#E8DCC8] whitespace-nowrap"
                              title={`Morphological Pattern (Wazan): ${morphSummary.wazan}`}
                            >
                              {morphSummary.wazan}
                            </span>
                          )}
                        </div>

                        {/* Interactive Mastery State Cycle Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cycleLearnedState(word.id, word.learnedState);
                          }}
                          className={`h-9 px-3 rounded-full border flex items-center gap-1.5 transition-all duration-200 shadow-2xs hover:scale-105 active:scale-95 shrink-0 ${
                            isWordKnown 
                              ? 'bg-[#D4A574] text-white border-[#D4A574] hover:bg-[#BFA36E]' 
                              : 'bg-[#FAF6F1] border-[#E8DCC8] text-[#795548] hover:border-[#8B3A3A] hover:text-[#8B3A3A]'
                          }`}
                          title={translate('btn.toggleMark')}
                        >
                          <span className="text-xs leading-none">
                            {word.learnedState === 'mastered' ? '★' : isWordKnown ? '✓' : '⭕'}
                          </span>
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider leading-none">
                            {word.learnedState}
                          </span>
                        </button>
                      </div>

                      {/* Centered Calligraphic Showcase with Adaptive Sizing */}
                      <div className="py-2 sm:py-3 text-center" dir="rtl">
                        <span
                          className={`${getAdaptiveArabicSizeClass(displayArabic)} font-bold font-arabic text-[#3E2723] leading-relaxed inline-block max-w-full break-words px-2`}
                        >
                          {displayArabic}
                        </span>
                      </div>
                    </div>

                    {/* 2. Full-Width Transliteration & Meaning Block */}
                    <div className={`px-0.5 ${isRtl ? 'text-right' : 'text-left'}`}>
                      <div className={`flex flex-wrap items-baseline gap-x-2.5 gap-y-1 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                        <h3 className="text-lg sm:text-xl font-bold text-[#3E2723] font-serif-eng tracking-tight">
                          {word.transliteration}
                        </h3>
                        <span className="text-[#D4A574] font-bold select-none">•</span>
                        <p className="text-base sm:text-lg text-[#5D4037] font-serif-eng italic leading-snug break-words">
                          {primaryTranslation}
                        </p>
                      </div>
                    </div>

                    {/* 3. Structured Two-Row Metadata Grid (2x2 on Mobile, 4-col on Desktop) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {/* Cell 1: Root */}
                      <div className="bg-white/90 border border-[#E8DCC8] rounded-lg px-3 py-2 flex flex-col justify-between min-w-0">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-[#795548] font-bold">
                          {translate('ling.root')}
                        </span>
                        <span
                          dir="rtl"
                          className="text-sm sm:text-base font-arabic font-bold text-[#8B3A3A] whitespace-nowrap overflow-hidden text-ellipsis mt-0.5 text-left"
                        >
                          {rootText}
                        </span>
                      </div>

                      {/* Cell 2: Frequency */}
                      <div className="bg-amber-50/50 border border-amber-200/70 rounded-lg px-3 py-2 flex flex-col justify-between min-w-0">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-[#795548] font-bold">
                          {translate('ling.frequency')}
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <strong className="font-mono text-sm sm:text-base text-[#8B3A3A] font-extrabold">
                            {word.frequency}
                          </strong>
                          <span className="text-[10px] text-[#795548] font-serif-eng">times</span>
                        </div>
                      </div>

                      {/* Cell 3: Part of Speech (Never Clipped) */}
                      <div className="bg-white/90 border border-[#E8DCC8] rounded-lg px-3 py-2 flex flex-col justify-between min-w-0">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-[#795548] font-bold">
                          Part of Speech
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-[#3E2723] font-serif-eng mt-0.5 break-words">
                          {word.pos || 'Word'}
                        </span>
                      </div>

                      {/* Cell 4: Variants & Baab */}
                      <div className="bg-white/90 border border-[#E8DCC8] rounded-lg px-3 py-2 flex flex-col justify-between min-w-0">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-[#795548] font-bold">
                          Forms / Baab
                        </span>
                        <span className="text-xs font-bold text-[#3E2723] font-mono mt-0.5 truncate" title={`${variantCount} forms • ${morphSummary.baab}`}>
                          {variantCount > 1 ? `${variantCount} variants` : '1 form'}
                          {morphSummary.baab && morphSummary.baab !== 'N/A' ? ` • ${morphSummary.baab.replace('Form ', '')}` : ''}
                        </span>
                      </div>
                    </div>

                    {/* 4. Bottom Theme & Action Bar */}
                    <div className={`flex flex-wrap items-center justify-between gap-2 pt-1 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {word.themes && word.themes.slice(0, 3).map((theme) => (
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
                            setSelectedWordData(word);
                            setSelectedVariant(null);
                            setSelectedSurah(null);
                            setViewOccurrences(true);
                          }}
                          className="flex-1 sm:flex-initial justify-center text-xs text-[#8B3A3A] hover:bg-[#8B3A3A] hover:text-white py-1.5 px-3 rounded-lg border border-[#E8DCC8] bg-amber-50/60 flex items-center gap-1.5 font-bold transition-all"
                          title="View all Quranic occurrences"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Occurrences ({word.occurrences?.length || word.frequency})</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedWordDetails(selectedWordDetails === word.id ? null : word.id);
                            if (selectedWordDetails !== word.id) {
                              setSelectedWordData(word);
                            } else {
                              setSelectedWordData(null);
                            }
                          }}
                          className="flex-1 sm:flex-initial justify-center text-xs text-[#795548] hover:text-[#8B3A3A] py-1.5 px-3 rounded-lg border border-[#E8DCC8] bg-white hover:bg-amber-50/30 flex items-center gap-1.5 font-bold transition-all"
                          title="Linguistic analysis & root derivatives"
                        >
                          {showDetails ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{showDetails ? 'Hide' : 'Analyze'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                {/* Advanced Linguistic Grid & Occurrences reference panel */}
                {showDetails && (
                  <div className="mt-4 pt-4 border-t border-[#E8DCC8] grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {/* Linguistic / Root info */}
                    <div className="space-y-2 bg-[#FAF6F1] p-3 rounded-lg border border-[#E8DCC8]/60">
                      <h4 className="font-bold text-[#8B3A3A] uppercase tracking-wide flex items-center gap-1">
                        <span className="text-[#D4A574]">❖</span> {translate('ling.root')}
                      </h4>
                      <p
                        dir="rtl"
                        className="text-base font-bold text-[#8B3A3A] font-arabic bg-white px-3 py-1 rounded border border-[#E8DCC8] inline-block whitespace-nowrap"
                      >
                        {rootText}
                      </p>
                      <h4 className="font-bold text-[#8B3A3A] uppercase tracking-wide pt-1">
                        {translate('ling.details')}
                      </h4>
                      <div className="space-y-1 text-neutral-600 font-mono">
                        <div>Baab: {morphSummary.baab}</div>
                        <div>Wazan: <span className="font-arabic font-bold text-[#8B3A3A] whitespace-nowrap" dir="rtl">{morphSummary.wazan}</span></div>
                        <div>Gender: {word.grammarDetails?.gender || 'N/A'}</div>
                        <div>Number: {word.grammarDetails?.number || 'N/A'}</div>
                      </div>
                    </div>

                    {/* Occurrence references */}
                    <div className="space-y-2 bg-[#FAF6F1] p-3 rounded-lg border border-[#E8DCC8]/60 md:col-span-2">
                      <h4 className="font-bold text-[#8B3A3A] uppercase tracking-wide flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#D4A574]" /> {translate('ling.occurrences')} ({word.occurrences.length})
                      </h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {word.occurrences.map((occ, i) => (
                          <div key={i} className="bg-white/80 p-2.5 rounded-lg border border-[#E8DCC8]/50 space-y-1">
                            <div className="flex justify-between items-center font-bold text-[#3E2723] text-[10px] border-b border-[#E8DCC8]/30 pb-1 md:text-xs">
                              <span>{translate('word.surah')} {occ.surah} ({occ.surahName}) • {translate('word.verse')} {occ.ayah}</span>
                            </div>
                            <p className="text-right text-base font-arabic text-[#3E2723] py-1 select-all leading-relaxed" dir="rtl">
                              {normalizeArabicText(occ.context)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                </CardHeritageFrame>

                {/* Word Translation Panel */}
                {selectedWordData && selectedWordDetails === word.id && (
                <div className="bg-gradient-to-br from-[#FAF6F1] to-white border-2 border-[#D4A574] rounded-xl p-4 sm:p-5 space-y-4 mt-3 transition-all animate-fadeIn shadow-lg">
                  {/* Header */}
                  <div className="flex justify-between items-center border-b border-[#E8DCC8] pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8B3A3A] to-[#D4A574] flex items-center justify-center shrink-0">
                        <BookOpen className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#8B3A3A] tracking-wider font-mono uppercase">
                          Scholarly Morphological Profile
                        </div>
                        <div className="text-[11px] text-[#795548] font-medium flex items-center gap-1 mt-0.5">
                          Occurs <strong className="font-mono text-xs bg-amber-50/70 text-[#8B3A3A] px-1.5 py-0.2 rounded border border-amber-200/50 font-extrabold">{selectedWordData.frequency}</strong> times in the Quran
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedWordData(null)}
                      className="w-8 h-8 rounded-full bg-[#E8DCC8] hover:bg-[#D4A574] text-[#795548] hover:text-white transition-colors flex items-center justify-center shrink-0"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Main Content Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Column: Arabic & Translation */}
                    <div className="space-y-3">
                      {/* Arabic Text */}
                      <div className="bg-white p-4 rounded-xl border border-[#E8DCC8] shadow-xs text-center" dir="rtl">
                        <div className={`${getAdaptiveArabicSizeClass(normalizeVocalizedArabic(selectedWordData.arabic))} font-bold font-arabic text-[#3E2723] leading-relaxed break-words`}>
                          {normalizeVocalizedArabic(selectedWordData.arabic)}
                        </div>
                      </div>

                      {/* Translation */}
                      <div className="bg-white p-4 rounded-xl border border-[#E8DCC8] shadow-xs">
                        <div className="text-xs font-bold text-[#8B3A3A] mb-1.5 uppercase flex items-center gap-2">
                          <MapPin className="w-3 h-3" />
                          Translation ({lang.toUpperCase()})
                        </div>
                        <div className="text-sm font-serif-eng text-[#3E2723] leading-relaxed">
                          {getTranslationText(selectedWordData.translations, lang) || 'Translation not available'}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Quick Info */}
                    <div className="space-y-3">
                      {/* Quick Info Cards */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white p-3 rounded-lg border border-[#E8DCC8] shadow-xs">
                          <div className="text-[10px] text-[#795548] font-mono uppercase">Root (الجذر)</div>
                          <div dir="rtl" className="text-base sm:text-lg font-bold font-arabic text-[#8B3A3A] whitespace-nowrap overflow-hidden text-ellipsis text-left mt-0.5">
                            {selectedWordData.formattedRoot || selectedWordData.root || getWordMorphologySummary(selectedWordData.arabic, selectedWordData).root}
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-[#E8DCC8] shadow-xs">
                          <div className="text-[10px] text-[#795548] font-mono uppercase">Part of Speech</div>
                          <div className="text-sm sm:text-base font-bold text-[#3E2723] mt-0.5 break-words">{selectedWordData.pos}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-[#E8DCC8] shadow-xs">
                          <div className="text-[10px] text-[#795548] font-mono uppercase">Baab (الباب)</div>
                          <div className="text-xs font-bold text-[#8B3A3A] mt-0.5">{getWordMorphologySummary(selectedWordData.arabic, selectedWordData).baab}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-[#E8DCC8] shadow-xs">
                          <div className="text-[10px] text-[#795548] font-mono uppercase">Wazan (الوزن)</div>
                          <div className="text-base font-bold font-arabic text-[#8B3A3A] whitespace-nowrap text-left mt-0.5" dir="rtl">{getWordMorphologySummary(selectedWordData.arabic, selectedWordData).wazan}</div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-2">
                        <button 
                          onClick={() => setViewOccurrences(true)}
                          className="w-full bg-gradient-to-r from-[#8B3A3A] to-[#D4A574] text-white py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                        >
                          <MapPin className="w-4 h-4" />
                          View All Occurrences ({selectedWordData.occurrences?.length || 0})
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Word Variants */}
                  {selectedWordData.variants && selectedWordData.variants.length > 1 && (
                    <div className="bg-gradient-to-br from-white/90 to-[#FAF6F1]/90 p-4 rounded-xl border border-[#D4A574]/30 shadow-lg backdrop-blur-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8B3A3A] to-[#D4A574] flex items-center justify-center">
                          <Layers className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[#8B3A3A]">Word Variants</h3>
                          <p className="text-xs text-[#795548]">{selectedWordData.variants.length} different forms found</p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {selectedWordData.variants.map((variant, idx) => {
                          const percentage = Math.round((variant.frequency / selectedWordData.frequency) * 100);
                          const isMostCommon = idx === 0;
                          
                          return (
                            <div 
                              key={idx} 
                              onClick={() => {
                                setSelectedVariant(variant.arabic || variant.form);
                                setViewOccurrences(true);
                              }}
                              className={`relative overflow-hidden rounded-lg border-2 transition-all duration-300 hover:shadow-md cursor-pointer ${
                                isMostCommon 
                                  ? 'border-[#8B3A3A] bg-gradient-to-r from-[#8B3A3A]/5 to-transparent hover:border-[#8B3A3A]' 
                                  : 'border-[#E8DCC8] bg-white hover:border-[#D4A574]'
                              }`}
                            >
                              {isMostCommon && (
                                <div className="absolute top-2 right-2">
                                  <div className="bg-[#8B3A3A] text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                    <Star className="w-3 h-3 fill-current" />
                                    Most Common
                                  </div>
                                </div>
                              )}
                              
                              <div className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <p className="text-2xl font-arabic text-[#3E2723] leading-relaxed mb-2" dir="rtl">
                                      {normalizeVocalizedArabic(variant.arabic)}
                                    </p>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-xs font-semibold text-[#8B3A3A] bg-[#FAF6F1] px-2.5 py-1 rounded border border-[#E8DCC8]/80 font-serif-eng">
                                        {variant.transliteration || variant.form}
                                      </span>
                                      <span className="text-xs font-bold text-[#8B3A3A]">
                                        {variant.frequency}x
                                      </span>
                                      <span className="text-xs text-[#795548]">
                                        ({percentage}%)
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-col items-end gap-2">
                                    <div className="w-24 h-2 bg-[#E8DCC8] rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-gradient-to-r from-[#8B3A3A] to-[#D4A574] transition-all duration-500"
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-[#E8DCC8]/50">
                        <div className="flex items-center justify-between text-xs text-[#795548]">
                          <span>Total frequency: {selectedWordData.frequency}</span>
                          <span className="flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            Click variant to see occurrences
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Root Family & Morphological Derivatives (Ishtiqaaq / المشتقات الجذرية) */}
                  {(() => {
                    const familyMembers = getRootFamilyWords(selectedWordData, allWords || words);
                    if (familyMembers.length <= 1) return null;
                    const rootDisplay =
                      selectedWordData.formattedRoot ||
                      selectedWordData.root ||
                      getWordMorphologySummary(selectedWordData.arabic, selectedWordData).root;

                    return (
                      <div className="bg-gradient-to-br from-white/95 to-[#FAF6F1] p-4 rounded-xl border border-[#D4A574]/40 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-[#E8DCC8]/70 pb-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#8B3A3A]/10 border border-[#8B3A3A]/20 flex items-center justify-center text-[#8B3A3A]">
                              <GitBranch className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-[#8B3A3A] font-serif-eng">
                                Root Family & Derivatives (المشتقّات الجذرية — الاشتقاق)
                              </h3>
                              <p className="text-[11px] text-[#795548]">
                                {familyMembers.length} Quranic words derived from root{' '}
                                <span className="font-arabic font-bold text-[#3E2723] text-sm px-1">
                                  {rootDisplay}
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {familyMembers.map(({ word: famWord, morph }) => {
                            const isCurrent = famWord.id === selectedWordData.id;
                            return (
                              <div
                                key={famWord.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedWordData(famWord);
                                }}
                                className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                  isCurrent
                                    ? 'bg-amber-50/90 border-[#8B3A3A] ring-1 ring-[#8B3A3A]/30'
                                    : 'bg-white border-[#E8DCC8] hover:border-[#8B3A3A]'
                                }`}
                              >
                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-[#3E2723] truncate font-serif-eng">
                                      {famWord.transliteration}
                                    </span>
                                    <span className="text-[9px] font-mono bg-[#FAF6F1] text-[#8B3A3A] px-1.5 py-0.5 rounded border border-[#E8DCC8]">
                                      {famWord.frequency}x
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-[#795548] italic truncate font-serif-eng">
                                    {getTranslationText(famWord.translations, lang)}
                                  </p>
                                  <div className="text-[9.5px] font-mono text-[#8B3A3A] truncate">
                                    {morph.baab} • <span className="font-arabic font-bold">{morph.wazan}</span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0" dir="rtl">
                                  <span className="text-xl font-bold font-arabic text-[#3E2723] block leading-snug">
                                    {normalizeVocalizedArabic(famWord.arabic)}
                                  </span>
                                  <span className="text-[9px] font-mono text-[#795548] uppercase block">
                                    {famWord.pos}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              </div>
            );
          })
        ) : (
          <div className="bg-[#FAF6F1] border border-[#E8DCC8] rounded-lg p-10 text-center text-[#795548]">
            <HelpCircle className="w-12 h-12 text-[#D4A574] mx-auto mb-3" />
            <p className="font-serif-eng text-base font-bold text-[#3E2723]">{translate('word.noneFound')}</p>
            <p className="text-xs text-[#795548] mt-1">Try relaxing your search query or enabling core vocabulary filters inside the sliders panel.</p>
          </div>
        )}

        {/* Infinite Scroll Sentinel */}
        {hasMore && onLoadMore && (
          <div ref={sentinelRef} className="h-4" />
        )}
      </div>

      {/* Occurrence Screens */}
      {viewOccurrences && selectedWordData && selectedSurah === null && (
        <div className="fixed inset-0 z-50 bg-[#FAF6F1] overflow-y-auto h-full">
          <WordOccurrencesScreen
            word={selectedWordData}
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

      {viewOccurrences && selectedWordData && selectedSurah !== null && (
        <div className="fixed inset-0 z-50 bg-[#FAF6F1] overflow-y-auto h-full">
          <AyahOccurrencesScreen
            word={selectedWordData}
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
