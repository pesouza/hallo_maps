const fs = require('fs');
const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

const INPUT = 'adresses.csv'; // ou 'enderecos.csv'
const OUTPUT = 'adresses_geocoded.csv';
const USER_AGENT = 'hallo_maps_geocoder/1.0 (seu-email@exemplo.com)';

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function geocode(q){
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q);
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (!json || json.length === 0) return null;
  return { lat: json[0].lat, lon: json[0].lon };
}

function extractCsvContent(raw) {
  const lines = raw.split(/\r?\n/);
  // procura a linha do cabeçalho começando por "id" (insensitive)
  const headerIdx = lines.findIndex(l => /^\s*id\s*,\s*street\s*,/i.test(l));
  if (headerIdx === -1) {
    // fallback: tenta primeira linha não vazia
    const firstNonEmpty = lines.findIndex(l => l.trim() !== '');
    return lines.slice(firstNonEmpty).join('\n');
  }
  return lines.slice(headerIdx).join('\n');
}

(async () => {
  if (!fs.existsSync(INPUT)) {
    console.error('Arquivo de entrada não encontrado:', INPUT);
    process.exit(1);
  }

  const raw = fs.readFileSync(INPUT, 'utf8');
  const csvText = extractCsvContent(raw);

  let rows;
  try {
    rows = parse(csvText, { columns: true, skip_empty_lines: true });
  } catch (err) {
    console.error('Erro ao parsear CSV:', err.message);
    process.exit(1);
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const addrParts = [r.street, r.number].filter(Boolean).join(' ');
    // cidade/estado ajustados para São José dos Campos, SP
    const q = addrParts + ' São José dos Campos, SP';
    try {
      const g = await geocode(q);
      if (g) {
        r.lat = g.lat;
        r.lon = g.lon;
        console.log(`${i+1}/${rows.length} => ${q} => ${g.lat},${g.lon}`);
      } else {
        r.lat = '';
        r.lon = '';
        console.log(`${i+1}/${rows.length} => ${q} => NOT FOUND`);
      }
    } catch (err) {
      console.error('Erro geocoding', q, err.message);
      r.lat = '';
      r.lon = '';
    }
    await sleep(1100); // Nominatim: respeitar ~1 req/s
  }

  const out = stringify(rows, { header: true });
  fs.writeFileSync(OUTPUT, out, 'utf8');
  console.log('Gravado em', OUTPUT);
})();