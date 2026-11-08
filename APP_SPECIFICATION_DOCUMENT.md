# Quranic Vocabulary Learning App - Complete Specification Document

## Table of Contents
1. [Application Overview](#application-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Data Models & Types](#data-models--types)
5. [Main Application Component (App.tsx)](#main-application-component-apptsx)
6. [Screen Components](#screen-components)
   - [Dashboard](#dashboard)
   - [Word List](#word-list)
   - [Phrase List](#phrase-list)
   - [Ayah List](#ayah-list)
   - [Quran Recitation](#quran-recitation)
   - [Quran Reading](#quran-reading)
   - [Progress Stats (Analytics)](#progress-stats-analytics)
   - [Settings Panel](#settings-panel)
7. [Supporting Components](#supporting-components)
   - [Filter Panel](#filter-panel)
   - [Theme Ornaments](#theme-ornaments)
8. [Data & Localization](#data--localization)
9. [UI/UX Design System](#uiux-design-system)
10. [State Management](#state-management)
11. [Navigation & Routing](#navigation--routing)
12. [Features & Interactions](#features--interactions)

---

## Application Overview

**Purpose**: A comprehensive Quranic vocabulary learning application that helps users study Arabic words, phrases, and verses from the Quran with detailed linguistic analysis, progress tracking, and multi-language support.

**Core Features**:
- Word study with root analysis, morphology, and occurrences
- Phrase (Murakkabat) study with syntax notes
- Verse (Ayah) study with interactive word exploration
- Quran recitation and reading modes
- Progress analytics and statistics
- Multi-language support (English, Urdu, Turkish, Indonesian, Hindi, Pashto)
- Advanced filtering by surah, theme, grammar, and mastery state
- Undo functionality for progress changes
- RTL/LTR automatic directionality
- Heritage-themed Islamic UI design

---

## Technology Stack

**Frontend Framework**: React 18+ with TypeScript

**Build Tool**: Vite

**Styling**: Tailwind CSS

**Icons**: Lucide React

**Data Storage**: LocalStorage for progress persistence

**Data Files**: JSON files in `public/data/` directory

**Key Dependencies**:
- `react`, `react-dom`
- `lucide-react` (icons)
- Tailwind CSS (styling)

---

## Project Structure

```
E:\Quran\
├── public/
│   └── data/
│       ├── words.json (vocabulary data)
│       ├── murakkabat.json (phrase data)
│       ├── ayahs.json (verse data)
│       └── quran-arabic-text.json (Quran text for reading)
├── src/
│   ├── App.tsx (main application component)
│   ├── main.tsx (entry point)
│   ├── index.css (global styles)
│   ├── types.ts (TypeScript type definitions)
│   ├── settings.tsx (settings panel component)
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   ├── WordList.tsx
│   │   ├── PhraseList.tsx
│   │   ├── AyahList.tsx
│   │   ├── QuranRecitation.tsx
│   │   ├── QuranReading.tsx
│   │   ├── ProgressStats.tsx
│   │   ├── FilterPanel.tsx
│   │   └── ThemeOrnaments.tsx
│   └── data/
│       └── quranData.ts (translations, dummy data, taxonomies)
└── package.json
```

---

## Data Models & Types

### Core Type Definitions (types.ts)

```typescript
// Learning state progression
type LearnedState = 'new' | 'learning' | 'known' | 'mastered' | 'review'

// Supported languages
type LanguageCode = 'en' | 'ur' | 'tr' | 'id' | 'hi' | 'ps'

// Translation with context
interface ContextTranslation {
  text: string
  context?: {
    surah?: number
    ayah?: number
    note?: string
  }
}

// Word occurrence in Quran
interface Occurrence {
  surah: number
  ayah: number
  surahName: string
  surahNameUr: string
  context: string
}

// Word data structure
interface Word {
  id: string
  arabic: string
  transliteration: string
  root: string
  pos: string // Noun, Verb, Particle, Pronoun, etc.
  frequency: number
  translations: Record<LanguageCode, ContextTranslation[]>
  occurrences: Occurrence[]
  themes: string[] // e.g., 'concept.virtue', 'spiritual.angel'
  learnedState: LearnedState
  isCore: boolean // Part of top 800 words
  grammarDetails?: {
    gender?: string
    number?: string
    derivedForm?: string
  }
  variants?: WordVariant[]
}

// Word variant (different forms)
interface WordVariant {
  form: string // Buckwalter transliteration
  arabic: string // Arabic text
  frequency: number
}

// Phrase (Murakkabat) data structure
interface Murakkab {
  id: string
  arabic: string
  transliteration: string
  translations: Record<LanguageCode, ContextTranslation[]>
  frequency: number
  occurrences: Occurrence[]
  grammarNotes: Record<LanguageCode, ContextTranslation[]>
  learnedState: LearnedState
  themes: string[]
}

// Verse (Ayah) data structure
interface Ayah {
  id: string // e.g., "1:1"
  surah: number
  ayahNum: number
  surahName: string
  surahNameArabic: string
  surahNameUrdu: string
  arabicText: string
  transliteration: string
  translations: Record<LanguageCode, ContextTranslation[]>
  wordIds: string[]
  phraseIds: string[]
  themes: string[]
  revelationPeriod: 'Meccan' | 'Medinan'
  learnedState: LearnedState
}

// Surah information
interface Surah {
  number: number
  nameArabic: string
  nameEnglish: string
  verses: number
  meaning: string
  revelationPlace: 'Meccan' | 'Medinan'
  revelationOrder: number
}

// Filter state
interface FilterState {
  selectedSurahs: number[]
  selectedThemes: string[]
  selectedPOS: string[]
  selectedProgress: LearnedState[]
  selectedCore: 'all' | 'core' | 'non-core'
  searchQuery: string
  sortBy: 'frequency-desc' | 'frequency-asc' | 'id-asc' | 'alphabetic-arabic'
}

// Translation resource
interface TranslationResource {
  direction: 'ltr' | 'rtl'
  name: string
  translations: Record<string, string>
}
```

---

## Main Application Component (App.tsx)

### Purpose
Root component that manages global state, navigation, and data loading.

### State Variables
- `activeTab`: Current navigation tab ('dashboard', 'quran', 'words', 'phrases', 'ayahs', 'analytics', 'settings')
- `words`: Array of Word objects
- `phrases`: Array of Murakkab objects
- `ayahs`: Array of Ayah objects
- `currentLang`: Selected language code
- `arabicSize`: Arabic text size ('normal' | 'large' | 'xlarge')
- `showGoldLines`: Toggle for heritage ornaments
- `undoStack`: Array for undo functionality
- `showToast`: Toast notification state
- `toastMessage`: Toast message content
- `quranRecitationView`: Quran recitation mode state
- `selectedSurah`: Selected surah for reading
- `selectedPara`: Selected para (juz) for reading
- `filterState`: Filter state for words/phrases/ayahs

### Key Functions
- `loadData()`: Loads JSON data from public/data/
- `loadProgress()`: Loads user progress from localStorage
- `saveProgress()`: Saves progress to localStorage
- `updateWordState()`: Updates word learning state with undo support
- `updatePhraseState()`: Updates phrase learning state with undo support
- `updateAyahState()`: Updates ayah learning state with undo support
- `undoLastChange()`: Reverts last state change
- `translate()`: Returns translated string based on current language
- `resetProgress()`: Resets all progress to 'new' state

### Navigation Tabs
1. **Dashboard** - Home screen with statistics
2. **Quran** - Quran recitation and reading
3. **Words** - Vocabulary study
4. **Phrases** - Phrase study
5. **Ayahs** - Verse study
6. **Analytics** - Progress statistics
7. **Settings** - App settings

### UI Structure
- Bottom navigation bar (mobile) or top navigation (desktop)
- Conditional rendering based on activeTab
- Toast notification system
- RTL/LTR direction based on selected language

---

## Screen Components

### Dashboard

**File**: `src/components/Dashboard.tsx`

**Purpose**: Home screen displaying learning statistics and quick access to features.

**Cards Displayed**:
1. **Quran Recitation Card** (prominent, large)
   - Icon: BookOpen
   - Title: "Quran Recitation"
   - Description: "Read and recite the Holy Quran"
   - Action: Opens Quran recitation screen
   - Styling: Gold border, heritage frame

2. **Learned Words Card**
   - Count of learned words
   - Total words in database
   - Progress bar
   - Icon: Book

3. **Learned Phrases Card**
   - Count of learned phrases
   - Total phrases in database
   - Progress bar
   - Icon: MessageSquare

4. **Learned Ayahs Card**
   - Count of learned verses
   - Total verses in database
   - Progress bar
   - Icon: Scroll

5. **Core Vocabulary Mastery Gauge**
   - Progress on top 800 core words
   - Percentage coverage (~91% of Quran)
   - Visual gauge/bar
   - Icon: Target

6. **Streak & Consistency Card**
   - Daily study streak count
   - Motivational message
   - Icon: Flame

7. **Active Study Recommendations**
   - Suggested words/phrases to study
   - Based on learning state
   - Icon: Lightbulb

8. **Quick Quiz Card**
   - Quick study session access
   - Icon: Brain

**UI Elements**:
- CardHeritageFrame wrapper for heritage styling
- Lucide React icons
- Responsive grid layout
- Gold accent colors (#D4A574, #8B3A3A)
- Cream background (#FAF6F1)

**Interactions**:
- Click on cards to navigate to respective screens
- Dynamic updates based on progress data

---

### Word List

**File**: `src/components/WordList.tsx`

**Purpose**: Display and study individual Quranic vocabulary words.

**State Variables**:
- `searchQuery`: Search input text
- `viewMode`: 'basic' | 'advanced'
- `expandedWordId`: Currently expanded word for details
- `viewingOccurrences`: Boolean for occurrence overlay
- `selectedSurah`: Filter for occurrence display
- `selectedVariant`: Selected word variant
- `visibleCount`: For infinite scroll pagination

**UI Components**:

1. **Header**
   - Title: "Words" or translated equivalent
   - Search input with search icon
   - Filter button (opens FilterPanel)
   - View mode toggle (Basic/Advanced)

2. **Word Cards** (Basic View)
   - Arabic text (large, right-aligned)
   - Transliteration
   - Root letters
   - Part of speech
   - Frequency count
   - Learned state badge
   - Toggle learned state button

3. **Word Cards** (Advanced View - when expanded)
   - All basic view elements
   - Detailed translations in selected language
   - Grammar details (gender, number, derived form)
   - Themes with emojis
   - Word variants (different forms)
   - Occurrences list with surah references
   - "View All Occurrences" button

4. **Word Occurrences Screen** (overlay)
   - Full-screen overlay with fixed positioning
   - List of all occurrences
   - Filter by surah
   - Filter by variant form
   - Back button to return to word list

5. **Ayah Occurrences Screen** (overlay)
   - Full-screen overlay
   - Shows ayahs containing the word
   - Clickable words within ayahs
   - Back button

**Infinite Scroll**:
- Loads 20 words at a time
- Triggered by scrolling to bottom
- Filters applied before pagination

**Styling**:
- CardHeritageFrame for each word
- Gold borders for known words, brown for new
- Arabic font: font-arabic
- English font: font-serif-eng
- Responsive grid layout

**Interactions**:
- Click word to expand/collapse details
- Toggle learned state (cycles through states)
- Click "View Occurrences" for full list
- Search filters in real-time
- Filter panel for advanced filtering

---

### Phrase List

**File**: `src/components/PhraseList.tsx`

**Purpose**: Display and study Quranic phrases (Murakkabat).

**State Variables**:
- `searchQuery`: Search input
- `viewMode`: 'basic' | 'advanced'
- `selectedPhrase`: Currently selected phrase
- `visibleCount`: Pagination counter

**UI Components**:

1. **Header**
   - Title: "Phrases" or translated
   - Search input
   - Filter button
   - View mode toggle

2. **Phrase Cards** (Basic View)
   - Arabic phrase text
   - Transliteration
   - Frequency count
   - Learned state badge
   - Toggle learned button

3. **Phrase Cards** (Advanced View - when selected)
   - All basic elements
   - Translations in selected language
   - Grammar/syntax notes (tarakeeb)
   - Themes with emojis
   - Occurrences list
   - Context for each occurrence

**Features**:
- Toggle learned state
- Search by Arabic, transliteration, or translation
- Filter by themes, surah, grammar
- Infinite scroll (20 phrases per load)

**Styling**:
- Similar to WordList
- CardHeritageFrame wrapper
- Heritage color scheme

---

### Ayah List

**File**: `src/components/AyahList.tsx`

**Purpose**: Display and study Quranic verses grouped by surah.

**State Variables**:
- `searchQuery`: Search input
- `expandedSurahs`: Set of expanded surah numbers
- `selectedWord`: Currently selected word for details
- `selectedAyahWord`: Word clicked within an ayah
- `visibleCount`: Pagination counter

**UI Components**:

1. **Header**
   - Title: "Ayahs" or translated
   - Search input
   - Filter button

2. **Surah Groups**
   - Surah header (collapsible)
   - Surah name (Arabic and English)
   - Verse count
   - Expand/collapse button

3. **Ayah Cards** (within surah)
   - Ayah number badge
   - Arabic text
   - Transliteration
   - Translation (if enabled)
   - Learned state badge
   - Toggle learned button
   - Interactive word segments (clickable)

4. **Word Detail Panel** (when word clicked)
   - Word Arabic and transliteration
   - Root
   - Part of speech
   - Translations
   - Grammar details
   - Occurrences

**Features**:
- Group ayahs by surah
- Expand/collapse surahs
- Click individual words in ayah to study
- Toggle ayah learned state
- Search by Arabic, translation, surah
- Infinite scroll

**Styling**:
- Surah headers with gold accents
- Ayah cards with CardHeritageFrame
- Interactive word highlighting
- RTL support for Arabic

---

### Quran Recitation

**File**: `src/components/QuranRecitation.tsx`

**Purpose**: Entry screen for Quran recitation, allowing selection of surah or para (juz).

**State Variables**:
- `activeTab`: 'surah' | 'para'

**UI Components**:

1. **Header**
   - Back button
   - Title: "Quran Recitation"
   - Empty spacer for balance

2. **Tab Switcher**
   - Surahs tab (with BookOpen icon)
   - Paras (Juz) tab (with List icon)
   - Active tab highlighting

3. **Surah Grid** (when surah tab active)
   - 114 surahs in responsive grid
   - Each card shows:
     - Surah number (large)
     - Verse count badge
     - Arabic name
     - English name
   - Hover effects
   - Click to select surah

4. **Para Grid** (when para tab active)
   - 30 paras (juz) in grid
   - Each card shows:
     - Para number
     - "Juz" badge
     - Para name
     - Surah range (e.g., "Surah 1 - 1")
   - Hover effects
   - Click to select para

**Helper Functions**:
- `getSurahName(surah)`: Returns English name
- `getSurahNameArabic(surah)`: Returns Arabic name
- `getSurahAyahCount(surah)`: Returns verse count
- `getParaStartSurah(para)`: Returns starting surah
- `getParaEndSurah(para)`: Returns ending surah

**Data**:
- Hardcoded arrays for surah names, verse counts, and para ranges

**Styling**:
- White background
- Gold accents (#D4A574, #8B3A3A)
- Responsive grid (1-4 columns)
- RTL support for Arabic names

**Interactions**:
- Click surah/para to open QuranReading
- Tab switching between surahs and paras
- Back button returns to dashboard

---

### Quran Reading

**File**: `src/components/QuranReading.tsx`

**Purpose**: Display Quran text for reading with auto-scroll and translation features.

**State Variables**:
- `verses`: Array of loaded verses
- `loading`: Loading state
- `autoScroll`: Boolean for auto-scroll
- `scrollSpeed`: Number (0.5, 1, 1.5, 2, 3)
- `showTranslation`: Boolean for translation toggle
- `showSpeedMenu`: Boolean for speed menu

**Refs**:
- `scrollContainerRef`: Reference to scroll container
- `autoScrollRef`: Reference to auto-scroll interval
- `isTouchingRef`: Touch state for pause on touch

**UI Components**:

1. **Header**
   - Back button
   - Title (surah name or para name)
   - Arabic subtitle (for surah)
   - Control buttons:
     - Translation toggle (Eye/EyeOff icon)
     - Auto-scroll toggle (Play/Pause icon)
     - Speed menu (Settings icon)

2. **Speed Menu** (dropdown)
   - Options: 0.5x, 1x, 1.5x, 2x, 3x
   - Active speed highlighted

3. **Quran Content**
   - Bismillah (for surahs except Tawbah)
   - Verse cards:
     - Verse number badge (chapter:verse)
     - Verse end symbol (۝)
     - Arabic text (large, right-aligned)
     - Translation (if enabled)
   - End indicator

4. **Auto-scroll Status Indicator** (fixed bottom)
   - Shows when auto-scroll is active
   - Displays current speed
   - "(Touch to pause)" hint
   - Pulsing dot animation

**Features**:
- Load verses by surah or para
- Auto-scroll with adjustable speed
- Pause on touch/mouse interaction
- Translation toggle
- Responsive verse cards
- Smooth scrolling

**Data Loading**:
- Fetches from `/data/quran-arabic-text.json`
- Filters by surah or para range
- Sorts by verse number

**Styling**:
- Cream background (#FAF6F1)
- White verse cards
- Gold accents
- Large Arabic text (2xl)
- RTL for Arabic

**Interactions**:
- Touch/mouse down pauses auto-scroll
- Touch/mouse up resumes
- Speed selection from menu
- Translation toggle
- Back button returns to recitation screen

---

### Progress Stats (Analytics)

**File**: `src/components/ProgressStats.tsx`

**Purpose**: Display learning analytics and statistics across words, phrases, and ayahs.

**State Variables**:
- `activeTab`: 'words' | 'phrases' | 'ayahs'

**UI Components**:

1. **Header**
   - Title: "Learning Analytics & Mastery"
   - Subtitle

2. **Tab Switcher**
   - Words tab
   - Phrases tab
   - Ayahs tab
   - Active tab highlighting

3. **Analytics Content** (based on active tab)
   - **Words Analytics**:
     - Core 800 Progress gauge
     - Quran coverage percentage
     - Overall progress breakdown
     - Grammar performance by POS
     - Thematic mastery by theme
   - **Phrases Analytics**:
     - High frequency progress
     - Frequency distribution
     - Scope analysis (hapax legomena, average frequency)
   - **Ayahs Analytics**:
     - Verse progress
     - Status breakdown
     - Revelation period analysis (Meccan vs Medinan)
     - Surah coverage

**Child Components**:
- Uses separate analytics components for each category
- Progress bars and gauges
- Statistical summaries
- Visual charts/representations

**Styling**:
- Card-based layout
- Heritage frames
- Color-coded progress indicators
- Responsive design

---

### Settings Panel

**File**: `src/settings.tsx`

**Purpose**: App settings and personalization options.

**State Variables**:
- `showConfirmReset`: Boolean for reset confirmation dialog

**Props**:
- `currentLang`: Current language code
- `onChangeLang`: Language change callback
- `arabicSize`: Arabic text size
- `onChangeSize`: Size change callback
- `showGoldLines`: Gold lines toggle state
- `onToggleGoldLines`: Toggle callback
- `onResetProgress`: Reset callback
- `translate`: Translation function

**UI Components**:

1. **Header**
   - Settings icon
   - Title: "Settings & Personalization"
   - Subtitle: "Customize translations, typeface options, and visual components"

2. **Translation Language Selector**
   - Globe icon
   - Section title
   - Description
   - Language buttons (grid layout):
     - English
     - Urdu
     - Turkish
     - Indonesian
     - Hindi
     - Pashto
   - Selected language highlighted

3. **Font Typeface Size**
   - Type icon
   - Section title
   - Description
   - Size buttons:
     - Normal (1x)
     - Large (1.25x)
     - Extra Large (1.5x)
   - Active size highlighted

4. **Toggle Heritage Ornaments / Gold Lines**
   - Sparkles icon
   - Section title
   - Description
   - Toggle switch (pill shape)
   - Animated toggle

5. **Reset Progress Section** (Danger Zone)
   - RefreshCw icon (red)
   - Section title: "Danger Zone"
   - Warning description
   - Reset button (red)
   - Confirmation dialog (when clicked):
     - Warning message
     - Confirm Reset button
     - Cancel button

**Styling**:
- CardHeritageFrame wrapper
- Gold and brown color scheme
- Toggle switch animation
- Red accent for danger zone
- Responsive layout

**Interactions**:
- Language selection changes app direction (LTR/RTL)
- Size selection affects Arabic text rendering
- Gold lines toggle affects CardHeritageFrame display
- Reset requires confirmation

---

## Supporting Components

### Filter Panel

**File**: `src/components/FilterPanel.tsx`

**Purpose**: Advanced filtering panel for words, phrases, and ayahs.

**State Variables** (local):
- `localSearchQuery`: Search text input
- `selectedSurahs`: Array of selected surah numbers
- `selectedThemes`: Array of selected theme IDs
- `selectedPOS`: Array of selected POS tags
- `selectedProgress`: Array of selected LearnedState values
- `selectedCore`: 'all' | 'core' | 'non-core'
- `sortBy`: Sort option

**Props**:
- `isOpen`: Boolean for panel visibility
- `onClose`: Close callback
- `filterState`: Current filter state
- `onApplyFilters`: Apply filters callback
- `translate`: Translation function
- `isRtl`: RTL direction

**UI Components**:

1. **Header**
   - SlidersHorizontal icon
   - Title: "Advanced Study Filters"
   - Close button

2. **Search Input**
   - Search icon
   - Text input
   - Placeholder: "Type Root, English or Arabic text..."

3. **Vocabulary Scope**
   - Section title
   - Radio buttons:
     - All Available Vocabulary
     - Top 800 Core Words Only (~91% Occurrences)
     - Exclude Core Words

4. **Filter by Surah**
   - Section title
   - Surah buttons (OR logic):
     - Al-Fatiha (1)
     - Al-Baqarah (2)
     - Ali Imran (3)
     - Al-Jumua (62)

5. **Filter by Themes & Taxonomy**
   - Section title
   - Theme buttons (from THEME_TAXONOMY):
     - 💎 Spiritual Virtues & Divine Creeds
     - ✨ Unseen Realms & Angels
     - 👤 Prophetic Narratives & Scholars
     - 🕌 Sacred Lands & Sanctuaries
     - 🌌 Cosmic Creation & Celestial Bodies
     - 🐫 Living Beings & Animals

6. **Filter by Grammar Part of Speech**
   - Section title
   - POS buttons (from GRAMMAR_POS_OPTIONS):
     - Noun
     - Verb
     - Proper Noun
     - Relative Pronoun
     - Demonstrative Pronoun
     - Adjective

7. **Mastery & Learned States**
   - Section title
   - State buttons:
     - NEW
     - LEARNING
     - KNOWN
     - MASTERED
     - REVIEW

8. **Sort Selection**
   - Section title
   - Dropdown:
     - Highest Frequency First
     - Lowest Frequency First
     - Book Order (ID Sequence)
     - Arabic Alphabetical

9. **Info Box**
   - Info icon
   - Explanation: "Within group is OR | Between group is AND"

10. **Footer Actions**
    - Clear All button (with Trash2 icon)
    - Apply Filters button (with CheckCircle2 icon)

**Filtering Logic**:
- Within each category: OR logic
- Between categories: AND logic

**Styling**:
- Slide-in panel from right
- Cream background (#FAF6F1)
- Gold borders
- Backdrop blur overlay
- Responsive width (max-w-md)

**Interactions**:
- Click outside to close
- Toggle filters on/off
- Clear all resets all filters
- Apply commits filters

---

### Theme Ornaments

**File**: `src/components/ThemeOrnaments.tsx`

**Purpose**: Islamic-themed decorative components for heritage styling.

**Components**:

1. **IslamicStar**
   - 8-pointed star (Rub el Hizb)
   - SVG with intersecting squares
   - Central circle
   - Customizable className and color
   - Default: amber-500, w-6 h-6

2. **GoldDivider**
   - Horizontal divider with Islamic star
   - Diamond symbols (◆) on sides
   - Gold color (#D4A574)
   - Full width by default

3. **OrnamentalCorner**
   - Decorative corner SVG
   - Curved lines and dots
   - Top-right positioning
   - Low opacity (0.2)
   - Gold color

4. **IslamicSymmetryBorders**
   - Top border with decorative corners
   - Dashed center line
   - Rounded corners
   - Gold color
   - Low opacity (0.4)

5. **CardHeritageFrame**
   - Main card wrapper component
   - Props:
     - `children`: Card content
     - `isKnown`: Boolean for border color
     - `className`: Additional classes
   - Styling:
     - Cream background (#FAF6F1)
     - Border (#E8DCC8)
     - Left border accent:
       - Gold (#D4A574) if known
       - Brown (#8B3A3A) if new
     - Decorative corner symbols (❖)
     - Hover effects (shadow, border color)
     - Overflow hidden

**Usage**:
- Used throughout app for consistent heritage theme
- Applied to cards in Dashboard, WordList, PhraseList, AyahList, Settings
- Provides Islamic aesthetic

---

## Data & Localization

### Language Support (quranData.ts)

**Supported Languages**:
1. **English (en)** - LTR
2. **Urdu (ur)** - RTL
3. **Turkish (tr)** - LTR
4. **Indonesian (id)** - LTR
5. **Hindi (hi)** - LTR
6. **Pashto (ps)** - RTL

**Translation Keys** (examples):
- App titles and subtitles
- Tab names
- Dashboard labels
- State labels (new, learning, known, mastered, review)
- Linguistic elements (root, pos, frequency, etc.)
- Filter labels
- Button labels
- Settings labels
- Analytics labels
- Search UI labels

### Theme Taxonomy (THEME_TAXONOMY)

**Categories**:
1. `concept.virtue` - 💎 Spiritual Virtues & Divine Creeds
2. `spiritual.angel` - ✨ Unseen Realms & Angels
3. `people.prophet` - 👤 Prophetic Narratives & Scholars
4. `place.holy` - 🕌 Sacred Lands & Sanctuaries
5. `physical.celestial` - 🌌 Cosmic Creation & Celestial Bodies
6. `living.animal` - 🐫 Living Beings & Animals

Each theme has:
- Unique ID
- Emoji icon
- Labels in all 6 languages

### Grammar POS Options (GRAMMAR_POS_OPTIONS)

**Categories**:
1. Noun (اِسم)
2. Verb (فعل)
3. Proper Noun (اسم علم)
4. Relative Pronoun (اسم موصول)
5. Demonstrative Pronoun (اسم اشارہ)
6. Adjective (صفت)

Each has labels in all 6 languages with Arabic script.

### Dummy Data

**DUMMY_WORDS**: 15 sample words with full data structure
**DUMMY_PHRASES**: 3 sample phrases with grammar notes
**DUMMY_AYAHS**: 3 sample verses with translations

Used for development and testing when real data is not available.

---

## UI/UX Design System

### Color Palette

**Primary Colors**:
- Background: #FAF6F1 (cream)
- Card Background: #FAF6F1
- Border: #E8DCC8 (light cream)
- Gold Accent: #D4A574
- Brown Accent: #8B3A3A
- Dark Brown: #3E2723
- Text Brown: #795548

**State Colors**:
- New: Default brown
- Learning: Amber/yellow tones
- Known: Gold tones
- Mastered: Green tones
- Review: Red/pink tones

**Danger Zone**:
- Red: #DC2626
- Red background: #FEE2E2

### Typography

**Arabic Font**:
- Class: `font-arabic`
- Size: Adjustable (normal, large 1.25x, xlarge 1.5x)
- Direction: RTL
- Line height: loose

**English Font**:
- Class: `font-serif-eng`
- For headings and labels
- Direction: LTR (or RTL for Urdu/Pashto)

**Font Sizes**:
- Headers: text-xl, text-2xl
- Body: text-sm, text-xs
- Arabic text: text-2xl (adjustable)

### Icons

**Library**: Lucide React

**Common Icons**:
- BookOpen (Quran)
- Book (Words)
- MessageSquare (Phrases)
- Scroll (Ayahs)
- BarChart3 (Analytics)
- Settings (Settings)
- Search (Search)
- Filter (Filter)
- ChevronLeft/Right (Navigation)
- Play/Pause (Auto-scroll)
- Eye/EyeOff (Translation toggle)
- Flame (Streak)
- Target (Mastery)
- Lightbulb (Recommendations)
- Brain (Quiz)
- Trash2 (Clear)
- CheckCircle2 (Apply)
- Info (Help)
- SlidersHorizontal (Filters)

### Spacing

**Card Padding**: p-5 (1.25rem)
**Gap**: gap-4 (1rem)
**Margins**: my-4, py-6, etc.

### Borders

**Standard Border**: border-[#E8DCC8]
**Hover Border**: border-[#D4A574]
**Radius**: rounded-lg (0.5rem)
**Shadow**: shadow-sm, shadow-md

### Animations

**Transitions**: transition-all duration-200/300
**Hover Effects**: hover:shadow-md, hover:border-[#D4A574]
**Fade In**: animate-fadeIn
**Slide Left**: animate-slideLeft
**Pulse**: animate-pulse (for auto-scroll indicator)

### Responsive Design

**Breakpoints**:
- Mobile: default
- sm: 640px
- md: 768px
- lg: 1024px
- xl: 1280px

**Grid Layouts**:
- Quran cards: grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4
- Dashboard cards: Responsive based on content

---

## State Management

### Global State (App.tsx)

**Data State**:
- `words`: Word[] - All vocabulary words
- `phrases`: Murakkab[] - All phrases
- `ayahs`: Ayah[] - All verses

**User Preferences**:
- `currentLang`: LanguageCode
- `arabicSize`: 'normal' | 'large' | 'xlarge'
- `showGoldLines`: boolean

**Navigation State**:
- `activeTab`: Tab name
- `quranRecitationView`: boolean
- `selectedSurah`: number | null
- `selectedPara`: number | null

**Progress State**:
- LearnedState embedded in each word/phrase/ayah
- Persisted to localStorage

**Undo System**:
- `undoStack`: Array of previous states
- `showToast`: boolean
- `toastMessage`: string

**Filter State**:
- `filterState`: FilterState object

### Local Component State

Each component manages its own UI state:
- Expanded/collapsed items
- Search queries
- View modes
- Overlay visibility
- Selection states

### Data Persistence

**localStorage Keys**:
- `quran-vocab-progress`: Progress data for words, phrases, ayahs
- `quran-vocab-settings`: User preferences (language, size, gold lines)

**Save Triggers**:
- After any state change (word/phrase/ayah learned state)
- After settings change
- Manual saveProgress() calls

**Load Triggers**:
- App initialization
- Settings panel load

---

## Navigation & Routing

### Tab-Based Navigation

**Tabs**:
1. dashboard
2. quran
3. words
4. phrases
5. ayahs
6. analytics
7. settings

**Navigation Logic**:
- `activeTab` state determines which component renders
- Conditional rendering in App.tsx
- Tab buttons in navigation bar update `activeTab`

### Special Navigation Flows

**Quran Flow**:
1. Dashboard → Quran tab → QuranRecitation
2. QuranRecitation → Select surah/para → QuranReading
3. QuranReading → Back → QuranRecitation
4. QuranRecitation → Back → Dashboard

**Word/Phrase/Ayah Detail Flow**:
1. List screen → Click item → Expand details
2. Details → View occurrences → Occurrence overlay
3. Overlay → Back → List screen

**Filter Flow**:
1. List screen → Filter button → FilterPanel
2. FilterPanel → Apply → List screen (with filters)
3. FilterPanel → Close/Outside click → List screen (no change)

### Back Navigation

**Back Buttons**:
- QuranReading: Back to QuranRecitation
- QuranRecitation: Back to Dashboard
- Occurrence overlays: Back to parent screen
- Settings: No back (accessed via tab)

### RTL/LTR Handling

**Direction**:
- Determined by selected language
- Urdu and Pashto: RTL
- English, Turkish, Indonesian, Hindi: LTR

**Implementation**:
- `dir` attribute on container
- Icon rotation for RTL (ChevronLeft rotates 180°)
- Text alignment (right for Arabic, left for English)

---

## Features & Interactions

### Learning State Management

**States**:
- `new`: Not yet studied
- `learning`: Currently studying
- `known`: Learned/memorized
- `mastered`: Fully mastered
- `review`: Needs review

**State Transitions**:
- Click toggle button cycles through states
- Order: new → learning → known → mastered → review → new
- Visual feedback with color changes

**Undo Functionality**:
- Each change pushed to undoStack
- Toast notification shows change
- Undo button appears (or Ctrl+Z)
- Reverts to previous state
- Clears from stack after undo

### Search & Filtering

**Search**:
- Real-time filtering
- Searches: Arabic text, transliteration, root, translation
- Case-insensitive
- Debounced for performance

**Advanced Filters**:
- Surah selection (OR logic within)
- Theme selection (OR logic within)
- POS selection (OR logic within)
- Progress state (OR logic within)
- Core vocabulary scope (radio)
- Sort options
- Combined with AND logic between categories

### Infinite Scroll

**Implementation**:
- Load 20 items at a time
- Scroll event listener
- Intersection Observer (optional)
- Filters applied before pagination
- Loading indicator

**Components with Infinite Scroll**:
- WordList
- PhraseList
- AyahList

### Toast Notifications

**Triggers**:
- State change (word/phrase/ayah)
- Undo action
- Error messages

**Display**:
- Fixed position (top-center or bottom-center)
- Auto-dismiss after 3 seconds
- Animation in/out
- Message content

### Quran Reading Features

**Auto-Scroll**:
- Toggle on/off
- Adjustable speed (0.5x to 3x)
- Pauses on touch/mouse interaction
- Resumes when interaction ends
- Visual indicator when active

**Translation Toggle**:
- Show/hide translation
- Per-verse display
- Icon feedback

**Bismillah**:
- Displayed at start of surahs
- Not displayed for Surah At-Tawbah (9)

### Data Loading

**JSON Files**:
- `words.json`: Vocabulary data
- `murakkabat.json`: Phrase data
- `ayahs.json`: Verse data
- `quran-arabic-text.json`: Full Quran text

**Loading Process**:
- Fetch on app mount
- Parse JSON
- Store in state
- Error handling with console log

**Progress Loading**:
- Load from localStorage on mount
- Merge with data (apply learned states)
- Fallback to default if no saved progress

### Responsive Behavior

**Mobile**:
- Bottom navigation bar
- Single column grids
- Smaller text sizes
- Touch-optimized buttons
- Full-screen overlays

**Desktop**:
- Top navigation bar
- Multi-column grids
- Larger text sizes
- Hover effects
- Side-by-side panels (where applicable)

### Accessibility

**Keyboard Navigation**:
- Tab through interactive elements
- Enter/Space to activate
- Escape to close modals

**Screen Readers**:
- Semantic HTML
- ARIA labels where needed
- Alt text for images

**Color Contrast**:
- WCAG AA compliant
- Sufficient contrast ratios

---

## Additional Technical Details

### Performance Optimizations

**Memoization**:
- React.memo for expensive components
- useMemo for computed values
- useCallback for event handlers

**Lazy Loading**:
- Code splitting for large components
- Dynamic imports where appropriate

**Debouncing**:
- Search input debounced
- Scroll events throttled

### Error Handling

**Data Loading**:
- Try-catch blocks
- Console error logging
- Fallback to dummy data

**User Actions**:
- Validation before state changes
- Confirmation for destructive actions
- Error messages in toasts

### Browser Compatibility

**Target Browsers**:
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)

**Features Used**:
- ES6+ JavaScript
- CSS Grid/Flexbox
- LocalStorage API
- Fetch API

---

## Conclusion

This specification document provides a comprehensive overview of the Quranic Vocabulary Learning Application, covering all screens, components, features, data structures, UI/UX elements, and technical implementation details. An AI-assisted app builder can use this document to recreate a functionally identical application with the same heritage-themed design, multi-language support, and learning features.

The application follows React best practices, uses TypeScript for type safety, implements a consistent design system with Islamic heritage aesthetics, and provides a rich learning experience for Quranic vocabulary study.
