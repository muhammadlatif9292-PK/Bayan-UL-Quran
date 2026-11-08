/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  isRtl: boolean;
  translate: (key: string) => string;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  isRtl,
  translate
}: SearchInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={`relative ${isRtl ? 'rtl' : 'ltr'}`}>
      <div className={`relative flex items-center transition-all duration-200 ${
        isFocused 
          ? 'ring-2 ring-[#D4A574] ring-offset-2' 
          : ''
      }`}>
        <div className={`absolute inset-y-0 ${isRtl ? 'right-0' : 'left-0'} pl-3 flex items-center pointer-events-none`}>
          <Search className="h-4 w-4 text-[#795548]" />
        </div>
        
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={`block w-full pl-10 pr-10 py-2 border border-[#E8DCC8] rounded-lg bg-white text-sm text-[#3E2723] placeholder-[#795548]/50 focus:outline-none focus:border-[#D4A574] focus:ring-1 focus:ring-[#D4A574] transition-all ${
            isRtl ? 'text-right pr-10 pl-3' : 'text-left pl-10 pr-10'
          }`}
          dir={isRtl ? 'rtl' : 'ltr'}
        />
        
        {value && (
          <button
            onClick={() => onChange('')}
            className={`absolute inset-y-0 ${isRtl ? 'left-0' : 'right-0'} pr-3 flex items-center text-[#795548] hover:text-[#8B3A3A] transition-colors`}
            title={translate('search.clear')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {/* Search hint */}
      {value && (
        <div className={`mt-1.5 text-[10px] text-[#795548] ${isRtl ? 'text-right' : 'text-left'}`}>
          {translate('search.hint')}
        </div>
      )}
    </div>
  );
}
