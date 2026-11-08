/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const RECITER_SUBFOLDERS: Record<string, string> = {
  alafasy: 'Alafasy_128kbps',
  sudais: 'Abdurrahmaan_As-Sudais_192kbps',
  husary: 'Husary_128kbps',
  ghamdi: 'Saad_Al-Ghamdi_128kbps',
  abdulbasit: 'Abdul_Basit_Mujawwad_128kbps',
  muaiqly: 'Maher_AlMuaiqly_64kbps'
};

// The Cache Name used for storing audio
export const CACHE_NAME = 'quran-audio-recitations';

export const SURAH_VERSE_COUNTS = [
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

export function getParaStartSurah(para: number): number {
  const starts = [
    1, 2, 2, 3, 4, 4, 5, 5, 6, 6,
    7, 8, 9, 10, 11, 12, 13, 15, 16, 17,
    18, 19, 20, 21, 22, 23, 24, 25, 26, 27
  ];
  return starts[para - 1] || 1;
}

export function getParaEndSurah(para: number): number {
  const ends = [
    1, 2, 3, 3, 4, 5, 5, 6, 6, 7,
    7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    17, 18, 18, 19, 20, 21, 22, 23, 24, 25
  ];
  return ends[para - 1] || 114;
}

export interface DownloadItem {
  surah: number;
  ayah: number;
}

export interface DownloadState {
  type: 'surah' | 'para' | 'quran' | null;
  id: number | null; // Surah number or Para number
  qariId: string;
  qariName: string;
  status: 'idle' | 'downloading' | 'paused' | 'completed' | 'error';
  totalFiles: number;
  downloadedCount: number;
  userPaused: boolean;
  offlinePaused: boolean;
  errorMsg: string | null;
}

export type DownloadStateListener = (state: DownloadState) => void;

class RecitationDownloader {
  private state: DownloadState = {
    type: null,
    id: null,
    qariId: 'alafasy',
    qariName: 'Mishary Alafasy',
    status: 'idle',
    totalFiles: 0,
    downloadedCount: 0,
    userPaused: false,
    offlinePaused: false,
    errorMsg: null,
  };

  private listeners: Set<DownloadStateListener> = new Set();
  private downloadQueue: DownloadItem[] = [];
  private currentQueueIndex = 0;
  private isRunning = false;
  private abortController: AbortController | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  public subscribe(listener: DownloadStateListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = { ...this.state };
    this.listeners.forEach((listener) => listener(currentState));
  }

  private handleOnline = () => {
    if (this.state.status === 'paused' && this.state.offlinePaused && !this.state.userPaused) {
      this.state.offlinePaused = false;
      this.resume();
    }
  };

  private handleOffline = () => {
    if (this.state.status === 'downloading') {
      this.state.offlinePaused = true;
      this.state.status = 'paused';
      this.isRunning = false;
      if (this.abortController) {
        this.abortController.abort();
      }
      this.notify();
    }
  };

  // Check if a specific file is in cache
  public async isFileCached(qariId: string, surah: number, ayah: number): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || !window.caches) return false;
      const subfolder = RECITER_SUBFOLDERS[qariId] || 'Alafasy_128kbps';
      const sStr = String(surah).padStart(3, '0');
      const aStr = String(ayah).padStart(3, '0');
      const url = `https://everyayah.com/data/${subfolder}/${sStr}${aStr}.mp3`;
      const cache = await caches.open(CACHE_NAME);
      const matched = await cache.match(url);
      return !!matched;
    } catch (e) {
      return false;
    }
  }

  // Check how many files in a list are already cached
  public async getCachedCount(qariId: string, items: DownloadItem[]): Promise<number> {
    try {
      if (typeof window === 'undefined' || !window.caches) return 0;
      const subfolder = RECITER_SUBFOLDERS[qariId] || 'Alafasy_128kbps';
      const cache = await caches.open(CACHE_NAME);
      let count = 0;
      
      // Batch checks for responsiveness
      const promises = items.map(async (item) => {
        const sStr = String(item.surah).padStart(3, '0');
        const aStr = String(item.ayah).padStart(3, '0');
        const url = `https://everyayah.com/data/${subfolder}/${sStr}${aStr}.mp3`;
        const matched = await cache.match(url);
        if (matched) count++;
      });

      await Promise.all(promises);
      return count;
    } catch (e) {
      return 0;
    }
  }

  // Get total progress or download status for a Surah / Para / Quran
  public async getStatusFor(type: 'surah' | 'para' | 'quran', id: number | null, qariId: string): Promise<{ total: number; cached: number; isCompleted: boolean }> {
    const items = this.generateItems(type, id);
    const cachedCount = await this.getCachedCount(qariId, items);
    return {
      total: items.length,
      cached: cachedCount,
      isCompleted: cachedCount === items.length && items.length > 0,
    };
  }

  private generateItems(type: 'surah' | 'para' | 'quran', id: number | null): DownloadItem[] {
    const items: DownloadItem[] = [];
    if (type === 'surah') {
      const s = id || 1;
      const count = SURAH_VERSE_COUNTS[s - 1] || 0;
      for (let a = 1; a <= count; a++) {
        items.push({ surah: s, ayah: a });
      }
    } else if (type === 'para') {
      const p = id || 1;
      const startSurah = getParaStartSurah(p);
      const endSurah = getParaEndSurah(p);
      for (let s = startSurah; s <= endSurah; s++) {
        const count = SURAH_VERSE_COUNTS[s - 1] || 0;
        for (let a = 1; a <= count; a++) {
          items.push({ surah: s, ayah: a });
        }
      }
    } else if (type === 'quran') {
      for (let s = 1; s <= 114; s++) {
        const count = SURAH_VERSE_COUNTS[s - 1] || 0;
        for (let a = 1; a <= count; a++) {
          items.push({ surah: s, ayah: a });
        }
      }
    }
    return items;
  }

  public async startDownload(type: 'surah' | 'para' | 'quran', id: number | null, qariId: string, qariName: string) {
    // If already downloading the exact same thing, ignore
    if (this.isRunning && this.state.type === type && this.state.id === id && this.state.qariId === qariId) {
      return;
    }

    // Cancel existing
    this.cancel();

    const items = this.generateItems(type, id);
    this.downloadQueue = items;
    this.currentQueueIndex = 0;

    // Check what is already cached
    const alreadyCached = await this.getCachedCount(qariId, items);

    this.state = {
      type,
      id,
      qariId,
      qariName,
      status: 'downloading',
      totalFiles: items.length,
      downloadedCount: alreadyCached,
      userPaused: false,
      offlinePaused: false,
      errorMsg: null,
    };

    if (alreadyCached === items.length) {
      this.state.status = 'completed';
      this.notify();
      return;
    }

    this.isRunning = true;
    this.notify();
    this.runDownloadLoop();
  }

  private async runDownloadLoop() {
    const subfolder = RECITER_SUBFOLDERS[this.state.qariId] || 'Alafasy_128kbps';
    const cache = await caches.open(CACHE_NAME);

    while (this.isRunning && this.currentQueueIndex < this.downloadQueue.length) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.state.status = 'paused';
        this.state.offlinePaused = true;
        this.isRunning = false;
        this.notify();
        break;
      }

      const item = this.downloadQueue[this.currentQueueIndex];
      const sStr = String(item.surah).padStart(3, '0');
      const aStr = String(item.ayah).padStart(3, '0');
      const url = `https://everyayah.com/data/${subfolder}/${sStr}${aStr}.mp3`;
      const fallbackUrl = `https://www.everyayah.com/data/${subfolder}/${sStr}${aStr}.mp3`;

      // Check if already in cache
      const matched = await cache.match(url);
      if (matched) {
        this.currentQueueIndex++;
        // Keep state synchronized
        const currentCached = await this.getCachedCount(this.state.qariId, this.downloadQueue);
        this.state.downloadedCount = currentCached;
        this.notify();
        continue;
      }

      try {
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        let response: Response | null = null;
        try {
          response = await fetch(url, { signal });
        } catch (err) {
          // Try fallback
          response = await fetch(fallbackUrl, { signal });
        }

        if (response && response.ok) {
          // Store response in cache under the standard EveryAyah URL
          await cache.put(url, response.clone());
          
          this.currentQueueIndex++;
          const currentCached = await this.getCachedCount(this.state.qariId, this.downloadQueue);
          this.state.downloadedCount = currentCached;
          this.notify();
        } else {
          throw new Error(`Failed to fetch recitation for Surah ${item.surah} Ayah ${item.ayah}`);
        }
      } catch (e: any) {
        if (e.name === 'AbortError') {
          // Paused intentionally
          break;
        }

        console.error('Download error:', e);
        // Retry once after a brief delay
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
        // If still offline, pause
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          this.state.status = 'paused';
          this.state.offlinePaused = true;
          this.isRunning = false;
          this.notify();
          break;
        }
      }
    }

    if (this.currentQueueIndex >= this.downloadQueue.length && this.isRunning) {
      this.state.status = 'completed';
      this.state.downloadedCount = this.state.totalFiles;
      this.isRunning = false;
      this.notify();
    }
  }

  public pause() {
    if (this.state.status === 'downloading') {
      this.state.status = 'paused';
      this.state.userPaused = true;
      this.isRunning = false;
      if (this.abortController) {
        this.abortController.abort();
      }
      this.notify();
    }
  }

  public resume() {
    if (this.state.status === 'paused') {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        // Still offline, cannot resume
        this.state.offlinePaused = true;
        this.notify();
        return;
      }

      this.state.status = 'downloading';
      this.state.userPaused = false;
      this.state.offlinePaused = false;
      this.isRunning = true;
      this.notify();
      this.runDownloadLoop();
    }
  }

  public cancel() {
    this.isRunning = false;
    if (this.abortController) {
      this.abortController.abort();
    }
    this.state = {
      type: null,
      id: null,
      qariId: this.state.qariId,
      qariName: this.state.qariName,
      status: 'idle',
      totalFiles: 0,
      downloadedCount: 0,
      userPaused: false,
      offlinePaused: false,
      errorMsg: null,
    };
    this.downloadQueue = [];
    this.currentQueueIndex = 0;
    this.notify();
  }

  public getState(): DownloadState {
    return { ...this.state };
  }

  public async clearCacheForQari(qariId: string): Promise<void> {
    try {
      const subfolder = RECITER_SUBFOLDERS[qariId];
      if (!subfolder) return;
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      for (const request of keys) {
        if (request.url.includes(`/data/${subfolder}/`)) {
          await cache.delete(request);
        }
      }
      this.notify();
    } catch (e) {
      console.error('Error clearing cache for Qari:', e);
    }
  }
}

export const recitationDownloader = new RecitationDownloader();
