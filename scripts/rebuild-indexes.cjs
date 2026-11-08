const fs = require('fs');
const path = require('path');

const publicDataDir = path.join(__dirname, '..', 'public', 'data');
const wordsPath = path.join(publicDataDir, 'words.json');
const wordsIndexPath = path.join(publicDataDir, 'words-index.json');
const murakkabatPath = path.join(publicDataDir, 'murakkabat.json');
const murakkabatChunksDir = path.join(publicDataDir, 'murakkabat-chunks');

try {
  console.log('Reading words.json...');
  const wordsRaw = fs.readFileSync(wordsPath, 'utf8');
  const wordsData = JSON.parse(wordsRaw);
  
  console.log(`Found ${wordsData.words ? wordsData.words.length : 0} words.`);
  
  const wordIds = (wordsData.words || []).map(w => ({ id: w.id }));
  
  fs.writeFileSync(wordsIndexPath, JSON.stringify({ index: wordIds }, null, 2));
  console.log('Successfully wrote words-index.json!');
  
  // Count chunks of murakkabat
  let chunkCount = 0;
  if (fs.existsSync(murakkabatChunksDir)) {
    const files = fs.readdirSync(murakkabatChunksDir);
    const chunkFiles = files.filter(f => f.startsWith('chunk-') && f.endsWith('.json'));
    chunkCount = chunkFiles.length;
    console.log(`Found ${chunkCount} murakkabat chunks.`);
  }
  
  const murakkabatMetadata = {
    metadata: {
      total: 348462,
      chunks: chunkCount || 146,
      chunkSize: 2400
    }
  };
  
  fs.writeFileSync(murakkabatPath, JSON.stringify(murakkabatMetadata, null, 2));
  console.log('Successfully wrote murakkabat.json metadata!');
} catch (error) {
  console.error('Error rebuilding indexes:', error);
  process.exit(1);
}
