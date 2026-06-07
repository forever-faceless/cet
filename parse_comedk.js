const fs = require('fs');
const path = require('path');

const COMEDK_CS_COURSES = {
  'AD': 'Artificial Intelligence and Data Science',
  'AI': 'Artificial Intelligence and Machine Learning',
  'AM': 'Automation and Robotics',
  'AR': 'Automation and Robotics',
  'CA': 'Computer Science (Artificial Intelligence)',
  'CAD': 'Computer Science and Engineering (AI and Data Science)',
  'CB': 'Computer Science and Business Systems',
  'CBD': 'Computer Science and Technology (Big Data)',
  'CD': 'Computer Science and Engineering - Data Science',
  'CE': 'Computer Engineering',
  'CG': 'Computer Science and Design',
  'CI': 'Computer Science (AI and Machine Learning)',
  'CIT': 'Computer Science and Information Technology',
  'CM': 'Computer and Communication Engineering',
  'CN': 'Computer Science and Technology',
  'CNW': 'Computer Science and Technology',
  'CO': 'Computer Science - Internet of Things',
  'COS': 'Computer Science - Internet of Things',
  'CR': 'Computer Science',
  'CSB': 'Computer Science - Blockchain',
  'CS': 'Computer Science and Engineering',
  'CSD': 'Computer Science and Technology (DevOps)',
  'CSI': 'Computer Science (AI and Machine Learning)',
  'CSS': 'Computer Science - Cyber Security',
  'CST': 'Computer Science and Technology',
  'CX': 'Cyber Security',
  'CY': 'Computer Science - Cyber Security',
  'DS': 'Data Science',
  'ECS': 'Electronics and Computer Engineering',
  'IAR': 'Information Technology (AR/VR)',
  'IC': 'Computer Science - IoT and Blockchain',
  'IDA': 'Information Technology (Data Analytics)',
  'INT': 'Information Technology',
  'IS': 'Information Science and Engineering',
  'IST': 'Information Science and Technology',
  'RA': 'Robotics and Automation',
  'RI': 'Robotics and Artificial Intelligence',
  'ROB': 'Robotics',
  'UE': 'Electronics and Computer Engineering',
  'UO': 'Electronics and Computer Engineering',
};

async function parseCOMEDK(filepath, year) {
  const PDFParser = (await import('pdf2json')).default;

  return new Promise((resolve, reject) => {
    const parser = new PDFParser();

    parser.on('pdfParser_dataReady', (pdfData) => {
      const results = [];

      // Auto-detect seat category x-position from first page
      const firstPageItems = pdfData.Pages[0].Texts.map(t => ({
        x: Math.round(t.x * 100) / 100,
        y: Math.round(t.y * 10) / 10,
        text: decodeURIComponent(t.R.map(r => r.T).join(''))
      }));

      const gmItem = firstPageItems.find(i => i.text.trim() === 'GM' && i.y > 6);
      const catX = gmItem ? gmItem.x : 23;
      const dataStartY = gmItem ? gmItem.y - 1 : 11;

      // Auto-detect header Y range
      const codeItems = firstPageItems.filter(i => /^[A-Z]{2,4}-/.test(i.text));
      const headerMinY = codeItems.length > 0 ? Math.min(...codeItems.map(i => i.y)) - 0.5 : 7;
      const headerMaxY = dataStartY;

      console.log(`  Layout: catX=${catX}, dataStartY=${dataStartY}, headerY=${headerMinY}-${headerMaxY}`);

      // Identify page sets by their course codes
      for (let p = 0; p < pdfData.Pages.length; p++) {
        const page = pdfData.Pages[p];
        const items = page.Texts.map(t => ({
          x: Math.round(t.x * 100) / 100,
          y: Math.round(t.y * 10) / 10,
          text: decodeURIComponent(t.R.map(r => r.T).join(''))
        }));

        // Find course columns from header
        const columns = items
          .filter(i => i.y >= headerMinY && i.y < headerMaxY && /^[A-Z]{2,4}-/.test(i.text))
          .map(i => ({ code: i.text.split('-')[0], x: i.x }))
          .sort((a, b) => a.x - b.x);

        if (columns.length === 0) continue;

        const csColumns = columns.filter(c => COMEDK_CS_COURSES[c.code]);
        if (csColumns.length === 0) continue;

        // Build column boundaries
        const colBounds = columns.map((col, i) => {
          const left = i === 0 ? catX + 1 : (columns[i - 1].x + col.x) / 2;
          const right = i === columns.length - 1 ? 55 : (col.x + columns[i + 1].x) / 2;
          return { code: col.code, x: col.x, left, right };
        });

        // Parse data rows
        const rows = {};
        for (const item of items) {
          if (!rows[item.y]) rows[item.y] = [];
          rows[item.y].push(item);
        }

        for (const [yStr, rowItems] of Object.entries(rows)) {
          const y = parseFloat(yStr);
          if (y < dataStartY) continue;

          rowItems.sort((a, b) => a.x - b.x);
          const joined = rowItems.map(i => i.text).join(' ');
          if (joined.includes('Page ') && joined.includes(' of ')) continue;

          // Find college code
          const codeItem = rowItems.find(i => /^E\d{3,4}$/.test(i.text.trim()) && i.x < catX - 2);
          if (!codeItem) continue;

          const collegeCode = codeItem.text.trim();
          const nameItems = rowItems.filter(i => i.x > codeItem.x + 1 && i.x < catX - 1);
          const collegeName = nameItems.map(i => i.text).join(' ').trim();

          const catItem = rowItems.find(i =>
            Math.abs(i.x - catX) < 2 && /^(GM|KKR|HKR)$/.test(i.text.trim())
          );
          const seatCategory = catItem ? catItem.text.trim() : '';

          // Find rank values to the right of category
          const minRankX = catX + 2;
          const rankItems = rowItems.filter(i => i.x > minRankX && /^\d+$/.test(i.text.trim()));

          for (const ri of rankItems) {
            const rank = parseInt(ri.text.trim());
            if (isNaN(rank)) continue;

            const col = colBounds.find(c => ri.x >= c.left - 1 && ri.x < c.right + 1);
            if (!col) continue;
            if (!COMEDK_CS_COURSES[col.code]) continue;

            results.push({
              year,
              collegeCode,
              college: collegeName,
              seatCategory,
              courseCode: col.code,
              course: COMEDK_CS_COURSES[col.code],
              rank,
            });
          }
        }
      }

      resolve(results);
    });

    parser.on('pdfParser_dataError', (err) => reject(err));
    parser.loadPDF(filepath);
  });
}

async function parseCOMEDK2022(filepath) {
  const PDFParser = (await import('pdf2json')).default;

  return new Promise((resolve, reject) => {
    const parser = new PDFParser();

    parser.on('pdfParser_dataReady', (pdfData) => {
      const results = [];

      // 2022: wide landscape table, 24 pages, same columns on every page
      // College code at x~0.7, name at x~2.3, seat category at x~14
      // Only 3 CS-related columns visible on the page:
      const col2022 = [
        { code: 'AD', course: 'Artificial Intelligence and Data Science', left: 19.5, right: 22.0 },
        { code: 'AI', course: 'Artificial Intelligence and Machine Learning', left: 22.0, right: 24.5 },
        { code: 'AR', course: 'Automation and Robotics', left: 24.5, right: 27.0 },
      ];

      for (let p = 0; p < pdfData.Pages.length; p++) {
        const page = pdfData.Pages[p];
        const items = page.Texts.map(t => ({
          x: Math.round(t.x * 100) / 100,
          y: Math.round(t.y * 10) / 10,
          text: decodeURIComponent(t.R.map(r => r.T).join(''))
        }));

        const rows = {};
        for (const item of items) {
          if (!rows[item.y]) rows[item.y] = [];
          rows[item.y].push(item);
        }

        for (const [yStr, rowItems] of Object.entries(rows)) {
          const y = parseFloat(yStr);
          if (y < 6.5) continue;

          rowItems.sort((a, b) => a.x - b.x);
          const joined = rowItems.map(i => i.text).join(' ');
          if (joined.includes('Page ') || joined.includes('CUT OFF')) continue;

          const codeItem = rowItems.find(i => /^E\d{3,4}$/.test(i.text.trim()) && i.x < 4);
          if (!codeItem) continue;

          const collegeCode = codeItem.text.trim();
          const nameItems = rowItems.filter(i => i.x > 1.5 && i.x < 13);
          const collegeName = nameItems.map(i => i.text).join(' ').trim();

          const catItem = rowItems.find(i => Math.abs(i.x - 14) < 1.5 && /^(GM|HKR|KKR)$/.test(i.text.trim()));
          const seatCategory = catItem ? catItem.text.trim() : '';

          const rankItems = rowItems.filter(i => i.x > 15 && /^\d+$/.test(i.text.trim()));

          for (const ri of rankItems) {
            const rank = parseInt(ri.text.trim());
            if (isNaN(rank)) continue;
            const col = col2022.find(c => ri.x >= c.left && ri.x < c.right);
            if (!col) continue;

            results.push({
              year: 2022,
              collegeCode,
              college: collegeName,
              seatCategory,
              courseCode: col.code,
              course: col.course,
              rank,
            });
          }
        }
      }

      resolve(results);
    });

    parser.on('pdfParser_dataError', (err) => reject(err));
    parser.loadPDF(filepath);
  });
}

async function main() {
  const files = [
    { file: 'pdfs/comedk/2025_R1.pdf', year: 2025 },
    { file: 'pdfs/comedk/2024_R1.pdf', year: 2024 },
    { file: 'pdfs/comedk/2023_R1.pdf', year: 2023 },
  ];

  const allResults = [];

  for (const { file, year } of files) {
    const fp = path.join(__dirname, file);
    if (!fs.existsSync(fp)) { console.log(`${year}: not found`); continue; }
    console.log(`\nParsing COMEDK ${year}...`);
    try {
      const results = await parseCOMEDK(fp, year);
      const gm = results.filter(r => r.seatCategory === 'GM');
      const gmUnder60k = gm.filter(r => r.rank <= 60000);
      console.log(`  Total: ${results.length}, GM: ${gm.length}, GM<=60k: ${gmUnder60k.length}`);

      gmUnder60k.sort((a, b) => a.rank - b.rank).slice(0, 10)
        .forEach(r => console.log(`    ${r.rank} | ${r.courseCode} ${r.course} | ${r.college.substring(0, 50)}`));

      allResults.push(...results);
    } catch (e) {
      console.error(`  FAILED: ${e.message}`);
    }
  }

  // Also try 2022 separately
  const fp2022 = path.join(__dirname, 'pdfs/comedk/2022_R1.pdf');
  if (fs.existsSync(fp2022)) {
    console.log('\nParsing COMEDK 2022 (different format)...');
    try {
      const results = await parseCOMEDK2022(fp2022);
      console.log(`  Found ${results.length} entries`);
      allResults.push(...results);
    } catch (e) {
      console.error(`  FAILED: ${e.message}`);
    }
  }

  // Save
  fs.writeFileSync(path.join(__dirname, 'comedk_cs_cutoffs.json'), JSON.stringify(allResults, null, 2));
  console.log(`\nSaved ${allResults.length} COMEDK entries to comedk_cs_cutoffs.json`);

  const byYear = {};
  for (const r of allResults) byYear[r.year] = (byYear[r.year] || 0) + 1;
  console.log('\nEntries per year:');
  Object.entries(byYear).sort().forEach(([y, c]) => console.log(`  ${y}: ${c}`));

  // Unique courses
  const courses = [...new Set(allResults.map(r => r.course))].sort();
  console.log(`\nUnique courses (${courses.length}):`);
  courses.forEach(c => console.log(`  - ${c}`));
}

main().catch(console.error);
