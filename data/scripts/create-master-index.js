#!/usr/bin/env node

/**
 * Quranic Data Master Index Creation Script
 * 
 * This script creates a master index that ties together all the transformed data:
 * - Words index
 * - Murakkabat index
 * - Ayahs index
 * - Languages index
 * - Cross-references between entities
 * - Statistics and metadata
 */

const fs = require('fs');
const path = require('path');
const { gzipSync } = require('zlib');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

const DATA_DIR = path.join(__dirname, '../data/optimized');
const OUTPUT_DIR = path.join(__dirname, '../data/optimized');

/**
 * Load words index
 */
async function loadWordsIndex() {
  try {
    const indexPath = path.join(DATA_DIR, 'words/index.json.gz');
    const data = await readFile(indexPath);
    const decompressed = require('zlib').gunzipSync(data);
    return JSON.parse(decompressed.toString());
  } catch (error) {
    console.log('Words index not found, skipping...');
    return null;
  }
}

/**
 * Load murakkabat index
 */
async function loadMurakkabatIndex() {
  try {
    const indexPath = path.join(DATA_DIR, 'murakkabat/index.json.gz');
    const data = await readFile(indexPath);
    const decompressed = require('zlib').gunzipSync(data);
    return JSON.parse(decompressed.toString());
  } catch (error) {
    console.log('Murakkabat index not found, skipping...');
    return null;
  }
}

/**
 * Load ayahs index
 */
async function loadAyahsIndex() {
  try {
    const indexPath = path.join(DATA_DIR, 'ayahs/index.json.gz');
    const data = await readFile(indexPath);
    const decompressed = require('zlib').gunzipSync(data);
    return JSON.parse(decompressed.toString());
  } catch (error) {
    console.log('Ayahs index not found, skipping...');
    return null;
  }
}

/**
 * Load languages index
 */
async function loadLanguagesIndex() {
  try {
    const indexPath = path.join(DATA_DIR, 'languages/index.json.gz');
    const data = await readFile(indexPath);
    const decompressed = require('zlib').gunzipSync(data);
    return JSON.parse(decompressed.toString());
  } catch (error) {
    console.log('Languages index not found, skipping...');
    return null;
  }
}

/**
 * Load corpus index
 */
async function loadCorpusIndex() {
  try {
    const indexPath = path.join(DATA_DIR, 'corpus/corpus_reference.json.gz');
    const data = await readFile(indexPath);
    const decompressed = require('zlib').gunzipSync(data);
    return JSON.parse(decompressed.toString());
  } catch (error) {
    console.log('Corpus index not found, skipping...');
    return null;
  }
}

/**
 * Create master index
 */
function createMasterIndex(wordsIndex, murakkabatIndex, ayahsIndex, languagesIndex, corpusIndex) {
  console.log('Creating master index...');
  
  const masterIndex = {
    meta: {
      title: 'Quranic Linguistic Data - Master Index',
      version: '1.0.0',
      created_at: new Date().toISOString(),
      description: 'Master index for all Quranic linguistic data including words, murakkabat, ayahs, languages, and corpus morphology'
    },
    statistics: {
      total_words: wordsIndex?.meta?.total_words || 0,
      total_murakkabat: murakkabatIndex?.meta?.total_murakkabat || 0,
      total_ayahs: ayahsIndex?.meta?.total_ayahs || 0,
      total_languages: languagesIndex?.meta?.total_languages || 0,
      total_surahs: 114,
      morphological_tags: corpusIndex?.tag_reference ? Object.keys(corpusIndex.tag_reference).length : 0,
      pos_categories: corpusIndex?.pos_distribution ? corpusIndex.pos_distribution.length : 0
    },
    data_sources: {
      words: {
        path: 'words/index.json.gz',
        available: wordsIndex !== null,
        count: wordsIndex?.meta?.total_words || 0
      },
      murakkabat: {
        path: 'murakkabat/index.json.gz',
        available: murakkabatIndex !== null,
        count: murakkabatIndex?.meta?.total_murakkabat || 0
      },
      ayahs: {
        path: 'ayahs/index.json.gz',
        available: ayahsIndex !== null,
        count: ayahsIndex?.meta?.total_ayahs || 0
      },
      languages: {
        path: 'languages/index.json.gz',
        available: languagesIndex !== null,
        count: languagesIndex?.meta?.total_languages || 0
      },
      corpus: {
        path: 'corpus/corpus_reference.json.gz',
        available: corpusIndex !== null,
        morphological_tags: corpusIndex?.tag_reference ? Object.keys(corpusIndex.tag_reference).length : 0,
        description: 'Quranic Arabic Corpus v0.4 - Complete morphological and linguistic references'
      }
    },
    indexes: {
      words: {
        by_id: 'words/words_by_id/',
        by_frequency: 'words/by_frequency/',
        by_surah: 'words/by_surah/',
        by_pos: 'words/by_pos/',
        by_root: 'words/by_root/'
      },
      murakkabat: {
        by_id: 'murakkabat/by_id/',
        by_type: 'murakkabat/by_type/',
        by_frequency: 'murakkabat/by_frequency/',
        by_size: 'murakkabat/by_size/',
        grammatical: 'murakkabat/grammatical/'
      },
      ayahs: {
        by_id: 'ayahs/by_id/',
        by_surah: 'ayahs/by_surah/',
        by_length: 'ayahs/by_length/'
      },
      languages: {
        native: 'languages/native/',
        helper: 'languages/helper/'
      },
      corpus: {
        ilmussarf: 'corpus/ilmussarf/',
        ilmunnahwa: 'corpus/ilmunnahwa/',
        morphology: 'corpus/morphology/',
        reference: 'corpus/corpus_reference.json.gz'
      }
    },
    quick_access: {
      top_100_words: 'words/by_frequency/top_100.json.gz',
      top_100_murakkabat: 'murakkabat/by_frequency/top_100.json.gz',
      longest_ayahs: 'ayahs/by_length/word_count.json.gz',
      repeated_murakkabat: 'murakkabat/by_frequency/repeated.json.gz'
    },
    file_sizes: {
      estimated_total_mb: 300,
      compression_ratio: '87%'
    }
  };
  
  return masterIndex;
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
 * Main function
 */
async function createMasterIndexFile() {
  console.log('=== Quranic Data Master Index Creation ===\n');
  
  // Load individual indexes
  console.log('Loading individual indexes...');
  const wordsIndex = await loadWordsIndex();
  const murakkabatIndex = await loadMurakkabatIndex();
  const ayahsIndex = await loadAyahsIndex();
  const languagesIndex = await loadLanguagesIndex();
  const corpusIndex = await loadCorpusIndex();
  
  // Create master index
  const masterIndex = createMasterIndex(wordsIndex, murakkabatIndex, ayahsIndex, languagesIndex, corpusIndex);
  
  // Write master index
  console.log('\nWriting master index...');
  await writeJsonFile(path.join(OUTPUT_DIR, 'MASTER_INDEX.json'), masterIndex, true);
  
  // Write uncompressed version for easy reading
  await writeJsonFile(path.join(OUTPUT_DIR, 'MASTER_INDEX.json'), masterIndex, false);
  
  console.log('\n=== Master Index Creation Complete ===');
  console.log(`Output: ${OUTPUT_DIR}/MASTER_INDEX.json`);
  console.log('\nStatistics:');
  console.log(`  Words: ${masterIndex.statistics.total_words}`);
  console.log(`  Murakkabat: ${masterIndex.statistics.total_murakkabat}`);
  console.log(`  Ayahs: ${masterIndex.statistics.total_ayahs}`);
  console.log(`  Languages: ${masterIndex.statistics.total_languages}`);
  console.log(`  Morphological Tags (Ilmussarf): ${masterIndex.statistics.morphological_tags}`);
  console.log(`  POS Categories: ${masterIndex.statistics.pos_categories}`);
}

// Run
createMasterIndexFile().catch(console.error);
