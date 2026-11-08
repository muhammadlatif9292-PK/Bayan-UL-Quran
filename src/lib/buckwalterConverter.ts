/**
 * Buckwalter to Arabic Unicode converter
 * Converts Buckwalter transliteration (ASCII) to Arabic Unicode characters
 * This is a simplified converter for common Quranic Arabic characters
 */

const BUCKWALTER_TO_ARABIC: Record<string, string> = {
  // Consonants
  "'": 'ء', // hamza
  '|': 'آ', // alif madda
  '>': 'أ', // alif hamza above
  '&': 'ؤ', // waw hamza above
  '<': 'إ', // alif hamza below
  'A': 'ا', // alif
  'b': 'ب', // ba
  'p': 'ة', // ta marbuta
  't': 'ت', // ta
  'v': 'ث', // tha
  'j': 'ج', // jim
  'H': 'ح', // ha
  'x': 'خ', // kha
  'd': 'د', // dal
  '*': 'ذ', // dhal
  'r': 'ر', // ra
  'z': 'ز', // zay
  's': 'س', // sin
  '$': 'ش', // shin
  'S': 'ص', // sad
  'D': 'ض', // dad
  'T': 'ط', // ta
  'Z': 'ظ', // za
  'E': 'ع', // ayn
  'g': 'غ', // ghayn
  'f': 'ف', // fa
  'q': 'ق', // qaf
  'k': 'ك', // kaf
  'l': 'ل', // lam
  'I': 'ل', // Lam (support for lowercase 'l' to uppercase 'I' typo in raw dataset)
  'm': 'م', // mim
  'n': 'ن', // nun
  'h': 'ه', // ha
  'w': 'و', // waw
  'Y': 'ى', // alif maqsura
  'y': 'ي', // ya
  
  // Diacritics & Extended Quranic Corpus Symbols
  'a': '\u064E', // fatha
  'u': '\u064F', // damma
  'i': '\u0650', // kasra
  '~': '\u0651', // shadda
  'o': '\u0652', // sukun
  '^': '\u0653', // maddah above (ٓ - U+0653)
  '#': '\u0654', // hamza above (ٔ - U+0654)
  '_': '\u0640', // tatweel (ـ - U+0640)
  'F': '\u064B', // tanwin fath
  'N': '\u064C', // tanwin damm
  'K': '\u064D', // tanwin kasr
  'W': '\u0670', // alif khanjariyya (superscript alif)
  '`': '\u0670', // superscript alif (correct mapping)
  'c': '\u0672', // alif below
  '{': '\u0671', // alif wasla (correct mapping)
  '}': '\u0626', // ya hamza above (ئ - U+0626)
  ':': '\u06DC', // small high seen (ۜ - U+06DC)
  '@': '\u06DF', // silent alif / waw (small rounded zero above ۟ - U+06DF)
  '"': '\u06E0', // small high upright rectangular zero (۠ - U+06E0)
  '[': '\u06E2', // small high meem isolated form for Iqlab (ۢ - U+06E2)
  ';': '\u06E3', // small low seen (ۣ - U+06E3)
  ',': '\u06E5', // small waw (ۥ - U+06E5)
  '.': '\u06E6', // small ya (ۦ - U+06E6)
  '!': '\u06E8', // small high noon (ۨ - U+06E8)
  '-': '',       // imalah mark (omitted to prevent unsupported glyph rendering)
  '+': '',       // ishmam mark (omitted to prevent unsupported glyph rendering)
  '%': '',       // tashil mark (omitted to prevent unsupported glyph rendering)
  ']': '\u06ED', // small low meem for Iqlab (ۭ - U+06ED)
};

const BUCKWALTER_TO_ENGLISH_MAP: Record<string, string> = {
  // Consonants
  "'": '’',  // hamza
  '#': '’',  // hamza above
  '|': 'ā',  // alif madda
  '>': 'a',  // alif hamza above
  '&': 'u',  // waw hamza above
  '<': 'i',  // alif hamza below
  '@': '',   // silent marker
  'A': 'ā',  // alif -> long a
  'b': 'b',
  'p': 't',  // ta marbuta -> t
  't': 't',
  'v': 'th', // tha
  'j': 'j',
  'H': 'ḥ',  // ha (with dot under)
  'x': 'kh',
  'd': 'd',
  '*': 'dh', // dhal
  'r': 'r',
  'z': 'z',
  's': 's',
  '$': 'sh', // shin
  'S': 'ṣ',  // sad
  'D': 'ḍ',  // dad
  'T': 'ṭ',  // ta
  'Z': 'ẓ',  // za
  'E': '‘',  // ayn -> inverted apostrophe
  'g': 'gh', // ghayn
  'f': 'f',
  'q': 'q',
  'k': 'k',
  'l': 'l',
  'I': 'l',  // capital I is Lam in this dataset
  'm': 'm',
  'n': 'n',
  'h': 'h',
  'w': 'w',
  'Y': 'ā',  // alif maqsura
  'y': 'y',
};

/**
 * Convert Buckwalter transliteration to clean standard English phonetic transliteration
 * @param text - Messy Buckwalter string (e.g. "{I~a*iyna 'aAmanuwA@")
 * @returns Clean English transliteration (e.g. "Alladhīna Āmanū")
 */
export function buckwalterToEnglish(text: string): string {
  if (!text) return '';
  
  let clean = text;
  
  // Replace '{I' and '{l' with 'al' (Alif Wasla + Lam)
  clean = clean.replace(/\{I/g, 'al');
  clean = clean.replace(/\{l/g, 'al');
  clean = clean.replace(/\{L/g, 'al');
  
  // Replace '<in~a' with 'inna'
  clean = clean.replace(/<in~a/g, 'inna');
  
  // Apply sun letter assimilation for beautiful natural reading
  clean = clean.replace(/als~/g, 'ass');
  clean = clean.replace(/al\$~/g, 'ashsh');
  clean = clean.replace(/al\*~/g, 'adhdh');
  clean = clean.replace(/alr~/g, 'arr');
  clean = clean.replace(/alt~/g, 'att');
  clean = clean.replace(/alz~/g, 'azz');
  clean = clean.replace(/aln~/g, 'ann');
  clean = clean.replace(/ald~/g, 'add');
  clean = clean.replace(/alv~/g, 'athth');
  clean = clean.replace(/alS~/g, 'aṣṣ');
  clean = clean.replace(/alD~/g, 'aḍḍ');
  clean = clean.replace(/alT~/g, 'aṭṭ');
  clean = clean.replace(/alZ~/g, 'aẓẓ');
  
  // Normalize `{lo` or `{l` inside words to `l`
  clean = clean.replace(/\{lo/g, 'l');
  clean = clean.replace(/\{l/g, 'l');

  // Map standard long vowel patterns
  clean = clean.replace(/iy/g, 'ī');
  clean = clean.replace(/iY/g, 'ī');
  clean = clean.replace(/uw\^?A@/g, 'ū');
  clean = clean.replace(/uw/g, 'ū');
  clean = clean.replace(/uW/g, 'ū');
  clean = clean.replace(/aA/g, 'ā');
  clean = clean.replace(/aW/g, 'ā');
  
  let result = '';
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    
    // Shadda handling (double the preceding consonant)
    if (char === '~') {
      if (result.length > 0) {
        const prevChar = result[result.length - 1];
        if (/[a-zA-Zṣḍṭẓḥ‘]/.test(prevChar) && !/[āīū]/.test(prevChar)) {
          result += prevChar;
        }
      }
      continue;
    }

    // Maddah handling (skip as long vowel is already represented)
    if (char === '^') {
      continue;
    }
    
    // Superscript alif handling
    if (char === '`') {
      if (result.endsWith('a')) {
        result = result.slice(0, -1) + 'ā';
      } else if (!result.endsWith('ā')) {
        result += 'ā';
      }
      continue;
    }
    
    // Sukun / silent / Tajweed annotation marks
    if (
      char === 'o' || char === 'O' || char === '@' || char === '_' ||
      char === '[' || char === ']' || char === ',' || char === '.' ||
      char === '"' || char === ':' || char === ';' || char === '!' ||
      char === '-' || char === '+' || char === '%'
    ) {
      continue;
    }
    
    // Vowels
    if (char === 'a') {
      if (result.endsWith('ā') || result.endsWith('a')) {
        continue;
      }
      result += 'a';
      continue;
    }
    if (char === 'u') {
      if (result.endsWith('ū') || result.endsWith('u')) {
        continue;
      }
      result += 'u';
      continue;
    }
    if (char === 'i') {
      if (result.endsWith('ī') || result.endsWith('i')) {
        continue;
      }
      result += 'i';
      continue;
    }
    
    // Tanwins
    if (char === 'F') {
      result += 'an';
      continue;
    }
    if (char === 'N') {
      result += 'un';
      continue;
    }
    if (char === 'K') {
      result += 'in';
      continue;
    }
    
    // Standard character mapping
    const mapped = BUCKWALTER_TO_ENGLISH_MAP[char];
    if (mapped !== undefined) {
      result += mapped;
    } else {
      result += char;
    }
  }
  
  result = result.replace(/\s+/g, ' ').trim();
  
  // Capitalize first letter of each word
  result = result.split(' ').map(word => {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
  
  return result;
}

/**
 * Format Buckwalter root string to beautiful Arabic letters (e.g. "ع - ذ - ب")
 * @param root - Root string in Buckwalter format (e.g. "E*b")
 * @returns Beautifully formatted Arabic letters or original root if not convertible
 */
export function formatRoot(root: string): string {
  if (!root) return '';
  const parts = root.split('').map(char => {
    if (char === ' ' || char === '-' || char === '/' || char === '?') return '';
    const arabicChar = BUCKWALTER_TO_ARABIC[char];
    return arabicChar || char;
  }).filter(Boolean);
  
  if (parts.length === 0) return root;
  return parts.join(' - ');
}

/**
 * Convert Buckwalter transliteration to Arabic Unicode
 * @param buckwalter - Buckwalter transliteration string
 * @returns Arabic Unicode string
 */
export function buckwalterToArabic(buckwalter: string): string {
  if (!buckwalter) return '';
  
  let arabic = '';
  for (let i = 0; i < buckwalter.length; i++) {
    const char = buckwalter[i];
    const mapped = BUCKWALTER_TO_ARABIC[char];
    arabic += mapped !== undefined ? mapped : char;
  }
  return arabic;
}

/**
 * Check if a string is likely Buckwalter transliteration
 * @param text - Text to check
 * @returns true if text appears to be Buckwalter format
 */
export function isBuckwalter(text: string): boolean {
  if (!text) return false;
  // If text already contains Arabic Unicode characters (U+0600 - U+06FF), it is NOT raw Buckwalter ASCII
  if (/[\u0600-\u06FF]/.test(text)) return false;
  // Check for common Buckwalter markers or case-sensitive Buckwalter tokens
  const buckwalterMarkers = /[<>~^$@{}\[\]\\|_`*&'#.,:;!+%"AEYHSZDTFKNW]/;
  return buckwalterMarkers.test(text);
}

/**
 * Convert text to Arabic if it's in Buckwalter format (or contains no Arabic characters), otherwise return as-is
 * @param text - Text to convert
 * @returns Arabic Unicode string
 */
export function toArabicIfNeeded(text: string): string {
  if (!text) return '';
  if (!/[\u0600-\u06FF]/.test(text)) {
    return buckwalterToArabic(text);
  }
  return text;
}

// Complete map of Arabic characters to standard English phonetic transliteration consonants
const CONSONANTS: Record<string, string> = {
  '\u0628': 'b',
  '\u062A': 't',
  '\u062B': 'th',
  '\u062C': 'j',
  '\u062D': 'ḥ',
  '\u062E': 'kh',
  '\u062F': 'd',
  '\u0630': 'dh',
  '\u0631': 'r',
  '\u0632': 'z',
  '\u0633': 's',
  '\u0634': 'sh',
  '\u0635': 'ṣ',
  '\u0636': 'ḍ',
  '\u0637': 'ṭ',
  '\u0638': 'ẓ',
  '\u0639': '‘',
  '\u063A': 'gh',
  '\u0641': 'f',
  '\u0642': 'q',
  '\u0643': 'k',
  '\u0644': 'l',
  '\u0645': 'm',
  '\u0646': 'n',
  '\u0647': 'h',
  '\u0648': 'w',
  '\u064A': 'y',
  '\u0649': 'ā', // Alif maqsura
  '\u0629': 'h', // Ta marbuta (rendered as t when vocalized, h at pause)
};

// Map of Arabic vowel diacritics
const HARAKAT: Record<string, string> = {
  '\u064E': 'a',  // fatha
  '\u064F': 'u',  // damma
  '\u0650': 'i',  // kasra
  '\u064B': 'an', // tanwin fatha
  '\u064C': 'un', // tanwin damma
  '\u064D': 'in', // tanwin kasra
};

/**
 * Phonetically transliterates any Arabic text to beautiful and accurate English
 * @param arabic - Arabic string to transliterate
 * @returns Beautiful, correct English transliteration matching the exact displayed text
 */
export function transliterateArabicToEnglish(arabic: string): string {
  if (!arabic) return '';
  
  // Normalize unpointed ya with sukun (e.g. in shay'in شَىْء) to standard pointed ya for accurate diphthong transliteration
  const cleanSource = arabic.replace(/\u0649\u0652/g, '\u064A\u0652');

  // Strip any leading/trailing spaces and keep spaces inside
  let result = '';
  const len = cleanSource.length;
  
  for (let i = 0; i < len; i++) {
    const char = cleanSource[i];
    const nextChar = i + 1 < len ? cleanSource[i + 1] : '';
    const nextNextChar = i + 2 < len ? cleanSource[i + 2] : '';
    
    // Ignore non-essential Quranic decorative elements & maddah mark
    if (char === '\u0640') continue; // Tatweel
    if (char === '\u0651') continue; // Shadda (handled under consonant doubling check)
    if (char === '\u0652' || char === '\u06E1') continue; // Sukun (silent)
    if (char === '\u0653') continue; // Maddah above (long vowel already represented)
    
    // Stop list of minor Quranic small marks that don't change core pronunciation
    if (char === '\u06DC' || char === '\u06DF' || char === '\u06E0' ||
        char === '\u06E2' || char === '\u06E3' || char === '\u06E4' || 
        char === '\u06E7' || char === '\u06E8' || char === '\u06EA' ||
        char === '\u06EB' || char === '\u06EC' || char === '\u06ED') {
      continue;
    }
    
    // Check if we need to double this consonant due to a shadda ahead
    let hasShadda = false;
    if (nextChar === '\u0651' || 
        (HARAKAT[nextChar] !== undefined && nextNextChar === '\u0651') ||
        (nextChar === '\u0640' && nextNextChar === '\u0651')) {
      hasShadda = true;
    }
    
    // Spaces
    if (char === ' ') {
      result += ' ';
      continue;
    }
    
    // Hamzas and Alifs
    if (char === '\u0621' || char === '\u0654' || char === '\u0655') { // Independent Hamza or Hamza Above/Below
      const isStart = result.length === 0 || result.endsWith(' ');
      if (!isStart) {
        result += '’';
      }
      continue;
    }
    if (char === '\u0622') { // Alif madda
      result += 'ā';
      continue;
    }
    if (char === '\u0623') { // Alif hamza above
      const isStart = result.length === 0 || result.endsWith(' ');
      result += isStart ? 'a' : '’a';
      continue;
    }
    if (char === '\u0625') { // Alif hamza below
      const isStart = result.length === 0 || result.endsWith(' ');
      result += isStart ? 'i' : '’i';
      continue;
    }
    if (char === '\u0624') { // Waw hamza above
      result += '’u';
      continue;
    }
    if (char === '\u0626') { // Ya hamza above
      result += '’';
      continue;
    }
    if (char === '\u0671') { // Alif wasla
      const isStart = result.length === 0 || result.endsWith(' ');
      if (isStart) {
        if (nextChar === '\u0644') {
          result += 'a';
        } else {
          const restWord = cleanSource.slice(i + 1).split(' ')[0];
          const vowels = [...restWord].filter(c => c === '\u064E' || c === '\u064F' || c === '\u0650');
          result += vowels[0] === '\u064F' ? 'u' : 'i';
        }
      }
      continue;
    }
    
    // Superscript Alif
    if (char === '\u0670') {
      if (result.endsWith('a')) {
        result = result.slice(0, -1) + 'ā';
      } else if (!result.endsWith('ā')) {
        result += 'ā';
      }
      continue;
    }
    
    // Small Waw and Small Ya
    if (char === '\u06E5') {
      if (result.endsWith('u')) {
        result = result.slice(0, -1) + 'ū';
      } else {
        result += 'ū';
      }
      continue;
    }
    if (char === '\u06E6') {
      if (result.endsWith('i')) {
        result = result.slice(0, -1) + 'ī';
      } else {
        result += 'ī';
      }
      continue;
    }
    
    // Harakat (Vowels)
    if (HARAKAT[char] !== undefined) {
      const v = HARAKAT[char];
      if (v === 'a') {
        if (!result.endsWith('ā') && !result.endsWith('a')) {
          result += 'a';
        }
      } else if (v === 'i') {
        if (!result.endsWith('ī') && !result.endsWith('i')) {
          result += 'i';
        }
      } else if (v === 'u') {
        if (!result.endsWith('ū') && !result.endsWith('u')) {
          result += 'u';
        }
      } else {
        result += v; // tanwin (an, un, in)
      }
      continue;
    }
    
    // Alif long vowel check
    if (char === '\u0627') {
      if (result.endsWith('a')) {
        result = result.slice(0, -1) + 'ā';
      } else if (result.endsWith('i') || result.endsWith('ū')) {
        // Silent or spelling support (e.g. plural waw + alif)
      } else if (result.length > 0 && !result.endsWith(' ')) {
        // Trailing alif after consonant
      } else {
        result += 'a';
      }
      continue;
    }
    
    // Waw consonant or long vowel
    if (char === '\u0648') {
      if (result.endsWith('u') && HARAKAT[nextChar] === undefined && !hasShadda) {
        result = result.slice(0, -1) + 'ū';
      } else {
        const cons = hasShadda ? 'ww' : 'w';
        result += cons;
      }
      continue;
    }
    
    // Ya consonant or long vowel
    if (char === '\u064A') {
      if (result.endsWith('i') && HARAKAT[nextChar] === undefined && !hasShadda) {
        result = result.slice(0, -1) + 'ī';
      } else {
        const cons = hasShadda ? 'yy' : 'y';
        result += cons;
      }
      continue;
    }

    // Alif Maqsura / Unpointed Ya (\u0649)
    if (char === '\u0649') {
      if (result.endsWith('i') && HARAKAT[nextChar] === undefined && !hasShadda) {
        result = result.slice(0, -1) + 'ī';
      } else if (result.endsWith('a')) {
        result = result.slice(0, -1) + 'ā';
      } else if (hasShadda) {
        result += 'yy';
      } else if (!result.endsWith('ā')) {
        result += 'ā';
      }
      continue;
    }

    // Ta Marbuta (\u0629)
    if (char === '\u0629') {
      if (HARAKAT[nextChar] !== undefined || nextChar === '\u0651') {
        result += 't';
      } else {
        result += 'h';
      }
      continue;
    }
    
    // Standard Consonants
    const englishCons = CONSONANTS[char];
    if (englishCons !== undefined) {
      let mapped = englishCons;
      if (hasShadda) {
        if (mapped.length > 1) {
          mapped = mapped[0] + mapped; // e.g. ssh, ddh
        } else {
          mapped = mapped + mapped; // e.g. nn, bb, tt
        }
      }
      result += mapped;
    }
  }
  
  // Clean up long vowel overlaps and initial doubles
  result = result
    .replace(/aā/g, 'ā')
    .replace(/iī/g, 'ī')
    .replace(/uū/g, 'ū')
    .replace(/āa/g, 'ā')
    .replace(/īi/g, 'ī')
    .replace(/ūu/g, 'ū')
    .replace(/’+/g, '’')
    .replace(/‘+/g, '‘')
    .replace(/\s+/g, ' ');
    
  // Simplify double consonants at the start of any word (e.g. Mma -> Ma, Nna -> Na)
  return result.split(' ').map(w => {
    if (!w) return '';
    // Simplify word-initial doubles, e.g. Nn -> N, Ss -> S, Ddh -> Dh, Ssh -> Sh
    let cleanedWord = w.replace(/^([a-zA-Z])\1/gi, '$1');
    cleanedWord = cleanedWord.replace(/^([sdktg])\1h/gi, '$1h'); // e.g., ssh -> sh, ddh -> dh
    
    return cleanedWord.charAt(0).toUpperCase() + cleanedWord.slice(1);
  }).join(' ');
}
