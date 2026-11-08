#!/usr/bin/env node

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Enhanced data preparation script - converts gzipped data to JSON for the app
 * Enriches raw data with translations, transliterations, and metadata
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { createReadStream, createWriteStream } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure public/data directory exists
const publicDataDir = path.join(__dirname, '..', 'public', 'data');
if (!fs.existsSync(publicDataDir)) {
  fs.mkdirSync(publicDataDir, { recursive: true });
}

/**
 * Decompress and convert gzipped JSON files to plain JSON
 */
async function decompressFile(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const gunzip = zlib.createGunzip();
    const source = createReadStream(inputPath);
    const destination = createWriteStream(outputPath);

    source
      .pipe(gunzip)
      .pipe(destination)
      .on('finish', () => {
        resolve();
      })
      .on('error', (err) => {
        console.error(`✗ Error processing ${inputPath}:`, err.message);
        reject(err);
      });
  });
}

/**
 * Enrich phrase data with translations and metadata
 * Returns null if phrase doesn't have text (filters out empty entries)
 * 
 * Accepts both Arabic Unicode and Buckwalter transliteration format
 * Buckwalter is a standard ASCII transliteration system used in Quranic corpus
 */
function enrichMurakkab(rawPhrase, index) {
  // Try multiple field names for phrase text
  const phraseText = rawPhrase.arabic || rawPhrase.text || rawPhrase.phrase || '';
  
  if (!phraseText || phraseText.trim() === '') return null;
  
  // Accept both Arabic Unicode and Buckwalter transliteration
  // Buckwalter uses special characters but is valid Quranic data
  // Only filter out pure English words without any Arabic/transliteration markers
  
  // Check if it's pure English (no Arabic, no Buckwalter markers)
  const isPureEnglish = /^[a-zA-Z\s]+$/.test(phraseText);
  if (isPureEnglish) {
    return null;  // Skip pure English entries
  }
  
  return {
    id: rawPhrase.id || `phrase_${index}`,
    arabic: phraseText,  // Keep original format (Buckwalter or Arabic)
    transliteration: rawPhrase.transliteration || rawPhrase.trans || rawPhrase.transliterated || phraseText,
    translations: {
      en: rawPhrase.en || rawPhrase.meaning || rawPhrase.translation || rawPhrase.translations?.en || '',
      ur: rawPhrase.ur || rawPhrase.translations?.ur || '',
      tr: rawPhrase.tr || rawPhrase.translations?.tr || '',
      id: rawPhrase.id_lang || rawPhrase.translations?.id || ''
    },
    frequency: rawPhrase.frequency || rawPhrase.count || 1,
    occurrences: rawPhrase.occurrences || [],
    grammarNotes: {
      en: rawPhrase.grammarNotes?.en || rawPhrase.grammar || rawPhrase.type || '',
      ur: rawPhrase.grammarNotes?.ur || '',
      tr: rawPhrase.grammarNotes?.tr || '',
      id: rawPhrase.grammarNotes?.id || ''
    },
    learnedState: 'new',
    themes: rawPhrase.themes || rawPhrase.categories || []
  };
}

/**
 * Enrich word data with translations and metadata
 * Returns null if word doesn't have text (filters out empty entries)
 * 
 * Accepts both Arabic Unicode and Buckwalter transliteration format
 * Buckwalter is a standard ASCII transliteration system used in Quranic corpus
 */
function enrichWord(rawWord, index) {
  const arabic = rawWord.arabic || rawWord.text || '';
  
  if (!arabic || arabic.trim() === '') return null;
  
  // Accept both Arabic Unicode and Buckwalter transliteration
  // Buckwalter uses special characters but is valid Quranic data
  // Only filter out pure English words without any Arabic/transliteration markers
  
  // Check if it's pure English (no Arabic, no Buckwalter markers)
  const isPureEnglish = /^[a-zA-Z\s]+$/.test(arabic);
  if (isPureEnglish) {
    return null;  // Skip pure English entries
  }
  
  return {
    id: rawWord.id || `word_${index}`,
    arabic: arabic,  // Keep original format (Buckwalter or Arabic)
    transliteration: rawWord.transliteration || rawWord.trans || rawWord.transliterated || arabic,
    root: rawWord.root || rawWord.lemma || rawWord.lemmaRoot || '',
    pos: rawWord.pos || rawWord.posTag || rawWord.partOfSpeech || 'UNKNOWN',
    frequency: rawWord.frequency || rawWord.count || 1,
    translations: {
      en: rawWord.en || rawWord.meaning || rawWord.translation || rawWord.translations?.en || '',
      ur: rawWord.ur || rawWord.translations?.ur || '',
      tr: rawWord.tr || rawWord.translations?.tr || '',
      id: rawWord.id_lang || rawWord.translations?.id || ''
    },
    occurrences: rawWord.occurrences || [],
    themes: rawWord.themes || rawWord.categories || [],
    learnedState: 'new',
    isCore: false,  // Will be set based on frequency ranking
    grammarDetails: {
      gender: rawWord.gender || rawWord.grammarDetails?.gender,
      number: rawWord.number || rawWord.grammarDetails?.number,
      derivedForm: rawWord.derivedForm || rawWord.grammarDetails?.derivedForm
    }
  };
}

/**
 * Convert Buckwalter transliteration to Arabic Unicode
 */
function buckwalterToArabic(buckwalter) {
  const map = {
    // Consonants
    "'": '\u0621', // hamza (ء)
    '|': '\u0622', // alif madda (آ)
    '>': '\u0623', // alif with hamza above (أ)
    '&': '\u0624', // waw with hamza above (ؤ)
    '<': '\u0625', // alif with hamza below (إ)
    '}': '\u0626', // ya with hamza above (ئ)
    'A': '\u0627', // bare alif (ا)
    'b': '\u0628', // ba (ب)
    'p': '\u0629', // ta marbuta (ة)
    't': '\u062A', // ta (ت)
    'v': '\u062B', // tha (ث)
    'j': '\u062C', // jim (ج)
    'H': '\u062D', // ha (ح)
    'x': '\u062E', // kha (خ)
    'd': '\u062F', // dal (د)
    '*': '\u0630', // dhal (ذ)
    'r': '\u0631', // ra (ر)
    'z': '\u0632', // zay (ز)
    's': '\u0633', // sin (س)
    '$': '\u0634', // shin (ش) - STANDARD BUCKWALTER
    'S': '\u0635', // sad (ص)  - STANDARD BUCKWALTER
    'D': '\u0636', // dad (ض)
    'T': '\u0637', // ta emphatic (ط)
    'Z': '\u0638', // za emphatic (ظ)
    'E': '\u0639', // ayn (ع)
    'g': '\u063A', // ghayn (غ)
    '_': '\u0640', // tatweel (ـ)
    'f': '\u0641', // fa (ف)
    'q': '\u0642', // qaf (ق)
    'k': '\u0643', // kaf (ك)
    'l': '\u0644', // lam (ل)
    'I': '\u0644', // lam capital I (ل)
    'm': '\u0645', // mim (م)
    'n': '\u0646', // nun (ن)
    'h': '\u0647', // ha (ه)
    'w': '\u0648', // waw (و)
    'Y': '\u0649', // alif maqsura (ى)
    'y': '\u064A', // ya (ي)

    // Diacritics and Short Vowels
    'a': '\u064E', // fatha
    'u': '\u064F', // damma
    'i': '\u0650', // kasra
    '~': '\u0651', // shaddah
    '^': '\u0651', // shaddah alternative
    'o': '\u0652', // sukun
    'O': '\u0652', // sukun alternative
    'F': '\u064B', // tanwin fath
    'N': '\u064C', // tanwin damm
    'K': '\u064D', // tanwin kasr
    '`': '\u0670', // superscript alif (dagger alif)
    'W': '\u0670', // superscript alif
    '{': '\u0671', // alif wasla (ٱ)
    'c': '\u0672', // alif with wavy hamza below
    '@': '\u06DF', // small rounded zero above (silent alif marker)

    // Strip formatting artifacts
    '#': '',
    '[': '',
    ']': '',
    '!': '',
    '"': '',
    '%': '',
    '+': '',
    ',': '',
    '-': '',
    '.': '',
    ':': '',
    ';': ''
  };
  
  let arabic = '';
  for (let i = 0; i < buckwalter.length; i++) {
    const char = buckwalter[i];
    arabic += map[char] !== undefined ? map[char] : char;
  }
  return arabic;
}

/**
 * Extract all unique words from ayah data to reach 14,870 unique Quran words
 */
async function extractWordsFromAyahs() {
  const baseDir = path.join(__dirname, '..', 'data', 'quran_by_surah');
  const uniqueWords = new Map(); // Use Map to track unique words by their surface form

  console.log('  Extracting words from ayah data...');

  const files = fs.readdirSync(baseDir).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const inputPath = path.join(baseDir, file);
    try {
      const rawContent = fs.readFileSync(inputPath, 'utf8');
      const surahData = JSON.parse(rawContent);

      if (surahData.verses && Array.isArray(surahData.verses)) {
        for (const verse of surahData.verses) {
          if (verse.words && Array.isArray(verse.words)) {
            for (const word of verse.words) {
              const surface = word.surface || word.lemma || '';
              if (surface && surface.trim() !== '') {
                // Only add if not already in the map
                if (!uniqueWords.has(surface)) {
                  // Convert Buckwalter to Arabic Unicode
                  const arabicText = buckwalterToArabic(surface);
                  uniqueWords.set(surface, {
                    arabic: arabicText,
                    transliteration: surface, // Keep original as transliteration
                    root: word.root || '',
                    pos: word.primary_pos || word.pos || 'UNKNOWN',
                    frequency: 1, // Will be updated later
                    translations: {
                      en: '',
                      ur: '',
                      tr: '',
                      id: ''
                    },
                    occurrences: [],
                    themes: [],
                    learnedState: 'new',
                    isCore: false,
                    grammarDetails: {
                      gender: null,
                      number: null,
                      derivedForm: null
                    }
                  });
                } else {
                  // Increment frequency
                  const existing = uniqueWords.get(surface);
                  existing.frequency = (existing.frequency || 0) + 1;
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn(`    ⚠ Error processing ${file}:`, error.message);
    }
  }

  console.log(`  Extracted ${uniqueWords.size} unique words from ayah data`);
  return Array.from(uniqueWords.values());
}

/**
 * Process word data - extract from quran_corpus_db.json with comprehensive fields
 */
async function processWords() {
  const inputPath = path.join(__dirname, '..', 'data', 'quran_corpus_db.json');
  const outputPath = path.join(publicDataDir, 'words.json');
  const chunksDir = path.join(publicDataDir, 'words-chunks');

  let enrichedWords = [];

  // First, try to extract words from ayah data to get all 14,870 unique words
  const ayahWords = await extractWordsFromAyahs();
  
  if (ayahWords.length > 0) {
    enrichedWords = ayahWords;
    console.log(`  Using ${enrichedWords.length} words extracted from ayah data`);
  } else if (fs.existsSync(inputPath)) {
    // Fallback to quran_corpus_db.json if ayah extraction fails
    const rawData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    const rawWords = rawData.words || [];
    
    console.log(`  Processing ${rawWords.length} words from quran_corpus_db.json`);
    
    // Enrich words with comprehensive data from original source
    enrichedWords = rawWords
      .map((word, idx) => {
        const arabic = word.lemma || '';
        
        if (!arabic || arabic.trim() === '') return null;
        
        // Accept both Arabic Unicode and Buckwalter transliteration
        // Only filter out pure English words without any Arabic/transliteration markers
        const isPureEnglish = /^[a-zA-Z\s]+$/.test(arabic);
        if (isPureEnglish) {
          return null;  // Skip pure English entries
        }
        
        return {
          id: `word_${idx}`,
          arabic: arabic,
          transliteration: word.lemma || '',
          root: word.root || '',
          pos: word.dominant_pos || 'UNKNOWN',
          posLabel: word.dominant_pos_label || '',
          frequency: word.total_occurrences || 1,
          uniqueVerseCount: word.unique_verse_count || 0,
          verseReferences: word.verse_references || [],
          translations: {
            en: '',
            ur: '',
            tr: '',
            id: ''
          },
          themes: [],
          learnedState: 'new',
          isCore: false,
          grammarDetails: {
            gender: null,
            number: null,
            derivedForm: null
          }
        };
      })
      .filter(word => word !== null);  // Remove null entries (English-only words)
  } else {
    console.warn(`⚠ No word data available`);
    fs.writeFileSync(outputPath, JSON.stringify({ words: [] }, null, 2));
    return;
  }

  try {
    // Create chunks directory
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir, { recursive: true });
    }
    
    // Add IDs to ayah-extracted words if they don't have them
    enrichedWords = enrichedWords.map((word, idx) => ({
      ...word,
      id: word.id || `word_${idx}`
    }));
    
    // Sort by frequency descending to identify core words (top 800)
    const sortedByFreq = [...enrichedWords].sort((a, b) => b.frequency - a.frequency);
    const coreWordIds = new Set(sortedByFreq.slice(0, 800).map(w => w.id));
    
    // Mark core words
    enrichedWords.forEach(word => {
      word.isCore = coreWordIds.has(word.id);
    });
    
    // Create index file for quick lookups
    const index = enrichedWords.map(w => ({
      id: w.id,
      arabic: w.arabic,
      frequency: w.frequency,
      isCore: w.isCore
    }));
    fs.writeFileSync(path.join(publicDataDir, 'words-index.json'), JSON.stringify({ index }, null, 2));
    
    // Create chunks (100 words per chunk for fast loading)
    const chunks = [];
    for (let i = 0; i < enrichedWords.length; i += 100) {
      const chunk = enrichedWords.slice(i, i + 100);
      chunks.push(chunk);
      fs.writeFileSync(
        path.join(chunksDir, `chunk-${Math.floor(i / 100)}.json`),
        JSON.stringify({ words: chunk }, null, 2)
      );
    }
    
    // Write main file with metadata
    fs.writeFileSync(outputPath, JSON.stringify({
      words: enrichedWords,
      metadata: {
        total: enrichedWords.length,
        core: coreWordIds.size,
        chunks: chunks.length,
        chunkSize: 100
      }
    }, null, 2));
    
    console.log(`✓ Processed words: ${enrichedWords.length} words (${coreWordIds.size} core)`);
    console.log(`  Created ${chunks.length} chunks of 100 words each`);
  } catch (error) {
    console.error('Failed to process words:', error.message);
    fs.writeFileSync(outputPath, JSON.stringify({ words: [] }, null, 2));
  }
}

/**
 * Process murakkabat (phrases) data - process from quran_murakkabat_db with chunking
 */
async function processMurakkabat() {
  const baseDir = path.join(__dirname, '..', 'data', 'quran_murakkabat_db');
  const outputPath = path.join(publicDataDir, 'murakkabat.json');
  const chunksDir = path.join(publicDataDir, 'murakkabat-chunks');

  if (!fs.existsSync(baseDir)) {
    console.warn(`⚠ Quran murakkabat_db directory not found: ${baseDir}`);
    fs.writeFileSync(outputPath, JSON.stringify({ murakkabat: [] }, null, 2));
    return;
  }

  try {
    let phraseCount = 0;
    let skippedCount = 0;
    const seenIds = new Set(); // Track IDs to deduplicate
    const allPhrases = []; // Collect all phrases first for chunking
    
    // Create chunks directory
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir, { recursive: true });
    }
    
    // Process surface ngrams (most comprehensive phrase data)
    const ngramFiles = [
      '02_surface_ngrams_n2.json',
      '02_surface_ngrams_n3.json',
      '02_surface_ngrams_n4.json',
      '02_surface_ngrams_n5to8.json'
    ];
    
    console.log(`  Processing murakkabat from quran_murakkabat_db: ${ngramFiles.length} files`);

    for (let fileIdx = 0; fileIdx < ngramFiles.length; fileIdx++) {
      const file = ngramFiles[fileIdx];
      const inputPath = path.join(baseDir, file);

      try {
        const rawContent = fs.readFileSync(inputPath, 'utf-8');
        const content = JSON.parse(rawContent);
        
        // Handle different formats
        let phrases = [];
        if (content.data && Array.isArray(content.data)) {
          phrases = content.data;
        } else if (Array.isArray(content)) {
          phrases = content;
        } else if (content.ngrams && Array.isArray(content.ngrams)) {
          phrases = content.ngrams;
        } else if (content.phrases && Array.isArray(content.phrases)) {
          phrases = content.phrases;
        }
        
        // Process each phrase
        for (const phrase of phrases) {
          if (!phrase || typeof phrase !== 'object') continue;
          
          const phraseText = phrase.key || phrase.phrase || phrase.text || phrase.surface || phrase.lemma || phrase.root || '';
          const phraseId = phrase.key || phrase.id || phraseText;
          
          // Skip if we've already seen this ID (deduplication)
          if (phraseId && seenIds.has(phraseId)) {
            skippedCount++;
            continue;
          }
          
          if (phraseId) {
            seenIds.add(phraseId);
          }
          
          // Skip empty phrases
          if (!phraseText || phraseText.trim() === '') {
            skippedCount++;
            continue;
          }
          
          // Accept both Arabic Unicode and Buckwalter transliteration
          // Only filter out pure English words without any Arabic/transliteration markers
          const isPureEnglish = /^[a-zA-Z\s]+$/.test(phraseText);
          if (isPureEnglish) {
            skippedCount++;
            continue;  // Skip pure English entries
          }
          
          // Convert Buckwalter to Arabic Unicode
          const arabicText = buckwalterToArabic(phraseText);
          
          const phraseObj = {
            id: phraseId,
            arabic: arabicText,
            transliteration: phraseText, // Keep original as transliteration
            n: phrase.n || 2,
            frequency: phrase.frequency || phrase.count || 1,
            isHapax: phrase.is_hapax || false,
            scope: phrase.scope || '',
            surahDistribution: phrase.surah_distribution || [],
            translations: {
              en: phrase.en || phrase.meaning || phrase.translation || phrase.translations?.en || '',
              ur: phrase.ur || phrase.translations?.ur || '',
              tr: phrase.tr || phrase.translations?.tr || '',
              id: phrase.id_lang || phrase.translations?.id || ''
            },
            occurrences: phrase.occurrences || [],
            grammarNotes: {
              en: phrase.grammar || phrase.type || phrase.pattern || phrase.scope || '',
              ur: phrase.grammarNotes?.ur || '',
              tr: phrase.grammarNotes?.tr || '',
              id: phrase.grammarNotes?.id || ''
            },
            learnedState: 'new',
            themes: phrase.themes || phrase.categories || []
          };
          
          allPhrases.push(phraseObj);
          phraseCount++;
        }
        
        // Progress indicator
        process.stdout.write(`    Processed: ${fileIdx + 1}/${ngramFiles.length} files (${phraseCount} unique phrases, ${skippedCount} skipped)...\r`);
      } catch (error) {
        console.warn(`    ⚠ Skipped malformed file: ${file}`, error.message);
        continue;
      }
    }
    process.stdout.write('\n');

    // Sort phrases by frequency descending
    allPhrases.sort((a, b) => b.frequency - a.frequency);
    
    // Create index file for quick lookups
    const index = allPhrases.map(p => ({
      id: p.id,
      arabic: p.arabic,
      frequency: p.frequency,
      n: p.n
    }));
    fs.writeFileSync(path.join(publicDataDir, 'murakkabat-index.json'), JSON.stringify({ index }, null, 2));
    
    // Create chunks (1000 phrases per chunk for fast loading)
    const chunks = [];
    for (let i = 0; i < allPhrases.length; i += 1000) {
      const chunk = allPhrases.slice(i, i + 1000);
      chunks.push(chunk);
      fs.writeFileSync(
        path.join(chunksDir, `chunk-${Math.floor(i / 1000)}.json`),
        JSON.stringify({ murakkabat: chunk }, null, 2)
      );
    }
    
    // Write main file with metadata
    fs.writeFileSync(outputPath, JSON.stringify({
      murakkabat: allPhrases,
      metadata: {
        total: allPhrases.length,
        chunks: chunks.length,
        chunkSize: 1000
      }
    }, null, 2));
    
    console.log(`✓ Processed murakkabat: ${phraseCount} unique phrases (${skippedCount} duplicates/corrupted filtered out)`);
    console.log(`  Created ${chunks.length} chunks of 1000 phrases each`);
  } catch (error) {
    console.error('Failed to process murakkabat:', error.message);
    fs.writeFileSync(path.join(publicDataDir, 'murakkabat.json'), JSON.stringify({ murakkabat: [] }, null, 2));
  }
}

/**
 * Process ayahs data - extract all verses from quran_by_surah directory with chunking
 */
async function processAyahs() {
  const baseDir = path.join(__dirname, '..', 'data', 'quran_by_surah');
  const outputPath = path.join(publicDataDir, 'ayahs.json');
  const chunksDir = path.join(publicDataDir, 'ayahs-chunks');

  if (!fs.existsSync(baseDir)) {
    console.warn(`⚠ Quran by_surah directory not found: ${baseDir}`);
    fs.writeFileSync(outputPath, JSON.stringify({ ayahs: [] }, null, 2));
    return;
  }

  try {
    let ayahCount = 0;
    let skippedCount = 0;
    const seenIds = new Set(); // Track IDs to deduplicate
    const allAyahs = []; // Collect all ayahs first for chunking
    
    // Create chunks directory
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir, { recursive: true });
    }
    
    const files = fs.readdirSync(baseDir).filter((f) => f.endsWith('.json'));
    console.log(`  Processing ayahs from quran_by_surah: ${files.length} files`);

    for (let idx = 0; idx < files.length; idx++) {
      const inputPath = path.join(baseDir, files[idx]);
      
      try {
        const rawContent = fs.readFileSync(inputPath, 'utf-8');
        const surahData = JSON.parse(rawContent);
        
        // Extract verses from surah data
        if (surahData.verses && Array.isArray(surahData.verses)) {
          for (const verse of surahData.verses) {
            if (!verse || typeof verse !== 'object') continue;
            
            const surahNum = verse.surah || surahData.surah;
            const ayahNum = verse.ayah || verse.ayahNum || 1;
            const ayahId = verse.verse_ref || `${surahNum}:${ayahNum}`;
            
            // Skip if we've already seen this ID (deduplication)
            if (ayahId && seenIds.has(ayahId)) {
              skippedCount++;
              continue;
            }
            
            if (ayahId) {
              seenIds.add(ayahId);
            }
            
            // Use buckwalter transliteration as Arabic text (convert to Arabic Unicode)
            // If buckwalter is not available, try to construct from words array
            let buckwalterText = verse.buckwalter || verse.arabicText || verse.text || verse.arabic || '';
            
            // If no direct text field, try to construct from words array
            if ((!buckwalterText || buckwalterText.trim() === '') && verse.words && Array.isArray(verse.words)) {
              buckwalterText = verse.words.map(w => w.surface || w.lemma || '').join(' ');
            }
            
            // Convert Buckwalter to Arabic Unicode
            let arabicText = buckwalterToArabic(buckwalterText);
            
            // Skip ayahs without any text
            if (!arabicText || arabicText.trim() === '') {
              console.warn(`    ⚠ Skipping empty ayah: ${ayahId}`);
              skippedCount++;
              continue;
            }
            
            // Accept both Arabic Unicode and Buckwalter transliteration
            // Only filter out pure English words without any Arabic/transliteration markers
            // Check for Arabic Unicode characters first
            const hasArabicUnicode = /[\u0600-\u06FF]/.test(arabicText);
            
            // If no Arabic Unicode, check if it's Buckwalter (ASCII but not actual English)
            // Buckwalter uses characters like ~ > < & | } { and short consonant combinations
            // We'll accept any ASCII text that's not common English words
            const commonEnglishWords = /\b(the|and|of|to|in|a|is|that|for|it|with|as|was|on|at|by|be|this|which|or|from|but|not|are|have|had|has|will|would|could|should|may|might|must|shall|can|need|dare|ought)\b/i;
            const isPureEnglish = !hasArabicUnicode && 
                                  /^[a-zA-Z\s]+$/.test(arabicText) && 
                                  commonEnglishWords.test(arabicText);
            
            if (isPureEnglish) {
              console.warn(`    ⚠ Skipping pure English ayah: ${ayahId}`);
              skippedCount++;
              continue;  // Skip pure English entries
            }
            
            const ayahObj = {
              id: ayahId,
              surah: surahNum,
              ayahNum: ayahNum,
              surahName: verse.surah_name || surahData.name || '',
              surahNameArabic: verse.surah_arabic || surahData.arabic_name || '',
              surahNameUrdu: verse.surah_urdu || surahData.urdu_name || '',
              surahEnglishMeaning: surahData.english_meaning || '',
              arabicText: arabicText,
              transliteration: verse.transliteration || verse.trans || '',
              juz: verse.juz || 1,
              hizb: verse.hizb || 1,
              hizbQuarter: verse.hizb_quarter || 1,
              manzil: verse.manzil || 1,
              sajda: verse.is_sajda_verse || false,
              statistics: verse.statistics || {},
              translations: {
                en: verse.en || verse.translation || verse.translations?.en || '',
                ur: verse.ur || verse.translations?.ur || '',
                tr: verse.tr || verse.translations?.tr || '',
                id: verse.id_lang || verse.translations?.id || ''
              },
              wordIds: verse.wordIds || [],
              phraseIds: verse.phraseIds || [],
              themes: verse.themes || [],
              revelationPeriod: verse.revelation_type || surahData.revelation_type || 'Meccan',
              revelationOrder: surahData.order_of_revelation || 1,
              learnedState: 'new'
            };
            
            allAyahs.push(ayahObj);
            ayahCount++;
          }
        }
        
        // Progress indicator
        if ((idx + 1) % 20 === 0) {
          process.stdout.write(`    Processed: ${idx + 1}/${files.length} files (${ayahCount} unique verses, ${skippedCount} skipped)...\r`);
        }
      } catch (error) {
        console.warn(`    ⚠ Skipped malformed file: ${files[idx]}`, error.message);
        continue;
      }
    }
    
    process.stdout.write('\n');
    
    // Sort ayahs by surah number and ayah number for correct Quran sequence
    allAyahs.sort((a, b) => {
      if (a.surah !== b.surah) {
        return a.surah - b.surah;
      }
      return a.ayahNum - b.ayahNum;
    });
    
    // Create index file for quick lookups
    const index = allAyahs.map(a => ({
      id: a.id,
      surah: a.surah,
      ayahNum: a.ayahNum,
      surahName: a.surahName
    }));
    fs.writeFileSync(path.join(publicDataDir, 'ayahs-index.json'), JSON.stringify({ index }, null, 2));
    
    // Create chunks by surah (each surah as a chunk for logical loading)
    const chunks = [];
    const ayahsBySurah = {};
    allAyahs.forEach(ayah => {
      if (!ayahsBySurah[ayah.surah]) {
        ayahsBySurah[ayah.surah] = [];
      }
      ayahsBySurah[ayah.surah].push(ayah);
    });
    
    Object.keys(ayahsBySurah).sort((a, b) => parseInt(a) - parseInt(b)).forEach(surahNum => {
      const surahAyahs = ayahsBySurah[surahNum];
      chunks.push(surahAyahs);
      fs.writeFileSync(
        path.join(chunksDir, `surah-${surahNum}.json`),
        JSON.stringify({ ayahs: surahAyahs }, null, 2)
      );
    });
    
    // Write main file with metadata
    fs.writeFileSync(outputPath, JSON.stringify({
      ayahs: allAyahs,
      metadata: {
        total: allAyahs.length,
        surahs: chunks.length,
        chunkType: 'by_surah'
      }
    }, null, 2));
    
    console.log(`✓ Processed ayahs: ${ayahCount} unique verses (${skippedCount} duplicates/corrupted filtered out)`);
    console.log(`  Created ${chunks.length} chunks (1 per surah)`);
  } catch (error) {
    console.error('Failed to process ayahs:', error.message);
    fs.writeFileSync(outputPath, JSON.stringify({ ayahs: [] }, null, 2));
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🔄 Preparing Quran vocabulary data...\n');

  const rawDataDir = path.join(__dirname, '..', 'data');
  const quranBySurahDir = path.join(rawDataDir, 'quran_by_surah');
  const wordsOut = path.join(publicDataDir, 'words.json');

  if (!fs.existsSync(quranBySurahDir)) {
    console.log('⚠️  Raw data subdirectories (like "data/quran_by_surah") not found.');
    if (fs.existsSync(wordsOut)) {
      console.log('✅ Clean processed data files (words.json) already exist in public/data. Skipping data preparation.');
      process.exit(0);
    } else {
      console.error('❌ Clean processed words.json does not exist and raw data was not found. Cannot proceed.');
      process.exit(1);
    }
  }

  try {
    console.log('Step 1: Processing words...');
    await processWords();
    
    console.log('\nStep 2: Processing murakkabat (phrases)...');
    await processMurakkabat();
    
    console.log('\nStep 3: Processing ayahs (verses)...');
    await processAyahs();

    console.log('\n✅ Data preparation complete!');
    console.log('Generated files in public/data/:');
    console.log('  - words.json');
    console.log('  - murakkabat.json');
    console.log('  - ayahs.json');
  } catch (error) {
    console.error('\n❌ Data preparation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
main();
