const map = L.map('map').setView([-23.205337, -45.957613], 14);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap',
}).addTo(map);

const candyIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2917/2917995.png',
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -38],
});

let casasVisitadas = new Set();
let totalCasas = 0;

const somDoce = document.getElementById("somDoce");
const vitoriaBox = document.getElementById("vitoria");

function atualizarContador() {
  document.getElementById("visitas").textContent = casasVisitadas.size;
}

function verificarVitoria() {
  if (casasVisitadas.size === totalCasas) {
    vitoriaBox.classList.remove("hidden");
  }
}

// Mostra a posição atual do jogador
map.locate({ setView: true, maxZoom: 16, watch: true });

const jogador = L.marker([-23.205337, -45.957613], {
  title: "Você está aqui",
  icon: L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/616/616408.png',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  })
}).addTo(map);

map.on('locationfound', e => {
  jogador.setLatLng(e.latlng);
});

// Carrega as casas
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

      marker.on('click', () => {
        if (!casasVisitadas.has(casa.nome)) {
          casasVisitadas.add(casa.nome);
          atualizarContador();
          somDoce.currentTime = 0;
          somDoce.play();

          marker._icon.style.transition = "transform 0.3s";
          marker._icon.style.transform = "scale(1.3)";
          setTimeout(() => marker._icon.style.transform = "scale(1)", 300);

          verificarVitoria();
        }
      });
    });
  })
  .catch(err => console.error('Erro ao carregar casas:', err));
