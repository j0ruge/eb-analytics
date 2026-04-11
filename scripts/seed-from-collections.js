// Validate the seed-collections.json file.
// Usage: node scripts/seed-from-collections.js
//
// This script does NOT populate the SQLite database directly — the Expo
// SQLite file lives inside the app's private runtime and cannot be reached
// from Node. The actual seed is run in-app via src/services/seedService.ts,
// triggered from the Settings screen ("Carregar dados de exemplo").
//
// This script's job is limited to:
//   1. Parsing the seed JSON and checking its shape.
//   2. Cross-referencing ids (topics → series, collections → topics/profs/series).
//   3. Reporting the 12 collections as a human-readable summary.

const fs = require('fs');
const path = require('path');

const SEED_PATH = path.resolve(__dirname, '..', 'src', 'data', 'seed-collections.json');

function die(msg) {
  console.error(`\n[seed] ERROR: ${msg}\n`);
  process.exit(1);
}

function main() {
  if (!fs.existsSync(SEED_PATH)) die(`Missing ${SEED_PATH}`);

  let data;
  try {
    data = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  } catch (err) {
    die(`Invalid JSON: ${err.message}`);
  }

  if (data.schema_version !== '2.0') die(`schema_version must be "2.0", got ${data.schema_version}`);
  if (!data.catalog || !data.collections) die('missing catalog or collections');

  const series = data.catalog.series || [];
  const topics = data.catalog.topics || [];
  const profs = data.catalog.professors || [];
  const collections = data.collections || [];

  const seriesIds = new Set(series.map((s) => s.id));
  const topicIds = new Set(topics.map((t) => t.id));
  const profIds = new Set(profs.map((p) => p.id));

  // Catalog referential integrity
  for (const t of topics) {
    if (!seriesIds.has(t.series_id)) {
      die(`topic ${t.id} references unknown series_id ${t.series_id}`);
    }
  }

  // Collection referential integrity
  for (const c of collections) {
    const inst = c.lesson_instance;
    if (inst.series_id && !seriesIds.has(inst.series_id)) {
      die(`collection ${c.id} references unknown series_id ${inst.series_id}`);
    }
    if (inst.topic_id && !topicIds.has(inst.topic_id)) {
      die(`collection ${c.id} references unknown topic_id ${inst.topic_id}`);
    }
    if (inst.professor_id && !profIds.has(inst.professor_id)) {
      die(`collection ${c.id} references unknown professor_id ${inst.professor_id}`);
    }
    if (typeof c.attendance.includes_professor !== 'boolean') {
      die(`collection ${c.id} missing attendance.includes_professor boolean`);
    }
    if (c.status !== 'COMPLETED') {
      die(`collection ${c.id} has unexpected status ${c.status}`);
    }
  }

  // Duplicate id check
  const allIds = [...seriesIds, ...topicIds, ...profIds, ...collections.map((c) => c.id)];
  const seen = new Set();
  for (const id of allIds) {
    if (seen.has(id)) die(`duplicate id: ${id}`);
    seen.add(id);
  }

  console.log('[seed] OK — seed-collections.json is valid.');
  console.log('');
  console.log(`  schema_version: ${data.schema_version}`);
  console.log(`  source:         ${data.source}`);
  console.log(`  generated_at:   ${data.generated_at}`);
  console.log(`  series:         ${series.length}`);
  console.log(`  topics:         ${topics.length}`);
  console.log(`  professors:     ${profs.length}`);
  console.log(`  collections:    ${collections.length}`);
  console.log('');
  console.log('  Collections summary:');
  for (const c of collections) {
    const prof = profs.find((p) => p.id === c.lesson_instance.professor_id);
    const topic = topics.find((t) => t.id === c.lesson_instance.topic_id);
    const series_ = series.find((s) => s.id === c.lesson_instance.series_id);
    const profName = prof ? prof.name : '—';
    const topicTitle = topic ? topic.title : '—';
    const seriesCode = series_ ? series_.code : '—';
    const incProf = c.attendance.includes_professor ? ' [inclui prof]' : '';
    console.log(
      `    ${c.lesson_instance.date}  ${seriesCode.padEnd(6)} ${topicTitle.padEnd(32)}  ${profName.padEnd(18)}  ${c.attendance.start}/${c.attendance.mid}/${c.attendance.end}${incProf}`,
    );
  }
  console.log('');
  console.log('  To actually load this data into the app SQLite, open the app');
  console.log('  and tap: Settings → Desenvolvimento → "Carregar dados de exemplo".');
  console.log('');
  console.log('  (Direct Node → Expo SQLite population is not possible — the');
  console.log('   database file lives inside the app private runtime.)');
}

main();
