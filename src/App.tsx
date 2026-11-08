/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Word, Murakkab, Ayah, LanguageCode, LearnedState, FilterState } from './types';
import { LANGUAGES } from './data/quranData';
import { loadAllWords, loadMurakkabat, loadAyahsBySurahRange } from './lib/dataLoader';
import { searchWords, searchPhrases, searchAyahs } from './lib/searchUtils';
import { normalizeRootString, parseCorpusMorphTag } from './lib/arabicMorphology';
import { GoldDivider, IslamicSymmetryBorders, IslamicStar } from './components/ThemeOrnaments';
import { Dashboard } from './components/Dashboard';
import { WordList } from './components/WordList';
import { PhraseList } from './components/PhraseList';
import { AyahList } from './components/AyahList';
import { ProgressStats } from './components/ProgressStats';
import { SettingsPanel } from './settings';
import { FilterPanel } from './components/FilterPanel';
import { QuranRecitation } from './components/QuranRecitation';
import { QuranReading, getSurahName, getSurahNameArabic, getParaNameArabic } from './components/QuranReading';
import { Home, BookOpen, Sparkles, GraduationCap, BarChart3, Settings, Undo2, X, Book } from 'lucide-react';

interface UndoAction {
  id: string;
  type: 'word' | 'phrase' | 'ayah';
  prevState: LearnedState;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [arabicSize, setArabicSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [showGoldLines, setShowGoldLines] = useState<boolean>(true);
  
  // Storage-backed status - start with empty, load real data immediately
  const [words, setWords] = useState<Word[]>([]);
  const [phrases, setPhrases] = useState<Murakkab[]>([]);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);

  // Undo notification state matching immediate toggle
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [showUndoToast, setShowUndoToast] = useState<boolean>(false);
  const [lastActionDesc, setLastActionDesc] = useState<string>('');

  // Siders filters panel trigger
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);
  const [filterState, setFilterState] = useState<FilterState>({
    selectedSurahs: [],
    selectedThemes: [],
    selectedPOS: [],
    selectedBaab: [],
    rootQuery: '',
    selectedProgress: [],
    selectedCore: 'all',
    searchQuery: '',
    sortBy: 'frequency-desc'
  });

  // Search states for phrases and ayahs
  const [phraseSearchQuery, setPhraseSearchQuery] = useState<string>('');
  const [ayahSearchQuery, setAyahSearchQuery] = useState<string>('');

  // Pagination state
  const [wordsPage, setWordsPage] = useState(0);
  const [phrasesPage, setPhrasesPage] = useState(0);
  const [ayahsPage, setAyahsPage] = useState(0);
  const [hasMoreWords, setHasMoreWords] = useState(true);
  const [hasMorePhrases, setHasMorePhrases] = useState(true);
  const [hasMoreAyahs, setHasMoreAyahs] = useState(true);

  // Loading flags to prevent rapid/concurrent duplicate requests
  const [loadingWords, setLoadingWords] = useState(false);
  const [loadingPhrases, setLoadingPhrases] = useState(false);
  const [loadingAyahs, setLoadingAyahs] = useState(false);

  // Surah-based loading state for ayahs
  const [currentSurah, setCurrentSurah] = useState(1);
  const [loadedSurahs, setLoadedSurahs] = useState<Set<number>>(new Set([1]));
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Quran recitation state
  const [quranView, setQuranView] = useState<'entry' | 'surah' | 'para' | null>(null);
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [selectedPara, setSelectedPara] = useState<number | null>(null);

  interface RecitationHistoryItem {
    type: 'surah' | 'para';
    id: number;
    name: string;
    arabicName?: string;
    scrollY: number;
    timestamp: number;
  }

  const [recentRecitations, setRecentRecitations] = useState<RecitationHistoryItem[]>([]);
  const [initialScrollY, setInitialScrollY] = useState<number>(0);

  // Load recitation history on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('quran_recitation_history');
      if (stored) {
        setRecentRecitations(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading recitation history:', e);
    }
  }, []);

  // Save recitation progress callback without triggering state updates during reading
  const handleSaveRecitationProgress = (type: 'surah' | 'para', id: number, scrollY: number) => {
    const name = type === 'surah' ? getSurahName(id) : `Juz ${id}`;
    const arabicName = type === 'surah' ? getSurahNameArabic(id) : getParaNameArabic(id);

    try {
      const stored = localStorage.getItem('quran_recitation_history');
      let currentHistory: RecitationHistoryItem[] = [];
      if (stored) {
        currentHistory = JSON.parse(stored);
      }
      const filtered = currentHistory.filter(item => !(item.type === type && item.id === id));
      const newItem: RecitationHistoryItem = {
        type,
        id,
        name,
        arabicName,
        scrollY,
        timestamp: Date.now()
      };
      const updated = [newItem, ...filtered].slice(0, 3);
      localStorage.setItem('quran_recitation_history', JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving progress to localStorage:', e);
    }
  };

  const handleSelectSurah = (surahNum: number) => {
    const saved = recentRecitations.find(item => item.type === 'surah' && item.id === surahNum);
    setInitialScrollY(saved ? saved.scrollY : 0);
    setSelectedSurah(surahNum);
    setQuranView('surah');
  };

  const handleSelectPara = (paraNum: number) => {
    const saved = recentRecitations.find(item => item.type === 'para' && item.id === paraNum);
    setInitialScrollY(saved ? saved.scrollY : 0);
    setSelectedPara(paraNum);
    setQuranView('para');
  };

  const handleResumeRecitation = (type: 'surah' | 'para', id: number) => {
    const saved = recentRecitations.find(item => item.type === type && item.id === id);
    setInitialScrollY(saved ? saved.scrollY : 0);
    if (type === 'surah') {
      setSelectedSurah(id);
      setSelectedPara(null);
      setQuranView('surah');
    } else {
      setSelectedPara(id);
      setSelectedSurah(null);
      setQuranView('para');
    }
    setActiveTab('quran');
  };

  // Scroll to top of the window on tab or view changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as any });
  }, [activeTab, quranView]);

  // Load more functions
  const loadMoreWords = async () => {
    if (!hasMoreWords || loadingWords) return;
    setLoadingWords(true);
    try {
      const nextPage = wordsPage + 1;
      setWordsPage(nextPage);
    } finally {
      setLoadingWords(false);
    }
  };

  const loadMorePhrases = async () => {
    if (!hasMorePhrases || loadingPhrases) return;
    setLoadingPhrases(true);
    try {
      const nextPage = phrasesPage + 1;
      const result = await loadMurakkabat(nextPage);
      setPhrases(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newPhrases = (result.murakkabat || []).filter(p => !existingIds.has(p.id));
        return [...prev, ...newPhrases];
      });
      setPhrasesPage(nextPage);
      setHasMorePhrases(result.hasMore ?? false);
    } catch (e) {
      console.error('Error loading more phrases:', e);
    } finally {
      setLoadingPhrases(false);
    }
  };

  const loadMoreAyahs = async () => {
    if (!hasMoreAyahs || !initialLoadComplete || loadingAyahs) return;
    setLoadingAyahs(true);
    try {
      const nextSurah = currentSurah + 1;
      console.log('Loading more ayahs - next surah:', nextSurah, 'current surah:', currentSurah);
      const result = await loadAyahsBySurahRange(nextSurah, nextSurah);
      console.log('Loaded surah', nextSurah, ':', result.ayahs.length, 'ayahs');
      
      if (result.ayahs.length > 0) {
        setAyahs(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newAyahs = (result.ayahs || []).filter(a => !existingIds.has(a.id));
          return [...prev, ...newAyahs];
        });
        setCurrentSurah(nextSurah);
        setLoadedSurahs(prev => new Set([...prev, nextSurah]));
        setHasMoreAyahs(result.hasMore ?? false);
      } else {
        setHasMoreAyahs(false);
      }
    } catch (e) {
      console.error('Error loading more ayahs:', e);
    } finally {
      setLoadingAyahs(false);
    }
  };

  // Combined: Load real data immediately AND restore user progress from localStorage
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Load full vocabulary corpus and initial phrases
        const [allWordsData, phrasesResult, ayahsResult] = await Promise.all([
          loadAllWords(),
          loadMurakkabat(),
          loadAyahsBySurahRange(1, 1)
        ]);

        const wordsData = allWordsData || [];
        const phrasesData = phrasesResult.murakkabat || [];
        const ayahsData = ayahsResult.ayahs || [];

        if (wordsData.length > 0) setWords(wordsData);
        if (phrasesData.length > 0) setPhrases(phrasesData);
        if (ayahsData.length > 0) setAyahs(ayahsData);

        setHasMoreWords(wordsData.length > 100);
        setHasMorePhrases(phrasesResult.hasMore ?? false);
        setHasMoreAyahs(ayahsResult.hasMore ?? false);

        setInitialLoadComplete(true);

        // THEN: Overlay user's saved progress (learning state, favorites, etc.)
        try {
          const savedData = localStorage.getItem('quran_vocab_progress_v2');
          if (savedData) {
            const parsed = JSON.parse(savedData);
            
            // Merge saved progress with real data
            if (parsed.words && Array.isArray(parsed.words)) {
              const savedMap = new Map(parsed.words.map((w: Word) => [w.id, w.learnedState as LearnedState]));
              wordsData.forEach(word => {
                if (savedMap.has(word.id)) {
                  word.learnedState = savedMap.get(word.id) as LearnedState;
                }
              });
              setWords([...wordsData]);
            }

            if (parsed.phrases && Array.isArray(parsed.phrases)) {
              const savedMap = new Map(parsed.phrases.map((p: Murakkab) => [p.id, p.learnedState as LearnedState]));
              phrasesData.forEach(phrase => {
                if (savedMap.has(phrase.id)) {
                  phrase.learnedState = savedMap.get(phrase.id) as LearnedState;
                }
              });
              setPhrases([...phrasesData]);
            }

            if (parsed.ayahs && Array.isArray(parsed.ayahs)) {
              const savedMap = new Map(parsed.ayahs.map((a: Ayah) => [a.id, a.learnedState as LearnedState]));
              ayahsData.forEach(ayah => {
                if (savedMap.has(ayah.id)) {
                  ayah.learnedState = savedMap.get(ayah.id) as LearnedState;
                }
              });
              setAyahs([...ayahsData]);
            }
            
            // Restore settings
            if (parsed.language) setLanguage(parsed.language);
            if (parsed.arabicSize) setArabicSize(parsed.arabicSize);
            if (parsed.showGoldLines !== undefined) setShowGoldLines(parsed.showGoldLines);
            
            console.log('✓ Restored user progress from localStorage');
          }
        } catch (e) {
          console.error('Error merging saved progress', e);
        }
      } catch (error) {
        console.error('Error initializing vocabulary data:', error);
      }
    };

    initializeData();
  }, []);

  // Save changes to localStorage helper (persisting only modified items + settings to stay well within storage quota)
  const saveToStorage = (updatedWords: Word[], updatedPhrases: Murakkab[], updatedAyahs: Ayah[]) => {
    try {
      const progressWords = updatedWords
        .filter(w => w.learnedState !== 'new')
        .map(w => ({ id: w.id, learnedState: w.learnedState }));
      const progressPhrases = updatedPhrases
        .filter(p => p.learnedState !== 'new')
        .map(p => ({ id: p.id, learnedState: p.learnedState }));
      const progressAyahs = updatedAyahs
        .filter(a => a.learnedState !== 'new')
        .map(a => ({ id: a.id, surah: a.surah, learnedState: a.learnedState, revelationPeriod: a.revelationPeriod }));

      const blob = {
        words: progressWords,
        phrases: progressPhrases,
        ayahs: progressAyahs,
        language,
        arabicSize,
        showGoldLines
      };
      localStorage.setItem('quran_vocab_progress_v2', JSON.stringify(blob));
    } catch (e) {
      console.error('Error saving progress data', e);
    }
  };

  // Load any Surah on demand when selected in AyahList
  const handleSelectSurahInAyahs = async (surahNum: number) => {
    if (loadedSurahs.has(surahNum)) {
      setCurrentSurah(surahNum);
      return;
    }
    setLoadingAyahs(true);
    try {
      const result = await loadAyahsBySurahRange(surahNum, surahNum);
      if (result.ayahs.length > 0) {
        // Apply any saved progress from localStorage
        let savedMap = new Map<string, LearnedState>();
        try {
          const savedData = localStorage.getItem('quran_vocab_progress_v2');
          if (savedData) {
            const parsed = JSON.parse(savedData);
            if (parsed.ayahs && Array.isArray(parsed.ayahs)) {
              savedMap = new Map(parsed.ayahs.map((a: any) => [a.id, a.learnedState as LearnedState]));
            }
          }
        } catch (e) {}

        const enrichedNewAyahs = result.ayahs.map(a =>
          savedMap.has(a.id) ? { ...a, learnedState: savedMap.get(a.id)! } : a
        );

        setAyahs(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const toAdd = enrichedNewAyahs.filter(a => !existingIds.has(a.id));
          return [...prev, ...toAdd].sort((a, b) => a.surah - b.surah || a.ayahNum - b.ayahNum);
        });
        setLoadedSurahs(prev => new Set([...prev, surahNum]));
        setCurrentSurah(surahNum);
      }
    } catch (e) {
      console.error('Error loading selected surah ayahs:', e);
    } finally {
      setLoadingAyahs(false);
    }
  };

  // Immediate toggle state changer
  const handleToggleState = (id: string, type: 'word' | 'phrase' | 'ayah', newState: LearnedState) => {
    let oldState: LearnedState = 'new';
    let actionLabel = '';

    if (type === 'word') {
      const updatedWords = words.map(w => {
        if (w.id === id) {
          oldState = w.learnedState;
          actionLabel = `Word "${w.transliteration}" changed to ${newState}`;
          return { ...w, learnedState: newState };
        }
        return w;
      });
      setWords(updatedWords);
      saveToStorage(updatedWords, phrases, ayahs);
    } else if (type === 'phrase') {
      const updatedPhrases = phrases.map(p => {
        if (p.id === id) {
          oldState = p.learnedState;
          actionLabel = `Phrase changed to ${newState}`;
          return { ...p, learnedState: newState };
        }
        return p;
      });
      setPhrases(updatedPhrases);
      saveToStorage(words, updatedPhrases, ayahs);
    } else {
      const updatedAyahs = ayahs.map(a => {
        if (a.id === id) {
          oldState = a.learnedState;
          actionLabel = `Verse lesson marked ${newState}`;
          return { ...a, learnedState: newState };
        }
        return a;
      });
      setAyahs(updatedAyahs);
      saveToStorage(words, phrases, updatedAyahs);
    }

    // Set up Undo notification state
    setUndoStack(prev => [{ id, type, prevState: oldState }, ...prev]);
    setLastActionDesc(actionLabel);
    setShowUndoToast(true);

    // Auto dismiss after 6 seconds
    const timer = setTimeout(() => {
      setShowUndoToast(false);
    }, 6000);
    return () => clearTimeout(timer);
  };

  // Revert action mechanism
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const lastAction = undoStack[0];
    
    if (lastAction.type === 'word') {
      const restored = words.map(w => w.id === lastAction.id ? { ...w, learnedState: lastAction.prevState } : w);
      setWords(restored);
      saveToStorage(restored, phrases, ayahs);
    } else if (lastAction.type === 'phrase') {
      const restored = phrases.map(p => p.id === lastAction.id ? { ...p, learnedState: lastAction.prevState } : p);
      setPhrases(restored);
      saveToStorage(words, restored, ayahs);
    } else {
      const restored = ayahs.map(a => a.id === lastAction.id ? { ...a, learnedState: lastAction.prevState } : a);
      setAyahs(restored);
      saveToStorage(words, phrases, restored);
    }

    setUndoStack(prev => prev.slice(1));
    setShowUndoToast(false);
  };

  // Reset entire study portfolio back to scratch
  const handleResetProgress = () => {
    const freshWords = words.map(w => ({ ...w, learnedState: 'new' as LearnedState }));
    const freshPhrases = phrases.map(p => ({ ...p, learnedState: 'new' as LearnedState }));
    const freshAyahs = ayahs.map(a => ({ ...a, learnedState: 'new' as LearnedState }));
    setWords(freshWords);
    setPhrases(freshPhrases);
    setAyahs(freshAyahs);
    saveToStorage(freshWords, freshPhrases, freshAyahs);
  };

  // Language translator lookup utility
  const translate = (key: string): string => {
    return LANGUAGES[language]?.translations[key] || LANGUAGES['en'].translations[key] || key;
  };

  // Determine direction (RTL/LTR) auto-switching based on language selection
  const isRtl = LANGUAGES[language]?.direction === 'rtl';

  // Reset scroll position when switching tabs
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  // Apply filters logic (Within group = OR | Between group = AND)
  const getFilteredWords = () => {
    const queryMatchedIds = filterState.searchQuery
      ? new Set(searchWords(words, filterState.searchQuery, language).map(w => w.id))
      : null;

    return words.filter(word => {
      // 1. Search Query lookup (uses morphological tokenization & grammatical filtering by root, baab, and wazan)
      if (queryMatchedIds && !queryMatchedIds.has(word.id)) {
        return false;
      }

      // 2. Vocabulary core scopes
      if (filterState.selectedCore === 'core' && !word.isCore) return false;
      if (filterState.selectedCore === 'non-core' && word.isCore) return false;

      // 3. Filter by Surah (OR logic inside category)
      if (filterState.selectedSurahs.length > 0) {
        const matchesSurah = word.occurrences.some(occ => filterState.selectedSurahs.includes(occ.surah));
        if (!matchesSurah) return false;
      }

      // 4. Themes Taxonomy (OR logic inside category)
      if (filterState.selectedThemes.length > 0) {
        const matchesTheme = word.themes.some(themeId => filterState.selectedThemes.includes(themeId));
        if (!matchesTheme) return false;
      }

      // 5. Part of Speech / Grammar (OR logic)
      if (filterState.selectedPOS.length > 0) {
        if (!filterState.selectedPOS.includes(word.pos)) return false;
      }

      // 5b. Sarf: Baab / Verbal Form filter
      if (filterState.selectedBaab && filterState.selectedBaab.length > 0) {
        const wordBaabNum =
          word.baabNumber ||
          (typeof word.baab === 'number' ? word.baab : Number(word.baab)) ||
          parseCorpusMorphTag(word.baab).baabNumber;
        if (!wordBaabNum || !filterState.selectedBaab.includes(Number(wordBaabNum))) return false;
      }

      // 5c. Sarf: Root (الجذر) filter
      if (filterState.rootQuery && filterState.rootQuery.trim()) {
        const targetRoot = normalizeRootString(filterState.rootQuery).replace(/-/g, '');
        const wordRoot = normalizeRootString(word.root).replace(/-/g, '');
        if (!targetRoot || !wordRoot || !wordRoot.includes(targetRoot)) return false;
      }

      // 6. Mastery States (OR logic)
      if (filterState.selectedProgress.length > 0) {
        if (!filterState.selectedProgress.includes(word.learnedState)) return false;
      }

      return true;
    }).sort((a, b) => {
      // 7. Sort configurations
      if (filterState.sortBy === 'frequency-desc') return b.frequency - a.frequency;
      if (filterState.sortBy === 'frequency-asc') return a.frequency - b.frequency;
      if (filterState.sortBy === 'id-asc') return a.id.localeCompare(b.id, undefined, { numeric: true });
      if (filterState.sortBy === 'alphabetic-arabic') return (a.arabic || '').localeCompare(b.arabic || '', 'ar');
      return 0;
    });
  };

  const allFilteredWords = getFilteredWords();
  const paginatedWordsCount = (wordsPage + 1) * 100;
  const filteredWords = allFilteredWords.slice(0, paginatedWordsCount);
  const canLoadMoreWords = paginatedWordsCount < allFilteredWords.length;

  // Filter phrases based on search query
  const filteredPhrases = phraseSearchQuery 
    ? searchPhrases(phrases, phraseSearchQuery, language)
    : phrases;

  // Filter ayahs based on search query
  const filteredAyahs = ayahSearchQuery
    ? searchAyahs(ayahs, ayahSearchQuery, language)
    : ayahs;

  // Navigation Items Tab configs
  const navigationTabs = [
    { id: 'dashboard', label: translate('tab.dashboard'), icon: Home },
    { id: 'quran', label: 'Quran', icon: Book },
    { id: 'words', label: translate('tab.words'), icon: BookOpen },
    { id: 'phrases', label: translate('tab.phrases'), icon: Sparkles },
    { id: 'ayahs', label: translate('tab.ayahs'), icon: GraduationCap },
    { id: 'analytics', label: translate('tab.analytics'), icon: BarChart3 },
    { id: 'settings', label: translate('tab.settings'), icon: Settings }
  ];

  const isReadingView = activeTab === 'quran' && (quranView === 'surah' || quranView === 'para');

  if (isReadingView) {
    return (
      <div 
        className="h-screen h-[100dvh] bg-[#FAF6F1] font-sans text-[#3E2723] flex flex-col overflow-hidden"
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{
          fontSize: arabicSize === 'normal' ? '16px' : arabicSize === 'large' ? '18px' : '20px'
        }}
      >
        {showGoldLines && <IslamicSymmetryBorders />}
        {quranView === 'surah' && (
          <QuranReading
            surah={selectedSurah}
            para={null}
            onBack={() => {
              setQuranView(null);
              setSelectedSurah(null);
              // Refresh recent recitations state when going back
              try {
                const stored = localStorage.getItem('quran_recitation_history');
                if (stored) {
                  setRecentRecitations(JSON.parse(stored));
                }
              } catch (e) {
                console.error(e);
              }
            }}
            translate={translate}
            isRtl={isRtl}
            lang={language}
            initialScrollY={initialScrollY}
            onSaveProgress={handleSaveRecitationProgress}
            onSwitchRecitation={(type, id) => handleResumeRecitation(type, id)}
            words={words}
            onToggleState={handleToggleState}
          />
        )}
        {quranView === 'para' && (
          <QuranReading
            surah={null}
            para={selectedPara}
            onBack={() => {
              setQuranView(null);
              setSelectedPara(null);
              // Refresh recent recitations state when going back
              try {
                const stored = localStorage.getItem('quran_recitation_history');
                if (stored) {
                  setRecentRecitations(JSON.parse(stored));
                }
              } catch (e) {
                console.error(e);
              }
            }}
            translate={translate}
            isRtl={isRtl}
            lang={language}
            initialScrollY={initialScrollY}
            onSaveProgress={handleSaveRecitationProgress}
            onSwitchRecitation={(type, id) => handleResumeRecitation(type, id)}
            words={words}
            onToggleState={handleToggleState}
          />
        )}
      </div>
    );
  }

  return (
    <div 
      className={`min-h-screen bg-[#FAF6F1] font-sans text-[#3E2723] transition-all pb-24 selection:bg-[#D4A574]/40 flex flex-col`}
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        fontSize: arabicSize === 'normal' ? '16px' : arabicSize === 'large' ? '18px' : '20px'
      }}
    >
      {/* Dynamic Gold Heritage border line if enabled */}
      {showGoldLines && <IslamicSymmetryBorders />}

      {/* Styled Responsive Navigation Top bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-[#E8DCC8] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 bg-[#FAF6F1] border border-[#E8DCC8] rounded-full flex items-center justify-center text-[#8B3A3A] shadow-sm shrink-0">
              <IslamicStar className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-[#3E2723] tracking-tight font-serif-eng block text-xs sm:text-sm">
                Bayan Al-Quran
              </span>
              <span className="text-[10px] text-[#795548] font-serif-eng italic leading-none block">
                {translate('app.title')}
              </span>
            </div>
          </div>

          {/* Large Screen Navigation Menu */}
          <nav className="hidden lg:flex items-center space-x-1 space-x-reverse">
            {navigationTabs.map(tab => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 rounded text-xs font-bold font-serif-eng transition-colors flex items-center gap-1.5 ${
                    isActive 
                      ? 'bg-[#8B3A3A] text-white shadow-xs' 
                      : 'text-[#795548] hover:bg-[#FAF6F1]'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Header Right spacer */}
          <div className="text-right flex items-center gap-2"></div>

        </div>
      </header>

      {/* Main viewport canvas */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-grow w-full">
        <div className="bg-white/40 rounded-xl p-3 sm:p-6 shadow-xs border border-[#E8DCC8]/50 min-h-[500px]">
          {activeTab === 'dashboard' && (
            <Dashboard 
              words={words} 
              phrases={phrases} 
              ayahs={ayahs} 
              onToggleState={handleToggleState}
              onNavigate={setActiveTab}
              translate={translate}
              isRtl={isRtl}
              language={language}
              recentRecitations={recentRecitations}
              onContinueRecitation={handleResumeRecitation}
            />
          )}

          {activeTab === 'quran' && quranView === null && (
            <QuranRecitation
              onBack={() => setActiveTab('dashboard')}
              onSurahClick={handleSelectSurah}
              onParaClick={handleSelectPara}
              translate={translate}
              isRtl={isRtl}
              recentRecitations={recentRecitations}
            />
          )}

          {activeTab === 'quran' && quranView === 'surah' && (
            <QuranReading
              surah={selectedSurah}
              para={null}
              onBack={() => {
                setQuranView(null);
                setSelectedSurah(null);
                // Refresh recent recitations state when going back
                try {
                  const stored = localStorage.getItem('quran_recitation_history');
                  if (stored) {
                    setRecentRecitations(JSON.parse(stored));
                  }
                } catch (e) {
                  console.error(e);
                }
              }}
              translate={translate}
              isRtl={isRtl}
              lang={language}
              initialScrollY={initialScrollY}
              onSaveProgress={handleSaveRecitationProgress}
              onSwitchRecitation={(type, id) => handleResumeRecitation(type, id)}
              words={words}
              onToggleState={handleToggleState}
            />
          )}

          {activeTab === 'quran' && quranView === 'para' && (
            <QuranReading
              surah={null}
              para={selectedPara}
              onBack={() => {
                setQuranView(null);
                setSelectedPara(null);
                // Refresh recent recitations state when going back
                try {
                  const stored = localStorage.getItem('quran_recitation_history');
                  if (stored) {
                    setRecentRecitations(JSON.parse(stored));
                  }
                } catch (e) {
                  console.error(e);
                }
              }}
              translate={translate}
              isRtl={isRtl}
              lang={language}
              initialScrollY={initialScrollY}
              onSaveProgress={handleSaveRecitationProgress}
              onSwitchRecitation={(type, id) => handleResumeRecitation(type, id)}
              words={words}
              onToggleState={handleToggleState}
            />
          )}

          {activeTab === 'words' && (
            <WordList
              words={filteredWords}
              allWords={words}
              filterState={filterState}
              onToggleState={handleToggleState}
              onOpenFilters={() => setIsFiltersOpen(true)}
              onSearchChange={(query) => {
                setWordsPage(0);
                setFilterState(prev => ({ ...prev, searchQuery: query }));
              }}
              lang={language}
              isRtl={isRtl}
              translate={translate}
              hasMore={canLoadMoreWords}
              onLoadMore={loadMoreWords}
            />
          )}

          {activeTab === 'phrases' && (
            <PhraseList 
              phrases={filteredPhrases}
              onToggleState={handleToggleState}
              onSearchChange={setPhraseSearchQuery}
              searchQuery={phraseSearchQuery}
              lang={language}
              isRtl={isRtl}
              translate={translate}
              hasMore={hasMorePhrases}
              onLoadMore={loadMorePhrases}
            />
          )}

          {activeTab === 'ayahs' && (
            <AyahList 
              ayahs={filteredAyahs}
              words={words}
              allWords={words}
              onToggleState={handleToggleState}
              onSearchChange={setAyahSearchQuery}
              searchQuery={ayahSearchQuery}
              lang={language}
              isRtl={isRtl}
              translate={translate}
              hasMore={hasMoreAyahs}
              onLoadMore={loadMoreAyahs}
              selectedSurah={currentSurah}
              onSelectSurah={handleSelectSurahInAyahs}
            />
          )}

          {activeTab === 'analytics' && (
            <ProgressStats 
              words={words} 
              phrases={phrases} 
              ayahs={ayahs} 
              translate={translate}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPanel 
              currentLang={language}
              onChangeLang={setLanguage}
              arabicSize={arabicSize}
              onChangeSize={setArabicSize}
              showGoldLines={showGoldLines}
              onToggleGoldLines={() => setShowGoldLines(!showGoldLines)}
              onResetProgress={handleResetProgress}
              translate={translate}
            />
          )}
        </div>
      </main>

      {/* Gold bottom section ornament */}
      {showGoldLines && (
        <div className="mt-auto pt-6">
          <GoldDivider />
        </div>
      )}

      {/* Dynamic Slideout Filters Overlay Panel */}
      <FilterPanel 
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        filterState={filterState}
        onApplyFilters={setFilterState}
        translate={translate}
        isRtl={isRtl}
      />

      {/* Mobile Sticky Tab bar floating on bottom */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E8DCC8] shadow-lg flex justify-around py-2">
        {navigationTabs.map(tab => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center p-1 font-serif-eng tracking-tight ${
                isActive ? 'text-[#8B3A3A] scale-105 font-bold' : 'text-[#795548] hover:text-stone-900'
              }`}
            >
              <TabIcon className="w-5 h-5 mb-0.5" />
              <span className="text-[9px] font-semibold">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Premium Undo toast Notification banner with elastic trigger */}
      {showUndoToast && (
        <div className="fixed bottom-16 sm:bottom-6 right-4 left-4 sm:left-auto sm:w-96 z-50 bg-[#3E2723] text-[#FAF6F1] border border-[#D4A574]/50 rounded-lg p-3 shadow-xl flex items-center justify-between gap-3 animate-slideUp">
          <div className="flex items-center gap-2">
            <span className="text-[#D4A574] text-xs">◆</span>
            <div className="text-left">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#D4A574]">Progress Saved</p>
              <p className="text-xs font-serif-eng text-neutral-200 mt-0.5">{lastActionDesc}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button 
              onClick={handleUndo}
              className="bg-white/10 hover:bg-white/20 text-[#FAF6F1] font-bold text-[10px] uppercase tracking-wider py-1.5 px-3 rounded flex items-center gap-1 transition-all"
            >
              <Undo2 className="w-3 h-3" />
              {translate('btn.undo')}
            </button>
            <button 
              onClick={() => setShowUndoToast(false)}
              className="text-stone-400 hover:text-white p-1 rounded"
              title="Close Notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
