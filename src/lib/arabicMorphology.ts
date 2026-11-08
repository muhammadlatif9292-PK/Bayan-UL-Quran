/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Arabic Morphology & Grammatical Filtering Engine
 * Tokenizes Arabic words into proclitics, stem, and enclitics, and resolves
 * Root (جذر), Baab / Derived Form (باب I–X), and Wazan / Pattern (وزن)
 * to prevent false-positive matches across morphologically distinct words.
 */

export interface MorphologicalToken {
  raw: string;
  proclitics: string[];
  enclitics: string[];
  stemVocalized: string;
  stemBase: string;
  stemExpanded: string;
  baab: string;
  baabNumber: number | null;
  wazan: string;
  root: string;
  pos: string;
  startsWithHamzatWasl: boolean;
  firstConsonantHasSukun: boolean;
}

export interface MorphologicalConstraint {
  expectedRoot?: string;
  expectedLemma?: string;
  expectedBaab?: string | number | null;
  expectedWazan?: string;
  expectedPos?: string;
  morphTag?: string;
}

// Genuine grammatical proclitics (definite article, conjunctions, prepositions, future particle)
const ARABIC_PREFIXES = [
  'وال',     // Wa + Al
  'فال',     // Fa + Al
  'بال',     // Bi + Al
  'كال',     // Ka + Al
  'ولل',     // Wa + Lil
  'فلل',     // Fa + Lil
  'ال',      // Al (the)
  'لل',      // Lil (for the)
  'فب',      // Fa + Bi
  'فل',      // Fa + Li
  'وب',      // Wa + Bi
  'ول',      // Wa + Li
  'وس',      // Wa + Sa
  'فس',      // Fa + Sa
  'و',       // Wa (and)
  'ف',       // Fa (then/so)
  'ب',       // Bi (with/in)
  'ل',       // Li (for/to)
  'ك',       // Ka (like/as)
  'س',       // Sa (will)
];

// Attached pronoun & inflectional suffixes
const ARABIC_SUFFIXES = [
  'كموها',
  'تموه',
  'ناهم',
  'هما',     // Humā (them two)
  'كما',     // Kumā (you two)
  'هم',      // Hum (them)
  'هن',      // Hunna (them fem)
  'كم',      // Kum (you pl)
  'كن',      // Kunna (you pl fem)
  'ها',      // Hā (her/it)
  'نا',      // Nā (us)
  'ني',      // Nī (me)
  'وا',      // ū (plural verb ending with silent alif)
  'ات',      // Āt (feminine plural)
  'ون',      // ūn (masc plural)
  'ين',      // īn (dual/masc plural)
  'ان',      // ān (dual)
  'تم',      // Tum (2nd pl past suffix)
  'تن',      // Tunna
  'ت',       // Ta/Tu/Ti/at (when stem >= 3 letters)
  'ة',       // Ta marbuta (feminine marker)
  'ه',       // Hu (him/it)
  'ك',       // Ka (you masc)
];

// Common Arabic particles/prepositions
const ARABIC_PARTICLES = [
  'في',      // Fī (in)
  'فى',      // Fī (Uthmani)
  'على',     // 'Alā (on/upon)
  'من',      // Min (from)
  'إلى',     // Ilā (to)
  'الى',     // Ilā
  'عن',      // 'An (about/from)
  'ب',       // Bi (with)
  'ل',       // Li (for)
  'ك',       // Ka (like/as)
  'و',       // Wa (and)
  'ف',       // Fa (then)
  'ثم',      // Thumma (then)
  'أو',      // Aw (or)
  'أم',      // Am (or)
  'بل',      // Bal (rather)
  'لا',      // Lā (no/not)
  'إن',      // Inna (verily)
  'أن',      // Anna (that)
  'لن',      // Lan (never)
  'لم',      // Lam (did not)
  'قد',      // Qad (indeed)
  'لكن',     // Lākin (but)
  'حتى',     // ḥattā (until)
  'إذ',      // Idh (when)
  'إذا',     // Idhā (when)
  'متى',     // Matā (when)
  'كيف',     // Kayfa (how)
  'لماذا',   // Limādhā (why)
  'هل',      // Hal (question particle)
  'ما',      // Mā
  'يا',      // Yā (vocative)
];

const ROMAN_TO_BAAB_NUM: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10
};

const BAAB_LABELS: Record<number, { baab: string; defaultWazan: string }> = {
  1: { baab: 'Form I (المجرّد)', defaultWazan: 'فَعَلَ / يَفْعَلُ' },
  2: { baab: 'Form II (تَفْعِيل)', defaultWazan: 'فَعَّلَ / يُفَعِّلُ' },
  3: { baab: 'Form III (مُفَاعَلَة)', defaultWazan: 'فَاعَلَ / يُفَاعِلُ' },
  4: { baab: 'Form IV (إِفْعَال)', defaultWazan: 'أَفْعَلَ / يُفْعِلُ' },
  5: { baab: 'Form V (تَفَعُّل)', defaultWazan: 'تَفَعَّلَ / يَتَفَعَّلُ' },
  6: { baab: 'Form VI (تَفَاعُل)', defaultWazan: 'تَفَاعَلَ / يَتَفَاعَلُ' },
  7: { baab: 'Form VII (ٱنْفِعَال)', defaultWazan: 'ٱنْفَعَلَ / يَنْفَعِلُ' },
  8: { baab: 'Form VIII (ٱفْتِعَال)', defaultWazan: 'ٱفْتَعَلَ / يَفْتَعِلُ' },
  9: { baab: 'Form IX (ٱفْعِلَال)', defaultWazan: 'ٱفْعَلَّ / يَفْعَلُّ' },
  10: { baab: 'Form X (ٱسْتِفْعَال)', defaultWazan: 'ٱسْتَفْعَلَ / يَسْتَفْعِلُ' }
};

// High-frequency irregular/weak Quranic stems mapped to exact root & baab
const IRREGULAR_STEM_LEXICON: Record<string, { root: string; baabNumber: number; wazan: string; pos: string }> = {
  'تري': { root: 'ر-ا-ي', baabNumber: 1, wazan: 'تَفْعَلُ', pos: 'Verb' },
  'يري': { root: 'ر-ا-ي', baabNumber: 1, wazan: 'يَفْعَلُ', pos: 'Verb' },
  'نري': { root: 'ر-ا-ي', baabNumber: 1, wazan: 'نَفْعَلُ', pos: 'Verb' },
  'اري': { root: 'ر-ا-ي', baabNumber: 1, wazan: 'أَفْعَلُ', pos: 'Verb' },
  'راي': { root: 'ر-ا-ي', baabNumber: 1, wazan: 'فَعَلَ', pos: 'Verb' },
  'ترون': { root: 'ر-ا-ي', baabNumber: 1, wazan: 'تَفْعَلُونَ', pos: 'Verb' },
  'يرون': { root: 'ر-ا-ي', baabNumber: 1, wazan: 'يَفْعَلُونَ', pos: 'Verb' },
  'افتري': { root: 'ف-ر-ي', baabNumber: 8, wazan: 'ٱفْتَعَلَ', pos: 'Verb' },
  'يفتري': { root: 'ف-ر-ي', baabNumber: 8, wazan: 'يَفْتَعِلُ', pos: 'Verb' },
  'تفتري': { root: 'ف-ر-ي', baabNumber: 8, wazan: 'تَفْتَعِلُ', pos: 'Verb' },
  'يفترون': { root: 'ف-ر-ي', baabNumber: 8, wazan: 'يَفْتَعِلُونَ', pos: 'Verb' },
  'تفترون': { root: 'ف-ر-ي', baabNumber: 8, wazan: 'تَفْتَعِلُونَ', pos: 'Verb' },
  'مفتري': { root: 'ف-ر-ي', baabNumber: 8, wazan: 'مُفْتَعِل', pos: 'Noun' },
  'مفتر': { root: 'ف-ر-ي', baabNumber: 8, wazan: 'مُفْتَعِل', pos: 'Noun' },
  'مفترين': { root: 'ف-ر-ي', baabNumber: 8, wazan: 'مُفْتَعِلِينَ', pos: 'Noun' },
  'اتقي': { root: 'و-ق-ي', baabNumber: 8, wazan: 'ٱفْتَعَلَ', pos: 'Verb' },
  'يتقي': { root: 'و-ق-ي', baabNumber: 8, wazan: 'يَفْتَعِلُ', pos: 'Verb' },
  'تتقي': { root: 'و-ق-ي', baabNumber: 8, wazan: 'تَفْتَعِلُ', pos: 'Verb' },
  'متقي': { root: 'و-ق-ي', baabNumber: 8, wazan: 'مُفْتَعِل', pos: 'Noun' },
  'متقين': { root: 'و-ق-ي', baabNumber: 8, wazan: 'مُفْتَعِلِينَ', pos: 'Noun' },
  'امن': { root: 'ا-م-ن', baabNumber: 4, wazan: 'أَفْعَلَ', pos: 'Verb' },
  'يومن': { root: 'ا-م-ن', baabNumber: 4, wazan: 'يُفْعِلُ', pos: 'Verb' },
  'تومن': { root: 'ا-م-ن', baabNumber: 4, wazan: 'تُفْعِلُ', pos: 'Verb' },
  'مومن': { root: 'ا-م-ن', baabNumber: 4, wazan: 'مُفْعِل', pos: 'Noun' },
  'ايمان': { root: 'ا-م-ن', baabNumber: 4, wazan: 'إِفْعَال', pos: 'Noun' },
  'اقام': { root: 'ق-و-م', baabNumber: 4, wazan: 'أَفْعَلَ', pos: 'Verb' },
  'يقيم': { root: 'ق-و-م', baabNumber: 4, wazan: 'يُفْعِلُ', pos: 'Verb' },
  'مقيم': { root: 'ق-و-م', baabNumber: 4, wazan: 'مُفْعِل', pos: 'Noun' },
  'اراد': { root: 'ر-و-د', baabNumber: 4, wazan: 'أَفْعَلَ', pos: 'Verb' },
  'يريد': { root: 'ر-و-د', baabNumber: 4, wazan: 'يُفْعِلُ', pos: 'Verb' },
  'اصاب': { root: 'ص-و-ب', baabNumber: 4, wazan: 'أَفْعَلَ', pos: 'Verb' },
  'يصيب': { root: 'ص-و-ب', baabNumber: 4, wazan: 'يُفْعِلُ', pos: 'Verb' },
  'اطاع': { root: 'ط-و-ع', baabNumber: 4, wazan: 'أَفْعَلَ', pos: 'Verb' },
  'يطيع': { root: 'ط-و-ع', baabNumber: 4, wazan: 'يُفْعِلُ', pos: 'Verb' },
  'استقام': { root: 'ق-و-م', baabNumber: 10, wazan: 'ٱسْتَفْعَلَ', pos: 'Verb' },
  'يستقيم': { root: 'ق-و-م', baabNumber: 10, wazan: 'يَسْتَفْعِلُ', pos: 'Verb' },
  'مستقيم': { root: 'ق-و-م', baabNumber: 10, wazan: 'مُسْتَفْعِل', pos: 'Noun' },
  'استطاع': { root: 'ط-و-ع', baabNumber: 10, wazan: 'ٱسْتَفْعَلَ', pos: 'Verb' },
  'يستطيع': { root: 'ط-و-ع', baabNumber: 10, wazan: 'يَسْتَفْعِلُ', pos: 'Verb' },
  'قال': { root: 'ق-و-ل', baabNumber: 1, wazan: 'فَعَلَ', pos: 'Verb' },
  'يقول': { root: 'ق-و-ل', baabNumber: 1, wazan: 'يَفْعُلُ', pos: 'Verb' },
  'تقول': { root: 'ق-و-ل', baabNumber: 1, wazan: 'تَفْعُلُ', pos: 'Verb' },
  'كان': { root: 'ك-و-ن', baabNumber: 1, wazan: 'فَعَلَ', pos: 'Verb' },
  'يكون': { root: 'ك-و-ن', baabNumber: 1, wazan: 'يَفْعُلُ', pos: 'Verb' },
  'تكون': { root: 'ك-و-ن', baabNumber: 1, wazan: 'تَفْعُلُ', pos: 'Verb' },
  'جاء': { root: 'ج-ي-ا', baabNumber: 1, wazan: 'فَعَلَ', pos: 'Verb' },
  'شاء': { root: 'ش-ي-ا', baabNumber: 1, wazan: 'فَعَلَ', pos: 'Verb' },
  'يشاء': { root: 'ش-ي-ا', baabNumber: 1, wazan: 'يَفْعَلُ', pos: 'Verb' },
  'تشاء': { root: 'ش-ي-ا', baabNumber: 1, wazan: 'تَفْعَلُ', pos: 'Verb' },
};

/**
 * Remove Arabic diacritics (harakat), dagger alif, tatweel, and Uthmani pause/annotation marks
 */
export function removeDiacritics(text: string): string {
  return text.replace(/[\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
}

/**
 * Normalize root string into canonical hyphen-separated Arabic consonants (e.g. "ف-ر-ي")
 */
export function normalizeRootString(root?: string | null): string {
  if (!root) return '';
  const cleaned = removeDiacritics(root)
    .replace(/[أإآٱءؤ]/g, 'ا')
    .replace(/[ئى]/g, 'ي')
    .replace(/[^ابتثجحخدذرزسشصضطظعغفقكلمنهوي]/g, '');
  if (!cleaned || cleaned.length < 2) return '';
  return cleaned.split('').join('-');
}

/**
 * Check if two normalized roots represent the same Arabic root, accounting for weak radical alternations (ا/و/ي)
 */
export function areRootsCompatible(rootA?: string | null, rootB?: string | null): boolean {
  const normA = normalizeRootString(rootA);
  const normB = normalizeRootString(rootB);
  if (!normA || !normB) return true; // If either lacks a resolved root, do not reject on root alone
  if (normA === normB) return true;

  const radsA = normA.split('-');
  const radsB = normB.split('-');
  if (radsA.length !== radsB.length) return false;

  const isWeak = (c: string) => c === 'ا' || c === 'و' || c === 'ي';
  let weakDiffs = 0;
  for (let i = 0; i < radsA.length; i++) {
    if (radsA[i] === radsB[i]) continue;
    if (isWeak(radsA[i]) && isWeak(radsB[i])) {
      weakDiffs++;
    } else {
      return false;
    }
  }
  return weakDiffs <= 1;
}

/**
 * Check if a word is a particle/preposition
 */
export function isParticle(word: string): boolean {
  const cleanWord = removeDiacritics(word.trim())
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي');
  return ARABIC_PARTICLES.some(p => {
    const cleanP = removeDiacritics(p).replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي');
    return cleanP === cleanWord;
  });
}

/**
 * Normalize bare Arabic letters for stem comparison
 */
function normalizeStemLetters(str: string, expandDaggerAlif: boolean = false): string {
  let s = str
    .replace(/[\u0640\u06D6-\u06ED\u06DD\u06DE\u06E9\u06FD\u06FE\s.,،؛:?!"'()\[\]{}\-]/g, '')
    .replace(/[\u064B-\u065F]/g, '');

  if (expandDaggerAlif) {
    s = s.replace(/(?<![اأإآٱى])\u0670(?![اأإآٱى])/g, 'ا');
  }
  s = s.replace(/\u0670/g, '');

  return s
    .replace(/[ءأإآٱ]ا/g, 'ا')
    .replace(/[أإآٱء]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/[ئى]/g, 'ي')
    .replace(/اا+/g, 'ا')
    .trim();
}

/**
 * Parse QAC / corpus morphology tags (e.g. "VF:8", "(VIII)", "Form IV", "ACT_PCPL", "ROOT:فرى")
 */
export function parseCorpusMorphTag(
  morphTag?: string | null,
  pattern?: string | null,
  derivedForm?: string | null
): {
  baabNumber: number | null;
  baab: string;
  wazan: string;
  root: string;
  pos: string;
} {
  const combined = [morphTag, pattern, derivedForm].filter(Boolean).join(' ');
  let baabNumber: number | null = null;
  let wazan = '';
  let root = '';
  let pos = '';

  if (combined) {
    // Match VF:8 orForm VIII or (VIII)
    const vfMatch = combined.match(/VF\s*:\s*(\d+)/i);
    if (vfMatch) {
      baabNumber = parseInt(vfMatch[1], 10);
    } else {
      const romanMatch = combined.match(/(?:\(|Form\s+)(X|IX|VIII|VII|VI|V|IV|III|II|I)(?:\)|\b)/i);
      if (romanMatch) {
        const key = romanMatch[1].toUpperCase();
        if (ROMAN_TO_BAAB_NUM[key]) {
          baabNumber = ROMAN_TO_BAAB_NUM[key];
        }
      }
    }

    const rootMatch = combined.match(/ROOT\s*:\s*([^\s|;]+)/i);
    if (rootMatch) {
      root = normalizeRootString(rootMatch[1]);
    }

    if (/ACT_PCPL/i.test(combined)) {
      wazan = baabNumber && baabNumber > 1 ? 'اسم فاعل (مُـ...)' : 'فَاعِل';
      pos = 'Noun';
    } else if (/PASS_PCPL/i.test(combined)) {
      wazan = baabNumber && baabNumber > 1 ? 'اسم مفعول (مُـ...)' : 'مَفْعُول';
      pos = 'Noun';
    } else if (/\bVN\b|MASDAR/i.test(combined)) {
      pos = 'Noun';
    } else if (/\bV\b|VERB|IMPF|PERF|IMPV/i.test(combined)) {
      pos = 'Verb';
    }

    // If pattern contains an explicit Arabic wazan scale (contains ف ع ل)
    if (pattern && /[فعل]/.test(pattern)) {
      wazan = pattern.trim();
    }
  }

  const baabInfo = baabNumber ? BAAB_LABELS[baabNumber] : null;
  return {
    baabNumber,
    baab: baabInfo ? baabInfo.baab : '',
    wazan: wazan || (baabInfo ? baabInfo.defaultWazan : ''),
    root,
    pos
  };
}

/**
 * Check whether stripping a candidate proclitic from `stemBase` would corrupt a derived verbal/nominal stem
 * (such as Form VIII افتعل, Form X استفعل, Form VII انفعل, or a stem starting with Hamzat al-Wasl).
 */
function canSafelyStripProclitic(
  vocalizedRemaining: string,
  baseRemaining: string,
  prefix: string
): boolean {
  if (baseRemaining.length - prefix.length < 3) return false;

  const trimmedVoc = vocalizedRemaining.trim();
  const startsWithWasl = trimmedVoc.startsWith('\u0671');

  // If the token starts directly with Hamzat al-Wasl (ٱ), ONLY the definite article "ال" can be stripped.
  // Words like ٱفْتَرَىٰ, ٱسْتَكْبَرَ, ٱنطَلَقُوا۟ start with ٱ as part of their verbal Baab (Form VII/VIII/X).
  if (startsWithWasl && prefix !== 'ال') {
    return false;
  }

  // Genuine single-letter proclitics (وَ, فَ, بِ, لِ, كَ, سَ) NEVER carry a sukun (\u0652 or \u06E1) on their first consonant.
  const firstLetterHasSukun =
    /^[^\u0621-\u064A\u0671]*[\u0621-\u064A\u0671][\u064B-\u065F]*[\u0652\u06E1]/.test(trimmedVoc);
  if (firstLetterHasSukun && prefix !== 'ال') {
    return false;
  }

  // If the prefix does not end with "ال", check if the consonant immediately following the prefix in vocalized text
  // is Hamzat al-Wasl of Form VII/VIII/X: that IS valid (e.g. وَٱفْتَرَىٰ -> و + ٱفْتَرَىٰ),
  // whereas stripping a letter that is part of a Mudari' or root where the 2nd letter has sukun is NOT valid unless the prefix is ವ/ف/ب/ل/ك/س.
  return true;
}

/**
 * Advance past `charCount` base Arabic letters in a vocalized string, preserving diacritics on the remaining substring.
 */
function sliceVocalizedByBaseCount(vocalized: string, charCount: number): string {
  let seenLetters = 0;
  let i = 0;
  while (i < vocalized.length && seenLetters < charCount) {
    const code = vocalized.charCodeAt(i);
    const isBaseLetter =
      (code >= 0x0621 && code <= 0x063a) ||
      (code >= 0x0641 && code <= 0x064a) ||
      code === 0x0671;
    if (isBaseLetter) {
      seenLetters++;
    }
    i++;
  }
  // Skip any trailing combining marks belonging to the last stripped base letter
  while (i < vocalized.length) {
    const code = vocalized.charCodeAt(i);
    if ((code >= 0x064b && code <= 0x065f) || code === 0x0670 || code === 0x0640) {
      i++;
    } else {
      break;
    }
  }
  return vocalized.slice(i);
}

/**
 * Analyze the core stem (after clitic removal) to determine its Baab (Form I–X), Wazan, and Root.
 */
function analyzeStemBaabAndWazan(
  stemVocalized: string,
  stemBase: string,
  stemExpanded: string,
  constraint?: MorphologicalConstraint
): {
  baabNumber: number | null;
  baab: string;
  wazan: string;
  root: string;
  pos: string;
} {
  // 1. Check explicit corpus tags if provided
  const tagInfo = parseCorpusMorphTag(
    constraint?.morphTag,
    constraint?.expectedWazan,
    typeof constraint?.expectedBaab === 'string' ? constraint.expectedBaab : undefined
  );
  const explicitBaabNum =
    typeof constraint?.expectedBaab === 'number' ? constraint.expectedBaab : tagInfo.baabNumber;
  const explicitRoot = normalizeRootString(constraint?.expectedRoot || tagInfo.root);

  // 2. Check irregular / weak stem lexicon first (handles تَرَىٰ vs ٱفْتَرَىٰ deterministically)
  const lexEntry =
    IRREGULAR_STEM_LEXICON[stemBase] ||
    IRREGULAR_STEM_LEXICON[stemExpanded] ||
    IRREGULAR_STEM_LEXICON[stemBase.replace(/وا$/, '')];
  if (lexEntry) {
    const bNum = explicitBaabNum || lexEntry.baabNumber;
    const bInfo = BAAB_LABELS[bNum] || BAAB_LABELS[lexEntry.baabNumber];
    return {
      baabNumber: bNum,
      baab: bInfo.baab,
      wazan: tagInfo.wazan || lexEntry.wazan,
      root: explicitRoot || lexEntry.root,
      pos: constraint?.expectedPos || tagInfo.pos || lexEntry.pos
    };
  }

  const s = stemExpanded.length >= stemBase.length ? stemExpanded : stemBase;
  const startsWithWasl = stemVocalized.trim().startsWith('\u0671');
  const startsWithQatFatha = /^[\u0623]\u064E/.test(stemVocalized.trim());
  const startsWithMudariDamma = /^[يتأن]\u064F/.test(stemVocalized.trim());

  // 3. Form X (باب استفعال - استَفْعَلَ / يَسْتَفْعِلُ / مُسْتَفْعِل)
  if (/^است(.{3,})$/.test(s)) {
    const rads = s.slice(3, 6);
    return {
      baabNumber: 10,
      baab: BAAB_LABELS[10].baab,
      wazan: 'ٱسْتَفْعَلَ',
      root: explicitRoot || normalizeRootString(rads),
      pos: constraint?.expectedPos || 'Verb'
    };
  }
  if (/^[يتان]ست(.{3,})$/.test(s)) {
    const rads = s.slice(3, 6);
    return {
      baabNumber: 10,
      baab: BAAB_LABELS[10].baab,
      wazan: 'يَسْتَفْعِلُ',
      root: explicitRoot || normalizeRootString(rads),
      pos: constraint?.expectedPos || 'Verb'
    };
  }
  if (/^مست(.{3,})$/.test(s)) {
    const rads = s.slice(3, 6);
    return {
      baabNumber: 10,
      baab: BAAB_LABELS[10].baab,
      wazan: 'مُسْتَفْعِل',
      root: explicitRoot || normalizeRootString(rads),
      pos: constraint?.expectedPos || 'Noun'
    };
  }

  // 4. Form VII (باب انفعال - ٱنْفَعَلَ / يَنْفَعِلُ / مُنْفَعِل)
  if (
    (startsWithWasl && /^ان(.{3,})$/.test(s)) ||
    /^ان[فطصقكجحخدرزسشعغلهب](.{2,})$/.test(s)
  ) {
    const rads = s.slice(2, 5);
    return {
      baabNumber: 7,
      baab: BAAB_LABELS[7].baab,
      wazan: 'ٱنْفَعَلَ',
      root: explicitRoot || normalizeRootString(rads),
      pos: constraint?.expectedPos || 'Verb'
    };
  }

  // 5. Form VIII (باب افتعال - ٱفْتَعَلَ / يَفْتَعِلُ / مُفْتَعِل)
  // Past / Imperative / Masdar: ٱ + C1(sukun) + ت/ط/د + C2 + C3 (e.g. ٱفْتَرَىٰ, ٱكْتَسَبَ, ٱهْتَدَىٰ, ٱبْتَغَىٰ, ٱشْتَرَىٰ, ٱصْطَفَىٰ)
  const form8PastVocalized =
    /^\u0671[\u0621-\u064A][\u0652\u06E1][تطد]/.test(stemVocalized.trim()) ||
    (startsWithWasl && /^ا.[تطد].{2,}$/.test(s));
  const form8PastUnvocalized =
    /^ا[فكجعهدشبتصضطظذرزسغقلمنوي][تطد].{2,}$/.test(s) && !startsWithQatFatha;

  if (form8PastVocalized || form8PastUnvocalized) {
    const c1 = s.charAt(1);
    const c2 = s.charAt(3);
    const c3 = s.charAt(4) || 'ي';
    return {
      baabNumber: 8,
      baab: BAAB_LABELS[8].baab,
      wazan: 'ٱفْتَعَلَ',
      root: explicitRoot || normalizeRootString(`${c1}${c2}${c3}`),
      pos: constraint?.expectedPos || 'Verb'
    };
  }

  // Form VIII Mudari': [يتأن] + C1(sukun) + ت/ط/د + C2 + C3 (e.g. يَفْتَرِى, تَفْتَرُونَ, يَكْتَسِبُونَ, يَبْتَغُونَ, يَهْتَدُونَ)
  const form8MudariVocalized =
    /^[يتأن]\u064E?[\u0621-\u064A][\u0652\u06E1][تطد][\u064E\u0650\u064F]/.test(stemVocalized.trim()) &&
    s.length >= 5;
  if (form8MudariVocalized) {
    const c1 = s.charAt(1);
    const c2 = s.charAt(3);
    const c3 = s.charAt(4) || 'ي';
    return {
      baabNumber: 8,
      baab: BAAB_LABELS[8].baab,
      wazan: 'يَفْتَعِلُ',
      root: explicitRoot || normalizeRootString(`${c1}${c2}${c3}`),
      pos: constraint?.expectedPos || 'Verb'
    };
  }

  // Form VIII Participle: مُ + C1(sukun) + ت/ط/د + C2 + C3 (e.g. مُفْتَرٍ, مُهْتَدٍ, مُعْتَدٍ, مُخْتَلِف)
  const form8ParticipleVocalized =
    /^م\u064F[\u0621-\u064A][\u0652\u06E1][تطد]/.test(stemVocalized.trim()) && s.length >= 4;
  if (form8ParticipleVocalized) {
    const c1 = s.charAt(1);
    const c2 = s.charAt(3);
    const c3 = s.charAt(4) || 'ي';
    return {
      baabNumber: 8,
      baab: BAAB_LABELS[8].baab,
      wazan: 'مُفْتَعِل',
      root: explicitRoot || normalizeRootString(`${c1}${c2}${c3}`),
      pos: constraint?.expectedPos || 'Noun'
    };
  }

  // 6. Form V (باب تفعّل - تَفَعَّلَ / يَتَفَعَّلُ) & Form VI (باب تفاعل - تَفَاعَلَ / يَتَفَاعَلُ)
  if (/^(يت|تت|نت|ت)[\u0621-\u064A]\u064E?[\u0621-\u064A]\u0651/.test(stemVocalized.trim())) {
    const stripped = s.replace(/^(يت|تت|نت|ت)/, '');
    return {
      baabNumber: 5,
      baab: BAAB_LABELS[5].baab,
      wazan: s.startsWith('ي') ? 'يَتَفَعَّلُ' : 'تَفَعَّلَ',
      root: explicitRoot || normalizeRootString(stripped.slice(0, 3)),
      pos: constraint?.expectedPos || 'Verb'
    };
  }
  if (/^(يت|تت|نت|ت).ا.{2,}$/.test(s)) {
    const stripped = s.replace(/^(يت|تت|نت|ت)/, '').replace('ا', '');
    return {
      baabNumber: 6,
      baab: BAAB_LABELS[6].baab,
      wazan: s.startsWith('ي') ? 'يَتَفَاعَلُ' : 'تَفَاعَلَ',
      root: explicitRoot || normalizeRootString(stripped.slice(0, 3)),
      pos: constraint?.expectedPos || 'Verb'
    };
  }

  // 7. Form II (باب تفعيل - فَعَّلَ / يُفَعِّلُ / تَفْعِيل)
  // Masdar تَفْعِيل (e.g. تَنزِيل, تَكْذِيب, تَسْبِيح, تَفْصِيل)
  if (/^ت.{2}ي.$/.test(s) && /^ت\u064E[\u0621-\u064A][\u0652\u06E1]/.test(stemVocalized.trim())) {
    const rads = `${s.charAt(1)}${s.charAt(2)}${s.charAt(4)}`;
    return {
      baabNumber: 2,
      baab: BAAB_LABELS[2].baab,
      wazan: 'تَفْعِيل',
      root: explicitRoot || normalizeRootString(rads),
      pos: constraint?.expectedPos || 'Noun'
    };
  }
  // Verb with Shaddah on middle radical
  if (
    /^[\u0621-\u064A][\u064E\u064F\u0650]*[\u0621-\u064A]\u0651/.test(stemVocalized.trim()) &&
    s.length === 3
  ) {
    return {
      baabNumber: 2,
      baab: BAAB_LABELS[2].baab,
      wazan: 'فَعَّلَ',
      root: explicitRoot || normalizeRootString(s),
      pos: constraint?.expectedPos || 'Verb'
    };
  }
  if (
    startsWithMudariDamma &&
    /^[يتأن]\u064F[\u0621-\u064A]\u064E[\u0621-\u064A]\u0651/.test(stemVocalized.trim()) &&
    s.length >= 4
  ) {
    return {
      baabNumber: 2,
      baab: BAAB_LABELS[2].baab,
      wazan: 'يُفَعِّلُ',
      root: explicitRoot || normalizeRootString(s.slice(1, 4)),
      pos: constraint?.expectedPos || 'Verb'
    };
  }

  // 8. Form III (باب مفاعلة - فَاعَلَ / يُفَاعِلُ)
  if (
    startsWithMudariDamma &&
    /^[يتأن]/.test(s) &&
    s.charAt(2) === 'ا' &&
    s.length >= 5
  ) {
    const rads = `${s.charAt(1)}${s.charAt(3)}${s.charAt(4)}`;
    return {
      baabNumber: 3,
      baab: BAAB_LABELS[3].baab,
      wazan: 'يُفَاعِلُ',
      root: explicitRoot || normalizeRootString(rads),
      pos: constraint?.expectedPos || 'Verb'
    };
  }

  // 9. Form IV (باب إفعال - أَفْعَلَ / يُفْعِلُ / مُفْعِل)
  if (
    startsWithQatFatha &&
    /^\u0623\u064E[\u0621-\u064A][\u0652\u06E1]/.test(stemVocalized.trim()) &&
    s.length === 4
  ) {
    return {
      baabNumber: 4,
      baab: BAAB_LABELS[4].baab,
      wazan: 'أَفْعَلَ',
      root: explicitRoot || normalizeRootString(s.slice(1, 4)),
      pos: constraint?.expectedPos || 'Verb'
    };
  }
  if (
    startsWithMudariDamma &&
    /^[يتأن]\u064F[\u0621-\u064A][\u0652\u06E1]/.test(stemVocalized.trim()) &&
    s.length === 4
  ) {
    return {
      baabNumber: 4,
      baab: BAAB_LABELS[4].baab,
      wazan: 'يُفْعِلُ',
      root: explicitRoot || normalizeRootString(s.slice(1, 4)),
      pos: constraint?.expectedPos || 'Verb'
    };
  }
  if (/^م\u064F[\u0621-\u064A][\u0652\u06E1]/.test(stemVocalized.trim()) && s.length === 4) {
    return {
      baabNumber: 4,
      baab: BAAB_LABELS[4].baab,
      wazan: 'مُفْعِل',
      root: explicitRoot || normalizeRootString(s.slice(1, 4)),
      pos: constraint?.expectedPos || 'Noun'
    };
  }

  // 10. Common Form I Nominal & Verbal Awzan (فَاعِل, مَفْعُول, فَعِيل, يَفْعَلُ, فَعَلَ)
  if (s.length === 4 && s.charAt(1) === 'ا' && !/^[يتان]/.test(s)) {
    const rads = `${s.charAt(0)}${s.charAt(2)}${s.charAt(3)}`;
    return {
      baabNumber: explicitBaabNum || 1,
      baab: BAAB_LABELS[explicitBaabNum || 1].baab,
      wazan: tagInfo.wazan || 'فَاعِل',
      root: explicitRoot || normalizeRootString(rads),
      pos: constraint?.expectedPos || 'Noun'
    };
  }
  if (s.length === 5 && s.startsWith('م') && s.charAt(3) === 'و') {
    const rads = `${s.charAt(1)}${s.charAt(2)}${s.charAt(4)}`;
    return {
      baabNumber: explicitBaabNum || 1,
      baab: BAAB_LABELS[explicitBaabNum || 1].baab,
      wazan: tagInfo.wazan || 'مَفْعُول',
      root: explicitRoot || normalizeRootString(rads),
      pos: constraint?.expectedPos || 'Noun'
    };
  }
  if (s.length === 4 && s.charAt(2) === 'ي' && !/^[يتانم]/.test(s)) {
    const rads = `${s.charAt(0)}${s.charAt(1)}${s.charAt(3)}`;
    return {
      baabNumber: explicitBaabNum || 1,
      baab: BAAB_LABELS[explicitBaabNum || 1].baab,
      wazan: tagInfo.wazan || 'فَعِيل',
      root: explicitRoot || normalizeRootString(rads),
      pos: constraint?.expectedPos || 'Noun'
    };
  }

  // Form I Mudari' (يَفْعَلُ / تَفْعَلُ / يَفْعُلُ / يَفْعِلُ)
  if (/^[يتان]/.test(s) && (s.length === 4 || (s.length === 3 && /[اوي]$/.test(s)))) {
    const rads = s.length === 4 ? s.slice(1, 4) : s.slice(1);
    return {
      baabNumber: explicitBaabNum || 1,
      baab: BAAB_LABELS[explicitBaabNum || 1].baab,
      wazan: tagInfo.wazan || 'يَفْعَلُ',
      root: explicitRoot || normalizeRootString(rads),
      pos: constraint?.expectedPos || 'Verb'
    };
  }

  // Default / Form I fallback
  const resolvedBaabNum = explicitBaabNum || 1;
  const resolvedBaab = BAAB_LABELS[resolvedBaabNum]?.baab || BAAB_LABELS[1].baab;
  const fallbackRoot = explicitRoot || normalizeRootString(s.slice(0, 3));

  return {
    baabNumber: resolvedBaabNum,
    baab: resolvedBaab,
    wazan: tagInfo.wazan || (s.length === 3 ? 'فَعَلَ' : BAAB_LABELS[resolvedBaabNum]?.defaultWazan || 'فَعَلَ'),
    root: fallbackRoot,
    pos: constraint?.expectedPos || tagInfo.pos || 'Word'
  };
}

/**
 * Tokenize an Arabic word into its morphological components (proclitics, stem, enclitics)
 * and resolve its Root, Baab (Form I–X), and Wazan.
 */
export function tokenizeArabicMorphology(
  word: string,
  constraint?: MorphologicalConstraint
): MorphologicalToken {
  const raw = (word || '').trim();
  const cleanVoc = raw
    .replace(/[\u06D6-\u06DC\u06DD\u06DE\u06E9\u06FD\u06FE\s.,،؛:?!"'()\[\]{}\-]/g, '')
    .trim();

  const startsWithHamzatWasl = cleanVoc.startsWith('\u0671');
  const firstConsonantHasSukun =
    /^[^\u0621-\u064A\u0671]*[\u0621-\u064A\u0671][\u064B-\u065F]*[\u0652\u06E1]/.test(cleanVoc);

  const baseFull = normalizeStemLetters(cleanVoc, false);
  const expFull = normalizeStemLetters(cleanVoc, true);

  if (!baseFull || isParticle(cleanVoc)) {
    return {
      raw,
      proclitics: [],
      enclitics: [],
      stemVocalized: cleanVoc,
      stemBase: baseFull,
      stemExpanded: expFull,
      baab: 'Particle (حرف)',
      baabNumber: null,
      wazan: 'حَرْف',
      root: 'N/A',
      pos: 'Particle',
      startsWithHamzatWasl,
      firstConsonantHasSukun
    };
  }

  const proclitics: string[] = [];
  const enclitics: string[] = [];
  let stemVoc = cleanVoc;
  let stemBase = baseFull;
  let stemExp = expFull;

  // Strip genuine grammatical proclitics only when morphologically safe
  for (const prefix of ARABIC_PREFIXES) {
    if (
      stemBase.startsWith(prefix) &&
      canSafelyStripProclitic(stemVoc, stemBase, prefix)
    ) {
      proclitics.push(prefix);
      stemBase = stemBase.slice(prefix.length);
      stemExp = stemExp.startsWith(prefix) ? stemExp.slice(prefix.length) : stemBase;
      stemVoc = sliceVocalizedByBaseCount(stemVoc, prefix.length);
      break;
    }
  }

  // Strip attached enclitics only when at least 3 stem letters remain
  for (const suffix of ARABIC_SUFFIXES) {
    if (stemBase.endsWith(suffix) && stemBase.length - suffix.length >= 3) {
      // Do not strip "ت" if it is part of a 3-letter root or Form VIII stem
      if (suffix === 'ت' && stemBase.length <= 4) continue;
      enclitics.push(suffix);
      stemBase = stemBase.slice(0, stemBase.length - suffix.length);
      if (stemExp.endsWith(suffix) && stemExp.length - suffix.length >= 3) {
        stemExp = stemExp.slice(0, stemExp.length - suffix.length);
      }
      break;
    }
  }

  const analysis = analyzeStemBaabAndWazan(stemVoc, stemBase, stemExp, constraint);

  return {
    raw,
    proclitics,
    enclitics,
    stemVocalized: stemVoc,
    stemBase,
    stemExpanded: stemExp,
    baab: analysis.baab,
    baabNumber: analysis.baabNumber,
    wazan: analysis.wazan,
    root: analysis.root,
    pos: analysis.pos,
    startsWithHamzatWasl: stemVoc.trim().startsWith('\u0671') || startsWithHamzatWasl,
    firstConsonantHasSukun
  };
}

/**
 * Determine whether a verse token and a target token are grammatically compatible
 * in Root (جذر), Baab (باب I–X), and Wazan (وزن).
 * Prevents false positives such as matching "ٱفْتَرَىٰ" (Form VIII, root ف-ر-ي) when searching for "تَرَىٰٓ" (Form I, root ر-أ-ي).
 */
export function isGrammaticallyCompatible(
  verseToken: string,
  targetToken: string,
  constraint?: MorphologicalConstraint
): boolean {
  const vMorph = tokenizeArabicMorphology(verseToken);
  const tMorph = tokenizeArabicMorphology(targetToken, constraint);

  // 1. Particle vs Non-Particle mismatch
  if ((vMorph.pos === 'Particle') !== (tMorph.pos === 'Particle')) {
    return false;
  }

  // 2. Baab (Derived Form I–X) Compatibility Check:
  // If both tokens resolve to specific verbal/derived Baab numbers and they differ
  // (e.g., Form VIII ٱفْتَرَىٰ [8] vs Form I تَرَىٰٓ [1]), reject immediately!
  if (
    vMorph.baabNumber !== null &&
    tMorph.baabNumber !== null &&
    vMorph.baabNumber !== tMorph.baabNumber
  ) {
    return false;
  }

  // 3. Root (جذر) Compatibility Check:
  // If both have resolved roots (e.g. "ف-ر-ي" vs "ر-ا-ي"), require root compatibility
  if (
    vMorph.root &&
    tMorph.root &&
    vMorph.root !== 'N/A' &&
    tMorph.root !== 'N/A' &&
    !areRootsCompatible(vMorph.root, tMorph.root)
  ) {
    return false;
  }

  // 4. Stem / Wazan Compatibility Check:
  const stripPluralAlif = (str: string) => (str.length > 3 ? str.replace(/وا$/, 'و') : str);
  const vStemB = stripPluralAlif(vMorph.stemBase);
  const tStemB = stripPluralAlif(tMorph.stemBase);
  const vStemE = stripPluralAlif(vMorph.stemExpanded);
  const tStemE = stripPluralAlif(tMorph.stemExpanded);

  const stemsMatch =
    vStemB === tStemB ||
    vStemE === tStemE ||
    vStemB === tStemE ||
    vStemE === tStemB;

  if (stemsMatch) {
    return true;
  }

  // If an explicit expectedLemma is provided on the occurrence/word, check against the verse stem
  if (constraint?.expectedLemma) {
    const expectedLemmaNorm = normalizeStemLetters(constraint.expectedLemma, true);
    if (
      expectedLemmaNorm.length >= 3 &&
      (vStemB === expectedLemmaNorm || vStemE === expectedLemmaNorm) &&
      (vMorph.baabNumber === tMorph.baabNumber || tMorph.baabNumber === null)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Extract the stem/lemma from an Arabic word by removing only genuine grammatical clitics
 * while preserving root letters and verbal form (baab/wazan) structure.
 */
export function extractLemma(word: string): string {
  const morph = tokenizeArabicMorphology(word);
  return morph.stemBase || normalizeStemLetters(word, false);
}

/**
 * Get the root of an Arabic word
 */
export function getRoot(word: string): string {
  const morph = tokenizeArabicMorphology(word);
  return morph.root && morph.root !== 'N/A' ? morph.root : morph.stemBase;
}

/**
 * Compare two Arabic words for morphological similarity (respecting Root, Baab, and Wazan)
 */
export function areWordsSimilar(
  word1: string,
  word2: string,
  constraint?: MorphologicalConstraint
): boolean {
  return isGrammaticallyCompatible(word1, word2, constraint);
}

/**
 * Clean and normalize Arabic text for matching
 */
export function normalizeArabicForMatching(text: string): string {
  return removeDiacritics(text.trim());
}

export interface MurakkabWordRole {
  word: string;
  roleArabic: string;
  roleEnglish: string;
  irabNote: string;
  root: string;
  baab: string;
  wazan: string;
}

export interface MurakkabSyntaxAnalysis {
  tarakeebArabic: string;
  tarakeebEnglish: string;
  categoryBadge: string;
  scholarlyExplanation: string;
  wordRoles: MurakkabWordRole[];
}

const DEMONSTRATIVE_PRONOUNS = new Set(['هذا', 'هذه', 'ذلك', 'تلك', 'هؤلاء', 'أولئك', 'اولئك', 'ذانك', 'تانك', 'ذلكم', 'ذلكما']);
const PREPOSITIONS_SET = new Set(['من', 'إلى', 'الى', 'عن', 'على', 'في', 'فى', 'ب', 'ل', 'ك', 'حتى', 'مع', 'عند', 'بين', 'لدن', 'منذ']);
const CONJUNCTIONS_SET = new Set(['و', 'ف', 'ثم', 'أو', 'او', 'أم', 'ام', 'بل', 'لا', 'لكن']);
const INNA_SISTERS_SET = new Set(['إن', 'ان', 'أن', 'كأن', 'ليت', 'لعل', 'لكن']);

function detectEndingCase(vocalizedWord: string): { caseArabic: string; caseEnglish: string } {
  const trimmed = vocalizedWord.replace(/[\u06D6-\u06ED\s]/g, '').trim();
  const lastChars = trimmed.slice(-3);
  if (/[\u064D\u0650]/.test(lastChars.slice(-2))) {
    return { caseArabic: 'مجرور (الكسرة)', caseEnglish: 'Genitive (Majrūr)' };
  }
  if (/[\u064B\u064E]/.test(lastChars.slice(-2))) {
    return { caseArabic: 'منصوب (الفتحة)', caseEnglish: 'Accusative (Manṣūb)' };
  }
  if (/[\u064C\u064F]/.test(lastChars.slice(-2))) {
    return { caseArabic: 'مرفوع (الضمة)', caseEnglish: 'Nominative (Marfūʿ)' };
  }
  if (/[\u0652\u06E1]/.test(lastChars.slice(-2))) {
    return { caseArabic: 'مبني / مجزوم (السكون)', caseEnglish: 'Indeclinable / Jussive (Sukūn)' };
  }
  return { caseArabic: 'معرب / مبني بحسب السياق', caseEnglish: 'Contextual Iʿrāb' };
}

/**
 * Perform classical Arabic syntactic (Nahw / Tarakeeb) and morphological (Sarf) breakdown
 * of a multi-word Quranic phrase (Murakkab).
 */
export function analyzeMurakkabSyntax(
  arabicPhrase: string,
  existingNote?: string,
  occRoots?: string[],
  occLemmas?: string[]
): MurakkabSyntaxAnalysis {
  const words = (arabicPhrase || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return {
      tarakeebArabic: 'مركّب قرآني',
      tarakeebEnglish: 'Quranic Construction',
      categoryBadge: 'Murakkab',
      scholarlyExplanation: existingNote || 'Compound Quranic expression.',
      wordRoles: []
    };
  }

  const tokens = words.map((w, idx) =>
    tokenizeArabicMorphology(w, {
      expectedRoot: occRoots && occRoots[idx] && occRoots[idx] !== '-' ? occRoots[idx] : undefined,
      expectedLemma: occLemmas && occLemmas[idx] && occLemmas[idx] !== '-' ? occLemmas[idx] : undefined
    })
  );

  const firstBase = normalizeStemLetters(words[0], true);
  const secondBase = words[1] ? normalizeStemLetters(words[1], true) : '';
  const firstHasAl = /^([وفبكل]?ال)/.test(firstBase);
  const secondHasAl = /^([وفبكل]?ال)/.test(secondBase);

  // 1. Prepositional Phrase (Jar wa Majrur - جار ومجرور)
  if (
    PREPOSITIONS_SET.has(firstBase) ||
    tokens[0].proclitics.some(p => ['ب', 'ل', 'ك', 'فب', 'فل', 'وب', 'ول', 'بال', 'لل', 'كال'].includes(p))
  ) {
    const wordRoles: MurakkabWordRole[] = words.map((w, i) => {
      const t = tokens[i];
      const c = detectEndingCase(w);
      if (i === 0 && PREPOSITIONS_SET.has(firstBase)) {
        return {
          word: w,
          roleArabic: 'حرف جرّ',
          roleEnglish: 'Preposition (Ḥarf Jarr)',
          irabNote: 'مبني لا محلّ له من الإعراب (Indeclinable particle governing the genitive case)',
          root: 'N/A',
          baab: t.baab,
          wazan: t.wazan
        };
      }
      if (i === 0) {
        return {
          word: w,
          roleArabic: 'جارّ ومجرور متّصل',
          roleEnglish: 'Prefixed Preposition + Genitive Noun',
          irabNote: `${c.caseArabic} — ${c.caseEnglish}`,
          root: t.root,
          baab: t.baab,
          wazan: t.wazan
        };
      }
      return {
        word: w,
        roleArabic: i === 1 && PREPOSITIONS_SET.has(firstBase) ? 'اسم مجرور' : 'مضاف إليه / تابع',
        roleEnglish: i === 1 && PREPOSITIONS_SET.has(firstBase) ? 'Object of Preposition (Ism Majrūr)' : 'Genitive Complement / Modifier',
        irabNote: `${c.caseArabic} — ${c.caseEnglish}`,
        root: t.root,
        baab: t.baab,
        wazan: t.wazan
      };
    });

    return {
      tarakeebArabic: 'مركّب جارّي (جارّ ومجرور)',
      tarakeebEnglish: 'Prepositional Construction (Jārr wa-Majrūr)',
      categoryBadge: 'Jārr wa-Majrūr (جار ومجرور)',
      scholarlyExplanation:
        existingNote && existingNote.length > 15
          ? existingNote
          : 'A prepositional construction (شبه جملة جار ومجرور) where a particle of Jarr governs the following noun in the genitive case (مجرور), frequently functioning as an adverbial or predicative attachment (متعلّق).',
      wordRoles
    };
  }

  // 2. Inna & Sisters / Emphasized Nominal Clause (إنّ واسمها)
  if (INNA_SISTERS_SET.has(firstBase) || firstBase.startsWith('ان') && words[0].includes('\u0651')) {
    const wordRoles: MurakkabWordRole[] = words.map((w, i) => {
      const t = tokens[i];
      const c = detectEndingCase(w);
      if (i === 0) {
        return {
          word: w,
          roleArabic: 'حرف توكيد ونصب (إنّ وأخواتها)',
          roleEnglish: 'Accusative Particle of Emphasis (Ḥarf Nasb)',
          irabNote: 'ينصب الاسم ويرفع الخبر (Puts subject in accusative and predicate in nominative)',
          root: 'N/A',
          baab: t.baab,
          wazan: t.wazan
        };
      }
      return {
        word: w,
        roleArabic: i === 1 ? 'اسم إنّ منصوب' : 'خبر إنّ / متعلّق',
        roleEnglish: i === 1 ? 'Subject of Inna (Ism Inna - Manṣūb)' : 'Predicate / Complement (Khabar)',
        irabNote: `${c.caseArabic} — ${c.caseEnglish}`,
        root: t.root,
        baab: t.baab,
        wazan: t.wazan
      };
    });

    return {
      tarakeebArabic: 'جملة اسمية مؤكّدة بإنّ',
      tarakeebEnglish: 'Emphasized Nominal Construction (Inna Clause)',
      categoryBadge: 'Inna wa-Ismuhā (إنّ واسمها)',
      scholarlyExplanation:
        existingNote && existingNote.length > 15
          ? existingNote
          : 'An emphasized nominal construction introduced by Inna (إنّ وأخواتها), which places the subject noun (اسم إنّ) in the accusative case (منصوب) and the predicate (خبر إنّ) in the nominative case (مرفوع).',
      wordRoles
    };
  }

  // 3. Demonstrative Phrase (Murakkab Ishari - مركب إشاري)
  if (DEMONSTRATIVE_PRONOUNS.has(firstBase)) {
    const wordRoles: MurakkabWordRole[] = words.map((w, i) => {
      const t = tokens[i];
      const c = detectEndingCase(w);
      if (i === 0) {
        return {
          word: w,
          roleArabic: 'اسم إشارة',
          roleEnglish: 'Demonstrative Pronoun (Ism Ishārah)',
          irabNote: 'مبني في محلّ إعرابي بحسب موقعه (Indeclinable demonstrative pronoun)',
          root: 'N/A',
          baab: 'Demonstrative (اسم إشارة)',
          wazan: 'مَبْنِيّ'
        };
      }
      return {
        word: w,
        roleArabic: secondHasAl ? 'مشار إليه (بدل / عطف بيان)' : 'خبر',
        roleEnglish: secondHasAl ? 'Demonstrated Noun (Mushār Ilayh / Badal)' : 'Predicate (Khabar)',
        irabNote: `${c.caseArabic} — ${c.caseEnglish}`,
        root: t.root,
        baab: t.baab,
        wazan: t.wazan
      };
    });

    return {
      tarakeebArabic: 'مركّب إشاري (اسم إشارة ومشار إليه)',
      tarakeebEnglish: 'Demonstrative Construction (Murakkab Ishārī)',
      categoryBadge: 'Murakkab Ishārī (مركب إشاري)',
      scholarlyExplanation:
        existingNote && existingNote.length > 15
          ? existingNote
          : 'A demonstrative construction (مركّب إشاري) pairing an indeclinable demonstrative pronoun (اسم إشارة) with a definite noun serving as the pointed-to appositive (مشار إليه / بدل) or an indefinite predicate (خبر).',
      wordRoles
    };
  }

  // 4. Conjunctive Phrase (Murakkab Atfi - مركب عطفي)
  if (words.length >= 2 && (CONJUNCTIONS_SET.has(secondBase) || words[1].startsWith('وَ') || words[1].startsWith('فَ'))) {
    const wordRoles: MurakkabWordRole[] = words.map((w, i) => {
      const t = tokens[i];
      const c = detectEndingCase(w);
      if (i === 0) {
        return {
          word: w,
          roleArabic: 'معطوف عليه',
          roleEnglish: 'Antecedent Conjoined Term (Maʿṭūf ʿAlayh)',
          irabNote: `${c.caseArabic} — ${c.caseEnglish}`,
          root: t.root,
          baab: t.baab,
          wazan: t.wazan
        };
      }
      return {
        word: w,
        roleArabic: CONJUNCTIONS_SET.has(normalizeStemLetters(w, true)) ? 'حرف عطف' : 'حرف عطف + معطوف',
        roleEnglish: CONJUNCTIONS_SET.has(normalizeStemLetters(w, true)) ? 'Conjunction (Ḥarf ʿAṭf)' : 'Conjunction + Conjoined Term (Maʿṭūf)',
        irabNote: `${c.caseArabic} — يتبع المعطوف عليه في الإعراب (Follows antecedent in Iʿrāb)`,
        root: t.root,
        baab: t.baab,
        wazan: t.wazan
      };
    });

    return {
      tarakeebArabic: 'مركّب عطفي (عطف ومعطوف)',
      tarakeebEnglish: 'Conjunctive Construction (Murakkab ʿAṭfī)',
      categoryBadge: 'Murakkab ʿAṭfī (مركب عطفي)',
      scholarlyExplanation:
        existingNote && existingNote.length > 15
          ? existingNote
          : 'A conjunctive construction (مركّب عطفي) where the conjoined noun or clause (المعطوف) inherits the grammatical case (إعراب) of the antecedent (المعطوف عليه) via a particle of conjunction (حرف عطف).',
      wordRoles
    };
  }

  // 5. Descriptive / Adjectival Phrase (Murakkab Tawsifi - موصوف وصفة)
  // Both words carry Al- (ال) or both are indefinite with matching case
  if (words.length >= 2 && firstHasAl && secondHasAl) {
    const wordRoles: MurakkabWordRole[] = words.map((w, i) => {
      const t = tokens[i];
      const c = detectEndingCase(w);
      return {
        word: w,
        roleArabic: i === 0 ? 'موصوف (منعوت)' : 'صفة (نعت)',
        roleEnglish: i === 0 ? 'Described Noun (Mawṣūf / Manʿūt)' : 'Adjectival Qualifier (Ṣifah / Naʿt)',
        irabNote: `${c.caseArabic} — تطابق في التعريف والإعراب (${c.caseEnglish})`,
        root: t.root,
        baab: t.baab,
        wazan: t.wazan
      };
    });

    return {
      tarakeebArabic: 'مركّب توصيفي (موصوف وصفة / نعت ومنعوت)',
      tarakeebEnglish: 'Adjectival Construction (Murakkab Tawṣīfī)',
      categoryBadge: 'Murakkab Tawṣīfī (موصوف وصفة)',
      scholarlyExplanation:
        existingNote && existingNote.length > 15
          ? existingNote
          : 'An adjectival phrase (مركّب توصيفي) in which the adjective (الصفة / النعت) agrees with the described noun (الموصوف / المنعوت) in definiteness (التعريف), gender (التذكير والتأنيث), number (العدد), and grammatical case (الإعراب).',
      wordRoles
    };
  }

  // 6. Verbal Clause (Jumla Fi'liyyah - جملة فعلية)
  if (tokens[0].pos === 'Verb' || tokens[0].baabNumber !== null && /^[يتأن]/.test(tokens[0].stemBase)) {
    const wordRoles: MurakkabWordRole[] = words.map((w, i) => {
      const t = tokens[i];
      const c = detectEndingCase(w);
      if (i === 0) {
        return {
          word: w,
          roleArabic: 'فعل (ماضٍ / مضارع / أمر)',
          roleEnglish: 'Verb (Fiʿl)',
          irabNote: `${c.caseArabic} — ${t.baab}`,
          root: t.root,
          baab: t.baab,
          wazan: t.wazan
        };
      }
      return {
        word: w,
        roleArabic: c.caseEnglish.includes('Nominative') ? 'فاعل مرفوع' : 'مفعول به / متعلّق بالفعل',
        roleEnglish: c.caseEnglish.includes('Nominative') ? 'Subject / Agent (Fāʿil - Marfūʿ)' : 'Direct Object / Verbal Complement (Mafʿūl bihi)',
        irabNote: `${c.caseArabic} — ${c.caseEnglish}`,
        root: t.root,
        baab: t.baab,
        wazan: t.wazan
      };
    });

    return {
      tarakeebArabic: 'جملة فعلية (فعل وفاعل / مفعول)',
      tarakeebEnglish: 'Verbal Clause (Jumlah Fiʿliyyah)',
      categoryBadge: 'Jumlah Fiʿliyyah (جملة فعلية)',
      scholarlyExplanation:
        existingNote && existingNote.length > 15
          ? existingNote
          : 'A verbal construction (جملة فعلية) headed by a verb (فعل) followed by its agentive subject (فاعل مرفوع) or direct object/complement (مفعول به منصوب).',
      wordRoles
    };
  }

  // 7. Genitive / Possessive Construction (Murakkab Idafi - مضاف ومضاف إليه) — Default classical nominal compound
  const wordRoles: MurakkabWordRole[] = words.map((w, i) => {
    const t = tokens[i];
    const c = detectEndingCase(w);
    return {
      word: w,
      roleArabic: i === 0 ? 'مضاف' : 'مضاف إليه مجرور',
      roleEnglish: i === 0 ? 'Construct Noun (Muḍāf)' : 'Genitive Possessor (Muḍāf Ilayh - Majrūr)',
      irabNote:
        i === 0
          ? `${c.caseArabic} — حُذفت منه ال والتنوين للإضافة (Lightened construct state)`
          : 'مجرور بالإضافة (Always in the Genitive case by Iḍāfah)',
      root: t.root,
      baab: t.baab,
      wazan: t.wazan
    };
  });

  return {
    tarakeebArabic: 'مركّب إضافي (مضاف ومضاف إليه)',
    tarakeebEnglish: 'Genitive Construct (Murakkab Iḍāfī)',
    categoryBadge: 'Murakkab Iḍāfī (مضاف ومضاف إليه)',
    scholarlyExplanation:
      existingNote && existingNote.length > 15
        ? existingNote
        : 'A genitive construct (مركّب إضافي — الإضافة) where the first noun (المضاف) is stripped of tanwīn and the definite article (ال), and the second noun (المضاف إليه) is governed in the genitive case (مجرور).',
    wordRoles
  };
}

