#!/usr/bin/env node

/**
 * Process Unique Words from Quranic Corpus Morphology
 * 
 * This script:
 * 1. Parses quranic-corpus-morphology-0.4.txt
 * 2. Groups words by lemma/root to combine variants (different harkat, irab, forms)
 * 3. Filters out particles and prepositions
 * 4. Calculates aggregated frequencies
 * 5. Loads translations from trackA files
 * 6. Creates a new words.json with unique words
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);

const MORPHOLOGY_FILE = path.join(__dirname, '../quranic-corpus-morphology-0.4.txt');
const TRACKA_DIR = path.join(__dirname, '../single words tracks');
const QURAN_ARABIC_FILE = path.join(__dirname, '../quran-arabic -text.json');
const OUTPUT_FILE = path.join(__dirname, '../words-unique.json');

// Particles and prepositions to filter out
const PARTICLES_AND_PREPOSITIONS = new Set([
  'P', // Preposition
  'CONJ', // Conjunction
  'DET', // Determiner
  'NEG', // Negative particle
  'REL', // Relative pronoun
  'PRON' // Pronoun (some may be kept, but many are particles)
]);

// Buckwalter transliteration to Arabic conversion
const buckwalterToArabic = {
  "'": 'ء',
  '|': 'آ',
  '>': 'أ',
  '&': 'ؤ',
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
  'G': 'ك',
  'N': 'ں',
  '{': 'ال',
  '}': 'ل',
  '~': 'ّ',
  '`': 'َ',
  'F': 'ُ',
  'N': 'ِ',
  'K': 'ً',
  'o': 'ٌ',
  'a': 'ٍ',
  'u': 'ْ',
  'a': 'ٰ',
  '~': 'ٓ',
  'c': 'ٔ',
  'O': 'ٕ',
  'W': 'ٖ',
  'V': 'ٗ',
  'J': '٘',
  'I': 'ٙ',
  '0': '٠',
  '1': '١',
  '2': '٢',
  '3': '٣',
  '4': '٤',
  '5': '٥',
  '6': '٦',
  '7': '٧',
  '8': '٨',
  '9': '٩'
};

function convertBuckwalterToArabic(buckwalter) {
  let arabic = '';
  for (let i = 0; i < buckwalter.length; i++) {
    const char = buckwalter[i];
    arabic += buckwalterToArabic[char] || char;
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
 * Load Quran Arabic text to get correct Arabic words
 */
async function loadQuranArabicText() {
  console.log('Loading Quran Arabic text...');
  
  try {
    let content = await readFile(QURAN_ARABIC_FILE, 'utf8');
    
    // Remove BOM if present
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    
    const quranData = JSON.parse(content);
    
    // Create a map of surah:ayah -> full verse text
    const verseMap = new Map();
    
    // Create a map of surah -> surah name
    const surahNameMap = new Map();
    
    for (const surah of quranData) {
      surahNameMap.set(surah.id, surah.name);
      for (const verse of surah.verses) {
        const key = `${surah.id}:${verse.id}`;
        verseMap.set(key, verse.text);
      }
    }
    
    console.log(`Loaded Arabic text for ${verseMap.size} verses and ${surahNameMap.size} surah names`);
    return { verseMap, surahNameMap };
  } catch (error) {
    console.error('Error loading Quran Arabic text:', error);
    return { verseMap: new Map(), surahNameMap: new Map() };
  }
}

/**
 * Load translations from trackA files
 */
async function loadTranslations() {
  console.log('Loading translations from trackA files...');
  
  const translations = new Map();
  
  try {
    const files = await readdir(TRACKA_DIR);
    const trackAFiles = files.filter(f => f.startsWith('trackA_') && f.endsWith('.json'));
    
    for (const file of trackAFiles) {
      const filePath = path.join(TRACKA_DIR, file);
      let content = await readFile(filePath, 'utf8');
      
      // Remove BOM if present
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }
      
      const words = JSON.parse(content);
      
      for (const word of words) {
        if (word.meanings && word.baseForm) {
          translations.set(word.baseForm, word.meanings);
        }
      }
    }
    
    console.log(`Loaded translations for ${translations.size} words`);
  } catch (error) {
    console.error('Error loading translations:', error);
  }
  
  return translations;
}

/**
 * Parse morphology file
 */
async function parseMorphologyFile(verseMap, surahNameMap) {
  console.log('Parsing morphology file...');
  const content = await readFile(MORPHOLOGY_FILE, 'utf8');
  const lines = content.split('\n');
  
  const words = [];
  let lineNumber = 0;
  
  for (const line of lines) {
    lineNumber++;
    
    // Skip comments and empty lines
    if (line.startsWith('#') || line.trim() === '') {
      continue;
    }
    
    // Skip header
    if (line.startsWith('LOCATION')) {
      continue;
    }
    
    const parts = line.split('\t');
    if (parts.length < 4) {
      continue;
    }
    
    const location = parts[0];
    const form = parts[1];
    const tag = parts[2];
    const features = parts[3];
    
    // Parse location (surah:ayah:word:token)
    const locationMatch = location.match(/\((\d+):(\d+):(\d+):(\d+)\)/);
    if (!locationMatch) {
      continue;
    }
    
    const surah = parseInt(locationMatch[1]);
    const ayah = parseInt(locationMatch[2]);
    const word = parseInt(locationMatch[3]);
    const token = parseInt(locationMatch[4]);
    
    // Parse features to extract lemma and root
    const featuresMap = {};
    const featureParts = features.split('|');
    for (const feature of featureParts) {
      const [key, value] = feature.split(':');
      if (key && value) {
        featuresMap[key] = value;
      }
    }
    
    // Only process STEM words (not PREFIX or SUFFIX)
    if (features.includes('PREFIX') || features.includes('SUFFIX')) {
      continue;
    }
    
    // Filter out particles and prepositions
    if (PARTICLES_AND_PREPOSITIONS.has(tag)) {
      continue;
    }
    
    const lemma = featuresMap.LEM || '';
    const root = featuresMap.ROOT || '';
    
    // Get correct Arabic from Quran verse text
    const verseKey = `${surah}:${ayah}`;
    const verseText = verseMap.get(verseKey) || '';
    const verseWords = verseText.split(' ');
    
    // The morphology file uses word indices that might not match actual word positions
    // when considering prefixes. We need to get the word as it appears in the verse.
    // Try to find the word by matching the Buckwalter form converted to Arabic
    let arabic = verseWords[word - 1] || '';
    
    // If the extracted word doesn't match the expected form, try to find it in the verse
    if (!arabic || arabic.length < 2) {
      const expectedArabic = convertBuckwalterToArabic(form);
      // Try to find a word in the verse that contains the expected form
      for (let i = 0; i < verseWords.length; i++) {
        if (verseWords[i].includes(expectedArabic) || expectedArabic.includes(verseWords[i])) {
          arabic = verseWords[i];
          break;
        }
      }
    }
    
    // Fallback to Buckwalter conversion if still not found
    if (!arabic) {
      arabic = convertBuckwalterToArabic(form);
    }
    
    // Get surah name
    const surahName = surahNameMap.get(surah) || `Surah ${surah}`;
    
    words.push({
      location: { surah, ayah, word, token },
      form,
      tag,
      features: featuresMap,
      lemma,
      root,
      arabic,
      surahName
    });
  }
  
  console.log(`Parsed ${words.length} word tokens from morphology file`);
  return words;
}

/**
 * Group words by lemma/root
 */
function groupWordsByLemma(words) {
  console.log('Grouping words by lemma/root...');
  
  const groupedWords = new Map();
  
  for (const word of words) {
    const key = word.lemma || word.root || word.form;
    
    if (!groupedWords.has(key)) {
      groupedWords.set(key, {
        lemma: word.lemma,
        root: word.root,
        forms: new Set(),
        variants: [],
        frequency: 0,
        occurrences: [],
        tags: new Set(),
        pos: word.tag
      });
    }
    
    const group = groupedWords.get(key);
    group.forms.add(word.form);
    group.variants.push(word);
    group.frequency++;
    group.occurrences.push({
      surah: word.location.surah,
      ayah: word.location.ayah,
      word: word.location.word,
      context: word.arabic,
      surahName: word.surahName,
      variantForm: word.arabic // Use the actual Arabic form as variant identifier
    });
    group.tags.add(word.tag);
  }
  
  console.log(`Grouped into ${groupedWords.size} unique words`);
  return groupedWords;
}

/**
 * Convert grouped words to output format
 */
function convertToOutputFormat(groupedWords, translations) {
  console.log('Converting to output format...');
  
  const outputWords = [];
  let idCounter = 0;
  
  for (const [key, group] of groupedWords) {
    // Get translation from trackA data
    const translation = translations.get(group.lemma) || translations.get(group.root) || {};
    
    // Use the most common actual Arabic form from occurrences
    const arabicForms = group.variants.map(v => v.arabic);
    const arabicCounts = {};
    arabicForms.forEach(form => {
      arabicCounts[form] = (arabicCounts[form] || 0) + 1;
    });
    const mostCommonArabic = Object.entries(arabicCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || group.variants[0]?.arabic || '';
    
    // Create a map of form -> actual Arabic from occurrences
    const formToArabicMap = {};
    group.variants.forEach(variant => {
      if (!formToArabicMap[variant.form]) {
        formToArabicMap[variant.form] = variant.arabic;
      }
    });
    
    const word = {
      id: `word_${idCounter++}`,
      arabic: mostCommonArabic,
      transliteration: convertBuckwalterToSpeakable(group.lemma || group.root || Array.from(group.forms)[0]),
      root: group.root || '',
      pos: group.pos,
      frequency: group.frequency,
      translations: {
        en: translation.english || '',
        ur: translation.urdu || '',
        tr: translation.turkish || '',
        id: translation.indonesian || '',
        bn: translation.bengali || '',
        es: translation.spanish || '',
        fr: translation.french || '',
        ru: translation.russian || '',
        sv: translation.swahili || '',
        zh: ''
      },
      occurrences: group.occurrences, // Include all occurrences
      themes: [],
      learnedState: 'new',
      isCore: group.frequency > 50, // Core words appear more than 50 times
      grammarDetails: {
        gender: null,
        number: null,
        derivedForm: null
      },
      variants: Array.from(group.forms).map(form => ({
        form,
        arabic: formToArabicMap[form] || convertBuckwalterToArabic(form),
        frequency: group.variants.filter(v => v.form === form).length
      }))
    };
    
    outputWords.push(word);
  }
  
  console.log(`Created ${outputWords.length} unique word entries`);
  return outputWords;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Starting unique words processing...');
    
    // Load Quran Arabic text and surah names
    const { verseMap, surahNameMap } = await loadQuranArabicText();
    
    // Load translations from trackA files
    const translations = await loadTranslations();
    
    // Parse morphology file with verse map and surah name map
    const words = await parseMorphologyFile(verseMap, surahNameMap);
    
    // Group words by lemma/root
    const groupedWords = groupWordsByLemma(words);
    
    // Convert to output format
    const outputWords = convertToOutputFormat(groupedWords, translations);
    
    // Sort by frequency (descending)
    outputWords.sort((a, b) => b.frequency - a.frequency);
    
    // Write output
    const output = {
      words: outputWords,
      metadata: {
        total: outputWords.length,
        chunks: Math.ceil(outputWords.length / 100),
        chunkSize: 100
      }
    };
    
    await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
    console.log(`Successfully wrote ${outputWords.length} unique words to ${OUTPUT_FILE}`);
    
  } catch (error) {
    console.error('Error processing unique words:', error);
    process.exit(1);
  }
}

main();
