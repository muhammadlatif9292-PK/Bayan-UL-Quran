/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LanguageCode, ContextTranslation, Occurrence } from '../types';
import { toArabicIfNeeded, transliterateArabicToEnglish, buckwalterToEnglish } from './buckwalterConverter';
import {
  removeDiacritics,
  tokenizeArabicMorphology,
  isGrammaticallyCompatible,
  MorphologicalConstraint,
  MorphologicalToken
} from './arabicMorphology';

/**
 * Apply Shaddah on the first letter of a word if the previous word ends with Noon Sakinah or Tanween (Idgham),
 * or apply Meem diacritic if the next word starts with Baa (Iqlab).
 * Also handles Idgham Meem Sakinah.
 */
export function applyIdghamShaddah(words: string[]): string[] {
  const result = [...words];
  for (let i = 0; i < result.length - 1; i++) {
    const currentWord = result[i];
    const nextWord = result[i + 1];
    
    if (!currentWord || !nextWord) continue;
    
    // Remove trailing waqf / stop marks for boundary analysis
    const cleanCurrent = currentWord.replace(/[\u06D6-\u06DC\u06E9]/g, '');
    const cleanNext = nextWord.replace(/[\u06D6-\u06DC\u06E9]/g, '');
    
    // Check if current word ends in bare Noon, Noon Sakinah, or Uthmani Sukun
    const endsWithNoonSakinah = cleanCurrent.endsWith('\u0646') || 
                                cleanCurrent.endsWith('\u0646\u0652') || 
                                cleanCurrent.endsWith('\u0646\u06E1');
    
    // Check if current word has Tanween
    const hasTanween = cleanCurrent.slice(-3).includes('\u064B') || // Fathatayn ( ً )
                        cleanCurrent.slice(-2).includes('\u064C') || // Dammatayn ( ٌ )
                        cleanCurrent.slice(-2).includes('\u064D');   // Kasratayn ( ٍ )
    
    // Check if current word ends in Meem Sakinah
    const endsWithMeemSakinah = cleanCurrent.endsWith('\u0645') ||
                                cleanCurrent.endsWith('\u0645\u0652') ||
                                cleanCurrent.endsWith('\u0645\u06E1');

    if (endsWithNoonSakinah || hasTanween) {
      const firstChar = cleanNext.charAt(0);
      const alreadyHasIqlab = cleanCurrent.includes('\u06E2') || cleanCurrent.includes('\u06ED');
      
      // Iqlab Rule: If next word starts with Baa (ب, U+0628)
      if (firstChar === '\u0628') {
        if (!alreadyHasIqlab) {
          if (endsWithNoonSakinah) {
            // Replace Noon Sakinah ending with Noon + small high meem (U+06E2)
            if (currentWord.endsWith('\u0646\u0652') || currentWord.endsWith('\u0646\u06E1')) {
              result[i] = currentWord.slice(0, -2) + '\u0646\u06E2';
            } else if (currentWord.endsWith('\u0646')) {
              result[i] = currentWord + '\u06E2';
            }
          } else if (hasTanween) {
            // Replace Tanween with single diacritic + small high meem (U+06E2)
            let wordStr = currentWord;
            if (wordStr.includes('\u0627\u064B')) {
              wordStr = wordStr.replace('\u0627\u064B', '\u064E\u06E2\u0627');
            } else if (wordStr.includes('\u064B\u0627')) {
              wordStr = wordStr.replace('\u064B\u0627', '\u064E\u06E2\u0627');
            } else if (wordStr.includes('\u064B')) {
              wordStr = wordStr.replace('\u064B', '\u064E\u06E2'); // Fatha + small meem
            } else if (wordStr.includes('\u064C')) {
              wordStr = wordStr.replace('\u064C', '\u064F\u06E2'); // Damma + small meem
            } else if (wordStr.includes('\u064D')) {
              wordStr = wordStr.replace('\u064D', '\u0650\u06E2'); // Kasra + small meem
            }
            result[i] = wordStr;
          }
        }
      } else {
        // Idgham Rule: If next word starts with Yarmaloon (ي, ر, م, ل, و, ن)
        const isYarmaloon = ['\u064A', '\u06CC', '\u0648', '\u0644', '\u0631', '\u0645', '\u0646'].includes(firstChar);
        
        if (isYarmaloon) {
          // Check if it already has a Shaddah (U+0651)
          const hasShaddah = nextWord.slice(0, 3).includes('\u0651');
          if (!hasShaddah) {
            // Insert Shaddah right after the first character
            result[i + 1] = nextWord.charAt(0) + '\u0651' + nextWord.slice(1);
          }
          if (endsWithNoonSakinah && (currentWord.endsWith('\u0646\u0652') || currentWord.endsWith('\u0646\u06E1'))) {
            result[i] = currentWord.slice(0, -1); // Remove sukun from assimilated noon
          }
        }
      }
    } else if (endsWithMeemSakinah) {
      const firstChar = cleanNext.charAt(0);
      if (firstChar === '\u0645') {
        // Idgham Meem Sakinah
        const hasShaddah = nextWord.slice(0, 3).includes('\u0651');
        if (!hasShaddah) {
          result[i + 1] = nextWord.charAt(0) + '\u0651' + nextWord.slice(1);
        }
      }
    }
  }
  return result;
}

/**
 * Normalize Arabic text to resolve rendering glitches with rare/unsupported Uthmani characters
 * and apply Tajweed rules across boundary transitions.
 */
export function normalizeArabicText(text: string): string {
  if (!text) return text;
  let normalized = text
    // Convert any stray Extended Buckwalter symbols if present in mixed strings
    .replace(/_#/g, '\u0640\u0654')
    .replace(/#/g, '\u0654')
    .replace(/\[/g, '\u06E2')
    .replace(/\]/g, '\u06ED')

    // Replace sequential/open Fathatayn (Do Zabar) with standard Fathatayn
    .replace(/\u0657/g, '\u064B')
    
    // Replace sequential/open Dammatayn (Do Paish) with standard Dammatayn
    .replace(/\u065E/g, '\u064C')
    
    // Replace sequential/open Kasratayn (Do Zer) with standard Kasratayn
    .replace(/\u0656/g, '\u064D')
    
    // Remove the solid black dot / rounded zero above (Ishmam/Imalah/Tashil marker)
    .replace(/\u06EC/g, '')
    
    // Remove Rub el Hizb section-start star symbol which glitches and attaches directly to words
    .replace(/\u06DE/g, '')
    
    // Replace rare Kasra with two dots / Imalah marker with standard Kasra
    .replace(/\u065C/g, '\u0650')
    
    // Normalize unpointed ya with sukun (e.g. in shay'in شَىْء) to standard pointed ya (شَيْء)
    .replace(/\u0649([\u0652\u06E1])/g, '\u064A$1')

    // Fix Maddah (^) previously misconverted to Shaddah (\u0651) instead of Maddah (\u0653):
    // 1. After Alif (\u0627), Dagger Alif (\u0670), Small Waw (\u06E5), or Small Ya (\u06E6), \u0651 is always Maddah (\u0653)
    .replace(/([\u0627\u0670\u06E5\u06E6])\u0651/g, '$1\u0653')
    // 2. On long vowel Waw/Ya/Alif-Maqsurah when not followed by a short vowel or dagger alif (e.g., سُوٓءَ, قُرُوٓءٍ, جَآءُو, سِيٓءَتْ)
    .replace(/([\u0648\u0649\u064A])\u0651(?![\u064B-\u0650\u0656-\u065E\u0670])/g, '$1\u0653')

    // Clean doubled/stacked zabar (fatha \u064E) before or after Alif-e-Maqsurah / Dagger Alif (\u0670),
    // including when separated by tatweel (\u0640), ensuring only the clean Alif-e-Maqsurah remains
    // (e.g. as in أُولَٰٓئِكَ -> أُولٰٓئِكَ, ٱلسَّمٰوٰتِ, ٱلرَّحۡمٰنِ, ذٰلِكَ, عَلَىٰ, يٰٓأَيُّهَا).
    .replace(/\u0651\u064E\u0640*\u0670|\u064E\u0651\u0640*\u0670|\u0651\u0640*\u0670\u064E/g, '\u0651\u0670')
    .replace(/\u064E\u0640*\u0670|\u0640*\u0670\u064E/g, '\u0670')
    .replace(/\u0640+\u0670/g, '\u0670')

    // Ensure Uthmani Aulaika (أُولٰٓئِكَ / أُو۟لٰٓئِكَ) has clean Alif-e-Maqsurah + Maddah on Lam and never Shaddah
    .replace(/(أُو[\u0652\u06DF\u06E1]?ل)\u064E?\u0640?\u0670[\u0651\u0653]?(ئِ)/g, '$1\u0670\u0653$2')

    // Perfect typography for the word Allah (Lafz al-Jalalah) and its prefixed forms (Lillahi, Billahi, Wallahi, Allahumma, etc.):
    // Place Alif-e-Maqsurah / Dagger Alif (\u0670) on the second Laam together with Shaddah (\u0651\u0670) instead of plain fatha/zabar.
    // Preserves non-Allah words like ٱللَّهۡوِ (Al-Lahw) and ٱللَّهَبِ (Al-Lahab).
    .replace(/(ل[ِّۡ\u0652\u06E1]*ل)[\u0651\u064E]*\u0651[\u0651\u064E]*(?!\u0670)(ه(?:[\u0650\u064F\u064E](?![\u0621-\u064A\u0671-\u06D3])|[\u0650\u064F\u064E]?[ۚۖۗۘۙۜ۩ۤ]|ُ?مَّ|(?=[\s\.,،؛:()\[\]{}"'\/\-?!]|$)))/g, '$1\u0651\u0670$2');

  // Apply Tajweed Idgham Shaddah and Iqlab logic dynamically on word boundary transitions
  const words = normalized.split(/\s+/);
  const processedWords = applyIdghamShaddah(words);
  return processedWords.join(' ');
}

/**
 * Fix non-standard Uthmani font characters and artifacts commonly present in standalone word/phrase datasets
 */
export function fixPhraseFontArtifacts(text: string): string {
  if (!text) return '';
  let s = toArabicIfNeeded(text.trim());

  // Custom font character replacements for non-standard extended font encoding glitches:
  s = s.replace(/ٳ/g, 'إ'); // 0673 -> Alif with Hamza Below (إ), e.g. Inna (إِنَّ)
  s = s.replace(/ٻ/g, 'ذ'); // 067B -> Dhal (ذ)
  s = s.replace(/ړ/g, '');  // 0695 -> font artifact
  s = s.replace(/ټ/g, '۟'); // 0679 -> silent marker
  s = s.replace(/ٿ/g, 'ث'); // 067F -> Tha (ث)
  s = s.replace(/ڄ/g, 'ج'); // 0683 -> Jim (ج)
  s = s.replace(/ڃ/g, 'ح'); // 0688 -> Ha (ح)
  s = s.replace(/څ/g, 'خ'); // 0686 -> Kha (خ)
  s = s.replace(/ډ/g, 'د'); // Dal (د)
  s = s.replace(/ۮ/g, 'ذ'); // Dhal (ذ)
  s = s.replace(/ژ/g, 'ز'); // Zay (ز)
  s = s.replace(/[کگ]/g, 'ك'); // Persian/Urdu kaf -> Arabic Kaf (ك)
  s = s.replace(/[یے]/g, 'ي'); // Persian/Urdu ya -> Arabic Ya (ي)

  // Apply standard Uthmani normalization and internal multi-word Tajweed
  s = normalizeArabicText(s);

  // Strip pause/waqf marks from standalone words and phrases
  s = s.replace(/[ۖۗۚۛۜ۝\u06DE\u06E9]/g, '').trim();

  // Standalone Word / Phrase Initial Boundary Rule:
  // A separate word or phrase has no word before it, so its very first letter/harf must NEVER have a Shaddah (\u0651)
  s = s.replace(/^[\u0651\u0652\u06E1]+/, '');
  s = s.replace(/^([^\u0621-\u064A\u066E-\u06D3]*[\u0621-\u064A\u066E-\u06D3][\u064B-\u065F\u0670\u06D6-\u06ED]*)/, (m) => m.replace(/\u0651/g, ''));
  s = s.replace(/\s+[\u0651]/g, ' ');
  s = s.replace(/([اأإآٱ])[\u0651]/g, '$1');

  // Standalone Word / Phrase Final Boundary Rule:
  // If a standalone word or the final word of a phrase ends with a cross-boundary Iqlab Meem (\u06E2 or \u06ED)
  // because the following Baa word was cut off, restore the standalone ending (Tanween or Noon Sakinah).
  s = s.replace(/\u0646[\u06E2\u06ED]$/g, '\u0646\u0652')
       .replace(/\u064E[\u06E2\u06ED]\u0627$/g, '\u064B\u0627')
       .replace(/\u064E[\u06E2\u06ED]$/g, '\u064B')
       .replace(/\u064F[\u06E2\u06ED]$/g, '\u064C')
       .replace(/\u0650[\u06E2\u06ED]$/g, '\u064D')
       .replace(/[\u06E2\u06ED]$/g, '');

  return s.trim();
}

/**
 * Normalize vocalized Arabic string for standalone word/variant/phrase display
 * - Converts Buckwalter to Arabic Unicode if needed
 * - Cleans Uthmani font artifacts
 * - Strips initial tajweed assimilation shaddah or sukun on the first letter
 * - Restores dangling final Iqlab meem at the end of standalone words/phrases
 * - Standardizes dagger alifs, maddahs, and Lafz al-Jalalah
 * - Removes orthographic pause/stop marks
 */
export function normalizeVocalizedArabic(text: string): string {
  if (!text) return '';
  return fixPhraseFontArtifacts(text);
}

/**
 * Clean key for matching variants ignoring diacritics & orthographic variations
 */
export function cleanArabicVariantKey(text: string): string {
  if (!text) return '';
  let clean = normalizeVocalizedArabic(text);
  clean = removeDiacritics(clean);
  // Normalize hamzas (أ, إ, آ, ٱ, ء) to a simple alif (ا) or consistent base, and seats (ؤ -> و, ئ -> ي)
  clean = clean.replace(/[أإآٱء]/g, 'ا')
               .replace(/ؤ/g, 'و')
               .replace(/[ئى]/g, 'ي')
               .replace(/[\u0640]/g, '')
               .trim();
  return clean;
}

/**
 * Clean key for matching variants that preserves core vocalization/diacritics (harakat)
 */
export function cleanArabicVariantKeyWithVowels(text: string): string {
  if (!text) return '';
  let clean = normalizeVocalizedArabic(text);
  // Normalize hamzas (أ, إ, آ, ٱ, ء) to a simple alif (ا) or consistent base, and seats (ؤ -> و, ئ -> ي)
  // but do NOT remove core vocalic diacritics (fatha, damma, kasra, shadda, etc.)
  clean = clean.replace(/[أإآٱء]/g, 'ا')
               .replace(/ؤ/g, 'و')
               .replace(/[ئى]/g, 'ي')
               .replace(/[\u0640]/g, '')
               .trim();
  return clean;
}

/**
 * Clean variant transliteration
 */
export function cleanVariantTransliteration(arabic: string, rawTrans?: string): string {
  let trans = transliterateArabicToEnglish(arabic);
  if (trans) {
    trans = trans.replace(/Alll/g, 'All');
    trans = trans.replace(/alll/g, 'all');
    trans = trans.replace(/Alss/g, 'As-S');
    trans = trans.replace(/alss/g, 'as-s');
    trans = trans.replace(/Ilss/g, 'Is-S');
    trans = trans.replace(/ilss/g, 'is-s');
    trans = trans.replace(/Alṣṣ/g, 'Aṣ-Ṣ');
    trans = trans.replace(/alṣṣ/g, 'aṣ-ṣ');
    trans = trans.replace(/Ilṣṣ/g, 'Iṣ-Ṣ');
    trans = trans.replace(/ilṣṣ/g, 'iṣ-ṣ');
    trans = trans.replace(/Ashsh/g, 'Ash-Sh');
    trans = trans.replace(/ashsh/g, 'ash-sh');
    trans = trans.replace(/Ilshsh/g, 'Ish-Sh');
    trans = trans.replace(/ilshsh/g, 'ish-sh');
    trans = trans.replace(/Wāl’ar/g, "wa'l-Ar");
    trans = trans.replace(/Al’ar/g, "al-Ar");
  }
  if (!trans || trans.toLowerCase().includes('alll')) {
    if (arabic.includes('للَّ') || arabic.includes('للّٰ') || arabic.includes('الله') || arabic.includes('ٱللَّ') || arabic.includes('ٱللّٰ')) trans = 'Allāh';
    if (arabic.includes('لِلَّ') || arabic.includes('لِلّٰ')) trans = 'Lillāhi';
  }
  return trans || (rawTrans ? buckwalterToEnglish(rawTrans) : '');
}

/**
 * Consolidate raw variant entries for a word into unique, clean, high-quality, useful variants
 */
export function consolidateWordVariants(rawVariants: any[], mainWordArabic: string = ''): Array<{
  arabic: string;
  form: string;
  transliteration: string;
  frequency: number;
}> {
  if (!rawVariants || !Array.isArray(rawVariants)) return [];

  const map = new Map<string, { arabic: string; form: string; transliteration: string; frequency: number }>();

  rawVariants.forEach(v => {
    const rawAr = v.arabic || v.form || '';
    const normAr = normalizeVocalizedArabic(rawAr);
    if (!normAr) return;

    const key = cleanArabicVariantKeyWithVowels(rawAr);
    if (!key) return;

    const freq = typeof v.frequency === 'number' ? v.frequency : 1;
    const formStr = v.form || normAr;

    if (!map.has(key)) {
      map.set(key, {
        arabic: normAr,
        form: formStr,
        transliteration: cleanVariantTransliteration(normAr, v.transliteration),
        frequency: freq
      });
    } else {
      const existing = map.get(key)!;
      existing.frequency += freq;
      // Prefer the display with fuller diacritics
      if (normAr.length >= existing.arabic.length) {
        existing.arabic = normAr;
        existing.transliteration = cleanVariantTransliteration(normAr, v.transliteration) || existing.transliteration;
      }
    }
  });

  return Array.from(map.values())
    .filter(v => v.frequency > 0)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);
}

/**
 * Consolidate raw variants or occurrences for a phrase into unique, clean, high-quality, useful variants
 */
export function consolidatePhraseVariants(phrase: any): Array<{
  arabic: string;
  form: string;
  transliteration: string;
  frequency: number;
}> {
  if (!phrase) return [];

  const rawVariants = phrase.variants || [];
  const occurrences = phrase.occurrences || [];

  const map = new Map<string, { arabic: string; form: string; transliteration: string; frequency: number }>();

  // 1. Process explicit variants if present
  if (Array.isArray(rawVariants) && rawVariants.length > 0) {
    rawVariants.forEach((v: any) => {
      const rawAr = v.arabic || v.form || '';
      const normAr = normalizeVocalizedArabic(rawAr);
      if (!normAr) return;

      const key = cleanArabicVariantKeyWithVowels(normAr);
      if (!key) return;

      const freq = typeof v.frequency === 'number' ? v.frequency : 1;
      const formStr = v.form || normAr;

      if (!map.has(key)) {
        map.set(key, {
          arabic: normAr,
          form: formStr,
          transliteration: cleanVariantTransliteration(normAr, v.transliteration),
          frequency: freq
        });
      } else {
        const existing = map.get(key)!;
        existing.frequency += freq;
      }
    });
  }

  // 2. Scan occurrences for surface or variantForm
  if (Array.isArray(occurrences)) {
    occurrences.forEach((occ: any) => {
      const rawAr = occ.variantForm || occ.surface || '';
      if (!rawAr) return;
      const normAr = normalizeVocalizedArabic(rawAr);
      if (!normAr) return;

      const key = cleanArabicVariantKeyWithVowels(normAr);
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          arabic: normAr,
          form: normAr,
          transliteration: cleanVariantTransliteration(normAr),
          frequency: rawVariants.length === 0 ? 1 : 0
        });
      } else if (rawVariants.length === 0) {
        map.get(key)!.frequency++;
      }
    });
  }

  // 3. Fallback to main phrase arabic if map is still empty
  if (map.size === 0 && phrase.arabic) {
    const normAr = normalizeVocalizedArabic(phrase.arabic);
    const key = cleanArabicVariantKeyWithVowels(normAr);
    if (key) {
      map.set(key, {
        arabic: normAr,
        form: normAr,
        transliteration: cleanVariantTransliteration(normAr, phrase.transliteration),
        frequency: occurrences.length || phrase.frequency || 1
      });
    }
  }

  return Array.from(map.values())
    .filter(v => v.frequency > 0)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);
}

/**
 * Safely extract grammar note text string for a given language code.
 */
export function getGrammarNoteText(notes: Record<LanguageCode, ContextTranslation[]> | Record<string, any> | undefined, langCode: string): string {
  if (!notes) return '';
  const item = notes[langCode as LanguageCode] || notes.en;
  if (!item) return '';
  if (typeof item === 'string') return item;
  if (Array.isArray(item) && item.length > 0) {
    if (typeof item[0] === 'string') return item[0];
    if (typeof item[0] === 'object' && item[0] !== null) return item[0].text || '';
  }
  return '';
}

/**
 * Safely extract translation text string for a given language code.
 */
export function getTranslationText(trans: Record<LanguageCode, ContextTranslation[]> | Record<string, any> | undefined, langCode: string): string {
  if (!trans) return '';
  const item = trans[langCode as LanguageCode] || trans.en;
  if (!item) return '';
  if (typeof item === 'string') return item;
  if (Array.isArray(item) && item.length > 0) {
    if (typeof item[0] === 'string') return item[0];
    if (typeof item[0] === 'object' && item[0] !== null) return item[0].text || '';
  }
  return '';
}

/**
 * Normalize a single Arabic word token for whole-word orthographic comparison.
 * Never removes root or derived-form (baab/wazan) letters.
 */
export function normalizeTokenForMatch(token: string, expandDaggerAlif: boolean = false): string {
  if (!token) return '';
  let s = toArabicIfNeeded(token.trim())
    .replace(/_#/g, '\u0640\u0654')
    .replace(/#/g, '\u0654')
    .replace(/ٳ/g, 'إ')
    .replace(/ٻ/g, 'ذ')
    .replace(/ړ/g, '')
    .replace(/ټ/g, '۟')
    .replace(/ٿ/g, 'ث')
    .replace(/ڄ/g, 'ج')
    .replace(/ڃ/g, 'ح')
    .replace(/څ/g, 'خ')
    .replace(/ډ/g, 'د')
    .replace(/ۮ/g, 'ذ')
    .replace(/ژ/g, 'ز')
    .replace(/[کگ]/g, 'ك')
    .replace(/[یے]/g, 'ي');

  // Remove waqf/pause marks, annotation symbols, tatweel, and punctuation
  s = s.replace(/[\u0640\u06D6-\u06ED\u06DD\u06DE\u06E9\u06FD\u06FE\s.,،؛:?!"'()\[\]{}\-]/g, '');

  // Strip harakat except dagger alif (\u0670) first so we can inspect letter adjacency
  s = s.replace(/[\u064B-\u065F]/g, '');

  if (expandDaggerAlif) {
    // Expand medial dagger alif (\u0670) to standard alif (ا) when not adjacent to an existing alif or alif maqsurah (ى)
    s = s.replace(/(?<![اأإآٱى])\u0670(?![اأإآٱى])/g, 'ا');
  }
  s = s.replace(/\u0670/g, '');

  // Unify hamza/alif/ya orthographic representations
  s = s.replace(/[ءأإآٱ]ا/g, 'ا')
       .replace(/[أإآٱء]/g, 'ا')
       .replace(/ؤ/g, 'و')
       .replace(/[ئى]/g, 'ي')
       .replace(/اا+/g, 'ا')
       .trim();

  return s;
}

const VALID_PROCLITICS = [
  'وال',
  'فال',
  'بال',
  'كال',
  'ولل',
  'فلل',
  'ال',
  'لل',
  'فب',
  'فل',
  'وب',
  'ول',
  'وس',
  'فس',
  'و',
  'ف',
  'ب',
  'ل',
  'ك',
  'س'
];

/**
 * Determine whether a token in a Quranic verse matches a target word or phrase token
 * as a whole word (respecting root, baab, and wazan boundaries).
 * Prevents false positives such as matching "ٱفْتَرَىٰ" (Form VIII, root ف-ر-ي) when searching for "تَرَىٰٓ" (Form I, root ر-أ-ي).
 */
export function isWholeArabicWordMatch(
  verseToken: string,
  targetToken: string,
  allowProclitic: boolean = false,
  constraint?: MorphologicalConstraint
): boolean {
  if (!verseToken || !targetToken) return false;

  const vClean = toArabicIfNeeded(verseToken.trim());
  const tClean = toArabicIfNeeded(targetToken.trim());

  const vBase = normalizeTokenForMatch(vClean, false);
  const tBase = normalizeTokenForMatch(tClean, false);
  if (!vBase || !tBase) return false;

  const vExp = normalizeTokenForMatch(vClean, true);
  const tExp = normalizeTokenForMatch(tClean, true);

  // 1. Direct whole-word orthographic match (verified against grammatical root/baab/wazan constraint if present)
  if (
    vBase === tBase ||
    vExp === tExp ||
    vBase === tExp ||
    vExp === tBase
  ) {
    if (constraint && !isGrammaticallyCompatible(vClean, tClean, constraint)) {
      return false;
    }
    return true;
  }

  // Handle Uthmani silent alif after plural waw (e.g. آمَنُوا۟ vs آمَنُو)
  const stripPluralAlif = (str: string) => (str.length > 3 ? str.replace(/وا$/, 'و') : str);
  if (
    stripPluralAlif(vBase) === stripPluralAlif(tBase) ||
    stripPluralAlif(vExp) === stripPluralAlif(tExp)
  ) {
    if (constraint && !isGrammaticallyCompatible(vClean, tClean, constraint)) {
      return false;
    }
    return true;
  }

  // 2. Optional grammatical proclitic / clitic check constrained by morphological tokenization (root, baab, wazan)
  if (allowProclitic && tBase.length >= 3) {
    // First check grammatical compatibility (root, baab/form, wazan)
    if (!isGrammaticallyCompatible(vClean, tClean, constraint)) {
      return false;
    }

    const cleanVerseVocalized = vClean
      .replace(/[\u06D6-\u06DC\u06DD\u06DE\u06E9\s.,،؛:?!"'()\[\]{}\-]/g, '')
      .trim();

    // If the verse token starts with Hamzat al-Wasl (ٱ, \u0671), it can ONLY have a proclitic
    // if that proclitic is the definite article (ٱل). Otherwise it is a Form VII/VIII/X verb
    // (such as ٱفْتَرَىٰ, ٱسْتَكْبَرَ, ٱنطَلَقُوا۟) or a root starting with hamzat al-wasl.
    const startsWithHamzatWasl = cleanVerseVocalized.startsWith('\u0671');

    // Check if the first consonant of the verse token carries a sukun (\u0652 or \u06E1);
    // genuine proclitics (وَ, فَ, بِ, لِ, كَ, سَ) are always vocalized with a short vowel, never sukun.
    const firstLetterSukun = /^[^\u0621-\u064A\u0671]*[\u0621-\u064A\u0671][\u064B-\u065F]*[\u0652\u06E1]/.test(
      cleanVerseVocalized
    );

    for (const prefix of VALID_PROCLITICS) {
      if (startsWithHamzatWasl && prefix !== 'ال') continue;
      if (firstLetterSukun && prefix !== 'ال') continue;

      if (vBase.startsWith(prefix)) {
        const remBase = vBase.slice(prefix.length);
        const remExp = vExp.startsWith(prefix) ? vExp.slice(prefix.length) : remBase;
        if (
          remBase === tBase ||
          remExp === tExp ||
          remBase === tExp ||
          remExp === tBase ||
          stripPluralAlif(remBase) === stripPluralAlif(tBase)
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Compute the set of segment indices in `wordSegments` that belong to a phrase (Murakkab) occurrence.
 * Enforces contiguous multi-word sequence matching, per-word morphological constraints (`occ.roots`, `occ.lemmas`),
 * and `occ.wordStart` / `occ.wordEnd` so unrelated words sharing letter substrings are never highlighted.
 */
export function getHighlightedPhraseWordIndices(
  wordSegments: string[],
  occ: Occurrence | any,
  phraseArabic: string,
  selectedVariant?: string | null
): Set<number> {
  const highlighted = new Set<number>();
  if (!wordSegments || wordSegments.length === 0) return highlighted;

  // Map only genuine Arabic word tokens (excluding standalone waqf/pause tokens like ۗ)
  const verseWords = wordSegments
    .map((seg, segIdx) => ({
      seg,
      segIdx,
      base: normalizeTokenForMatch(seg, false),
      exp: normalizeTokenForMatch(seg, true)
    }))
    .filter(w => w.base.length > 0);

  if (verseWords.length === 0) return highlighted;

  // Candidate phrase texts in priority order (surface form in this verse -> variantForm -> selectedVariant -> canonical phrase)
  const candidatePhrases = [
    occ?.surface,
    occ?.variantForm,
    selectedVariant,
    phraseArabic
  ].filter((p): p is string => Boolean(p && p.trim()));

  // Build per-token morphological constraints from occurrence roots/lemmas when available
  const occRoots: string[] = Array.isArray(occ?.roots) ? occ.roots.map((r: string) => toArabicIfNeeded(r)) : [];
  const occLemmas: string[] = Array.isArray(occ?.lemmas) ? occ.lemmas.map((l: string) => toArabicIfNeeded(l)) : [];

  const getConstraintForToken = (tIdx: number, tokenCount: number): MorphologicalConstraint | undefined => {
    if (occRoots.length === tokenCount || occLemmas.length === tokenCount) {
      return {
        expectedRoot: occRoots[tIdx] && occRoots[tIdx] !== '-' ? occRoots[tIdx] : undefined,
        expectedLemma: occLemmas[tIdx] && occLemmas[tIdx] !== '-' ? occLemmas[tIdx] : undefined
      };
    }
    return undefined;
  };

  // Helper to find all contiguous spans in `verseWords` matching `targetTokens`
  const findContiguousSpans = (
    targetTokens: string[],
    allowFirstTokenProclitic: boolean
  ): Array<{ startWordIdx: number; segIndices: number[] }> => {
    const spans: Array<{ startWordIdx: number; segIndices: number[] }> = [];
    if (targetTokens.length === 0) return spans;

    for (let vStart = 0; vStart < verseWords.length; vStart++) {
      let vIdx = vStart;
      let tIdx = 0;
      const segIndices: number[] = [];

      while (vIdx < verseWords.length && tIdx < targetTokens.length) {
        const vWord = verseWords[vIdx];
        const tWord = targetTokens[tIdx];
        const tokenConstraint = getConstraintForToken(tIdx, targetTokens.length);

        if (
          isWholeArabicWordMatch(
            vWord.seg,
            tWord,
            allowFirstTokenProclitic && tIdx === 0,
            tokenConstraint
          )
        ) {
          segIndices.push(vWord.segIdx);
          vIdx++;
          tIdx++;
          continue;
        }

        // Handle Uthmani joined two-word tokens (such as يَٰٓأَيُّهَا = يا + أيها or هَٰٓأَنتُمْ = ها + أنتم)
        if (tIdx + 1 < targetTokens.length) {
          const combinedTargetBase =
            normalizeTokenForMatch(targetTokens[tIdx], false) +
            normalizeTokenForMatch(targetTokens[tIdx + 1], false);
          const combinedTargetExp =
            normalizeTokenForMatch(targetTokens[tIdx], true) +
            normalizeTokenForMatch(targetTokens[tIdx + 1], true);

          if (
            vWord.base === combinedTargetBase ||
            vWord.exp === combinedTargetExp ||
            vWord.base === combinedTargetExp ||
            vWord.exp === combinedTargetBase
          ) {
            segIndices.push(vWord.segIdx);
            vIdx++;
            tIdx += 2;
            continue;
          }
        }

        break;
      }

      if (tIdx === targetTokens.length && segIndices.length > 0) {
        spans.push({ startWordIdx: vStart, segIndices });
      }
    }

    return spans;
  };

  const expectedStart0 = typeof occ?.wordStart === 'number' && occ.wordStart >= 1 ? occ.wordStart - 1 : null;

  for (const candidate of candidatePhrases) {
    const targetTokens = candidate
      .split(/\s+/)
      .filter(t => normalizeTokenForMatch(t, false).length > 0);
    if (targetTokens.length === 0) continue;

    // First try strict whole-word contiguous match, then allow proclitic on first word
    let spans = findContiguousSpans(targetTokens, false);
    if (spans.length === 0) {
      spans = findContiguousSpans(targetTokens, true);
    }

    if (spans.length > 0) {
      if (expectedStart0 !== null) {
        // Choose the contiguous span closest to `occ.wordStart`
        spans.sort(
          (a, b) => Math.abs(a.startWordIdx - expectedStart0) - Math.abs(b.startWordIdx - expectedStart0)
        );
        spans[0].segIndices.forEach(idx => highlighted.add(idx));
      } else {
        spans.forEach(span => span.segIndices.forEach(idx => highlighted.add(idx)));
      }
      return highlighted;
    }
  }

  // Positional fallback if `wordStart` and `wordEnd` are provided on the occurrence
  if (
    typeof occ?.wordStart === 'number' &&
    typeof occ?.wordEnd === 'number' &&
    occ.wordStart >= 1 &&
    occ.wordEnd >= occ.wordStart
  ) {
    const start0 = Math.min(occ.wordStart - 1, verseWords.length - 1);
    const end0 = Math.min(occ.wordEnd - 1, verseWords.length - 1);
    for (let i = start0; i <= end0; i++) {
      if (verseWords[i]) {
        highlighted.add(verseWords[i].segIdx);
      }
    }
  }

  return highlighted;
}

/**
 * Compute the set of segment indices in `wordSegments` that match a single word (Mufradat) occurrence.
 * Uses `occ.word` (1-based word position) when available and strict morphological filtering (root, baab, wazan).
 */
export function getHighlightedWordIndices(
  wordSegments: string[],
  occ: Occurrence | any,
  wordArabic: string,
  selectedVariant?: string | null,
  wordMeta?: any
): Set<number> {
  const highlighted = new Set<number>();
  if (!wordSegments || wordSegments.length === 0) return highlighted;

  const verseWords = wordSegments
    .map((seg, segIdx) => ({
      seg,
      segIdx,
      base: normalizeTokenForMatch(seg, false)
    }))
    .filter(w => w.base.length > 0);

  if (verseWords.length === 0) return highlighted;

  const specificTarget = (occ?.variantForm || occ?.surface || selectedVariant || '').trim();
  const primaryTarget = (wordArabic || '').trim();
  const expectedWord0 = typeof occ?.word === 'number' && occ.word >= 1 ? occ.word - 1 : null;

  const constraint: MorphologicalConstraint = {
    expectedRoot: wordMeta?.root || (Array.isArray(occ?.roots) ? occ.roots[0] : undefined),
    expectedLemma: wordMeta?.lemma || (Array.isArray(occ?.lemmas) ? occ.lemmas[0] : undefined),
    expectedBaab: wordMeta?.grammarDetails?.derivedForm,
    expectedWazan: wordMeta?.grammarDetails?.pattern,
    expectedPos: occ?.pos || wordMeta?.pos,
    morphTag: occ?.morph
  };

  // 1. If we have an explicit 1-based word index (`occ.word`), check near that position first
  if (expectedWord0 !== null) {
    const searchOffsets = [0, -1, 1, -2, 2];
    for (const offset of searchOffsets) {
      const idx = expectedWord0 + offset;
      if (idx >= 0 && idx < verseWords.length) {
        const seg = verseWords[idx].seg;
        if (
          (specificTarget && isWholeArabicWordMatch(seg, specificTarget, true, constraint)) ||
          (primaryTarget && isWholeArabicWordMatch(seg, primaryTarget, true, constraint))
        ) {
          highlighted.add(verseWords[idx].segIdx);
          return highlighted;
        }
      }
    }
  }

  // 2. Match whole words across the verse (strict first, then with valid proclitic + grammatical filter)
  if (specificTarget) {
    verseWords.forEach(w => {
      if (isWholeArabicWordMatch(w.seg, specificTarget, false, constraint)) {
        highlighted.add(w.segIdx);
      }
    });
    if (highlighted.size > 0) return highlighted;

    verseWords.forEach(w => {
      if (isWholeArabicWordMatch(w.seg, specificTarget, true, constraint)) {
        highlighted.add(w.segIdx);
      }
    });
    if (highlighted.size > 0) return highlighted;
  }

  if (primaryTarget) {
    verseWords.forEach(w => {
      if (isWholeArabicWordMatch(w.seg, primaryTarget, false, constraint)) {
        highlighted.add(w.segIdx);
      }
    });
    if (highlighted.size > 0) return highlighted;

    verseWords.forEach(w => {
      if (isWholeArabicWordMatch(w.seg, primaryTarget, true, constraint)) {
        highlighted.add(w.segIdx);
      }
    });
  }

  return highlighted;
}

/**
 * Extract a structured morphological summary (Root, Baab, Wazan, POS) for UI verification badges.
 */
export function getWordMorphologySummary(
  arabicText: string,
  wordMeta?: any,
  occMeta?: any
): MorphologicalToken {
  const cleanArabic = normalizeVocalizedArabic(arabicText || wordMeta?.arabic || '');
  const constraint: MorphologicalConstraint = {
    expectedRoot: wordMeta?.root || (Array.isArray(occMeta?.roots) ? occMeta.roots[0] : undefined),
    expectedLemma: wordMeta?.lemma || (Array.isArray(occMeta?.lemmas) ? occMeta.lemmas[0] : undefined),
    expectedBaab: wordMeta?.grammarDetails?.derivedForm,
    expectedWazan: wordMeta?.grammarDetails?.pattern,
    expectedPos: occMeta?.pos || wordMeta?.pos,
    morphTag: occMeta?.morph
  };
  return tokenizeArabicMorphology(cleanArabic, constraint);
}

/**
 * Find all words in the Quranic corpus that share the same trilateral/quadrilateral root
 * for Ishtiqaaq (المشتقات الجذرية / Root Family Explorer).
 */
export function getRootFamilyWords(
  targetWord: any,
  allWords: any[],
  limit?: number
): Array<{
  word: any;
  morph: MorphologicalToken;
}> {
  if (!targetWord || !allWords || allWords.length === 0) return [];

  const targetMorph = getWordMorphologySummary(targetWord.arabic, targetWord);
  const targetRootRaw = targetWord.formattedRoot || targetWord.root || targetMorph.root;
  if (!targetRootRaw || targetRootRaw === 'N/A') return [];

  const cleanTargetRoot = removeDiacritics(toArabicIfNeeded(targetRootRaw))
    .replace(/[^ابتثجحخدذرزسشصضطظعغفقكلمنهويءأإآٱؤئى]/g, '');

  if (cleanTargetRoot.length < 2) return [];

  const family: Array<{ word: any; morph: MorphologicalToken }> = [];

  for (const w of allWords) {
    if (!w) continue;
    const wRootRaw = w.formattedRoot || w.root || '';
    const cleanWRoot = removeDiacritics(toArabicIfNeeded(wRootRaw))
      .replace(/[^ابتثجحخدذرزسشصضطظعغفقكلمنهويءأإآٱؤئى]/g, '');

    if (!cleanWRoot) continue;

    // Exact consonant match on canonical root (normalized hamzas/alifs)
    const normA = cleanTargetRoot.replace(/[أإآٱء]/g, 'ا').replace(/[ئى]/g, 'ي');
    const normB = cleanWRoot.replace(/[أإآٱء]/g, 'ا').replace(/[ئى]/g, 'ي');

    if (normA === normB) {
      family.push({
        word: w,
        morph: getWordMorphologySummary(w.arabic, w)
      });
    }
  }

  const sorted = family.sort((a, b) => (b.word.frequency || 0) - (a.word.frequency || 0));
  return typeof limit === 'number' && limit > 0 ? sorted.slice(0, limit) : sorted;
}


