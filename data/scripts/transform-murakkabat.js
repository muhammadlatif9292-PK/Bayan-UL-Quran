#!/usr/bin/env node

/**
 * Quranic Murakkabat Data Transformation Script
 * 
 * This script transforms the existing murakkabat data into an optimized structure:
 * - Creates individual compound files for lazy loading
 * - Creates type-based indexes (bigrams, trigrams, etc.)
 * - Creates frequency-based indexes
 * - Creates grammatical construct indexes
 * - Compresses output files
 */

const fs = require('fs');
const path = require('path');
const { gzipSync } = require('zlib');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

const SOURCE_DIR = path.join(__dirname, '../quran_murakkabat_db');
const OUTPUT_DIR = path.join(__dirname, '../../public/data');

/**
 * Load murakkabat index
 */
async function loadMurakkabatIndex() {
  console.log('Loading murakkabat index...');
  const indexPath = path.join(SOURCE_DIR, '000_INDEX.json');
  let content = await readFile(indexPath, 'utf8');
  
  // Remove BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  
  // Trim whitespace
  content = content.trim();
  
  const data = JSON.parse(content);
  console.log(`Loaded index with ${data.files ? Object.keys(data.files).length : 0} files`);
  return data;
}

/**
 * Load surface n-grams by size
 */
async function loadSurfaceNGrams(n) {
  console.log(`Loading surface ${n}-grams...`);
  
  let fileName;
  if (n === 2) fileName = '02_surface_ngrams_n2.json';
  else if (n === 3) fileName = '02_surface_ngrams_n3.json';
  else if (n === 4) fileName = '02_surface_ngrams_n4.json';
  else if (n >= 5 && n <= 8) fileName = '02_surface_ngrams_n5to8.json';
  else return null;
  
  const filePath = path.join(SOURCE_DIR, fileName);
  let content = await readFile(filePath, 'utf8');
  
  // Remove BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  
  // Trim whitespace
  content = content.trim();
  
  const data = JSON.parse(content);
  
  // Handle n5to8 special structure
  if (n >= 5 && n <= 8 && data.data && typeof data.data === 'object') {
    const nKey = `n${n}`;
    if (data.data[nKey]) {
      return { ...data, data: data.data[nKey] };
    }
  }
  
  console.log(`Loaded ${data.ngram_type} n=${n} data`);
  return data;
}

/**
 * Load grammatical constructs
 */
async function loadGrammaticalConstructs() {
  console.log('Loading grammatical constructs...');
  
  const constructs = {
    idafa: null,
    wasfi: null,
    jar_majrur: null,
    nida: null,
    verbal_clauses: null,
    nominal_clauses: null,
    atf: null,
    conditional: null,
    oaths: null,
    formulaic: null,
    divine_name_compounds: null
  };
  
  const files = {
    idafa: '05_idafa.json',
    wasfi: '06_wasfi.json',
    jar_majrur: '07_jar_majrur.json',
    nida: '08_nida.json',
    verbal_clauses: '09_verbal_clauses.json',
    nominal_clauses: '10_nominal_clauses.json',
    atf: '11_atf.json',
    conditional: '12_conditional.json',
    oaths: '13_oaths.json',
    formulaic: '14_formulaic.json',
    divine_name_compounds: '15_divine_name_compounds.json'
  };
  
  for (const [key, fileName] of Object.entries(files)) {
    const filePath = path.join(SOURCE_DIR, fileName);
    if (fs.existsSync(filePath)) {
      let content = await readFile(filePath, 'utf8');
      
      // Remove BOM if present
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }
      
      // Trim whitespace
      content = content.trim();
      
      constructs[key] = JSON.parse(content);
      console.log(`  Loaded ${key}`);
    }
  }
  
  return constructs;
}

/**
 * Convert Buckwalter to Arabic
 */
function convertBuckwalterToArabic(buckwalter) {
  const buckwalterToArabicMap = {
    "'": 'ء',
    '|': 'آ',
    '>': 'ا',
    '&': 'أ',
    '<': 'إ',
    'A': 'ا',
    'b': 'ب',
    't': 'ت',
    'v': 'ث',
    'j': 'ج',
    'H': 'ح',
    'x': 'خ',
    'd': 'د',
    '*': 'ذ',
    'r': 'ر',
    'z': 'ز',
    's': 'س',
    '$': 'ش',
    'S': 'ص',
    'D': 'ض',
    'T': 'ط',
    'Z': 'ظ',
    'E': 'ع',
    'g': 'غ',
    'f': 'ف',
    'q': 'ق',
    'k': 'ك',
    'l': 'ل',
    'm': 'م',
    'n': 'ن',
    'h': 'ه',
    'w': 'و',
    'Y': 'ى',
    'y': 'ي',
    'p': 'پ',
    'F': 'ڤ',
    'G': 'گ',
    'N': 'ں',
    '~': 'ّ',
    '`': 'ٌ',
    'o': 'ٍ',
    'a': 'َ',
    'u': 'ُ',
    'i': 'ِ',
    'F': 'ْ',
    'N': 'ّ',
    'K': 'ًا',
    'c': 'آ',
    'O': 'أ',
    'W': 'ؤ',
    'V': 'إ',
    'J': 'ئ',
    'I': 'آ',
    '{': 'ا',
    '}': 'ل'
  };
  
  let arabic = '';
  for (let i = 0; i < buckwalter.length; i++) {
    const char = buckwalter[i];
    arabic += buckwalterToArabicMap[char] || char;
  }
  
  return arabic;
}

/**
 * Convert Buckwalter to speakable transliteration
 */
function convertBuckwalterToSpeakable(buckwalter) {
  const speakableMap = {
    "'": '',
    '|': 'aa',
    '>': 'a',
    '&': 'u',
    '<': 'i',
    'A': 'a',
    'b': 'b',
    't': 't',
    'v': 'th',
    'j': 'j',
    'H': 'h',
    'x': 'kh',
    'd': 'd',
    '*': 'dh',
    'r': 'r',
    'z': 'z',
    's': 's',
    '$': 'sh',
    'S': 's',
    'D': 'd',
    'T': 't',
    'Z': 'z',
    'E': '',
    'g': 'gh',
    'f': 'f',
    'q': 'q',
    'k': 'k',
    'l': 'l',
    'm': 'm',
    'n': 'n',
    'h': 'h',
    'w': 'w',
    'Y': 'a',
    'y': 'y',
    'p': 'p',
    'F': 'v',
    'G': 'k',
    'N': 'n',
    '{': 'al',
    '}': 'l',
    '~': '',
    '`': 'a',
    'F': 'u',
    'N': 'i',
    'K': 'an',
    'o': 'un',
    'a': 'in',
    'u': '',
    'a': 'a',
    'c': '',
    'O': '',
    'W': '',
    'V': '',
    'J': '',
    'I': ''
  };
  
  let speakable = '';
  for (let i = 0; i < buckwalter.length; i++) {
    const char = buckwalter[i];
    speakable += speakableMap[char] || char;
  }
  
  // Remove all remaining special characters
  speakable = speakable.replace(/[^a-zA-Z]/g, '');
  
  // Clean up double letters
  speakable = speakable.replace(/ll+/g, 'll');
  speakable = speakable.replace(/aa+/g, 'a');
  speakable = speakable.replace(/uu+/g, 'u');
  speakable = speakable.replace(/ii+/g, 'i');
  
  // Capitalize first letter
  if (speakable.length > 0) {
    speakable = speakable.charAt(0).toUpperCase() + speakable.slice(1);
  }
  
  return speakable;
}

/**
 * Normalize n-gram data
 */
function normalizeNGram(ngram, type, n) {
  const phrase = ngram.key || ngram.phrase || '';
  const arabic = convertBuckwalterToArabic(phrase);
  const transliteration = convertBuckwalterToSpeakable(phrase);
  return {
    id: `${type}_${n}_${phrase.replace(/\s+/g, '_')}`,
    arabic: arabic,
    phrase: phrase,
    transliteration: transliteration,
    n: n,
    type: type,
    frequency: ngram.frequency,
    pattern: ngram.pattern_code || ngram.pattern || null,
    occurrences: ngram.occurrences || [],
    surah_distribution: ngram.surah_distribution || []
  };
}

/**
 * Normalize grammatical construct
 */
function normalizeConstruct(construct, type) {
  const phrase = construct.full_surface || construct.phrase || '';
  const arabic = convertBuckwalterToArabic(phrase);
  const transliteration = convertBuckwalterToSpeakable(phrase);
  return {
    id: `${type}_${phrase ? phrase.replace(/\s+/g, '_') : Math.random().toString(36).substr(2, 9)}`,
    arabic: arabic,
    phrase: phrase,
    transliteration: transliteration,
    type: type,
    frequency: construct.frequency || 1,
    pattern: construct.pattern_code || construct.pattern || null,
    occurrences: construct.occurrences || [],
    surah_distribution: construct.surah_distribution || []
  };
}

/**
 * Create type-based index
 */
function createTypeIndex(allMurakkabat) {
  const typeIndex = {};
  
  for (const item of allMurakkabat) {
    if (!typeIndex[item.type]) {
      typeIndex[item.type] = [];
    }
    typeIndex[item.type].push(item.id);
  }
  
  return {
    meta: {
      title: 'Murakkabat by Type',
      total_types: Object.keys(typeIndex).length
    },
    types: typeIndex
  };
}

/**
 * Create frequency-based index
 */
function createFrequencyIndex(allMurakkabat) {
  const sorted = [...allMurakkabat].sort((a, b) => b.frequency - a.frequency);
  
  return {
    meta: {
      title: 'Murakkabat by Frequency',
      total_murakkabat: sorted.length
    },
    top_100: sorted.slice(0, 100).map(m => m.id),
    top_1000: sorted.slice(0, 1000).map(m => m.id),
    repeated: sorted.filter(m => m.frequency > 1).map(m => m.id),
    hapax: sorted.filter(m => m.frequency === 1).map(m => m.id)
  };
}

/**
 * Create n-gram size index
 */
function createNGramSizeIndex(allMurakkabat) {
  const sizeIndex = {};
  
  for (const item of allMurakkabat) {
    if (!sizeIndex[item.n]) {
      sizeIndex[item.n] = [];
    }
    sizeIndex[item.n].push(item.id);
  }
  
  return {
    meta: {
      title: 'Murakkabat by N-gram Size',
      total_sizes: Object.keys(sizeIndex).length
    },
    sizes: sizeIndex
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
  console.log('=== Quranic Murakkabat Data Transformation ===\n');
  
  // Create output directories
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, 'by_id'), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, 'by_type'), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, 'by_frequency'), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, 'by_size'), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, 'grammatical'), { recursive: true });
  
  // Load data
  const index = await loadMurakkabatIndex();
  const allMurakkabat = [];
  
  // Load surface n-grams
  console.log('\nLoading surface n-grams...');
  for (let n = 2; n <= 8; n++) {
    const ngramData = await loadSurfaceNGrams(n);
    if (ngramData && ngramData.data) {
      for (const ngram of ngramData.data) {
        allMurakkabat.push(normalizeNGram(ngram, 'surface', n));
      }
      console.log(`  Added ${ngramData.data.length} ${n}-grams`);
    }
  }
  
  // Load grammatical constructs
  console.log('\nLoading grammatical constructs...');
  const constructs = await loadGrammaticalConstructs();
  for (const [type, data] of Object.entries(constructs)) {
    if (data && data.data) {
      for (const phrase of data.data) {
        allMurakkabat.push(normalizeConstruct(phrase, type));
      }
      console.log(`  Added ${data.data.length} ${type} constructs`);
    }
  }
  
  console.log(`\nTotal murakkabat loaded: ${allMurakkabat.length}`);
  
  // Write main murakkabat.json file with speakable transliterations
  console.log('\nWriting main murakkabat.json file...');
  await writeJsonFile(path.join(OUTPUT_DIR, 'murakkabat.json'), {
    murakkabat: allMurakkabat
  }, false);
  
  // Create indexes
  console.log('\nCreating indexes...');
  const typeIndex = createTypeIndex(allMurakkabat);
  const frequencyIndex = createFrequencyIndex(allMurakkabat);
  const sizeIndex = createNGramSizeIndex(allMurakkabat);
  
  // Write index files
  console.log('\nWriting index files...');
  await writeJsonFile(path.join(OUTPUT_DIR, 'murakkabat-index.json'), {
    meta: {
      title: 'Murakkabat Master Index',
      total_murakkabat: allMurakkabat.length,
      created_at: new Date().toISOString()
    }
  }, false);
  
  console.log('\n=== Transformation Complete ===');
  console.log(`Total murakkabat processed: ${allMurakkabat.length}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
}

// Run transformation
transform().catch(console.error);
