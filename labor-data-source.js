// Fonte de dados do dashboard.
// Atualize uploads/data__NOVO.csv para atualizar a tela sem alterar o codigo.
(function(){
  const CSV_URL = './uploads/data__NOVO.csv';

  if(window.location.protocol === 'file:'){
    window.LABOR_DASH_READY = Promise.reject(new Error('Abra pelo arquivo Abrir dashboard.bat ou por http://localhost:8000. O navegador bloqueia leitura de CSV quando o HTML e aberto direto da pasta.'));
    return;
  }

  function detectDelimiter(text){
    const headerLine = text.split(/\r?\n/, 1)[0] || '';
    const semi = (headerLine.match(/;/g) || []).length;
    const comma = (headerLine.match(/,/g) || []).length;
    return semi > comma ? ';' : ',';
  }

  function parseCsv(text, delimiter){
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
      } else if(ch === delimiter){
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

    // Aceita tanto o formato novo (export do DAX/Power Automate) quanto o
    // formato antigo (export manual de rotina) — os dois convivem por ora.
    const mbNovo = ixSeq(n => `Pct_Margem_Janela_${n}_Coligada`);
    const mbAntigo = ixSeq(n => `Margem % Janela ${n}`);
    const mbUsaNovo = mbNovo.some(colIdx => colIdx >= 0);
    const vendedorNovo = ix('Nome Vendedor Proper');
    const vendedorAntigo = ix('Carteira Vendedor');

    const idx = {
      id: ix('ID Cliente'),
      col: ix('Coligada'),
      fatJanelas: ixSeq(n => `Fat. Media Janela ${n} Coligada`),
      margemJanelas: ixSeq(n => `Margem Media Janela ${n} Coligada`),
      mesesJanelas: ixSeq(n => `Meses Compra Janela ${n} Coligada`),
      skusJanelas: ixSeq(n => `Media SKUs Janela ${n}`),
      mbJanelas: mbUsaNovo ? mbNovo : mbAntigo,
      nome: ix('Nome Fantasia'),
      vendedor: vendedorNovo >= 0 ? vendedorNovo : vendedorAntigo
    };

    const missing = [];
    for(const [key, value] of Object.entries(idx)){
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

    const counts = { auto: {}, total: 0 };
    // A Margem % vem em fração (0-1) no formato novo, e já em percentual no antigo.
    const mbFator = mbUsaNovo ? 100 : 1;

    const raw = dataRows.map(r => {
      const fat = idx.fatJanelas.map(i => numberBR(r[i]));
      const margem = idx.margemJanelas.map(i => numberBR(r[i]));
      const meses = idx.mesesJanelas.map(i => numberBR(r[i]));
      const skus = idx.skusJanelas.map(i => numberBR(r[i]));
      const mb = idx.mbJanelas.some(i => i >= 0)
        ? idx.mbJanelas.map(i => i >= 0 ? numberBR(r[i]) * mbFator : 0)
        : Array.from({length: 7}, () => 0);

      return {
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

  window.LABOR_DASH_READY = fetch(CSV_URL + '?v=' + Date.now())
    .then(response => {
      if(!response.ok) throw new Error('HTTP ' + response.status);
      return response.text();
    })
    .then(text => {
      window.LABOR_DASH = buildDashboard(parseCsv(text, detectDelimiter(text)));
      window.LABOR_DASH_META = { source: 'CSV: uploads/data__NOVO.csv' };
      return window.LABOR_DASH;
    });
})();
