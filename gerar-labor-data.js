const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'uploads', 'data__NOVO.csv');
const outputPath = path.join(__dirname, 'labor-data.js');
const LEVELS = ['DIAMOND', 'PLATINUM', 'GOLD', 'STANDARD', 'SEM SEGMENTAÇÃO'];

function parseCsv(text){
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for(let i = 0; i < text.length; i++){
    const ch = text[i];
    const next = text[i + 1];

    if(quoted){
      if(ch === '"' && next === '"'){
        value += '"';
        i++;
      } else if(ch === '"'){
        quoted = false;
      } else {
        value += ch;
      }
      continue;
    }

    if(ch === '"'){
      quoted = true;
    } else if(ch === ','){
      row.push(value);
      value = '';
    } else if(ch === '\n'){
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else if(ch !== '\r'){
      value += ch;
    }
  }

  if(value || row.length){
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function tagToLevel(value){
  const v = String(value || '').toLowerCase();
  if(v.includes('diamond')) return 'DIAMOND';
  if(v.includes('platinum')) return 'PLATINUM';
  if(v.includes('gold')) return 'GOLD';
  if(v.includes('standard')) return 'STANDARD';
  if(v.includes('sem_classificacao') || v.includes('sem classificacao') || v.includes('sem_segmentacao')) return 'SEM SEGMENTAÇÃO';
  return String(value || '').trim().toUpperCase() || 'SEM SEGMENTAÇÃO';
}

function numberBR(value){
  const raw = String(value || '').trim();
  if(!raw) return 0;
  const cleaned = raw
    .replace(/R\$/g, '')
    .replace(/%/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function buildDashboard(rows){
  const headers = (rows[0] || []).map(h => String(h || '').replace(/^\uFEFF/, '').trim());
  const dataRows = rows.slice(1).filter(r => r.some(v => String(v || '').trim()));
  const ix = name => headers.indexOf(name);
  const ixSeq = template => Array.from({length: 7}, (_, i) => ix(template(i + 1)));

  const idx = {
    atual: ix('Segmentação (Atual)'),
    auto: ix('Segmentação (Automatizado)'),
    autoNoSku: ix('Segmentação (Automatizado) s/ média SKU'),
    id: ix('ID Cliente'),
    col: ix('Coligada'),
    fatJanelas: ixSeq(n => `Fat. Media Janela ${n} Coligada`),
    margemJanelas: ixSeq(n => `Margem Media Janela ${n} Coligada`),
    mesesJanelas: ixSeq(n => `Meses Compra Janela ${n} Coligada`),
    skusJanelas: ixSeq(n => `Media SKUs Janela ${n}`),
    mbJanelas: ixSeq(n => `Margem % Janela ${n}`),
    mbColigada: ix('MB % (Coligada)'),
    nome: ix('Nome Fantasia'),
    vendedor: ix('Carteira Vendedor')
  };

  const missing = [];
  for(const [key, value] of Object.entries(idx)){
    if(['atual','autoNoSku','mbColigada'].includes(key)) continue;
    if(Array.isArray(value)){
      if(key === 'mbJanelas' && value.every(colIdx => colIdx < 0)) continue;
      value.forEach((colIdx, i) => { if(colIdx < 0) missing.push(`${key}[${i + 1}]`); });
    } else if(value < 0){
      missing.push(key);
    }
  }
  if(missing.length){
    throw new Error('Colunas ausentes no CSV: ' + missing.join(', '));
  }

  const counts = {
    atual: Object.fromEntries(LEVELS.map(l => [l, 0])),
    auto: Object.fromEntries(LEVELS.map(l => [l, 0])),
    autoNoSku: Object.fromEntries(LEVELS.map(l => [l, 0])),
    total: 0
  };

  const raw = dataRows.map(r => {
    const na = idx.atual >= 0 ? tagToLevel(r[idx.atual]) : tagToLevel(r[idx.auto]);
    const nb = tagToLevel(r[idx.auto]);
    const nc = idx.autoNoSku>=0 ? tagToLevel(r[idx.autoNoSku]) : nb;
    counts.atual[na] = (counts.atual[na] || 0) + 1;
    counts.auto[nb] = (counts.auto[nb] || 0) + 1;
    counts.autoNoSku[nc] = (counts.autoNoSku[nc] || 0) + 1;

    const fat = idx.fatJanelas.map(i => numberBR(r[i]));
    const margem = idx.margemJanelas.map(i => numberBR(r[i]));
    const meses = idx.mesesJanelas.map(i => numberBR(r[i]));
    const skus = idx.skusJanelas.map(i => Math.round(numberBR(r[i])));
    const mb = idx.mbJanelas.some(i => i >= 0)
      ? idx.mbJanelas.map(i => i >= 0 ? numberBR(r[i]) : 0)
      : Array.from({length: 7}, () => idx.mbColigada >= 0 ? numberBR(r[idx.mbColigada]) : 0);

    return {
      na,
      nb,
      nc,
      id: String(r[idx.id] || '').trim(),
      col: String(r[idx.col] || '').trim(),
      mc: meses[0],
      m7: meses[6],
      mcs: meses,
      sk: skus[0],
      sk7: skus[6],
      sks: skus,
      fm: fat[0],
      fm7: fat[6],
      fms: fat,
      mg: margem[0],
      mg7: margem[6],
      mgs: margem,
      mb: mb[0],
      mb7: mb[6],
      mbs: mb,
      no: String(r[idx.nome] || '').trim(),
      vd: String(r[idx.vendedor] || '').trim()
    };
  });

  counts.total = raw.length;
  return { COUNTS: counts, RAW: raw };
}

if(!fs.existsSync(inputPath)){
  console.error('CSV nao encontrado:', inputPath);
  process.exit(1);
}

const csv = fs.readFileSync(inputPath, 'utf8');
const dashboard = buildDashboard(parseCsv(csv));
const output = [
  '// Labor Health Supply - dataset de segmentacao',
  '// Gerado automaticamente de uploads/data__NOVO.csv',
  'window.LABOR_DASH = ' + JSON.stringify(dashboard) + ';',
  ''
].join('\n');

fs.writeFileSync(outputPath, output, 'utf8');

console.log('Arquivo gerado:', outputPath);
console.log('Total de clientes:', dashboard.COUNTS.total);
console.log('Autom. s/sku:', JSON.stringify(dashboard.COUNTS.autoNoSku));
