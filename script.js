// ---------------- CONFIGURAÇÃO INICIAL ---------------- //

const map = L.map('map').setView([-23.205337, -45.957613], 14);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap',
}).addTo(map);

// Ícones
const candyIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2917/2917995.png',
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -38],
});

const playerIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/616/616408.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

// Áudio de vitória: preferir o elemento <audio id="somDoce"> do HTML
const audioElFromDOM = document.getElementById('somDoce');
const audio = audioElFromDOM || new Audio('victory.mp3');

// Elementos da interface
const visitasEl = document.getElementById('visitas');
const vitoriaBox = document.getElementById('vitoria') || (function(){
  const el = document.createElement("div");
  el.id = "vitoria";
  el.classList.add("hidden");
  el.innerHTML = `
    <h2>👑 Você visitou todas as casas! 👑</h2>
    <p>Parabéns, mestre dos doces! 🍫🍭</p>
  `;
  document.body.appendChild(el);
  return el;
})();

const loginBox = document.getElementById('loginBox');
const loginInput = document.getElementById('loginUsername');
const loginBtn = document.getElementById('loginBtn');
const userInfo = document.getElementById('userInfo');
const currentUserSpan = document.getElementById('currentUser');
const logoutBtn = document.getElementById('logoutBtn');
const rankingListEl = document.getElementById('rankingList');

// ---------------- ESTADO ---------------- //

let markersMap = {}; // nome -> marker
let casasVisitadas = new Set();
let totalCasas = 0;
let currentUser = localStorage.getItem('hallo_maps_currentUser') || null;

// Mantém a contagem anterior para detectar quando a vitória é "atingida agora"
let prevVisitCount = 0;

// ---------------- STORAGE HELPERS ---------------- //

function progressKey(user) { return `hallo_maps_progress_${user}`; }
function rankingKey() { return `hallo_maps_ranking`; }

function loadUserProgress(user) {
  if (!user) return new Set();
  const raw = localStorage.getItem(progressKey(user));
  try {
    return new Set(JSON.parse(raw || '[]'));
  } catch {
    return new Set();
  }
}

function saveUserProgress(user, set) {
  if (!user) return;
  localStorage.setItem(progressKey(user), JSON.stringify([...set]));
}

function loadRanking() {
  try {
    return JSON.parse(localStorage.getItem(rankingKey()) || '{}');
  } catch {
    return {};
  }
}

function saveRanking(obj) {
  localStorage.setItem(rankingKey(), JSON.stringify(obj));
}

function updateRankingForUser(user, score) {
  if (!user) return;
  const r = loadRanking();
  r[user] = score;
  saveRanking(r);
  renderRanking();
}

// ---------------- VOTES (storage) ---------------- //

function votesKey() { return 'hallo_maps_votes'; }
function loadVotes() {
  try {
    return JSON.parse(localStorage.getItem(votesKey()) || '{}');
  } catch {
    return {};
  }
}
function saveVotes(obj) {
  localStorage.setItem(votesKey(), JSON.stringify(obj));
}
function userHasVoted(user, house, cat) {
  if (!user) return false;
  const v = loadVotes();
  return !!(v[house] && v[house][cat] && Array.isArray(v[house][cat].voters) && v[house][cat].voters.includes(user));
}
function castVote(user, house, cat) {
  if (!user) return false;
  const v = loadVotes();
  v[house] = v[house] || {};
  v[house][cat] = v[house][cat] || { count: 0, voters: [] };
  if (v[house][cat].voters.includes(user)) return false;
  v[house][cat].voters.push(user);
  v[house][cat].count = (v[house][cat].count || 0) + 1;
  saveVotes(v);
  return true;
}
function getVotesForHouse(house) {
  const v = loadVotes();
  return v[house] || {};
}
function getHouseTotalVotes(house) {
  const byCat = getVotesForHouse(house);
  return Object.values(byCat).reduce((s, c) => s + (c.count||0), 0);
}
function getTopHouses(limit = 5) {
  const v = loadVotes();
  // ensure we include houses even with zero votes
  const totals = {};
  Object.keys(markersMap).forEach(name => totals[name] = 0);
  Object.entries(v).forEach(([house, byCat]) => {
    totals[house] = Object.values(byCat).reduce((s, c) => s + (c.count||0), 0);
  });
  const arr = Object.entries(totals).sort((a,b) => b[1] - a[1]);
  return arr.slice(0, limit);
}

// ---------------- UI HELPERS ---------------- //
const houseContextEl = document.getElementById('houseContext');
const hcTitle = document.getElementById('hcTitle');
const hcCategoriesEl = document.getElementById('hcCategories');
const hcSaveBtn = document.getElementById('hcSave');
const hcCloseBtn = document.getElementById('hcClose');
const hcPublicNotes = document.getElementById('hcPublicNotes');

// categorias de notas para cada casa
const HC_CATEGORIES = [
  'mais assustadora',
  'mais criativa',
  'melhores doces',
  'family friendly',
  'decoração'
];

function showLoginUI() {
  loginBox.classList.remove('hidden');
  userInfo.classList.add('hidden');
}

function showUserUI(user) {
  loginBox.classList.add('hidden');
  userInfo.classList.remove('hidden');
  currentUserSpan.textContent = user;
}

function renderRanking() {
  // rankingListEl mostrará: Top 5 casas (por votos) e depois ranking de usuários
  rankingListEl.innerHTML = '';

  // Top casas
  const top = getTopHouses(5);
  const topHeader = document.createElement('li');
  topHeader.innerHTML = '<strong>Top casas (votos)</strong>';
  rankingListEl.appendChild(topHeader);
  if (top.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'Nenhuma casa votada ainda';
    rankingListEl.appendChild(empty);
  } else {
    top.forEach(([house, total]) => {
      const li = document.createElement('li');
      li.textContent = `${house} — ${total} voto(s)`;
      rankingListEl.appendChild(li);
    });
  }

  // Separator
  const sep = document.createElement('li');
  sep.innerHTML = '<hr>';
  rankingListEl.appendChild(sep);

  // Usuários (ranking existente)
  const r = loadRanking();
  const entries = Object.entries(r).sort((a,b) => b[1] - a[1]);
  const usersHeader = document.createElement('li');
  usersHeader.innerHTML = '<strong>Usuários</strong>';
  rankingListEl.appendChild(usersHeader);
  if (entries.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'Nenhum usuário registrado';
    rankingListEl.appendChild(empty);
  } else {
    entries.forEach(([user, score]) => {
      const li = document.createElement('li');
      li.textContent = `${user} — ${score} casas`;
      rankingListEl.appendChild(li);
    });
  }
}

// ---------------- PROGRESS / CONTADOR ---------------- //

function salvarProgresso() {
  if (!currentUser) return;
  saveUserProgress(currentUser, casasVisitadas);
  updateRankingForUser(currentUser, casasVisitadas.size);
}

function atualizarContador() {
  visitasEl.textContent = casasVisitadas.size;
}

// Garante que a caixa de vitória comece escondida
vitoriaBox.classList.add("hidden");

// ---------------- FUNÇÕES ---------------- //

function verificarVitoria() {
  if (totalCasas > 0 && casasVisitadas.size === totalCasas && prevVisitCount < totalCasas) {
    vitoriaBox.classList.remove("hidden");
    try { audio.play(); } catch (e) {}
    prevVisitCount = casasVisitadas.size;
  } else if (casasVisitadas.size !== totalCasas) {
    vitoriaBox.classList.add("hidden");
    prevVisitCount = casasVisitadas.size;
  }
}

function animarIcone(marker) {
  if (!marker._icon) return;
  marker._icon.style.transition = "transform 0.3s";
  marker._icon.style.transform = "scale(1.3)";
  setTimeout(() => marker._icon.style.transform = "scale(1)", 300);
}

function applyVisitedStyles() {
  Object.entries(markersMap).forEach(([nome, marker]) => {
    if (casasVisitadas.has(nome)) {
      if (marker._icon) marker._icon.style.filter = "grayscale(100%) brightness(70%)";
    } else {
      if (marker._icon) marker._icon.style.filter = "";
    }
  });
}

// ---------------- LOCALIZAÇÃO DO JOGADOR ---------------- //

map.locate({ setView: true, maxZoom: 16, watch: true });

const jogador = L.marker([-23.205337, -45.957613], {
  title: "Você está aqui",
  icon: playerIcon
}).addTo(map);

map.on('locationfound', e => {
  jogador.setLatLng(e.latlng);
});

// ---------------- CARREGAR CASAS ---------------- //

fetch('casas.json')
  .then(response => response.json())
  .then(casas => {
    totalCasas = casas.length;

    casas.forEach(casa => {
      const marker = L.marker(casa.coords, { icon: candyIcon }).addTo(map);
      markersMap[casa.nome] = marker;

      marker.bindPopup(`
        <b>${casa.nome}</b><br>
        ${casa.descricao}<br>
        <img class="popup-img" src="${casa.img}" alt="${casa.nome}">
      `);

      // ao abrir popup: mostra painel de contexto logo depois (evita conflito visual)
      marker.on('popupopen', () => {
        setTimeout(() => showHouseContext(casa.nome), 120);
      });

      marker.on('click', () => {
        // registro de visita (precisa estar logado)
        if (!currentUser) {
          // abre painel mesmo sem login; evita registrar visita
          return;
        }
        if (!casasVisitadas.has(casa.nome)) {
          casasVisitadas.add(casa.nome);
          atualizarContador();
          salvarProgresso();
          animarIcone(marker);
          verificarVitoria();
        }
        if (marker._icon) marker._icon.style.filter = "grayscale(100%) brightness(70%)";
      });
    });

    // se já houver usuário logado ao iniciar, carregue progresso e aplique estilos
    if (currentUser) {
      casasVisitadas = loadUserProgress(currentUser);
      prevVisitCount = casasVisitadas.size;
      atualizarContador();
      applyVisitedStyles();
      showUserUI(currentUser);
    } else {
      showLoginUI();
    }

    atualizarContador();
    renderRanking();
    verificarVitoria();
  })
  .catch(err => console.error('Erro ao carregar casas:', err));

// ---------------- LOGIN / LOGOUT ---------------- //

loginBtn.addEventListener('click', () => {
  const name = (loginInput.value || '').trim();
  if (!name) {
    alert('Digite um nome válido.');
    return;
  }
  currentUser = name;
  localStorage.setItem('hallo_maps_currentUser', currentUser);
  casasVisitadas = loadUserProgress(currentUser);
  prevVisitCount = casasVisitadas.size;
  aplicarDepoisLogin();
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('hallo_maps_currentUser');
  currentUser = null;
  casasVisitadas = new Set();
  prevVisitCount = 0;
  atualizarContador();
  applyVisitedStyles();
  showLoginUI();
});

function aplicarDepoisLogin() {
  atualizarContador();
  applyVisitedStyles();
  showUserUI(currentUser);
  updateRankingForUser(currentUser, casasVisitadas.size);
  renderRanking();
  verificarVitoria();
}

// inicialização visual caso o DOM contenha o usuário ao carregar
if (currentUser) {
  // currentUser já definido; UI será ajustada quando as casas terminarem de carregar
  currentUserSpan.textContent = currentUser;
}

// ---------------- STORAGE HELPERS (notas) ---------------- //
function notesKey(user) { return `hallo_maps_notes_${user}`; }
function loadUserNotes(user) {
  if (!user) return {};
  try {
    return JSON.parse(localStorage.getItem(notesKey(user)) || '{}');
  } catch { return {}; }
}
function saveUserNotes(user, notesObj) {
  if (!user) return;
  localStorage.setItem(notesKey(user), JSON.stringify(notesObj));
}

// agrega notas públicas (simples) - retorna objeto house -> { categoria -> [texts...] }
function loadPublicNotes() {
  try {
    return JSON.parse(localStorage.getItem('hallo_maps_publicNotes') || '{}');
  } catch { return {}; }
}
function savePublicNotes(obj) {
  localStorage.setItem('hallo_maps_publicNotes', JSON.stringify(obj));
}
function addPublicNote(houseName, category, text, user) {
  const all = loadPublicNotes();
  all[houseName] = all[houseName] || {};
  all[houseName][category] = all[houseName][category] || [];
  all[houseName][category].push({ user, text, date: Date.now() });
  savePublicNotes(all);
}

// renderiza resumo público simples
function renderPublicNotesForHouse(houseName) {
  const all = loadPublicNotes();
  const byHouse = all[houseName] || {};
  const lines = [];
  for (const cat of HC_CATEGORIES) {
    const arr = byHouse[cat] || [];
    if (arr.length) lines.push(`<strong>${cat}:</strong> ${arr.length} comentário(s)`);
  }
  hcPublicNotes.innerHTML = lines.length ? lines.join('<br>') : 'Nenhuma';
}

// cria inputs para categorias (agora com botão de voto e contador)
function buildHCCategories(houseName, user) {
  hcCategoriesEl.innerHTML = '';
  const userNotes = loadUserNotes(user)[houseName] || {};
  const votesForHouse = getVotesForHouse(houseName);

  HC_CATEGORIES.forEach(cat => {
    const wrapper = document.createElement('div');
    wrapper.className = 'hc-row';

    const labelWrap = document.createElement('div');
    labelWrap.style.display = 'flex';
    labelWrap.style.alignItems = 'center';
    labelWrap.style.gap = '8px';

    const label = document.createElement('label');
    label.textContent = cat;
    label.style.flex = '1';

    const voteCountSpan = document.createElement('span');
    voteCountSpan.className = 'hc-vote-count';
    voteCountSpan.textContent = (votesForHouse[cat] && votesForHouse[cat].count) ? votesForHouse[cat].count : '0';

    const voteBtn = document.createElement('button');
    voteBtn.type = 'button';
    voteBtn.textContent = '👍';
    voteBtn.title = 'Votar nesta categoria';
    voteBtn.dataset.cat = cat;
    voteBtn.dataset.house = houseName;

    // estado inicial do botão (desabilitado se usuário já votou)
    if (!currentUser) voteBtn.disabled = true;
    if (currentUser && userHasVoted(currentUser, houseName, cat)) voteBtn.disabled = true;

    voteBtn.addEventListener('click', () => {
      if (!currentUser) {
        alert('Faça login para votar.');
        return;
      }
      const ok = castVote(currentUser, houseName, cat);
      if (!ok) {
        alert('Você já votou nesta categoria para esta casa.');
        voteBtn.disabled = true;
        return;
      }
      // atualiza contador e UI
      voteCountSpan.textContent = getVotesForHouse(houseName)[cat].count;
      voteBtn.disabled = true;
      renderRanking(); // atualiza top casas
    });

    labelWrap.appendChild(label);
    labelWrap.appendChild(voteCountSpan);
    labelWrap.appendChild(voteBtn);

    const ta = document.createElement('textarea');
    ta.dataset.category = cat;
    ta.rows = 2;
    ta.value = userNotes[cat] || '';

    wrapper.appendChild(labelWrap);
    wrapper.appendChild(ta);
    hcCategoriesEl.appendChild(wrapper);
  });
}

// adicionado: verificações de existência e pequenas correções de exibição
if (!houseContextEl || !hcTitle || !hcCategoriesEl || !hcSaveBtn || !hcCloseBtn || !hcPublicNotes) {
  console.error('House context: elementos do DOM faltando. Verifique index.html ids (houseContext, hcTitle, hcCategories, hcSave, hcClose, hcPublicNotes).');
}

// função de exibir painel mais robusta (garante display/z-index e evita ser escondida pelo popup do Leaflet)
function showHouseContext(houseName) {
  if (!houseContextEl) return;
  hcTitle.textContent = houseName;
  buildHCCategories(houseName, currentUser);
  renderPublicNotesForHouse(houseName);

  // força estilos que garantem visibilidade (se CSS faltar)
  houseContextEl.style.display = 'block';
  houseContextEl.style.position = houseContextEl.style.position || 'fixed';
  houseContextEl.style.zIndex = '10000';
  // remove a classe hidden se existir
  houseContextEl.classList.remove('hidden');

  // pequena espera para deixar o popup do leaflet abrir/fechar antes de focar no painel
  requestAnimationFrame(() => {
    const firstTA = hcCategoriesEl.querySelector('textarea');
    if (firstTA) firstTA.focus();
  });
}

// fecha painel
hcCloseBtn.addEventListener('click', () => houseContextEl.classList.add('hidden'));

// salvar notas: persiste para o usuário e opcionalmente adiciona ao público
hcSaveBtn.addEventListener('click', () => {
  if (!currentUser) {
    alert('Faça login para salvar notas.');
    return;
  }
  const houseName = hcTitle.textContent;
  const userNotesAll = loadUserNotes(currentUser);
  userNotesAll[houseName] = userNotesAll[houseName] || {};
  hcCategoriesEl.querySelectorAll('textarea').forEach(ta => {
    const cat = ta.dataset.category;
    const text = (ta.value || '').trim();
    if (text) {
      userNotesAll[houseName][cat] = text;
      // também grava um comentário público resumido para esta categoria
      addPublicNote(houseName, cat, text, currentUser);
    } else {
      // remove categoria vazia
      delete userNotesAll[houseName][cat];
    }
  });
  saveUserNotes(currentUser, userNotesAll);
  renderPublicNotesForHouse(houseName);
  alert('Notas salvas.');
});
