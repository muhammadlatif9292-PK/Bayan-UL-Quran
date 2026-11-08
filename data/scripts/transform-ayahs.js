#!/usr/bin/env node

/**
 * Quranic Ayahs Data Transformation Script
 * 
 * This script transforms the existing ayah data into an optimized structure:
 * - Creates individual ayah files for lazy loading
 * - Creates surah-based indexes
 * - Creates length-based indexes
 * - Creates repetition indexes
 * - Compresses output files
 */

const fs = require('fs');
const path = require('path');
const { gzipSync } = require('zlib');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

const SOURCE_DIR = path.join(__dirname, '../quran_surah_jsons');
const OUTPUT_DIR = path.join(__dirname, '../data/optimized/ayahs');

/**
 * Load surah index
 */
async function loadSurahIndex() {
  console.log('Loading surah index...');
  const indexPath = path.join(SOURCE_DIR, '000_INDEX.json');
  let content = await readFile(indexPath, 'utf8');
  
  // Remove BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  
  // Trim whitespace
  content = content.trim();
  
  const data = JSON.parse(content);
  console.log(`Loaded index with ${data.total_surahs} surahs`);
  return data;
}

/**
 * Load all surah data
 */
async function loadAllSurahs() {
  console.log('Loading all surah data...');
  const index = await loadSurahIndex();
  const allSurahs = [];
  
  for (const surahInfo of index.files) {
    console.log(`  Loading ${surahInfo.filename}...`);
    const filePath = path.join(SOURCE_DIR, surahInfo.filename);
    let content = await readFile(filePath, 'utf8');
    
    // Remove BOM if present
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    
    // Trim whitespace
    content = content.trim();
    
    const data = JSON.parse(content);
    allSurahs.push(data);
  }
  
  console.log(`Loaded ${allSurahs.length} surahs`);
  return allSurahs;
}

/**
 * Extract unique ayahs from all surahs
 */
function extractUniqueAyahs(allSurahs) {
  console.log('Extracting unique ayahs...');
  const ayahMap = new Map();
  let ayahIdCounter = 1;
  
  for (const surah of allSurahs) {
    if (surah.verses) {
      for (const verse of surah.verses) {
        const key = `${surah.surah}:${verse.verse_number}`;
        
        ayahMap.set(key, {
          id: `ayah_${String(ayahIdCounter++).padStart(5, '0')}`,
          surah: surah.surah,
          surah_name: surah.name,
          ayah: verse.verse_number,
          arabic: verse.text_uthmani || verse.text,
          words: verse.words || [],
          morphology: verse.morphology || null,
          translations: verse.translations || {},
          transliteration: verse.transliteration || null
        });
      }
    }
  }
  
  console.log(`Extracted ${ayahMap.size} unique ayahs`);
  return Array.from(ayahMap.values());
}

/**
 * Normalize ayah data
 */
function normalizeAyah(ayah) {
  // Calculate word count
  const wordCount = ayah.words ? ayah.words.length : 0;
  
  // Determine length category
  let lengthCategory;
  if (wordCount <= 5) lengthCategory = 'short';
  else if (wordCount <= 15) lengthCategory = 'medium';
  else lengthCategory = 'long';
  
  return {
    id: ayah.id,
    surah: ayah.surah,
    surah_name: ayah.surah_name,
    ayah: ayah.ayah,
    reference: `${ayah.surah}:${ayah.ayah}`,
    arabic: ayah.arabic,
    word_count: wordCount,
    length_category: lengthCategory,
    words: ayah.words || [],
    morphology: ayah.morphology,
    translations: ayah.translations || {},
    transliteration: ayah.transliteration
  };
}

/**
 * Create surah-based index
 */
function createSurahIndex(ayahs) {
  const surahIndex = {};
  
  for (const ayah of ayahs) {
    if (!surahIndex[ayah.surah]) {
      surahIndex[ayah.surah] = [];
    }
    surahIndex[ayah.surah].push(ayah.id);
  }
  
  return {
    meta: {
      title: 'Ayahs by Surah',
      total_surahs: Object.keys(surahIndex).length
    },
    surahs: surahIndex
  };
}

/**
 * Create length-based index
 */
function createLengthIndex(ayahs) {
  const lengthIndex = {
    short: [],
    medium: [],
    long: []
  };
  
  for (const ayah of ayahs) {
    lengthIndex[ayah.length_category].push(ayah.id);
  }
  
  return {
    meta: {
      title: 'Ayahs by Length',
      total_ayahs: ayahs.length
    },
    lengths: lengthIndex
  };
}

/**
 * Create word count index
 */
function createWordCountIndex(ayahs) {
  const sorted = [...ayahs].sort((a, b) => b.word_count - a.word_count);
  
  return {
    meta: {
      title: 'Ayahs by Word Count',
      total_ayahs: sorted.length
    },
    longest: sorted.slice(0, 100).map(a => a.id),
    shortest: sorted.slice(-100).reverse().map(a => a.id)
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
  console.log('=== Quranic Ayahs Data Transformation ===\n');
  
  // Create output directories
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, 'by_id'), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, 'by_surah'), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, 'by_length'), { recursive: true });
  
  // Load data
  const allSurahs = await loadAllSurahs();
  const rawAyahs = extractUniqueAyahs(allSurahs);
  
  // Normalize ayahs
  console.log('\nNormalizing ayahs...');
  const normalizedAyahs = rawAyahs.map(normalizeAyah);
  console.log(`Normalized ${normalizedAyahs.length} ayahs`);
  
  // Create indexes
  console.log('\nCreating indexes...');
  const surahIndex = createSurahIndex(normalizedAyahs);
  const lengthIndex = createLengthIndex(normalizedAyahs);
  const wordCountIndex = createWordCountIndex(normalizedAyahs);
  
  // Write index files
  console.log('\nWriting index files...');
  await writeJsonFile(path.join(OUTPUT_DIR, 'index.json'), {
    meta: {
      title: 'Ayahs Master Index',
      total_ayahs: normalizedAyahs.length,
      created_at: new Date().toISOString()
    }
  }, true);
  await writeJsonFile(path.join(OUTPUT_DIR, 'by_surah/index.json'), surahIndex, true);
  await writeJsonFile(path.join(OUTPUT_DIR, 'by_length/index.json'), lengthIndex, true);
  await writeJsonFile(path.join(OUTPUT_DIR, 'by_length/word_count.json'), wordCountIndex, true);
  
  // Write individual ayah files (sample for now - full would be too many)
  console.log('\nWriting individual ayah files (top 100 by word count)...');
  const top100 = normalizedAyahs.sort((a, b) => b.word_count - a.word_count).slice(0, 100);
  for (const ayah of top100) {
    // Sanitize file name to remove invalid characters
    const safeId = ayah.id.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    const filePath = path.join(OUTPUT_DIR, 'by_id', `${safeId}.json`);
    await writeJsonFile(filePath, ayah, true);
  }
  
  // Write surah-based files
  console.log('\nWriting surah-based files...');
  for (const [surahNum, ids] of Object.entries(surahIndex.surahs)) {
    const ayahs = normalizedAyahs.filter(a => ids.includes(a.id));
    const filePath = path.join(OUTPUT_DIR, 'by_surah', `surah_${String(surahNum).padStart(3, '0')}.json`);
    await writeJsonFile(filePath, ayahs, true);
  }
  
  // Write length-based files
  console.log('\nWriting length-based files...');
  const shortAyahs = normalizedAyahs.filter(a => a.length_category === 'short');
  await writeJsonFile(path.join(OUTPUT_DIR, 'by_length/short.json'), shortAyahs, true);
  
  const mediumAyahs = normalizedAyahs.filter(a => a.length_category === 'medium');
  await writeJsonFile(path.join(OUTPUT_DIR, 'by_length/medium.json'), mediumAyahs, true);
  
  const longAyahs = normalizedAyahs.filter(a => a.length_category === 'long');
  await writeJsonFile(path.join(OUTPUT_DIR, 'by_length/long.json'), longAyahs, true);
  
  console.log('\n=== Transformation Complete ===');
  console.log(`Total ayahs processed: ${normalizedAyahs.length}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
}

// Run transformation
transform().catch(console.error);
