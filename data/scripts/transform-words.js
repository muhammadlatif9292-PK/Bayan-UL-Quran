#!/usr/bin/env node

/**
 * Quranic Words Data Transformation Script
 * 
 * This script transforms the existing single words data into an optimized structure:
 * - Creates individual word files for lazy loading
 * - Creates frequency-based indexes
 * - Creates surah-based indexes
 * - Creates POS-based indexes
 * - Compresses output files
 */

const fs = require('fs');
const path = require('path');
const { gzipSync } = require('zlib');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

const SOURCE_DIR = path.join(__dirname, '../single words tracks');
const CORPUS_DIR = path.join(__dirname, '../data/optimized/corpus');
const OUTPUT_DIR = path.join(__dirname, '../data/optimized/words');

// Language codes
const LANGUAGES = {
  english: 'en',
  urdu: 'ur',
  hindi: 'hi',
  turkish: 'tr',
  indonesian: 'id',
  malay: 'ms',
  bengali: 'bn',
  french: 'fr',
  german: 'de',
  spanish: 'es',
  russian: 'ru',
  swahili: 'sw',
  hausa: 'ha',
  hebrew: 'he'
};

/**
 * Load all trackA JSON files
 */
async function loadTrackAData() {
  console.log('Loading TrackA data...');
  const trackAFiles = fs.readdirSync(SOURCE_DIR)
    .filter(f => f.startsWith('trackA_') && f.endsWith('.json'))
    .sort();
  
  const allWords = [];
  
  for (const file of trackAFiles) {
    console.log(`  Loading ${file}...`);
    const filePath = path.join(SOURCE_DIR, file);
    let content = await readFile(filePath, 'utf8');
    
    // Remove BOM if present
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    
    // Trim whitespace
    content = content.trim();
    
    const data = JSON.parse(content);
    allWords.push(...data);
  }
  
  console.log(`Loaded ${allWords.length} words from TrackA`);
  return allWords;
}

async function loadTrackBData() {
  console.log('Loading TrackB data...');
  const trackBFiles = fs.readdirSync(SOURCE_DIR)
    .filter(f => f.startsWith('trackB_') && f.endsWith('.json'))
    .sort();
  
  const allWords = [];
  
  for (const file of trackBFiles) {
    console.log(`  Loading ${file}...`);
    const filePath = path.join(SOURCE_DIR, file);
    let content = await readFile(filePath, 'utf8');
    
    // Remove BOM if present
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    
    // Trim whitespace
    content = content.trim();
    
    const data = JSON.parse(content);
    allWords.push(...data);
  }
  
  console.log(`Loaded ${allWords.length} words from TrackB`);
  return allWords;
}

async function loadCorpusMorphology() {
  console.log('Loading corpus morphology data...');
  try {
    const filePath = path.join(CORPUS_DIR, 'corpus_reference.json.gz');
    const data = await readFile(filePath);
    const decompressed = require('zlib').gunzipSync(data);
    const corpusData = JSON.parse(decompressed.toString());
    console.log(`Loaded corpus morphology with ${Object.keys(corpusData.tag_reference).length} morphological tags`);
    return corpusData;
  } catch (error) {
    console.log('Corpus morphology not found, skipping...');
    return null;
  }
}

/**
 * Normalize word data structure
 */
function normalizeWord(word, corpusMorphology = null) {
  // Extract translations by language
  const translations = { native: {}, helper: {} };
  const transliterations = {};
  const pronunciations = {};
  
  if (word.meanings) {
    for (const [lang, translation] of Object.entries(word.meanings)) {
      const langCode = LANGUAGES[lang] || lang;
      translations.native[langCode] = translation;
      translations.helper[langCode] = translation;
    }
  }
  
  // Add transliterations for each language
  if (word.transliteration) {
    for (const lang of Object.keys(LANGUAGES)) {
      const langCode = LANGUAGES[lang];
      transliterations[langCode] = word.transliteration;
      pronunciations[langCode] = `/${word.transliteration}/`;
    }
  }
  
  // Extract semantic tags
  const semanticTags = [];
  if (word.semanticTags) {
    semanticTags.push(...word.semanticTags);
  }
  
  // Build ayah references
  const ayahRefs = [];
  if (word.verses) {
    for (const verse of word.verses) {
      ayahRefs.push(`${verse.surah}:${verse.verse}`);
    }
  }
  
  // Extract POS from morphology
  let pos = 'UNKNOWN';
  let posTag = null;
  let posTagMeaning = null;
  
  if (word.morphology && typeof word.morphology === 'string') {
    const morphLower = word.morphology.toLowerCase();
    if (morphLower.includes('noun')) pos = 'N';
    else if (morphLower.includes('verb')) pos = 'V';
    else if (morphLower.includes('conjunction')) pos = 'CONJ';
    else if (morphLower.includes('preposition')) pos = 'P';
    else if (morphLower.includes('pronoun')) pos = 'PRON';
    else if (morphLower.includes('particle')) pos = 'PART';
  } else if (word.wordType) {
    // Fallback to wordType
    const typeLower = word.wordType.toLowerCase();
    if (typeLower.includes('noun') || typeLower.includes('اسم')) pos = 'N';
    else if (typeLower.includes('verb') || typeLower.includes('فعل')) pos = 'V';
    else if (typeLower.includes('conjunction') || typeLower.includes('حرف')) pos = 'CONJ';
    else if (typeLower.includes('preposition') || typeLower.includes('جر')) pos = 'P';
    else if (typeLower.includes('pronoun') || typeLower.includes('ضمير')) pos = 'PRON';
    else if (typeLower.includes('particle') || typeLower.includes('حرف')) pos = 'PART';
  }
  
  // Get POS tag and meaning from corpus morphology (ilmussarf)
  if (corpusMorphology && corpusMorphology.tag_reference) {
    const posMapping = {
      'N': 'N',
      'V': 'V',
      'PRON': 'PRON',
      'P': 'P',
      'CONJ': 'CONJ',
      'PART': 'PART'
    };
    posTag = posMapping[pos] || null;
    if (posTag && corpusMorphology.tag_reference[posTag]) {
      posTagMeaning = corpusMorphology.tag_reference[posTag];
    }
  }
  
  return {
    id: word.id,
    arabic: word.arabic,
    transliteration: word.transliteration,
    root: word.root || '—',
    lemma: word.baseForm || word.rawForm || word.transliteration,
    pos: pos,
    pos_tag: posTag,
    morphology: {
      category: word.category,
      wordType: word.wordType,
      description: word.morphology,
      // Ilmussarf (morphology) references
      ilmussarf: {
        pos_tag: posTag,
        pos_tag_meaning: posTagMeaning,
        morphological_analysis: word.morphology || word.wordType || null,
        grammatical_features: word.features || {},
        corpus_reference: corpusMorphology ? {
          tag_reference: corpusMorphology.tag_reference || {},
          pos_distribution: corpusMorphology.pos_distribution || []
        } : null
      }
    },
    frequency: word.frequency,
    percentage: word.percentage,
    occurrences: {
      total: word.frequency,
      surahs: word.surahFrequencies || {}
    },
    ayah_refs: ayahRefs,
    translations,
    transliterations,
    pronunciations,
    semantic_tags: semanticTags,
    // Scholarly references
    scholarly: {
      corpus_id: word.id,
      track: word.track || null,
      track_class: word.trackClass || null,
      source: 'Quranic Arabic Corpus v0.4'
    },
    progress_state: word.progressState || 'new'
  };
}

/**
 * Create index file
 */
function createIndex(words) {
  const index = {
    meta: {
      title: 'Quranic Words Index',
      total_words: words.length,
      created_at: new Date().toISOString()
    },
    words: words.map(w => ({
      id: w.id,
      arabic: w.arabic,
      frequency: w.frequency,
      pos: w.pos
    }))
  };
  
  return index;
}

/**
 * Create frequency-based index
 */
function createFrequencyIndex(words) {
  const sorted = [...words].sort((a, b) => b.frequency - a.frequency);
  
  return {
    meta: {
      title: 'Words by Frequency',
      total_words: sorted.length
    },
    top_100: sorted.slice(0, 100).map(w => w.id),
    top_1000: sorted.slice(0, 1000).map(w => w.id),
    all: sorted.map(w => w.id)
  };
}

/**
 * Create surah-based index
 */
function createSurahIndex(words) {
  const surahIndex = {};
  
  for (const word of words) {
    if (word.occurrences && word.occurrences.surahs) {
      for (const [surah, count] of Object.entries(word.occurrences.surahs)) {
        if (!surahIndex[surah]) {
          surahIndex[surah] = [];
        }
        surahIndex[surah].push(word.id);
      }
    }
  }
  
  return {
    meta: {
      title: 'Words by Surah',
      total_surahs: Object.keys(surahIndex).length
    },
    surahs: surahIndex
  };
}

/**
 * Create POS-based index
 */
function createPOSIndex(words) {
  const posIndex = {};
  
  for (const word of words) {
    if (!posIndex[word.pos]) {
      posIndex[word.pos] = [];
    }
    posIndex[word.pos].push(word.id);
  }
  
  return {
    meta: {
      title: 'Words by Part of Speech',
      total_pos: Object.keys(posIndex).length
    },
    pos: posIndex
  };
}

/**
 * Create root-based index
 */
function createRootIndex(words) {
  const rootIndex = {};
  
  for (const word of words) {
    const root = word.root || '—';
    if (!rootIndex[root]) {
      rootIndex[root] = [];
    }
    rootIndex[root].push(word.id);
  }
  
  return {
    meta: {
      title: 'Words by Root',
      total_roots: Object.keys(rootIndex).length
    },
    roots: rootIndex
  };
}

/**
 * Compress data with gzip
 */
function compressData(data) {
  return gzipSync(JSON.stringify(data), { level: 9 });
}

/**
 * Write file with optional compression
 */
async function writeJsonFile(filePath, data, shouldCompress = false) {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  
  if (shouldCompress) {
    const compressed = compressData(data);
    await writeFile(filePath + '.gz', compressed);
    console.log(`  Wrote ${filePath}.gz (${(compressed.length / 1024).toFixed(2)} KB)`);
  } else {
    await writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`  Wrote ${filePath} (${(JSON.stringify(data).length / 1024).toFixed(2)} KB)`);
  }
}

/**
 * Main transformation function
 */
async function transform() {
  console.log('=== Quranic Words Data Transformation ===\n');
  
  // Create output directories
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, 'words_by_id'), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, 'by_frequency'), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, 'by_surah'), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, 'by_pos'), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, 'by_root'), { recursive: true });
  
  // Load source data from both tracks
  const trackAWords = await loadTrackAData();
  const trackBWords = await loadTrackBData();
  
  // Merge tracks without duplications
  console.log('\nMerging tracks and removing duplications...');
  const wordMap = new Map();
  
  // Add TrackA words
  for (const word of trackAWords) {
    wordMap.set(word.id, word);
  }
  
  // Add TrackB words (will overwrite if same ID exists, but IDs should be unique)
  for (const word of trackBWords) {
    wordMap.set(word.id, word);
  }
  
  const rawWords = Array.from(wordMap.values());
  console.log(`Total unique words after merge: ${rawWords.length}`);
  
  // Load corpus morphology data for ilmussarf references
  const corpusMorphology = await loadCorpusMorphology();
  
  // Normalize words with morphology integration
  console.log('\nNormalizing words with ilmussarf (morphology) references...');
  const normalizedWords = rawWords.map(word => normalizeWord(word, corpusMorphology));
  console.log(`Normalized ${normalizedWords.length} words with morphological references`);
  
  // Create indexes
  console.log('\nCreating indexes...');
  const index = createIndex(normalizedWords);
  const frequencyIndex = createFrequencyIndex(normalizedWords);
  const surahIndex = createSurahIndex(normalizedWords);
  const posIndex = createPOSIndex(normalizedWords);
  const rootIndex = createRootIndex(normalizedWords);
  
  // Write index files
  console.log('\nWriting index files...');
  await writeJsonFile(path.join(OUTPUT_DIR, 'index.json'), index, true);
  await writeJsonFile(path.join(OUTPUT_DIR, 'by_frequency/index.json'), frequencyIndex, true);
  await writeJsonFile(path.join(OUTPUT_DIR, 'by_surah/index.json'), surahIndex, true);
  await writeJsonFile(path.join(OUTPUT_DIR, 'by_pos/index.json'), posIndex, true);
  await writeJsonFile(path.join(OUTPUT_DIR, 'by_root/index.json'), rootIndex, true);
  
  // Write individual word files
  console.log('\nWriting individual word files...');
  let written = 0;
  for (const word of normalizedWords) {
    // Sanitize file name to remove invalid characters
    const safeId = word.id.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    const filePath = path.join(OUTPUT_DIR, 'words_by_id', `${safeId}.json`);
    await writeJsonFile(filePath, word, true);
    written++;
    if (written % 100 === 0) {
      console.log(`  Progress: ${written}/${normalizedWords.length}`);
    }
  }
  
  // Write frequency-based word lists
  console.log('\nWriting frequency-based word lists...');
  const top100 = normalizedWords.slice(0, 100);
  await writeJsonFile(path.join(OUTPUT_DIR, 'by_frequency/top_100.json'), top100, true);
  
  const top1000 = normalizedWords.slice(0, 1000);
  await writeJsonFile(path.join(OUTPUT_DIR, 'by_frequency/top_1000.json'), top1000, true);
  
  console.log('\n=== Transformation Complete ===');
  console.log(`Total words processed: ${normalizedWords.length}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
}

// Run transformation
transform().catch(console.error);
