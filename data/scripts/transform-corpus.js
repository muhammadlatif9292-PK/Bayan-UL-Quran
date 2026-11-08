#!/usr/bin/env node

/**
 * Quranic Corpus Database Transformation Script
 * 
 * This script transforms the quran_corpus_db.json file to preserve all morphological,
 * linguistic, and scholarly references including:
 * - Tag references (ilmussarf - morphology tags)
 * - POS distribution
 * - Verb form distribution
 * - Surah statistics
 * - All linguistic and morphological data
 */

const fs = require('fs');
const path = require('path');
const { gzipSync } = require('zlib');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

const SOURCE_FILE = path.join(__dirname, '../quran_corpus_db.json');
const OUTPUT_DIR = path.join(__dirname, '../data/optimized/corpus');

/**
 * Load corpus database
 */
async function loadCorpusDatabase() {
  console.log('Loading Quranic Corpus Database...');
  let content = await readFile(SOURCE_FILE, 'utf8');
  
  // Remove BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  
  // Trim whitespace
  content = content.trim();
  
  const data = JSON.parse(content);
  console.log(`Loaded corpus database (${(content.length / 1024 / 1024).toFixed(2)} MB)`);
  return data;
}

/**
 * Extract and normalize morphological references
 */
function extractMorphologicalReferences(corpusData) {
  console.log('Extracting morphological references...');
  
  const references = {
    tag_reference: corpusData.tag_reference || {},
    pos_distribution: corpusData.pos_distribution || [],
    verb_form_distribution: corpusData.verb_form_distribution || [],
    statistics: corpusData.statistics || {},
    meta: corpusData.meta || {}
  };
  
  console.log(`Extracted ${Object.keys(references.tag_reference).length} morphological tags`);
  console.log(`Extracted ${references.pos_distribution.length} POS categories`);
  console.log(`Extracted ${references.verb_form_distribution.length} verb forms`);
  
  return references;
}

/**
 * Extract surah-level statistics
 */
function extractSurahStatistics(corpusData) {
  console.log('Extracting surah statistics...');
  
  const surahStats = {};
  
  if (corpusData.surah_statistics) {
    for (const surah of corpusData.surah_statistics) {
      surahStats[surah.surah] = {
        surah: surah.surah,
        name: surah.name,
        total_tokens: surah.total_tokens,
        unique_lemmas: surah.unique_lemmas,
        unique_roots: surah.unique_roots,
        pos_distribution: surah.pos_distribution || [],
        verb_analysis: surah.verb_analysis || {}
      };
    }
  }
  
  console.log(`Extracted statistics for ${Object.keys(surahStats).length} surahs`);
  return surahStats;
}

/**
 * Extract word-level morphology data
 */
function extractWordMorphology(corpusData) {
  console.log('Extracting word-level morphology data...');
  
  const wordMorphology = {};
  
  if (corpusData.words) {
    for (const word of corpusData.words) {
      wordMorphology[word.id] = {
        id: word.id,
        arabic: word.arabic,
        transliteration: word.transliteration,
        lemma: word.lemma,
        root: word.root,
        tags: word.tags || [],
        features: word.features || {},
        morphology: word.morphology || {}
      };
    }
  }
  
  console.log(`Extracted morphology for ${Object.keys(wordMorphology).length} words`);
  return wordMorphology;
}

/**
 * Create ilmussarf (morphology) index
 */
function createIlmussarfIndex(morphologicalReferences) {
  console.log('Creating ilmussarf (morphology) index...');
  
  const ilmussarfIndex = {
    meta: {
      title: 'Ilmussarf - Arabic Morphology Index',
      description: 'Complete morphological tag references and analysis'
    },
    tags: morphologicalReferences.tag_reference,
    pos_distribution: morphologicalReferences.pos_distribution,
    verb_forms: morphologicalReferences.verb_form_distribution,
    statistics: morphologicalReferences.statistics
  };
  
  return ilmussarfIndex;
}

/**
 * Create ilmunnahwa (grammar) index
 */
function createIlmunnahwaIndex(surahStatistics) {
  console.log('Creating ilmunnahwa (grammar) index...');
  
  const ilmunnahwaIndex = {
    meta: {
      title: 'Ilmunnahwa - Arabic Grammar Index',
      description: 'Surah-level grammatical analysis and statistics'
    },
    surahs: surahStatistics
  };
  
  return ilmunnahwaIndex;
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
  console.log('=== Quranic Corpus Database Transformation ===\n');
  
  // Create output directories
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, 'ilmussarf'), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, 'ilmunnahwa'), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, 'morphology'), { recursive: true });
  
  // Load corpus database
  const corpusData = await loadCorpusDatabase();
  
  // Extract data
  const morphologicalReferences = extractMorphologicalReferences(corpusData);
  const surahStatistics = extractSurahStatistics(corpusData);
  const wordMorphology = extractWordMorphology(corpusData);
  
  // Create indexes
  const ilmussarfIndex = createIlmussarfIndex(morphologicalReferences);
  const ilmunnahwaIndex = createIlmunnahwaIndex(surahStatistics);
  
  // Write ilmussarf (morphology) index
  console.log('\nWriting ilmussarf (morphology) index...');
  await writeJsonFile(path.join(OUTPUT_DIR, 'ilmussarf/index.json'), ilmussarfIndex, true);
  
  // Write ilmunnahwa (grammar) index
  console.log('\nWriting ilmunnahwa (grammar) index...');
  await writeJsonFile(path.join(OUTPUT_DIR, 'ilmunnahwa/index.json'), ilmunnahwaIndex, true);
  
  // Write word-level morphology
  console.log('\nWriting word-level morphology data...');
  await writeJsonFile(path.join(OUTPUT_DIR, 'morphology/word_morphology.json'), wordMorphology, true);
  
  // Write complete corpus reference
  console.log('\nWriting complete corpus reference...');
  const corpusReference = {
    meta: corpusData.meta,
    tag_reference: morphologicalReferences.tag_reference,
    pos_distribution: morphologicalReferences.pos_distribution,
    verb_form_distribution: morphologicalReferences.verb_form_distribution,
    statistics: morphologicalReferences.statistics
  };
  await writeJsonFile(path.join(OUTPUT_DIR, 'corpus_reference.json'), corpusReference, true);
  
  console.log('\n=== Transformation Complete ===');
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log('\nPreserved data:');
  console.log(`  - Morphological tags (ilmussarf): ${Object.keys(morphologicalReferences.tag_reference).length}`);
  console.log(`  - POS categories: ${morphologicalReferences.pos_distribution.length}`);
  console.log(`  - Verb forms: ${morphologicalReferences.verb_form_distribution.length}`);
  console.log(`  - Surah statistics (ilmunnahwa): ${Object.keys(surahStatistics).length}`);
  console.log(`  - Word-level morphology: ${Object.keys(wordMorphology).length}`);
}

// Run transformation
transform().catch(console.error);
