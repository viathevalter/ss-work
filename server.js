const express = require('express');
const path = require('path');
const XLSX = require('xlsx');
const { loadStore, saveStore, nextId } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ========================
// API: AUTH & EMPRESAS
// ========================

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Informe o NISS ou utilizador.' });
  }
  const cleanNiss = String(username).trim();
  const store = loadStore();
  const empresa = store.empresas.find(e => e.niss === cleanNiss);
  if (!empresa) {
    return res.status(401).json({ error: 'Utilizador (NISS) não encontrado no sistema.' });
  }
  if (password && empresa.senha && empresa.senha !== password) {
    return res.status(401).json({ error: 'Palavra-passe incorreta.' });
  }
  res.json({ success: true, empresa });
});

app.get('/api/empresas', (req, res) => {
  const store = loadStore();
  const empresas = store.empresas.map(e => {
    const trabEmp = store.trabalhadores.filter(t => Number(t.empresa_id) === Number(e.id));
    return {
      ...e,
      total_trabalhadores: trabEmp.length,
      trabalhadores_ativos: trabEmp.filter(t => t.situacao === 'Ativo').length
    };
  });
  res.json(empresas);
});

app.get('/api/empresas/:id', (req, res) => {
  const store = loadStore();
  const emp = store.empresas.find(e => Number(e.id) === Number(req.params.id));
  if (!emp) return res.status(404).json({ error: 'Empresa não encontrada.' });
  res.json(emp);
});

app.post('/api/empresas', (req, res) => {
  try {
    const {
      nome, niss, nif = '', senha = '123456', sigla_avatar = 'EM',
      logo_url = '/assets/ssd.svg', nome_portal = 'SEGURANÇA SOCIAL',
      subtitulo_portal = 'DIRETA', email = '', telefone = '', morada = '', iban = ''
    } = req.body;

    if (!nome || !niss) {
      return res.status(400).json({ error: 'Nome da empresa e NISS são obrigatórios.' });
    }

    const store = loadStore();
    const created = {
      id: nextId(store.empresas),
      nome: String(nome).toUpperCase().trim(),
      niss: String(niss).trim(),
      nif,
      senha,
      sigla_avatar: String(sigla_avatar).toUpperCase().slice(0, 3),
      logo_url,
      nome_portal,
      subtitulo_portal,
      email,
      telefone,
      morada,
      iban,
      ativa: 1
    };
    store.empresas.push(created);
    saveStore(store);
    res.json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/empresas/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const store = loadStore();
    const idx = store.empresas.findIndex(e => Number(e.id) === id);
    if (idx === -1) return res.status(404).json({ error: 'Empresa não encontrada.' });

    const current = store.empresas[idx];
    const updated = {
      ...current,
      nome: req.body.nome !== undefined ? String(req.body.nome).toUpperCase().trim() : current.nome,
      niss: req.body.niss !== undefined ? String(req.body.niss).trim() : current.niss,
      nif: req.body.nif !== undefined ? req.body.nif : current.nif,
      senha: req.body.senha !== undefined && req.body.senha !== '' ? req.body.senha : current.senha,
      sigla_avatar: req.body.sigla_avatar !== undefined ? String(req.body.sigla_avatar).toUpperCase().slice(0, 3) : current.sigla_avatar,
      logo_url: req.body.logo_url !== undefined ? req.body.logo_url : current.logo_url,
      nome_portal: req.body.nome_portal !== undefined ? req.body.nome_portal : current.nome_portal,
      subtitulo_portal: req.body.subtitulo_portal !== undefined ? req.body.subtitulo_portal : current.subtitulo_portal,
      email: req.body.email !== undefined ? req.body.email : current.email,
      telefone: req.body.telefone !== undefined ? req.body.telefone : current.telefone,
      morada: req.body.morada !== undefined ? req.body.morada : current.morada,
      iban: req.body.iban !== undefined ? req.body.iban : current.iban
    };

    store.empresas[idx] = updated;
    saveStore(store);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ========================
// API: TRABALHADORES & VÍNCULOS
// ========================

app.get('/api/trabalhadores', (req, res) => {
  const empresaId = Number(req.query.empresa_id || 1);
  const q = (req.query.q || '').trim().toUpperCase();
  const situacao = (req.query.situacao || '').trim();
  const sortField = ['niss', 'nome', 'data_nascimento', 'situacao', 'data_inicio_vinculo'].includes(req.query.sort)
    ? req.query.sort
    : 'niss';
  const sortDir = req.query.dir === 'desc' ? -1 : 1;

  const store = loadStore();
  let rows = store.trabalhadores.filter(t => Number(t.empresa_id) === empresaId);

  if (q) {
    rows = rows.filter(t =>
      String(t.niss || '').toUpperCase().includes(q) ||
      String(t.nome || '').toUpperCase().includes(q) ||
      String(t.nif || '').toUpperCase().includes(q)
    );
  }
  if (situacao) {
    rows = rows.filter(t => t.situacao === situacao);
  }

  rows.sort((a, b) => {
    const va = String(a[sortField] || '');
    const vb = String(b[sortField] || '');
    return va.localeCompare(vb, 'pt') * sortDir;
  });

  res.json(rows);
});

app.get('/api/trabalhadores/export/xlsx', (req, res) => {
  const empresaId = Number(req.query.empresa_id || 1);
  const store = loadStore();
  const empresa = store.empresas.find(e => Number(e.id) === empresaId);
  const rows = store.trabalhadores
    .filter(t => Number(t.empresa_id) === empresaId)
    .sort((a, b) => String(a.niss).localeCompare(String(b.niss)));

  const sheetData = rows.map(r => ({
    'NISS': r.niss,
    'Nome do trabalhador': r.nome,
    'Data de nascimento': r.data_nascimento,
    'NIF': r.nif,
    'Data de início do vínculo': r.data_inicio_vinculo,
    'Data de fim do vínculo': r.data_fim_vinculo || '-',
    'Tipo de contrato': r.tipo_contrato,
    'Regime': r.regime,
    'Taxa contributiva': r.taxa_contributiva,
    'Remuneração base': r.remuneracao_base,
    'Profissão / Categoria': r.profissao,
    'Situação': r.situacao
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(wb, ws, 'Vinculos');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const fileName = `vinculos_${empresa ? empresa.niss : 'empresa'}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

app.get('/api/trabalhadores/:id', (req, res) => {
  const store = loadStore();
  const w = store.trabalhadores.find(t => Number(t.id) === Number(req.params.id));
  if (!w) return res.status(404).json({ error: 'Trabalhador não encontrado.' });
  const emp = store.empresas.find(e => Number(e.id) === Number(w.empresa_id));
  res.json({
    ...w,
    empresa_nome: emp ? emp.nome : '',
    empresa_niss: emp ? emp.niss : '',
    empresa_nif: emp ? emp.nif : ''
  });
});

app.post('/api/trabalhadores', (req, res) => {
  try {
    const {
      empresa_id = 1,
      niss,
      nome,
      data_nascimento,
      nif = '',
      nacionalidade = 'Estrangeira',
      data_inicio_vinculo = new Date().toISOString().slice(0, 10),
      data_fim_vinculo = '',
      tipo_contrato = 'Contrato de trabalho por tempo indeterminado',
      regime = 'Trabalhadores por conta de outrem - Regime Geral',
      taxa_contributiva = '34,75%',
      remuneracao_base = '870,00 €',
      profissao = 'Trabalhador por Conta de Outrem',
      situacao = 'Ativo',
      observacoes = ''
    } = req.body;

    if (!niss || !nome || !data_nascimento) {
      return res.status(400).json({ error: 'NISS, Nome do trabalhador e Data de nascimento são obrigatórios.' });
    }

    const store = loadStore();
    const created = {
      id: nextId(store.trabalhadores),
      empresa_id: Number(empresa_id),
      niss: String(niss).trim(),
      nome: String(nome).toUpperCase().trim(),
      data_nascimento: String(data_nascimento).trim(),
      nif: String(nif).trim(),
      nacionalidade,
      data_inicio_vinculo,
      data_fim_vinculo,
      tipo_contrato,
      regime,
      taxa_contributiva,
      remuneracao_base,
      profissao,
      situacao,
      observacoes
    };
    store.trabalhadores.push(created);

    store.comunicacoes.push({
      id: nextId(store.comunicacoes),
      empresa_id: Number(empresa_id),
      niss: created.niss,
      nome_trabalhador: created.nome,
      data_nascimento: created.data_nascimento,
      tipo_comunicacao: 'Admissão',
      data_submissao: new Date().toISOString().slice(0, 10),
      data_efeito: data_inicio_vinculo,
      estado: 'Aceite',
      detalhe: `Comunicação de contrato (${tipo_contrato}) registada.`
    });

    saveStore(store);
    res.json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/trabalhadores/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const store = loadStore();
    const idx = store.trabalhadores.findIndex(t => Number(t.id) === id);
    if (idx === -1) return res.status(404).json({ error: 'Trabalhador não encontrado.' });

    const current = store.trabalhadores[idx];
    const updated = {
      ...current,
      niss: req.body.niss !== undefined ? String(req.body.niss).trim() : current.niss,
      nome: req.body.nome !== undefined ? String(req.body.nome).toUpperCase().trim() : current.nome,
      data_nascimento: req.body.data_nascimento !== undefined ? String(req.body.data_nascimento).trim() : current.data_nascimento,
      nif: req.body.nif !== undefined ? String(req.body.nif).trim() : current.nif,
      nacionalidade: req.body.nacionalidade !== undefined ? req.body.nacionalidade : current.nacionalidade,
      data_inicio_vinculo: req.body.data_inicio_vinculo !== undefined ? req.body.data_inicio_vinculo : current.data_inicio_vinculo,
      data_fim_vinculo: req.body.data_fim_vinculo !== undefined ? req.body.data_fim_vinculo : current.data_fim_vinculo,
      tipo_contrato: req.body.tipo_contrato !== undefined ? req.body.tipo_contrato : current.tipo_contrato,
      regime: req.body.regime !== undefined ? req.body.regime : current.regime,
      taxa_contributiva: req.body.taxa_contributiva !== undefined ? req.body.taxa_contributiva : current.taxa_contributiva,
      remuneracao_base: req.body.remuneracao_base !== undefined ? req.body.remuneracao_base : current.remuneracao_base,
      profissao: req.body.profissao !== undefined ? req.body.profissao : current.profissao,
      situacao: req.body.situacao !== undefined ? req.body.situacao : current.situacao,
      observacoes: req.body.observacoes !== undefined ? req.body.observacoes : current.observacoes
    };

    store.trabalhadores[idx] = updated;

    if (req.body.situacao && req.body.situacao !== current.situacao) {
      store.comunicacoes.push({
        id: nextId(store.comunicacoes),
        empresa_id: current.empresa_id,
        niss: updated.niss,
        nome_trabalhador: updated.nome,
        data_nascimento: updated.data_nascimento,
        tipo_comunicacao: req.body.situacao === 'Cessado' ? 'Cessação' : 'Alteração',
        data_submissao: new Date().toISOString().slice(0, 10),
        data_efeito: updated.data_fim_vinculo || new Date().toISOString().slice(0, 10),
        estado: 'Aceite',
        detalhe: `Situação do vínculo atualizada para ${req.body.situacao}.`
      });
    }

    saveStore(store);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/trabalhadores/:id', (req, res) => {
  const id = Number(req.params.id);
  const store = loadStore();
  store.trabalhadores = store.trabalhadores.filter(t => Number(t.id) !== id);
  saveStore(store);
  res.json({ success: true });
});

function normalizeDate(val) {
  if (!val && val !== 0) return '1990-01-01';
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d && d.y) {
      return `${String(d.y).padStart(4, '0')}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m0 = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m0) {
    return `${m0[1]}-${m0[2].padStart(2, '0')}-${m0[3].padStart(2, '0')}`;
  }
  const m = str.match(/^(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return str;
}

app.post('/api/trabalhadores/import', (req, res) => {
  try {
    const { empresa_id = 1, fileBase64, rows: rawRows, replaceExisting = false } = req.body;
    let parsedRows = [];

    if (fileBase64) {
      const base64Data = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
      const buffer = Buffer.from(base64Data, 'base64');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      parsedRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
    } else if (Array.isArray(rawRows)) {
      parsedRows = rawRows;
    } else {
      return res.status(400).json({ error: 'Nenhum arquivo ou lista enviada para importação.' });
    }

    const store = loadStore();
    if (replaceExisting) {
      store.trabalhadores = store.trabalhadores.filter(t => Number(t.empresa_id) !== Number(empresa_id));
    }

    let imported = 0;
    let updated = 0;

    for (const item of parsedRows) {
      const keys = Object.keys(item);
      const getVal = (candidates) => {
        for (const c of candidates) {
          const foundKey = keys.find(k => k.toLowerCase().trim() === c.toLowerCase() || k.toLowerCase().includes(c.toLowerCase()));
          if (foundKey && item[foundKey] !== '' && item[foundKey] !== undefined) {
            return item[foundKey];
          }
        }
        return '';
      };

      const niss = String(getVal(['niss', 'numero seguranca social', 'segurança social', 'id']) || '').replace(/\s+/g, '');
      const nome = String(getVal(['nome do trabalhador', 'nome', 'trabalhador', 'funcionario', 'funcionário', 'name']) || '').toUpperCase().trim();
      const dataNasc = normalizeDate(getVal(['data de nascimento', 'data nascimento', 'nascimento', 'dt_nasc', 'birth']) || '1990-01-01');

      if (!niss || !nome) continue;

      const nif = String(getVal(['nif', 'contribuinte', 'cpf']) || '').trim();
      const rawNac = String(getVal(['nacionalidade', 'pais', 'país']) || 'Colombiana').trim().toUpperCase();
      let nacionalidade = 'Colombiana';
      if (rawNac.includes('PERU')) nacionalidade = 'Peruana';
      else if (rawNac.includes('COLOMB')) nacionalidade = 'Colombiana';
      else if (rawNac.includes('ITALI')) nacionalidade = 'Italiana';
      else if (rawNac.includes('BRASIL')) nacionalidade = 'Brasileira';
      else if (rawNac.includes('NICARAG')) nacionalidade = 'Nicaraguense';
      else if (rawNac) nacionalidade = rawNac.charAt(0) + rawNac.slice(1).toLowerCase();

      const dataInicio = normalizeDate(getVal(['data alta segurança', 'data alta', 'data de início', 'data inicio', 'inicio', 'admissao', 'admissão']) || new Date().toISOString().slice(0, 10));
      const tipoContrato = String(getVal(['tipo de contrato', 'contrato', 'vinculo', 'vínculo']) || 'Contrato de trabalho a termo certo').trim();
      const remuneracao = String(getVal(['remuneração', 'remuneracao', 'salario', 'salário', 'vencimento']) || '920,00 €').trim();
      const profissao = String(getVal(['profissão', 'profissao', 'categoria']) || 'Operador Especializado').trim();
      const situacao = 'Ativo';

      const existingIdx = store.trabalhadores.findIndex(
        t => Number(t.empresa_id) === Number(empresa_id) && t.niss === niss
      );

      if (existingIdx !== -1) {
        store.trabalhadores[existingIdx] = {
          ...store.trabalhadores[existingIdx],
          nome,
          data_nascimento: dataNasc,
          nif,
          nacionalidade,
          data_inicio_vinculo: dataInicio,
          tipo_contrato: tipoContrato,
          remuneracao_base: remuneracao,
          profissao,
          situacao
        };
        updated++;
      } else {
        store.trabalhadores.push({
          id: nextId(store.trabalhadores),
          empresa_id: Number(empresa_id),
          niss,
          nome,
          data_nascimento: dataNasc,
          nif,
          nacionalidade,
          data_inicio_vinculo: dataInicio,
          data_fim_vinculo: '',
          tipo_contrato: tipoContrato,
          regime: 'Trabalhadores por conta de outrem - Regime Geral',
          taxa_contributiva: '34,75%',
          remuneracao_base: remuneracao,
          profissao,
          situacao,
          observacoes: ''
        });

        store.comunicacoes.push({
          id: nextId(store.comunicacoes),
          empresa_id: Number(empresa_id),
          niss,
          nome_trabalhador: nome,
          data_nascimento: dataNasc,
          tipo_comunicacao: 'Admissão',
          data_submissao: dataInicio,
          data_efeito: dataInicio,
          estado: 'Aceite',
          detalhe: 'Comunicação importada via lote.'
        });
        imported++;
      }
    }

    saveStore(store);
    res.json({ success: true, imported, updated, totalProcessed: imported + updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ========================
// API: COMUNICAÇÕES
// ========================
app.get('/api/comunicacoes', (req, res) => {
  const empresaId = Number(req.query.empresa_id || 1);
  const store = loadStore();
  const rows = store.comunicacoes
    .filter(c => Number(c.empresa_id) === empresaId)
    .sort((a, b) => Number(b.id) - Number(a.id));
  res.json(rows);
});

// ========================
// SPA ROUTES (Matching real seg-social.pt routes)
// ========================
app.get([
  '/',
  '/sso/login',
  '/ptss/pssd/home',
  '/ptss/qlf/tco/consulta/detalhe-trabalhador',
  '/ptss/*splat'
], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor Segurança Social Direta rodando em http://localhost:${PORT}/ptss/pssd/home?dswid=3379`);
  });
}

module.exports = app;
