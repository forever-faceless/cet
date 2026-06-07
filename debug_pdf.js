const fs = require('fs');
const path = require('path');

async function main() {
  const PDFParser = (await import('pdf2json')).default;
  
  // Debug the 2022 R1, 2023 R1, and 2024 R1 PDFs to understand their format
  const files = [
    'pdfs/2022_R1.pdf',
    'pdfs/2023_R1.pdf',
    'pdfs/2024_R1.pdf',
  ];
  
  for (const file of files) {
    const filepath = path.join(__dirname, file);
    if (!fs.existsSync(filepath)) {
      console.log(`\n${file} does not exist, skipping`);
      continue;
    }
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Debugging: ${file}`);
    console.log(`File size: ${fs.statSync(filepath).size} bytes`);
    console.log(`${'='.repeat(70)}`);
    
    await new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();
      
      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        const pages = pdfData.Pages;
        console.log(`Total pages: ${pages.length}`);
        
        // Show first 2 pages
        for (let pageIdx = 0; pageIdx < Math.min(2, pages.length); pageIdx++) {
          const page = pages[pageIdx];
          console.log(`\n--- Page ${pageIdx + 1} (${page.Texts.length} text items) ---`);
          
          // Group texts by Y position
          const rows = {};
          for (const text of page.Texts) {
            const y = Math.round(text.y * 10) / 10;
            if (!rows[y]) rows[y] = [];
            rows[y].push({
              x: text.x,
              text: decodeURIComponent(text.R.map(r => r.T).join(''))
            });
          }
          
          const sortedYs = Object.keys(rows).map(Number).sort((a, b) => a - b);
          let lineCount = 0;
          for (const y of sortedYs) {
            if (lineCount > 40) {
              console.log('  ... (truncated)');
              break;
            }
            const items = rows[y].sort((a, b) => a.x - b.x);
            const line = items.map(t => t.text).join(' | ');
            console.log(`  Y=${y}: ${line}`);
            lineCount++;
          }
        }
        
        resolve();
      });
      
      pdfParser.on('pdfParser_dataError', (err) => {
        console.error('Parse error:', err);
        resolve();
      });
      
      pdfParser.loadPDF(filepath);
    });
  }
}

main().catch(console.error);
