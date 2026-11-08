/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

/**
 * Translation Loader
 * Loads Quran translations in multiple languages
 */

// Cache for loaded translations
const chapterTranslationsCache = new Map<string, any[]>();
let quranTextCache: any = null;
let quranTextLoaded = false;

/**
 * Load chapter translations for a specific language
 */
export async function loadChapterTranslations(lang: string): Promise<any[]> {
  if (chapterTranslationsCache.has(lang)) {
    return chapterTranslationsCache.get(lang)!;
  }
  
  try {
    const response = await fetchWithFallback(`/data/translations/${lang}.json`);
    if (!response.ok) throw new Error(`Failed to load ${lang} translations`);
    const data = await response.json();
    chapterTranslationsCache.set(lang, data);
    return data;
  } catch (error) {
    console.error(`Error loading ${lang} translations:`, error);
    return [];
  }
}

/**
 * Load Quran Arabic text (for reference)
 */
export async function loadQuranText(): Promise<any> {
  if (quranTextLoaded && quranTextCache) {
    return quranTextCache;
  }
  
  try {
    const response = await fetchWithFallback('/data/quran.json');
    if (!response.ok) throw new Error('Failed to load Quran text');
    const data = await response.json();
    (quranTextCache as any) = data;
    quranTextLoaded = true;
    return data;
  } catch (error) {
    console.error('Error loading Quran text:', error);
    return {};
  }
}

/**
 * Get chapter name translation for a specific language
 */
export async function getChapterName(surahNum: number, lang: string): Promise<string> {
  try {
    const translations = await loadChapterTranslations(lang);
    const chapter = translations.find((c: any) => c.id === surahNum);
    return chapter?.translation || chapter?.transliteration || '';
  } catch (error) {
    console.error('Error getting chapter name:', error);
    return '';
  }
}

/**
 * Get all available translation languages
 */
export function getAvailableLanguages(): string[] {
  return ['en', 'ur', 'tr', 'id', 'bn', 'es', 'fr', 'ru', 'sv', 'zh'];
}

/**
 * Language code to display name mapping
 */
export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ur: 'Urdu',
  tr: 'Turkish',
  id: 'Indonesian',
  bn: 'Bengali',
  es: 'Spanish',
  fr: 'French',
  ru: 'Russian',
  sv: 'Swedish',
  zh: 'Chinese',
  hi: 'Hindi',
  ps: 'Pashto'
};

const ALQURAN_EDITION_MAP: Record<string, string> = {
  en: 'en.sahih',
  ur: 'ur.maududi',
  tr: 'tr.diyanet',
  id: 'id.indonesian',
  bn: 'bn.bengali',
  es: 'es.asad',
  fr: 'fr.hamidullah',
  ru: 'ru.kuliev',
  sv: 'sv.bernstrom',
  zh: 'zh.jian',
  hi: 'hi.hindi',
  ps: 'en.sahih'
};

const surahVerseTranslationCache = new Map<string, Record<number, string>>();

/**
 * Fetch verse-by-verse translations for a specific Surah and language
 * with in-memory and localStorage caching.
 */
export async function fetchSurahVerseTranslations(
  surahNum: number,
  lang: string = 'en'
): Promise<Record<number, string>> {
  const edition = ALQURAN_EDITION_MAP[lang] || 'en.sahih';
  const cacheKey = `${surahNum}:${edition}`;

  if (surahVerseTranslationCache.has(cacheKey)) {
    return surahVerseTranslationCache.get(cacheKey)!;
  }

  try {
    const lsKey = `bayan_surah_trans_${cacheKey}`;
    const stored = localStorage.getItem(lsKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && Object.keys(parsed).length > 0) {
        surahVerseTranslationCache.set(cacheKey, parsed);
        return parsed;
      }
    }
  } catch (e) {
    // Ignore storage read error
  }

  try {
    let res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/${edition}`);
    if (!res.ok && edition !== 'en.sahih') {
      res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/en.sahih`);
    }
    if (!res.ok) return {};

    const json = await res.json();
    const map: Record<number, string> = {};
    if (json?.data?.ayahs && Array.isArray(json.data.ayahs)) {
      json.data.ayahs.forEach((a: any) => {
        if (a.numberInSurah && a.text) {
          map[a.numberInSurah] = a.text;
        }
      });
    }

    if (Object.keys(map).length > 0) {
      surahVerseTranslationCache.set(cacheKey, map);
      try {
        localStorage.setItem(`bayan_surah_trans_${cacheKey}`, JSON.stringify(map));
      } catch (e) {
        // Ignore quota errors
      }
    }
    return map;
  } catch (error) {
    console.warn(`Failed to fetch verse translations for Surah ${surahNum} (${lang}):`, error);
    return {};
  }
}

