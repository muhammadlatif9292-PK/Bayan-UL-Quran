/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  BookOpen, 
  List, 
  Sparkles, 
  X, 
  Volume2,
  Download,
  Pause,
  Play,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Check,
  History
} from 'lucide-react';
import { getParaNameArabic, RECITERS } from './QuranReading';
import { recitationDownloader, DownloadState } from '../lib/recitationDownloader';

interface RecitationHistoryItem {
  type: 'surah' | 'para';
  id: number;
  name: string;
  arabicName?: string;
  scrollY: number;
  timestamp: number;
}

interface QuranRecitationProps {
  onBack: () => void;
  onSurahClick: (surah: number) => void;
  onParaClick: (para: number) => void;
  translate: (key: string) => string;
  isRtl: boolean;
  recentRecitations?: RecitationHistoryItem[];
}

export function QuranRecitation({
  onBack,
  onSurahClick,
  onParaClick,
  translate,
  isRtl,
  recentRecitations = []
}: QuranRecitationProps) {
  const [activeTab, setActiveTab] = useState<'surah' | 'para'>('surah');
  const [showSyncGuide, setShowSyncGuide] = useState<boolean>(() => {
    try {
      return localStorage.getItem('quran_hide_sync_guide') !== 'true';
    } catch (e) {
      return true;
    }
  });
  const [isGuideExpanded, setIsGuideExpanded] = useState<boolean>(false);

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

  const [selectedQariId, setSelectedQariId] = useState<string>(() => {
    try {
      return localStorage.getItem('quran_selected_reciter_id') || 'alafasy';
    } catch (e) {
      return 'alafasy';
    }
  });

  const [downloadState, setDownloadState] = useState<DownloadState>(() => recitationDownloader.getState());
  const [cacheStatuses, setCacheStatuses] = useState<Record<string, { total: number; cached: number; isCompleted: boolean }>>({});
  const [overallOfflineCount, setOverallOfflineCount] = useState<number>(0);
  const totalQuranAyahs = 6236;

  const activeQariName = RECITERS.find(r => r.id === selectedQariId)?.name || 'Mishary Alafasy';

  // Dynamic status updates & subscription
  useEffect(() => {
    let isMounted = true;

    const checkAll = async () => {
      const statuses: Record<string, { total: number; cached: number; isCompleted: boolean }> = {};
      let quranCachedCount = 0;

      // Check Surahs
      const surahPromises = Array.from({ length: 114 }, async (_, i) => {
        const surahNum = i + 1;
        const status = await recitationDownloader.getStatusFor('surah', surahNum, selectedQariId);
        if (isMounted) {
          statuses[`surah_${surahNum}`] = status;
        }
      });

      // Check Paras
      const paraPromises = Array.from({ length: 30 }, async (_, i) => {
        const paraNum = i + 1;
        const status = await recitationDownloader.getStatusFor('para', paraNum, selectedQariId);
        if (isMounted) {
          statuses[`para_${paraNum}`] = status;
        }
      });

      await Promise.all([...surahPromises, ...paraPromises]);

      // Calculate total cached verses for this reciter
      try {
        const cache = await caches.open('quran-audio-recitations');
        const keys = await cache.keys();
        const subfolder = RECITERS.find(r => r.id === selectedQariId)?.subfolder || 'Alafasy_128kbps';
        
        let count = 0;
        for (const req of keys) {
          if (req.url.includes(`/data/${subfolder}/`)) {
            count++;
          }
        }
        if (isMounted) {
          setOverallOfflineCount(count);
        }
      } catch (e) {
        console.error(e);
      }

      if (isMounted) {
        setCacheStatuses(statuses);
      }
    };

    checkAll();

    const unsubscribe = recitationDownloader.subscribe((state) => {
      if (isMounted) {
        setDownloadState(state);
      }

      if (state.status === 'completed' || state.status === 'idle') {
        checkAll();
      } else {
        // Update item-specific live percentage during active download
        if (state.type === 'surah' && state.id) {
          setCacheStatuses(prev => ({
            ...prev,
            [`surah_${state.id}`]: {
              total: state.totalFiles,
              cached: state.downloadedCount,
              isCompleted: state.status === 'completed'
            }
          }));
        } else if (state.type === 'para' && state.id) {
          setCacheStatuses(prev => ({
            ...prev,
            [`para_${state.id}`]: {
              total: state.totalFiles,
              cached: state.downloadedCount,
              isCompleted: state.status === 'completed'
            }
          }));
        } else if (state.type === 'quran') {
          // Sync live percentage for complete quran
          if (isMounted) {
            setOverallOfflineCount(state.downloadedCount);
          }
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [selectedQariId]);

  const handleDismissGuide = () => {
    setShowSyncGuide(false);
    try {
      localStorage.setItem('quran_hide_sync_guide', 'true');
    } catch (e) {}
  };

  const handleQariChange = (qariId: string) => {
    setSelectedQariId(qariId);
    try {
      localStorage.setItem('quran_selected_reciter_id', qariId);
    } catch (e) {}
  };

  const handleDownloadSurah = (surahNum: number, name: string) => {
    recitationDownloader.startDownload('surah', surahNum, selectedQariId, activeQariName);
  };

  const handleDownloadPara = (paraNum: number, name: string) => {
    recitationDownloader.startDownload('para', paraNum, selectedQariId, activeQariName);
  };

  const handleDownloadQuran = () => {
    recitationDownloader.startDownload('quran', null, selectedQariId, activeQariName);
  };

  const [confirmingClear, setConfirmingClear] = useState(false);

  const handleClearCache = async () => {
    setConfirmingClear(false);
    await recitationDownloader.clearCacheForQari(selectedQariId);
    // Force refreshing the cache counts
    setOverallOfflineCount(0);
    setCacheStatuses({});
    // Trigger a re-check
    const statuses: Record<string, { total: number; cached: number; isCompleted: boolean }> = {};
    
    const surahPromises = Array.from({ length: 114 }, async (_, i) => {
      const surahNum = i + 1;
      statuses[`surah_${surahNum}`] = { total: getSurahAyahCount(surahNum), cached: 0, isCompleted: false };
    });
    const paraPromises = Array.from({ length: 30 }, async (_, i) => {
      const paraNum = i + 1;
      statuses[`para_${paraNum}`] = { total: 100, cached: 0, isCompleted: false }; // estimation
    });
    await Promise.all([...surahPromises, ...paraPromises]);
    setCacheStatuses(statuses);
  };

  // Surah data
  const surahs = Array.from({ length: 114 }, (_, i) => ({
    number: i + 1,
    name: getSurahName(i + 1),
    ayahs: getSurahAyahCount(i + 1),
    nameArabic: getSurahNameArabic(i + 1)
  }));

  // Para (Juz) data
  const paras = Array.from({ length: 30 }, (_, i) => ({
    number: i + 1,
    name: `Juz ${i + 1}`,
    fromSurah: getParaStartSurah(i + 1),
    toSurah: getParaEndSurah(i + 1),
    nameArabic: getParaNameArabic(i + 1)
  }));

  return (
    <div className="min-h-screen bg-[#FAF6F1]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-[#E8DCC8] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#8B3A3A] hover:text-[#D4A574] transition-colors"
          >
            <ChevronLeft className={`w-5 h-5 ${isRtl ? 'rotate-180' : ''}`} />
            <span className="font-bold text-sm">Back</span>
          </button>
          
          <h1 className="text-xl font-bold text-[#3E2723] font-serif-eng">Quran Recitation</h1>
          
          <div className="w-20"></div>
        </div>
      </header>

      {/* Tab Switcher */}
      <div className="bg-white border-b border-[#E8DCC8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex gap-1 flex-grow mr-4">
              <button
                onClick={() => setActiveTab('surah')}
                className={`flex-1 py-3 px-4 font-bold text-sm transition-colors ${
                  activeTab === 'surah'
                    ? 'text-[#8B3A3A] border-b-2 border-[#8B3A3A] bg-[#FAF6F1]'
                    : 'text-[#795548] hover:text-[#3E2723] hover:bg-[#FAF6F1]/50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Surahs
                </div>
              </button>
              <button
                onClick={() => setActiveTab('para')}
                className={`flex-1 py-3 px-4 font-bold text-sm transition-colors ${
                  activeTab === 'para'
                    ? 'text-[#8B3A3A] border-b-2 border-[#8B3A3A] bg-[#FAF6F1]'
                    : 'text-[#795548] hover:text-[#3E2723] hover:bg-[#FAF6F1]/50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <List className="w-4 h-4" />
                  Paras (Juz)
                </div>
              </button>
            </div>

            {/* Sidebar toggle button */}
            <button
              onClick={handleToggleSidebar}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border rounded-lg transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                isSidebarOpen
                  ? 'bg-amber-50 text-[#8B3A3A] border-[#D4A574]/40 hover:bg-amber-100/80'
                  : 'bg-white text-[#795548] border-[#E8DCC8] hover:bg-[#FAF6F1]/80 hover:text-[#3E2723]'
              }`}
              title={isSidebarOpen ? 'Hide Downloads & History' : 'Show Downloads & History'}
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Intelligent Recitation Sync Guide Banner (Collapsible by default) */}
        {showSyncGuide && (
          <div className="mb-6 bg-white border border-[#E8DCC8] rounded-xl overflow-hidden shadow-xs hover:shadow-sm transition-all duration-300">
            {/* Header / Summary Bar */}
            <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-3 bg-gradient-to-r from-amber-50/40 via-white to-amber-50/40">
              <button
                type="button"
                onClick={() => setIsGuideExpanded(prev => !prev)}
                className="flex items-center gap-2.5 flex-grow text-left cursor-pointer group"
                title={isGuideExpanded ? 'Collapse recitation guide' : 'Expand recitation guide'}
                aria-expanded={isGuideExpanded}
              >
                <div className="p-1.5 bg-amber-50 rounded-lg border border-amber-200 shrink-0 text-amber-700 group-hover:bg-amber-100/70 transition-colors">
                  <Sparkles className="w-4 h-4 text-amber-700" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-bold text-[#3E2723] font-serif-eng group-hover:text-[#8B3A3A] transition-colors">
                    Professional Recitation & Active Word-Sync
                  </h3>
                  <span className="text-[10px] text-[#795548]/70 font-medium hidden md:inline">
                    · Multiple Qaris & live highlights
                  </span>
                </div>
              </button>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsGuideExpanded(prev => !prev)}
                  className="flex items-center gap-1 text-xs text-[#795548] hover:text-[#8B3A3A] px-2 py-1 rounded-md hover:bg-black/5 transition-colors cursor-pointer"
                  title={isGuideExpanded ? 'Hide guide details' : 'Show guide details'}
                  aria-label={isGuideExpanded ? 'Hide guide details' : 'Show guide details'}
                >
                  <span className="hidden sm:inline text-[11px] font-medium">
                    {isGuideExpanded ? 'Hide Details' : 'Show Details'}
                  </span>
                  {isGuideExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[#8B3A3A]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#8B3A3A]" />
                  )}
                </button>

                <div className="w-px h-4 bg-[#E8DCC8] hidden sm:block mx-0.5" />

                <button
                  type="button"
                  onClick={handleDismissGuide}
                  className="text-[#795548]/70 hover:text-[#8B3A3A] transition-colors p-1.5 rounded-full hover:bg-black/5 cursor-pointer"
                  title="Permanently dismiss guide"
                  aria-label="Permanently dismiss guide"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expandable Details Section */}
            {isGuideExpanded && (
              <div className="px-4 pb-4 pt-2 border-t border-[#E8DCC8]/60 bg-white">
                <p className="text-xs text-[#795548] mt-1 leading-relaxed max-w-3xl">
                  Listen to beautiful recitations from multiple renowned Qaris (Mishary Alafasy, Abdur-Rahman As-Sudais, Mahmoud Al-Husary, Saad Al-Ghamdi, and more) with intelligent visual enhancements:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <div className="bg-[#FAF6F1]/50 border border-[#E8DCC8]/40 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#8B3A3A]">
                      <Volume2 className="w-3.5 h-3.5 text-[#8B3A3A]" />
                      <span>Multiple Qaris</span>
                    </div>
                    <p className="text-[11px] text-[#795548] mt-1 leading-normal">
                      Select your favorite reciter from the settings menu or the active audio player at any time.
                    </p>
                  </div>
                  <div className="bg-[#FAF6F1]/50 border border-[#E8DCC8]/40 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#8B3A3A]">
                      <Sparkles className="w-3.5 h-3.5 text-[#8B3A3A]" />
                      <span>Dynamic Word-Sync</span>
                    </div>
                    <p className="text-[11px] text-[#795548] mt-1 leading-normal">
                      Word-by-word highlights are downloaded on the fly, with high-fidelity interpolation fallbacks.
                    </p>
                  </div>
                  <div className="bg-[#FAF6F1]/50 border border-[#E8DCC8]/40 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#8B3A3A]">
                      <BookOpen className="w-3.5 h-3.5 text-[#8B3A3A]" />
                      <span>Interactive Playback</span>
                    </div>
                    <p className="text-[11px] text-[#795548] mt-1 leading-normal">
                      Tap any single verse to begin recitation, follow the glowing live highlight, or toggle Auto-Scroll.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Main content grid on the left */}
          <div className={`w-full transition-all duration-300 ${isSidebarOpen ? 'lg:w-[68%]' : 'lg:w-full'}`}>
            
            {/* Top Quick Download & Reciter Banner */}
            <div className="mb-6 bg-gradient-to-r from-amber-50/90 via-white to-amber-50/90 border border-[#D4A574]/40 rounded-xl p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-[#8B3A3A]" />
                    <h3 className="text-xs font-bold text-[#3E2723] uppercase tracking-wider font-serif-eng">
                      Download Offline Recitations
                    </h3>
                  </div>
                  <p className="text-xs text-[#795548] mt-1">
                    Selected Reciter: <strong className="text-[#3E2723]">{activeQariName}</strong> ({overallOfflineCount} / {totalQuranAyahs} verses cached)
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                  {/* Reciter Selector */}
                  <select
                    value={selectedQariId}
                    onChange={(e) => handleQariChange(e.target.value)}
                    className="bg-white border border-[#E8DCC8] text-xs font-bold text-[#3E2723] font-mono px-3 py-1.5 rounded-lg focus:ring-1 focus:ring-[#8B3A3A] focus:outline-hidden cursor-pointer"
                  >
                    {RECITERS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>

                  {/* Complete Quran Download Button */}
                  {overallOfflineCount < totalQuranAyahs && downloadState.status !== 'downloading' && (
                    <button
                      onClick={handleDownloadQuran}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#8B3A3A] hover:bg-[#702d2d] rounded-lg shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download All Quran</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar if actively downloading */}
              {(downloadState.status === 'downloading' || downloadState.status === 'paused') && (
                <div className="mt-3 pt-3 border-t border-[#D4A574]/30">
                  <div className="flex justify-between items-center text-xs font-mono mb-1">
                    <span className="text-[#8B3A3A] font-bold">
                      {downloadState.status === 'downloading' ? 'Downloading Recitation Audio...' : 'Download Paused'}
                    </span>
                    <span className="text-[#3E2723] font-bold">
                      {downloadState.downloadedCount} / {downloadState.totalFiles} ({Math.round((downloadState.downloadedCount / downloadState.totalFiles) * 100) || 0}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#E8DCC8]/40 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-[#D4A574] to-[#8B3A3A] h-full transition-all duration-300"
                      style={{ width: `${Math.round((downloadState.downloadedCount / downloadState.totalFiles) * 100) || 0}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {activeTab === 'surah' ? (
              <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${isSidebarOpen ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4`}>
                {surahs.map((surah) => {
                  const status = cacheStatuses[`surah_${surah.number}`];
                  const isDownloading = downloadState.status === 'downloading' && downloadState.type === 'surah' && downloadState.id === surah.number;
                  const isPaused = downloadState.status === 'paused' && downloadState.type === 'surah' && downloadState.id === surah.number;

                  return (
                    <div
                      key={surah.number}
                      onClick={() => onSurahClick(surah.number)}
                      className="bg-white border border-[#E8DCC8] rounded-xl p-4 hover:border-[#D4A574] hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between min-h-[140px] cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-2xl font-bold text-[#8B3A3A] font-mono">{surah.number}</span>
                        
                        {/* Inline Download Controller */}
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {status?.isCompleted ? (
                            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold">
                              <Check className="w-3 h-3" />
                              <span>Offline</span>
                            </div>
                          ) : isDownloading ? (
                            <div className="flex items-center gap-1 text-[#8B3A3A] bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold animate-pulse">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>{Math.round(((status?.cached || 0) / (status?.total || surah.ayahs)) * 100) || 0}%</span>
                            </div>
                          ) : isPaused ? (
                            <button
                              onClick={() => recitationDownloader.resume()}
                              className="flex items-center gap-1 text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-100 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold cursor-pointer transition-colors"
                              title="Resume download"
                            >
                              <Pause className="w-2.5 h-2.5" />
                              <span>Paused</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDownloadSurah(surah.number, surah.name)}
                              className="flex items-center gap-1 px-2 py-1 text-[#795548] hover:text-[#8B3A3A] bg-[#FAF6F1]/80 hover:bg-[#FAF6F1] border border-[#E8DCC8] rounded-lg cursor-pointer transition-all shadow-2xs"
                              title={`Download Surah ${surah.number} (${surah.name}) Recitation Audio`}
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-bold">Download</span>
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right" dir="rtl">
                        <p className="text-lg font-bold text-[#3E2723] font-arabic leading-none mb-1">{surah.nameArabic}</p>
                        <p className="text-xs text-[#795548] font-medium font-serif-eng leading-none mb-1">{surah.name}</p>
                        <span className="text-[10px] text-[#795548]/70 font-mono">
                          {surah.ayahs} verses
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${isSidebarOpen ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4`}>
                {paras.map((para) => {
                  const status = cacheStatuses[`para_${para.number}`];
                  const isDownloading = downloadState.status === 'downloading' && downloadState.type === 'para' && downloadState.id === para.number;
                  const isPaused = downloadState.status === 'paused' && downloadState.type === 'para' && downloadState.id === para.number;

                  return (
                    <div
                      key={para.number}
                      onClick={() => onParaClick(para.number)}
                      className="bg-white border border-[#E8DCC8] rounded-xl p-4 hover:border-[#D4A574] hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between min-h-[140px] cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-2xl font-bold text-[#8B3A3A] font-mono">{para.number}</span>
                        
                        {/* Inline Download Controller */}
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {status?.isCompleted ? (
                            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold">
                              <Check className="w-3 h-3" />
                              <span>Offline</span>
                            </div>
                          ) : isDownloading ? (
                            <div className="flex items-center gap-1 text-[#8B3A3A] bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold animate-pulse">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>{Math.round(((status?.cached || 0) / (status?.total || 1)) * 100) || 0}%</span>
                            </div>
                          ) : isPaused ? (
                            <button
                              onClick={() => recitationDownloader.resume()}
                              className="flex items-center gap-1 text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-100 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold cursor-pointer transition-colors"
                              title="Resume download"
                            >
                              <Pause className="w-2.5 h-2.5" />
                              <span>Paused</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDownloadPara(para.number, para.name)}
                              className="flex items-center gap-1 px-2 py-1 text-[#795548] hover:text-[#8B3A3A] bg-[#FAF6F1]/80 hover:bg-[#FAF6F1] border border-[#E8DCC8] rounded-lg cursor-pointer transition-all shadow-2xs"
                              title={`Download Juz ${para.number} Recitation Audio`}
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-bold">Download</span>
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right" dir="rtl">
                        <p className="text-lg font-bold text-[#3E2723] font-arabic leading-none mb-1">{para.nameArabic}</p>
                        <p className="text-xs text-[#795548] font-medium font-serif-eng leading-none mb-1">{para.name}</p>
                        <span className="text-[10px] text-[#795548]/70 font-mono">
                          Surah {para.fromSurah} - {para.toSurah}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column (Sidebar) */}
          {isSidebarOpen && (
            <aside className="w-full lg:w-[32%] lg:sticky lg:top-24 space-y-6 shrink-0">
              {/* Offline Audio Downloads Manager Card */}
              <div className="bg-white border border-[#E8DCC8] rounded-xl p-5 shadow-xs">
                <div className="border-b border-[#E8DCC8]/40 pb-3 mb-3">
                  <h2 className="text-xs font-bold text-[#3E2723] uppercase tracking-wider flex items-center gap-2 font-serif-eng">
                    <Download className="w-3.5 h-3.5 text-[#8B3A3A]" />
                    Offline Downloads
                  </h2>
                  <p className="text-[11px] text-[#795548] mt-1 leading-normal">
                    Download recitation audio files to your browser's persistent cache for reliable offline reading.
                  </p>
                </div>
                
                <div className="space-y-3 mb-4">
                  {/* Reciter dropdown selector */}
                  <div className="flex items-center justify-between gap-2 bg-[#FAF6F1] px-3 py-1.5 rounded-lg border border-[#E8DCC8]/60">
                    <span className="text-[11px] font-bold text-[#795548]">Reciter:</span>
                    <select
                      value={selectedQariId}
                      onChange={(e) => handleQariChange(e.target.value)}
                      className="bg-transparent border-0 text-xs font-bold text-[#3E2723] font-mono focus:ring-0 focus:outline-hidden cursor-pointer"
                    >
                      {RECITERS.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Main Storage Actions */}
                  <div className="flex flex-col gap-2">
                    {overallOfflineCount < totalQuranAyahs && downloadState.status !== 'downloading' && (
                      <button
                        onClick={handleDownloadQuran}
                        className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-bold text-white bg-[#8B3A3A] hover:bg-[#702d2d] rounded-lg shadow-sm transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Complete Quran</span>
                      </button>
                    )}

                    {overallOfflineCount > 0 && !confirmingClear && (
                      <button
                        onClick={() => setConfirmingClear(true)}
                        className="flex items-center justify-center gap-1 w-full py-2 text-xs font-bold text-[#8B3A3A] bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
                        title="Delete downloaded recitations for this Qari"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear {overallOfflineCount} Verses</span>
                      </button>
                    )}

                    {overallOfflineCount > 0 && confirmingClear && (
                      <div className="bg-red-50/80 border border-red-200 rounded-lg p-2.5 space-y-2">
                        <p className="text-[10px] text-[#8B3A3A] font-semibold leading-snug">
                          Delete {overallOfflineCount} cached verses for {activeQariName}?
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={handleClearCache}
                            className="flex-1 py-1.5 text-[10px] font-bold text-white bg-[#8B3A3A] hover:bg-[#702d2d] rounded cursor-pointer transition-colors"
                          >
                            Confirm Clear
                          </button>
                          <button
                            onClick={() => setConfirmingClear(false)}
                            className="flex-1 py-1.5 text-[10px] font-bold text-[#795548] bg-white hover:bg-[#FAF6F1] border border-[#E8DCC8] rounded cursor-pointer transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Overall Qari Cache Count */}
                <div className="flex flex-col gap-1 text-[11px] text-[#795548] font-mono bg-[#FAF6F1]/50 border border-[#E8DCC8]/20 rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${overallOfflineCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    <span><strong>{activeQariName}</strong>:</span>
                  </div>
                  <div className="text-[#3E2723] font-bold mt-0.5">
                    {overallOfflineCount.toLocaleString()} / {totalQuranAyahs.toLocaleString()} verses ({Math.round((overallOfflineCount / totalQuranAyahs) * 100)}% cached)
                  </div>
                </div>

                {/* Active Downloading Progress Bar Panel */}
                {(downloadState.status === 'downloading' || downloadState.status === 'paused') && (
                  <div className="mt-4 p-3 bg-[#FAF6F1] border border-dashed border-[#D4A574]/40 rounded-xl">
                    <div className="flex justify-between items-center gap-2 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="p-1 bg-amber-50 border border-amber-200 text-amber-600 rounded-lg shrink-0">
                          {downloadState.status === 'downloading' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8B3A3A]" />
                          ) : (
                            <Pause className="w-3.5 h-3.5 text-amber-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-[10px] font-bold text-[#3E2723] truncate">
                            {downloadState.status === 'downloading' ? 'Downloading...' : 'Paused'}
                          </h4>
                          <p className="text-[9px] text-[#795548] font-mono truncate">
                            {downloadState.type === 'quran' 
                              ? `All Quran` 
                              : `${downloadState.type === 'surah' ? 'Surah' : 'Juz'} ${downloadState.id}`
                            }
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {downloadState.status === 'downloading' ? (
                          <button
                            onClick={() => recitationDownloader.pause()}
                            className="p-1 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md cursor-pointer transition-colors"
                            title="Pause"
                          >
                            <Pause className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => recitationDownloader.resume()}
                            className="p-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md cursor-pointer transition-colors"
                            title="Resume"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => recitationDownloader.cancel()}
                          className="p-1 text-[#8B3A3A] bg-red-50 hover:bg-red-100 border border-red-200 rounded-md cursor-pointer transition-colors"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress track */}
                    <div className="w-full bg-[#E8DCC8]/40 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-[#D4A574] to-[#8B3A3A] h-full transition-all duration-300"
                        style={{ width: `${Math.round((downloadState.downloadedCount / downloadState.totalFiles) * 100) || 0}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-1.5 text-[9px] text-[#795548] font-mono">
                      <span>{downloadState.downloadedCount} / {downloadState.totalFiles}</span>
                      <span className="font-bold text-[#3E2723]">{Math.round((downloadState.downloadedCount / downloadState.totalFiles) * 100) || 0}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Recitations (Continue Recitation) */}
              {recentRecitations && recentRecitations.length > 0 && (
                <div className="bg-gradient-to-r from-[#FAF6F1]/60 to-[#FFF] rounded-xl border border-[#D4A574]/30 p-5 shadow-xs">
                  <h2 className="text-xs font-bold text-[#8B3A3A] uppercase tracking-wider mb-3.5 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B3A3A] animate-pulse"></span>
                    Continue Recitation
                  </h2>
                  <div className="flex flex-col gap-3">
                    {recentRecitations.slice(0, 3).map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          if (item.type === 'surah') {
                            onSurahClick(item.id);
                          } else {
                            onParaClick(item.id);
                          }
                        }}
                        className="bg-white border border-[#E8DCC8] hover:border-[#8B3A3A] rounded-lg p-3 text-left transition-all hover:shadow-sm flex flex-col justify-between group cursor-pointer w-full"
                      >
                        <div className="flex justify-between items-start w-full gap-2">
                          <span className="text-[9px] font-mono text-[#795548] bg-[#FAF6F1] px-1.5 py-0.5 rounded-md font-bold shrink-0">
                            {item.type === 'surah' ? 'Surah' : 'Juz'} {item.id}
                          </span>
                          <span className="text-[8px] text-[#795548]/80 font-mono text-right truncate">
                            {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        
                        <div className="my-2 flex items-baseline justify-between w-full gap-2">
                          <div className="min-w-0">
                            <h3 className="font-bold text-xs text-[#3E2723] group-hover:text-[#8B3A3A] transition-colors leading-tight truncate">
                              {item.name}
                            </h3>
                            {item.scrollY > 0 && (
                              <p className="text-[9px] text-[#795548]/70 mt-0.5 font-mono truncate">
                                Position: {Math.round(item.scrollY)}px
                              </p>
                            )}
                          </div>
                          {item.arabicName && (
                            <span className="text-sm font-arabic text-[#8B3A3A] font-bold shrink-0">{item.arabicName}</span>
                          )}
                        </div>
                        
                        <div className="text-[9px] text-[#8B3A3A] font-bold flex items-center gap-0.5 mt-1 group-hover:translate-x-0.5 transition-transform shrink-0">
                          Resume Reading <ChevronRight className="w-2.5 h-2.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}

// Helper functions for surah data
function getSurahName(surah: number): string {
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

function getSurahNameArabic(surah: number): string {
  const names = [
    "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
    "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
    "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
    "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
    "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
    "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
    "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
    "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
    "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
    "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
    "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر",
    "المسد", "الإخلاص", "الفلق", "الناس"
  ];
  return names[surah - 1] || `سورة ${surah}`;
}

function getSurahAyahCount(surah: number): number {
  const counts = [
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
  return counts[surah - 1] || 0;
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
