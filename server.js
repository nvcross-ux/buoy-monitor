const express = require('express');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Gulf of Maine NDBC buoy stations (all verified active)
const STATIONS = [
  { id: '44007', name: 'Portland Approach',   lat: 43.525, lon: -70.140 },
  { id: '44011', name: 'Georges Bank',        lat: 41.088, lon: -66.546 },
  { id: '44013', name: 'Boston Offshore',     lat: 42.346, lon: -70.651 },
  { id: '44020', name: 'Nantucket Sound',     lat: 41.497, lon: -70.283 },
  { id: '44027', name: 'Jonesport, ME',       lat: 44.284, lon: -67.301 },
  { id: '44029', name: 'SE of Cape Ann',      lat: 42.523, lon: -70.566 },
  { id: '44030', name: 'Biddeford Pool',      lat: 43.179, lon: -70.426 },
  { id: '44034', name: 'Frenchman Bay',       lat: 44.103, lon: -68.112 },
  { id: '44098', name: "Jeffrey's Ledge",     lat: 42.800, lon: -70.169 },
  { id: 'MDRM1', name: 'Mt. Desert Rock',     lat: 43.969, lon: -68.128 },
  { id: 'MISM1', name: 'Matinicus Rock',      lat: 43.784, lon: -68.855 },
];

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/stations', (req, res) => {
  res.json(STATIONS);
});

function fetchNDBCData(stationId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.ndbc.noaa.gov',
      path: `/data/realtime2/${stationId}.txt`,
      method: 'GET',
      headers: { 'User-Agent': 'GulfOfMaineBuoyMonitor/1.0 (educational)' },
      timeout: 12000,
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 404) {
        reject(new Error('Station not found'));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.on('error', reject);
    req.end();
  });
}

function parseNDBCData(rawText, stationId) {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  // Line 0: column headers (starts with #)
  const headerCols = lines[0].replace(/^#\s*/, '').split(/\s+/);

  // First non-comment line is the most recent observation
  const dataLine = lines.find((l) => !l.startsWith('#'));
  if (!dataLine) return null;

  const vals = dataLine.split(/\s+/);

  const getVal = (col) => {
    const idx = headerCols.indexOf(col);
    return idx >= 0 && idx < vals.length ? vals[idx] : null;
  };

  // Parse a numeric field; returns null if missing or above threshold
  const parseNum = (raw, missingThreshold) => {
    if (!raw || raw === 'MM') return null;
    const n = parseFloat(raw);
    if (isNaN(n) || n >= missingThreshold) return null;
    return n;
  };

  // Build UTC timestamp
  const yy = getVal('YY');
  const mon = getVal('MM');
  const dd = getVal('DD');
  const hh = getVal('hh');
  const min = getVal('mm');

  let timestamp = null;
  if (yy && mon && dd && hh && min) {
    const yr = parseInt(yy, 10);
    // NDBC now uses 4-digit years; fall back to century-guessing for legacy 2-digit values
    const year = yr > 1900 ? yr : yr < 50 ? 2000 + yr : 1900 + yr;
    timestamp = new Date(
      `${year}-${mon.padStart(2, '0')}-${dd.padStart(2, '0')}T${hh.padStart(2, '0')}:${min.padStart(2, '0')}:00Z`
    ).toISOString();
  }

  return {
    stationId,
    timestamp,
    windDir:    parseNum(getVal('WDIR'), 999),   // degrees true
    windSpeed:  parseNum(getVal('WSPD'), 99),    // m/s
    gustSpeed:  parseNum(getVal('GST'),  99),    // m/s
    waveHeight: parseNum(getVal('WVHT'), 99),    // meters
    domPeriod:  parseNum(getVal('DPD'),  99),    // seconds (dominant)
    avgPeriod:  parseNum(getVal('APD'),  99),    // seconds (average)
    waveDir:    parseNum(getVal('MWD'),  999),   // degrees true
    pressure:   parseNum(getVal('PRES'), 9999),  // hPa
    airTemp:    parseNum(getVal('ATMP'), 999),   // °C
    waterTemp:  parseNum(getVal('WTMP'), 999),   // °C
    dewPoint:   parseNum(getVal('DEWP'), 999),   // °C
  };
}

app.get('/api/station/:id/data', async (req, res) => {
  const { id } = req.params;
  // Basic validation – only allow alphanumeric station IDs
  if (!/^[A-Z0-9]{5,8}$/i.test(id)) {
    return res.status(400).json({ error: 'Invalid station ID' });
  }
  try {
    const raw = await fetchNDBCData(id);
    const data = parseNDBCData(raw, id);
    if (!data) return res.status(404).json({ error: 'No data available' });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('\n  Gulf of Maine Buoy Monitor');
  console.log('  ──────────────────────────────');
  console.log(`  http://localhost:${PORT}`);
  console.log(`  Monitoring ${STATIONS.length} NDBC stations\n`);
});
