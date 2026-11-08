# Bayan Al-Quran - Comprehensive Data & Dataset Explanation

This document serves as an exhaustive, self-contained data manual for **Bayan Al-Quran**. If you feed this file to any LLM/AI model, it will immediately understand exactly what datasets exist, their exact file paths, schemas, loading mechanics, and client-side storage structures.

---

## 1. Directory Structure & File Map

The data in this application is split into three main parts:
1. **Static/Build-time Data** (`/src/data/`): Contains the UI translations for multi-language components, static theme taxonomy, and parts of speech.
2. **Dynamic JSON Datasets** (`/public/data/`): Large-scale corpuses containing the complete text of the Quran, vocabularies, compound phrases, verse lists, chunked indices, and chapter-by-chapter translations.
3. **User Progress State** (`localStorage`): Local browser persistence representing the user's learning status and study metrics.

### `/public/data` (Dynamic Datasets)
* **`/public/data/quran.json`**: Static mapping of Quranic surahs and general info.
* **`/public/data/quran-arabic-text.json`**: The complete text of the Quran in Uthmani script used for the Quran Recitation & Auto-Scroll screen.
* **`/public/data/words.json`**: The complete single-word vocabulary list (top frequent words, roots, grammatical tags).
* **`/public/data/words-index.json`**: Index map mapping word chunk boundaries for efficient lazy chunk-loading.
* **`/public/data/words-chunks/`**: Folder containing split JSON parts of the vocabulary list for high-performance memory footprints.
* **`/public/data/murakkabat.json`**: Complete dataset of multi-word phrases (compound phrases, n-grams, grammatical constructs).
* **`/public/data/murakkabat-index.json`**: Index map mapping phrase chunk boundaries.
* **`/public/data/murakkabat-chunks/`**: Folder containing split JSON parts of the phrases database.
* **`/public/data/ayahs.json`**: Comprehensive verse dataset containing metadata, coordinates, word and phrase associations.
* **`/public/data/ayahs-index.json`**: Index map mapping verse chunk boundaries.
* **`/public/data/ayahs-chunks/`**: Folder containing split JSON parts of the verses database.
* **`/public/data/translations/`**: Contains chapter-by-chapter, multi-language translation files loaded dynamically depending on user preferences:
  * `en.json` (English), `ur.json` (Urdu), `tr.json` (Turkish), `id.json` (Indonesian), `bn.json` (Bengali), `es.json` (Spanish), `fr.json` (French), `ru.json` (Russian), `sv.json` (Swedish), `zh.json` (Chinese), `hi.json` (Hindi), `ps.json` (Pashto).

### `/src/data` (Linguistic & App Metadata)
* **`/src/data/quranData.ts`**: Contains static system taxonomy, UI labels in multiple languages, fallback mock lists, and options lists.
  * Exports `LANGUAGES`: UI translations in 6 main languages (`en`, `ur`, `tr`, `id`, `hi`, `ps`).
  * Exports `THEME_TAXONOMY`: Group metadata and tags like Spiritual Virtues, Unseen Realms, Prophetic Narratives, etc.
  * Exports `GRAMMAR_POS_OPTIONS`: Part of speech labels and translations (Noun, Verb, Proper Noun, Adjective, Relative Pronoun, etc.).

---

## 2. Core Data Schemas (TypeScript Types)

The types are declared in **`/src/types.ts`**. Any AI can read these interfaces to reconstruct or query the data programmatically:

### A. Vocabulary Word (`Word`)
Represents an individual Quranic word, enriched with frequencies, morphology, and occurrences.
```typescript
export interface Word {
  id: string;              // e.g. "w-1"
  arabic: string;          // Arabic text with diacritics
  transliteration: string; // Pronunciation help
  root: string;            // Arabic root letters (e.g. "ك ت ب")
  pos: string;             // Part of speech (e.g. "Noun", "Verb")
  frequency: number;       // Number of occurrences in the Quran
  translations: Record<LanguageCode, ContextTranslation[]>; // Multilingual meanings
  occurrences: Occurrence[]; // Coordinates where this word is found in the Quran
  themes: string[];        // Semantic themes (e.g. ['concept.virtue'])
  learnedState: LearnedState; // 'new' | 'learning' | 'known' | 'mastered' | 'review'
  isCore: boolean;         // True if in the top 800 most frequent words (~91% coverage)
  grammarDetails?: {
    gender?: string;
    number?: string;
    derivedForm?: string;
  };
  variants?: WordVariant[]; // Morphological variants of this vocabulary item
}

export interface WordVariant {
  form: string;            // Transliterated variant form
  arabic: string;          // Arabic text of the variant
  frequency: number;       // Occurrences of this specific variant
}
```

### B. Phrase or Compound (`Murakkab`)
Represents compound grammatical phrases (nouns, genitives, adjectives) or recurrent n-grams.
```typescript
export interface Murakkab {
  id: string;              // e.g. "p-1"
  arabic: string;          // Compound Arabic text
  transliteration: string; // Transliterated pronunciation
  translations: Record<LanguageCode, ContextTranslation[]>; // Meanings across languages
  frequency: number;       // Total frequency of occurrence
  occurrences: Occurrence[]; // List of specific coordinate verses
  grammarNotes: Record<LanguageCode, ContextTranslation[]>; // Grammatical / syntactic notes
  learnedState: LearnedState; // 'new' | 'learning' | 'known' | 'mastered' | 'review'
  themes: string[];        // Categorized themes
}
```

### C. Quranic Verse (`Ayah`)
Represents a verse/ayah containing metadata and identifiers linking back to words and phrases.
```typescript
export interface Ayah {
  id: string;              // Format "SurahNum:AyahNum" (e.g., "1:1")
  surah: number;           // Surah number (1 - 114)
  ayahNum: number;         // Verse number inside the Surah
  surahName: string;       // English transliterated surah name
  surahNameArabic: string; // Arabic name of the surah
  surahNameUrdu: string;   // Urdu/Naskh representation
  arabicText: string;      // The complete Arabic text of the verse
  transliteration: string; // Verse-level transliteration
  translations: Record<LanguageCode, ContextTranslation[]>; // Multilingual verse translations
  wordIds: string[];       // Word ids associated with words in this ayah (for interactive clicks)
  phraseIds: string[];     // Compound phrase ids present in this ayah
  themes: string[];        // List of thematic categories
  revelationPeriod: 'Meccan' | 'Medinan';
  learnedState: LearnedState; // 'new' | 'learning' | 'known' | 'mastered' | 'review'
}
```

### D. Surah Metadata (`Surah`)
```typescript
export interface Surah {
  number: number;           // 1 to 114
  nameArabic: string;       // Arabic calligraphy name
  nameEnglish: string;      // English transliterated name
  verses: number;           // Total verse count
  meaning: string;          // English meaning of the name
  revelationPlace: 'Meccan' | 'Medinan';
  revelationOrder: number;  // Order of historical revelation
}
```

### E. Minor Utilities
```typescript
export type LearnedState = 'new' | 'learning' | 'known' | 'mastered' | 'review';
export type LanguageCode = 'en' | 'ur' | 'tr' | 'id' | 'hi' | 'ps';

export interface ContextTranslation {
  text: string;
  context?: {
    surah?: number;
    ayah?: number;
    note?: string;
  };
}

export interface Occurrence {
  surah: number;
  ayah: number;
  surahName: string;
  surahNameUr: string;
  context: string; // The ayah text around the occurrence
}
```

---

## 3. Data Loading Pipeline (`/src/lib/dataLoader.ts`)

Because the Quranic corpus is large, the application uses an **on-demand chunking mechanism** to avoid downloading mega-sized JSON files on initial load.

1. **Bootstrap Index**: On startup, the application loads the index files:
   - `words-index.json`, `murakkabat-index.json`, `ayahs-index.json`.
   - These indices map item IDs to specific file numbers in `/public/data/words-chunks/`, etc.
2. **On-Demand Loading**: When a user selects a specific Surah, page, or filters words:
   - The system checks if the required chunk is already in-memory inside `wordChunksCache` or `ayahChunksCache`.
   - If not, it requests the small chunk JSON file from the server via `fetch()` and caches it.
3. **Linguistic Enrichment**: The raw dynamic JSON is passed through `enrichWordData`, `enrichMurakkabData`, and `enrichAyahData` helper functions to map flat attributes into full TypeScript interfaces (assigning proper translations, setting `learnedState` from local overrides, and finding which words are "core" vocabulary).

---

## 4. Local Persistence (`localStorage` State)

All user progress, recitation progress, and customizable preferences are persisted locally in the user's browser, bypassing the need for an external DB while remaining reliable:

* **`quran_progress_words`**: A JSON string mapping `wordId -> LearnedState` overrides.
* **`quran_progress_murakkabat`**: A JSON string mapping `phraseId -> LearnedState` overrides.
* **`quran_progress_ayahs`**: A JSON string mapping `ayahId -> LearnedState` overrides.
* **`quran_recitation_history`**: Holds recent recitations (surahs or paras), including the exact scroll position (`scrollY` or `scrollTop`) for resuming. Format:
  ```typescript
  interface RecitationHistoryItem {
    type: 'surah' | 'para';
    id: number;
    name: string;
    arabicName?: string;
    timestamp: number;
    scrollY: number;
  }
  ```
* **`quran_study_streak`**: Daily study tracker.
  ```typescript
  interface StreakState {
    currentStreak: number;
    lastActiveDate: string; // YYYY-MM-DD
    history: string[];      // Active study days
  }
  ```
* **`quran_arabic_font_size`**: Selected reading Arabic font size in pixels (ranges from 20px up to 64px). Defaults to `32`.
* **`quran_language`**: Primary translation language code (e.g. `"en"`, `"ur"`).
* **`quran_show_translation`**: Boolean flag indicating if translations are turned on in the Quran recitation reader.

---

## 5. Other Documentation Files Present

There are several pre-existing, highly detailed documentation files at the root level of your workspace describing exact portions of the app. You can refer to them at any time:

1. **`APP_ARCHITECTURE.md`** (Root level)
   * *Contents*: Detailed mapping of all UI navigation tabs, sub-components, page state layouts, and JSON structures for words, phrases, and verses.
2. **`APP_SPECIFICATION_DOCUMENT.md`** (Root level)
   * *Contents*: Complete product requirements, layout guidelines, gold heritage theme specifications, and educational goals.
3. **`QURAN_RECITATION_IMPLEMENTATION.md`** (Root level)
   * *Contents*: Complete developer specifications for the Quran reading section, auto-scroll math, touch-to-pause logic, and progress tracking mechanisms.
