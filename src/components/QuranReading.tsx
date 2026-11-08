/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Settings, 
  Eye, 
  EyeOff, 
  Headphones, 
  ChevronsDown,
  Download,
  Trash2,
  Loader2,
  Check,
  History,
  BookOpen,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  X 
} from 'lucide-react';
import { Word, LearnedState, LanguageCode } from '../types';
import { DUMMY_AYAHS } from '../data/quranData';
import { AudioPlayer, ReciterInfo, SegmentTuple } from './AudioPlayer';
import { recitationDownloader, DownloadState } from '../lib/recitationDownloader';
import { normalizeArabicText, isWholeArabicWordMatch, getRootFamilyWords } from '../lib/quranUtils';
import { tokenizeArabicMorphology } from '../lib/arabicMorphology';
import { transliterateArabicToEnglish } from '../lib/buckwalterConverter';

export const RECITERS: ReciterInfo[] = [
  { id: 'alafasy', name: 'Mishary Alafasy', subfolder: 'Alafasy_128kbps', bitrate: '128kbps', hasTimingData: true },
  { id: 'sudais', name: 'Abdur-Rahman As-Sudais', subfolder: 'Abdurrahmaan_As-Sudais_192kbps', bitrate: '192kbps', hasTimingData: true },
  { id: 'husary', name: 'Mahmoud Al-Husary', subfolder: 'Husary_128kbps', bitrate: '128kbps', hasTimingData: true },
  { id: 'ghamdi', name: 'Saad Al-Ghamdi', subfolder: 'Saad_Al-Ghamdi_128kbps', bitrate: '128kbps', hasTimingData: true },
  { id: 'abdulbasit', name: 'Abdul Basit (Mujawwad)', subfolder: 'Abdul_Basit_Mujawwad_128kbps', bitrate: '128kbps', hasTimingData: true },
  { id: 'muaiqly', name: 'Maher Al-Muaiqly', subfolder: 'Maher_AlMuaiqly_64kbps', bitrate: '64kbps', hasTimingData: true }
];

const SURAH_VERSE_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
  123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
  34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
  60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
  28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
  15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
  5, 4, 5, 6
];

const getGlobalAyahIndex = (surahNum: number, ayahNum: number): number => {
  let index = 0;
  for (let i = 0; i < surahNum - 1; i++) {
    index += SURAH_VERSE_COUNTS[i];
  }
  return index + ayahNum;
};

const getAlquranEditionId = (reciterId: string): string => {
  const mapping: Record<string, string> = {
    alafasy: 'ar.alafasy',
    sudais: 'ar.sudais',
    husary: 'ar.husary',
    ghamdi: 'ar.saadghamdi',
    abdulbasit: 'ar.abdulbasitmujawwad',
    muaiqly: 'ar.maheralmuaiqly',
  };
  return mapping[reciterId] || 'ar.alafasy';
};

interface QuranReadingProps {
  surah: number | null;
  para: number | null;
  onBack: () => void;
  translate: (key: string) => string;
  isRtl: boolean;
  lang: string;
  initialScrollY?: number;
  onSaveProgress?: (type: 'surah' | 'para', id: number, scrollY: number) => void;
  onSwitchRecitation?: (type: 'surah' | 'para', id: number) => void;
  words?: Word[];
  onToggleState?: (id: string, type: 'word' | 'phrase' | 'ayah', newState: LearnedState) => void;
}

interface QuranVerse {
  verse_key: string;
  verse_number: number;
  chapter_id: number;
  text_uthmani: string;
  text_imlaei: string;
}

const getAlquranEdition = (lang: string) => {
  const editions: Record<string, string> = {
    en: 'en.sahih',       // Sahih International
    ur: 'ur.maududi',     // Maududi
    tr: 'tr.ozturk',      // Ozturk
    id: 'id.indonesian',  // Indonesian
    bn: 'bn.bengali',     // Bengali
    es: 'es.asad',        // Asad
    fr: 'fr.hamidullah',  // Hamidullah
    ru: 'ru.kuliev',      // Kuliev
    sv: 'sv.bernstrom',   // Bernstrom
    zh: 'zh.jian'         // Chinese
  };
  return editions[lang] || 'en.sahih';
};

const isLangRtl = (langCode: string): boolean => {
  return ['ur', 'ps', 'ar', 'fa', 'he'].includes(langCode);
};

async function fetchWithFallback(url: string): Promise<Response> {
  // Try direct fetch first
  try {
    const response = await fetch(url);
    if (response.ok) return response;
  } catch (e) {
    console.warn(`Direct fetch failed for ${url}:`, e);
  }

  // If url starts with '/', try relative path (without leading slash)
  if (url.startsWith('/')) {
    try {
      const relativeUrl = url.slice(1);
      const response = await fetch(relativeUrl);
      if (response.ok) return response;
    } catch (e) {
      console.warn(`Relative fetch failed for ${url}:`, e);
    }
  }

  // Try appending window.location.origin + pathname subpath
  try {
    const basePath = window.location.pathname.replace(/\/[^\/]*$/, '');
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    const subpathUrl = `${window.location.origin}${basePath}${cleanUrl}`;
    const response = await fetch(subpathUrl);
    if (response.ok) return response;
  } catch (e) {
    console.warn(`Subpath fetch failed for ${url}:`, e);
  }

  // Final direct attempt to throw the actual error if all fallbacks failed
  return fetch(url);
}

// Fallback translation helper for demo verses
function getFallbackTranslation(chapterId: number, verseNum: number, langCode: string): string {
  const dummy = DUMMY_AYAHS.find(a => Number(a.surah) === Number(chapterId) && Number(a.ayahNum) === Number(verseNum));
  if (dummy) {
    const list = dummy.translations[langCode as any] || dummy.translations.en;
    if (list && list.length > 0) {
      return list[0].text;
    }
  }
  return '';
}

// Export Tajweed and text normalization helpers from quranUtils
export { applyIdghamShaddah, normalizeArabicText } from '../lib/quranUtils';


interface AyahEndIconProps {
  verseNumber: number;
  isActive: boolean;
  fontSize: number;
}

export function AyahEndIcon({ verseNumber, isActive, fontSize }: AyahEndIconProps) {
  const outerStarStroke = isActive ? '#D4A574' : '#C49A6C'; // Luxurious gold / warm bronze
  const rectRotatedStroke = isActive ? '#FAF6F1' : '#A17A4E';
  const innerCircleFill = isActive ? '#8B3A3A' : '#FAF6F1'; // Crimson active, Soft cream inactive
  const innerCircleStroke = isActive ? '#D4A574' : '#8B3A3A'; // Gold stroke active, Deep red inactive
  const textColor = isActive ? '#FFFFFF' : '#8B3A3A'; // White active, Deep red inactive
  const dotColor = isActive ? '#D4A574' : '#8B3A3A';

  return (
    <span 
      className="inline-block select-none mx-2 relative transition-all duration-300"
      style={{
        width: '1.25em',
        height: '1.25em',
        verticalAlign: '-0.2em',
        lineHeight: '1',
      }}
    >
      <svg 
        viewBox="0 0 36 36" 
        width="100%" 
        height="100%" 
        className={`w-full h-full transition-all duration-300 transform hover:scale-110 ${
          isActive ? 'drop-shadow-[0_0_5px_rgba(212,165,116,0.85)] scale-105' : 'drop-shadow-sm'
        }`}
      >
        {/* Star Points - Overlapping Squares (Rub El Hizb style) */}
        <g transform="translate(18, 18)" className="transition-all duration-300">
          <rect 
            x="-11.5" 
            y="-11.5" 
            width="23" 
            height="23" 
            fill={isActive ? '#9D4B4B' : 'none'} 
            stroke={outerStarStroke} 
            strokeWidth="1.3" 
            rx="3" 
            className="transition-all duration-300"
          />
          <rect 
            x="-11.5" 
            y="-11.5" 
            width="23" 
            height="23" 
            fill={isActive ? '#9D4B4B' : 'none'} 
            stroke={rectRotatedStroke} 
            strokeWidth="1.3" 
            rx="3" 
            transform="rotate(45)" 
            className="transition-all duration-300"
          />
        </g>

        {/* Ornate Corner Dots (8-pointed geometric details) */}
        <circle cx="18" cy="3.5" r="1.3" fill={dotColor} className="transition-all duration-300" />
        <circle cx="18" cy="32.5" r="1.3" fill={dotColor} className="transition-all duration-300" />
        <circle cx="3.5" cy="18" r="1.3" fill={dotColor} className="transition-all duration-300" />
        <circle cx="32.5" cy="18" r="1.3" fill={dotColor} className="transition-all duration-300" />
        <circle cx="7.75" cy="7.75" r="1.3" fill={dotColor} className="transition-all duration-300" />
        <circle cx="28.25" cy="7.75" r="1.3" fill={dotColor} className="transition-all duration-300" />
        <circle cx="7.75" cy="28.25" r="1.3" fill={dotColor} className="transition-all duration-300" />
        <circle cx="28.25" cy="28.25" r="1.3" fill={dotColor} className="transition-all duration-300" />

        {/* Inner Circle Frame */}
        <circle 
          cx="18" 
          cy="18" 
          r="9.5" 
          fill={innerCircleFill} 
          stroke={innerCircleStroke} 
          strokeWidth="1.3" 
          className="transition-all duration-300" 
        />

        {/* Inner concentric ring for fine luxury aesthetic */}
        <circle 
          cx="18" 
          cy="18" 
          r="7.8" 
          fill="none" 
          stroke={isActive ? '#FAF6F1' : '#D4A574'} 
          strokeWidth="0.7" 
          strokeDasharray="1.2,1.2" 
          className="opacity-90 transition-all duration-300"
        />

        {/* Ayah Number */}
        <text 
          x="50%" 
          y="50%" 
          dominantBaseline="central" 
          textAnchor="middle" 
          fill={textColor}
          fontWeight="bold"
          className="font-mono transition-all duration-300"
          style={{
            fontSize: verseNumber >= 100 ? '7.5px' : verseNumber >= 10 ? '9px' : '10.5px',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}
        >
          {verseNumber}
        </text>
      </svg>
    </span>
  );
}

export function QuranReading({
  surah,
  para,
  onBack,
  translate,
  isRtl,
  lang,
  initialScrollY = 0,
  onSaveProgress,
  onSwitchRecitation,
  words = [],
  onToggleState
}: QuranReadingProps) {
  const [verses, setVerses] = useState<QuranVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [inspectMode, setInspectMode] = useState<boolean>(true);
  const [inspectedWordInfo, setInspectedWordInfo] = useState<{
    surfaceWord: string;
    verseKey: string;
    chapterId: number;
    verseNumber: number;
    matchedWord: Word | null;
    profile: ReturnType<typeof tokenizeArabicMorphology>;
    rootFamily: Word[];
  } | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [arabicFontSize, setArabicFontSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('quran_arabic_font_size');
      return saved ? Number(saved) : 32;
    } catch (e) {
      return 32;
    }
  });
  
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translationsLoading, setTranslationsLoading] = useState(false);

  const [selectedReciterId, setSelectedReciterId] = useState<string>(() => {
    try {
      return localStorage.getItem('quran_selected_reciter_id') || 'alafasy';
    } catch (e) {
      return 'alafasy';
    }
  });

  const [timingData, setTimingData] = useState<any[]>([]);
  const [playingVerseKey, setPlayingVerseKey] = useState<string | null>(null);
  const [playingWordIndex, setPlayingWordIndex] = useState<number | null>(null);
  const [playingWordEndIndex, setPlayingWordEndIndex] = useState<number | null>(null);

  const handleWordHighlightUpdate = React.useCallback((start: number | null, end?: number | null) => {
    setPlayingWordIndex(start);
    setPlayingWordEndIndex(end ?? null);
  }, []);
  const [playingBismillah, setPlayingBismillah] = useState<boolean>(false);
  const [recitationEnabled, setRecitationEnabled] = useState<boolean>(false);

  const handleReciterChange = (id: string) => {
    setSelectedReciterId(id);
    try {
      localStorage.setItem('quran_selected_reciter_id', id);
    } catch (e) {}
  };

  const toggleRecitation = () => {
    const newValue = !recitationEnabled;
    setRecitationEnabled(newValue);
    try {
      localStorage.setItem('quran_recitation_enabled', String(newValue));
    } catch (e) {}
    if (!newValue) {
      setPlayingVerseKey(null);
      setPlayingWordIndex(null);
      setPlayingWordEndIndex(null);
      setPlayingBismillah(false);
    } else {
      // If we are enabling it, and there's no playing verse, automatically start playing the first verse!
      if (!playingVerseKey && verses.length > 0) {
        const firstVerseKey = verses[0].verse_key;
        const [sNum, aNum] = firstVerseKey.split(':').map(Number);
        if (sNum !== 1 && sNum !== 9 && aNum === 1) {
          setPlayingBismillah(true);
        } else {
          setPlayingBismillah(false);
        }
        setPlayingVerseKey(firstVerseKey);
        setPlayingWordIndex(null);
        setPlayingWordEndIndex(null);
      }
    }
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('quran_recitation_sidebar_open') !== 'false';
    } catch (e) {
      return true;
    }
  });

  const handleToggleSidebar = () => {
    setIsSidebarOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('quran_recitation_sidebar_open', String(next));
      } catch (e) {}
      return next;
    });
  };

  const [downloadState, setDownloadState] = useState<DownloadState>(() => recitationDownloader.getState());
  const [currentCacheStatus, setCurrentCacheStatus] = useState<{ total: number; cached: number; isCompleted: boolean }>({ total: 0, cached: 0, isCompleted: false });
  const [overallOfflineCount, setOverallOfflineCount] = useState<number>(0);
  const [recentHistory, setRecentHistory] = useState<any[]>([]);

  const activeQariName = RECITERS.find(r => r.id === selectedReciterId)?.name || 'Mishary Alafasy';
  const totalQuranAyahs = 6236;

  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      if (surah) {
        const st = await recitationDownloader.getStatusFor('surah', surah, selectedReciterId);
        if (isMounted) setCurrentCacheStatus(st);
      } else if (para) {
        const st = await recitationDownloader.getStatusFor('para', para, selectedReciterId);
        if (isMounted) setCurrentCacheStatus(st);
      }

      try {
        const cache = await caches.open('quran-audio-recitations');
        const keys = await cache.keys();
        const subfolder = RECITERS.find(r => r.id === selectedReciterId)?.subfolder || 'Alafasy_128kbps';
        let count = 0;
        for (const req of keys) {
          if (req.url.includes(`/data/${subfolder}/`)) count++;
        }
        if (isMounted) setOverallOfflineCount(count);
      } catch (e) {}
    };

    checkStatus();

    const unsubscribe = recitationDownloader.subscribe((state) => {
      if (isMounted) setDownloadState(state);
      if (state.status === 'completed' || state.status === 'idle') {
        checkStatus();
      } else {
        if (state.type === 'surah' && state.id === surah) {
          setCurrentCacheStatus({
            total: state.totalFiles,
            cached: state.downloadedCount,
            isCompleted: state.downloadedCount >= state.totalFiles && state.totalFiles > 0
          });
        } else if (state.type === 'para' && state.id === para) {
          setCurrentCacheStatus({
            total: state.totalFiles,
            cached: state.downloadedCount,
            isCompleted: state.downloadedCount >= state.totalFiles && state.totalFiles > 0
          });
        }
      }
    });

    try {
      const stored = localStorage.getItem('quran_recitation_history');
      if (stored && isMounted) {
        setRecentHistory(JSON.parse(stored));
      }
    } catch (e) {}

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [surah, para, selectedReciterId]);

  const handleDownloadCurrent = () => {
    if (surah) {
      recitationDownloader.startDownload('surah', surah, selectedReciterId, activeQariName);
    } else if (para) {
      recitationDownloader.startDownload('para', para, selectedReciterId, activeQariName);
    }
  };

  const handleDownloadQuran = () => {
    recitationDownloader.startDownload('quran', null, selectedReciterId, activeQariName);
  };

  const handleClearCache = async () => {
    setConfirmingClear(false);
    await recitationDownloader.clearCacheForQari(selectedReciterId);
    setOverallOfflineCount(0);
    setCurrentCacheStatus({ total: verses.length, cached: 0, isCompleted: false });
  };

  const handleInspectMushafWord = (surfaceWord: string, verse: QuranVerse, e: React.MouseEvent) => {
    if (!inspectMode) return;
    e.stopPropagation();

    const cleanSurface = surfaceWord.replace(/[۞۩۝]/g, '').trim();
    if (!cleanSurface) return;

    const normTarget = normalizeArabicText(cleanSurface);
    let matched: Word | null = null;

    if (words && words.length > 0) {
      // 1. Exact occurrence match in this chapter & verse
      matched = words.find(w =>
        w.occurrences?.some(occ =>
          occ.surah === verse.chapter_id &&
          occ.ayah === verse.verse_number &&
          normalizeArabicText(occ.wordText || w.arabic) === normTarget
        )
      ) || null;

      // 2. Direct normalized surface match
      if (!matched) {
        matched = words.find(w => normalizeArabicText(w.arabic) === normTarget) || null;
      }

      // 3. Morphological token match
      if (!matched) {
        matched = words.find(w =>
          isWholeArabicWordMatch(cleanSurface, w.arabic, true, {
            expectedRoot: w.root,
            expectedLemma: w.lemma,
            expectedBaab: w.baab,
            expectedWazan: w.wazan,
            expectedPos: w.pos
          })
        ) || null;
      }
    }

    const occInVerse = matched?.occurrences?.find(
      occ => occ.surah === verse.chapter_id && occ.ayah === verse.verse_number
    );

    const profile = tokenizeArabicMorphology(cleanSurface, {
      expectedRoot: occInVerse?.root || matched?.root,
      expectedLemma: occInVerse?.lemma || matched?.lemma,
      expectedBaab: matched?.baab,
      expectedWazan: matched?.wazan,
      expectedPos: matched?.pos
    });

    const family = matched
      ? getRootFamilyWords(matched, words, 8)
      : profile.root
        ? getRootFamilyWords({ id: '__temp__', arabic: cleanSurface, root: profile.root }, words, 8)
        : [];

    setInspectedWordInfo({
      surfaceWord: cleanSurface,
      verseKey: verse.verse_key,
      chapterId: verse.chapter_id,
      verseNumber: verse.verse_number,
      matchedWord: matched,
      profile,
      rootFamily: family
    });
  };

  const [timingCache, setTimingCache] = useState<Record<string, { ayah: number; segments: SegmentTuple[] }[]>>({});
  const [activeTimingDownloads, setActiveTimingDownloads] = useState<number>(0);
  const isDownloadingTiming = activeTimingDownloads > 0;
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Load Alafasy timing data
  useEffect(() => {
    const loadTimingData = async () => {
      try {
        const response = await fetchWithFallback('/data/Alafasy_128kbps.json');
        if (response.ok) {
          const data = await response.json();
          setTimingData(data);
        }
      } catch (e) {
        console.error('Error loading timing data:', e);
      }
    };
    loadTimingData();
  }, [reloadTrigger]);

  const getQariRecitationId = (reciterId: string): number => {
    const mapping: Record<string, number> = {
      alafasy: 7,
      sudais: 3,
      husary: 5,
      ghamdi: 9,
      abdulbasit: 1,
      muaiqly: 12,
    };
    return mapping[reciterId] || 7;
  };

  const getReciterSubfolder = (reciterId: string): string => {
    const reciter = RECITERS.find(r => r.id === reciterId);
    return reciter ? reciter.subfolder : 'Alafasy_128kbps';
  };

  const fetchTimingDataForReciterAndSurah = async (reciterId: string, surahNum: number) => {
    if (reciterId === 'alafasy') return; // Alafasy is already loaded locally
    
    const cacheKey = `${reciterId}_${surahNum}`;
    
    // 1. Check in-memory state
    if (timingCache[cacheKey]) {
      return;
    }
    
    // 2. Check localStorage
    try {
      const cached = localStorage.getItem(`quran_timing_${cacheKey}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setTimingCache(prev => ({
          ...prev,
          [cacheKey]: parsed
        }));
        return;
      }
    } catch (e) {
      console.warn('Error reading from localStorage:', e);
    }
    
    // 3. Trigger download
    setActiveTimingDownloads(prev => prev + 1);
    setDownloadError(null);
    
    try {
      // Step A: Attempt to fetch by surah from Quran.com API (super fast & lightweight)
      const recitationId = getQariRecitationId(reciterId);
      const quranComUrl = `https://api.quran.com/api/v4/recitations/${recitationId}/by_chapter/${surahNum}`;
      
      console.log(`Fetching surah ${surahNum} timings from Quran.com API: ${quranComUrl}`);
      const response = await fetch(quranComUrl);
      if (response.ok) {
        const apiData = await response.json();
        const audioFiles = apiData.audio_files || [];
        
        // Parse segments and group by ayah
        const parsedSurahData: { ayah: number; segments: SegmentTuple[] }[] = [];
        
        for (const file of audioFiles) {
          const verseKey = file.verse_key; // e.g. "1:1"
          const [_, aNumStr] = verseKey.split(':');
          const ayahNum = Number(aNumStr);
          
          const apiSegments = file.segments || [];
          const convertedSegments: SegmentTuple[] = apiSegments.map((seg: any) => {
            if (seg.length === 3) {
              const [wordIdx, startMs, endMs] = seg;
              return [wordIdx - 1, wordIdx, startMs, endMs];
            } else if (seg.length === 4) {
              return seg as SegmentTuple;
            }
            return [0, 0, 0, 0];
          });
          
          parsedSurahData.push({
            ayah: ayahNum,
            segments: convertedSegments
          });
        }
        
        // Save to cache state and localStorage
        setTimingCache(prev => ({
          ...prev,
          [cacheKey]: parsedSurahData
        }));
        
        try {
          localStorage.setItem(`quran_timing_${cacheKey}`, JSON.stringify(parsedSurahData));
        } catch (e) {}
        
        console.log(`Successfully fetched and parsed surah ${surahNum} timings from Quran.com for ${reciterId}`);
        setActiveTimingDownloads(prev => Math.max(0, prev - 1));
        return;
      } else {
        console.warn(`Quran.com API failed with status ${response.status}. Falling back to GitHub full-Quran timings.`);
      }
    } catch (e) {
      console.warn('Quran.com API failed, falling back to GitHub full-Quran timings:', e);
    }

    try {
      // Step B: Fall back to download full-Quran JSON from GitHub
      const subfolder = getReciterSubfolder(reciterId);
      const githubUrl = `https://raw.githubusercontent.com/mushaf-tech/quran-audio-timing/main/${subfolder}.json`;
      
      console.log(`Attempting to download fallback timestamps from GitHub: ${githubUrl}`);
      const githubResponse = await fetch(githubUrl);
      if (githubResponse.ok) {
        const fullData = await githubResponse.json();
        console.log(`Successfully downloaded full timing data from GitHub for ${reciterId}`);
        
        // Populate cache for all surahs in this fullData JSON
        const groupedBySurah: Record<string, { ayah: number; segments: SegmentTuple[] }[]> = {};
        for (const item of fullData) {
          const s = item.surah;
          const a = item.ayah;
          const segments = item.segments as SegmentTuple[];
          const sKey = `${reciterId}_${s}`;
          if (!groupedBySurah[sKey]) {
            groupedBySurah[sKey] = [];
          }
          groupedBySurah[sKey].push({
            ayah: a,
            segments: segments
          });
        }
        
        // Save to cache state and localStorage
        setTimingCache(prev => {
          const updated = { ...prev };
          for (const [key, val] of Object.entries(groupedBySurah)) {
            updated[key] = val;
            try {
              localStorage.setItem(`quran_timing_${key}`, JSON.stringify(val));
            } catch (e) {}
          }
          return updated;
        });
        
        setActiveTimingDownloads(prev => Math.max(0, prev - 1));
        return;
      } else {
        console.warn(`GitHub download failed with status ${githubResponse.status}.`);
      }
    } catch (e) {
      console.warn('GitHub download failed due to network error:', e);
    }
    
    // If both failed, we still decrement the download counter
    setActiveTimingDownloads(prev => Math.max(0, prev - 1));
  };

  // Trigger timing data download when reciter, surah, or currently playing verse changes
  useEffect(() => {
    let activeSurahNum = surah;
    if (!activeSurahNum && playingVerseKey) {
      const [sNum] = playingVerseKey.split(':').map(Number);
      activeSurahNum = sNum;
    }
    if (activeSurahNum) {
      fetchTimingDataForReciterAndSurah(selectedReciterId, activeSurahNum);
      if (activeSurahNum !== 1) {
        fetchTimingDataForReciterAndSurah(selectedReciterId, 1);
      }
    }
  }, [selectedReciterId, surah, playingVerseKey]);

  const getSegmentsForVerse = (surahNum: number, ayahNum: number): SegmentTuple[] => {
    if (selectedReciterId === 'alafasy') {
      const entry = timingData.find(
        (item: any) => Number(item.surah) === Number(surahNum) && Number(item.ayah) === Number(ayahNum)
      );
      return entry ? entry.segments : [];
    }
    
    // For other reciters, look in our timingCache
    const cacheKey = `${selectedReciterId}_${surahNum}`;
    const surahTimings = timingCache[cacheKey];
    if (surahTimings) {
      const entry = surahTimings.find((item: any) => Number(item.ayah) === Number(ayahNum));
      return entry ? entry.segments : [];
    }
    
    return []; // Return empty segments so AudioPlayer uses high-fidelity interpolation for other reciters
  };

  const formatThreeDigits = (num: number): string => {
    return String(num).padStart(3, '0');
  };

  const getAudioUrl = (surahNum: number, ayahNum: number): string => {
    const sStr = formatThreeDigits(surahNum);
    const aStr = formatThreeDigits(ayahNum);
    
    // For Surah 1 (Al-Fatihah), Alafasy has high-fidelity local audio files (001001.mp3 to 001007.mp3)
    if (Number(surahNum) === 1 && selectedReciterId === 'alafasy') {
      return `/audio/${sStr}${aStr}.mp3`;
    }
    
    const globalAyahIdx = getGlobalAyahIndex(surahNum, ayahNum);
    const reciterId = selectedReciterId;
    const edition = getAlquranEditionId(reciterId);
    
    // Return cdn.islamic.network as primary, which supports CORS and HTTPS!
    return `https://cdn.islamic.network/quran/audio/128/${edition}/${globalAyahIdx}.mp3`;
  };

  const scrollToVerse = (verseKey: string) => {
    setTimeout(() => {
      const el = document.getElementById(`verse-container-${verseKey}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 20);
  };

  const startPlayingVerse = (verseKey: string) => {
    if (!recitationEnabled) {
      setRecitationEnabled(true);
      try {
        localStorage.setItem('quran_recitation_enabled', 'true');
      } catch (e) {}
    }
    const [sNum, aNum] = verseKey.split(':').map(Number);
    if (sNum !== 1 && sNum !== 9 && aNum === 1) {
      setPlayingBismillah(true);
    } else {
      setPlayingBismillah(false);
    }
    setPlayingVerseKey(verseKey);
    setPlayingWordIndex(null);
    setPlayingWordEndIndex(null);
  };

  const handleAudioEnded = () => {
    if (playingBismillah) {
      setPlayingBismillah(false);
    } else {
      handleNextVerse();
    }
  };

  const handleNextVerse = () => {
    if (playingBismillah) {
      setPlayingBismillah(false);
      return;
    }
    if (!playingVerseKey) return;
    const [sNum, aNum] = playingVerseKey.split(':').map(Number);
    
    const currentIdx = verses.findIndex(v => Number(v.chapter_id) === sNum && Number(v.verse_number) === aNum);
    if (currentIdx !== -1 && currentIdx < verses.length - 1) {
      const nextVerse = verses[currentIdx + 1];
      const nextSNum = Number(nextVerse.chapter_id);
      const nextANum = Number(nextVerse.verse_number);
      if (nextSNum !== 1 && nextSNum !== 9 && nextANum === 1) {
        setPlayingBismillah(true);
      } else {
        setPlayingBismillah(false);
      }
      setPlayingVerseKey(nextVerse.verse_key);
      setPlayingWordIndex(null);
      setPlayingWordEndIndex(null);
      scrollToVerse(nextVerse.verse_key);
    } else {
      setPlayingVerseKey(null);
      setPlayingWordIndex(null);
      setPlayingWordEndIndex(null);
      setPlayingBismillah(false);
      setRecitationEnabled(false);
    }
  };

  const handlePrevVerse = () => {
    if (playingBismillah) {
      setPlayingBismillah(false);
      return;
    }
    if (!playingVerseKey) return;
    const [sNum, aNum] = playingVerseKey.split(':').map(Number);
    
    const currentIdx = verses.findIndex(v => Number(v.chapter_id) === sNum && Number(v.verse_number) === aNum);
    if (currentIdx !== -1 && currentIdx > 0) {
      const prevVerse = verses[currentIdx - 1];
      const prevSNum = Number(prevVerse.chapter_id);
      const prevANum = Number(prevVerse.verse_number);
      if (prevSNum !== 1 && prevSNum !== 9 && prevANum === 1) {
        setPlayingBismillah(true);
      } else {
        setPlayingBismillah(false);
      }
      setPlayingVerseKey(prevVerse.verse_key);
      setPlayingWordIndex(null);
      setPlayingWordEndIndex(null);
      scrollToVerse(prevVerse.verse_key);
    }
  };
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isTouchingRef = useRef(false);
  const speedMenuRef = useRef<HTMLDivElement>(null);

  // Close speed/settings menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (speedMenuRef.current && !speedMenuRef.current.contains(event.target as Node)) {
        setShowSpeedMenu(false);
      }
    }
    if (showSpeedMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSpeedMenu]);

  // Load Quran Arabic text
  useEffect(() => {
    const loadQuranText = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        // Force window and container back to top immediately when a new surah/para starts loading
        window.scrollTo({ top: 0, behavior: 'instant' as any });
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
        const response = await fetchWithFallback('/data/quran-arabic-text.json');
        const data = await response.json();
        
        let filteredVerses: QuranVerse[] = [];
        
        if (surah) {
          // Load specific surah
          const surahData = data.find((s: any) => Number(s.id) === Number(surah));
          if (surahData && surahData.verses) {
            filteredVerses = surahData.verses.map((verse: any) => ({
              verse_key: `${surahData.id}:${verse.id}`,
              verse_number: verse.id,
              chapter_id: surahData.id,
              text_uthmani: normalizeArabicText(verse.text || ''),
              text_imlaei: normalizeArabicText(verse.text || '')
            }));
          }
        } else if (para) {
          // Load specific para (juz)
          const paraStartSurah = getParaStartSurah(para);
          const paraEndSurah = getParaEndSurah(para);
          
          const surahsInPara = data.filter((s: any) => Number(s.id) >= paraStartSurah && Number(s.id) <= paraEndSurah);
          
          filteredVerses = [];
          surahsInPara.forEach((sData: any) => {
            const versesForSurah = (sData.verses || []).map((verse: any) => ({
              verse_key: `${sData.id}:${verse.id}`,
              verse_number: verse.id,
              chapter_id: sData.id,
              text_uthmani: normalizeArabicText(verse.text || ''),
              text_imlaei: normalizeArabicText(verse.text || '')
            }));
            filteredVerses.push(...versesForSurah);
          });
          
          filteredVerses.sort((a, b) => {
            if (a.chapter_id !== b.chapter_id) {
              return a.chapter_id - b.chapter_id;
            }
            return a.verse_number - b.verse_number;
          });
        }
        
        setVerses(filteredVerses);
      } catch (error: any) {
        console.error('Error loading Quran text:', error);
        setLoadError(error.message || 'Failed to fetch');
      } finally {
        setLoading(false);
      }
    };

    loadQuranText();
  }, [surah, para, reloadTrigger]);

  // Load Quran Translations from API
  useEffect(() => {
    if (!showTranslation) return;
    
    let isMounted = true;
    const fetchTranslationsData = async () => {
      try {
        setTranslationsLoading(true);
        const edition = getAlquranEdition(lang);
        
        let url = '';
        if (surah) {
          url = `https://api.alquran.cloud/v1/surah/${surah}/${edition}`;
        } else if (para) {
          url = `https://api.alquran.cloud/v1/juz/${para}/${edition}`;
        }
        
        let res = await fetch(url);
        if (!res.ok && edition !== 'en.sahih') {
          // Fallback to English Sahih translation if selected language fails
          const fallbackEdition = 'en.sahih';
          url = surah 
            ? `https://api.alquran.cloud/v1/surah/${surah}/${fallbackEdition}`
            : `https://api.alquran.cloud/v1/juz/${para}/${fallbackEdition}`;
          res = await fetch(url);
        }
        
        if (res.ok && isMounted) {
          const result = await res.json();
          const transMap: Record<string, string> = {};
          
          if (result.data && result.data.ayahs) {
            result.data.ayahs.forEach((ayah: any) => {
              const sNum = surah ? surah : (ayah.surah?.number || 1);
              const aNum = ayah.numberInSurah;
              transMap[`${sNum}:${aNum}`] = ayah.text;
            });
            setTranslations(transMap);
          }
        }
      } catch (err) {
        console.warn('Error fetching translations:', err);
      } finally {
        if (isMounted) {
          setTranslationsLoading(false);
        }
      }
    };
    
    fetchTranslationsData();
    return () => {
      isMounted = false;
    };
  }, [surah, para, lang, showTranslation]);

  // Auto scroll implementation with requestAnimationFrame targeting the actual container directly
  useEffect(() => {
    let animationFrameId: number | null = null;
    const container = scrollContainerRef.current;
    
    if (autoScroll && !isTouchingRef.current && container) {
      // Force scroll-behavior to auto on the container so it doesn't conflict with our precise frame ticks
      const prevScrollBehavior = container.style.scrollBehavior;
      container.style.scrollBehavior = 'auto';

      let lastTime = performance.now();
      
      // Speed multiplier: scrollSpeed 1 = 20px/sec, 2 = 40px/sec, etc.
      const pixelsPerSecond = scrollSpeed * 20;
      
      // Use double-precision float for subpixel accumulation
      let accumulatedScrollY = container.scrollTop;

      const scrollStep = (time: number) => {
        const activeContainer = scrollContainerRef.current;
        if (!activeContainer) return;

        const delta = (time - lastTime) / 1000; // time delta in seconds
        lastTime = time;

        if (delta > 0 && delta < 0.1) { // avoid giant leaps on frame lag
          const actualScrollY = activeContainer.scrollTop;
          
          // If the user scrolled manually (by more than 15px), sync our accumulated value
          if (Math.abs(actualScrollY - accumulatedScrollY) > 15) {
            accumulatedScrollY = actualScrollY;
          }

          accumulatedScrollY += pixelsPerSecond * delta;
          
          // Check if we reached the bottom
          const maxScrollY = activeContainer.scrollHeight - activeContainer.clientHeight;
          if (accumulatedScrollY >= maxScrollY) {
            accumulatedScrollY = maxScrollY;
            activeContainer.scrollTo(0, accumulatedScrollY);
            setAutoScroll(false); // Stop when reaching the end
            return;
          }

          // Use scrollTo with decimals - modern browser compositing engines support smooth subpixel scrolls
          activeContainer.scrollTo(0, accumulatedScrollY);
        }
        animationFrameId = requestAnimationFrame(scrollStep);
      };

      // Listen to manual scroll events to sync the position immediately
      const handleUserScroll = () => {
        if (container) {
          accumulatedScrollY = container.scrollTop;
        }
      };

      container.addEventListener('wheel', handleUserScroll, { passive: true });
      container.addEventListener('touchmove', handleUserScroll, { passive: true });

      animationFrameId = requestAnimationFrame(scrollStep);

      return () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
        }
        if (container) {
          container.style.scrollBehavior = prevScrollBehavior;
          container.removeEventListener('wheel', handleUserScroll);
          container.removeEventListener('touchmove', handleUserScroll);
        }
      };
    }
  }, [autoScroll, scrollSpeed, loading]);

  // Restore scroll position once loading is finished
  useEffect(() => {
    if (!loading && initialScrollY > 0) {
      const timer = setTimeout(() => {
        const container = scrollContainerRef.current;
        if (container) {
          container.scrollTop = initialScrollY;
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [loading, initialScrollY]);

  // Track scroll and update recitation progress (debounced) on the correct container
  useEffect(() => {
    if (!onSaveProgress) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container) {
        const currentScroll = container.scrollTop;
        onSaveProgress(surah ? 'surah' : 'para', (surah || para)!, currentScroll);
      }
    };

    let timeoutId: any = null;
    const debouncedScroll = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(handleScroll, 150);
    };

    container.addEventListener('scroll', debouncedScroll);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (container) {
        container.removeEventListener('scroll', debouncedScroll);
      }
    };
  }, [surah, para, onSaveProgress, loading]);

  // Touch handlers for pause/resume
  const handleTouchStart = () => {
    isTouchingRef.current = true;
  };

  const handleTouchEnd = () => {
    isTouchingRef.current = false;
  };

  const speeds = [
    { value: 0.5, label: '0.5x' },
    { value: 1, label: '1x' },
    { value: 1.5, label: '1.5x' },
    { value: 2, label: '2x' },
    { value: 3, label: '3x' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#D4A574] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#795548] font-serif-eng">Loading Quran...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white rounded-2xl p-8 max-w-md shadow-md border border-[#E8DCC8]">
          <div className="w-16 h-16 bg-[#FDF0ED] rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-[#8B3A3A] text-2xl font-bold font-serif-eng">!</span>
          </div>
          <h3 className="text-lg font-bold text-[#3E2723] mb-2 font-serif-eng">Failed to Load Quran</h3>
          <p className="text-sm text-[#795548] mb-6">
            We encountered a problem loading the Quran text ({loadError}). Please check your connection and try again.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm font-medium text-[#795548] border border-[#E8DCC8] rounded-xl hover:bg-[#FAF6F1] transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={() => {
                setLoadError(null);
                setLoading(true);
                setReloadTrigger(prev => prev + 1);
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-[#8B3A3A] rounded-xl hover:bg-[#702d2d] transition-colors shadow-xs"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const surahName = surah ? getSurahName(surah) : '';
  const surahNameArabic = surah ? getSurahNameArabic(surah) : '';
  const paraName = para ? `Juz ${para}` : '';
  const playingVerse = playingVerseKey ? verses.find(v => v.verse_key === playingVerseKey) : null;

  return (
    <div className="h-screen h-[100dvh] bg-[#FAF6F1] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E8DCC8] shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-1 sm:gap-3">
          {/* Left: Back Button */}
          <div className="flex items-center shrink-0">
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-[#8B3A3A] hover:text-[#D4A574] transition-colors shrink-0 cursor-pointer"
            >
              <ChevronLeft className={`w-4 h-4 sm:w-5 sm:h-5 ${isRtl ? 'rotate-180' : ''}`} />
              <span className="font-bold text-xs sm:text-sm select-none">Back</span>
            </button>
          </div>
          
          {/* Center: Title */}
          <div className="text-center min-w-0 px-1 flex-grow flex flex-col justify-center">
            <h1 className="text-xs sm:text-base md:text-lg font-bold text-[#3E2723] font-serif-eng truncate leading-tight select-none">
              {surahName || paraName}
            </h1>
            {surahNameArabic && (
              <p className="text-[9px] sm:text-xs text-[#795548] font-arabic truncate mt-0.5 select-none leading-none">
                {surahNameArabic}
              </p>
            )}
          </div>
          
          {/* Right: Actions */}
          <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
            {/* Translation Toggle */}
            <button
              onClick={() => setShowTranslation(!showTranslation)}
              className="p-1 sm:p-2 rounded-full hover:bg-[#FAF6F1] transition-colors text-[#8B3A3A] cursor-pointer"
              title={showTranslation ? 'Hide Translation' : 'Show Translation'}
            >
              {showTranslation ? <EyeOff className="w-3.5 h-3.5 sm:w-5 sm:h-5" /> : <Eye className="w-3.5 h-3.5 sm:w-5 sm:h-5" />}
            </button>

            {/* Word-Tap Morphology Inspector Toggle */}
            <button
              onClick={() => {
                setInspectMode(!inspectMode);
                if (inspectMode) setInspectedWordInfo(null);
              }}
              className={`p-1 sm:p-2 rounded-full transition-all cursor-pointer ${
                inspectMode ? 'bg-[#D4A574]/25 text-[#8B3A3A] ring-1 ring-[#D4A574]' : 'hover:bg-[#FAF6F1] text-[#8B3A3A]'
              }`}
              title={inspectMode ? 'Word Morphology Inspector Active (Tap any word for Sarf & Nahw)' : 'Enable Word Morphology Inspector'}
            >
              <GraduationCap className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </button>

            {/* Recitation Audio Toggle */}
            <button
              onClick={toggleRecitation}
              className={`p-1 sm:p-2 rounded-full transition-all cursor-pointer ${
                recitationEnabled ? 'bg-[#8B3A3A] text-white shadow-xs' : 'hover:bg-[#FAF6F1] text-[#8B3A3A]'
              }`}
              title={recitationEnabled ? 'Disable Recitation Audio' : 'Enable Recitation Audio'}
            >
              <Headphones className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </button>
            
            {/* Auto Scroll Toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`p-1 sm:p-2 rounded-full transition-colors cursor-pointer ${
                autoScroll ? 'bg-[#8B3A3A] text-white animate-pulse' : 'hover:bg-[#FAF6F1] text-[#8B3A3A]'
              }`}
              title={autoScroll ? 'Pause Auto Scroll' : 'Start Auto Scroll'}
            >
              <ChevronsDown className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </button>

            {/* Sidebar toggle button */}
            <button
              onClick={handleToggleSidebar}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold border rounded-lg transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                isSidebarOpen
                  ? 'bg-amber-50 text-[#8B3A3A] border-[#D4A574]/40 hover:bg-amber-100/80'
                  : 'bg-white text-[#795548] border-[#E8DCC8] hover:bg-[#FAF6F1]/80 hover:text-[#3E2723]'
              }`}
              title={isSidebarOpen ? 'Hide Downloads & History' : 'Show Downloads & History'}
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{isSidebarOpen ? 'Hide Sidebar' : 'Sidebar'}</span>
            </button>
            
            {/* Settings Menu */}
            <div ref={speedMenuRef} className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className={`p-1 sm:p-2 rounded-full transition-colors cursor-pointer ${
                  showSpeedMenu ? 'bg-[#FAF6F1] text-[#8B3A3A]' : 'hover:bg-[#FAF6F1] text-[#8B3A3A]'
                }`}
                title="Reading Settings"
              >
                <Settings className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </button>
              
              {showSpeedMenu && (
                <div className="absolute right-0 top-full mt-2 bg-white border border-[#E8DCC8] rounded-xl shadow-xl p-4 min-w-[280px] z-50 space-y-4">
                  {/* Qari / Reciter Selection */}
                  <div>
                    <h3 className="text-xs font-bold text-[#8B3A3A] uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Reciter / Qari</span>
                      <span className="text-[9px] lowercase font-normal text-[#795548] font-mono">Word Sync Support</span>
                    </h3>
                    <select
                      value={selectedReciterId}
                      onChange={(e) => handleReciterChange(e.target.value)}
                      className="w-full text-xs font-bold text-[#3E2723] font-mono bg-[#FAF6F1] border border-[#E8DCC8]/60 p-2.5 rounded-lg focus:ring-1 focus:ring-[#8B3A3A] focus:outline-hidden cursor-pointer"
                    >
                      {RECITERS.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.bitrate})
                        </option>
                      ))}
                    </select>
                    
                    {/* Synchronized status details */}
                    <div className="mt-2 p-2 rounded-md bg-[#FAF6F1]/60 border border-[#E8DCC8]/30 flex items-center gap-1.5">
                      {selectedReciterId === 'alafasy' ? (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                          <span className="text-[10px] font-mono font-medium text-emerald-800">
                            Pre-loaded Word-Sync Active
                          </span>
                        </>
                      ) : isDownloadingTiming ? (
                        <>
                          <span className="relative flex h-1.5 w-1.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8B3A3A] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#8B3A3A]"></span>
                          </span>
                          <span className="text-[10px] font-mono font-bold text-[#8B3A3A] animate-pulse">
                            Syncing word timestamps...
                          </span>
                        </>
                      ) : (() => {
                        let activeSurahNum = surah;
                        if (!activeSurahNum && playingVerseKey) {
                          const [sNum] = playingVerseKey.split(':').map(Number);
                          activeSurahNum = sNum;
                        }
                        const cacheKey = `${selectedReciterId}_${activeSurahNum || 1}`;
                        return timingCache[cacheKey] ? (
                          <>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                            <span className="text-[10px] font-mono font-medium text-emerald-800">
                              Dynamic Word-Sync Active
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></div>
                            <span className="text-[10px] font-mono font-medium text-amber-800">
                              Fidelity Audio Interpolation
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-[#8B3A3A] uppercase tracking-wider mb-2">Arabic Font Size</h3>
                    <div className="flex items-center justify-between gap-2 bg-[#FAF6F1] p-1.5 rounded-lg border border-[#E8DCC8]/60">
                      <button
                        onClick={() => {
                          const newSize = Math.max(20, arabicFontSize - 4);
                          setArabicFontSize(newSize);
                          try {
                            localStorage.setItem('quran_arabic_font_size', String(newSize));
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        className="w-10 h-8 rounded-md bg-white hover:bg-[#FAF6F1] hover:shadow-xs flex items-center justify-center text-xs font-bold text-[#3E2723] border border-[#E8DCC8]/30 transition-all cursor-pointer"
                        disabled={arabicFontSize <= 20}
                        title="Decrease Font Size"
                      >
                        A-
                      </button>
                      <span className="text-sm font-bold text-[#795548] font-mono">
                        {arabicFontSize}px
                      </span>
                      <button
                        onClick={() => {
                          const newSize = Math.min(64, arabicFontSize + 4);
                          setArabicFontSize(newSize);
                          try {
                            localStorage.setItem('quran_arabic_font_size', String(newSize));
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        className="w-10 h-8 rounded-md bg-white hover:bg-[#FAF6F1] hover:shadow-xs flex items-center justify-center text-xs font-bold text-[#3E2723] border border-[#E8DCC8]/30 transition-all cursor-pointer"
                        disabled={arabicFontSize >= 64}
                        title="Increase Font Size"
                      >
                        A+
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-[#8B3A3A] uppercase tracking-wider mb-2">Auto Scroll Speed</h3>
                    <div className="grid grid-cols-5 gap-1 bg-[#FAF6F1] p-1 rounded-lg border border-[#E8DCC8]/60">
                      {speeds.map((speed) => (
                        <button
                          key={speed.value}
                          onClick={() => {
                            setScrollSpeed(speed.value);
                          }}
                          className={`py-1 text-center text-xs rounded-md transition-all font-semibold cursor-pointer ${
                            scrollSpeed === speed.value
                              ? 'bg-[#8B3A3A] text-white shadow-xs font-bold'
                              : 'text-[#795548] hover:bg-white/60'
                          }`}
                        >
                          {speed.label.replace('x', '')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Quran Content */}
      <main
        ref={scrollContainerRef}
        className="flex-grow overflow-y-auto scroll-container-gpu"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            
            {/* Main Reading Column */}
            <div className={`w-full transition-all duration-300 ${isSidebarOpen ? 'lg:w-[68%]' : 'lg:w-full'}`}>
              
              {/* Authentic Manuscript Page Styling Container */}
              <div className="relative bg-[#FDFBF7] border-4 border-[#E8DCC8] rounded-xl p-6 sm:p-10 shadow-md ring-1 ring-[#3E2723]/5">
                {/* Elegant corner ornaments to mimic old Mushaf books */}
                <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-[#D4A574]/50"></div>
                <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-[#D4A574]/50"></div>
                <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-[#D4A574]/50"></div>
                <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-[#D4A574]/50"></div>

                {/* Bismillah for Surahs (except Tawbah and Fatiha) */}
                {surah && surah !== 1 && surah !== 9 && (
                  <div 
                    onClick={() => {
                      if (!recitationEnabled) {
                        setRecitationEnabled(true);
                        try {
                          localStorage.setItem('quran_recitation_enabled', 'true');
                        } catch (e) {}
                      }
                      setPlayingBismillah(true);
                      if (verses.length > 0) {
                        setPlayingVerseKey(verses[0].verse_key);
                      }
                      setPlayingWordIndex(null);
                      setPlayingWordEndIndex(null);
                    }}
                    className={`text-center mb-8 border-b border-[#E8DCC8]/40 pb-6 rounded-xl p-4 transition-all duration-300 cursor-pointer ${
                      recitationEnabled && playingBismillah 
                        ? 'bg-[#8B3A3A]/8 border border-[#8B3A3A]/25 shadow-xs' 
                        : 'bg-transparent border border-transparent hover:bg-[#D4A574]/8'
                    }`}
                    title="Click to play Bismillah recitation"
                  >
                    <p 
                      className="font-arabic leading-normal select-none text-center"
                      dir="rtl"
                      style={{
                        fontSize: `${Math.max(24, arabicFontSize * 1.15)}px`
                      }}
                    >
                      {recitationEnabled && playingBismillah ? (
                        ['بِسۡمِ', 'ٱللّٰهِ', 'ٱلرَّحۡمٰنِ', 'ٱلرَّحِيمِ'].map((word, wIdx) => {
                          const isWordHighlighted = playingWordIndex === wIdx;
                          return (
                            <React.Fragment key={wIdx}>
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded-md transition-all duration-150 ${
                                  isWordHighlighted
                                    ? 'bg-[#8B3A3A] text-white font-bold shadow-xs'
                                    : 'text-[#8B3A3A]'
                                }`}
                              >
                                {word}
                              </span>
                              {wIdx < 3 && ' '}
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <span className="text-[#3E2723]">بِسۡمِ ٱللّٰهِ ٱلرَّحۡمٰنِ ٱلرَّحِيمِ</span>
                      )}
                    </p>
                  </div>
                )}

                {/* Mode 1: Continuous Flow Mushaf (Translations Hidden) */}
                {!showTranslation && (
                  <div className="text-right py-4" dir="rtl">
                    <div 
                      className="font-arabic text-[#3E2723] text-right leading-loose"
                      style={{
                        fontSize: `${arabicFontSize}px`,
                        lineHeight: `${arabicFontSize * 2.2}px`
                      }}
                    >
                      {verses.map((verse) => {
                        const isActive = recitationEnabled && !playingBismillah && playingVerseKey === verse.verse_key;
                        return (
                          <React.Fragment key={verse.verse_key}>
                            <span 
                              id={`verse-container-${verse.verse_key}`}
                              onClick={() => {
                                startPlayingVerse(verse.verse_key);
                              }}
                              className={`inline rounded-lg px-2 py-0.5 box-decoration-clone transition-all cursor-pointer ${
                                isActive 
                                  ? 'bg-[#D4A574]/15 font-bold' 
                                  : 'hover:bg-[#D4A574]/8 text-neutral-800'
                              }`}
                              title="Click to play recitation with word-by-word highlight"
                            >
                              {verse.text_uthmani.split(' ').map((word, wIdx, arr) => {
                                const isWordHighlighted = isActive && playingWordIndex === wIdx;
                                const isWordInspected = inspectedWordInfo?.verseKey === verse.verse_key && inspectedWordInfo?.surfaceWord === word.replace(/[۞۩۝]/g, '').trim();
                                return (
                                  <React.Fragment key={wIdx}>
                                    <span 
                                      onClick={(e) => handleInspectMushafWord(word, verse, e)}
                                      className={`inline-block px-1 py-0.5 rounded-md transition-all duration-150 ${
                                        isWordHighlighted 
                                          ? 'bg-[#8B3A3A] text-white font-bold shadow-xs' 
                                          : isWordInspected
                                            ? 'bg-[#D4A574]/35 text-[#8B3A3A] font-bold ring-1 ring-[#8B3A3A]/40'
                                            : 'text-[#3E2723] hover:text-[#8B3A3A] hover:bg-[#D4A574]/15'
                                      }`}
                                      title={inspectMode ? 'Tap to inspect Sarf & Nahw morphology' : undefined}
                                    >
                                      {word}
                                    </span>
                                    {wIdx < arr.length - 1 && ' '}
                                  </React.Fragment>
                                );
                              })}
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startPlayingVerse(verse.verse_key);
                                }}
                                title="Click to play verse recitation"
                              >
                                <AyahEndIcon verseNumber={verse.verse_number} isActive={isActive} fontSize={arabicFontSize} />
                              </span>
                            </span>
                            {/* Real space between verses so they flow beautifully in continuous text */}
                            {' '}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Mode 2: Interlinear Beautiful Translation Book View (Translations Shown) */}
                {showTranslation && (
                  <div className="space-y-8 py-2">
                    {verses.map((verse) => {
                      const key = `${verse.chapter_id}:${verse.verse_number}`;
                      const translationText = translations[key] || getFallbackTranslation(verse.chapter_id, verse.verse_number, lang);
                      const isRtlTrans = isLangRtl(lang);
                      const isActive = recitationEnabled && !playingBismillah && playingVerseKey === verse.verse_key;

                      return (
                        <div 
                          id={`verse-container-${verse.verse_key}`}
                          key={verse.verse_key} 
                          onClick={() => {
                            startPlayingVerse(verse.verse_key);
                          }}
                          className={`group border-b border-dashed border-[#E8DCC8]/50 pb-6 last:border-0 last:pb-0 p-4 rounded-xl transition-all cursor-pointer ${
                            isActive 
                              ? 'bg-[#D4A574]/15 border-l-4 border-l-[#8B3A3A] shadow-xs' 
                              : 'hover:bg-[#FAF6F1]/60'
                          }`}
                          title="Click to play recitation with word-by-word highlight"
                        >
                          {/* Arabic Verse Line */}
                          <div className="mb-3 text-right" dir="rtl">
                            <p 
                              className="font-arabic text-[#3E2723] inline-block"
                              style={{
                                fontSize: `${arabicFontSize}px`,
                                lineHeight: `${arabicFontSize * 1.8}px`
                              }}
                            >
                              {verse.text_uthmani.split(' ').map((word, wIdx, arr) => {
                                const isWordHighlighted = isActive && playingWordIndex === wIdx;
                                const isWordInspected = inspectedWordInfo?.verseKey === verse.verse_key && inspectedWordInfo?.surfaceWord === word.replace(/[۞۩۝]/g, '').trim();
                                return (
                                  <React.Fragment key={wIdx}>
                                    <span 
                                      onClick={(e) => handleInspectMushafWord(word, verse, e)}
                                      className={`inline-block px-1.5 py-0.5 rounded-md transition-all duration-150 ${
                                        isWordHighlighted 
                                          ? 'bg-[#8B3A3A] text-white font-bold scale-105 shadow-md shadow-[#8B3A3A]/25' 
                                          : isWordInspected
                                            ? 'bg-[#D4A574]/35 text-[#8B3A3A] font-bold ring-1 ring-[#8B3A3A]/40'
                                            : 'text-neutral-800 hover:text-[#8B3A3A] hover:bg-[#D4A574]/15'
                                      }`}
                                      title={inspectMode ? 'Tap to inspect Sarf & Nahw morphology' : undefined}
                                    >
                                      {word}
                                    </span>
                                    {wIdx < arr.length - 1 && ' '}
                                  </React.Fragment>
                                );
                              })}
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startPlayingVerse(verse.verse_key);
                                }}
                                title="Click to play verse recitation"
                              >
                                <AyahEndIcon verseNumber={verse.verse_number} isActive={isActive} fontSize={arabicFontSize} />
                              </span>
                            </p>
                          </div>
                          
                          {/* Translation Line Directly Below */}
                          <div className={isRtlTrans ? "text-right" : "text-left"} dir={isRtlTrans ? "rtl" : "ltr"}>
                            {translationsLoading && !translationText ? (
                              <div className={`w-2/3 h-4 bg-[#D4A574]/15 animate-pulse rounded-md mt-1 ${isRtlTrans ? 'ml-auto' : ''}`}></div>
                            ) : (
                              <p className={`font-serif-eng text-sm sm:text-base leading-relaxed italic transition-colors duration-200 ${
                                isActive ? 'text-[#3E2723] font-semibold' : 'text-[#795548]'
                              } ${
                                isRtlTrans 
                                  ? 'border-r-2 border-[#D4A574]/30 pr-3 border-l-0 pl-0' 
                                  : 'border-l-2 border-[#D4A574]/30 pl-3'
                              }`}>
                                {translationText || (
                                  <span className="text-neutral-400">Translation not loaded</span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* End indicator */}
              <div className="text-center mt-12 mb-8">
                <p className="text-lg text-[#795548] font-serif-eng italic">
                  {surah ? `End of Surah ${surahName}` : `End of ${paraName}`}
                </p>
                <div className="w-16 h-1 bg-[#D4A574] mx-auto mt-4 rounded-full"></div>
              </div>
            </div>

            {/* Right Column Sidebar */}
            {isSidebarOpen && (
              <aside className="w-full lg:w-[32%] lg:sticky lg:top-4 space-y-6 shrink-0">
                {/* Offline Audio Downloads Manager Card */}
                <div className="bg-white border border-[#E8DCC8] rounded-xl p-5 shadow-xs">
                  <div className="border-b border-[#E8DCC8]/40 pb-3 mb-3">
                    <h2 className="text-xs font-bold text-[#3E2723] uppercase tracking-wider flex items-center gap-2 font-serif-eng">
                      <Download className="w-3.5 h-3.5 text-[#8B3A3A]" />
                      Offline Recitation Manager
                    </h2>
                    <p className="text-[11px] text-[#795548] mt-1 leading-normal">
                      Download audio files for this {surah ? 'Surah' : 'Juz'} or full Quran to play offline without internet.
                    </p>
                  </div>

                  <div className="space-y-3 mb-4">
                    {/* Qari selector */}
                    <div className="flex items-center justify-between gap-2 bg-[#FAF6F1] px-3 py-1.5 rounded-lg border border-[#E8DCC8]/60">
                      <span className="text-[11px] font-bold text-[#795548]">Reciter:</span>
                      <select
                        value={selectedReciterId}
                        onChange={(e) => handleReciterChange(e.target.value)}
                        className="bg-transparent border-0 text-xs font-bold text-[#3E2723] font-mono focus:ring-0 focus:outline-hidden cursor-pointer"
                      >
                        {RECITERS.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Download Current Surah or Para Button */}
                    {!currentCacheStatus.isCompleted && downloadState.status !== 'downloading' && (
                      <button
                        onClick={handleDownloadCurrent}
                        className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-bold text-white bg-[#8B3A3A] hover:bg-[#702d2d] rounded-lg shadow-2xs transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download {surah ? `Surah ${surah}` : `Juz ${para}`} Audio</span>
                      </button>
                    )}

                    {currentCacheStatus.isCompleted && (
                      <div className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>{surah ? `Surah ${surah}` : `Juz ${para}`} Downloaded (Offline)</span>
                      </div>
                    )}

                    {/* Download Complete Quran Button */}
                    {overallOfflineCount < totalQuranAyahs && downloadState.status !== 'downloading' && (
                      <button
                        onClick={handleDownloadQuran}
                        className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs font-bold text-[#8B3A3A] bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Complete Quran</span>
                      </button>
                    )}

                    {/* Clear Cache Button */}
                    {overallOfflineCount > 0 && !confirmingClear && (
                      <button
                        onClick={() => setConfirmingClear(true)}
                        className="flex items-center justify-center gap-1 w-full py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
                        title="Delete cached audio files for this Qari"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear {overallOfflineCount} Cached Verses</span>
                      </button>
                    )}

                    {overallOfflineCount > 0 && confirmingClear && (
                      <div className="bg-red-50/90 border border-red-200 rounded-lg p-2.5 space-y-2">
                        <p className="text-[10px] text-[#8B3A3A] font-semibold">
                          Delete {overallOfflineCount} cached verses for {activeQariName}?
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={handleClearCache}
                            className="flex-1 py-1 text-[10px] font-bold text-white bg-[#8B3A3A] hover:bg-[#702d2d] rounded cursor-pointer"
                          >
                            Confirm Clear
                          </button>
                          <button
                            onClick={() => setConfirmingClear(false)}
                            className="flex-1 py-1 text-[10px] font-bold text-[#795548] bg-white border border-[#E8DCC8] rounded cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Active Download Progress Panel */}
                  {(downloadState.status === 'downloading' || downloadState.status === 'paused') && (
                    <div className="p-3 bg-[#FAF6F1] border border-dashed border-[#D4A574]/40 rounded-xl mb-3">
                      <div className="flex justify-between items-center gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8B3A3A] shrink-0" />
                          <span className="text-[10px] font-bold text-[#3E2723] truncate">
                            {downloadState.status === 'downloading' ? 'Downloading...' : 'Paused'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {downloadState.status === 'downloading' ? (
                            <button onClick={() => recitationDownloader.pause()} className="p-1 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md cursor-pointer"><Pause className="w-3 h-3" /></button>
                          ) : (
                            <button onClick={() => recitationDownloader.resume()} className="p-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md cursor-pointer"><Play className="w-3 h-3" /></button>
                          )}
                          <button onClick={() => recitationDownloader.cancel()} className="p-1 text-[#8B3A3A] bg-red-50 hover:bg-red-100 border border-red-200 rounded-md cursor-pointer"><X className="w-3 h-3" /></button>
                        </div>
                      </div>
                      <div className="w-full bg-[#E8DCC8]/40 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-gradient-to-r from-[#D4A574] to-[#8B3A3A] h-full transition-all duration-300" style={{ width: `${Math.round((downloadState.downloadedCount / downloadState.totalFiles) * 100) || 0}%` }}></div>
                      </div>
                      <div className="flex justify-between items-center mt-1 text-[9px] text-[#795548] font-mono">
                        <span>{downloadState.downloadedCount} / {downloadState.totalFiles}</span>
                        <span className="font-bold text-[#3E2723]">{Math.round((downloadState.downloadedCount / downloadState.totalFiles) * 100) || 0}%</span>
                      </div>
                    </div>
                  )}

                  {/* Cache summary info */}
                  <div className="text-[11px] text-[#795548] font-mono bg-[#FAF6F1]/50 border border-[#E8DCC8]/20 rounded-lg p-2.5">
                    <div className="font-bold text-[#3E2723]">
                      Qari Storage: {overallOfflineCount.toLocaleString()} / {totalQuranAyahs.toLocaleString()} verses
                    </div>
                  </div>
                </div>

                {/* Recent Recitations (Continue Recitation / Switcher) */}
                {recentHistory && recentHistory.length > 0 && (
                  <div className="bg-gradient-to-r from-[#FAF6F1]/60 to-[#FFF] rounded-xl border border-[#D4A574]/30 p-5 shadow-xs">
                    <h2 className="text-xs font-bold text-[#8B3A3A] uppercase tracking-wider mb-3.5 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8B3A3A] animate-pulse"></span>
                      Continue Recitation
                    </h2>
                    <div className="flex flex-col gap-2.5">
                      {recentHistory.slice(0, 3).map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            if (onSaveProgress && scrollContainerRef.current) {
                              onSaveProgress(surah ? 'surah' : 'para', (surah || para)!, scrollContainerRef.current.scrollTop);
                            }
                            if (onSwitchRecitation) {
                              onSwitchRecitation(item.type, item.id);
                            }
                          }}
                          className={`bg-white border rounded-lg p-2.5 text-left transition-all hover:shadow-2xs flex flex-col justify-between group cursor-pointer w-full ${
                            (surah && item.type === 'surah' && item.id === surah) || (para && item.type === 'para' && item.id === para)
                              ? 'border-[#8B3A3A] bg-amber-50/40'
                              : 'border-[#E8DCC8] hover:border-[#8B3A3A]'
                          }`}
                        >
                          <div className="flex justify-between items-start w-full gap-2">
                            <span className="text-[9px] font-mono text-[#795548] bg-[#FAF6F1] px-1.5 py-0.5 rounded-md font-bold shrink-0">
                              {item.type === 'surah' ? 'Surah' : 'Juz'} {item.id}
                            </span>
                            {item.arabicName && (
                              <span className="text-xs font-arabic text-[#8B3A3A] font-bold shrink-0">{item.arabicName}</span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center justify-between w-full">
                            <div className="min-w-0">
                              <h3 className="font-bold text-xs text-[#3E2723] group-hover:text-[#8B3A3A] transition-colors truncate">{item.name}</h3>
                              {item.scrollY > 0 && (
                                <span className="text-[9px] text-[#795548]/70 font-mono block">
                                  Position: {Math.round(item.scrollY)}px
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] text-[#8B3A3A] font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform shrink-0">
                              <span>Resume</span>
                              <ChevronRight className="w-3 h-3 text-[#8B3A3A]" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            )}
          </div>
        </div>
      </main>

      {/* Interactive Mushaf Word Sarf & Nahw Inspector Drawer */}
      {inspectedWordInfo && (
        <div className="bg-[#FAF6F1] border-t-2 border-[#D4A574] px-4 py-3.5 shadow-2xl z-40 animate-slideUp">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap items-start justify-between gap-4">
              {/* Left: Arabic Word + Transliteration + Meaning */}
              <div className="flex items-center gap-4">
                <div className="bg-white border-2 border-[#D4A574]/60 rounded-xl px-4 py-2 text-center shadow-xs">
                  <span className="text-2xl sm:text-3xl font-arabic text-[#8B3A3A] block leading-tight">
                    {inspectedWordInfo.surfaceWord}
                  </span>
                  <span className="text-[10px] font-mono text-[#795548] uppercase tracking-wider">
                    {inspectedWordInfo.matchedWord?.transliteration || transliterateArabicToEnglish(inspectedWordInfo.surfaceWord)}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#8B3A3A]/10 text-[#8B3A3A]">
                      Surah {inspectedWordInfo.chapterId}:{inspectedWordInfo.verseNumber}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#E8DCC8]/70 text-[#3E2723]">
                      {inspectedWordInfo.matchedWord?.pos || inspectedWordInfo.profile.pos || 'Kalimah'}
                    </span>
                    {inspectedWordInfo.matchedWord && (
                      <span className="text-[10px] font-mono text-[#795548]">
                        ({inspectedWordInfo.matchedWord.frequency}× in Quran)
                      </span>
                    )}
                  </div>

                  <p className="text-sm sm:text-base font-bold font-serif-eng text-[#3E2723] mt-1">
                    {inspectedWordInfo.matchedWord
                      ? (inspectedWordInfo.matchedWord.translations[lang as LanguageCode] || inspectedWordInfo.matchedWord.translations.en)
                      : 'Classical Quranic Lexical Form'}
                  </p>

                  {/* Sarf Badges: Root, Baab, Wazan */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {inspectedWordInfo.profile.root && (
                      <span className="text-[11px] bg-white border border-[#D4A574]/50 px-2 py-0.5 rounded font-arabic text-[#3E2723]">
                        الجذر: <strong className="text-[#8B3A3A]">{inspectedWordInfo.profile.root.replace(/-/g, ' ')}</strong>
                      </span>
                    )}
                    {inspectedWordInfo.profile.baab && (
                      <span className="text-[10px] bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded font-mono font-semibold text-[#8B3A3A]">
                        {inspectedWordInfo.profile.baab}
                      </span>
                    )}
                    {inspectedWordInfo.profile.wazan && (
                      <span className="text-[11px] bg-white border border-[#E8DCC8] px-2 py-0.5 rounded font-arabic text-[#795548]">
                        الوزن: <strong className="text-[#3E2723]">{inspectedWordInfo.profile.wazan}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Actions (Recite Verse, Mastery Toggle, Close) */}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => startPlayingVerse(inspectedWordInfo.verseKey)}
                  className="px-3 py-1.5 rounded-lg bg-[#8B3A3A] hover:bg-[#702d2d] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Recite {inspectedWordInfo.verseKey}</span>
                </button>

                {inspectedWordInfo.matchedWord && onToggleState && (
                  <button
                    onClick={() => {
                      const w = inspectedWordInfo.matchedWord!;
                      const states: LearnedState[] = ['new', 'learning', 'review', 'known', 'mastered'];
                      const nextState = states[(states.indexOf(w.learnedState) + 1) % states.length];
                      onToggleState(w.id, 'word', nextState);
                      setInspectedWordInfo({
                        ...inspectedWordInfo,
                        matchedWord: { ...w, learnedState: nextState }
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#FAF6F1] border border-[#D4A574] text-[#3E2723] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Cycle vocabulary mastery state"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#8B3A3A]" />
                    <span className="capitalize">{inspectedWordInfo.matchedWord.learnedState}</span>
                  </button>
                )}

                <button
                  onClick={() => setInspectedWordInfo(null)}
                  className="p-1.5 rounded-lg text-[#795548] hover:text-[#3E2723] hover:bg-[#E8DCC8]/40 transition-colors cursor-pointer"
                  title="Close Word Inspector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Root Family (Ishtiqaaq) Derivatives Row */}
            {inspectedWordInfo.rootFamily.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-[#E8DCC8]/60 flex items-center gap-2 overflow-x-auto">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B3A3A] flex items-center gap-1 shrink-0">
                  <Sparkles className="w-3 h-3 text-[#D4A574]" /> Root Family (المشتقات):
                </span>
                <div className="flex items-center gap-1.5">
                  {inspectedWordInfo.rootFamily.map(sib => (
                    <span
                      key={sib.id}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white border border-[#E8DCC8] text-xs shrink-0"
                    >
                      <span className="font-arabic text-sm text-[#8B3A3A] font-bold">{sib.arabic}</span>
                      <span className="text-[10px] text-[#795548] font-serif-eng">
                        {sib.translations[lang as LanguageCode] || sib.translations.en}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Synchronized Recitation Audio Player Panel */}
      {(() => {
        if (!playingVerse) return null;
        
        let audioUrl = getAudioUrl(playingVerse.chapter_id, playingVerse.verse_number);
        let nextAudioUrl: string | undefined = undefined;
        let segments = getSegmentsForVerse(playingVerse.chapter_id, playingVerse.verse_number);
        let words = playingVerse.text_uthmani.split(' ');
        let title = `Now Reciting: Verse ${playingVerse.chapter_id}:${playingVerse.verse_number}`;

        const sNum = playingVerse.chapter_id;
        const aNum = playingVerse.verse_number;
        const currentIdx = verses.findIndex(v => Number(v.chapter_id) === sNum && Number(v.verse_number) === aNum);
        
        if (playingBismillah) {
          audioUrl = getAudioUrl(1, 1);
          nextAudioUrl = getAudioUrl(playingVerse.chapter_id, playingVerse.verse_number);
          segments = getSegmentsForVerse(1, 1);
          words = ['بِسۡمِ', 'ٱللّٰهِ', 'ٱلرَّحۡمٰنِ', 'ٱلرَّحِيمِ'];
          title = `Now Reciting: Bismillah (Surah ${playingVerse.chapter_id} Introduction)`;
        } else {
          if (currentIdx !== -1 && currentIdx < verses.length - 1) {
            const nextVerse = verses[currentIdx + 1];
            nextAudioUrl = getAudioUrl(nextVerse.chapter_id, nextVerse.verse_number);
          }
        }

        return (
          <div className="bg-[#FAF6F1]/95 backdrop-blur-md border-t border-[#E8DCC8] p-2.5 sm:p-4 shadow-2xl z-40 animate-slideUp">
            <div className="max-w-3xl mx-auto flex flex-col space-y-1 sm:space-y-2">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-[10px] sm:text-[11px] font-bold text-[#8B3A3A] uppercase tracking-wider font-mono">
                  {title}
                </h3>
                <button
                  onClick={() => {
                    setPlayingVerseKey(null);
                    setPlayingWordIndex(null);
                    setPlayingWordEndIndex(null);
                    setPlayingBismillah(false);
                    setRecitationEnabled(false);
                  }}
                  className="text-[#795548] hover:text-[#8B3A3A] text-[11px] sm:text-xs font-bold cursor-pointer"
                >
                  Close Player
                </button>
              </div>
              <AudioPlayer
                audioUrl={audioUrl}
                nextAudioUrl={nextAudioUrl}
                segments={segments}
                words={words}
                arabicFontSize={arabicFontSize}
                onEnded={handleAudioEnded}
                onNext={handleNextVerse}
                onPrev={handlePrevVerse}
                onWordHighlight={handleWordHighlightUpdate}
                selectedReciterId={selectedReciterId}
                onReciterChange={handleReciterChange}
                reciters={RECITERS}
                isDownloading={isDownloadingTiming}
              />
            </div>
          </div>
        );
      })()}

      {/* Auto Scroll Status Indicator */}
      {autoScroll && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-[#8B3A3A] text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-50">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span className="text-xs font-bold">Auto-scrolling at {scrollSpeed}x</span>
          <span className="text-xs opacity-75">(Touch to pause)</span>
        </div>
      )}
    </div>
  );
}

// Helper functions
export function getSurahName(surah: number): string {
  const names = [
    "Al-Fatiha", "Al-Baqara", "Al-Imran", "An-Nisa", "Al-Ma'ida", "Al-An'am", "Al-A'raf", "Al-Anfal", "At-Tawba", "Yunus",
    "Hud", "Yusuf", "Ar-Ra'd", "Ibrahim", "Al-Hijr", "An-Nahl", "Al-Isra", "Al-Kahf", "Maryam", "Ta-Ha",
    "Al-Anbiya", "Al-Hajj", "Al-Mu'minun", "An-Nur", "Al-Furqan", "Ash-Shu'ara", "An-Naml", "Al-Qasas", "Al-Ankabut", "Ar-Rum",
    "Luqman", "As-Sajda", "Al-Ahzab", "Saba", "Fatir", "Ya-Sin", "As-Saffat", "Sad", "Az-Zumar", "Ghafir",
    "Fussilat", "Ash-Shura", "Az-Zukhruf", "Ad-Dukhan", "Al-Jathiya", "Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hujurat", "Qaf",
    "Adh-Dhariyat", "At-Tur", "An-Najm", "Al-Qamar", "Ar-Rahman", "Al-Waqi'a", "Al-Hadid", "Al-Mujadila", "Al-Hashr", "Al-Mumtahina",
    "As-Saff", "Al-Jumu'a", "Al-Munafiqun", "At-Taghabun", "At-Talaq", "At-Tahrim", "Al-Mulk", "Al-Qalam", "Al-Haqqa", "Al-Ma'arij",
    "Nuh", "Al-Jinn", "Al-Muzzammil", "Al-Muddaththir", "Al-Qiyama", "Al-Insan", "Al-Mursalat", "An-Naba", "An-Nazi'at", "Abasa",
    "At-Takwir", "Al-Infitar", "Al-Mutaffifin", "Al-Inshiqaq", "Al-Buruj", "At-Tariq", "Al-A'la", "Al-Ghashiya", "Al-Fajr", "Al-Balad",
    "Ash-Shams", "Al-Layl", "Ad-Duha", "Al-Inshirah", "At-Tin", "Al-Alaq", "Al-Qadr", "Al-Bayyina", "Az-Zalzala", "Al-Adiyat",
    "Al-Qari'a", "At-Takathur", "Al-Asr", "Al-Humaza", "Al-Fil", "Quraysh", "Al-Ma'un", "Al-Kawthar", "Al-Kafirun", "An-Nasr",
    "Al-Masad", "Al-Ikhlas", "Al-Falaq", "An-Nas"
  ];
  return names[surah - 1] || `Surah ${surah}`;
}

export function getSurahNameArabic(surah: number): string {
  const names = [
    "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
    "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
    "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
    "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
    "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
    "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
    "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملک", "القلم", "الحاقة", "المعارج",
    "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
    "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
    "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
    "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر",
    "المسد", "الإخلاص", "الفلق", "الناس"
  ];
  return names[surah - 1] || `سورة ${surah}`;
}

export function getParaNameArabic(para: number): string {
  const names = [
    "الم",
    "سيقول",
    "تلك الرسل",
    "لن تنالوا",
    "والمحصنات",
    "لا يحب الله",
    "وإذا سمعوا",
    "ولو أننا",
    "قال الملأ",
    "واعلموا",
    "يعتذرون",
    "وما من دابة",
    "وما أبرئ",
    "ربما",
    "سبحان الذي",
    "قال ألم",
    "اقترب للناس",
    "قد أفلح",
    "وقال الذين",
    "أمن خلق",
    "اتل ما أوحي",
    "ومن يقنت",
    "وما لي",
    "فمن أظلم",
    "إليه يرد",
    "حم",
    "قال فما خطبكم",
    "قد سمع الله",
    "تبارك الذي",
    "عم"
  ];
  return names[para - 1] || `${para}`;
}

function getParaStartSurah(para: number): number {
  const starts = [
    1, 2, 2, 3, 4, 4, 5, 5, 6, 6,
    7, 8, 9, 10, 11, 12, 13, 15, 16, 17,
    18, 19, 20, 21, 22, 23, 24, 25, 26, 27
  ];
  return starts[para - 1] || 1;
}

function getParaEndSurah(para: number): number {
  const ends = [
    1, 2, 3, 3, 4, 5, 5, 6, 6, 7,
    7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    17, 18, 18, 19, 20, 21, 22, 23, 24, 25
  ];
  return ends[para - 1] || 114;
}
