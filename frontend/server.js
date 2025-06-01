const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 8080;

// Enable CORS for all routes
app.use(cors());

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname)));

// Serve the main HTML file for all routes (SPA behavior)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 MISTER Frontend Server running at http://localhost:${PORT}`);
    console.log(`📊 Mimicking the sleek agent interface style`);
    console.log(`🎯 Connected to MISTER APIs for token analysis`);
});
