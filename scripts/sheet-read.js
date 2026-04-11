// Diagnostic read of the EB-Insights Google Sheet.
// Usage: node scripts/sheet-read.js
//
// Requires .secrets/google-client.json + .secrets/google-token.json
// (run scripts/google-auth.js first).

const { google } = require('googleapis');
const { authClient } = require('./_google-auth-helper');

const SPREADSHEET_ID = '1HXTD-hO1N1xsLV2_LuSxS_4Hhn6Z_HY-Zkx0Vr5Umws';

async function main() {
  const auth = authClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  console.log(`Planilha: ${meta.data.properties.title}`);
  console.log(`Abas (${meta.data.sheets.length}):`);
  for (const s of meta.data.sheets) {
    const p = s.properties;
    console.log(`  - "${p.title}"  (id=${p.sheetId}, ${p.gridProperties.rowCount}x${p.gridProperties.columnCount})`);
  }

  for (const s of meta.data.sheets) {
    const title = s.properties.title;
    const range = `'${title}'!A1:Z25`;
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
    const rows = res.data.values || [];
    console.log(`\n===== Aba "${title}" — primeiras ${rows.length} linhas =====`);
    rows.forEach((row, i) => {
      console.log(`  [${String(i + 1).padStart(2, ' ')}] ${row.join(' | ')}`);
    });
  }
}

main().catch((err) => {
  console.error('Erro lendo planilha:', err.message);
  if (err.response?.data) console.error(err.response.data);
  process.exit(1);
});
