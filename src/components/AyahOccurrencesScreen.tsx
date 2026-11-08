/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Word, Murakkab, Ayah, LanguageCode } from '../types';
import { ArrowLeft, BookOpen, MapPin, ChevronRight } from 'lucide-react';
import { loadAyahsBySurah } from '../lib/dataLoader';
import {
  normalizeArabicText,
  normalizeVocalizedArabic,
  getTranslationText,
  cleanArabicVariantKey,
  getHighlightedPhraseWordIndices,
  getHighlightedWordIndices,
  getWordMorphologySummary
} from '../lib/quranUtils';

interface AyahOccurrencesScreenProps {
  word?: Word;
  phrase?: Murakkab;
  surah: number;
  variantForm?: string;
  lang: string;
  onBack: () => void;
}

export function AyahOccurrencesScreen({ word, phrase, surah, variantForm, lang, onBack }: AyahOccurrencesScreenProps) {
  const item = word || phrase;
  if (!item) return null;

  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchAyahs() {
      setLoading(true);
      setError(null);
      try {
        const data = await loadAyahsBySurah(surah);
        if (active) {
          setAyahs(data);
        }
      } catch (err) {
        console.error('Error fetching ayahs for surah:', surah, err);
        if (active) {
          setError('Failed to load full verse texts.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    fetchAyahs();
    return () => {
      active = false;
    };
  }, [surah]);

  // Filter occurrences by surah and optionally by variant
  const filteredOccurrences = (item.occurrences || [])
    .filter((occ: any) => occ.surah === surah)
    .filter((occ: any) => {
      if (!variantForm) return true;
      const targetClean = cleanArabicVariantKey(variantForm);
      if (occ.variantForm) {
        return cleanArabicVariantKey(occ.variantForm) === targetClean;
      }
      return cleanArabicVariantKey(occ.context || '').includes(targetClean);
    })
    .sort((a: any, b: any) => a.ayah - b.ayah);

  const surahName = filteredOccurrences[0]?.surahName || `Surah ${surah}`;

  return (
    <div className="bg-gradient-to-br from-[#FAF6F1] via-white to-[#F7F2EB] min-h-full p-4 sm:p-6 pb-32">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[#8B3A3A] hover:text-[#D4A574] transition-colors mb-4 font-bold text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Occurrences List</span>
        </button>

        <div className="bg-gradient-to-r from-[#8B3A3A] to-[#D4A574] rounded-xl p-6 shadow-lg text-white">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-1">{surahName}</h1>
              <div className="flex items-center gap-4 text-sm opacity-90">
                <span>Surah {surah}</span>
                <span>•</span>
                <span>{filteredOccurrences.length} occurrence{filteredOccurrences.length !== 1 ? 's' : ''}</span>
                {variantForm && (
                  <>
                    <span>•</span>
                    <span className="font-arabic">{normalizeVocalizedArabic(variantForm)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Item Info Card */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="bg-white rounded-xl border border-[#E8DCC8] p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-3xl font-bold font-arabic text-[#3E2723]" dir="rtl">
              {normalizeVocalizedArabic(item?.arabic || '')}
            </div>
            <div className="flex-1">
              <div className="text-sm text-[#795548] font-mono font-bold">{item.transliteration}</div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#795548] mt-1">
                {'root' in item ? (
                  <>
                    <span>Root: <strong className="font-arabic text-[#3E2723]">{(item as any).formattedRoot || (item as any).root || getWordMorphologySummary(item.arabic, item).root}</strong></span>
                    <span>•</span>
                    <span>Baab: <strong className="text-[#8B3A3A]">{getWordMorphologySummary(item.arabic, item).baab}</strong></span>
                    <span>•</span>
                    <span>Wazan: <strong className="font-arabic text-[#8B3A3A]" dir="rtl">{getWordMorphologySummary(item.arabic, item).wazan}</strong></span>
                  </>
                ) : (
                  <span>Scope: {(item as Murakkab).scope || 'Murakkab'}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ayah Occurrences */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-[#8B3A3A]" />
          <h2 className="text-xl font-bold text-[#8B3A3A]">Verse Occurrences</h2>
        </div>

        <div className="space-y-4">
          {filteredOccurrences.map((occ: any, idx: number) => {
            const fullAyah = ayahs.find((a) => a.ayahNum === occ.ayah);
            const wordSegments = fullAyah ? normalizeArabicText(fullAyah.arabicText).split(/\s+/) : [];
            const highlightedIndices = phrase
              ? getHighlightedPhraseWordIndices(wordSegments, occ, phrase.arabic || '', variantForm)
              : getHighlightedWordIndices(wordSegments, occ, word?.arabic || item?.arabic || '', variantForm, word);

            return (
              <div
                key={idx}
                className="bg-white rounded-xl border-2 border-[#E8DCC8] p-6 shadow-sm hover:border-[#D4A574] hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#8B3A3A] to-[#D4A574] flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-white">{occ.ayah}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-bold text-[#8B3A3A]">Verse {occ.ayah}</span>
                      {occ.variantForm && (
                        <span className="text-xs font-arabic bg-[#E8DCC8] px-2 py-1 rounded text-[#795548]" dir="rtl">
                          {normalizeVocalizedArabic(occ.variantForm)}
                        </span>
                      )}
                    </div>
                    
                    <div className="bg-[#FAF6F1] rounded-lg p-5 border border-[#E8DCC8]/50 shadow-inner">
                      {loading ? (
                        <div className="py-4 text-center">
                          <div className="w-8 h-8 border-3 border-[#D4A574] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                          <p className="text-xs text-[#795548]">Loading full verse...</p>
                        </div>
                      ) : fullAyah ? (
                        <div className="space-y-4">
                          {/* Verse text with highlighted matched word segments */}
                          <div className="text-right leading-loose font-arabic text-2xl text-[#3E2723]" style={{ direction: 'rtl' }}>
                            <div className="flex flex-wrap justify-start gap-x-2 gap-y-3">
                              {wordSegments.map((seg, sIdx) => {
                                const highlight = highlightedIndices.has(sIdx);
                                return (
                                  <span
                                    key={sIdx}
                                    className={`inline-block px-1 rounded transition-all duration-150 select-text ${
                                      highlight
                                        ? 'bg-[#8B3A3A]/10 text-[#8B3A3A] font-extrabold border-b-2 border-[#8B3A3A]/65 scale-105 shadow-sm px-1.5'
                                        : 'text-[#3E2723]/95 hover:bg-stone-100'
                                    }`}
                                    title={highlight ? "Matched occurrence" : undefined}
                                  >
                                    {seg}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          {/* Translation */}
                          <div className="pt-3 border-t border-[#E8DCC8]/30 text-left">
                            <p className="font-serif-eng text-[#3E2723] text-sm italic leading-relaxed">
                              {getTranslationText(fullAyah.translations, lang)}
                            </p>
                            {lang !== 'en' && getTranslationText(fullAyah.translations, 'en') && (
                              <p className="font-serif-eng text-[#795548] text-xs italic mt-1 leading-relaxed">
                                EN: {getTranslationText(fullAyah.translations, 'en')}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Fallback: show the context if loading failed */
                        <div>
                          <p className="text-2xl font-arabic text-[#3E2723] text-right leading-loose" dir="rtl">
                            {normalizeArabicText(occ.context)}
                          </p>
                          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredOccurrences.length === 0 && (
          <div className="bg-white rounded-xl border-2 border-dashed border-[#E8DCC8] p-10 text-center">
            <MapPin className="w-12 h-12 text-[#D4A574] mx-auto mb-3" />
            <p className="text-[#795548] font-bold">No occurrences found in this surah</p>
          </div>
        )}
      </div>
    </div>
  );
}

