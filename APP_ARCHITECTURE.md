# Bayan Al-Quran - App Architecture Overview

## Project Overview
**Name**: Bayan Al-Quran
**Purpose**: Quranic vocabulary learning application with word analysis, phrase study, and ayah lessons
**Tech Stack**: React, TypeScript, Tailwind CSS
**Location**: E:\Quran\

## Application Structure

### Main Entry Point
- **File**: `src/App.tsx`
- **Purpose**: Root component managing global state, navigation, and data loading
- **Key Features**:
  - Tab-based navigation (dashboard, quran, words, phrases, ayahs, analytics, settings)
  - Global state for words, phrases, ayahs
  - User progress persistence via localStorage
  - Language switching (multi-language support)
  - Arabic font size control
  - Gold heritage lines toggle

### Navigation Tabs
1. **Dashboard** - Home screen with progress stats and recommendations
2. **Quran** - Quran recitation feature (newly added)
3. **Words** - Single vocabulary word study
4. **Phrases** - Murakkabat (compound phrases) study
5. **Ayahs** - Verse lessons and study
6. **Analytics** - Progress statistics and charts
7. **Settings** - App configuration

## Core Components

### 1. Dashboard (`src/components/Dashboard.tsx`)
**Purpose**: Home screen showing learning progress and recommendations
**Features**:
- Quran recitation card (prominent, gradient background)
- Streak tracking card
- Core vocabulary mastery gauge
- Word recommendations (top 3 new/learning words)
- Quick practice session card
- Recent activity display

### 2. WordList (`src/components/WordList.tsx`)
**Purpose**: Display and study individual Quranic words
**Features**:
- Filter panel (surah, theme, POS, progress, core/non-core)
- Search functionality
- Infinite scroll pagination
- Word detail panel with:
  - Arabic text with diacritics
  - Transliteration
  - Root information
  - Part of speech
  - Morphology details
  - Translations (multi-language)
  - Occurrences by surah
  - Variants
- Word occurrence screens (surah-level, ayah-level)
- Learning state toggle (new, learning, known, mastered)

### 3. PhraseList (`src/components/PhraseList.tsx`)
**Purpose**: Display and study murakkabat (compound phrases)
**Features**:
- Search functionality
- Infinite scroll pagination
- Phrase detail panel with:
  - Arabic text
  - Transliteration
  - Type (n-gram, grammatical construct)
  - Frequency
  - Pattern
  - Occurrences
  - Surah distribution
- Learning state toggle

### 4. AyahList (`src/components/AyahList.tsx`)
**Purpose**: Display and study Quranic verses
**Features**:
- Search functionality
- Surah-based loading (infinite scroll)
- Ayah detail panel with:
  - Arabic text
  - Translations
  - Key vocabulary words
  - Learning state toggle

### 5. ProgressStats (`src/components/ProgressStats.tsx`)
**Purpose**: Display learning analytics and statistics
**Features**:
- Overall progress charts
- Word mastery breakdown
- Phrase mastery breakdown
- Ayah mastery breakdown
- Core vocabulary coverage

### 6. SettingsPanel (`settings/index.tsx`)
**Purpose**: App configuration
**Features**:
- Language selection (English, Urdu, Hindi, Turkish, etc.)
- Arabic font size (normal, large, xlarge)
- Gold heritage lines toggle
- Reset progress option

### 7. FilterPanel (`src/components/FilterPanel.tsx`)
**Purpose**: Advanced filtering for words
**Features**:
- Surah selection (multi-select)
- Theme selection (multi-select)
- Part of speech selection (multi-select)
- Progress state selection (multi-select)
- Core/non-core toggle
- Search query
- Sort options

### 8. QuranRecitation (`src/components/QuranRecitation.tsx`)
**Purpose**: Entry screen for Quran reading
**Features**:
- Surah/Para tab switching
- 114 surahs listing
- 30 paras (Juz) listing
- Navigation to reading screen

### 9. QuranReading (`src/components/QuranReading.tsx`)
**Purpose**: Quran reading screen with recitation features
**Features**:
- Arabic text display from quran-arabic-text.json
- Auto-scroll with multiple speeds
- Touch-to-pause functionality
- Translation toggle
- Beautiful styling for recitation

## Data Structure

### Word Data (`public/data/words.json`)
```typescript
interface Word {
  id: string;
  arabic: string;
  transliteration: string;
  root: string;
  lemma: string;
  pos: string;
  frequency: number;
  isCore: boolean;
  occurrences: {
    surah: number;
    ayah: number;
    word: number;
    context: string;
    surahName: string;
    variantForm: string;
  }[];
  variants: {
    form: string;
    arabic: string;
    transliteration: string;
    occurrences: number;
  }[];
  translations: {
    [language: string]: string;
  };
  themes: string[];
  learnedState: 'new' | 'learning' | 'known' | 'mastered';
}
```

### Phrase Data (`public/data/murakkabat.json`)
```typescript
interface Murakkab {
  id: string;
  arabic: string;
  phrase: string; // Buckwalter notation
  transliteration: string;
  n: number; // n-gram size
  type: string; // 'surface' or grammatical construct type
  frequency: number;
  pattern: string;
  occurrences: {
    surah: number;
    ayah: number;
    verse_ref: string;
    word_start: number;
    word_end: number;
    surface: string;
    surah_name: string;
  }[];
  surah_distribution: number[];
  learnedState: 'new' | 'learning' | 'known' | 'mastered';
}
```

### Ayah Data
```typescript
interface Ayah {
  id: string;
  surah: number;
  ayah: number;
  arabic: string;
  translations: {
    [language: string]: string;
  };
  keyWords: string[]; // Word IDs
  learnedState: 'new' | 'learning' | 'known' | 'mastered';
}
```

### Quran Arabic Text (`public/data/quran-arabic -text.json`)
```typescript
interface QuranText {
  [verseKey: string]: {
    text_uthmani: string;
    text_imlaei: string;
    // ... other fields
  };
}
// verseKey format: "001:001" (surah:ayah)
```

## State Management (App.tsx)

### Global State
```typescript
const [activeTab, setActiveTab] = useState<string>('dashboard');
const [language, setLanguage] = useState<LanguageCode>('en');
const [arabicSize, setArabicSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
const [showGoldLines, setShowGoldLines] = useState<boolean>(true);

// Data
const [words, setWords] = useState<Word[]>([]);
const [phrases, setPhrases] = useState<Murakkab[]>([]);
const [ayahs, setAyahs] = useState<Ayah[]>([]);

// Filters
const [filterState, setFilterState] = useState<FilterState>({...});
const [phraseSearchQuery, setPhraseSearchQuery] = useState<string>('');
const [ayahSearchQuery, setAyahSearchQuery] = useState<string>('');

// Pagination
const [wordsPage, setWordsPage] = useState(0);
const [phrasesPage, setPhrasesPage] = useState(0);
const [ayahsPage, setAyahsPage] = useState(0);

// Quran Recitation
const [quranView, setQuranView] = useState<'entry' | 'surah' | 'para' | null>(null);
const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
const [selectedPara, setSelectedPara] = useState<number | null>(null);
```

### User Progress Persistence
- **Storage**: localStorage
- **Key**: 'quran_vocab_progress_v2'
- **Saved Data**:
  - Words with learnedState
  - Phrases with learnedState
  - Ayahs with learnedState
  - Language preference
  - Arabic size preference
  - Gold lines preference

## Data Loading

### Words
- **Loader**: `src/lib/dataLoader.ts` - `loadWords()`
- **Source**: `public/data/words.json`
- **Pagination**: 100 words per page
- **Infinite Scroll**: Yes

### Phrases
- **Loader**: `src/lib/dataLoader.ts` - `loadMurakkabat()`
- **Source**: `public/data/murakkabat.json`
- **Pagination**: 100 phrases per page
- **Infinite Scroll**: Yes

### Ayahs
- **Loader**: `src/lib/dataLoader.ts` - `loadAyahsBySurahRange()`
- **Source**: Generated from morphology data
- **Loading Strategy**: Load surah by surah (starts with Al-Fatiha)
- **Infinite Scroll**: Yes (loads next surah when scrolling)

### Quran Text
- **Loader**: Direct fetch in QuranReading component
- **Source**: `public/data/quran-arabic -text.json`
- **Loading**: On-demand when surah/para selected

## Styling System

### Color Palette
- **Primary**: #8B3A3A (deep burgundy)
- **Secondary**: #D4A574 (gold/amber)
- **Background**: #FAF6F1 (cream/beige)
- **Text**: #3E2723 (dark brown)
- **Muted**: #795548 (brownish gray)
- **Border**: #E8DCC8 (light beige)

### Typography
- **Arabic Font**: Custom font-arabic class
- **English Font**: font-serif-eng
- **Mono Font**: font-mono for numbers/codes

### Components
- **ThemeOrnaments**: Islamic decorative elements (GoldDivider, IslamicSymmetryBorders, IslamicStar, CardHeritageFrame)
- **Icons**: lucide-react

## Multi-Language Support

### Supported Languages
- English (en)
- Urdu (ur)
- Hindi (hi)
- Turkish (tr)
- Indonesian (id)
- Malay (ms)
- Bengali (bn)
- French (fr)
- German (de)
- Spanish (es)
- Russian (ru)
- Swahili (sw)
- Hausa (ha)
- Hebrew (he)

### Translation Files
- **Location**: `src/data/quranData.ts`
- **Structure**: Object with language codes as keys
- **Content**: UI translations for all interface elements

## Key Features

### Learning System
- **States**: new → learning → known → mastered
- **Toggle**: Immediate state change with undo notification
- **Undo**: 6-second window to revert changes
- **Progress**: Saved to localStorage automatically

### Search
- **Words**: Search by Arabic, transliteration, translation, root
- **Phrases**: Search by Arabic, transliteration
- **Ayahs**: Search by Arabic, translation

### Filtering (Words)
- **Surah**: Multi-select
- **Themes**: Multi-select
- **POS**: Multi-select
- **Progress**: Multi-select
- **Core**: Toggle (core/non-core/all)
- **Sort**: frequency-desc, frequency-asc, id-asc, alphabetic-arabic

### Navigation
- **Desktop**: Top navigation bar
- **Mobile**: Bottom tab bar
- **Responsive**: Adapts to screen size

## File Structure

```
E:\Quran\
├── public\
│   └── data\
│       ├── words.json
│       ├── murakkabat.json
│       └── quran-arabic -text.json
├── src\
│   ├── components\
│   │   ├── Dashboard.tsx
│   │   ├── WordList.tsx
│   │   ├── PhraseList.tsx
│   │   ├── AyahList.tsx
│   │   ├── ProgressStats.tsx
│   │   ├── FilterPanel.tsx
│   │   ├── ThemeOrnaments.tsx
│   │   ├── WordOccurrencesScreen.tsx
│   │   ├── AyahOccurrencesScreen.tsx
│   │   ├── QuranRecitation.tsx
│   │   └── QuranReading.tsx
│   ├── lib\
│   │   ├── dataLoader.ts
│   │   └── searchUtils.ts
│   ├── data\
│   │   └── quranData.ts
│   ├── settings\
│   │   └── index.tsx
│   ├── types.ts
│   └── App.tsx
├── data\
│   ├── scripts\
│   │   ├── process-unique-words.js
│   │   └── transform-murakkabat.js
│   ├── quranic-corpus-morphology-0.4.txt
│   ├── quran-arabic -text.json
│   ├── quran_murakkabat_db\
│   └── single words tracks\
└── QURAN_RECITATION_IMPLEMENTATION.md
```

## Development Scripts

### Data Processing
- `data/scripts/process-unique-words.js` - Processes morphology data into words.json
- `data/scripts/transform-murakkabat.js` - Transforms murakkabat data

### Build/Dev
- `npm run dev` - Start development server
- `npm run lint` - Run TypeScript linting
- `npm run build` - Build for production

## Important Notes

### Data Sources
- **Morphology**: Quranic Arabic Corpus v0.4
- **Arabic Text**: Quranic Arabic Corpus
- **Murakkabat**: Quranic phrase database

### Performance Considerations
- Quran Arabic text file is large (~170MB)
- Words and phrases use pagination (100 items per page)
- Ayahs load surah-by-surah to manage memory
- Consider lazy loading for large datasets

### Known Limitations
- Translation data in QuranReading is placeholder (needs actual translations)
- Audio files not yet integrated
- Word-by-word highlighting not yet implemented
- Swipe navigation not yet implemented (tabs are click-only)

## Future Roadmap

### High Priority
1. Integrate actual translation data for Quran reading
2. Add audio files with word-by-word highlighting
3. Implement swipe navigation for tabs

### Medium Priority
4. Add bookmarking feature
5. Implement night mode
6. Add adjustable Arabic font size for Quran reading
7. Improve performance of Quran text loading

### Low Priority
8. Add more language translations
9. Implement spaced repetition algorithm
10. Add quiz/practice modes
