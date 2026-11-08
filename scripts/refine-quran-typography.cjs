/**
 * High-precision script to perfect Quranic typography across all datasets:
 * 1. For the word Allah (Lafz al-Jalalah: ٱللّٰهِ, لِلّٰهِ, بِٱللّٰهِ, وَٱللّٰهُ, ٱللّٰهُمَّ, etc.):
 *    Replaces standard fatha/zabar on the second laam with Alif-e-Maqsurah / Dagger Alif (\u0670) + Shaddah (\u0651\u0670).
 *    Carefully protects non-Allah words like ٱللَّهۡوِ (Al-Lahw) and ٱللَّهَبِ (Al-Lahab).
 * 2. For all words with stacked/redundant zabar alongside Alif-e-Maqsurah (\u064E\u0670 or \u0670\u064E, e.g. ٱلسَّمٰوٰتِ, ٱلرَّحۡمٰنِ, ذٰلِكَ, عَلَىٰ):
 *    Removes the redundant fatha/zabar so only the Alif-e-Maqsurah (\u0670) remains cleanly rendered.
 */

const fs = require('fs');
const path = require('path');

function refineTypography(text) {
  if (!text || typeof text !== 'string') return text;

  // 1. Remove redundant fatha (\u064E) when adjacent to dagger alif (\u0670)
  // Handles: \u0651\u064E\u0670 -> \u0651\u0670, \u064E\u0651\u0670 -> \u0651\u0670, \u0651\u0670\u064E -> \u0651\u0670
  // and \u064E\u0670 -> \u0670, \u0670\u064E -> \u0670
  let res = text
    .replace(/\u0651\u064E\u0670|\u064E\u0651\u0670|\u0651\u0670\u064E/g, '\u0651\u0670')
    .replace(/\u064E\u0670|\u0670\u064E/g, '\u0670');

  // 2. Fix Allah forms to have shaddah + dagger alif (\u0651\u0670) instead of shaddah + fatha
  // Preceding: ل with optional kasra/sukun/shaddah
  // Second laam: ل followed by shaddah + optional fatha (or fatha + shaddah)
  // Followed by ha: ه where ha is:
  // - with short vowel [َُِ] not followed by an Arabic letter (word end)
  // - or waqf stop marks [ۚۖۗۘۙۜ۩ۤ]
  // - or humma (Allahumma)
  // - or end of word / punctuation / whitespace
  res = res.replace(/(ل[ِّۡ]*ل)[\u0651\u064E]*\u0651[\u0651\u064E]*(?!\u0670)(ه(?:[\u0650\u064F\u064E](?![\u0621-\u064A\u0671-\u06D3])|[\u0650\u064F\u064E]?[ۚۖۗۘۙۜ۩ۤ]|ُ?مَّ|(?=[\s\.,،؛:()\[\]{}"'\/\-?!]|$)))/g, '$1\u0651\u0670$2');

  return res;
}

console.log('=== Step 1: Refining public/data/ayahs.json ===');
const ayahsPath = path.join(__dirname, '../public/data/ayahs.json');
const ayahsData = JSON.parse(fs.readFileSync(ayahsPath, 'utf8'));
let ayahsCount = 0;
for (const ayah of ayahsData.ayahs) {
  const orig = ayah.arabicText;
  const updated = refineTypography(orig);
  if (orig !== updated) {
    ayah.arabicText = updated;
    ayahsCount++;
  }
}
fs.writeFileSync(ayahsPath, JSON.stringify(ayahsData, null, 2), 'utf8');
console.log(`Refined ${ayahsCount} of ${ayahsData.ayahs.length} ayahs in ayahs.json.`);

console.log('=== Step 2: Refining public/data/ayahs-chunks ===');
const chunksDir = path.join(__dirname, '../public/data/ayahs-chunks');
const chunkFiles = fs.readdirSync(chunksDir).filter(f => f.endsWith('.json'));
let chunkAyahsCount = 0;
for (const file of chunkFiles) {
  const filePath = path.join(chunksDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let modified = false;
  if (data.ayahs && Array.isArray(data.ayahs)) {
    for (const a of data.ayahs) {
      const orig = a.arabicText;
      const updated = refineTypography(orig);
      if (orig !== updated) {
        a.arabicText = updated;
        chunkAyahsCount++;
        modified = true;
      }
    }
  }
  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}
console.log(`Refined ${chunkAyahsCount} ayahs across ${chunkFiles.length} chunk files in ayahs-chunks.`);

console.log('=== Step 3: Refining public/data/quran.json ===');
const quranPath = path.join(__dirname, '../public/data/quran.json');
if (fs.existsSync(quranPath)) {
  const quranData = JSON.parse(fs.readFileSync(quranPath, 'utf8'));
  let quranVersesCount = 0;
  for (const surahKey of Object.keys(quranData)) {
    const verses = quranData[surahKey];
    if (Array.isArray(verses)) {
      for (const v of verses) {
        if (v.text) {
          const updated = refineTypography(v.text);
          if (v.text !== updated) {
            v.text = updated;
            quranVersesCount++;
          }
        }
      }
    }
  }
  fs.writeFileSync(quranPath, JSON.stringify(quranData, null, 2), 'utf8');
  console.log(`Refined ${quranVersesCount} verses in quran.json.`);
}

console.log('=== Step 4: Refining public/data/quran-arabic-text.json ===');
const quranArabicPath = path.join(__dirname, '../public/data/quran-arabic-text.json');
if (fs.existsSync(quranArabicPath)) {
  const quranArabicData = JSON.parse(fs.readFileSync(quranArabicPath, 'utf8'));
  let quranArabicCount = 0;
  for (const surah of quranArabicData) {
    if (Array.isArray(surah.verses)) {
      for (const v of surah.verses) {
        if (v.text) {
          const updated = refineTypography(v.text);
          if (v.text !== updated) {
            v.text = updated;
            quranArabicCount++;
          }
        }
      }
    }
  }
  fs.writeFileSync(quranArabicPath, JSON.stringify(quranArabicData, null, 2), 'utf8');
  console.log(`Refined ${quranArabicCount} verses in quran-arabic-text.json.`);
}

console.log('=== Step 5: Refining public/data/words.json ===');
const wordsPath = path.join(__dirname, '../public/data/words.json');
const wordsData = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
let wordsCount = 0;
let variantsCount = 0;
let occurrencesCount = 0;

for (const w of wordsData.words) {
  if (w.arabic) {
    const updated = refineTypography(w.arabic);
    if (w.arabic !== updated) {
      w.arabic = updated;
      wordsCount++;
    }
  }
  if (w.arabicText) {
    w.arabicText = refineTypography(w.arabicText);
  }
  if (Array.isArray(w.variants)) {
    for (const v of w.variants) {
      if (v.arabic) {
        const updated = refineTypography(v.arabic);
        if (v.arabic !== updated) {
          v.arabic = updated;
          variantsCount++;
        }
      }
    }
  }
  if (Array.isArray(w.occurrences)) {
    for (const o of w.occurrences) {
      if (o.context) {
        const updated = refineTypography(o.context);
        if (o.context !== updated) {
          o.context = updated;
          occurrencesCount++;
        }
      }
      if (o.variantForm) {
        const updated = refineTypography(o.variantForm);
        if (o.variantForm !== updated) {
          o.variantForm = updated;
          occurrencesCount++;
        }
      }
    }
  }
}
fs.writeFileSync(wordsPath, JSON.stringify(wordsData, null, 2), 'utf8');
console.log(`Refined words.json: ${wordsCount} words, ${variantsCount} variants, ${occurrencesCount} occurrences.`);

console.log('=== Step 6: Refining public/data/murakkabat-chunks ===');
const murakkabatDir = path.join(__dirname, '../public/data/murakkabat-chunks');
const murakkabatFiles = fs.readdirSync(murakkabatDir).filter(f => f.endsWith('.json'));
let totalPhrasesRefined = 0;
let totalOccRefined = 0;

for (let i = 0; i < murakkabatFiles.length; i++) {
  const file = murakkabatFiles[i];
  const filePath = path.join(murakkabatDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let modified = false;

  const list = data.murakkabat || (Array.isArray(data) ? data : []);
  for (const m of list) {
    if (m.arabic) {
      const updated = refineTypography(m.arabic);
      if (m.arabic !== updated) {
        m.arabic = updated;
        totalPhrasesRefined++;
        modified = true;
      }
    }
    if (m.text) {
      const updated = refineTypography(m.text);
      if (m.text !== updated) {
        m.text = updated;
        modified = true;
      }
    }
    if (Array.isArray(m.variants)) {
      for (const v of m.variants) {
        if (v.arabic) {
          const updated = refineTypography(v.arabic);
          if (v.arabic !== updated) {
            v.arabic = updated;
            modified = true;
          }
        }
      }
    }
    if (Array.isArray(m.occurrences)) {
      for (const occ of m.occurrences) {
        if (occ.context) {
          const updated = refineTypography(occ.context);
          if (occ.context !== updated) {
            occ.context = updated;
            totalOccRefined++;
            modified = true;
          }
        }
        if (occ.variantForm) {
          const updated = refineTypography(occ.variantForm);
          if (occ.variantForm !== updated) {
            occ.variantForm = updated;
            modified = true;
          }
        }
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  if ((i + 1) % 25 === 0 || i === murakkabatFiles.length - 1) {
    console.log(`Processed ${i + 1}/${murakkabatFiles.length} murakkabat chunk files...`);
  }
}

console.log(`Refined ${totalPhrasesRefined} phrases and ${totalOccRefined} occurrences across all murakkabat chunks.`);
console.log('=== All dataset typography refinement complete! ===');
