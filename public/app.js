// Estado Global da Aplicação
const state = {
  currentEmpresaId: Number(localStorage.getItem('ss_empresa_id') || 1),
  empresa: null,
  empresasList: [],
  workers: [],
  comunicacoes: [],
  currentWorker: null,
  sortField: 'niss',
  sortDir: 'asc'
};

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await loadEmpresas();
  await loadWorkers();
  await loadComunicacoes();

  // Verifica URL inicial para abrir a tela correspondente
  const path = window.location.pathname;
  if (path.includes('/sso/login')) {
    navigateTo('login', null, false);
  } else if (path.includes('detalhe-trabalhador')) {
    navigateTo('workers', 'vinculos', false);
  } else {
    navigateTo('home', null, false);
  }

  // Fecha menus ao clicar fora
  document.addEventListener('click', (e) => {
    const mega = document.getElementById('megaMenuTrabalho');
    const btnTrab = document.getElementById('navBtnTrabalho');
    if (mega && mega.classList.contains('open')) {
      if (!mega.contains(e.target) && !btnTrab.contains(e.target)) {
        closeMegaMenu();
      }
    }

    const drop = document.getElementById('userDropdown');
    const avatar = document.getElementById('headerAvatarBtn');
    if (drop && drop.classList.contains('open')) {
      if (!drop.contains(e.target) && !avatar.contains(e.target)) {
        closeUserDropdown();
      }
    }
  });
});

// ========================
// NAVEGAÇÃO ENTRE TELAS
// ========================
function navigateTo(view, subtab = 'vinculos', pushUrl = true) {
  closeMegaMenu();
  closeUserDropdown();

  const header = document.getElementById('mainHeader');
  const viewHome = document.getElementById('viewHome');
  const viewWorkers = document.getElementById('viewWorkers');
  const viewDetail = document.getElementById('viewWorkerDetail');
  const viewLogin = document.getElementById('viewLogin');

  viewHome.style.display = 'none';
  viewWorkers.style.display = 'none';
  viewDetail.style.display = 'none';
  viewLogin.style.display = 'none';

  if (view === 'login') {
    header.style.display = 'none';
    viewLogin.style.display = 'block';
    if (pushUrl) history.pushState({}, '', '/sso/login');
  } else if (view === 'workers') {
    header.style.display = 'block';
    viewWorkers.style.display = 'block';
    switchWorkersTab(subtab || 'vinculos');
    if (pushUrl) history.pushState({}, '', '/ptss/qlf/tco/consulta/detalhe-trabalhador?dswid=6777');
  } else if (view === 'detail') {
    header.style.display = 'block';
    viewDetail.style.display = 'block';
    if (pushUrl) history.pushState({}, '', '/ptss/qlf/tco/consulta/detalhe-trabalhador?dswid=6777');
  } else {
    header.style.display = 'block';
    viewHome.style.display = 'block';
    if (pushUrl) history.pushState({}, '', '/ptss/pssd/home?dswid=3379');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMegaMenuTrabalho(e) {
  if (e) e.stopPropagation();
  const mega = document.getElementById('megaMenuTrabalho');
  const btn = document.getElementById('navBtnTrabalho');
  const isOpen = mega.classList.contains('open');
  if (isOpen) {
    closeMegaMenu();
  } else {
    mega.classList.add('open');
    btn.classList.add('active');
  }
}

function closeMegaMenu() {
  const mega = document.getElementById('megaMenuTrabalho');
  const btn = document.getElementById('navBtnTrabalho');
  if (mega) mega.classList.remove('open');
  if (btn) btn.classList.remove('active');
}

function toggleUserDropdown(e) {
  if (e) e.stopPropagation();
  const drop = document.getElementById('userDropdown');
  drop.classList.toggle('open');
}

function closeUserDropdown() {
  const drop = document.getElementById('userDropdown');
  if (drop) drop.classList.remove('open');
}

// ========================
// EMPRESAS & PERSONALIZAÇÃO
// ========================
async function loadEmpresas() {
  const res = await fetch('/api/empresas');
  const list = await res.json();
  state.empresasList = list;

  let current = list.find(e => e.id === state.currentEmpresaId) || list[0];
  if (current) {
    state.currentEmpresaId = current.id;
    state.empresa = current;
    localStorage.setItem('ss_empresa_id', String(current.id));
    applyEmpresaUI(current);
  }
}

function applyEmpresaUI(emp) {
  document.getElementById('heroCompanyName').textContent = emp.nome;
  document.getElementById('heroCompanyNiss').textContent = emp.niss;
  document.getElementById('dropdownCompanyName').textContent = emp.nome;
  document.getElementById('dropdownCompanyNiss').textContent = emp.niss;
  document.getElementById('headerAvatarBtn').textContent = emp.sigla_avatar || 'TL';

  const logoUrl = emp.logo_url || '/assets/ssd.svg';
  document.getElementById('headerLogoImg').src = logoUrl;
  document.getElementById('footerLogoImg').src = logoUrl;
  document.getElementById('loginLogoImg').src = logoUrl;
}

function openCompanyModal() {
  const emp = state.empresa;
  if (!emp) return;
  document.getElementById('empNome').value = emp.nome || '';
  document.getElementById('empNiss').value = emp.niss || '';
  document.getElementById('empSigla').value = emp.sigla_avatar || 'TL';
  document.getElementById('empNif').value = emp.nif || '';
  document.getElementById('empSenha').value = emp.senha || '';
  document.getElementById('empLogoUrl').value = emp.logo_url || '/assets/ssd.svg';
  document.getElementById('empLogoPreview').src = emp.logo_url || '/assets/ssd.svg';
  document.getElementById('empEmail').value = emp.email || '';
  document.getElementById('empIban').value = emp.iban || '';
  openModal('modalCompany');
}

function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById('empLogoUrl').value = reader.result;
    document.getElementById('empLogoPreview').src = reader.result;
  };
  reader.readAsDataURL(file);
}

function resetDefaultLogo() {
  document.getElementById('empLogoUrl').value = '/assets/ssd.svg';
  document.getElementById('empLogoPreview').src = '/assets/ssd.svg';
  document.getElementById('empLogoFile').value = '';
}

async function saveCompanyForm(e) {
  e.preventDefault();
  const payload = {
    nome: document.getElementById('empNome').value,
    niss: document.getElementById('empNiss').value,
    sigla_avatar: document.getElementById('empSigla').value,
    nif: document.getElementById('empNif').value,
    senha: document.getElementById('empSenha').value,
    logo_url: document.getElementById('empLogoUrl').value,
    email: document.getElementById('empEmail').value,
    iban: document.getElementById('empIban').value
  };

  const res = await fetch(`/api/empresas/${state.currentEmpresaId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    closeModal('modalCompany');
    await loadEmpresas();
  }
}

async function openSwitchCompanyModal() {
  await loadEmpresas();
  const container = document.getElementById('companiesListContainer');
  container.innerHTML = state.empresasList.map(emp => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border:1px solid ${emp.id === state.currentEmpresaId ? '#16884e' : '#e2e8f0'};border-radius:10px;background:${emp.id === state.currentEmpresaId ? '#f0fdf4' : '#fff'};">
      <div>
        <strong style="font-size:14px;display:block;">${emp.nome}</strong>
        <span style="font-size:12.5px;color:#555;">NISS: ${emp.niss} • ${emp.total_trabalhadores || 0} trabalhadores</span>
      </div>
      <button class="${emp.id === state.currentEmpresaId ? 'ss-btn-primary' : 'ss-btn-outline-pill'}" style="padding:7px 16px;font-size:12.5px;" onclick="selectCompany(${emp.id})">
        ${emp.id === state.currentEmpresaId ? 'Ativa' : 'Selecionar'}
      </button>
    </div>
  `).join('');
  openModal('modalSwitchCompany');
}

async function selectCompany(id) {
  state.currentEmpresaId = id;
  localStorage.setItem('ss_empresa_id', String(id));
  await loadEmpresas();
  await loadWorkers();
  await loadComunicacoes();
  closeModal('modalSwitchCompany');
}

async function createNewCompany(e) {
  e.preventDefault();
  const payload = {
    nome: document.getElementById('newEmpNome').value,
    niss: document.getElementById('newEmpNiss').value,
    sigla_avatar: document.getElementById('newEmpSigla').value || 'EM'
  };
  const res = await fetch('/api/empresas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (res.ok) {
    const created = await res.json();
    document.getElementById('newEmpNome').value = '';
    document.getElementById('newEmpNiss').value = '';
    await selectCompany(created.id);
  }
}

// ========================
// TRABALHADORES & VÍNCULOS
// ========================
async function loadWorkers() {
  const res = await fetch(`/api/trabalhadores?empresa_id=${state.currentEmpresaId}&sort=${state.sortField}&dir=${state.sortDir}`);
  state.workers = await res.json();
  renderWorkersTable();
}

function renderWorkersTable() {
  const tbody = document.getElementById('workersTableBody');
  const filterVal = (document.getElementById('globalSearchInput')?.value || '').trim().toUpperCase();

  let filtered = state.workers;
  if (filterVal) {
    filtered = state.workers.filter(w =>
      w.niss.toUpperCase().includes(filterVal) ||
      w.nome.toUpperCase().includes(filterVal) ||
      (w.nif || '').toUpperCase().includes(filterVal)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;padding:32px;color:#666;">
          Nenhum trabalhador encontrado para os critérios selecionados.
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = filtered.map(w => `
      <tr>
        <td>${escapeHtml(w.niss)}</td>
        <td>${escapeHtml(w.nome)}</td>
        <td>${escapeHtml(w.data_nascimento)}</td>
        <td class="center">
          <button class="ss-action-link" onclick="openWorkerDetail(${w.id})">Consultar vínculo</button>
        </td>
      </tr>
    `).join('');
  }

  const countLabel = document.getElementById('workersCountLabel');
  if (countLabel) {
    countLabel.textContent = `A apresentar ${filtered.length} ${filtered.length === 1 ? 'vínculo' : 'vínculos'}`;
  }
}

function toggleWorkerSort(field) {
  if (state.sortField === field) {
    state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortField = field;
    state.sortDir = 'asc';
  }
  loadWorkers();
}

function switchWorkersTab(tab) {
  const btnVinc = document.getElementById('tabBtnVinculos');
  const btnCom = document.getElementById('tabBtnComunicacoes');
  const contVinc = document.getElementById('tabContentVinculos');
  const contCom = document.getElementById('tabContentComunicacoes');

  if (tab === 'comunicacoes') {
    btnVinc.classList.remove('active');
    btnCom.classList.add('active');
    contVinc.style.display = 'none';
    contCom.style.display = 'block';
    loadComunicacoes();
  } else {
    btnCom.classList.remove('active');
    btnVinc.classList.add('active');
    contCom.style.display = 'none';
    contVinc.style.display = 'block';
  }
}

async function loadComunicacoes() {
  const res = await fetch(`/api/comunicacoes?empresa_id=${state.currentEmpresaId}`);
  state.comunicacoes = await res.json();
  const tbody = document.getElementById('comunicacoesTableBody');
  if (!tbody) return;

  if (state.comunicacoes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:28px;color:#666;">Sem comunicações registadas.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.comunicacoes.map(c => `
    <tr>
      <td>${escapeHtml(c.niss)}</td>
      <td>${escapeHtml(c.nome_trabalhador)}</td>
      <td>${escapeHtml(c.tipo_comunicacao)}</td>
      <td>${escapeHtml(c.data_efeito)}</td>
      <td><span class="ss-status-badge ativo">${escapeHtml(c.estado)}</span></td>
    </tr>
  `).join('');
}

// ========================
// CONSULTAR VÍNCULO (DETALHE)
// ========================
async function openWorkerDetail(id) {
  const res = await fetch(`/api/trabalhadores/${id}`);
  if (!res.ok) return;
  const w = await res.json();
  state.currentWorker = w;

  document.getElementById('detNiss').textContent = w.niss;
  document.getElementById('detNome').textContent = w.nome;
  document.getElementById('detDataNasc').textContent = w.data_nascimento;
  document.getElementById('detNif').textContent = w.nif || 'Não aplicável / Não consta';
  document.getElementById('detNacionalidade').textContent = w.nacionalidade || '-';
  document.getElementById('detEmpresaNome').textContent = w.empresa_nome || state.empresa?.nome || '-';
  document.getElementById('detEmpresaNiss').textContent = w.empresa_niss || state.empresa?.niss || '-';
  document.getElementById('detDataInicio').textContent = w.data_inicio_vinculo || '-';
  document.getElementById('detDataFim').textContent = w.data_fim_vinculo || 'Sem data de cessação (Vínculo Ativo)';
  document.getElementById('detTipoContrato').textContent = w.tipo_contrato || '-';
  document.getElementById('detRegime').textContent = w.regime || '-';
  document.getElementById('detTaxa').textContent = w.taxa_contributiva || '-';
  document.getElementById('detRemuneracao').textContent = w.remuneracao_base || '-';
  document.getElementById('detProfissao').textContent = w.profissao || '-';

  const badge = document.getElementById('detailSituacaoBadge');
  badge.textContent = w.situacao || 'Ativo';
  badge.className = `ss-status-badge ${w.situacao === 'Cessado' ? 'cessado' : 'ativo'}`;

  navigateTo('detail');
}

function openWorkerModal(worker = null) {
  document.getElementById('modalWorkerTitle').textContent = worker
    ? 'Alterar dados do vínculo do trabalhador'
    : 'Comunicar contrato e vínculo do trabalhador';

  document.getElementById('wkId').value = worker ? worker.id : '';
  document.getElementById('wkNiss').value = worker ? worker.niss : '';
  document.getElementById('wkNome').value = worker ? worker.nome : '';
  document.getElementById('wkDataNasc').value = worker ? worker.data_nascimento : '1990-01-01';
  document.getElementById('wkNif').value = worker ? (worker.nif || '') : '';
  document.getElementById('wkNacionalidade').value = worker ? (worker.nacionalidade || 'Colombiana') : 'Colombiana';
  document.getElementById('wkDataInicio').value = worker ? (worker.data_inicio_vinculo || new Date().toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10);
  document.getElementById('wkDataFim').value = worker ? (worker.data_fim_vinculo || '') : '';
  document.getElementById('wkTipoContrato').value = worker ? (worker.tipo_contrato || 'Contrato de trabalho a termo certo') : 'Contrato de trabalho a termo certo';
  document.getElementById('wkSituacao').value = worker ? (worker.situacao || 'Ativo') : 'Ativo';
  document.getElementById('wkRemuneracao').value = worker ? (worker.remuneracao_base || '870,00 €') : '870,00 €';
  document.getElementById('wkProfissao').value = worker ? (worker.profissao || 'Trabalhador por Conta de Outrem') : 'Trabalhador por Conta de Outrem';

  const delBtn = document.getElementById('btnDeleteWorker');
  delBtn.style.display = worker ? 'inline-flex' : 'none';

  openModal('modalWorker');
}

function editCurrentWorker() {
  if (state.currentWorker) {
    openWorkerModal(state.currentWorker);
  }
}

async function saveWorkerForm(e) {
  e.preventDefault();
  const id = document.getElementById('wkId').value;
  const payload = {
    empresa_id: state.currentEmpresaId,
    niss: document.getElementById('wkNiss').value,
    nome: document.getElementById('wkNome').value,
    data_nascimento: document.getElementById('wkDataNasc').value,
    nif: document.getElementById('wkNif').value,
    nacionalidade: document.getElementById('wkNacionalidade').value,
    data_inicio_vinculo: document.getElementById('wkDataInicio').value,
    data_fim_vinculo: document.getElementById('wkDataFim').value,
    tipo_contrato: document.getElementById('wkTipoContrato').value,
    situacao: document.getElementById('wkSituacao').value,
    remuneracao_base: document.getElementById('wkRemuneracao').value,
    profissao: document.getElementById('wkProfissao').value
  };

  const url = id ? `/api/trabalhadores/${id}` : '/api/trabalhadores';
  const method = id ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    const saved = await res.json();
    closeModal('modalWorker');
    await loadWorkers();
    await loadComunicacoes();
    if (id) {
      await openWorkerDetail(saved.id);
    } else {
      navigateTo('workers');
    }
  }
}

async function deleteCurrentWorker() {
  const id = document.getElementById('wkId').value;
  if (!id) return;
  if (!confirm('Tem a certeza que deseja remover este trabalhador da base de dados?')) return;

  const res = await fetch(`/api/trabalhadores/${id}`, { method: 'DELETE' });
  if (res.ok) {
    closeModal('modalWorker');
    await loadWorkers();
    navigateTo('workers');
  }
}

// ========================
// IMPORTAÇÃO E EXPORTAÇÃO DE PLANILHAS
// ========================
function exportWorkersXlsx() {
  window.location.href = `/api/trabalhadores/export/xlsx?empresa_id=${state.currentEmpresaId}`;
}

async function submitImportWorkers() {
  const fileInput = document.getElementById('importFileInput');
  const pasteArea = document.getElementById('importPasteArea');
  const replaceExisting = document.getElementById('importReplaceAll').checked;
  const feedback = document.getElementById('importFeedback');

  feedback.style.color = '#166534';
  feedback.textContent = 'A processar dados...';

  if (fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await fetch('/api/trabalhadores/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: state.currentEmpresaId,
          fileBase64: reader.result,
          replaceExisting
        })
      });
      const data = await res.json();
      if (res.ok) {
        feedback.textContent = `✅ Sucesso! ${data.imported} novos trabalhadores adicionados e ${data.updated} atualizados.`;
        fileInput.value = '';
        await loadWorkers();
        await loadComunicacoes();
        setTimeout(() => {
          closeModal('modalImport');
          feedback.textContent = '';
          navigateTo('workers');
        }, 1100);
      } else {
        feedback.style.color = '#b42318';
        feedback.textContent = `Erro: ${data.error}`;
      }
    };
    reader.readAsDataURL(file);
    return;
  }

  const text = pasteArea.value.trim();
  if (text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const rows = [];
    for (const line of lines) {
      const parts = line.includes(';') ? line.split(';') : (line.includes('\t') ? line.split('\t') : line.split(','));
      if (parts.length >= 2) {
        const niss = parts[0].trim();
        if (niss.toLowerCase() === 'niss') continue; // ignora cabeçalho
        rows.push({
          niss,
          nome: parts[1].trim(),
          data_nascimento: (parts[2] || '1990-01-01').trim(),
          nif: (parts[3] || '').trim(),
          remuneracao: (parts[4] || '870,00 €').trim()
        });
      }
    }

    const res = await fetch('/api/trabalhadores/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empresa_id: state.currentEmpresaId,
        rows,
        replaceExisting
      })
    });
    const data = await res.json();
    if (res.ok) {
      feedback.textContent = `✅ Sucesso! ${data.imported} novos trabalhadores adicionados e ${data.updated} atualizados.`;
      pasteArea.value = '';
      await loadWorkers();
      await loadComunicacoes();
      setTimeout(() => {
        closeModal('modalImport');
        feedback.textContent = '';
        navigateTo('workers');
      }, 1100);
    } else {
      feedback.style.color = '#b42318';
      feedback.textContent = `Erro: ${data.error}`;
    }
    return;
  }

  feedback.style.color = '#b42318';
  feedback.textContent = 'Selecione um ficheiro Excel/CSV ou cole as linhas no campo de texto.';
}

// ========================
// PESQUISA GLOBAL E LOGIN
// ========================
function handleGlobalSearch(e) {
  e.preventDefault();
  const q = document.getElementById('globalSearchInput').value.trim();
  navigateTo('workers');
  const tableSearch = document.getElementById('workerTableSearch');
  if (tableSearch) {
    tableSearch.value = q;
    renderWorkersTable();
  }
}

async function handleSsoLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginErrorMsg');
  errEl.style.display = 'none';

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (!res.ok) {
    errEl.textContent = data.error || 'Falha na autenticação.';
    errEl.style.display = 'block';
    return;
  }

  await selectCompany(data.empresa.id);
  navigateTo('home');
}

// ========================
// MODALS E UTILITÁRIOS
// ========================
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
