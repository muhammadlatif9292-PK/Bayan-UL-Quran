#!/usr/bin/env node

/**
 * Quranic Language Data Transformation Script
 * 
 * This script extracts and organizes language data from the existing word data:
 * - Creates separate language bundles for native and helper languages
 * - Extracts translations, transliterations, and pronunciations
 * - Creates language-specific indexes
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
const OUTPUT_DIR = path.join(__dirname, '../data/optimized/languages');

// Language configuration
const LANGUAGES = {
  english: { code: 'en', name: 'English', direction: 'ltr' },
  urdu: { code: 'ur', name: 'Urdu', direction: 'rtl' },
  hindi: { code: 'hi', name: 'Hindi', direction: 'ltr' },
  turkish: { code: 'tr', name: 'Turkish', direction: 'ltr' },
  indonesian: { code: 'id', name: 'Indonesian', direction: 'ltr' },
  malay: { code: 'ms', name: 'Malay', direction: 'ltr' },
  bengali: { code: 'bn', name: 'Bengali', direction: 'ltr' },
  french: { code: 'fr', name: 'French', direction: 'ltr' },
  german: { code: 'de', name: 'German', direction: 'ltr' },
  spanish: { code: 'es', name: 'Spanish', direction: 'ltr' },
  russian: { code: 'ru', name: 'Russian', direction: 'ltr' },
  swahili: { code: 'sw', name: 'Swahili', direction: 'ltr' },
  hausa: { code: 'ha', name: 'Hausa', direction: 'ltr' },
  hebrew: { code: 'he', name: 'Hebrew', direction: 'rtl' }
};

/**
 * Load all trackA JSON files
 */
async function loadTrackAData() {
  console.log('Loading TrackA data for language extraction...');
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
  console.log('Loading TrackB data for language extraction...');
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

/**
 * Extract language data from words
 */
function extractLanguageData(words) {
  console.log('Extracting language data...');
  
  const languageData = {};
  
  // Initialize language objects
  for (const [langKey, langConfig] of Object.entries(LANGUAGES)) {
    languageData[langConfig.code] = {
      code: langConfig.code,
      name: langConfig.name,
      direction: langConfig.direction,
      translations: {},
      transliterations: {},
      pronunciations: {}
    };
  }
  
  // Extract data from each word
  for (const word of words) {
    const wordId = word.id;
    
    // Extract translations
    if (word.meanings) {
      for (const [langKey, translation] of Object.entries(word.meanings)) {
        const langCode = LANGUAGES[langKey]?.code;
        if (langCode && languageData[langCode]) {
          languageData[langCode].translations[wordId] = translation;
        }
      }
    }
    
    // Extract transliterations
    if (word.transliteration) {
      for (const [langKey, langConfig] of Object.entries(LANGUAGES)) {
        const langCode = langConfig.code;
        if (languageData[langCode]) {
          languageData[langCode].transliterations[wordId] = word.transliteration;
        }
      }
    }
    
    // Generate pronunciations (basic IPA approximation)
    if (word.transliteration) {
      for (const [langKey, langConfig] of Object.entries(LANGUAGES)) {
        const langCode = langConfig.code;
        if (languageData[langCode]) {
          languageData[langCode].pronunciations[wordId] = `/${word.transliteration}/`;
        }
      }
    }
  }
  
  console.log(`Extracted data for ${Object.keys(languageData).length} languages`);
  return languageData;
}

/**
 * Create native language bundles
 */
function createNativeBundles(languageData) {
  console.log('Creating native language bundles...');
  
  const nativeBundles = {};
  
  for (const [langCode, data] of Object.entries(languageData)) {
    nativeBundles[langCode] = {
      meta: {
        type: 'native',
        code: data.code,
        name: data.name,
        direction: data.direction,
        total_translations: Object.keys(data.translations).length
      },
      translations: data.translations,
      transliterations: data.transliterations,
      pronunciations: data.pronunciations
    };
  }
  
  return nativeBundles;
}

/**
 * Create helper language bundles
 */
function createHelperBundles(languageData) {
  console.log('Creating helper language bundles...');
  
  const helperBundles = {};
  
  for (const [langCode, data] of Object.entries(languageData)) {
    helperBundles[langCode] = {
      meta: {
        type: 'helper',
        code: data.code,
        name: data.name,
        direction: data.direction,
        total_translations: Object.keys(data.translations).length
      },
      translations: data.translations,
      transliterations: data.transliterations,
      pronunciations: data.pronunciations
    };
  }
  
  return helperBundles;
}

/**
 * Create language index
 */
function createLanguageIndex(languageData) {
  const languages = Object.values(languageData).map(data => ({
    code: data.code,
    name: data.name,
    direction: data.direction,
    translation_count: Object.keys(data.translations).length
  }));
  
  return {
    meta: {
      title: 'Languages Index',
      total_languages: languages.length
    },
    languages
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
  console.log('=== Quranic Language Data Transformation ===\n');
  
  // Create output directories
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, 'native'), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, 'helper'), { recursive: true });
  
  // Load data from both tracks
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
  
  const words = Array.from(wordMap.values());
  console.log(`Total unique words after merge: ${words.length}`);
  
  // Extract language data
  const languageData = extractLanguageData(words);
  
  // Create bundles
  const nativeBundles = createNativeBundles(languageData);
  const helperBundles = createHelperBundles(languageData);
  const languageIndex = createLanguageIndex(languageData);
  
  // Write index file
  console.log('\nWriting language index...');
  await writeJsonFile(path.join(OUTPUT_DIR, 'index.json'), languageIndex, true);
  
  // Write native language bundles
  console.log('\nWriting native language bundles...');
  for (const [langCode, bundle] of Object.entries(nativeBundles)) {
    const filePath = path.join(OUTPUT_DIR, 'native', `${langCode}.json`);
    await writeJsonFile(filePath, bundle, true);
  }
  
  // Write helper language bundles
  console.log('\nWriting helper language bundles...');
  for (const [langCode, bundle] of Object.entries(helperBundles)) {
    const filePath = path.join(OUTPUT_DIR, 'helper', `${langCode}.json`);
    await writeJsonFile(filePath, bundle, true);
  }
  
  // Create combined language summary
  console.log('\nCreating language summary...');
  const summary = {
    meta: {
      title: 'Language Data Summary',
      created_at: new Date().toISOString()
    },
    total_languages: Object.keys(LANGUAGES).length,
    total_words: words.length,
    languages: Object.entries(languageData).map(([code, data]) => ({
      code,
      name: data.name,
      direction: data.direction,
      translations_count: Object.keys(data.translations).length,
      coverage_percentage: ((Object.keys(data.translations).length / words.length) * 100).toFixed(2)
    }))
  };
  await writeJsonFile(path.join(OUTPUT_DIR, 'summary.json'), summary, true);
  
  console.log('\n=== Transformation Complete ===');
  console.log(`Total languages processed: ${Object.keys(LANGUAGES).length}`);
  console.log(`Total words: ${words.length}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
}

// Run transformation
transform().catch(console.error);
