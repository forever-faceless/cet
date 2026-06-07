const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');

// Download a PDF from a URL
function downloadPDF(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);
    protocol.get(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 30000 
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(filepath);
        downloadPDF(response.headers.location, filepath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', (err) => {
      file.close();
      reject(err);
    });
  });
}

async function main() {
  const PDFParser = (await import('pdf2json')).default;
  
  const url = 'https://cetonline.karnataka.gov.in/keawebentry456/ugcet2025/PROF_CODE_N_R_R1kannada.pdf';
  const pdfDir = path.join(__dirname, 'pdfs');
  if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
  
  const filepath = path.join(pdfDir, '2025_R1.pdf');
  
  if (!fs.existsSync(filepath)) {
    console.log('Downloading PDF...');
    await downloadPDF(url, filepath);
    console.log('Downloaded to:', filepath);
  } else {
    console.log('Using cached:', filepath);
  }
  
  // Parse using pdf2json
  const pdfParser = new PDFParser();
  
  return new Promise((resolve, reject) => {
    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      // Get all pages' text content
      const pages = pdfData.Pages;
      console.log(`\n=== PDF has ${pages.length} pages ===\n`);
      
      // Process first 3 pages to understand format
      for (let pageIdx = 0; pageIdx < Math.min(3, pages.length); pageIdx++) {
        const page = pages[pageIdx];
        console.log(`\n--- Page ${pageIdx + 1} ---`);
        
        // Group texts by Y position (rows)
        const rows = {};
        for (const text of page.Texts) {
          const y = Math.round(text.y * 10) / 10; // Round y to group nearby texts
          if (!rows[y]) rows[y] = [];
          rows[y].push({
            x: text.x,
            text: decodeURIComponent(text.R.map(r => r.T).join(''))
          });
        }
        
        // Sort rows by y position and print
        const sortedYs = Object.keys(rows).map(Number).sort((a, b) => a - b);
        for (const y of sortedYs) {
          const rowTexts = rows[y].sort((a, b) => a.x - b.x);
          const line = rowTexts.map(t => t.text).join(' | ');
          console.log(`  Y=${y}: ${line}`);
        }
      }
      
      // Save the raw JSON for deeper inspection
      const rawPath = path.join(__dirname, 'pdf_raw_2025_R1.json');
      // Just save first 2 pages to keep file small
      const subset = { Pages: pages.slice(0, 3).map(p => ({
        Texts: p.Texts.map(t => ({
          x: t.x,
          y: t.y,
          text: decodeURIComponent(t.R.map(r => r.T).join(''))
        }))
      }))};
      fs.writeFileSync(rawPath, JSON.stringify(subset, null, 2));
      console.log(`\nRaw data saved to: ${rawPath}`);
      
      resolve();
    });
    
    pdfParser.on('pdfParser_dataError', (err) => {
      console.error('Error:', err);
      reject(err);
    });
    
    pdfParser.loadPDF(filepath);
  });
}

main().catch(console.error);
