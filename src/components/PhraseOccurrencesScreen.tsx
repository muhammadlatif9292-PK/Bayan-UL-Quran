/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { Murakkab, Occurrence } from '../types';
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
  ExternalLink,
  NotebookPen
} from 'lucide-react';
import { 
  normalizeArabicText, 
  normalizeVocalizedArabic,
  cleanArabicVariantKey,
  cleanArabicVariantKeyWithVowels, 
  consolidatePhraseVariants,
  getTranslationText,
  getGrammarNoteText,
  getHighlightedPhraseWordIndices,
  getWordMorphologySummary
} from '../lib/quranUtils';
import { removeDiacritics } from '../lib/arabicMorphology';
import { toArabicIfNeeded } from '../lib/buckwalterConverter';
import { loadAyahsBySurah } from '../lib/dataLoader';

interface PhraseOccurrencesScreenProps {
  phrase: Murakkab;
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

export function PhraseOccurrencesScreen({
  phrase,
  lang,
  initialVariant = null,
  initialViewMode = 'variant',
  onBack,
  onSurahClick
}: PhraseOccurrencesScreenProps) {
  const [viewMode, setViewMode] = useState<'variant' | 'surah'>(initialViewMode);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(initialVariant);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const allOccurrences = phrase.occurrences || [];

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

  // Group occurrences cleanly by phrase variants
  const variantGroups = useMemo<VariantGroup[]>(() => {
    const cleanedVariants = consolidatePhraseVariants(phrase);

    if (cleanedVariants.length === 0) {
      cleanedVariants.push({
        arabic: phrase.arabic,
        form: phrase.transliteration || 'Primary Form',
        transliteration: phrase.transliteration || '',
        frequency: allOccurrences.length || 1
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
    allOccurrences.forEach((occ: any) => {
      const rawOccForm = occ.variantForm || occ.surface || '';
      const occVariantClean = rawOccForm ? cleanArabicVariantKeyWithVowels(rawOccForm) : null;
      const occVariantBase = rawOccForm ? cleanArabicVariantKey(rawOccForm) : null;

      let bestIdx = -1;

      if (occVariantClean) {
        bestIdx = variantList.findIndex(g => g.cleanKey === occVariantClean);
      }

      if (bestIdx === -1 && occVariantBase) {
        bestIdx = variantList.findIndex(g => g.baseKey === occVariantBase);
      }

      if (bestIdx !== -1) {
        variantList[bestIdx].occurrences.push(occ);
      } else if (variantList.length > 0) {
        variantList[0].occurrences.push(occ);
      }
    });

    return variantList;
  }, [phrase, allOccurrences]);

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
      const highlightedIndices = getHighlightedPhraseWordIndices(
        wordSegments,
        occ,
        phrase.arabic || '',
        selectedVariant
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
    
    // Fallback: contiguous phrase highlighting on the context/surface snippet
    const tokens = normalizeArabicText(occ.context || occ.surface || '').split(/\s+/);
    const fallbackHighlightedIndices = getHighlightedPhraseWordIndices(
      tokens,
      { ...occ, wordStart: undefined, wordEnd: undefined },
      phrase.arabic || '',
      selectedVariant
    );
    
    return (
      <div className="flex flex-wrap justify-start gap-x-2 gap-y-2 text-right font-arabic text-xl sm:text-2xl leading-relaxed text-[#3E2723]" dir="rtl">
        {tokens.map((token: string, idx: number) => {
          const isMatch = fallbackHighlightedIndices.has(idx);
          
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

  // Group occurrences by Surah
  const surahGroups = useMemo<SurahOccurrenceGroup[]>(() => {
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
          return cleanArabicVariantKeyWithVowels(occ.context || occ.surface || '').includes(targetClean);
        });
      }
    }

    const map = new Map<number, SurahOccurrenceGroup>();

    occurrencesPool.forEach((occ) => {
      const sNum = occ.surah;
      if (!map.has(sNum)) {
        map.set(sNum, {
          surah: sNum,
          surahName: occ.surahName || `Surah ${sNum}`,
          surahNameUr: occ.surahNameUr,
          count: 0,
          occurrences: []
        });
      }
      const entry = map.get(sNum)!;
      entry.count += 1;
      entry.occurrences.push(occ);
    });

    return Array.from(map.values()).sort((a, b) => a.surah - b.surah);
  }, [allOccurrences, selectedVariant, variantGroups]);

  // Filtered occurrences list based on current variant and search query
  const filteredOccurrences = useMemo<Occurrence[]>(() => {
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
          return cleanArabicVariantKeyWithVowels(occ.context || occ.surface || '').includes(targetClean);
        });
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const qClean = removeDiacritics(q);
      return list.filter((occ) => {
        const textClean = removeDiacritics(occ.context || occ.surface || '');
        const surahMatch = occ.surahName.toLowerCase().includes(q) || String(occ.surah) === q;
        const ayahMatch = String(occ.ayah) === q;
        return textClean.includes(qClean) || surahMatch || ayahMatch;
      });
    }

    return list;
  }, [allOccurrences, selectedVariant, variantGroups, searchQuery]);

  const mainTranslation = getTranslationText(phrase.translations, lang);
  const englishTranslation = getTranslationText(phrase.translations, 'en');
  const grammarNote = getGrammarNoteText(phrase.grammarNotes, lang);

  return (
    <div className="bg-gradient-to-br from-[#FAF6F1] via-white to-[#F7F2EB] min-h-full p-4 sm:p-6 pb-32">
      {/* Top Header & Back Navigation */}
      <div className="max-w-4xl mx-auto mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[#E8DCC8] bg-white text-[#3E2723] hover:bg-[#FAF6F1] text-xs font-bold transition-all shadow-sm mb-4"
        >
          <ArrowLeft className="w-4 h-4 text-[#8B3A3A]" />
          <span>Back to Phrase List</span>
        </button>

        {/* Hero Phrase Details Card */}
        <div className="bg-white border-2 border-[#E8DCC8] rounded-2xl p-5 sm:p-6 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4A574]/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E8DCC8]/60 pb-4 mb-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-[#8B3A3A] uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5 text-[#D4A574]" />
                <span>Compound Phrase / Murakkab</span>
                {phrase.scope && (
                  <span className="bg-[#FAF6F1] px-2 py-0.5 rounded border border-[#E8DCC8] text-[10px] text-[#795548]">
                    {phrase.scope}
                  </span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold font-arabic text-[#3E2723] leading-relaxed" dir="rtl">
                {normalizeVocalizedArabic(phrase.arabic)}
              </h1>
              <p className="text-base font-bold text-[#8B3A3A] mt-1 font-serif-eng">
                {phrase.transliteration}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
              <div className="bg-[#FAF6F1] border border-[#E8DCC8] px-3 py-1.5 rounded-xl text-center">
                <div className="text-[10px] font-mono text-[#795548] uppercase">Total Occurrences</div>
                <div className="text-lg font-extrabold text-[#8B3A3A] font-mono">
                  {phrase.frequency || allOccurrences.length}
                </div>
              </div>
              {phrase.n && (
                <div className="bg-[#FAF6F1] border border-[#E8DCC8] px-3 py-1.5 rounded-xl text-center">
                  <div className="text-[10px] font-mono text-[#795548] uppercase">Words</div>
                  <div className="text-lg font-extrabold text-[#3E2723] font-mono">
                    {phrase.n}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Meaning & Translations */}
          <div className="space-y-3 text-sm">
            <div className="bg-[#FAF6F1] p-3.5 rounded-xl border border-[#E8DCC8]/70">
              <span className="text-[10px] font-bold uppercase text-[#8B3A3A] font-mono block mb-1">
                Meaning ({lang.toUpperCase()})
              </span>
              <p className="text-slate-800 font-serif-eng text-base font-medium leading-relaxed">
                {mainTranslation || 'Meaning not available'}
              </p>
              {lang !== 'en' && englishTranslation && (
                <p className="text-slate-600 font-serif-eng text-xs italic mt-1 pt-1 border-t border-[#E8DCC8]/40">
                  English: {englishTranslation}
                </p>
              )}
            </div>

            {/* Syntactical I'rab & Grammar Notes */}
            {grammarNote && grammarNote !== 'No grammar notes available' && (
              <div className="bg-[#FAF6F1] p-3.5 rounded-xl border border-[#E8DCC8]/70">
                <span className="text-[10px] font-bold uppercase text-[#8B3A3A] font-mono flex items-center gap-1 mb-1">
                  <NotebookPen className="w-3.5 h-3.5 text-[#D4A574]" />
                  Syntactical I'rab / Tarakeeb Note
                </span>
                <p className="text-slate-700 font-serif-eng text-xs leading-relaxed italic">
                  {grammarNote}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Controls Bar: View Mode Switcher + Variant Selector */}
        <div className="bg-white border border-[#E8DCC8] rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[#E8DCC8]/60 pb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#8B3A3A]" />
              <span className="text-xs font-bold text-[#3E2723] uppercase tracking-wider font-mono">
                Occurrence Grouping
              </span>
            </div>

            <div className="bg-[#FAF6F1] border border-[#E8DCC8] p-1 rounded-xl flex items-center text-xs font-bold self-start sm:self-auto">
              <button
                onClick={() => setViewMode('variant')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === 'variant'
                    ? 'bg-[#8B3A3A] text-white shadow-sm'
                    : 'text-[#3E2723] hover:bg-[#E8DCC8]/50'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>By Variant ({variantGroups.length})</span>
              </button>
              <button
                onClick={() => setViewMode('surah')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === 'surah'
                    ? 'bg-[#8B3A3A] text-white shadow-sm'
                    : 'text-[#3E2723] hover:bg-[#E8DCC8]/50'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>By Surah ({surahGroups.length})</span>
              </button>
            </div>
          </div>

          {/* Variant Selector Tabs */}
          <div>
            <div className="flex items-center justify-between text-xs text-[#795548] font-bold mb-2">
              <span className="uppercase text-[10px] font-mono">Select Phrase Form Variant:</span>
              <span>{variantGroups.length} distinct form{variantGroups.length > 1 ? 's' : ''} found</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedVariant(null)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedVariant === null
                    ? 'bg-[#8B3A3A] text-white border-[#8B3A3A] shadow-sm'
                    : 'bg-[#FAF6F1] text-[#3E2723] border-[#E8DCC8] hover:border-[#8B3A3A]'
                }`}
              >
                <span>All Forms</span>
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono ${
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
                    onClick={() => setSelectedVariant(isSelected ? null : (group.arabic || group.form))}
                    className={`px-3 py-1.5 rounded-xl border text-xs transition-all flex items-center gap-2 ${
                      isSelected
                        ? 'bg-[#8B3A3A] text-white border-[#8B3A3A] shadow-sm'
                        : 'bg-white text-[#3E2723] border-[#E8DCC8] hover:border-[#8B3A3A] hover:bg-[#FAF6F1]'
                    }`}
                  >
                    <span className="font-arabic font-bold text-sm leading-none" dir="rtl">
                      {normalizeVocalizedArabic(group.arabic)}
                    </span>
                    {group.transliteration && (
                      <span className={`text-[10px] italic ${isSelected ? 'text-amber-100' : 'text-[#795548]'}`}>
                        ({group.transliteration})
                      </span>
                    )}
                    <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[#FAF6F1] text-[#8B3A3A] border border-[#E8DCC8]'
                    }`}>
                      {group.occurrences.length || group.frequency}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Box inside occurrences screen */}
          <div className="relative pt-1">
            <Search className="w-4 h-4 text-[#795548] absolute left-3 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in verse text or surah name..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF6F1] border border-[#E8DCC8] rounded-xl text-[#3E2723] placeholder-[#795548]/60 focus:outline-none focus:border-[#8B3A3A]"
            />
          </div>
        </div>

        {/* DISPLAY MODE 1: BY VARIANT */}
        {viewMode === 'variant' && (
          <div className="space-y-4">
            {filteredOccurrences.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[#795548] px-1 font-bold">
                  <span>Showing {filteredOccurrences.length} occurrence{filteredOccurrences.length > 1 ? 's' : ''}</span>
                  {selectedVariant && (
                    <span className="text-[#8B3A3A] font-semibold">
                      Filtered by variant: {selectedVariant}
                    </span>
                  )}
                </div>

                {filteredOccurrences.map((occ, idx) => (
                  <div
                    key={idx}
                    className="bg-white border-2 border-[#E8DCC8] rounded-2xl p-5 shadow-sm hover:border-[#D4A574] hover:shadow-md transition-all group"
                  >
                    <div className="flex flex-wrap items-center justify-between border-b border-[#E8DCC8]/50 pb-3 mb-4 gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-[#FAF6F1] border border-[#E8DCC8] flex items-center justify-center text-xs font-mono font-bold text-[#8B3A3A] shadow-xs">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="text-xs font-extrabold text-[#3E2723]">
                            Surah {occ.surahName} ({occ.surah})
                          </span>
                          <span className="text-xs text-[#795548] font-mono ml-2">• Ayah {occ.ayah}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {Array.isArray(occ.roots) && occ.roots.some((r: string) => r && r !== '-') && (
                          <span className="text-[10px] font-arabic font-bold bg-[#FAF6F1] text-[#3E2723] border border-[#E8DCC8] px-2.5 py-0.5 rounded-lg" dir="rtl">
                            Roots: {occ.roots.filter((r: string) => r && r !== '-').map((r: string) => toArabicIfNeeded(r)).join(' • ')}
                          </span>
                        )}
                        {occ.variantForm && (
                          <span className="text-[10px] font-arabic font-bold bg-[#FAF6F1] text-[#8B3A3A] border border-[#E8DCC8] px-2.5 py-0.5 rounded-lg">
                            Form: {normalizeVocalizedArabic(occ.variantForm)}
                          </span>
                        )}
                        {onSurahClick && (
                          <button
                            onClick={() => onSurahClick(occ.surah, occ.variantForm || selectedVariant || undefined)}
                            className="text-xs font-bold text-[#8B3A3A] hover:text-[#D4A574] flex items-center gap-1 bg-[#FAF6F1] hover:bg-[#E8DCC8] px-2.5 py-1 rounded-lg transition-colors border border-[#E8DCC8]/50"
                          >
                            <span>Explore Surah</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Verse Context Display with Highlight & Translations */}
                    <div className="bg-[#FAF6F1] p-4 rounded-xl border border-[#E8DCC8]/50 shadow-inner">
                      {renderOccurrenceVerse(occ)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-[#E8DCC8] rounded-2xl p-8 text-center text-[#795548]">
                <p className="font-bold text-sm text-[#3E2723]">No occurrences found matching your search query.</p>
                <p className="text-xs mt-1">Try clearing the search filter or selecting a different phrase variant.</p>
              </div>
            )}
          </div>
        )}

        {/* DISPLAY MODE 2: BY SURAH */}
        {viewMode === 'surah' && (
          <div className="space-y-4">
            {surahGroups.length > 0 ? (
              surahGroups.map((sGroup) => (
                <div
                  key={sGroup.surah}
                  className="bg-white border-2 border-[#E8DCC8] rounded-2xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-[#E8DCC8] pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#FAF6F1] border border-[#E8DCC8] flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-[#8B3A3A]" />
                      </div>
                      <div>
                        <span className="text-sm font-extrabold text-[#3E2723]">
                          Surah {sGroup.surahName} ({sGroup.surah})
                        </span>
                        <p className="text-[11px] text-[#795548] font-mono">
                          {sGroup.count} occurrence{sGroup.count !== 1 ? 's' : ''} in this Surah
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => onSurahClick && onSurahClick(sGroup.surah, selectedVariant || undefined)}
                      className="px-3.5 py-1.5 bg-[#FAF6F1] border border-[#E8DCC8] rounded-lg text-xs font-bold text-[#8B3A3A] hover:bg-[#8B3A3A] hover:text-white transition-all flex items-center gap-1"
                    >
                      <span>Study All {sGroup.count} Verses</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-3 pl-2 border-l-2 border-[#D4A574]/30">
                    {sGroup.occurrences.map((occ, oIdx) => (
                      <div
                        key={oIdx}
                        className="bg-[#FAF6F1] p-4 rounded-xl border border-[#E8DCC8]/50 hover:border-[#D4A574]/40 transition-all"
                      >
                        <div className="flex justify-between items-center text-[10px] text-[#795548] font-bold font-mono mb-2">
                          <span>Verse {occ.surah}:{occ.ayah}</span>
                          {occ.variantForm && (
                            <span className="font-arabic text-[10px] bg-white px-2 py-0.5 rounded border border-[#E8DCC8] text-[#8B3A3A]">
                              {normalizeVocalizedArabic(occ.variantForm)}
                            </span>
                          )}
                        </div>
                        {renderOccurrenceVerse(occ)}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white border border-[#E8DCC8] rounded-2xl p-8 text-center text-[#795548]">
                <p className="font-bold text-sm text-[#3E2723]">No Surah occurrences found.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
