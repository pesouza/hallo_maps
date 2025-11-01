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
// usar o #vitoria já existente no HTML em vez de criar outro elemento
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

// ---------------- ESTADO ---------------- //

let casasVisitadas = new Set(JSON.parse(localStorage.getItem("casasVisitadas")) || []);
let totalCasas = 0;

// Mantém a contagem anterior para detectar quando a vitória é "atingida agora"
let prevVisitCount = casasVisitadas.size;

function salvarProgresso() {
  localStorage.setItem("casasVisitadas", JSON.stringify([...casasVisitadas]));
}

function atualizarContador() {
  visitasEl.textContent = casasVisitadas.size;
}

// Garante que a caixa de vitória comece escondida
vitoriaBox.classList.add("hidden");

// ---------------- FUNÇÕES ---------------- //

function verificarVitoria() {
  // Só mostra vitória se houver casas carregadas e todas visitadas,
  // e se essa condição acabou de ser alcançada nesta sessão
  if (totalCasas > 0 && casasVisitadas.size === totalCasas && prevVisitCount < totalCasas) {
    vitoriaBox.classList.remove("hidden");
    // tenta tocar áudio, mas ignora erro de autoplay
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
      marker.bindPopup(`
        <b>${casa.nome}</b><br>
        ${casa.descricao}<br>
        <img class="popup-img" src="${casa.img}" alt="${casa.nome}">
      `);

      if (casasVisitadas.has(casa.nome)) {
        if (marker._icon) marker._icon.style.filter = "grayscale(100%) brightness(70%)";
      }

      marker.on('click', () => {
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

    atualizarContador();
    // verificar, mas só mostrará se a vitória for alcançada agora (prevVisitCount logic)
    verificarVitoria();
  })
  .catch(err => console.error('Erro ao carregar casas:', err));
