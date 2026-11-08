/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Word, Murakkab, Ayah, LearnedState } from '../types';

const STORAGE_KEY = 'quran_vocab_progress_v2';
const SETTINGS_KEY = 'quran_vocab_settings_v2';

export interface StoredProgress {
  words: Word[];
  phrases: Murakkab[];
  ayahs: Ayah[];
  language: string;
  arabicSize: 'normal' | 'large' | 'xlarge';
  showGoldLines: boolean;
  lastUpdated: string;
}

export interface StoredSettings {
  language: string;
  arabicSize: 'normal' | 'large' | 'xlarge';
  showGoldLines: boolean;
  theme: 'light' | 'dark';
  rtl: boolean;
}

/**
 * Load all progress data from localStorage
 */
export function loadProgress(): Partial<StoredProgress> {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error loading progress:', error);
    return {};
  }
}

/**
 * Save all progress data to localStorage
 */
export function saveProgress(data: Partial<StoredProgress>): void {
  try {
    const toSave = {
      ...data,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}

/**
 * Update a single word's learned state
 */
export function updateWordState(wordId: string, state: LearnedState, allWords: Word[]): Word[] {
  return allWords.map((w) =>
    w.id === wordId ? { ...w, learnedState: state } : w
  );
}

/**
 * Update a single murakkab's learned state
 */
export function updateMurakkabState(murakkaab: string, state: LearnedState, allMurakkabat: Murakkab[]): Murakkab[] {
  return allMurakkabat.map((m) =>
    m.id === murakkaab ? { ...m, learnedState: state } : m
  );
}

/**
 * Update a single ayah's learned state
 */
export function updateAyahState(ayahId: string, state: LearnedState, allAyahs: Ayah[]): Ayah[] {
  return allAyahs.map((a) =>
    a.id === ayahId ? { ...a, learnedState: state } : a
  );
}

/**
 * Load settings from localStorage
 */
export function loadSettings(): StoredSettings {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (data) return JSON.parse(data);
  } catch (error) {
    console.error('Error loading settings:', error);
  }

  return {
    language: 'en',
    arabicSize: 'normal',
    showGoldLines: true,
    theme: 'light',
    rtl: false
  };
}

/**
 * Save settings to localStorage
 */
export function saveSettings(settings: StoredSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

/**
 * Reset all stored data
 */
export function resetAllData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
  } catch (error) {
    console.error('Error resetting data:', error);
  }
}

/**
 * Get summary statistics
 */
export function getSummaryStats(progress: Partial<StoredProgress>) {
  const words = progress.words || [];
  const phrases = progress.phrases || [];
  const ayahs = progress.ayahs || [];

  return {
    wordsTotal: words.length,
    wordsLearning: words.filter((w) => w.learnedState === 'learning').length,
    wordsKnown: words.filter((w) => w.learnedState === 'known').length,
    wordsMastered: words.filter((w) => w.learnedState === 'mastered').length,
    wordsReview: words.filter((w) => w.learnedState === 'review').length,
    phrasesTotal: phrases.length,
    phrasesLearning: phrases.filter((p) => p.learnedState === 'learning').length,
    phrasesKnown: phrases.filter((p) => p.learnedState === 'known').length,
    phrasesMastered: phrases.filter((p) => p.learnedState === 'mastered').length,
    phrasesReview: phrases.filter((p) => p.learnedState === 'review').length,
    ayahsTotal: ayahs.length,
    ayahsLearning: ayahs.filter((a) => a.learnedState === 'learning').length,
    ayahsKnown: ayahs.filter((a) => a.learnedState === 'known').length,
    ayahsMastered: ayahs.filter((a) => a.learnedState === 'mastered').length,
    ayahsReview: ayahs.filter((a) => a.learnedState === 'review').length
  };
}
