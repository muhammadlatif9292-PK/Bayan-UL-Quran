const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

console.log('Starting server on port', PORT);

// Serve data from public
app.use('/data', express.static(path.join(__dirname, 'public', 'data')));

// Serve dist
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`✓ Server running at http://localhost:${PORT}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});
