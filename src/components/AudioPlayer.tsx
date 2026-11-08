/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, SkipForward, SkipBack, Minimize2, Maximize2, Minus, Plus, ChevronDown } from 'lucide-react';
import { normalizeArabicText } from '../lib/quranUtils';

export type SegmentTuple = [number, number, number, number]; // [word_start_index, word_end_index, start_ms, end_ms]

export interface ReciterInfo {
  id: string;
  name: string;
  subfolder: string;
  bitrate: string;
  hasTimingData: boolean;
}

interface AudioPlayerProps {
  audioUrl: string;
  nextAudioUrl?: string;
  segments: SegmentTuple[];
  words: string[];
  onEnded?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  arabicFontSize?: number;
  onWordHighlight?: (start: number | null, end?: number | null) => void;
  selectedReciterId?: string;
  onReciterChange?: (id: string) => void;
  reciters?: ReciterInfo[];
  isDownloading?: boolean;
}

/**
 * Computes prioritized candidates for Quran audio.
 * Supports EveryAyah, Islamic Network, Al Quran Cloud, and local assets.
 */
function getAudioCandidates(url: string): string[] {
  if (!url) return [];

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

  const globalAyahIndexToSurahAyah = (globalIdx: number): { surah: number; ayah: number } => {
    let count = 0;
    for (let i = 0; i < SURAH_VERSE_COUNTS.length; i++) {
      const versesInSurah = SURAH_VERSE_COUNTS[i];
      if (globalIdx <= count + versesInSurah) {
        return {
          surah: i + 1,
          ayah: globalIdx - count
        };
      }
      count += versesInSurah;
    }
    return { surah: 1, ayah: 1 };
  };

  const editionToSubfolder: Record<string, string> = {
    'ar.alafasy': 'Alafasy_128kbps',
    'ar.sudais': 'Abdurrahmaan_As-Sudais_192kbps',
    'ar.husary': 'Husary_128kbps',
    'ar.saadghamdi': 'Saad_Al-Ghamdi_128kbps',
    'ar.abdulbasitmujawwad': 'Abdul_Basit_Mujawwad_128kbps',
    'ar.maheralmuaiqly': 'Maher_AlMuaiqly_64kbps'
  };

  const subfolderToEdition: Record<string, string> = {
    'Alafasy_128kbps': 'ar.alafasy',
    'Abdurrahmaan_As-Sudais_192kbps': 'ar.sudais',
    'Husary_128kbps': 'ar.husary',
    'Saad_Al-Ghamdi_128kbps': 'ar.saadghamdi',
    'Abdul_Basit_Mujawwad_128kbps': 'ar.abdulbasitmujawwad',
    'Maher_AlMuaiqly_64kbps': 'ar.maheralmuaiqly'
  };

  let surah = 1;
  let ayah = 1;
  let edition = 'ar.alafasy';
  let subfolder = 'Alafasy_128kbps';
  let hasParsed = false;

  const islamicMatch = url.match(/\/quran\/audio\/\d+\/([^/]+)\/(\d+)/);
  const alquranMatch = url.match(/\/media\/audio\/ayah\/([^/]+)\/(\d+)/);

  if (islamicMatch) {
    edition = islamicMatch[1];
    const globalIdx = Number(islamicMatch[2]);
    const res = globalAyahIndexToSurahAyah(globalIdx);
    surah = res.surah;
    ayah = res.ayah;
    subfolder = editionToSubfolder[edition] || 'Alafasy_128kbps';
    hasParsed = true;
  } else if (alquranMatch) {
    edition = alquranMatch[1];
    const globalIdx = Number(alquranMatch[2]);
    const res = globalAyahIndexToSurahAyah(globalIdx);
    surah = res.surah;
    ayah = res.ayah;
    subfolder = editionToSubfolder[edition] || 'Alafasy_128kbps';
    hasParsed = true;
  } else {
    const everyayahMatch = url.match(/\/data\/([^/]+)\/(\d{3})(\d{3})\.mp3/);
    if (everyayahMatch) {
      subfolder = everyayahMatch[1];
      surah = Number(everyayahMatch[2]);
      ayah = Number(everyayahMatch[3]);
      edition = subfolderToEdition[subfolder] || 'ar.alafasy';
      hasParsed = true;
    } else {
      const filenameMatch = url.match(/(\d{3})(\d{3})\.mp3$/);
      if (filenameMatch) {
        surah = Number(filenameMatch[1]);
        ayah = Number(filenameMatch[2]);
        edition = 'ar.alafasy';
        subfolder = 'Alafasy_128kbps';
        hasParsed = true;
      }
    }
  }

  if (!hasParsed) {
    return [url];
  }

  const globalAyahIdx = getGlobalAyahIndex(surah, ayah);
  const sStr = String(surah).padStart(3, '0');
  const aStr = String(ayah).padStart(3, '0');
  const filename = `${sStr}${aStr}.mp3`;

  const candidates: string[] = [];

  if (surah === 1 && ayah <= 7) {
    candidates.push(`/audio/${filename}`);
  }

  candidates.push(`https://everyayah.com/data/${subfolder}/${filename}`);
  candidates.push(`https://www.everyayah.com/data/${subfolder}/${filename}`);
  candidates.push(`https://cdn.islamic.network/quran/audio/128/${edition}/${globalAyahIdx}.mp3`);
  candidates.push(`https://cdn.islamic.network/quran/audio/64/${edition}/${globalAyahIdx}.mp3`);
  candidates.push(`https://cdn.alquran.cloud/media/audio/ayah/${edition}/${globalAyahIdx}`);

  if (!candidates.includes(url)) {
    candidates.push(url);
  }

  const localPath = `/audio/${filename}`;
  if (!candidates.includes(localPath)) {
    candidates.push(localPath);
  }

  return candidates;
}

export function AudioPlayer({
  audioUrl,
  nextAudioUrl,
  segments,
  words,
  onEnded,
  onNext,
  onPrev,
  arabicFontSize = 32,
  onWordHighlight,
  selectedReciterId = 'alafasy',
  onReciterChange,
  reciters = [],
  isDownloading = false
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isSpeedOpen, setIsSpeedOpen] = useState<boolean>(false);
  const [resolvedSrc, setResolvedSrc] = useState<string>('');
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('quran_recitation_speed');
      if (stored) {
        const val = parseFloat(stored);
        if (!isNaN(val) && val >= 0.5 && val <= 3.0) {
          return val;
        }
      }
    } catch (e) {}
    return 1.0;
  });

  const [localArabicFontSize, setLocalArabicFontSize] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('quran_recitation_font_size');
      if (stored) return parseInt(stored, 10);
    } catch (e) {}
    return arabicFontSize || 32;
  });

  const changeFontSize = (delta: number) => {
    setLocalArabicFontSize((prev) => {
      const next = Math.max(16, Math.min(64, prev + delta));
      try {
        localStorage.setItem('quran_recitation_font_size', String(next));
      } catch (e) {}
      return next;
    });
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    try {
      localStorage.setItem('quran_recitation_speed', String(speed));
    } catch (e) {}
    if (audioRef.current) {
      audioRef.current.defaultPlaybackRate = speed;
      audioRef.current.playbackRate = speed;
    }
  };

  // Sync font size prop if changed
  useEffect(() => {
    setLocalArabicFontSize(arabicFontSize || 32);
  }, [arabicFontSize]);
  const [isCompact, setIsCompact] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('quran_player_compact');
      if (stored !== null) return stored === 'true';
    } catch (e) {}
    return typeof window !== 'undefined' && window.innerWidth < 640;
  });

  const toggleCompact = () => {
    const nextVal = !isCompact;
    setIsCompact(nextVal);
    try {
      localStorage.setItem('quran_player_compact', String(nextVal));
    } catch (e) {}
  };

  const sources = React.useMemo(() => {
    return getAudioCandidates(audioUrl);
  }, [audioUrl]);

  const [currentSourceIndex, setCurrentSourceIndex] = useState<number>(0);
  const hasTriggeredEndRef = useRef(false);
  const isTransitioningSrcRef = useRef(false);
  const lastHighlightedWordRef = useRef<{ start: number | null; end: number | null }>({ start: null, end: null });

  // INSULATION LAYER: Hold parent callbacks in ref so that we can invoke them inside loops 
  // without triggering any hook dependency or effect reload when they are unstable.
  const callbacksRef = useRef({
    onWordHighlight,
    onEnded,
    onNext,
    onPrev,
    onReciterChange
  });

  useEffect(() => {
    callbacksRef.current = {
      onWordHighlight,
      onEnded,
      onNext,
      onPrev,
      onReciterChange
    };
  }, [onWordHighlight, onEnded, onNext, onPrev, onReciterChange]);

  // Stable trigger for dispatching highlights to parent
  const dispatchHighlight = React.useCallback((start: number | null, end: number | null = null) => {
    if (lastHighlightedWordRef.current.start !== start || lastHighlightedWordRef.current.end !== end) {
      lastHighlightedWordRef.current = { start, end };
      const cb = callbacksRef.current.onWordHighlight;
      if (cb) {
        cb(start, end);
      }
    }
  }, []);

  // Reset indices and flags when audioUrl prop changes
  useEffect(() => {
    setCurrentSourceIndex(0);
    isTransitioningSrcRef.current = true;
  }, [audioUrl]);

  const activeSrc = sources[currentSourceIndex] || '';

  // Effect to resolve offline cached audio if available
  useEffect(() => {
    let isMounted = true;
    let localBlobUrl = '';

    const resolveSource = async () => {
      if (!activeSrc) {
        setResolvedSrc('');
        return;
      }

      try {
        if (typeof window !== 'undefined' && window.caches) {
          const cache = await window.caches.open('quran-audio-recitations');
          const matched = await cache.match(activeSrc);
          if (matched && isMounted) {
            const blob = await matched.blob();
            localBlobUrl = URL.createObjectURL(blob);
            setResolvedSrc(localBlobUrl);
            return;
          }
        }
      } catch (e) {
        console.warn('Error checking offline cache:', e);
      }

      if (isMounted) {
        setResolvedSrc(activeSrc);
      }
    };

    resolveSource();

    return () => {
      isMounted = false;
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [activeSrc]);

  const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const error = e.currentTarget.error;
    console.warn(`Audio source failed to load: ${sources[currentSourceIndex]}`, error);
    
    if (currentSourceIndex < sources.length - 1) {
      const nextIndex = currentSourceIndex + 1;
      console.log(`Switching to fallback audio source index ${nextIndex}: ${sources[nextIndex]}`);
      setCurrentSourceIndex(nextIndex);
    } else {
      console.error('All audio sources failed.');
    }
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Pre-process activeSegments. Avoid overlaps and gap fluctuations
  const activeSegments = React.useMemo(() => {
    if (segments && segments.length > 0) {
      const expanded: SegmentTuple[] = [];
      for (const seg of segments) {
        const [wStart, wEnd, tStart, tEnd] = seg;
        const count = wEnd - wStart;
        if (count > 1) {
          const segDuration = tEnd - tStart;
          const chunk = segDuration / count;
          for (let i = 0; i < count; i++) {
            const wordIdx = wStart + i;
            const subStart = Math.round(tStart + i * chunk);
            const subEnd = Math.round(tStart + (i + 1) * chunk);
            expanded.push([wordIdx, wordIdx + 1, subStart, subEnd]);
          }
        } else {
          expanded.push([...seg] as SegmentTuple);
        }
      }

      expanded.sort((a, b) => a[0] - b[0]);

      // Normalize timings to remove overlap and make them continuous
      for (let i = 0; i < expanded.length; i++) {
        if (expanded[i][2] < 0) expanded[i][2] = 0;
        if (expanded[i][3] < expanded[i][2]) expanded[i][3] = expanded[i][2];

        if (i > 0) {
          if (expanded[i][2] < expanded[i - 1][2]) {
            expanded[i][2] = expanded[i - 1][2];
          }
          // Set previous end to current start so there is no gap in between
          expanded[i - 1][3] = expanded[i][2];
        }
      }

      return expanded;
    }
    
    // Fallback simulation based on word count
    if (words && words.length > 0 && duration > 0) {
      const wordCount = words.length;
      const durationMs = duration * 1000;
      const netDurationMs = Math.max(durationMs - 200, wordCount * 100);
      const wordDuration = netDurationMs / wordCount;
      const simulated: SegmentTuple[] = [];
      for (let i = 0; i < wordCount; i++) {
        const startMs = Math.round(i * wordDuration);
        const endMs = Math.round((i + 1) * wordDuration);
        simulated.push([i, i + 1, startMs, endMs]);
      }
      return simulated;
    }
    return [];
  }, [segments, words, duration]);

  // Stable binary search
  const binarySearchSegment = (timeMs: number): number => {
    let low = 0;
    let high = activeSegments.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const segment = activeSegments[mid];
      const startMs = segment[2];
      const endMs = segment[3];
      
      if (timeMs >= startMs && timeMs <= endMs) {
        return mid;
      } else if (timeMs < startMs) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return -1;
  };

  const handleEnded = () => {
    hasTriggeredEndRef.current = true;
    setActiveWordIndex(null);
    dispatchHighlight(null, null);
    const cb = callbacksRef.current.onEnded;
    if (cb) {
      cb();
    } else {
      setIsPlaying(false);
    }
  };

  const isSrcMatching = (src1: string, src2: string): boolean => {
    if (!src1 || !src2) return false;
    try {
      const u1 = new URL(src1).pathname;
      const u2 = new URL(src2).pathname;
      return u1 === u2;
    } catch (e) {
      return src1.includes(src2) || src2.includes(src1);
    }
  };

  const isAudioReadyAndMatching = () => {
    if (!audioRef.current || !activeSrc) return false;
    if (audioRef.current.readyState < 1) return false;
    return isSrcMatching(audioRef.current.currentSrc, activeSrc);
  };

  // Synchronize highlights using high-performance requestAnimationFrame
  useEffect(() => {
    let rAFId: number;

    const updateFrame = () => {
      if (audioRef.current) {
        if (isTransitioningSrcRef.current || !isAudioReadyAndMatching()) {
          setActiveWordIndex(null);
          dispatchHighlight(null, null);
          if (isPlaying) {
            rAFId = requestAnimationFrame(updateFrame);
          }
          return;
        }

        const timeMs = audioRef.current.currentTime * 1000;
        setCurrentTime(audioRef.current.currentTime);
        
        // Continuous gapless progression
        if (!hasTriggeredEndRef.current) {
          let shouldTrigger = false;
          const audioDuration = audioRef.current.duration;
          
          if (activeSegments && activeSegments.length > 0) {
            const lastSeg = activeSegments[activeSegments.length - 1];
            const lastWordEndMs = lastSeg[3];
            const naturalPauseMs = -150; 
            if (timeMs >= lastWordEndMs + naturalPauseMs) {
              shouldTrigger = true;
            }
          }
          
          if (audioDuration > 0 && audioRef.current.currentTime >= audioDuration - 0.65) {
            shouldTrigger = true;
          }
          
          if (shouldTrigger) {
            hasTriggeredEndRef.current = true;
            audioRef.current.pause();
            handleEnded();
            return;
          }
        }

        const segIndex = binarySearchSegment(timeMs);
        if (segIndex !== -1) {
          const [wordStart, wordEnd] = activeSegments[segIndex];
          setActiveWordIndex(wordStart);
          dispatchHighlight(wordStart, wordEnd);
        } else {
          // ANTI-FLICKER CORE: If we are still playing and the playhead falls into a minor gap
          // between the first word's start and the last word's end, we do NOT clear the active highlight.
          // This keeps the current word illuminated until the playhead advances to the next word.
          if (activeSegments.length > 0) {
            const firstStart = activeSegments[0][2];
            const lastEnd = activeSegments[activeSegments.length - 1][3];
            if (timeMs < firstStart || timeMs > lastEnd) {
              setActiveWordIndex(null);
              dispatchHighlight(null, null);
            }
          } else {
            setActiveWordIndex(null);
            dispatchHighlight(null, null);
          }
        }
      }
      if (isPlaying) {
        rAFId = requestAnimationFrame(updateFrame);
      }
    };

    if (isPlaying) {
      rAFId = requestAnimationFrame(updateFrame);
    } else {
      // Direct sync update when paused (handles manual seek updates immediately)
      if (audioRef.current) {
        if (!isAudioReadyAndMatching()) {
          setActiveWordIndex(null);
          dispatchHighlight(null, null);
          return;
        }
        const timeMs = audioRef.current.currentTime * 1000;
        setCurrentTime(audioRef.current.currentTime);
        const segIndex = binarySearchSegment(timeMs);
        if (segIndex !== -1) {
          const [wordStart, wordEnd] = activeSegments[segIndex];
          setActiveWordIndex(wordStart);
          dispatchHighlight(wordStart, wordEnd);
        } else {
          if (activeSegments.length > 0) {
            const firstStart = activeSegments[0][2];
            const lastEnd = activeSegments[activeSegments.length - 1][3];
            if (timeMs < firstStart || timeMs > lastEnd) {
              setActiveWordIndex(null);
              dispatchHighlight(null, null);
            }
          } else {
            setActiveWordIndex(null);
            dispatchHighlight(null, null);
          }
        }
      }
    }

    return () => {
      if (rAFId) {
        cancelAnimationFrame(rAFId);
      }
    };
  }, [isPlaying, activeSegments, activeSrc, dispatchHighlight]);

  // Audio loader trigger. ONLY runs when resolvedSrc changes. Guaranteed safe!
  useEffect(() => {
    hasTriggeredEndRef.current = false;
    if (audioRef.current && resolvedSrc) {
      isTransitioningSrcRef.current = true;
      
      // Force rate before loading
      audioRef.current.defaultPlaybackRate = playbackSpeed;
      audioRef.current.playbackRate = playbackSpeed;
      
      audioRef.current.load();
      
      // Force rate after loading
      audioRef.current.defaultPlaybackRate = playbackSpeed;
      audioRef.current.playbackRate = playbackSpeed;
      
      setActiveWordIndex(null);
      dispatchHighlight(null, null);
      setCurrentTime(0);
      setDuration(0);
      
      setIsPlaying(true);
      audioRef.current.play().catch(err => {
        console.log('Audio autoplay prevented or paused:', err);
        if (err.name !== 'AbortError') {
          setIsPlaying(false);
        }
      });
    }
  }, [resolvedSrc, dispatchHighlight, playbackSpeed]);

  // Sync duration with the audio element
  useEffect(() => {
    if (!audioRef.current) return;
    
    if (audioRef.current.duration) {
      setDuration(audioRef.current.duration);
    }

    const checkDuration = () => {
      if (audioRef.current && audioRef.current.duration) {
        setDuration(audioRef.current.duration);
      }
    };

    const audioEl = audioRef.current;
    audioEl.addEventListener('loadedmetadata', checkDuration);
    audioEl.addEventListener('durationchange', checkDuration);
    audioEl.addEventListener('play', checkDuration);
    audioEl.addEventListener('playing', checkDuration);
    audioEl.addEventListener('timeupdate', checkDuration);

    const interval = setInterval(checkDuration, 250);

    return () => {
      audioEl.removeEventListener('loadedmetadata', checkDuration);
      audioEl.removeEventListener('durationchange', checkDuration);
      audioEl.removeEventListener('play', checkDuration);
      audioEl.removeEventListener('playing', checkDuration);
      audioEl.removeEventListener('timeupdate', checkDuration);
      clearInterval(interval);
    };
  }, []);

  // Handle Playback Speed change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.defaultPlaybackRate = playbackSpeed;
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, activeSrc]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error('Play failed:', err);
          if (err.name !== 'AbortError') {
            setIsPlaying(false);
          }
        });
    }
  };

  const restartAudio = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    setActiveWordIndex(null);
    dispatchHighlight(null, null);
    setIsPlaying(true);
    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch(err => {
        console.error('Audio playback failed:', err);
        if (err.name !== 'AbortError') {
          setIsPlaying(false);
        }
      });
  };

  const handleWordTap = (wordIdx: number) => {
    if (!audioRef.current) return;
    const segment = activeSegments.find(s => s[0] === wordIdx);
    if (segment) {
      const startMs = segment[2];
      audioRef.current.currentTime = startMs / 1000;
      setCurrentTime(startMs / 1000);
      
      setActiveWordIndex(segment[0]);
      dispatchHighlight(segment[0], segment[1]);
      
      setIsPlaying(true);
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error('Audio playback failed:', err);
          if (err.name !== 'AbortError') {
            setIsPlaying(false);
          }
        });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      audioRef.current.defaultPlaybackRate = playbackSpeed;
      audioRef.current.playbackRate = playbackSpeed;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const newTime = parseFloat(e.target.value);
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      
      const timeMs = newTime * 1000;
      const segIndex = binarySearchSegment(timeMs);
      if (segIndex !== -1) {
        const [wordStart, wordEnd] = activeSegments[segIndex];
        setActiveWordIndex(wordStart);
        dispatchHighlight(wordStart, wordEnd);
      } else {
        if (activeSegments.length > 0) {
          const firstStart = activeSegments[0][2];
          const lastEnd = activeSegments[activeSegments.length - 1][3];
          if (timeMs < firstStart || timeMs > lastEnd) {
            setActiveWordIndex(null);
            dispatchHighlight(null, null);
          }
        } else {
          setActiveWordIndex(null);
          dispatchHighlight(null, null);
        }
      }
    }
  };

  const formatTime = (timeSec: number): string => {
    if (isNaN(timeSec) || !isFinite(timeSec)) return '0:00';
    const m = Math.floor(timeSec / 60);
    const s = Math.floor(timeSec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const onPrevClick = callbacksRef.current.onPrev ? () => {
    const cb = callbacksRef.current.onPrev;
    if (cb) cb();
  } : undefined;

  const onNextClick = callbacksRef.current.onNext ? () => {
    const cb = callbacksRef.current.onNext;
    if (cb) cb();
  } : undefined;

  const onReciterSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cb = callbacksRef.current.onReciterChange;
    if (cb) {
      cb(e.target.value);
    }
  };

  return (
    <div id="synchronized-audio-player" className="w-full select-none space-y-3 sm:space-y-4">
      {/* Hidden high-fidelity HTML5 audio node */}
      <audio
        ref={audioRef}
        key={activeSrc}
        src={resolvedSrc || undefined}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleAudioError}
        onPlay={() => { 
          isTransitioningSrcRef.current = false;
          setIsPlaying(true);
          if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeed;
          }
        }}
        onPlaying={() => { 
          isTransitioningSrcRef.current = false;
          setIsPlaying(true);
          if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeed;
          }
        }}
        onPause={() => {
          setIsPlaying(false);
        }}
        onSeeked={() => { isTransitioningSrcRef.current = false; }}
        onLoadedData={() => { isTransitioningSrcRef.current = false; }}
      />

      {/* Preload Next Verse Audio in Background for Seamless continuous recitation */}
      {nextAudioUrl && (
        <audio
          key={nextAudioUrl}
          src={getAudioCandidates(nextAudioUrl)[0]}
          preload="auto"
          style={{ display: 'none' }}
        />
      )}

      {/* Top Header Row for Toggle and Meta info */}
      <div className="flex justify-between items-center pb-1.5 border-b border-[#E8DCC8]/30">
        <div className="flex items-center gap-1.5 select-none">
          <Volume2 className="w-3.5 h-3.5 text-[#8B3A3A] shrink-0" />
          {reciters.length > 0 ? (
            <div className="flex items-center gap-2">
              <select
                value={selectedReciterId}
                onChange={onReciterSelectChange}
                className="text-[10px] sm:text-[11px] font-bold text-[#795548] font-mono bg-transparent border-0 py-0 pl-0 pr-6 focus:ring-0 focus:outline-hidden cursor-pointer hover:text-[#8B3A3A] transition-colors"
              >
                {reciters.map((r) => (
                  <option key={r.id} value={r.id} className="bg-[#FAF6F1] text-[#3E2723]">
                    {r.name} ({r.bitrate})
                  </option>
                ))}
              </select>
              {isDownloading && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8B3A3A] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8B3A3A]"></span>
                  </span>
                  <span className="text-[9px] font-bold text-[#8B3A3A] font-mono animate-pulse uppercase tracking-wider">
                    Syncing Timings...
                  </span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#795548] font-mono">
              Alafasy Recitation
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isCompact && (
            <div className="flex items-center space-x-1 bg-[#FAF6F1] border border-[#E8DCC8]/40 rounded-lg p-0.5" dir="ltr">
              <button
                onClick={() => changeFontSize(-2)}
                className="p-1 text-[#8B3A3A] hover:bg-[#E8DCC8]/20 rounded-md cursor-pointer transition-all active:scale-95"
                title="Decrease Font Size"
              >
                <Minus className="w-2.5 h-2.5" />
              </button>
              <span className="text-[9px] sm:text-[10px] font-bold text-[#795548] px-1 font-mono whitespace-nowrap">
                {localArabicFontSize}px
              </span>
              <button
                onClick={() => changeFontSize(2)}
                className="p-1 text-[#8B3A3A] hover:bg-[#E8DCC8]/20 rounded-md cursor-pointer transition-all active:scale-95"
                title="Increase Font Size"
              >
                <Plus className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
          <button
            onClick={toggleCompact}
            className="flex items-center gap-1 text-[11px] font-bold text-[#8B3A3A] hover:text-[#D4A574] transition-all cursor-pointer select-none px-2 py-0.5 rounded-md bg-[#FAF6F1] hover:bg-[#E8DCC8]/30 border border-[#E8DCC8]/40 shadow-xs active:scale-95"
            title={isCompact ? "Show Word-by-Word Text" : "Hide Word-by-Word Text"}
          >
            {isCompact ? (
              <>
                <Maximize2 className="w-3 h-3" />
                <span className="text-[10px]">Show Text</span>
              </>
            ) : (
              <>
                <Minimize2 className="w-3 h-3" />
                <span className="text-[10px]">Compact View</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Word-by-Word Synchronized Interactive Text Panel */}
      {!isCompact && (
        <div 
          id="interactive-word-text-panel"
          className="py-4 px-2 sm:px-4 text-center select-none"
          dir="rtl"
        >
          <div 
            className="font-arabic text-[#3E2723] text-center leading-loose animate-fadeIn"
            style={{
              fontSize: `${localArabicFontSize}px`,
              lineHeight: `${localArabicFontSize * 2.2}px`
            }}
          >
            {normalizeArabicText(words.join(' ')).split(/\s+/).map((word, index, arr) => {
              const isHighlighted = activeWordIndex === index;
              return (
                <React.Fragment key={index}>
                  <span
                    id={`quran-word-span-${index}`}
                    onClick={() => handleWordTap(index)}
                    className={`inline-block px-1.5 py-0.5 rounded-md transition-all duration-150 cursor-pointer select-none ${
                      isHighlighted
                        ? 'bg-[#8B3A3A] text-white font-bold shadow-md shadow-[#8B3A3A]/25 scale-105'
                        : 'text-[#3E2723] hover:text-[#8B3A3A] hover:bg-[#D4A574]/15'
                    }`}
                    title="Tap to play from here"
                  >
                    {word}
                  </span>
                  {index < arr.length - 1 && ' '}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Player Progress Bar / Seek Slider */}
      <div id="player-progress-bar-container" className="space-y-1">
        <div className="flex items-center space-x-2">
          <input
            id="audio-seek-slider"
            type="range"
            min={0}
            max={duration || 100}
            step={0.01}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-[#E8DCC8] rounded-lg appearance-none cursor-pointer accent-[#8B3A3A] hover:accent-[#D4A574] focus:outline-hidden transition-all"
          />
        </div>
        <div className="flex justify-between text-[11px] font-mono text-[#795548] font-bold">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controller Buttons Panel */}
      <div id="player-buttons-panel" className={`flex items-center justify-between gap-4 pt-1.5 ${isCompact ? 'mt-1 border-t border-[#E8DCC8]/20' : 'border-t border-[#E8DCC8]/40 flex-wrap'}`}>
        {/* Playback speed selector */}
        {(!isCompact || (typeof window !== 'undefined' && window.innerWidth >= 480)) && (
          <div className="flex items-center space-x-1.5" dir="ltr">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#795548] whitespace-nowrap">Speed:</span>
            <div className="relative inline-block text-left">
              <button
                type="button"
                onClick={() => setIsSpeedOpen(!isSpeedOpen)}
                className="text-[10px] sm:text-[11px] font-bold text-[#795548] font-mono bg-[#FAF6F1] border border-[#E8DCC8] rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-[#8B3A3A]/50 focus:border-[#8B3A3A] focus:outline-hidden cursor-pointer hover:text-[#8B3A3A] hover:bg-[#E8DCC8]/10 transition-all shadow-xs flex items-center gap-1 min-w-[55px]"
              >
                <span>{playbackSpeed.toFixed(2).replace(/\.?0+$/, '')}x</span>
                <ChevronDown className="w-3 h-3 text-[#795548]" />
              </button>
              {isSpeedOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsSpeedOpen(false)} 
                  />
                  <div className="absolute bottom-full left-0 mb-1.5 z-50 min-w-[70px] bg-white border border-[#E8DCC8] rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto">
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0].map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => {
                          handleSpeedChange(speed);
                          setIsSpeedOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1 text-[10px] sm:text-[11px] font-bold font-mono transition-colors hover:bg-[#E8DCC8]/20 block ${
                          playbackSpeed === speed ? 'text-[#8B3A3A] bg-[#E8DCC8]/10' : 'text-[#3E2723]'
                        }`}
                      >
                        {speed.toFixed(2).replace(/\.?0+$/, '')}x
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Central playback control cluster */}
        <div className={`flex items-center ${isCompact ? 'space-x-2 mx-auto sm:mx-0' : 'space-x-3'}`} dir="ltr">
          {onPrevClick && (
            <button
              id="prev-ayah-btn"
              onClick={onPrevClick}
              className={`text-[#795548] hover:text-[#8B3A3A] hover:bg-[#FAF6F1] rounded-full transition-all border border-transparent hover:border-[#E8DCC8] cursor-pointer ${isCompact ? 'p-1.5' : 'p-2'}`}
              title="Previous Verse"
            >
              <SkipBack className={isCompact ? "w-4 h-4" : "w-5 h-5"} />
            </button>
          )}

          <button
            id="restart-recitation-btn"
            onClick={restartAudio}
            className={`text-[#795548] hover:text-[#8B3A3A] hover:bg-[#FAF6F1] rounded-full transition-all border border-transparent hover:border-[#E8DCC8] cursor-pointer ${isCompact ? 'p-1.5' : 'p-2'}`}
            title="Restart Verse"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            id="toggle-playback-btn"
            onClick={togglePlay}
            className={`bg-[#8B3A3A] hover:bg-[#a64545] text-white rounded-full shadow-md shadow-[#8B3A3A]/20 transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center ${isCompact ? 'p-2.5' : 'p-3'}`}
            title={isPlaying ? 'Pause' : 'Play Recitation'}
          >
            {isPlaying ? (
              <Pause className={isCompact ? "w-4 h-4 fill-white" : "w-6 h-6 fill-white"} />
            ) : (
              <Play className={`${isCompact ? 'w-4 h-4' : 'w-6 h-6'} fill-white ml-0.5`} />
            )}
          </button>

          {onNextClick && (
            <button
              id="next-ayah-btn"
              onClick={onNextClick}
              className={`text-[#795548] hover:text-[#8B3A3A] hover:bg-[#FAF6F1] rounded-full transition-all border border-transparent hover:border-[#E8DCC8] cursor-pointer ${isCompact ? 'p-1.5' : 'p-2'}`}
              title="Next Verse"
            >
              <SkipForward className={isCompact ? "w-4 h-4" : "w-5 h-5"} />
            </button>
          )}
        </div>

        {/* Audio label info */}
        {!isCompact && (
          <div className="text-[10px] uppercase tracking-wider font-bold text-[#795548] font-mono flex items-center gap-1 select-none">
            <Volume2 className="w-3.5 h-3.5 text-[#8B3A3A] shrink-0" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#795548]">
                {reciters.find(r => r.id === selectedReciterId)?.name || 'Alafasy Recitation'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
