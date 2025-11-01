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

// ---------------- UI HELPERS ---------------- //

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
  const r = loadRanking();
  const entries = Object.entries(r).sort((a,b) => b[1] - a[1]);
  rankingListEl.innerHTML = '';
  entries.forEach(([user, score]) => {
    const li = document.createElement('li');
    li.textContent = `${user} — ${score} casas`;
    rankingListEl.appendChild(li);
  });
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

      marker.on('click', () => {
        if (!currentUser) {
          alert('Faça login para registrar visitas.');
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
  verificarVitoria();
}

// inicialização visual caso o DOM contenha o usuário ao carregar
if (currentUser) {
  // currentUser já definido; UI será ajustada quando as casas terminarem de carregar
  currentUserSpan.textContent = currentUser;
}
