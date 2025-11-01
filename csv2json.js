const fs = require('fs');
const { parse } = require('csv-parse/sync');

const INPUT = 'adresses_geocoded.csv';
const OUTPUT = 'casas.json';
// default coord used when a row has no lat/lon
const DEFAULT_COORDS = [-23.205337, -45.957613];

if (!fs.existsSync(INPUT)) {
  console.error('Arquivo não encontrado:', INPUT);
  process.exit(1);
}

const raw = fs.readFileSync(INPUT, 'utf8');
const rows = parse(raw, { columns: true, skip_empty_lines: true });

const casas = rows.map((r, idx) => {
  const street = (r.street || '').trim();
  const number = (r.number || '').toString().trim();
  const residents = (r.residents || '').trim();
  // limpeza simples de lat/lon (remove espaços)
  const latRaw = (r.lat || '').toString().trim();
  const lonRaw = (r.lon || '').toString().trim();

  const lat = latRaw === '' ? null : parseFloat(latRaw.replace(/\s+/g, ''));
  const lon = lonRaw === '' ? null : parseFloat(lonRaw.replace(/\s+/g, ''));

  const coords = (Number.isFinite(lat) && Number.isFinite(lon))
    ? [lat, lon]
    : DEFAULT_COORDS;

  return {
    nome: `${street}${number ? ', ' + number : ''}`.trim(),
    descricao: residents ? `Moradores: ${residents}` : '',
    address: `${street}${number ? ', ' + number : ''}, São José dos Campos, SP`,
    coords,
    geocoded: (Number.isFinite(lat) && Number.isFinite(lon)),
    img: 'https://cdn-icons-png.flaticon.com/512/4151/4151794.png'
  };
});

fs.writeFileSync(OUTPUT, JSON.stringify(casas, null, 2), 'utf8');
const total = casas.length;
const missing = casas.filter(c => !c.geocoded).length;
console.log(`Gerado ${OUTPUT} — ${total} entradas (${missing} sem coords originais, usando DEFAULT_COORDS).`);