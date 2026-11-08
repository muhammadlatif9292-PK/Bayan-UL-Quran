/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { Word, Occurrence } from '../types';
import { 
  ArrowLeft, 
  BookOpen, 
  ChevronRight, 
  MapPin, 
  Layers, 
  Search, 
  Sparkles,
  Filter,
  Check,
  Hash,
  Book,
  ExternalLink
} from 'lucide-react';
import {
  normalizeArabicText,
  normalizeVocalizedArabic,
  cleanArabicVariantKey,
  cleanArabicVariantKeyWithVowels,
  consolidateWordVariants,
  getHighlightedWordIndices,
  isWholeArabicWordMatch,
  getWordMorphologySummary
} from '../lib/quranUtils';
import { removeDiacritics } from '../lib/arabicMorphology';
import { toArabicIfNeeded } from '../lib/buckwalterConverter';
import { loadAyahsBySurah } from '../lib/dataLoader';

interface WordOccurrencesScreenProps {
  word: Word;
  lang: string;
  initialVariant?: string | null;
  initialViewMode?: 'variant' | 'surah';
  onBack: () => void;
  onSurahClick?: (surah: number, variantForm?: string) => void;
}

interface VariantGroup {
  id: string;
  arabic: string;
  form: string;
  transliteration?: string;
  frequency: number;
  occurrences: Occurrence[];
}

interface SurahOccurrenceGroup {
  surah: number;
  surahName: string;
  surahNameUr?: string;
  count: number;
  occurrences: Occurrence[];
}

export function WordOccurrencesScreen({
  word,
  lang,
  initialVariant = null,
  initialViewMode = 'variant',
  onBack,
  onSurahClick
}: WordOccurrencesScreenProps) {
  // Mode switcher state: default is 'variant' as requested
  const [viewMode, setViewMode] = useState<'variant' | 'surah'>(initialViewMode);
  
  // Selected variant filter state (null means all variants)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(initialVariant);

  // Search filter query
  const [searchQuery, setSearchQuery] = useState<string>('');

  const allOccurrences = word.occurrences || [];

  // Load full ayahs and translations from Alquran.cloud
  const [fullAyahs, setFullAyahs] = useState<Record<string, {
    arabicText: string;
    translation: string;
    enTranslation?: string;
    surahName?: string;
    surahNameArabic?: string;
  }>>({});
  const [ayahsLoading, setAyahsLoading] = useState<boolean>(false);

  // Fallback translation mappings helper
  const getAlquranEdition = (langCode: string) => {
    const editions: Record<string, string> = {
      en: 'en.sahih',       // Sahih International
      ur: 'ur.maududi',     // Maududi
      tr: 'tr.ozturk',      // Ozturk
      id: 'id.indonesian',  // Indonesian
      bn: 'bn.bengali',     // Bengali
      es: 'es.asad',        // Asad
      fr: 'fr.hamidullah',  // Hamidullah
      ru: 'ru.kuliev',      // Kuliev
      sv: 'sv.bernstrom',   // Bernstrom
      zh: 'zh.jian'         // Chinese
    };
    return editions[langCode] || 'en.sahih';
  };

  // Deduplicate and group occurrences cleanly by variant forms
  const variantGroups = useMemo<VariantGroup[]>(() => {
    const rawVariants = word.variants || [];
    const occurrences = word.occurrences || [];

    // Consolidate raw variants to unique, clean, canonical forms
    const cleanedVariants = consolidateWordVariants(rawVariants, word.arabic);

    // Fallback if no variants exist
    if (cleanedVariants.length === 0) {
      cleanedVariants.push({
        arabic: word.arabic,
        form: word.transliteration || 'Primary Form',
        transliteration: word.transliteration || '',
        frequency: occurrences.length || 1
      });
    }

    const variantList = cleanedVariants.map((v, idx) => ({
      cleanKey: cleanArabicVariantKeyWithVowels(v.arabic || v.form),
      baseKey: cleanArabicVariantKey(v.arabic || v.form),
      id: `variant_${idx}`,
      arabic: v.arabic,
      form: v.form,
      transliteration: v.transliteration,
      frequency: v.frequency,
      occurrences: [] as Occurrence[]
    }));

    // Assign EACH occurrence to EXACTLY ONE best-matching variant group
    occurrences.forEach((occ: any) => {
      const occVariantClean = occ.variantForm ? cleanArabicVariantKeyWithVowels(occ.variantForm) : null;
      const occVariantBase = occ.variantForm ? cleanArabicVariantKey(occ.variantForm) : null;
      const contextTokens = (occ.context || '').split(/\s+/).filter(Boolean);

      let bestIdx = -1;

      if (occVariantClean) {
        bestIdx = variantList.findIndex(v => v.cleanKey === occVariantClean);
      }

      if (bestIdx === -1 && occVariantBase) {
        bestIdx = variantList.findIndex(v => v.baseKey === occVariantBase);
      }

      if (bestIdx === -1 && contextTokens.length > 0) {
        bestIdx = variantList.findIndex(v =>
          contextTokens.some((tok: string) =>
            isWholeArabicWordMatch(tok, v.arabic || v.form, false, {
              expectedRoot: word.root,
              expectedLemma: word.lemma,
              expectedBaab: word.grammarDetails?.derivedForm,
              expectedWazan: word.grammarDetails?.pattern,
              expectedPos: occ.pos || word.pos,
              morphTag: occ.morph
            })
          )
        );
      }

      if (bestIdx === -1 && variantList.length > 0) {
        bestIdx = 0;
      }

      if (bestIdx !== -1) {
        variantList[bestIdx].occurrences.push(occ);
      }
    });

    return variantList.map(v => ({
      id: v.id,
      arabic: v.arabic,
      form: v.form,
      transliteration: v.transliteration,
      frequency: Math.max(v.frequency, v.occurrences.length),
      occurrences: v.occurrences
    }));
  }, [word]);

  // Auto-select single variant if there is only one variant
  useEffect(() => {
    if (!selectedVariant && variantGroups.length === 1) {
      setSelectedVariant(variantGroups[0].arabic || variantGroups[0].form);
    }
  }, [variantGroups, selectedVariant]);

  // Load full ayahs and translations from Alquran.cloud
  useEffect(() => {
    let active = true;
    async function loadAllFullAyahs() {
      if (allOccurrences.length === 0) return;
      setAyahsLoading(true);
      try {
        const uniqueSurahs = Array.from(new Set(allOccurrences.map(o => o.surah)));
        
        // 1. Fetch Arabic texts of all unique surahs from local JSON loader
        const arabicPromises = uniqueSurahs.map(async (surahNum) => {
          try {
            const ayahs = await loadAyahsBySurah(surahNum);
            return { surahNum, ayahs };
          } catch (e) {
            console.warn(`Failed to load Arabic ayahs for surah ${surahNum}`, e);
            return { surahNum, ayahs: [] };
          }
        });
        
        // 2. Fetch translations of all unique surahs in selected language from Alquran.cloud
        const transPromises = uniqueSurahs.map(async (surahNum) => {
          const edition = getAlquranEdition(lang);
          try {
            const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/${edition}`);
            if (res.ok) {
              const data = await res.json();
              return { surahNum, lang: lang, ayahs: data.data?.ayahs || [] };
            } else if (edition !== 'en.sahih') {
              // Fallback to English Sahih
              const fallbackRes = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/en.sahih`);
              if (fallbackRes.ok) {
                const data = await fallbackRes.json();
                return { surahNum, lang: lang, ayahs: data.data?.ayahs || [] };
              }
            }
          } catch (e) {
            console.warn(`Failed to fetch ${lang} translations for surah ${surahNum}`, e);
          }
          return { surahNum, lang: lang, ayahs: [] };
        });

        // 3. Fetch English translations as secondary reference if language is not English
        const enPromises = lang !== 'en' ? uniqueSurahs.map(async (surahNum) => {
          try {
            const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/en.sahih`);
            if (res.ok) {
              const data = await res.json();
              return { surahNum, ayahs: data.data?.ayahs || [] };
            }
          } catch (e) {
            console.warn(`Failed to fetch English translations for surah ${surahNum}`, e);
          }
          return { surahNum, ayahs: [] };
        }) : [];

        // Resolve all promises
        const [arabicResults, transResults, enResults] = await Promise.all([
          Promise.all(arabicPromises),
          Promise.all(transPromises),
          Promise.all(enPromises)
        ]);

        if (!active) return;

        const ayahMap: Record<string, {
          arabicText: string;
          translation: string;
          enTranslation?: string;
          surahName?: string;
          surahNameArabic?: string;
        }> = {};

        // Process Arabic texts
        arabicResults.forEach(({ surahNum, ayahs }) => {
          ayahs.forEach((ayah) => {
            const key = `${surahNum}:${ayah.ayahNum}`;
            ayahMap[key] = {
              arabicText: ayah.arabicText,
              translation: '',
              surahName: ayah.surahName,
              surahNameArabic: ayah.surahNameArabic
            };
          });
        });

        // Process translations
        transResults.forEach(({ surahNum, ayahs }) => {
          ayahs.forEach((ayah: any) => {
            const key = `${surahNum}:${ayah.numberInSurah}`;
            if (ayahMap[key]) {
              ayahMap[key].translation = ayah.text;
            }
          });
        });

        // Process English secondary translations
        enResults.forEach(({ surahNum, ayahs }) => {
          ayahs.forEach((ayah: any) => {
            const key = `${surahNum}:${ayah.numberInSurah}`;
            if (ayahMap[key]) {
              ayahMap[key].enTranslation = ayah.text;
            }
          });
        });

        setFullAyahs(ayahMap);
      } catch (err) {
        console.warn('Error loading full ayahs & translations:', err);
      } finally {
        if (active) {
          setAyahsLoading(false);
        }
      }
    }

    loadAllFullAyahs();
    return () => {
      active = false;
    };
  }, [allOccurrences, lang]);

  // Group occurrences by Surah (respecting selectedVariant filter if set)
  const surahGroups = useMemo<SurahOccurrenceGroup[]>(() => {
    const map = new Map<number, SurahOccurrenceGroup>();

    // Determine occurrences pool based on selected variant
    let occurrencesPool: Occurrence[] = allOccurrences;
    if (selectedVariant) {
      const targetClean = cleanArabicVariantKeyWithVowels(selectedVariant);
      const matchedGroup = variantGroups.find(
        g => cleanArabicVariantKeyWithVowels(g.arabic) === targetClean || cleanArabicVariantKeyWithVowels(g.form) === targetClean
      );
      if (matchedGroup) {
        occurrencesPool = matchedGroup.occurrences;
      } else {
        occurrencesPool = allOccurrences.filter((occ: any) => {
          if (occ.variantForm) {
            return cleanArabicVariantKeyWithVowels(occ.variantForm) === targetClean;
          }
          return cleanArabicVariantKeyWithVowels(occ.context || '').includes(targetClean);
        });
      }
    }

    occurrencesPool.forEach(occ => {
      if (!map.has(occ.surah)) {
        map.set(occ.surah, {
          surah: occ.surah,
          surahName: occ.surahName || `Surah ${occ.surah}`,
          surahNameUr: occ.surahNameUr,
          count: 0,
          occurrences: []
        });
      }
      const item = map.get(occ.surah)!;
      item.count++;
      item.occurrences.push(occ);
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [allOccurrences, variantGroups, selectedVariant]);

  // Occurrences list filtered for By Variant view mode
  const activeVariantOccurrences = useMemo(() => {
    let list: Occurrence[] = [];
    if (!selectedVariant) {
      list = allOccurrences;
    } else {
      const targetClean = cleanArabicVariantKeyWithVowels(selectedVariant);
      const group = variantGroups.find(
        g => cleanArabicVariantKeyWithVowels(g.arabic) === targetClean || cleanArabicVariantKeyWithVowels(g.form) === targetClean
      );
      if (group) {
        list = group.occurrences;
      } else {
        list = allOccurrences.filter((occ: any) => {
          if (occ.variantForm) {
            return cleanArabicVariantKeyWithVowels(occ.variantForm) === targetClean;
          }
          return cleanArabicVariantKeyWithVowels(occ.context || '').includes(targetClean);
        });
      }
    }

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(occ => 
      occ.surahName?.toLowerCase().includes(q) ||
      occ.surah.toString().includes(q) ||
      occ.ayah.toString().includes(q) ||
      `${occ.surah}:${occ.ayah}`.includes(q) ||
      normalizeArabicText(occ.context).includes(q)
    );
  }, [allOccurrences, variantGroups, selectedVariant, searchQuery]);

  // Helper for rendering highlighted Arabic verse text
  const renderHighlightedVerse = (context: string, targetTerm?: string, occ?: any) => {
    if (!context) return null;
    const tokens = normalizeArabicText(context).split(/\s+/);
    const highlightedIndices = getHighlightedWordIndices(
      tokens,
      occ ? { ...occ, word: undefined } : undefined,
      word.arabic || '',
      targetTerm,
      word
    );

    return (
      <div className="flex flex-wrap justify-start gap-x-2 gap-y-2 text-right font-arabic text-xl sm:text-2xl leading-relaxed text-[#3E2723]" dir="rtl">
        {tokens.map((token, idx) => {
          const isMatch = highlightedIndices.has(idx);

          return (
            <span
              key={idx}
              className={`px-1.5 py-0.5 rounded transition-all ${
                isMatch
                  ? 'bg-[#8B3A3A]/15 text-[#8B3A3A] font-extrabold border-b-2 border-[#8B3A3A] shadow-xs'
                  : 'text-[#3E2723]/90'
              }`}
            >
              {token}
            </span>
          );
        })}
      </div>
    );
  };

  // Helper for rendering loaded full Arabic verse text with highlighting and translations
  const renderOccurrenceVerse = (occ: any) => {
    const key = `${occ.surah}:${occ.ayah}`;
    const fullAyah = fullAyahs[key];
    
    if (ayahsLoading && !fullAyah) {
      return (
        <div className="py-4 text-center">
          <div className="w-6 h-6 border-2 border-[#D4A574] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-[#795548]">Loading full verse...</p>
        </div>
      );
    }
    
    if (fullAyah) {
      const wordSegments = normalizeArabicText(fullAyah.arabicText).split(/\s+/);
      const highlightedIndices = getHighlightedWordIndices(
        wordSegments,
        occ,
        word.arabic || '',
        selectedVariant,
        word
      );
      
      return (
        <div className="space-y-4">
          {/* Full Arabic text with highlights */}
          <div className="text-right leading-loose font-arabic text-2xl text-[#3E2723]" style={{ direction: 'rtl' }}>
            <div className="flex flex-wrap justify-start gap-x-2 gap-y-3">
              {wordSegments.map((seg, sIdx) => {
                const highlight = highlightedIndices.has(sIdx);
                return (
                  <span
                    key={sIdx}
                    className={`inline-block px-1 rounded transition-all duration-150 select-text ${
                      highlight
                        ? 'bg-[#8B3A3A]/15 text-[#8B3A3A] font-extrabold border-b-2 border-[#8B3A3A]/65 scale-[1.03] px-1.5 shadow-xs'
                        : 'text-[#3E2723]/95 hover:bg-stone-100'
                    }`}
                  >
                    {seg}
                  </span>
                );
              })}
            </div>
          </div>
          
          {/* Translation */}
          {(fullAyah.translation || fullAyah.enTranslation) && (
            <div className="pt-3 border-t border-[#E8DCC8]/30 text-left space-y-1">
              {fullAyah.translation && (
                <p className="font-serif-eng text-[#3E2723] text-sm italic leading-relaxed">
                  {fullAyah.translation}
                </p>
              )}
              {lang !== 'en' && fullAyah.enTranslation && (
                <p className="font-serif-eng text-[#795548] text-xs italic leading-relaxed">
                  EN: {fullAyah.enTranslation}
                </p>
              )}
            </div>
          )}
        </div>
      );
    }
    
    // Fallback
    return renderHighlightedVerse(occ.context, occ.variantForm || selectedVariant || word.arabic, occ);
  };

  return (
    <div className="bg-gradient-to-br from-[#FAF6F1] via-white to-[#F7F2EB] min-h-full p-4 sm:p-6 pb-32">
      {/* Top Header & Back Action */}
      <div className="max-w-4xl mx-auto mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-[#8B3A3A] hover:text-[#D4A574] transition-colors mb-4 font-bold text-sm bg-white/90 hover:bg-white px-4 py-2.5 rounded-xl border border-[#E8DCC8] shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Word List</span>
        </button>

        {/* Word Info Banner */}
        <div className="bg-white rounded-2xl border-2 border-[#D4A574] p-5 sm:p-6 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#D4A574]/10 to-transparent rounded-bl-full pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8B3A3A] to-[#D4A574] flex items-center justify-center shadow-md flex-shrink-0">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold font-arabic text-[#3E2723] leading-snug" dir="rtl">
                  {normalizeVocalizedArabic(word.arabic)}
                </h1>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-[#795548] mt-1 font-medium">
                  <span className="font-mono bg-[#FAF6F1] px-2 py-0.5 rounded border border-[#E8DCC8]">
                    {word.transliteration}
                  </span>
                  <span>•</span>
                  <span>
                    Root: <strong className="font-arabic text-[#3E2723]">{toArabicIfNeeded(word.formattedRoot || word.root || '') || getWordMorphologySummary(word.arabic, word).root}</strong>
                  </span>
                  <span>•</span>
                  <span className="bg-[#FAF6F1] text-[#3E2723] font-semibold px-2 py-0.5 rounded border border-[#E8DCC8]">
                    Baab: <strong className="font-arabic text-[#8B3A3A]">{getWordMorphologySummary(word.arabic, word).baab}</strong>
                  </span>
                  <span>•</span>
                  <span className="bg-[#FAF6F1] text-[#3E2723] font-semibold px-2 py-0.5 rounded border border-[#E8DCC8]">
                    Wazan: <strong className="font-arabic text-[#8B3A3A]" dir="rtl">{getWordMorphologySummary(word.arabic, word).wazan}</strong>
                  </span>
                  <span>•</span>
                  <span className="bg-[#8B3A3A]/10 text-[#8B3A3A] font-bold px-2 py-0.5 rounded">
                    {allOccurrences.length} Total Occurrences
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Switcher Filter: By Variant vs By Surah */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="bg-white p-1.5 rounded-2xl border-2 border-[#E8DCC8] shadow-xs flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => setViewMode('variant')}
            className={`flex-1 py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all ${
              viewMode === 'variant'
                ? 'bg-gradient-to-r from-[#8B3A3A] to-[#D4A574] text-white shadow-md'
                : 'text-[#795548] hover:bg-[#FAF6F1] hover:text-[#3E2723]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Occurrences by Word Variants ({variantGroups.length})</span>
            {viewMode === 'variant' && (
              <span className="bg-white/20 text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-mono">
                Default
              </span>
            )}
          </button>

          <button
            onClick={() => setViewMode('surah')}
            className={`flex-1 py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all ${
              viewMode === 'surah'
                ? 'bg-gradient-to-r from-[#8B3A3A] to-[#D4A574] text-white shadow-md'
                : 'text-[#795548] hover:bg-[#FAF6F1] hover:text-[#3E2723]'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Occurrences by Surah ({surahGroups.length})</span>
          </button>
        </div>
      </div>

      {/* Search Bar & Variant Quick-Pills Bar */}
      <div className="max-w-4xl mx-auto mb-6 space-y-4">
        {/* Variant Selectors Strip */}
        {variantGroups.length > 0 && (
          <div className="bg-white rounded-xl border border-[#E8DCC8] p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[#8B3A3A]">
                <Layers className="w-4 h-4" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider">
                  Select Word Variant ({variantGroups.length} Unique Forms)
                </h3>
              </div>
              {selectedVariant && (
                <button
                  onClick={() => setSelectedVariant(null)}
                  className="text-xs text-[#8B3A3A] hover:underline font-bold"
                >
                  Show All Variants
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedVariant(null)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedVariant === null
                    ? 'bg-[#8B3A3A] text-white shadow-xs'
                    : 'bg-[#FAF6F1] text-[#795548] hover:bg-[#E8DCC8]'
                }`}
              >
                <span>All Variants</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                  selectedVariant === null ? 'bg-white/20 text-white' : 'bg-[#E8DCC8] text-[#3E2723]'
                }`}>
                  {allOccurrences.length}
                </span>
              </button>

              {variantGroups.map((group) => {
                const targetClean = cleanArabicVariantKeyWithVowels(selectedVariant || '');
                const groupClean = cleanArabicVariantKeyWithVowels(group.arabic || group.form);
                const isSelected = selectedVariant !== null && targetClean === groupClean;

                return (
                  <button
                    key={group.id}
                    onClick={() => setSelectedVariant(group.arabic || group.form)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#8B3A3A] to-[#D4A574] text-white shadow-md'
                        : 'bg-[#FAF6F1] text-[#3E2723] hover:bg-[#E8DCC8] border border-[#E8DCC8]/60'
                    }`}
                  >
                    <span className="font-arabic text-base" dir="rtl">{normalizeVocalizedArabic(group.arabic)}</span>
                    <span className="font-mono text-[11px] opacity-80">({group.transliteration || group.form})</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-[#E8DCC8] text-[#8B3A3A]'
                    }`}>
                      {group.occurrences.length}x
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Search input inside occurrences */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#795548] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search within occurrences by Surah name, verse number, or verse text..."
            className="w-full bg-white border border-[#E8DCC8] focus:border-[#D4A574] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#3E2723] focus:outline-none shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#795548] hover:text-[#3E2723] bg-[#E8DCC8] px-2 py-0.5 rounded-full"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area: Rendering Based on Mode */}
      <div className="max-w-4xl mx-auto space-y-4">
        {/* ================= MODE 1: BY VARIANT (DEFAULT) ================= */}
        {viewMode === 'variant' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#8B3A3A]" />
                <h2 className="text-lg font-bold text-[#8B3A3A]">
                  {selectedVariant ? (
                    <>
                      Verses containing variant <span className="font-arabic text-xl font-bold text-[#3E2723] mx-1" dir="rtl">{normalizeVocalizedArabic(selectedVariant)}</span>
                    </>
                  ) : (
                    'All Verse Occurrences by Variant'
                  )}
                </h2>
              </div>
              <span className="text-xs font-mono text-[#795548] font-bold bg-white px-2.5 py-1 rounded border border-[#E8DCC8]">
                Showing {activeVariantOccurrences.length} verse{activeVariantOccurrences.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* List of Verses for the Variant */}
            <div className="space-y-3">
              {activeVariantOccurrences.map((occ: any, idx: number) => (
                <div
                  key={`${occ.surah}_${occ.ayah}_${idx}`}
                  className="bg-white rounded-xl border-2 border-[#E8DCC8] p-5 shadow-xs hover:border-[#D4A574] hover:shadow-md transition-all group"
                >
                  {/* Reference Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8DCC8]/60 pb-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B3A3A] to-[#D4A574] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        {occ.surah}:{occ.ayah}
                      </div>
                      <div>
                        <h4 className="font-bold text-[#3E2723] text-base flex items-center gap-2">
                          <span>{occ.surahName}</span>
                          <span className="font-arabic text-[#795548] font-normal text-sm" dir="rtl">
                            ({occ.surahNameUr || `سورة ${occ.surah}`})
                          </span>
                        </h4>
                        <div className="text-xs text-[#795548] flex items-center gap-2">
                          <span>Surah {occ.surah} • Verse {occ.ayah}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {occ.variantForm && (
                        <span className="text-xs font-arabic font-bold bg-[#FAF6F1] text-[#8B3A3A] border border-[#E8DCC8] px-3 py-1 rounded-lg">
                          Form: {normalizeVocalizedArabic(occ.variantForm)}
                        </span>
                      )}
                      <span className="text-[11px] font-mono bg-[#FAF6F1] text-[#795548] border border-[#E8DCC8] px-2.5 py-1 rounded-lg">
                        {getWordMorphologySummary(occ.variantForm || word.arabic, word, occ).baab} • <span className="font-arabic text-[#8B3A3A] font-bold" dir="rtl">{getWordMorphologySummary(occ.variantForm || word.arabic, word, occ).wazan}</span>
                      </span>

                      {onSurahClick && (
                        <button
                          onClick={() => onSurahClick(occ.surah, occ.variantForm || selectedVariant || undefined)}
                          className="text-xs font-bold text-[#8B3A3A] hover:text-[#D4A574] flex items-center gap-1 bg-[#FAF6F1] hover:bg-[#E8DCC8] px-2.5 py-1 rounded-lg transition-colors"
                        >
                          <span>View Surah</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Verse Context with Highlight */}
                  <div className="bg-[#FAF6F1] rounded-xl p-4 border border-[#E8DCC8]/50 shadow-inner">
                    {renderOccurrenceVerse(occ)}
                  </div>
                </div>
              ))}

              {activeVariantOccurrences.length === 0 && (
                <div className="bg-white rounded-xl border-2 border-dashed border-[#E8DCC8] p-10 text-center">
                  <BookOpen className="w-12 h-12 text-[#D4A574] mx-auto mb-3" />
                  <p className="text-[#3E2723] font-bold text-base">No occurrences found for this selection</p>
                  <p className="text-xs text-[#795548] mt-1">Try selecting another variant or clearing search query.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= MODE 2: BY SURAH ================= */}
        {viewMode === 'surah' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#8B3A3A]" />
                <h2 className="text-lg font-bold text-[#8B3A3A]">
                  Occurrences Grouped by Surah
                  {selectedVariant && ` (${selectedVariant})`}
                </h2>
              </div>
              <span className="text-xs font-mono text-[#795548] font-bold bg-white px-2.5 py-1 rounded border border-[#E8DCC8]">
                {surahGroups.length} Surah{surahGroups.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-3">
              {surahGroups.map((group) => {
                const matchesSearch = !searchQuery.trim() ||
                  group.surahName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  group.surah.toString().includes(searchQuery) ||
                  group.occurrences.some(o => normalizeArabicText(o.context).includes(searchQuery));

                if (!matchesSearch) return null;

                return (
                  <div
                    key={group.surah}
                    className="bg-white rounded-xl border-2 border-[#E8DCC8] p-5 shadow-xs hover:border-[#D4A574] hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#8B3A3A]/10 to-[#D4A574]/15 border border-[#8B3A3A]/20 flex items-center justify-center">
                              <span className="text-xl font-bold text-[#8B3A3A]">{group.surah}</span>
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-[#3E2723] flex items-center gap-2">
                                <span>{group.surahName}</span>
                                <span className="font-arabic text-sm text-[#795548] font-normal" dir="rtl">
                                  ({group.surahNameUr || `سورة ${group.surah}`})
                                </span>
                              </h3>
                              <p className="text-xs text-[#795548] font-medium">
                                {group.count} occurrence{group.count !== 1 ? 's' : ''} in this Surah
                              </p>
                            </div>
                          </div>

                          {onSurahClick && (
                            <button
                              onClick={() => onSurahClick(group.surah, selectedVariant || undefined)}
                              className="px-3.5 py-2 rounded-lg bg-[#FAF6F1] hover:bg-gradient-to-r hover:from-[#8B3A3A] hover:to-[#D4A574] hover:text-white text-[#8B3A3A] text-xs font-bold transition-all flex items-center gap-1.5 border border-[#E8DCC8]"
                            >
                              <span>Explore Surah Verses</span>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Preview of first few verse contexts in this Surah */}
                        <div className="mt-3 pl-3 space-y-2 border-l-2 border-[#D4A574]/30">
                          {group.occurrences.slice(0, 4).map((occ, idx) => (
                            <div key={idx} className="bg-[#FAF6F1] p-3 rounded-lg border border-[#E8DCC8]/40">
                              <div className="flex justify-between items-center text-xs font-bold text-[#8B3A3A] mb-1">
                                <span>Verse {occ.ayah}</span>
                                {occ.variantForm && (
                                  <span className="font-arabic text-[11px] bg-white px-2 py-0.5 rounded border border-[#E8DCC8]">
                                    {normalizeVocalizedArabic(occ.variantForm)}
                                  </span>
                                )}
                              </div>
                              {renderOccurrenceVerse(occ)}
                            </div>
                          ))}

                          {group.occurrences.length > 4 && (
                            <p className="text-xs text-[#795548] font-bold italic pt-1">
                              + {group.occurrences.length - 4} more occurrence{group.occurrences.length - 4 !== 1 ? 's' : ''} in Surah {group.surahName}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {surahGroups.length === 0 && (
                <div className="bg-white rounded-xl border-2 border-dashed border-[#E8DCC8] p-10 text-center">
                  <MapPin className="w-12 h-12 text-[#D4A574] mx-auto mb-3" />
                  <p className="text-[#3E2723] font-bold text-base">No occurrences found in Surah view</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
