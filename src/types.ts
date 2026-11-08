/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type LearnedState = 'new' | 'learning' | 'known' | 'mastered' | 'review';

export type LanguageCode = 'en' | 'ur' | 'tr' | 'id' | 'hi' | 'ps';

export interface ContextTranslation {
  text: string;
  context?: {
    surah?: number;
    ayah?: number;
    note?: string;
  };
}

export interface Occurrence {
  surah: number;
  ayah: number;
  word?: number;
  wordStart?: number;
  wordEnd?: number;
  surahName: string;
  surahNameUr?: string;
  context: string;
  variantForm?: string;
  surface?: string;
  wordText?: string;
  lemmas?: string;
  lemma?: string;
  roots?: string;
  root?: string;
  patternCode?: string;
}

export interface Word {
  id: string;
  arabic: string;
  transliteration: string;
  root: string;
  lemma?: string;
  baab?: string;
  wazan?: string;
  pos: string; // Noun, Verb, Particle, Pronoun, etc.
  posLabel?: string;
  frequency: number;
  uniqueVerseCount?: number;
  verseReferences?: string[];
  translations: Record<LanguageCode, ContextTranslation[]>;
  occurrences: Occurrence[];
  themes: string[]; // e.g., 'concept.virtue', 'spiritual.angel', 'people.prophet'
  learnedState: LearnedState;
  isCore: boolean; // Part of top 800 words
  formattedRoot?: string; // Formatted Arabic root letters
  grammarDetails?: {
    gender?: string;
    number?: string;
    derivedForm?: string;
    pattern?: string;
  };
  variants?: WordVariant[]; // Different forms of the same word (different harkat, irab, etc.)
}

export interface WordVariant {
  form: string; // Buckwalter transliteration of the variant
  arabic: string; // Arabic text of the variant
  frequency: number; // Frequency of this specific variant
  transliteration?: string; // Real phonetic English transliteration
}

export interface Murakkab {
  id: string;
  arabic: string;
  transliteration: string;
  translations: Record<LanguageCode, ContextTranslation[]>;
  frequency: number;
  occurrences: Occurrence[];
  grammarNotes: Record<LanguageCode, ContextTranslation[]>;
  learnedState: LearnedState;
  themes: string[];
  variants?: WordVariant[];
  scope?: string;
  n?: number;
  isHapax?: boolean;
  surahDistribution?: any[];
}

export interface AyahStatistics {
  total_tokens?: number;
  unique_surface_forms?: number;
  unique_lemmas?: number;
  unique_roots?: number;
  type_token_ratio?: number;
  verb_count?: number;
  verb_pct?: number;
  noun_count?: number;
  adjective_count?: number;
  case_distribution?: Record<string, number>;
  roots_present?: string[];
  lemmas_present?: string[];
}

export interface Ayah {
  id: string; // e.g. "1:1"
  surah: number;
  ayahNum: number;
  surahName: string;
  surahNameArabic: string;
  surahNameUrdu: string;
  surahEnglishMeaning?: string;
  arabicText: string;
  transliteration: string;
  juz?: number;
  hizb?: number;
  hizbQuarter?: number;
  manzil?: number;
  sajda?: boolean;
  statistics?: AyahStatistics;
  translations: Record<LanguageCode, ContextTranslation[]>;
  wordIds: string[]; // IDs of words in this ayah
  phraseIds: string[]; // IDs of phrases in this ayah
  themes: string[];
  revelationPeriod: 'Meccan' | 'Medinan';
  revelationOrder?: number;
  learnedState: LearnedState;
}

export interface Surah {
  number: number;
  nameArabic: string;
  nameEnglish: string;
  verses: number;
  meaning: string;
  revelationPlace: 'Meccan' | 'Medinan';
  revelationOrder: number;
}

export interface FilterState {
  selectedSurahs: number[];
  selectedThemes: string[];
  selectedPOS: string[];
  selectedProgress: LearnedState[];
  selectedCore: 'all' | 'core' | 'non-core';
  selectedBaab?: number[];
  rootQuery?: string;
  searchQuery: string;
  sortBy: 'frequency-desc' | 'frequency-asc' | 'id-asc' | 'alphabetic-arabic';
}

export interface TranslationResource {
  direction: 'ltr' | 'rtl';
  name: string;
  translations: Record<string, string>;
}
