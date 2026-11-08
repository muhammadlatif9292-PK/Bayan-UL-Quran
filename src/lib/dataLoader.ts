/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Word, Murakkab, Ayah, Occurrence, LanguageCode, LearnedState, ContextTranslation } from '../types';
import { toArabicIfNeeded, buckwalterToEnglish, formatRoot, isBuckwalter, transliterateArabicToEnglish } from './buckwalterConverter';
import { loadChapterTranslations } from './translationLoader';
import { consolidateWordVariants, consolidatePhraseVariants, normalizeVocalizedArabic, normalizeArabicText, cleanVariantTransliteration } from './quranUtils';

async function fetchWithFallback(url: string): Promise<Response> {
  try {
    const response = await fetch(url);
    if (response.ok) return response;
  } catch (e) {
    console.warn(`Direct fetch failed for ${url}:`, e);
  }

  if (url.startsWith('/')) {
    try {
      const relativeUrl = url.slice(1);
      const response = await fetch(relativeUrl);
      if (response.ok) return response;
    } catch (e) {
      console.warn(`Relative fetch failed for ${url}:`, e);
    }
  }

  try {
    const basePath = window.location.pathname.replace(/\/[^\/]*$/, '');
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    const subpathUrl = `${window.location.origin}${basePath}${cleanUrl}`;
    const response = await fetch(subpathUrl);
    if (response.ok) return response;
  } catch (e) {
    console.warn(`Subpath fetch failed for ${url}:`, e);
  }

  return fetch(url);
}

// Cache for loaded data chunks
const wordChunksCache = new Map<number, Word[]>();
const murakkabChunksCache = new Map<number, Murakkab[]>();
const ayahChunksCache = new Map<number, Ayah[]>();

// Cache for metadata
let wordsMetadata: any = null;
let murakkabMetadata: any = null;
let ayahsMetadata: any = null;

// Cache for all words
let cachedAllWords: Word[] | null = null;

// Cache for indexes
let wordsIndex: any[] = [];
let murakkabIndex: any[] = [];
let ayahsIndex: any[] = [];

// Cache for Quran Arabic text data
let quranArabicData: any[] = [];
let quranArabicLoaded = false;

// Cache for translation data
let translationData: any = null;
let translationDataLoaded = false;

/**
 * Load translation data for all languages
 */
async function loadTranslationData(): Promise<any> {
  if (translationDataLoaded && translationData) {
    return translationData;
  }
  
  try {
    const languages = ['en', 'ur', 'tr', 'id', 'bn', 'es', 'fr', 'ru', 'sv', 'zh'];
    const translations: any = {};
    
    for (const lang of languages) {
      try {
        const data = await loadChapterTranslations(lang);
        translations[lang] = data;
      } catch (error) {
        console.warn(`Failed to load ${lang} translations`);
        translations[lang] = [];
      }
    }
    
    translationData = translations;
    translationDataLoaded = true;
    return translations;
  } catch (error) {
    console.error('Error loading translation data:', error);
    return {};
  }
}

export function cleanTransliteration(text: string): string {
  if (!text) return '';
  if (isBuckwalter(text)) {
    return buckwalterToEnglish(text);
  }
  // Check if there is a pipe separator
  if (text.includes('|')) {
    const parts = text.split('|');
    const firstPart = parts[0].trim();
    if (firstPart) {
      // Remove any brackets from the first part just in case
      return firstPart.replace(/\[[^\]]*\]/g, '').trim();
    }
  }
  // Otherwise remove bracketed parts
  let cleaned = text.replace(/\[[^\]]*\]/g, '').trim();
  if (!cleaned) {
    // If the entire text was bracketed, like "[qaAla]" or "[>an]"
    // Strip the brackets and return the inside
    cleaned = text.replace(/[\[\]]/g, '').trim();
  }
  return cleaned;
}

/**
 * Clean up raw word translations by removing bracketed Buckwalter text
 * and formatting grammatical tags and roots beautifully.
 */
export function cleanWordTranslation(text: string, rootStr: string): string {
  if (!text) return '';
  // Strip any bracketed part like "[{ll~ah]" or "[Ea*aAb]"
  let cleaned = text.replace(/\[[^\]]*\]/g, '').trim();
  
  // Clean up leading/trailing hyphens or pipes
  if (cleaned.startsWith('-')) {
    cleaned = cleaned.substring(1).trim();
  }
  if (cleaned.endsWith('-')) {
    cleaned = cleaned.substring(0, cleaned.length - 1).trim();
  }
  
  // Format the Root if it has "Root:" or "jadr:" or "kök:" etc.
  const lowerCleaned = cleaned.toLowerCase();
  if (lowerCleaned.includes('root:')) {
    const formatted = formatRoot(rootStr);
    return formatted ? `Root: ${formatted}` : cleaned;
  }
  if (lowerCleaned.includes('juz:') || lowerCleaned.includes('cüz:') || lowerCleaned.includes('part:')) {
    return cleaned; // Keep Juz references clean
  }
  if (lowerCleaned.includes('jadr:') || lowerCleaned.includes('juzr:') || lowerCleaned.includes('kök:') || lowerCleaned.includes('akar:') || lowerCleaned.includes('raíz:')) {
    const formatted = formatRoot(rootStr);
    const label = cleaned.split(':')[0].trim();
    return formatted ? `${label}: ${formatted}` : cleaned;
  }
  
  // Translate grammatical abbreviations to clean words
  const gramMap: Record<string, string> = {
    'word': 'Particle',
    'RES': 'Restrictive Particle',
    'SUB': 'Subordinating Conjunction',
    'COND': 'Conditional Particle',
    'ACC': 'Accusative Particle',
    'DEM': 'Demonstrative Pronoun',
    'PN': 'Proper Noun',
    'N': 'Noun',
    'V': 'Verb',
    'PRON': 'Pronoun',
    'LOC': 'Locative Adverb',
    'T': 'Time Adverb',
    'INTG': 'Interrogative Particle',
    'NEG': 'Negative Particle',
    'PREP': 'Preposition',
  };
  
  if (gramMap[cleaned]) {
    return gramMap[cleaned];
  }
  
  return cleaned;
}

/**
 * Transform raw word data into enriched Word objects
 * Maps basic data to the full Word interface with translations, themes, etc.
 */
function enrichWordData(rawWords: any[], totalFreq?: number): Word[] {
  // Generate core vocabulary indicator (top ~800 words by frequency cover ~91%)
  const sortedByFreq = [...rawWords].sort((a, b) => (b.frequency || 0) - (a.frequency || 0));
  const coreWordIds = new Set(sortedByFreq.slice(0, 800).map((w: any) => w.id));
  
  return rawWords.map((word: any, idx: number) => {
    const rawRoot = word.root || word.lemma || '';
    const rawArabicWord = word.arabic || word.arabic_uthmani || word.arabic_simple || toArabicIfNeeded(word.arabic || '');
    const arabicWord = normalizeVocalizedArabic(rawArabicWord);
    const computedTrans = transliterateArabicToEnglish(arabicWord);
    const translit = computedTrans || cleanTransliteration(word.transliteration || word.trans || '');
    const enrichedOccurrences = (word.occurrences || []).map((occ: any) => ({
      ...occ,
      context: occ.context ? normalizeArabicText(toArabicIfNeeded(occ.context)) : '',
      variantForm: occ.variantForm ? normalizeVocalizedArabic(toArabicIfNeeded(occ.variantForm)) : undefined
    }));
    
    return {
      id: word.id || `word_${idx}`,
      arabic: arabicWord,
      transliteration: translit,
      root: rawRoot,
      formattedRoot: formatRoot(rawRoot),
      pos: word.pos || word.posTag || word.dominant_pos || 'UNKNOWN',
      posLabel: word.posLabel || word.dominant_pos_label || '',
      frequency: word.frequency || word.total_occurrences || 1,
      uniqueVerseCount: word.uniqueVerseCount || word.unique_verse_count || 0,
      verseReferences: word.verseReferences || word.verse_references || [],
      translations: {
        en: [{ text: cleanWordTranslation(word.en || word.meaning || word.translation || word.translations?.en || '', rawRoot), context: { note: 'General meaning' } }],
        ur: [{ text: cleanWordTranslation(word.ur || word.translations?.ur || '', rawRoot), context: { note: 'General meaning' } }],
        tr: [{ text: cleanWordTranslation(word.tr || word.translations?.tr || '', rawRoot), context: { note: 'General meaning' } }],
        id: [{ text: cleanWordTranslation(word.id_lang || word.translations?.id || '', rawRoot), context: { note: 'General meaning' } }],
        hi: [{ text: cleanWordTranslation(word.hi || word.translations?.hi || '', rawRoot), context: { note: 'General meaning' } }],
        ps: [{ text: cleanWordTranslation(word.ps || word.translations?.ps || '', rawRoot), context: { note: 'General meaning' } }]
      },
      occurrences: enrichedOccurrences,
      themes: word.themes || word.categories || [],
      learnedState: 'new' as LearnedState,
      isCore: coreWordIds.has(word.id) || word.isCore || false,
      grammarDetails: {
        gender: word.gender || word.grammarDetails?.gender,
        number: word.number || word.grammarDetails?.number,
        derivedForm: word.derivedForm || word.grammarDetails?.derivedForm
      },
      variants: consolidateWordVariants(word.variants || [], arabicWord)
    };
  });
}

/**
 * Transform raw murakkab/phrase data into enriched Murakkab objects
 */
function enrichMurakkabData(rawMurakkabat: any[]): Murakkab[] {
  return rawMurakkabat.map((phrase: any, idx: number) => {
    // Prioritize authentic conversion from canonical Buckwalter ID if available to guarantee pristine Quranic accuracy
    let rawArabic = '';
    if (phrase.id && !/[\u0600-\u06FF]/.test(phrase.id)) {
      rawArabic = toArabicIfNeeded(phrase.id);
    } else {
      rawArabic = phrase.arabic || phrase.arabic_uthmani || phrase.arabic_simple || toArabicIfNeeded(phrase.arabic || '');
    }
    const cleanArabic = normalizeVocalizedArabic(rawArabic);
    const transliterationStr = cleanVariantTransliteration(cleanArabic, phrase.transliteration || phrase.trans || phrase.id);

    const enrichedOccurrences = (phrase.occurrences || []).map((occ: any) => {
      const surfaceAr = normalizeVocalizedArabic(toArabicIfNeeded(occ.surface || occ.variantForm || ''));
      const variantFormAr = normalizeVocalizedArabic(toArabicIfNeeded(occ.variantForm || occ.surface || ''));
      const contextAr = occ.context
        ? normalizeArabicText(toArabicIfNeeded(occ.context))
        : surfaceAr;

      return {
        surah: occ.surah || 1,
        ayah: occ.ayah || 1,
        wordStart: occ.word_start ?? occ.wordStart,
        wordEnd: occ.word_end ?? occ.wordEnd,
        surahName: occ.surahName || occ.surah_name || '',
        surahNameUr: occ.surahNameUr || occ.surah_name_ur || '',
        surface: surfaceAr,
        variantForm: variantFormAr,
        context: contextAr || surfaceAr,
        lemmas: occ.lemmas,
        roots: occ.roots,
        patternCode: occ.pattern_code || occ.patternCode
      };
    });

    const phraseObj = {
      ...phrase,
      arabic: cleanArabic,
      transliteration: transliterationStr,
      occurrences: enrichedOccurrences
    };

    const variants = consolidatePhraseVariants(phraseObj);

    return {
      id: phrase.id || `phrase_${idx}`,
      arabic: cleanArabic,
      transliteration: transliterationStr,
      n: phrase.n || 2,
      frequency: phrase.frequency || enrichedOccurrences.length || 1,
      isHapax: phrase.isHapax || phrase.is_hapax || false,
      scope: phrase.scope || '',
      surahDistribution: phrase.surahDistribution || phrase.surah_distribution || [],
      translations: {
        en: [{ text: phrase.en || phrase.meaning || phrase.translation || phrase.translations?.en || '', context: { note: 'General meaning' } }],
        ur: [{ text: phrase.ur || phrase.translations?.ur || '', context: { note: 'General meaning' } }],
        tr: [{ text: phrase.tr || phrase.translations?.tr || '', context: { note: 'General meaning' } }],
        id: [{ text: phrase.id_lang || phrase.translations?.id || '', context: { note: 'General meaning' } }],
        hi: [{ text: phrase.hi || phrase.translations?.hi || '', context: { note: 'General meaning' } }],
        ps: [{ text: phrase.ps || phrase.translations?.ps || '', context: { note: 'General meaning' } }]
      },
      occurrences: enrichedOccurrences,
      grammarNotes: {
        en: [{ text: phrase.grammarNotes?.en || phrase.grammar || phrase.type || phrase.pattern || phrase.scope || '', context: { note: 'Grammar note' } }],
        ur: [{ text: phrase.grammarNotes?.ur || '', context: { note: 'Grammar note' } }],
        tr: [{ text: phrase.grammarNotes?.tr || '', context: { note: 'Grammar note' } }],
        id: [{ text: phrase.grammarNotes?.id || '', context: { note: 'Grammar note' } }],
        hi: [{ text: phrase.grammarNotes?.hi || '', context: { note: 'Grammar note' } }],
        ps: [{ text: phrase.grammarNotes?.ps || '', context: { note: 'Grammar note' } }]
      },
      learnedState: 'new' as LearnedState,
      themes: phrase.themes || phrase.categories || [],
      variants: variants
    };
  });
}

/**
 * Transform raw ayah/verse data into enriched Ayah objects
 */
function enrichAyahData(rawAyahs: any[]): Ayah[] {
  return rawAyahs.map((ayah: any, idx: number) => ({
    id: ayah.id || `${ayah.surah}:${ayah.ayahNum}` || `ayah_${idx}`,
    surah: ayah.surah || 1,
    ayahNum: ayah.ayahNum || ayah.ayah || 1,
    surahName: ayah.surahName || '',
    surahNameArabic: ayah.surahNameArabic || ayah.arabicName || toArabicIfNeeded(ayah.surahNameArabic || ''),
    surahNameUrdu: ayah.surahNameUrdu || ayah.urduName || '',
    surahEnglishMeaning: ayah.surahEnglishMeaning || '',
    arabicText: ayah.arabicText || ayah.text || ayah.arabic_uthmani || ayah.arabic_simple || toArabicIfNeeded(ayah.arabicText || ''),
    transliteration: cleanTransliteration(ayah.transliteration || ''),
    juz: ayah.juz || 1,
    hizb: ayah.hizb || 1,
    hizbQuarter: ayah.hizbQuarter || ayah.hizb_quarter || 1,
    manzil: ayah.manzil || 1,
    sajda: ayah.sajda || ayah.is_sajda_verse || false,
    statistics: ayah.statistics || {},
    translations: {
      en: [{ text: ayah.en || ayah.translation || '', context: { surah: ayah.surah, ayah: ayah.ayahNum, note: 'Verse translation' } }],
      ur: [{ text: ayah.ur || '', context: { surah: ayah.surah, ayah: ayah.ayahNum, note: 'Verse translation' } }],
      tr: [{ text: ayah.tr || '', context: { surah: ayah.surah, ayah: ayah.ayahNum, note: 'Verse translation' } }],
      id: [{ text: ayah.id_lang || '', context: { surah: ayah.surah, ayah: ayah.ayahNum, note: 'Verse translation' } }],
      hi: [{ text: ayah.hi || '', context: { surah: ayah.surah, ayah: ayah.ayahNum, note: 'Verse translation' } }],
      ps: [{ text: ayah.ps || '', context: { surah: ayah.surah, ayah: ayah.ayahNum, note: 'Verse translation' } }]
    },
    wordIds: ayah.wordIds || [],
    phraseIds: ayah.phraseIds || [],
    themes: ayah.themes || [],
    revelationPeriod: ayah.revelationPeriod || 'Meccan' as any,
    revelationOrder: ayah.revelationOrder || 1,
    learnedState: 'new' as LearnedState
  }));
}

/**
 * Load metadata for words
 */
async function loadWordsMetadata(): Promise<any> {
  if (wordsMetadata) return wordsMetadata;
  
  try {
    const response = await fetchWithFallback('/data/words.json');
    if (!response.ok) throw new Error('Failed to load words metadata');
    const data = await response.json();
    wordsMetadata = data.metadata || { total: data.words?.length || 0, chunks: 1, chunkSize: data.words?.length || 100 };
    return wordsMetadata;
  } catch (error) {
    console.error('Error loading words metadata:', error);
    return { total: 0, chunks: 0, chunkSize: 100 };
  }
}

/**
 * Load words index for quick lookups
 */
async function loadWordsIndex(): Promise<any[]> {
  if (wordsIndex.length > 0) return wordsIndex;
  
  try {
    const response = await fetchWithFallback('/data/words-index.json');
    if (!response.ok) throw new Error('Failed to load words index');
    const data = await response.json();
    wordsIndex = data.index || [];
    return wordsIndex;
  } catch (error) {
    console.error('Error loading words index:', error);
    return [];
  }
}

/**
 * Load a specific chunk of words
 */
async function loadWordChunk(chunkIndex: number): Promise<Word[]> {
  if (wordChunksCache.has(chunkIndex)) {
    return wordChunksCache.get(chunkIndex)!;
  }
  
  try {
    // Try to load from chunk file first
    const response = await fetchWithFallback(`/data/words-chunks/chunk-${chunkIndex}.json`);
    if (response.ok) {
      const data = await response.json();
      const words = enrichWordData(data.words || []);
      wordChunksCache.set(chunkIndex, words);
      return words;
    }
  } catch (error) {
    console.warn(`Chunk file not found for chunk ${chunkIndex}, falling back to main file`);
  }
  
  // Fallback: load from main words.json file
  try {
    const response = await fetchWithFallback('/data/words.json');
    if (!response.ok) throw new Error('Failed to load words.json');
    const data = await response.json();
    const words = enrichWordData(data.words || []);
    wordChunksCache.set(chunkIndex, words);
    return words;
  } catch (error) {
    console.error(`Error loading word chunk ${chunkIndex}:`, error);
    return [];
  }
}

/**
 * Load all words with a single network fetch and in-memory cache
 */
async function loadAllWordsOnce(): Promise<Word[]> {
  if (cachedAllWords) return cachedAllWords;
  
  try {
    const response = await fetchWithFallback('/data/words.json');
    if (!response.ok) throw new Error('Failed to load words.json');
    const data = await response.json();
    cachedAllWords = enrichWordData(data.words || []);
    return cachedAllWords;
  } catch (error) {
    console.error('Error loading all words:', error);
    return [];
  }
}

/**
 * Load words with pagination (lazy loading)
 */
export async function loadWords(page: number = 0, pageSize: number = 100): Promise<{ words: Word[]; total: number; hasMore: boolean }> {
  const allWords = await loadAllWordsOnce();
  const start = page * pageSize;
  const end = start + pageSize;
  const paginatedWords = allWords.slice(start, end);
  
  return {
    words: paginatedWords,
    total: allWords.length,
    hasMore: end < allWords.length
  };
}

/**
 * Load all words (fallback for compatibility)
 */
export async function loadAllWords(): Promise<Word[]> {
  return await loadAllWordsOnce();
}

/**
 * Load metadata for murakkabat (phrases)
 */
async function loadMurakkabMetadata(): Promise<any> {
  if (murakkabMetadata) return murakkabMetadata;
  
  try {
    const response = await fetchWithFallback('/data/murakkabat.json');
    if (!response.ok) throw new Error('Failed to load murakkabat metadata');
    const data = await response.json();
    murakkabMetadata = data.metadata || { total: data.murakkabat?.length || 0, chunks: 1, chunkSize: data.murakkabat?.length || 1000 };
    return murakkabMetadata;
  } catch (error) {
    console.error('Error loading murakkabat metadata:', error);
    return { total: 0, chunks: 0, chunkSize: 1000 };
  }
}

/**
 * Load murakkabat index for quick lookups
 */
async function loadMurakkabIndex(): Promise<any[]> {
  if (murakkabIndex.length > 0) return murakkabIndex;
  
  try {
    const response = await fetchWithFallback('/data/murakkabat-index.json');
    if (!response.ok) throw new Error('Failed to load murakkabat index');
    const data = await response.json();
    murakkabIndex = data.index || [];
    return murakkabIndex;
  } catch (error) {
    console.error('Error loading murakkabat index:', error);
    return [];
  }
}

/**
 * Load a specific chunk of murakkabat (phrases)
 */
async function loadMurakkabChunk(chunkIndex: number): Promise<Murakkab[]> {
  if (murakkabChunksCache.has(chunkIndex)) {
    return murakkabChunksCache.get(chunkIndex)!;
  }
  
  try {
    // Try to load from chunk file first
    const response = await fetchWithFallback(`/data/murakkabat-chunks/chunk-${chunkIndex}.json`);
    if (response.ok) {
      const data = await response.json();
      const murakkabat = enrichMurakkabData(data.murakkabat || []);
      murakkabChunksCache.set(chunkIndex, murakkabat);
      return murakkabat;
    }
  } catch (error) {
    console.warn(`Chunk file not found for chunk ${chunkIndex}, falling back to main file`);
  }
  
  // Fallback: load from main murakkabat.json file
  try {
    const response = await fetchWithFallback('/data/murakkabat.json');
    if (!response.ok) throw new Error('Failed to load murakkabat.json');
    const data = await response.json();
    const murakkabat = enrichMurakkabData(data.murakkabat || []);
    murakkabChunksCache.set(chunkIndex, murakkabat);
    return murakkabat;
  } catch (error) {
    console.error(`Error loading murakkabat chunk ${chunkIndex}:`, error);
    return [];
  }
}

/**
 * Helper to load a range of murakkabat chunks in parallel and merge them
 */
async function loadMurakkabChunkRange(startChunk: number, endChunk: number): Promise<Murakkab[]> {
  const promises: Promise<Murakkab[]>[] = [];
  for (let i = startChunk; i <= endChunk; i++) {
    promises.push(loadMurakkabChunk(i));
  }
  const chunks = await Promise.all(promises);
  const merged: Murakkab[] = [];
  for (const chunk of chunks) {
    merged.push(...chunk);
  }
  return merged;
}

/**
 * Load murakkabat (phrases) with pagination (lazy loading)
 */
export async function loadMurakkabat(page: number = 0, pageSize: number = 1000): Promise<{ murakkabat: Murakkab[]; total: number; hasMore: boolean }> {
  const metadata = await loadMurakkabMetadata();
  const chunkSize = metadata.chunkSize || 1000;
  
  const start = page * pageSize;
  const end = start + pageSize;
  
  const startChunk = Math.floor(start / chunkSize);
  const endChunk = Math.floor((end - 1) / chunkSize);
  
  const mergedMurakkabat = await loadMurakkabChunkRange(startChunk, endChunk);
  
  const relativeStart = start - startChunk * chunkSize;
  const relativeEnd = end - startChunk * chunkSize;
  
  const paginatedMurakkabat = mergedMurakkabat.slice(relativeStart, relativeEnd);
  
  return {
    murakkabat: paginatedMurakkabat,
    total: metadata.total || paginatedMurakkabat.length,
    hasMore: end < (metadata.total || 0)
  };
}

/**
 * Load all murakkabat (fallback for compatibility)
 */
export async function loadAllMurakkabat(): Promise<Murakkab[]> {
  const metadata = await loadMurakkabMetadata();
  const allMurakkabat: Murakkab[] = [];
  
  for (let i = 0; i < metadata.chunks; i++) {
    const chunk = await loadMurakkabChunk(i);
    allMurakkabat.push(...chunk);
  }
  
  return allMurakkabat;
}

/**
 * Load Quran Arabic text data (all surahs with verses)
 */
async function loadQuranArabicData(): Promise<any[]> {
  if (quranArabicLoaded && quranArabicData.length > 0) {
    return quranArabicData;
  }
  
  try {
    const response = await fetchWithFallback('/data/quran-arabic-text.json');
    if (!response.ok) throw new Error('Failed to load Quran Arabic text');
    const data = await response.json();
    quranArabicData = data;
    quranArabicLoaded = true;
    return data;
  } catch (error) {
    console.error('Error loading Quran Arabic text:', error);
    return [];
  }
}

/**
 * Load metadata for ayahs
 */
async function loadAyahsMetadata(): Promise<any> {
  if (ayahsMetadata) return ayahsMetadata;
  
  try {
    const quranData = await loadQuranArabicData();
    ayahsMetadata = {
      total: quranData.reduce((sum: number, surah: any) => sum + surah.total_verses, 0),
      surahs: quranData.length,
      chunkType: 'by_surah'
    };
    return ayahsMetadata;
  } catch (error) {
    console.error('Error loading ayahs metadata:', error);
    return { total: 0, surahs: 0, chunkType: 'by_surah' };
  }
}

/**
 * Load ayahs index for quick lookups
 */
async function loadAyahsIndex(): Promise<any[]> {
  if (ayahsIndex.length > 0) return ayahsIndex;
  
  try {
    const quranData = await loadQuranArabicData();
    // Build index from Quran Arabic data
    const index: any[] = [];
    quranData.forEach((surah: any) => {
      surah.verses.forEach((verse: any) => {
        index.push({
          id: `${surah.id}:${verse.id}`,
          surah: surah.id,
          ayahNum: verse.id,
          surahName: surah.name,
          surahNameArabic: surah.name
        });
      });
    });
    ayahsIndex = index;
    return index;
  } catch (error) {
    console.error('Error loading ayahs index:', error);
    return [];
  }
}

/**
 * Load a specific surah chunk of ayahs, prioritizing the rich grammatical chunk files
 * in /data/ayahs-chunks/surah-${surahNum}.json (which include juz, hizb, manzil, sajda,
 * revelationOrder, and per-verse morphological statistics).
 */
async function loadAyahChunk(surahNum: number): Promise<Ayah[]> {
  if (ayahChunksCache.has(surahNum)) {
    return ayahChunksCache.get(surahNum)!;
  }

  // 1. Try loading rich Surah chunk file (/data/ayahs-chunks/surah-{n}.json)
  try {
    const chunkResponse = await fetchWithFallback(`/data/ayahs-chunks/surah-${surahNum}.json`);
    if (chunkResponse.ok) {
      const chunkData = await chunkResponse.json();
      if (chunkData && Array.isArray(chunkData.ayahs) && chunkData.ayahs.length > 0) {
        const enriched = enrichAyahData(chunkData.ayahs);
        ayahChunksCache.set(surahNum, enriched);
        return enriched;
      }
    }
  } catch (e) {
    console.warn(`Rich ayah chunk for surah ${surahNum} not found, falling back to quran-arabic-text.json`);
  }

  // 2. Fallback to /data/quran-arabic-text.json
  try {
    const quranData = await loadQuranArabicData();
    const surahData = quranData.find((s: any) => s.id === surahNum);

    if (!surahData) {
      console.error(`Surah ${surahNum} not found in Quran data`);
      return [];
    }

    const ayahs: Ayah[] = surahData.verses.map((verse: any) => ({
      id: `${surahData.id}:${verse.id}`,
      surah: surahData.id,
      ayahNum: verse.id,
      surahName: surahData.transliteration || surahData.name,
      surahNameArabic: surahData.name,
      surahNameUrdu: surahData.name,
      surahEnglishMeaning: surahData.transliteration,
      arabicText: verse.text,
      transliteration: '',
      juz: Math.ceil((surahData.id > 1 ? ((surahData.id - 1) * 7 + verse.id) / 15 : verse.id / 7)),
      hizb: 1,
      hizbQuarter: 1,
      manzil: 1,
      sajda: false,
      statistics: {},
      translations: {
        en: [{ text: '', context: { surah: surahData.id, ayah: verse.id, note: 'Verse translation' } }],
        ur: [{ text: '', context: { surah: surahData.id, ayah: verse.id, note: 'Verse translation' } }],
        tr: [{ text: '', context: { surah: surahData.id, ayah: verse.id, note: 'Verse translation' } }],
        id: [{ text: '', context: { surah: surahData.id, ayah: verse.id, note: 'Verse translation' } }],
        hi: [{ text: '', context: { surah: surahData.id, ayah: verse.id, note: 'Verse translation' } }],
        ps: [{ text: '', context: { surah: surahData.id, ayah: verse.id, note: 'Verse translation' } }]
      },
      wordIds: [],
      phraseIds: [],
      themes: [],
      revelationPeriod: surahData.type === 'meccan' ? 'Meccan' : 'Medinan',
      revelationOrder: surahData.id,
      learnedState: 'new' as LearnedState
    }));

    ayahChunksCache.set(surahNum, ayahs);
    return ayahs;
  } catch (error) {
    console.error(`Error loading ayah chunk for surah ${surahNum}:`, error);
    return [];
  }
}

/**
 * Load ayahs with pagination (lazy loading by surah)
 */
export async function loadAyahs(page: number = 0, pageSize: number = 50): Promise<{ ayahs: Ayah[]; total: number; hasMore: boolean }> {
  const metadata = await loadAyahsMetadata();
  const index = await loadAyahsIndex();
  
  // Calculate which surahs to load based on pagination
  const startIndex = page * pageSize;
  const endIndex = startIndex + pageSize;
  
  // Get the ayahs in the requested range
  const paginatedAyahs = index.slice(startIndex, endIndex).map((idx: any) => {
    return {
      id: idx.id,
      surah: idx.surah,
      ayahNum: idx.ayahNum,
      surahName: idx.surahName,
      arabicText: '', // Will be loaded from chunk
      transliteration: '',
      translations: { en: '', ur: '', tr: '', id: '' },
      wordIds: [],
      phraseIds: [],
      themes: [],
      revelationPeriod: 'Meccan',
      learnedState: 'new' as LearnedState
    };
  });
  
  // Load full ayah data from chunks
  const surahsToLoad = new Set(paginatedAyahs.map((a: any) => a.surah));
  const fullAyahs: any = {};
  
  for (const surahNum of surahsToLoad) {
    const surahAyahs = await loadAyahChunk(surahNum);
    surahAyahs.forEach(ayah => {
      fullAyahs[ayah.id] = ayah;
    });
  }
  
  const enrichedAyahs = paginatedAyahs.map((a: any) => fullAyahs[a.id] || a);
  
  return {
    ayahs: enrichedAyahs,
    total: metadata.total,
    hasMore: endIndex < metadata.total
  };
}

/**
 * Load ayahs for a specific surah
 */
export async function loadAyahsBySurah(surahNum: number): Promise<Ayah[]> {
  return await loadAyahChunk(surahNum);
}

/**
 * Load ayahs for a range of surahs (for chunk loading)
 */
export async function loadAyahsBySurahRange(startSurah: number, endSurah: number): Promise<{ ayahs: Ayah[]; hasMore: boolean }> {
  const metadata = await loadAyahsMetadata();
  const allAyahs: Ayah[] = [];
  
  for (let surahNum = startSurah; surahNum <= endSurah; surahNum++) {
    const surahAyahs = await loadAyahChunk(surahNum);
    allAyahs.push(...surahAyahs);
  }
  
  return {
    ayahs: allAyahs,
    hasMore: endSurah < metadata.surahs
  };
}

/**
 * Load all ayahs (fallback for compatibility)
 */
export async function loadAllAyahs(): Promise<Ayah[]> {
  const metadata = await loadAyahsMetadata();
  const allAyahs: Ayah[] = [];
  
  for (let i = 1; i <= metadata.surahs; i++) {
    const chunk = await loadAyahChunk(i);
    allAyahs.push(...chunk);
  }
  
  return allAyahs;
}

/**
 * Load a single word by ID using index for fast lookup
 */
export async function loadWordById(id: string): Promise<Word | null> {
  const allWords = await loadAllWordsOnce();
  return allWords.find((w) => w.id === id) || null;
}

/**
 * Load a single murakkab by ID using index for fast lookup
 */
export async function loadMurakkabById(id: string): Promise<Murakkab | null> {
  const index = await loadMurakkabIndex();
  const indexEntry = index.find((m: any) => m.id === id);
  
  if (!indexEntry) return null;
  
  // Calculate which chunk this murakkab is in
  const metadata = await loadMurakkabMetadata();
  const chunkIndex = Math.floor(index.indexOf(indexEntry) / metadata.chunkSize);
  const chunk = await loadMurakkabChunk(chunkIndex);
  
  return chunk.find((m) => m.id === id) || null;
}

/**
 * Load a single ayah by ID using index for fast lookup
 */
export async function loadAyahById(id: string): Promise<Ayah | null> {
  const index = await loadAyahsIndex();
  const indexEntry = index.find((a: any) => a.id === id);
  
  if (!indexEntry) return null;
  
  // Load the surah chunk containing this ayah
  const chunk = await loadAyahChunk(indexEntry.surah);
  
  return chunk.find((a) => a.id === id) || null;
}

/**
 * Get coverage thresholds for words
 * Returns how many words are needed to reach each frequency threshold
 */
export function getWordCoverageThresholds(
  words: Word[],
  thresholds = [50, 60, 70, 75, 80, 85, 90, 95]
): Array<{ threshold: number; count: number; frequency: number }> {
  const totalFrequency = words.reduce((sum, w) => sum + w.frequency, 0);
  const result: Array<{ threshold: number; count: number; frequency: number }> = [];
  let cumulative = 0;

  for (let i = 0; i < words.length; i++) {
    cumulative += words[i].frequency;
    const percent = (cumulative * 100) / totalFrequency;

    for (const threshold of thresholds) {
      if (!result.find((r) => r.threshold === threshold) && percent >= threshold) {
        result.push({
          threshold,
          count: i + 1,
          frequency: cumulative
        });
      }
    }

    if (result.length === thresholds.length) break;
  }

  return result;
}
