// Sync weekly collections from EB-Insights.md to the eb_insights Google Sheet.
// Usage:
//   node scripts/sheet-sync.js             # dry-run (default) — prints payload
//   node scripts/sheet-sync.js --apply     # writes to the sheet
//
// Safety: before --apply, reads the target ranges and aborts if any cell
// that we plan to write already has unexpected content.
//
// See .claude/rules/google-sheets-sync.md for the full runbook.

const { google } = require('googleapis');
const { authClient } = require('./_google-auth-helper');

const SPREADSHEET_ID = '1HXTD-hO1N1xsLV2_LuSxS_4Hhn6Z_HY-Zkx0Vr5Umws';
const SHEET = 'dados';

// Each update is either:
//   - a partial fill (existing row with only Série+Data, we fill B..L):
//       { range: "'dados'!B9:L9", values: [[tema, prof, horaIni, ini, meio, fim, dist, horaFim, clima, obs]] }
//       (10 columns: B, C, E, F, G, H, I, J, K, L — D is skipped because the date is already there)
//   - a new full row (A..L, 12 columns):
//       { range: "'dados'!A11:L11", values: [[serie, tema, prof, data, horaIni, ini, meio, fim, dist, horaFim, clima, obs]] }
//
// Note: for partial fills, we write B:L as a contiguous range and pass an
// empty string for column D (index 2 within the B:L slice). USER_ENTERED
// would overwrite a non-empty D with "", so we handle that by reading D
// separately and preserving it: we build the partial range as two sub-updates
// (B:C and E:L) instead. This avoids touching column D entirely.
//
// So for partial fills we define them with a helper shape:
//   { kind: 'partial', row: N, data: { tema, professor, horaIni, ini, meio, fim, dist, horaFim, clima, obs } }
//
// For full rows:
//   { kind: 'full', row: N, data: { serie, tema, professor, data, horaIni, ini, meio, fim, dist, horaFim, clima, obs } }

const UPDATES = [
  {
    kind: 'partial',
    row: 9,
    data: {
      tema: 'Deus aceita Qualquer Culto?',
      professor: 'Alex Tolomei',
      horaIni: '10:03',
      ini: 16,
      meio: 25,
      fim: 26,
      dist: 7,
      horaFim: '11:04',
      clima: '28°C sol entre nuvens',
      obs: '2 coletores (Abimael + Jeff); Jeff contando com professor — divergência no meio (22 vs 28)',
    },
  },
  {
    kind: 'partial',
    row: 10,
    data: {
      tema: 'Promessas Quebradas',
      professor: 'Augusto César',
      horaIni: '10:04',
      ini: 11,
      meio: 21,
      fim: 28,
      dist: 6,
      horaFim: '11:02',
      clima: 'Ensolarado',
      obs: 'Augusto foi coletor e também professor',
    },
  },
  {
    kind: 'full',
    row: 11,
    data: {
      serie: 'Eb354',
      tema: 'O Maravilhoso Dia do Senhor',
      professor: 'Alex Tolomei',
      data: '2026/mar./28',
      horaIni: '10:06',
      ini: 16,
      meio: 25,
      fim: 31,
      dist: 5,
      horaFim: '10:58',
      clima: 'Bom / céu azul 30°C',
      obs: '3 coletores (Paulo, Augusto, Jeff); fim variou 29–35; Jeff contando com professor',
    },
  },
  {
    kind: 'full',
    row: 12,
    data: {
      serie: 'Eb355',
      tema: 'Soberba - Brincando de ser Rei',
      professor: 'Jefferson Pedro',
      data: '2026/abr./04',
      horaIni: '10:05',
      ini: 14,
      meio: 24,
      fim: 27,
      dist: 5,
      horaFim: '11:01',
      clima: 'Bom. Céu claro. 30°C',
      obs: '2 coletores; Jefferson registrou o título da série (A Luta Contra o Pecado) no lugar do tema da lição',
    },
  },
  {
    kind: 'full',
    row: 13,
    data: {
      serie: 'Eb356',
      tema: 'Inveja',
      professor: 'Augusto César',
      data: '2026/abr./11',
      horaIni: '10:07',
      ini: 26,
      meio: 27,
      fim: 28,
      dist: 5,
      horaFim: '10:59',
      clima: 'Bom/nublado',
      obs: '1 coletor (Paulo)',
    },
  },
];

function buildBatchData() {
  const data = [];
  for (const u of UPDATES) {
    const d = u.data;
    if (u.kind === 'partial') {
      // Split to avoid touching column D (Data).
      // B:C — tema, professor
      data.push({
        range: `'${SHEET}'!B${u.row}:C${u.row}`,
        values: [[d.tema, d.professor]],
      });
      // E:L — horaIni, ini, meio, fim, dist, horaFim, clima, obs
      data.push({
        range: `'${SHEET}'!E${u.row}:L${u.row}`,
        values: [[d.horaIni, d.ini, d.meio, d.fim, d.dist, d.horaFim, d.clima, d.obs]],
      });
    } else if (u.kind === 'full') {
      data.push({
        range: `'${SHEET}'!A${u.row}:L${u.row}`,
        values: [[d.serie, d.tema, d.professor, d.data, d.horaIni, d.ini, d.meio, d.fim, d.dist, d.horaFim, d.clima, d.obs]],
      });
    }
  }
  return data;
}

async function readRanges(sheets, ranges) {
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges,
  });
  return res.data.valueRanges || [];
}

async function safetyCheck(sheets) {
  // For partial fills: the B..C and E..L slices must be empty.
  // For full rows: the A..L slice must be empty.
  const ranges = [];
  for (const u of UPDATES) {
    if (u.kind === 'partial') {
      ranges.push(`'${SHEET}'!B${u.row}:C${u.row}`);
      ranges.push(`'${SHEET}'!E${u.row}:L${u.row}`);
    } else {
      ranges.push(`'${SHEET}'!A${u.row}:L${u.row}`);
    }
  }

  const results = await readRanges(sheets, ranges);
  const problems = [];
  for (const r of results) {
    const rows = r.values || [];
    if (rows.length === 0) continue;
    for (const row of rows) {
      for (const cell of row) {
        if (cell !== undefined && cell !== null && String(cell).trim() !== '') {
          problems.push(`${r.range} contains "${cell}"`);
        }
      }
    }
  }

  if (problems.length > 0) {
    console.error('\n❌ Safety check FAILED — target cells are not empty:');
    problems.forEach((p) => console.error('   - ' + p));
    console.error('\nAborting. Investigate before rerunning.');
    process.exit(2);
  }
}

function printDryRun(batchData) {
  console.log('\n=== DRY RUN — payload that would be sent to batchUpdate ===\n');
  for (const item of batchData) {
    console.log(`  ${item.range}`);
    for (const row of item.values) {
      console.log(`     → [${row.map((v) => JSON.stringify(v)).join(', ')}]`);
    }
    console.log('');
  }
  console.log(`Total ranges: ${batchData.length}`);
  console.log('\nTo apply these changes, rerun with --apply');
}

async function main() {
  const apply = process.argv.includes('--apply');
  const auth = authClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const batchData = buildBatchData();

  if (!apply) {
    printDryRun(batchData);
    return;
  }

  console.log('\nRunning safety check on target ranges...');
  await safetyCheck(sheets);
  console.log('✅ Safety check passed — target ranges are empty.');

  console.log('\nApplying batchUpdate...');
  const res = await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: batchData,
    },
  });

  const totalUpdated = res.data.totalUpdatedCells || 0;
  const totalRows = res.data.totalUpdatedRows || 0;
  console.log(`\n✅ Done. ${totalUpdated} cells across ${totalRows} rows updated.`);
}

main().catch((err) => {
  console.error('Erro no sync:', err.message);
  if (err.response?.data) console.error(err.response.data);
  process.exit(1);
});
