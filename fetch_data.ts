import { google } from 'googleapis';
import * as fs from 'fs';

async function fetchSheetData() {
  const credentialsJson = process.env.GOOGLE_CREDENTIALS;
  const sheetId = process.env.SHEET_ID;

  if (!credentialsJson || !sheetId) {
    throw new Error('Missing GOOGLE_CREDENTIALS or SHEET_ID environment variable');
  }

  const credentials = JSON.parse(credentialsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const range = 'Stevner';

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: range,
  });

  const values = response.data.values;

  if (!values || values.length === 0) {
    console.log('No data found.');
    fs.writeFileSync('data.json', JSON.stringify([]));
    return;
  }

  const headers = values[0];
  const data = values.slice(1).map((row) => {
    const paddedRow = [...row, ...Array(Math.max(0, headers.length - row.length)).fill('')];
    const rowObject: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowObject[header] = paddedRow[index];
    });
    return rowObject;
  });

  console.log(`Successfully fetched ${data.length} rows`);

  // Create data directory if it doesn't exist
  if (!fs.existsSync('data')) {
    fs.mkdirSync('data');
  }

  // Save full minified dataset
  fs.writeFileSync('data/full.json', JSON.stringify(data));
  
  // Split into chunks for progressive loading
  const CHUNK_SIZE = 1000;
  const chunks = [];
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    const chunkNum = Math.floor(i / CHUNK_SIZE);
    fs.writeFileSync(`data/chunk-${chunkNum}.json`, JSON.stringify(chunk));
    chunks.push(chunkNum);
  }

  // Create manifest with metadata
  const manifest = {
    totalRows: data.length,
    chunkSize: CHUNK_SIZE,
    totalChunks: chunks.length,
    chunks: chunks,
    headers: headers,
    lastUpdated: new Date().toISOString()
  };

  fs.writeFileSync('data/manifest.json', JSON.stringify(manifest));
  
  console.log(`Created ${chunks.length} chunks and manifest`);
  console.log('Data saved to data/ directory');
}

fetchSheetData().catch((error) => {
  console.error('Error fetching data:', error);
  process.exit(1);
});
