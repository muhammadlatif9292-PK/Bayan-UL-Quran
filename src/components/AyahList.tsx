/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { Ayah, Word, LearnedState, LanguageCode } from '../types';
import { CardHeritageFrame } from './ThemeOrnaments';
import { SearchInput } from './SearchInput';
import { SurahHeader } from './SurahHeader';
import { BookOpen, MapPin, Check, GraduationCap, Compass, GitBranch, Sparkles } from 'lucide-react';
import { surahs } from '../../data/surahs';
import {
  extractLemma,
  removeDiacritics,
  isParticle,
  tokenizeArabicMorphology,
  isGrammaticallyCompatible
} from '../lib/arabicMorphology';
import {
  normalizeArabicText,
  normalizeVocalizedArabic,
  getTranslationText,
  isWholeArabicWordMatch,
  getWordMorphologySummary,
  getRootFamilyWords
} from '../lib/quranUtils';
import { transliterateArabicToEnglish, formatRoot } from '../lib/buckwalterConverter';
import { fetchSurahVerseTranslations } from '../lib/translationLoader';

interface AyahListProps {
  ayahs: Ayah[];
  words: Word[];
  allWords?: Word[];
  onToggleState: (id: string, type: 'word' | 'phrase' | 'ayah', newState: LearnedState) => void;
  onSearchChange: (query: string) => void;
  searchQuery: string;
  lang: string;
  isRtl: boolean;
  translate: (key: string) => string;
  hasMore?: boolean;
  onLoadMore?: () => void;
  selectedSurah?: number;
  onSelectSurah?: (surahNum: number) => void;
}

export function AyahList({
  ayahs,
  words,
  allWords,
  onToggleState,
  onSearchChange,
  searchQuery,
  lang,
  isRtl,
  translate,
  hasMore,
  onLoadMore,
  selectedSurah,
  onSelectSurah
}: AyahListProps) {
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [activeAyahId, setActiveAyahId] = useState<string | null>(null);
  const [selectedAyah, setSelectedAyah] = useState<Ayah | null>(null);
  const [expandedSurahs, setExpandedSurahs] = useState<Set<number>>(new Set([1]));
  const [selectedJumpSurah, setSelectedJumpSurah] = useState<number>(1);
  const [liveTranslations, setLiveTranslations] = useState<Record<string, Record<number, string>>>({});
  const sentinelRef = useRef<HTMLDivElement>(null);

  const lastAutoExpandedSurahRef = useRef<number | null>(null);
  const corpusWords = allWords && allWords.length > 0 ? allWords : words;

  // Auto-expand first loaded surah when ayahs are loaded
  useEffect(() => {
    if (ayahs.length > 0) {
      const firstSurah = Math.min(...ayahs.map(a => a.surah));
      if (lastAutoExpandedSurahRef.current !== firstSurah) {
        lastAutoExpandedSurahRef.current = firstSurah;
        setExpandedSurahs(prev => {
          if (prev.has(firstSurah)) return prev;
          const newSet = new Set(prev);
          newSet.add(firstSurah);
          return newSet;
        });
      }
    }
  }, [ayahs]);

  // Fetch live verse translations for expanded Surahs in selected language & English fallback
  useEffect(() => {
    let isMounted = true;
    const surahsToFetch = Array.from(expandedSurahs) as number[];

    surahsToFetch.forEach(async (sNum: number) => {
      const langKey = `${sNum}:${lang}`;
      if (!liveTranslations[langKey]) {
        const map = await fetchSurahVerseTranslations(sNum, lang);
        if (isMounted && Object.keys(map).length > 0) {
          setLiveTranslations(prev => ({ ...prev, [langKey]: map }));
        }
      }
      if (lang !== 'en') {
        const enKey = `${sNum}:en`;
        if (!liveTranslations[enKey]) {
          const enMap = await fetchSurahVerseTranslations(sNum, 'en');
          if (isMounted && Object.keys(enMap).length > 0) {
            setLiveTranslations(prev => ({ ...prev, [enKey]: enMap }));
          }
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [expandedSurahs, lang]);

  const getAyahTranslationForLang = (ayah: Ayah, targetLang: string): string => {
    const existing = getTranslationText(ayah.translations, targetLang);
    if (existing && existing.trim()) return existing;
    const liveMap = liveTranslations[`${ayah.surah}:${targetLang}`];
    if (liveMap && liveMap[ayah.ayahNum]) return liveMap[ayah.ayahNum];
    if (targetLang !== 'en') {
      const enExisting = getTranslationText(ayah.translations, 'en');
      if (enExisting && enExisting.trim()) return enExisting;
      const enLive = liveTranslations[`${ayah.surah}:en`];
      if (enLive && enLive[ayah.ayahNum]) return enLive[ayah.ayahNum];
    }
    return '';
  };

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

  // Group ayahs by surah
  const ayahsBySurah = useMemo(() => {
    const grouped: Record<number, Ayah[]> = {};
    ayahs.forEach(ayah => {
      if (!grouped[ayah.surah]) {
        grouped[ayah.surah] = [];
      }
      grouped[ayah.surah].push(ayah);
    });
    return grouped;
  }, [ayahs]);

  // Get sorted surah numbers
  const sortedSurahNumbers = useMemo(() => {
    return Object.keys(ayahsBySurah).map(Number).sort((a, b) => a - b);
  }, [ayahsBySurah]);

  const toggleSurahExpansion = (surahNum: number) => {
    setExpandedSurahs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(surahNum)) {
        newSet.delete(surahNum);
      } else {
        newSet.add(surahNum);
      }
      return newSet;
    });
  };

  const handleJumpToSurah = (surahNum: number) => {
    setSelectedJumpSurah(surahNum);
    setExpandedSurahs(prev => new Set([...prev, surahNum]));
    if (onSelectSurah) {
      onSelectSurah(surahNum);
    }
  };

  const handleAyahCardClick = (ayah: Ayah) => {
    setSelectedAyah(ayah);
    setActiveAyahId(ayah.id);
    setSelectedWord(null);
  };

  // Parse a verse into individual segments for interactive clickable highlight bubbles
  const handleWordClick = (wordText: string, ayah: Ayah) => {
    const clickedMorph = tokenizeArabicMorphology(wordText);
    const wordLemma = clickedMorph.stemBase || extractLemma(wordText);
    const realTranslit =
      transliterateArabicToEnglish(normalizeVocalizedArabic(wordText)) || 'Quranic Word';

    // Check if it's a particle/preposition
    if (isParticle(wordText) || clickedMorph.pos === 'Particle') {
      setSelectedWord({
        id: 'w-particle',
        arabic: wordText,
        transliteration: realTranslit,
        root: 'N/A',
        pos: 'Particle (حرف)',
        frequency: 1,
        grammarDetails: {
          derivedForm: clickedMorph.baab,
          pattern: clickedMorph.wazan
        },
        translations: {
          en: [{ text: 'Grammatical Particle / Preposition (حرف معنى)', context: { note: 'Grammatical particle' } }],
          ur: [{ text: 'عربی حرفِ معنی / حرفِ جار', context: { note: 'Grammatical particle' } }],
          tr: [{ text: 'Arapça edat / harf', context: { note: 'Grammatical particle' } }],
          id: [{ text: 'Partikel / Harf Arab', context: { note: 'Grammatical particle' } }],
          hi: [{ text: '', context: { note: 'Grammatical particle' } }],
          ps: [{ text: '', context: { note: 'Grammatical particle' } }]
        },
        occurrences: [],
        themes: [],
        learnedState: 'new',
        isCore: false
      });
      setActiveAyahId(ayah.id);
      return;
    }

    const buildWordConstraint = (w: Word) => ({
      expectedRoot: w.root,
      expectedLemma: w.lemma,
      expectedBaab: w.grammarDetails?.derivedForm,
      expectedWazan: w.grammarDetails?.pattern,
      expectedPos: w.pos
    });

    // 1. Prioritize exact whole-word + grammatical match across the full corpus
    let foundWord = corpusWords.find(w => {
      const constraint = buildWordConstraint(w);
      return (
        isWholeArabicWordMatch(wordText, w.arabic, false, constraint) ||
        (w.variants &&
          w.variants.some(v =>
            isWholeArabicWordMatch(wordText, v.arabic || v.form, false, constraint)
          ))
      );
    });

    // 2. Second pass: allow valid grammatical proclitics/clitics constrained by Root, Baab, and Wazan
    if (!foundWord) {
      foundWord = corpusWords.find(w => {
        const constraint = buildWordConstraint(w);
        return (
          isWholeArabicWordMatch(wordText, w.arabic, true, constraint) ||
          (w.variants &&
            w.variants.some(v =>
              isWholeArabicWordMatch(wordText, v.arabic || v.form, true, constraint)
            )) ||
          isGrammaticallyCompatible(wordText, w.arabic, constraint)
        );
      });
    }

    if (foundWord) {
      setSelectedWord(foundWord);
      setActiveAyahId(ayah.id);
    } else {
      const resolvedRoot =
        clickedMorph.root && clickedMorph.root !== 'N/A'
          ? clickedMorph.root
          : wordLemma || 'N/A';
      setSelectedWord({
        id: 'w-temp',
        arabic: wordText,
        transliteration: realTranslit,
        root: resolvedRoot,
        formattedRoot: resolvedRoot,
        pos: clickedMorph.pos || 'Derived Word',
        frequency: 1,
        grammarDetails: {
          derivedForm: clickedMorph.baab,
          pattern: clickedMorph.wazan
        },
        translations: {
          en: [{ text: `${clickedMorph.pos} • ${clickedMorph.baab} (${clickedMorph.wazan})`, context: { note: 'Morphological analysis' } }],
          ur: [{ text: `${clickedMorph.baab} (${clickedMorph.wazan})`, context: { note: 'Morphological analysis' } }],
          tr: [{ text: `${clickedMorph.pos} • ${clickedMorph.baab}`, context: { note: 'Morphological analysis' } }],
          id: [{ text: `${clickedMorph.pos} • ${clickedMorph.baab}`, context: { note: 'Morphological analysis' } }],
          hi: [{ text: '', context: { note: 'Morphological analysis' } }],
          ps: [{ text: '', context: { note: 'Morphological analysis' } }]
        },
        occurrences: [],
        themes: [],
        learnedState: 'new',
        isCore: false
      });
      setActiveAyahId(ayah.id);
    }
  };

  const handleToggleAyahKnown = (id: string, currentState: LearnedState) => {
    const nextState = currentState === 'known' || currentState === 'mastered' ? 'new' : 'known';
    onToggleState(id, 'ayah', nextState);
  };

  return (
    <div className="space-y-4">
      {/* Top Chrome Header for verses browser */}
      <div className="flex flex-wrap justify-between items-center gap-3 bg-[#FAF6F1] border border-[#E8DCC8] rounded-lg p-3">
        <div className="flex items-center space-x-2 space-x-reverse">
          <GraduationCap className="w-5 h-5 text-[#8B3A3A]" />
          <span className="text-lg font-bold font-serif-eng text-[#3E2723]">
            {translate('tab.ayahs')} Directory <span className="text-xs font-mono font-normal">({ayahs.length} verses loaded)</span>
          </span>
        </div>

        {/* Direct 114-Surah Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-[#E8DCC8] rounded-md px-2.5 py-1">
            <BookOpen className="w-3.5 h-3.5 text-[#8B3A3A]" />
            <span className="text-[11px] font-bold text-[#795548]">Jump to Surah:</span>
            <select
              value={selectedJumpSurah}
              onChange={(e) => handleJumpToSurah(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-[#3E2723] focus:outline-none cursor-pointer"
            >
              {surahs.map(s => (
                <option key={s.number} value={s.number}>
                  {s.number}. {s.nameEnglish} ({s.nameArabic}) — {s.verses} Ayahs
                </option>
              ))}
            </select>
          </div>

          <div className="text-[10px] text-[#795548] font-bold uppercase bg-amber-50 border border-amber-100 px-2 py-1 rounded">
            💡 {translate('ayah.clickHint')}
          </div>
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

      <div className="space-y-6">
        {sortedSurahNumbers.map(surahNum => {
          const surahAyahs = ayahsBySurah[surahNum];
          const surahInfo = surahs.find(s => s.number === surahNum);
          const isExpanded = expandedSurahs.has(surahNum);

          if (!surahInfo) return null;

          return (
            <div key={surahNum} className="space-y-4">
              {/* Surah Header */}
              <SurahHeader
                surah={surahInfo}
                isExpanded={isExpanded}
                onToggle={() => toggleSurahExpansion(surahNum)}
                lang={lang}
                isRtl={isRtl}
                translate={translate}
              />

              {/* Ayahs for this surah - collapsible */}
              <div 
                className={`
                  overflow-hidden transition-all duration-500 ease-in-out
                  ${isExpanded ? 'max-h-[50000px] opacity-100' : 'max-h-0 opacity-0'}
                `}
              >
                <div className="space-y-4 pt-2">
                  {surahAyahs.map((ayah) => {
                    const isAyahKnown = ayah.learnedState === 'known' || ayah.learnedState === 'mastered';
                    const wordSegments = normalizeArabicText(ayah.arabicText).split(/\s+/);
                    const verseTrans = getAyahTranslationForLang(ayah, lang);
                    const enVerseTrans = lang !== 'en' ? getAyahTranslationForLang(ayah, 'en') : '';
                    const stats = ayah.statistics;
                    const formattedRoots = (stats?.roots_present || [])
                      .map(r => formatRoot(r))
                      .filter(Boolean);

                    return (
                      <div key={ayah.id}>
                        <CardHeritageFrame 
                          isKnown={isAyahKnown}
                          onToggle={() => onToggleState(ayah.id, 'ayah', isAyahKnown ? 'new' : 'known')}
                          className="space-y-4 shadow-sm cursor-pointer"
                          onClick={() => handleAyahCardClick(ayah)}
                        >
                        {/* Verse metadata row */}
                        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-[#E8DCC8]/60 pb-2">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="text-xs bg-[#8B3A3A] text-white font-mono font-bold px-2 py-0.5 rounded-full">
                              {ayah.id}
                            </span>
                            <span className="text-sm font-bold text-[#3E2723] font-serif-eng">
                              {ayah.surahName} ({normalizeArabicText(ayah.surahNameArabic)})
                            </span>
                            {ayah.juz && (
                              <span className="text-[10px] font-mono bg-[#FAF6F1] text-[#795548] border border-[#E8DCC8] px-2 py-0.5 rounded">
                                Juz {ayah.juz} • Hizb {ayah.hizb || 1}
                              </span>
                            )}
                            {ayah.sajda && (
                              <span className="text-[10px] font-mono font-bold bg-amber-100 text-[#8B3A3A] px-2 py-0.5 rounded">
                                ۩ Sajdah
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold bg-[#D4A574]/15 text-[#8B3A3A] px-2 py-0.5 rounded flex items-center gap-1">
                              <Compass className="w-3 h-3" /> {ayah.revelationPeriod}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleAyahKnown(ayah.id, ayah.learnedState);
                              }}
                              className={`text-[10px] font-bold px-2.5 py-1 rounded border transition-colors ${
                                isAyahKnown 
                                  ? 'bg-[#8B3A3A] text-white border-[#8B3A3A]' 
                                  : 'bg-white text-[#795548] border-[#E8DCC8] hover:border-[#8B3A3A]'
                              }`}
                            >
                              {isAyahKnown ? '✓ Verse Learnt' : 'Mark Lesson Paham'}
                            </button>
                          </div>
                        </div>

                        {/* Dynamic Interactive Clicking Verse Canvas */}
                        <div 
                          className="py-4 text-center select-none"
                          style={{ direction: 'rtl' }}
                        >
                          <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-3 font-arabic text-3xl text-[#3E2723] leading-loose">
                            {wordSegments.map((seg, sIdx) => (
                              <span
                                key={sIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleWordClick(seg, ayah);
                                }}
                                className="cursor-pointer hover:bg-[#D4A574] hover:text-white transition-all duration-150 px-2 py-0.5 rounded-md hover:scale-105 active:scale-95 inline-block select-text"
                                title="Tap word to inspect Sarf (Root, Baab, Wazan) & Translation"
                              >
                                {seg}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Translation with live cached fallback */}
                        <div className={`space-y-1.5 pt-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                          {verseTrans ? (
                            <p className="font-serif-eng text-[#3E2723] text-sm italic leading-relaxed">
                              "{verseTrans}"
                            </p>
                          ) : (
                            <p className="font-serif-eng text-[#795548]/70 text-xs italic">
                              Loading verse translation...
                            </p>
                          )}
                          {lang !== 'en' && enVerseTrans && enVerseTrans !== verseTrans && (
                            <p className="font-serif-eng text-[#795548] text-xs italic leading-relaxed">
                              EN: "{enVerseTrans}"
                            </p>
                          )}
                        </div>

                        {/* Per-Verse Scholarly Grammatical & Root Statistics Bar */}
                        {stats && (stats.total_tokens || formattedRoots.length > 0) && (
                          <div className="pt-2.5 border-t border-[#E8DCC8]/60 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[#795548]">
                              {stats.total_tokens !== undefined && (
                                <span className="bg-white px-2.5 py-0.5 rounded-md border border-[#E8DCC8]">
                                  Words: <strong className="text-[#3E2723]">{stats.total_tokens}</strong>
                                </span>
                              )}
                              {stats.noun_count !== undefined && stats.noun_count > 0 && (
                                <span className="bg-white px-2.5 py-0.5 rounded-md border border-[#E8DCC8]">
                                  Nouns: <strong className="text-[#3E2723]">{stats.noun_count}</strong>
                                </span>
                              )}
                              {stats.verb_count !== undefined && stats.verb_count > 0 && (
                                <span className="bg-white px-2.5 py-0.5 rounded-md border border-[#E8DCC8]">
                                  Verbs: <strong className="text-[#8B3A3A]">{stats.verb_count}</strong>
                                </span>
                              )}
                              {stats.adjective_count !== undefined && stats.adjective_count > 0 && (
                                <span className="bg-white px-2.5 py-0.5 rounded-md border border-[#E8DCC8]">
                                  Adjectives: <strong className="text-[#3E2723]">{stats.adjective_count}</strong>
                                </span>
                              )}
                            </div>

                            {formattedRoots.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[9.5px] font-mono text-[#795548] uppercase font-bold">
                                  Roots (الجذور):
                                </span>
                                {formattedRoots.slice(0, 6).map((rt, rIdx) => (
                                  <span
                                    key={rIdx}
                                    className="font-arabic font-bold text-xs bg-amber-50/90 text-[#8B3A3A] border border-amber-200/80 px-2.5 py-0.5 rounded-md whitespace-nowrap"
                                    dir="rtl"
                                  >
                                    {rt}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Active Segment Detail Card popping dynamically underneath the verse */}
                        {activeAyahId === ayah.id && selectedWord && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#FAF6F1] border-2 border-[#D4A574] rounded-xl p-4 space-y-3.5 mt-4 transition-all animate-fadeIn shadow-sm"
                          >
                            <div className="flex justify-between items-center border-b border-[#E8DCC8] pb-2.5">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-[#8B3A3A]" />
                                <span className="text-[10px] uppercase font-bold text-[#8B3A3A] tracking-wider font-mono">
                                  Word-by-Word Sarf & Nahw Inspector
                                </span>
                              </div>
                              <button 
                                onClick={() => setSelectedWord(null)}
                                className="text-[#795548] hover:text-[#8B3A3A] font-bold text-xs font-mono px-2 py-0.5 rounded bg-white border border-[#E8DCC8]"
                              >
                                ✕ Close
                              </button>
                            </div>

                            {/* Dedicated Calligraphic Plaque for the Inspected Word */}
                            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-[#E8DCC8] shadow-xs text-center space-y-1.5">
                              <div className="text-2xl sm:text-3xl font-bold font-arabic text-[#3E2723] leading-relaxed break-words" dir="rtl">
                                {normalizeVocalizedArabic(selectedWord.arabic)}
                              </div>
                              <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-serif-eng">
                                <span className="font-bold text-[#3E2723]">{selectedWord.transliteration}</span>
                                <span className="text-[#D4A574]">•</span>
                                <span className="italic text-[#5D4037]">
                                  {getTranslationText(selectedWord.translations, lang) || 'N/A'}
                                </span>
                              </div>
                              {lang !== 'en' && getTranslationText(selectedWord.translations, 'en') && (
                                <div className="text-xs font-serif-eng text-[#795548] italic">
                                  EN: {getTranslationText(selectedWord.translations, 'en')}
                                </div>
                              )}
                            </div>

                            {/* Structured 2x2 Grammatical & Morphological Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div className="bg-white p-2.5 rounded-lg border border-[#E8DCC8] flex flex-col justify-between">
                                <span className="text-[9px] font-mono uppercase text-[#795548] font-bold">Root (الجذر)</span>
                                <span
                                  dir="rtl"
                                  className="font-arabic font-bold text-sm sm:text-base text-[#8B3A3A] whitespace-nowrap overflow-hidden text-ellipsis text-left mt-0.5"
                                >
                                  {selectedWord.formattedRoot || selectedWord.root || getWordMorphologySummary(selectedWord.arabic, selectedWord).root}
                                </span>
                              </div>
                              <div className="bg-white p-2.5 rounded-lg border border-[#E8DCC8] flex flex-col justify-between">
                                <span className="text-[9px] font-mono uppercase text-[#795548] font-bold">Part of Speech</span>
                                <span className="text-xs sm:text-sm font-bold text-[#3E2723] font-serif-eng mt-0.5 break-words">
                                  {selectedWord.pos}
                                </span>
                              </div>
                              <div className="bg-white p-2.5 rounded-lg border border-[#E8DCC8] flex flex-col justify-between">
                                <span className="text-[9px] font-mono uppercase text-[#795548] font-bold">Baab / Wazan</span>
                                <span className="text-xs font-bold text-[#8B3A3A] font-mono mt-0.5 truncate">
                                  {getWordMorphologySummary(selectedWord.arabic, selectedWord).baab} •{' '}
                                  <span className="font-arabic font-bold whitespace-nowrap" dir="rtl">
                                    {getWordMorphologySummary(selectedWord.arabic, selectedWord).wazan}
                                  </span>
                                </span>
                              </div>
                              <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/70 flex flex-col justify-between">
                                <span className="text-[9px] font-mono uppercase text-[#795548] font-bold">Quranic Freq</span>
                                <span className="font-mono text-sm font-extrabold text-[#8B3A3A] mt-0.5">
                                  {selectedWord.frequency}x
                                </span>
                              </div>
                            </div>

                            {/* Sibling Root Family Derivatives (Ishtiqaaq) */}
                            {(() => {
                              const siblings = getRootFamilyWords(selectedWord, corpusWords);
                              if (siblings.length <= 1) return null;
                              return (
                                <div className="bg-white/85 p-3 rounded-lg border border-[#E8DCC8] space-y-2">
                                  <div className="text-[10px] font-bold text-[#8B3A3A] uppercase font-mono flex items-center gap-1">
                                    <GitBranch className="w-3 h-3" />
                                    <span>Root Family Derivatives (المشتقات الجذرية — {siblings.length} words)</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {siblings.slice(0, 8).map(({ word: sib, morph }) => (
                                      <button
                                        key={sib.id}
                                        onClick={() => setSelectedWord(sib)}
                                        className={`px-2.5 py-1 rounded-md border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                                          sib.id === selectedWord.id
                                            ? 'bg-[#8B3A3A] text-white border-[#8B3A3A]'
                                            : 'bg-[#FAF6F1] text-[#3E2723] border-[#E8DCC8] hover:border-[#8B3A3A]'
                                        }`}
                                      >
                                        <span className="font-arabic font-bold text-sm" dir="rtl">
                                          {normalizeVocalizedArabic(sib.arabic)}
                                        </span>
                                        <span className="text-[10px] opacity-85 font-serif-eng">
                                          ({sib.transliteration})
                                        </span>
                                        <span className="text-[9px] font-mono opacity-75">
                                          [{morph.wazan}]
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Word Occurrences - excluding current ayah */}
                            {selectedWord.occurrences && selectedWord.occurrences.length > 0 && (
                              <div className="bg-white/85 p-3 rounded-lg border border-[#E8DCC8]">
                                <div className="text-xs font-bold text-[#8B3A3A] mb-2 uppercase">
                                  Occurrences in Quran ({selectedWord.occurrences.length} total)
                                </div>
                                <div className="max-h-32 overflow-y-auto flex flex-wrap gap-1.5">
                                  {selectedWord.occurrences
                                    .filter(occ => occ.surah !== ayah.surah || occ.ayah !== ayah.ayahNum)
                                    .slice(0, 12)
                                    .map((occ, idx) => (
                                      <div key={idx} className="text-xs font-mono text-[#3E2723] bg-[#FAF6F1] border border-[#E8DCC8] px-2 py-0.5 rounded flex items-center gap-1.5">
                                        <span className="font-bold text-[#8B3A3A]">{occ.surah}:{occ.ayah}</span>
                                        <span className="text-[#795548] text-[10px]">{occ.surahName}</span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Themes and Learning State */}
                            <div className="flex items-center justify-between">
                              <div className="flex flex-wrap gap-1">
                                {selectedWord.themes && selectedWord.themes.length > 0 && selectedWord.themes.slice(0, 3).map((theme, idx) => (
                                  <span key={idx} className="text-[10px] bg-[#D4A574]/20 text-[#8B3A3A] px-2 py-0.5 rounded-full">
                                    {theme}
                                  </span>
                                ))}
                              </div>

                              {/* Immediate Toggle inside Study context */}
                              {selectedWord.id !== 'w-temp' && selectedWord.id !== 'w-particle' && (
                                <button
                                  onClick={() => {
                                    const next = selectedWord.learnedState === 'known' ? 'new' : 'known';
                                    onToggleState(selectedWord.id, 'word', next);
                                    setSelectedWord(prev => prev ? { ...prev, learnedState: next } : null);
                                  }}
                                  className={`text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1 cursor-pointer ${
                                    selectedWord.learnedState === 'known'
                                      ? 'bg-[#D4A574] text-white'
                                      : 'bg-white border text-gray-700 hover:border-[#8B3A3A]'
                                  }`}
                                >
                                  <Check className="w-3 h-3" />
                                  {selectedWord.learnedState === 'known' ? 'Marked Learned' : 'Mark Learned'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </CardHeritageFrame>

                      {/* Ayah Translation & Syntactic Summary Panel */}
                      {selectedAyah && activeAyahId === ayah.id && !selectedWord && (
                        <div className="bg-[#FAF6F1] border-2 border-dashed border-[#D4A574] rounded-lg p-4 space-y-3 mt-4 transition-all animate-fadeIn">
                          <div className="flex justify-between items-center border-b border-[#E8DCC8] pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] uppercase font-bold text-[#8B3A3A] tracking-wider font-mono">
                                Ayah Linguistic & Translation Study
                              </span>
                              <span className="text-xs font-bold bg-[#D4A574]/15 text-[#8B3A3A] px-2 py-0.5 rounded">
                                {selectedAyah.id}
                              </span>
                            </div>
                            <button 
                              onClick={() => setSelectedAyah(null)}
                              className="text-[#795548] hover:text-black font-bold text-xs font-mono"
                            >
                              ✕ Close Panel
                            </button>
                          </div>

                          {/* Arabic Text */}
                          <div className="bg-white/85 p-3 rounded-lg border border-[#E8DCC8]">
                            <div className="text-2xl font-bold font-arabic text-[#3E2723] text-right leading-loose" dir="rtl">
                              {normalizeArabicText(selectedAyah.arabicText)}
                            </div>
                          </div>

                          {/* Translations in selected language */}
                          <div className="bg-white/85 p-3 rounded-lg border border-[#E8DCC8]">
                            <div className="text-xs font-bold text-[#8B3A3A] mb-2 uppercase">Translation ({lang.toUpperCase()})</div>
                            <div className="text-sm font-serif-eng text-[#3E2723] leading-relaxed">
                              {getAyahTranslationForLang(selectedAyah, lang) || 'Translation loading...'}
                            </div>
                            {lang !== 'en' && getAyahTranslationForLang(selectedAyah, 'en') && (
                              <div className="mt-2 pt-2 border-t border-[#E8DCC8]">
                                <div className="text-xs font-bold text-[#795548] mb-1">English</div>
                                <div className="text-xs font-serif-eng text-[#795548] leading-relaxed">
                                  {getAyahTranslationForLang(selectedAyah, 'en')}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Ayah Information */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white/85 p-2 rounded-lg border border-[#E8DCC8]">
                              <div className="text-[10px] text-[#795548] font-mono">Surah</div>
                              <div className="text-sm font-bold text-[#3E2723]">{selectedAyah.surahName}</div>
                            </div>
                            <div className="bg-white/85 p-2 rounded-lg border border-[#E8DCC8]">
                              <div className="text-[10px] text-[#795548] font-mono">Revelation</div>
                              <div className="text-sm font-bold text-[#3E2723]">{selectedAyah.revelationPeriod}</div>
                            </div>
                            <div className="bg-white/85 p-2 rounded-lg border border-[#E8DCC8]">
                              <div className="text-[10px] text-[#795548] font-mono">Juz / Hizb</div>
                              <div className="text-sm font-bold text-[#3E2723]">Juz {selectedAyah.juz || 1} • Hizb {selectedAyah.hizb || 1}</div>
                            </div>
                            <div className="bg-white/85 p-2 rounded-lg border border-[#E8DCC8]">
                              <div className="text-[10px] text-[#795548] font-mono">Status</div>
                              <div className="text-sm font-bold text-[#3E2723] uppercase">{selectedAyah.learnedState}</div>
                            </div>
                          </div>
                        </div>
                      )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Infinite Scroll Sentinel */}
        {hasMore && onLoadMore && (
          <div ref={sentinelRef} className="h-4" />
        )}
      </div>
    </div>
  );
}
