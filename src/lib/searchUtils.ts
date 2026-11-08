/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Word, Murakkab, Ayah, LanguageCode, ContextTranslation } from '../types';
import { isWholeArabicWordMatch, normalizeTokenForMatch } from './quranUtils';
import {
  tokenizeArabicMorphology,
  areRootsCompatible,
  normalizeRootString
} from './arabicMorphology';

/**
 * Extract text from ContextTranslation array
 */
function getTranslationText(translations: ContextTranslation[] | undefined): string {
  if (!translations || translations.length === 0) return '';
  return translations[0]?.text || '';
}

/**
 * Normalize Arabic text by removing diacritics and extra spaces
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove diacritics
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize transliteration by removing vowels and special characters
 * This helps match different transliteration styles
 */
export function normalizeTransliteration(text: string): string {
  return text
    .toLowerCase()
    .replace(/[āáâàä]/g, 'a')
    .replace(/[ēéêèë]/g, 'e')
    .replace(/[īíîìï]/g, 'i')
    .replace(/[ōóôòö]/g, 'o')
    .replace(/[ūúûùü]/g, 'u')
    .replace(/[ʿʔ]/g, '')
    .replace(/[-\s,._]/g, '')
    .trim();
}

/**
 * Parse root pattern from search query
 * Handles formats like: r-k-b, rkb, r k b, ر-ك-ب, etc.
 */
export function parseRootPattern(query: string): string | null {
  // Check if it looks like a root pattern (2-4 characters with separators)
  const cleaned = query.replace(/[\s,._-]/g, '');

  // Arabic root pattern (3-4 Arabic characters)
  if (/^[\u0600-\u06FF]{3,4}$/.test(cleaned)) {
    return cleaned;
  }

  // Transliteration root pattern (2-4 Latin characters)
  if (/^[a-zA-Z]{2,4}$/.test(cleaned)) {
    return cleaned.toLowerCase();
  }

  return null;
}

/**
 * Check if a word's root matches the search pattern
 */
export function matchesRoot(wordRoot: string, searchPattern: string): boolean {
  if (/[\u0600-\u06FF]/.test(searchPattern)) {
    const normWord = normalizeRootString(wordRoot);
    const normSearch = normalizeRootString(searchPattern);
    if (normWord && normSearch) {
      return areRootsCompatible(normWord, normSearch);
    }
  }

  const normalizedWordRoot = normalizeTransliteration(wordRoot).replace(/[\s,._-]/g, '');
  const normalizedSearchPattern = normalizeTransliteration(searchPattern).replace(/[\s,._-]/g, '');

  return (
    normalizedWordRoot === normalizedSearchPattern ||
    normalizedWordRoot.includes(normalizedSearchPattern)
  );
}

/**
 * Check if text matches query with fuzzy matching
 */
export function matchesText(text: string, query: string, fuzzy: boolean = false): boolean {
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();

  if (!fuzzy) {
    return normalizedText.includes(normalizedQuery);
  }

  // Fuzzy matching for transliterations
  const normalizedTextClean = normalizeTransliteration(text);
  const normalizedQueryClean = normalizeTransliteration(query);

  return (
    normalizedTextClean.includes(normalizedQueryClean) ||
    normalizedQueryClean.includes(normalizedTextClean)
  );
}

/**
 * Check if an Arabic query matches a word or phrase using morphological tokenization
 * and grammatical filtering (Root, Baab, and Wazan).
 */
export function matchesArabicMorphologically(
  targetArabic: string,
  queryArabic: string,
  wordMeta?: Partial<Word>
): boolean {
  if (!targetArabic || !queryArabic) return false;

  const queryTokens = queryArabic
    .trim()
    .split(/\s+/)
    .filter(t => normalizeTokenForMatch(t, false).length > 0);
  const targetTokens = targetArabic
    .trim()
    .split(/\s+/)
    .filter(t => normalizeTokenForMatch(t, false).length > 0);

  if (queryTokens.length === 0 || targetTokens.length === 0) return false;

  const constraint = wordMeta
    ? {
        expectedRoot: wordMeta.root,
        expectedLemma: wordMeta.lemma,
        expectedBaab: wordMeta.grammarDetails?.derivedForm,
        expectedWazan: wordMeta.grammarDetails?.pattern,
        expectedPos: wordMeta.pos
      }
    : undefined;

  // Single-word Arabic query: require whole-word morphological match (no substring false positives)
  if (queryTokens.length === 1) {
    const qTok = queryTokens[0];
    return targetTokens.some(
      tTok =>
        isWholeArabicWordMatch(tTok, qTok, false, constraint) ||
        isWholeArabicWordMatch(tTok, qTok, true, constraint)
    );
  }

  // Multi-word Arabic query: require contiguous sequence of whole-word morphological matches
  for (let start = 0; start <= targetTokens.length - queryTokens.length; start++) {
    let allMatch = true;
    for (let i = 0; i < queryTokens.length; i++) {
      if (
        !isWholeArabicWordMatch(targetTokens[start + i], queryTokens[i], i === 0, constraint)
      ) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return true;
  }

  return false;
}

/**
 * Search words by query with morphological tokenization, grammatical filtering, and root support
 */
export function searchWords(words: Word[], query: string, language: LanguageCode): Word[] {
  if (!query || query.trim() === '') return words;

  const trimmed = query.trim();
  const isArabicQuery = /[\u0600-\u06FF]/.test(trimmed);
  const rootPattern = parseRootPattern(trimmed);
  const queryMorph = isArabicQuery ? tokenizeArabicMorphology(trimmed) : null;

  return words.filter(word => {
    if (isArabicQuery) {
      // 1. Whole-word morphological & grammatical match on main word or any variant
      if (matchesArabicMorphologically(word.arabic || '', trimmed, word)) return true;
      if (
        word.variants &&
        word.variants.some(v => matchesArabicMorphologically(v.arabic || v.form || '', trimmed, word))
      ) {
        return true;
      }

      // 2. Explicit root query (e.g. "ر-أ-ي" or "ف ر ي")
      if (
        word.root &&
        /[\s,._-]/.test(trimmed) &&
        areRootsCompatible(word.root, trimmed)
      ) {
        return true;
      }

      // 3. Same root + same Baab match
      if (
        queryMorph &&
        queryMorph.root &&
        queryMorph.root !== 'N/A' &&
        word.root &&
        areRootsCompatible(word.root, queryMorph.root)
      ) {
        const wordMorph = tokenizeArabicMorphology(word.arabic, {
          expectedRoot: word.root,
          expectedBaab: word.grammarDetails?.derivedForm,
          expectedWazan: word.grammarDetails?.pattern
        });
        if (
          queryMorph.baabNumber === null ||
          wordMorph.baabNumber === null ||
          queryMorph.baabNumber === wordMorph.baabNumber
        ) {
          return true;
        }
      }

      return false;
    }

    // Non-Arabic query: transliteration, translation, or Latin root
    if (matchesText(word.transliteration, trimmed, true)) return true;
    if (matchesText(getTranslationText(word.translations[language]), trimmed)) return true;
    if (matchesText(getTranslationText(word.translations.en), trimmed)) return true;

    if (rootPattern && word.root && matchesRoot(word.root, rootPattern)) return true;
    if (word.root && matchesText(word.root, trimmed)) return true;

    return false;
  });
}

/**
 * Search phrases (murakkabat) by query with morphological tokenization and multilingual support
 */
export function searchPhrases(phrases: Murakkab[], query: string, language: LanguageCode): Murakkab[] {
  if (!query || query.trim() === '') return phrases;

  const trimmed = query.trim();
  const isArabicQuery = /[\u0600-\u06FF]/.test(trimmed);

  return phrases.filter(phrase => {
    if (isArabicQuery) {
      if (matchesArabicMorphologically(phrase.arabic || '', trimmed)) return true;
      if (
        phrase.variants &&
        phrase.variants.some(v => matchesArabicMorphologically(v.arabic || v.form || '', trimmed))
      ) {
        return true;
      }
      return false;
    }

    // Check variants transliteration
    if (
      phrase.variants &&
      phrase.variants.some(v => matchesText(v.transliteration || '', trimmed, true))
    ) {
      return true;
    }

    // Check transliteration
    if (matchesText(phrase.transliteration, trimmed, true)) return true;

    // Check translation in selected language and fallback to English
    if (matchesText(getTranslationText(phrase.translations[language]), trimmed)) return true;
    if (matchesText(getTranslationText(phrase.translations.en), trimmed)) return true;

    // Check grammar notes in selected language
    if (phrase.grammarNotes && matchesText(getTranslationText(phrase.grammarNotes[language]), trimmed)) return true;
    if (phrase.grammarNotes && matchesText(getTranslationText(phrase.grammarNotes.en), trimmed)) return true;

    return false;
  });
}

/**
 * Search ayahs by query with morphological tokenization and multilingual support
 */
export function searchAyahs(ayahs: Ayah[], query: string, language: LanguageCode): Ayah[] {
  if (!query || query.trim() === '') return ayahs;

  const trimmed = query.trim();
  const isArabicQuery = /[\u0600-\u06FF]/.test(trimmed);

  return ayahs.filter(ayah => {
    if (isArabicQuery) {
      if (matchesArabicMorphologically(ayah.arabicText, trimmed)) return true;
      if (matchesText(ayah.surahNameArabic, trimmed)) return true;
      if (matchesText(ayah.surahNameUrdu, trimmed)) return true;
      return false;
    }

    // Check transliteration
    if (matchesText(ayah.transliteration, trimmed, true)) return true;

    // Check translation in selected language and fallback to English
    if (matchesText(getTranslationText(ayah.translations[language]), trimmed)) return true;
    if (matchesText(getTranslationText(ayah.translations.en), trimmed)) return true;

    // Check surah name or ayah id
    if (matchesText(ayah.id, trimmed)) return true;
    if (matchesText(ayah.surahName, trimmed)) return true;
    if (matchesText(ayah.surahNameArabic, trimmed)) return true;
    if (matchesText(ayah.surahNameUrdu, trimmed)) return true;

    return false;
  });
}

/**
 * Get search type hint based on query pattern
 */
export function getSearchTypeHint(query: string): string | null {
  if (!query) return null;

  const rootPattern = parseRootPattern(query);
  if (rootPattern) {
    return 'root';
  }

  // Check if it's Arabic
  if (/[\u0600-\u06FF]/.test(query)) {
    return 'arabic';
  }

  // Check if it's transliteration
  if (/^[a-zA-Z]/.test(query)) {
    return 'transliteration';
  }

  return null;
}
