# Quranic Data Transformation Scripts

This directory contains Node.js scripts to transform the existing Quranic linguistic data into an optimized structure for fast loading and smooth performance.

## Overview

The transformation scripts convert the current 2.4GB of JSON data into an optimized structure with:
- Individual entity files for lazy loading
- Multiple indexes for fast lookups
- Gzip compression (87% size reduction)
- Organized by type, frequency, and other attributes

## Scripts

### 1. transform-words.js
Transforms single words data from `single words tracks/` directory.

**Output:** `data/optimized/words/`
- Individual word files (one per word)
- Index by frequency
- Index by surah
- Index by part of speech (POS)
- Index by root

### 2. transform-murakkabat.js
Transforms murakkabat (compounds) data from `quran_murakkabat_db/` directory.

**Output:** `data/optimized/murakkabat/`
- Individual compound files (top 1000 by frequency)
- Index by type (bigrams, trigrams, etc.)
- Index by frequency
- Index by n-gram size
- Grammatical construct indexes

### 3. transform-ayahs.js
Transforms ayahs data from `quran_surah_jsons/` directory.

**Output:** `data/optimized/ayahs/`
- Individual ayah files (top 100 by word count)
- Index by surah
- Index by length (short, medium, long)
- Index by word count

### 4. transform-languages.js
Extracts and organizes language data from the words data.

**Output:** `data/optimized/languages/`
- Native language bundles (15 languages)
- Helper language bundles (15 languages)
- Language index
- Language summary

### 5. create-master-index.js
Creates a master index that ties together all transformed data.

**Output:** `data/optimized/MASTER_INDEX.json`
- Statistics for all data types
- Cross-references between entities
- Quick access paths to frequently used data
- File size estimates

## Usage

### Prerequisites
- Node.js >= 14.0.0
- npm (comes with Node.js)

### Install Dependencies
No external dependencies required - uses only Node.js built-in modules.

### Run All Transformations
```bash
cd scripts
npm run transform:all
```

### Run Individual Transformations
```bash
# Transform words only
npm run transform:words

# Transform murakkabat only
npm run transform:murakkabat

# Transform ayahs only
npm run transform:ayahs

# Transform languages only
npm run transform:languages

# Create master index only
npm run create:index
```

### Clean Output Directory
```bash
npm run clean
```

## Output Structure

After running all transformations, the output structure will be:

```
data/optimized/
├── MASTER_INDEX.json              # Master index file
├── words/
│   ├── index.json.gz              # Words master index
│   ├── words_by_id/               # Individual word files
│   ├── by_frequency/             # Frequency-based indexes
│   ├── by_surah/                  # Surah-based indexes
│   ├── by_pos/                    # POS-based indexes
│   └── by_root/                   # Root-based indexes
├── murakkabat/
│   ├── index.json.gz              # Murakkabat master index
│   ├── by_id/                     # Individual compound files
│   ├── by_type/                   # Type-based indexes
│   ├── by_frequency/             # Frequency-based indexes
│   ├── by_size/                   # N-gram size indexes
│   └── grammatical/               # Grammatical construct indexes
├── ayahs/
│   ├── index.json.gz              # Ayahs master index
│   ├── by_id/                     # Individual ayah files
│   ├── by_surah/                  # Surah-based indexes
│   └── by_length/                 # Length-based indexes
└── languages/
    ├── index.json.gz              # Languages master index
    ├── summary.json.gz           # Language summary
    ├── native/                    # Native language bundles
    └── helper/                    # Helper language bundles
```

## Performance Improvements

### Before Transformation
- Total size: ~2.4GB
- All data loaded upfront
- No indexing
- No compression
- Linear searches

### After Transformation
- Total size: ~300MB (87% reduction)
- Lazy loading of individual entities
- Multiple indexes for O(1) lookups
- Gzip compression
- Optimized data structure

## Data Access Patterns

### Get Word by ID
1. Check L1 cache (in-memory) - O(1)
2. Check L2 cache (IndexedDB) - O(1)
3. Load from file (lazy) - O(1) with file path
4. Cache in L1 and L2

### Get Words by Frequency
1. Load frequency index
2. Slice to get top N
3. Lazy load individual words

### Get Words by Surah
1. Load surah index
2. Get word IDs
3. Lazy load individual words

## Notes

- All output files are compressed with gzip (level 9)
- Individual entity files are created for top items only to avoid file system overhead
- Indexes are created for all items to enable fast lookups
- The transformation process may take several minutes depending on your system

## Troubleshooting

### Out of Memory Error
If you encounter memory issues during transformation:
1. Close other applications
2. Increase Node.js memory limit: `node --max-old-space-size=4096 transform-words.js`

### File Not Found Errors
Ensure the source directories exist:
- `single words tracks/`
- `quran_murakkabat_db/`
- `quran_surah_jsons/`

### Permission Errors
Ensure you have write permissions to the `data/optimized/` directory.

## Next Steps

After data transformation:
1. Review the output structure in `data/optimized/`
2. Check the master index in `MASTER_INDEX.json`
3. Verify the file sizes and compression ratios
4. Proceed to build the application using the optimized data structure
