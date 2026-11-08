/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { FilterState, LearnedState } from '../types';
import { THEME_TAXONOMY, GRAMMAR_POS_OPTIONS } from '../data/quranData';
import { surahs } from '../../data/surahs';
import { SlidersHorizontal, Trash2, CheckCircle2, Search, Info } from 'lucide-react';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filterState: FilterState;
  onApplyFilters: (state: FilterState) => void;
  translate: (key: string) => string;
  isRtl: boolean;
}

const BAAB_FILTER_OPTIONS = [
  { num: 1, label: 'Form I (المجرّد — فَعَلَ)' },
  { num: 2, label: 'Form II (تَفْعِيل — فَعَّلَ)' },
  { num: 3, label: 'Form III (مُفَاعَلَة — فَاعَلَ)' },
  { num: 4, label: 'Form IV (إِفْعَال — أَفْعَلَ)' },
  { num: 5, label: 'Form V (تَفَعُّل — تَفَعَّلَ)' },
  { num: 6, label: 'Form VI (تَفَاعُل — تَفَاعَلَ)' },
  { num: 7, label: 'Form VII (ٱنْفِعَال — ٱنْفَعَلَ)' },
  { num: 8, label: 'Form VIII (ٱفْتِعَال — ٱفْتَعَلَ)' },
  { num: 9, label: 'Form IX (ٱفْعِلَال — ٱفْعَلَّ)' },
  { num: 10, label: 'Form X (ٱسْتِفْعَال — ٱسْتَفْعَلَ)' }
];

export function FilterPanel({
  isOpen,
  onClose,
  filterState,
  onApplyFilters,
  translate,
  isRtl
}: FilterPanelProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState(filterState.searchQuery);
  const [selectedSurahs, setSelectedSurahs] = useState<number[]>(filterState.selectedSurahs);
  const [selectedThemes, setSelectedThemes] = useState<string[]>(filterState.selectedThemes);
  const [selectedPOS, setSelectedPOS] = useState<string[]>(filterState.selectedPOS);
  const [selectedProgress, setSelectedProgress] = useState<LearnedState[]>(filterState.selectedProgress);
  const [selectedCore, setSelectedCore] = useState<'all' | 'core' | 'non-core'>(filterState.selectedCore);
  const [selectedBaab, setSelectedBaab] = useState<number[]>(filterState.selectedBaab || []);
  const [rootQuery, setRootQuery] = useState<string>(filterState.rootQuery || '');
  const [surahSearch, setSurahSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<FilterState['sortBy']>(filterState.sortBy);

  if (!isOpen) return null;

  const handleToggleSurah = (num: number) => {
    setSelectedSurahs(prev => 
      prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]
    );
  };

  const handleToggleTheme = (themeId: string) => {
    setSelectedThemes(prev =>
      prev.includes(themeId) ? prev.filter(t => t !== themeId) : [...prev, themeId]
    );
  };

  const handleTogglePOS = (posId: string) => {
    setSelectedPOS(prev =>
      prev.includes(posId) ? prev.filter(p => p !== posId) : [...prev, posId]
    );
  };

  const handleToggleBaab = (baabNum: number) => {
    setSelectedBaab(prev =>
      prev.includes(baabNum) ? prev.filter(b => b !== baabNum) : [...prev, baabNum]
    );
  };

  const handleToggleProgress = (state: LearnedState) => {
    setSelectedProgress(prev =>
      prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state]
    );
  };

  const clearAll = () => {
    setLocalSearchQuery('');
    setSelectedSurahs([]);
    setSelectedThemes([]);
    setSelectedPOS([]);
    setSelectedProgress([]);
    setSelectedBaab([]);
    setRootQuery('');
    setSurahSearch('');
    setSelectedCore('all');
    setSortBy('frequency-desc');
  };

  const handleApply = () => {
    onApplyFilters({
      selectedSurahs,
      selectedThemes,
      selectedPOS,
      selectedProgress,
      selectedCore,
      selectedBaab,
      rootQuery: rootQuery.trim(),
      searchQuery: localSearchQuery,
      sortBy
    });
    onClose();
  };

  const filteredSurahsList = surahs.filter(s => {
    if (!surahSearch.trim()) return true;
    const q = surahSearch.trim().toLowerCase();
    return (
      s.number.toString() === q ||
      s.nameEnglish.toLowerCase().includes(q) ||
      s.meaning.toLowerCase().includes(q) ||
      s.nameArabic.includes(surahSearch.trim())
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity overflow-y-auto">
      {/* Outer Click dismiss wrapper */}
      <div className="flex-grow min-w-0 h-full cursor-pointer" onClick={onClose}></div>

      {/* Styled Panel matching Option 2: Rich Cream background (#FAF6F1), Gold linings */}
      <div className="w-full max-w-md bg-[#FAF6F1] h-full shadow-2xl flex flex-col border-l border-[#E8DCC8] relative animate-slideLeft">
        
        {/* Header chrome */}
        <div className="p-4 border-b border-[#E8DCC8] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#8B3A3A]" />
            <h2 className="font-bold text-[#3E2723] font-serif-eng text-base">
              {translate('filter.title')}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-stone-500 hover:text-black font-semibold text-sm"
          >
            ✕ Close
          </button>
        </div>

        {/* Content body scroll */}
        <div className="p-5 flex-grow overflow-y-auto space-y-6">
          {/* Active Search text box */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#3E2723] uppercase tracking-wide">
              {translate('filter.searchPlh')}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#795548] opacity-75" />
              <input
                type="text"
                value={localSearchQuery}
                onChange={e => setLocalSearchQuery(e.target.value)}
                placeholder="Type Root, English or Arabic text..."
                className="w-full bg-white border border-[#E8DCC8] rounded-md pl-9 pr-4 py-2 text-xs focus:ring-1 focus:ring-[#D4A574] focus:outline-none text-[#3E2723]"
              />
            </div>
          </div>

          {/* Root (الجذر) Morphological Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#3E2723] uppercase tracking-wide flex items-center justify-between">
              <span>Morphological Root (الجذر)</span>
              {rootQuery && (
                <button onClick={() => setRootQuery('')} className="text-[10px] text-[#8B3A3A] hover:underline">
                  Clear
                </button>
              )}
            </label>
            <input
              type="text"
              value={rootQuery}
              onChange={e => setRootQuery(e.target.value)}
              placeholder="e.g. ر-ح-م or ع-ل-م or ق-و-ل"
              className="w-full bg-white border border-[#E8DCC8] rounded-md px-3 py-2 text-xs font-arabic focus:ring-1 focus:ring-[#D4A574] focus:outline-none text-[#3E2723]"
            />
          </div>

          {/* Sarf: Baab / Derived Verbal Form (Form I–X) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-[#E8DCC8] pb-1">
              <h3 className="text-xs font-bold text-[#3E2723] uppercase tracking-wide">
                Sarf: Baab / Verbal Form (الأبواب الصرفية I–X)
              </h3>
              {selectedBaab.length > 0 && (
                <button onClick={() => setSelectedBaab([])} className="text-[10px] font-bold text-[#8B3A3A] hover:underline">
                  Reset ({selectedBaab.length})
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {BAAB_FILTER_OPTIONS.map(opt => {
                const isSelected = selectedBaab.includes(opt.num);
                return (
                  <button
                    key={opt.num}
                    onClick={() => handleToggleBaab(opt.num)}
                    className={`text-left py-1.5 px-2.5 rounded text-[11px] font-semibold border transition-all truncate ${
                      isSelected
                        ? 'bg-[#8B3A3A] text-white border-[#8B3A3A] shadow-2xs'
                        : 'bg-white border-[#E8DCC8] text-[#795548] hover:border-[#8B3A3A]'
                    }`}
                    title={opt.label}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vocabulary core scopes */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#3E2723] uppercase tracking-wide border-b border-[#E8DCC8] pb-1">
              {translate('filter.coreOnly')}
            </h3>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { id: 'all', label: translate('filter.allScope') },
                { id: 'core', label: translate('filter.coreScope') },
                { id: 'non-core', label: translate('filter.nonCoreScope') }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedCore(opt.id as 'all' | 'core' | 'non-core')}
                  className={`w-full text-left py-2 px-3 rounded text-xs font-semibold border transition-all ${
                    selectedCore === opt.id
                      ? 'bg-[#8B3A3A] text-white border-[#8B3A3A] shadow-sm'
                      : 'bg-white border-[#E8DCC8] text-[#795548] hover:bg-neutral-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filter by Surah (All 114 Surahs with search) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-[#E8DCC8] pb-1">
              <h3 className="text-xs font-bold text-[#3E2723] uppercase tracking-wide">
                {translate('filter.surah')} (All 114 Surahs)
              </h3>
              {selectedSurahs.length > 0 && (
                <button onClick={() => setSelectedSurahs([])} className="text-[10px] font-bold text-[#8B3A3A] hover:underline">
                  Clear ({selectedSurahs.length})
                </button>
              )}
            </div>
            <input
              type="text"
              value={surahSearch}
              onChange={e => setSurahSearch(e.target.value)}
              placeholder="Filter Surahs by # or name (1–114)..."
              className="w-full bg-white border border-[#E8DCC8] rounded-md px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-[#D4A574] focus:outline-none text-[#3E2723]"
            />
            <div className="max-h-40 overflow-y-auto border border-[#E8DCC8] rounded-md bg-white/60 p-2 flex flex-wrap gap-1.5">
              {filteredSurahsList.map(s => {
                const isSelected = selectedSurahs.includes(s.number);
                return (
                  <button
                    key={s.number}
                    onClick={() => handleToggleSurah(s.number)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors ${
                      isSelected
                        ? 'bg-[#D4A574] text-white border-[#D4A574]'
                        : 'bg-white text-[#795548] border-[#E8DCC8] hover:border-[#8B3A3A]'
                    }`}
                  >
                    {s.number}. {s.nameEnglish}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter by Themes & Taxonomy Category */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#3E2723] uppercase tracking-wide border-b border-[#E8DCC8] pb-1">
              {translate('filter.themes')}
            </h3>
            <div className="grid grid-cols-1 gap-1.5">
              {THEME_TAXONOMY.map(theme => {
                const isSelected = selectedThemes.includes(theme.id);
                return (
                  <button
                    key={theme.id}
                    onClick={() => handleToggleTheme(theme.id)}
                    className={`w-full text-left py-2 px-3 rounded text-xs font-semibold border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#D4A574] text-white border-[#D4A574]'
                        : 'bg-white border-[#E8DCC8] text-[#795548] hover:bg-neutral-50'
                    }`}
                  >
                    <span>{theme.emoji} {theme.labels.en}</span>
                    {isSelected && <span className="font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter by Grammar Part of Speech */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#3E2723] uppercase tracking-wide border-b border-[#E8DCC8] pb-1">
              {translate('filter.pos')}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {GRAMMAR_POS_OPTIONS.map(pos => {
                const isSelected = selectedPOS.includes(pos.id);
                return (
                  <button
                    key={pos.id}
                    onClick={() => handleTogglePOS(pos.id)}
                    className={`py-1.5 px-3 rounded text-xs font-semibold border transition-all ${
                      isSelected
                        ? 'bg-[#8B3A3A] text-white border-[#8B3A3A]'
                        : 'bg-white border-[#E8DCC8] text-[#795548] hover:border-[#8B3A3A]'
                    }`}
                  >
                    {pos.id}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mastery & Learned State categories */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#3E2723] uppercase tracking-wide border-b border-[#E8DCC8] pb-1">
              {translate('filter.progress')}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {(['new', 'learning', 'known', 'mastered', 'review'] as LearnedState[]).map(state => {
                const isSelected = selectedProgress.includes(state);
                return (
                  <button
                    key={state}
                    onClick={() => handleToggleProgress(state)}
                    className={`py-1.5 px-3 rounded text-xs font-bold border transition-all uppercase ${
                      isSelected
                        ? 'bg-amber-100 border-[#D4A574] text-[#8B3A3A] font-extrabold shadow-inner'
                        : 'bg-white border-[#E8DCC8] text-stone-500'
                    }`}
                  >
                    {state}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sort selection */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#3E2723] uppercase tracking-wide border-b border-[#E8DCC8] pb-1">
              {translate('filter.sortBy')}
            </h3>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as FilterState['sortBy'])}
              className="w-full bg-white border border-[#E8DCC8] rounded-md py-2 px-3 text-xs focus:ring-1 focus:ring-[#D4A574] focus:outline-none text-[#3E2723]"
            >
              <option value="frequency-desc">{translate('filter.sortFreqDesc')}</option>
              <option value="frequency-asc">{translate('filter.sortFreqAsc')}</option>
              <option value="id-asc">{translate('filter.sortIdAsc')}</option>
              <option value="alphabetic-arabic">{translate('filter.sortAlphaAr')}</option>
            </select>
          </div>

          {/* Info explanation: Within group is OR | Between group is AND */}
          <div className="bg-amber-50 rounded-lg p-3 text-[11px] text-[#795548] leading-relaxed border border-amber-100 flex items-start gap-1.5">
            <Info className="w-4 h-4 text-[#D4A574] shrink-0 mt-0.5" />
            <div>
              <strong>Linguistic Search Logic:</strong> Selection within specific categories acts as <strong>OR</strong>, while combinations between categories act as <strong>AND</strong> constraints.
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-[#E8DCC8] bg-white flex gap-3 h-16">
          <button
            onClick={clearAll}
            className="flex-grow bg-stone-100 hover:bg-stone-200 text-stone-700 py-2 rounded text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {translate('filter.clearAll')}
          </button>
          <button
            onClick={handleApply}
            className="flex-grow bg-[#8B3A3A] hover:bg-[#D4A574] text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {translate('filter.apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
