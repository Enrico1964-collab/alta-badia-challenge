// Alta Badia Mountain Huts Challenge - Master UI Controller
// Gestione viste, mappa interattiva Leaflet, filtri, passaporto digitale, grafica dislivello ed eventi

class App {
    constructor() {
        this.currentTab = 'esplora';
        this.map = null;
        this.markers = {};
        this.userMarker = null;
        this.accuracyCircle = null;
        this.proximityCircle = null;
        this.hikePolyline = null;
        this.huts = HUTS_DATA;
        this.activeFilters = {
            search: '',
            area: 'all',
            status: 'all', // 'all', 'visited', 'unvisited'
            difficulty: 'all',
            sortBy: 'points_desc'
        };

        this.init();
    }

    init() {
        this.bindNavigation();
        this.bindFilters();
        this.bindModals();
        this.initTrackerCallbacks();
        this.renderStatsHeader();
        this.renderHutsList();
        this.renderPassport();
        this.renderLeaderboard();
        this.updateSettingsUI();

        // Icone Lucide
        if (window.lucide) {
            window.lucide.createIcons();
        }

        console.log("[App] Alta Badia Mountain Huts Challenge inizializzata con successo.");
    }

    // ==========================================
    // NAVIGAZIONE TAB BOTTOM BAR
    // ==========================================
    bindNavigation() {
        const navButtons = document.querySelectorAll('[data-tab-target]');
        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = btn.getAttribute('data-tab-target');
                this.switchTab(targetTab);
            });
        });
    }

    switchTab(tabName) {
        this.currentTab = tabName;

        // Aggiorna bottoni di navigazione
        document.querySelectorAll('[data-tab-target]').forEach(btn => {
            const isCurrent = btn.getAttribute('data-tab-target') === tabName;
            const icon = btn.querySelector('.nav-icon');
            const label = btn.querySelector('.nav-label');

            if (isCurrent) {
                btn.classList.add('text-amber-400');
                btn.classList.remove('text-slate-400');
                if (label) label.classList.add('font-bold');
            } else {
                btn.classList.remove('text-amber-400');
                btn.classList.add('text-slate-400');
                if (label) label.classList.remove('font-bold');
            }
        });

        // Mostra la sezione corretta
        document.querySelectorAll('.tab-content').forEach(section => {
            section.classList.add('hidden');
        });

        const activeSection = document.getElementById(`tab-${tabName}`);
        if (activeSection) {
            activeSection.classList.remove('hidden');
        }

        // Se passiamo alla mappa, invalida le dimensioni per il corretto rendering
        if (tabName === 'mappa') {
            this.ensureMapInitialized();
            setTimeout(() => {
                if (this.map) this.map.invalidateSize();
            }, 100);
        } else if (tabName === 'traccia') {
            this.ensureTrackerMapInitialized();
            this.updateTrackerHUD();
        } else if (tabName === 'passaporto') {
            this.renderPassport();
        } else if (tabName === 'classifica') {
            this.renderLeaderboard();
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ==========================================
    // RENDERING STATISTICHE HEADER
    // ==========================================
    renderStatsHeader() {
        const totalPoints = window.appStorage.getTotalPoints();
        const visitedCount = window.appStorage.getVisitedCount();
        const totalHuts = this.huts.length;
        const percent = Math.round((visitedCount / totalHuts) * 100);

        const pointsEl = document.getElementById('header-points');
        const countEl = document.getElementById('header-visited-count');
        const progressEl = document.getElementById('header-progress-bar');
        const levelBadgeEl = document.getElementById('header-level-badge');

        if (pointsEl) pointsEl.textContent = `${totalPoints} pt`;
        if (countEl) countEl.textContent = `${visitedCount}/${totalHuts}`;
        if (progressEl) progressEl.style.width = `${percent}%`;

        let levelName = 'Pioniere';
        if (visitedCount >= 45) levelName = 'Leggenda Dolomitica 👑';
        else if (visitedCount >= 25) levelName = 'Maestro delle Üties 🏆';
        else if (visitedCount >= 10) levelName = 'Cacciatore di Vette ⛰️';
        else if (visitedCount >= 5) levelName = 'Esploratore di Badia 🥾';

        if (levelBadgeEl) levelBadgeEl.textContent = levelName;
    }

    // ==========================================
    // CATALOGO RIFUGI & FILTRI
    // ==========================================
    bindFilters() {
        const searchInput = document.getElementById('search-huts');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.activeFilters.search = e.target.value.toLowerCase().trim();
                this.renderHutsList();
            });
        }

        const areaSelect = document.getElementById('filter-area');
        if (areaSelect) {
            areaSelect.addEventListener('change', (e) => {
                this.activeFilters.area = e.target.value;
                this.renderHutsList();
            });
        }

        const statusSelect = document.getElementById('filter-status');
        if (statusSelect) {
            statusSelect.addEventListener('change', (e) => {
                this.activeFilters.status = e.target.value;
                this.renderHutsList();
            });
        }

        const sortSelect = document.getElementById('filter-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.activeFilters.sortBy = e.target.value;
                this.renderHutsList();
            });
        }
    }

    renderHutsList() {
        const container = document.getElementById('huts-grid');
        if (!container) return;

        let filtered = this.huts.filter(hut => {
            // Ricerca testuale
            if (this.activeFilters.search) {
                const nameMatch = hut.name.toLowerCase().includes(this.activeFilters.search);
                const areaMatch = hut.area.toLowerCase().includes(this.activeFilters.search);
                if (!nameMatch && !areaMatch) return false;
            }

            // Filtro Area
            if (this.activeFilters.area !== 'all' && hut.area !== this.activeFilters.area) {
                return false;
            }

            // Filtro Stato Visita
            const isVisited = window.appStorage.isHutVisited(hut.id);
            if (this.activeFilters.status === 'visited' && !isVisited) return false;
            if (this.activeFilters.status === 'unvisited' && isVisited) return false;

            return true;
        });

        // Ordinamento
        filtered.sort((a, b) => {
            if (this.activeFilters.sortBy === 'points_desc') return b.points - a.points;
            if (this.activeFilters.sortBy === 'points_asc') return a.points - b.points;
            if (this.activeFilters.sortBy === 'elev_desc') return b.elevationM - a.elevationM;
            if (this.activeFilters.sortBy === 'elev_asc') return a.elevationM - b.elevationM;
            if (this.activeFilters.sortBy === 'name_asc') return a.name.localeCompare(b.name);
            return 0;
        });

        // Render card
        container.innerHTML = '';

        const countBadge = document.getElementById('filtered-huts-count');
        if (countBadge) countBadge.textContent = `${filtered.length} di ${this.huts.length} rifugi`;

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12 text-slate-400">
                    <i data-lucide="compass" class="w-12 h-12 mx-auto mb-3 opacity-40"></i>
                    <p class="text-lg font-medium">Nessun rifugio trovato con questi filtri</p>
                    <p class="text-sm text-slate-500 mt-1">Prova a cambiare area o rimuovere i filtri di ricerca</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        filtered.forEach(hut => {
            const isVisited = window.appStorage.isHutVisited(hut.id);
            const card = document.createElement('div');
            card.className = `glass-card rounded-2xl overflow-hidden cursor-pointer relative group ${isVisited ? 'ring-2 ring-amber-400/80 shadow-lg shadow-amber-500/10' : ''}`;
            card.onclick = () => this.openHutDetailModal(hut);

            card.innerHTML = `
                <div class="relative h-48 overflow-hidden bg-slate-800">
                    <img src="${hut.image}" alt="${hut.name}" loading="lazy" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onerror="this.src='https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80'" />
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent"></div>
                    
                    <!-- Punti Badge -->
                    <div class="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide shadow-lg ${isVisited ? 'bg-amber-400 text-slate-950 ring-2 ring-white/30' : 'bg-slate-900/85 backdrop-blur-md text-amber-300 border border-amber-500/40'}">
                        <i data-lucide="award" class="w-3.5 h-3.5"></i>
                        <span>+${hut.points} PT</span>
                    </div>

                    <!-- Quota Badge -->
                    <div class="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-900/80 backdrop-blur-md text-slate-300 border border-slate-700">
                        <i data-lucide="mountain" class="w-3 h-3 text-slate-400"></i>
                        <span>${hut.elevation}</span>
                    </div>

                    ${isVisited ? `
                    <div class="absolute bottom-3 right-3 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
                        <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
                        <span>VISITATO</span>
                    </div>
                    ` : ''}
                </div>

                <div class="p-4">
                    <div class="text-xs font-medium text-amber-400/90 mb-1 flex items-center gap-1">
                        <i data-lucide="map-pin" class="w-3 h-3"></i>
                        ${hut.area}
                    </div>
                    <h3 class="text-lg font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1">${hut.name}</h3>
                    <p class="text-xs text-slate-400 mt-1 line-clamp-2">${hut.description}</p>
                    
                    <div class="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                        <span class="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/50">${hut.difficulty}</span>
                        <span class="text-amber-400 font-semibold group-hover:translate-x-1 transition-transform inline-flex items-center gap-0.5">
                            Dettagli <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
                        </span>
                    </div>
                </div>
            `;

            container.appendChild(card);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    // ==========================================
    // MAPPA INTERATTIVA LEAFLET (TAB MAPPA)
    // ==========================================
    ensureMapInitialized() {
        if (this.map) return;

        const mapContainer = document.getElementById('leaflet-map');
        if (!mapContainer) return;

        // Centrato nel cuore dell'Alta Badia (La Villa / Pralongià: 46.56, 11.90)
        this.map = L.map('leaflet-map', {
            center: [46.56, 11.90],
            zoom: 12,
            zoomControl: false
        });

        // Layer Cartografico Topografico OpenTopoMap / OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors | Alta Badia',
            maxZoom: 18
        }).addTo(this.map);

        L.control.zoom({ position: 'topright' }).addTo(this.map);

        // Aggiungi marker per ciascuno dei 45 rifugi
        this.renderMapMarkers();

        // Bottone geolocalizza utente sulla mappa
        const locateBtn = document.getElementById('btn-map-locate-me');
        if (locateBtn) {
            locateBtn.addEventListener('click', () => {
                this.locateUserOnMap();
            });
        }
    }

    renderMapMarkers() {
        if (!this.map) return;

        this.huts.forEach(hut => {
            const isVisited = window.appStorage.isHutVisited(hut.id);
            const iconHtml = `
                <div class="custom-hut-marker">
                    <div class="hut-pin-inner ${isVisited ? 'visited' : 'unvisited'}">
                        <span>${hut.points}</span>
                    </div>
                </div>
            `;

            const customIcon = L.divIcon({
                html: iconHtml,
                className: '',
                iconSize: [36, 36],
                iconAnchor: [18, 18],
                popupAnchor: [0, -20]
            });

            const popupContent = `
                <div class="text-slate-900 p-1 font-sans" style="min-width: 200px;">
                    <div class="relative h-24 rounded-lg overflow-hidden mb-2">
                        <img src="${hut.image}" class="w-full h-full object-cover" onerror="this.src='https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80'" />
                        <span class="absolute top-1 right-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">+${hut.points} PT</span>
                        <span class="absolute bottom-1 left-1 bg-slate-900/80 text-white text-[10px] px-1.5 py-0.5 rounded">${hut.elevation}</span>
                    </div>
                    <h4 class="font-bold text-sm text-slate-900">${hut.name}</h4>
                    <p class="text-xs text-slate-600 mb-2">${hut.area}</p>
                    <button onclick="window.app.openHutDetailModalById(${hut.id})" class="w-full py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg shadow transition">
                        Dettagli & Check-in
                    </button>
                </div>
            `;

            const marker = L.marker([hut.lat, hut.lng], { icon: customIcon })
                .bindPopup(popupContent)
                .addTo(this.map);

            this.markers[hut.id] = marker;
        });
    }

    locateUserOnMap() {
        if (!navigator.geolocation) {
            alert("Geolocalizzazione non supportata.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;

                if (!this.userMarker) {
                    const userIcon = L.divIcon({
                        html: `
                            <div class="user-pulse-marker">
                                <div class="user-pulse-ring"></div>
                                <div class="user-pulse-dot"></div>
                            </div>
                        `,
                        className: '',
                        iconSize: [22, 22],
                        iconAnchor: [11, 11]
                    });
                    this.userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(this.map);
                } else {
                    this.userMarker.setLatLng([lat, lng]);
                }

                this.map.flyTo([lat, lng], 14, { duration: 1.2 });
            },
            (err) => alert("Impossibile rilevare la posizione attuale: " + err.message),
            { enableHighAccuracy: true }
        );
    }

    // ==========================================
    // TRACKER ESCURSIONE LIVE (TAB TRACCIA)
    // ==========================================
    ensureTrackerMapInitialized() {
        const miniMapContainer = document.getElementById('tracker-mini-map');
        if (!miniMapContainer) return;

        if (!this.trackerMap) {
            this.trackerMap = L.map('tracker-mini-map', {
                center: [46.55, 11.90],
                zoom: 13,
                zoomControl: false,
                attributionControl: false
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18
            }).addTo(this.trackerMap);

            // Aggiungi tutti i rifugi come piccoli indicatori
            this.huts.forEach(hut => {
                const isVisited = window.appStorage.isHutVisited(hut.id);
                L.circleMarker([hut.lat, hut.lng], {
                    radius: isVisited ? 6 : 5,
                    fillColor: isVisited ? '#f59e0b' : '#334155',
                    color: '#ffffff',
                    weight: 1.5,
                    opacity: 1,
                    fillOpacity: 0.9
                }).bindTooltip(hut.name, { direction: 'top' }).addTo(this.trackerMap);
            });
        }

        setTimeout(() => {
            if (this.trackerMap) this.trackerMap.invalidateSize();
        }, 150);
    }

    initTrackerCallbacks() {
        const tracker = window.hikeTracker;

        // Callback aggiornamento posizione GPS
        tracker.onLocationUpdate = (currentPoint, allPoints) => {
            this.updateTrackerMapTrail(currentPoint, allPoints);
            this.drawElevationChart(allPoints);
        };

        // Callback aggiornamento statistiche (distanza, tempo, D+, rifugio vicino)
        tracker.onStatsUpdate = (stats) => {
            this.updateTrackerHUD(stats);
        };

        // Callback rilevamento automatico passaggio rifugio!
        tracker.onHutDetected = (detectionData) => {
            this.renderStatsHeader();
            this.renderPassport();
            this.renderLeaderboard();
            this.renderHutsList();
            this.openHutConqueredModal(detectionData);
        };

        // Callback cambio stato (recording, paused, stopped)
        tracker.onStatusChange = (status) => {
            this.updateTrackerControls(status);
        };

        this.bindTrackerButtons();
    }

    bindTrackerButtons() {
        const btnStart = document.getElementById('btn-tracker-start');
        const btnPause = document.getElementById('btn-tracker-pause');
        const btnResume = document.getElementById('btn-tracker-resume');
        const btnStop = document.getElementById('btn-tracker-stop');
        const btnSimulate = document.getElementById('btn-tracker-simulate');
        const btnGpx = document.getElementById('btn-tracker-gpx');

        if (btnStart) {
            btnStart.addEventListener('click', () => {
                window.hikeTracker.startHike();
            });
        }

        if (btnPause) {
            btnPause.addEventListener('click', () => {
                window.hikeTracker.pauseHike();
            });
        }

        if (btnResume) {
            btnResume.addEventListener('click', () => {
                window.hikeTracker.resumeHike();
            });
        }

        if (btnStop) {
            btnStop.addEventListener('click', () => {
                if (confirm("Sei sicuro di voler terminare e salvare questa escursione?")) {
                    const finishedHike = window.hikeTracker.stopHike();
                    if (finishedHike) {
                        this.openHikeSummaryModal(finishedHike);
                    }
                }
            });
        }

        if (btnSimulate) {
            btnSimulate.addEventListener('click', () => {
                const speedChoice = prompt("Avvia simulazione escursione Alta Badia!\nScegli velocità moltiplicatore (es. 5 per 5x, 10 per 10x):", "8");
                const speed = speedChoice ? Math.max(1, parseInt(speedChoice) || 5) : 5;
                window.hikeTracker.startSimulation(speed);
            });
        }

        if (btnGpx) {
            btnGpx.addEventListener('click', () => {
                window.hikeTracker.exportToGpx();
            });
        }
    }

    updateTrackerControls(status) {
        const btnStart = document.getElementById('btn-tracker-start');
        const btnPause = document.getElementById('btn-tracker-pause');
        const btnResume = document.getElementById('btn-tracker-resume');
        const btnStop = document.getElementById('btn-tracker-stop');
        const activeBadge = document.getElementById('tracker-status-indicator');

        if (status === 'recording') {
            if (btnStart) btnStart.classList.add('hidden');
            if (btnResume) btnResume.classList.add('hidden');
            if (btnPause) btnPause.classList.remove('hidden');
            if (btnStop) btnStop.classList.remove('hidden');
            if (activeBadge) {
                activeBadge.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span><span class="text-xs font-bold text-emerald-400 uppercase tracking-wider">Tracciamento Attivo</span>`;
            }
        } else if (status === 'paused') {
            if (btnPause) btnPause.classList.add('hidden');
            if (btnResume) btnResume.classList.remove('hidden');
            if (activeBadge) {
                activeBadge.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span><span class="text-xs font-bold text-amber-400 uppercase tracking-wider">In Pausa</span>`;
            }
        } else {
            // stopped
            if (btnStart) btnStart.classList.remove('hidden');
            if (btnPause) btnPause.classList.add('hidden');
            if (btnResume) btnResume.classList.add('hidden');
            if (btnStop) btnStop.classList.add('hidden');
            if (activeBadge) {
                activeBadge.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-slate-500"></span><span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Pronto per Escursione</span>`;
            }
        }
    }

    updateTrackerHUD(stats) {
        const s = stats || window.hikeTracker.getSummaryStats();

        const durationEl = document.getElementById('stat-duration');
        const distanceEl = document.getElementById('stat-distance');
        const gainEl = document.getElementById('stat-gain');
        const altEl = document.getElementById('stat-altitude');
        const speedEl = document.getElementById('stat-speed');
        const radarHutName = document.getElementById('radar-closest-hut');
        const radarHutDist = document.getElementById('radar-closest-dist');
        const radarProgress = document.getElementById('radar-progress-bar');
        const visitedCountEl = document.getElementById('stat-huts-visited-count');

        if (durationEl) durationEl.textContent = s.durationStr;
        if (distanceEl) distanceEl.textContent = s.distanceKm;
        if (gainEl) gainEl.textContent = `+${s.elevationGainM}m`;
        if (altEl) altEl.textContent = `${s.currentAltM}m`;
        if (speedEl) speedEl.textContent = `${s.currentSpeedKmH} km/h`;
        if (visitedCountEl) visitedCountEl.textContent = s.hutsVisitedCount;

        if (radarHutName) radarHutName.textContent = s.closestHutName;
        if (radarHutDist) radarHutDist.textContent = s.closestHutDistM ? `${s.closestHutDistM} m` : '-';

        // Barra radar di prossimità (da 0m a 500m)
        if (radarProgress && s.closestHutDistM) {
            const threshold = window.appStorage.getSettings().proximityRadius || 100;
            const progress = Math.max(0, Math.min(100, Math.round(((500 - s.closestHutDistM) / 500) * 100)));
            radarProgress.style.width = `${progress}%`;
            if (s.closestHutDistM <= threshold) {
                radarProgress.className = 'h-full bg-emerald-500 transition-all duration-300';
            } else {
                radarProgress.className = 'h-full bg-amber-400 transition-all duration-300';
            }
        }
    }

    updateTrackerMapTrail(point, allPoints) {
        if (!this.trackerMap) return;

        const latLngs = allPoints.map(p => [p.lat, p.lng]);

        if (!this.hikePolyline) {
            this.hikePolyline = L.polyline(latLngs, {
                color: '#10b981',
                weight: 4,
                opacity: 0.9,
                lineJoin: 'round'
            }).addTo(this.trackerMap);
        } else {
            this.hikePolyline.setLatLngs(latLngs);
        }

        // Posizione utente live
        if (!this.trackerUserMarker) {
            const icon = L.divIcon({
                html: `
                    <div class="user-pulse-marker">
                        <div class="user-pulse-ring"></div>
                        <div class="user-pulse-dot"></div>
                    </div>
                `,
                className: '',
                iconSize: [22, 22],
                iconAnchor: [11, 11]
            });
            this.trackerUserMarker = L.marker([point.lat, point.lng], { icon: icon }).addTo(this.trackerMap);
        } else {
            this.trackerUserMarker.setLatLng([point.lat, point.lng]);
        }

        // Cerchio del raggio di rilevamento (es. 100 metri)
        const radiusMeters = window.appStorage.getSettings().proximityRadius || 100;
        if (!this.proximityCircle) {
            this.proximityCircle = L.circle([point.lat, point.lng], {
                radius: radiusMeters,
                color: '#10b981',
                weight: 1,
                fillColor: '#10b981',
                fillOpacity: 0.15,
                dashArray: '4, 4'
            }).addTo(this.trackerMap);
        } else {
            this.proximityCircle.setLatLng([point.lat, point.lng]);
            this.proximityCircle.setRadius(radiusMeters);
        }

        // Mantieni la mappa centrata sull'utente
        this.trackerMap.panTo([point.lat, point.lng], { animate: true });
    }

    // Disegna profilo altimetrico su Canvas
    drawElevationChart(points) {
        const canvas = document.getElementById('elevation-chart-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const w = canvas.width = canvas.parentElement.clientWidth;
        const h = canvas.height = 120;

        ctx.clearRect(0, 0, w, h);

        if (!points || points.length < 2) {
            ctx.fillStyle = '#64748b';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Profilo altimetrico in caricamento...', w / 2, h / 2);
            return;
        }

        const alts = points.map(p => p.alt || 1800);
        const minAlt = Math.min(...alts) - 20;
        const maxAlt = Math.max(...alts) + 20;
        const range = Math.max(50, maxAlt - minAlt);

        // Disegna gradiente riempimento montagna
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, 'rgba(245, 158, 11, 0.4)');
        gradient.addColorStop(1, 'rgba(245, 158, 11, 0.0)');

        ctx.beginPath();
        points.forEach((pt, idx) => {
            const x = (idx / (points.length - 1)) * w;
            const y = h - ((pt.alt - minAlt) / range) * (h - 20) - 10;
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        // Chiudi il path per riempimento
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Linea profilo arancione
        ctx.beginPath();
        points.forEach((pt, idx) => {
            const x = (idx / (points.length - 1)) * w;
            const y = h - ((pt.alt - minAlt) / range) * (h - 20) - 10;
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Testo quota min / max
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        ctx.fillText(`Max: ${Math.round(maxAlt)}m`, 10, 15);
        ctx.fillText(`Min: ${Math.round(minAlt)}m`, 10, h - 5);
    }

    // ==========================================
    // PASSAPORTO DIGITALE ("I MIEI RIFUGI")
    // ==========================================
    renderPassport() {
        const container = document.getElementById('passport-stamps-grid');
        if (!container) return;

        const visited = window.appStorage.getVisitedHuts();
        const visitedList = Object.values(visited);

        const totalPointsEl = document.getElementById('passport-total-points');
        const totalCountEl = document.getElementById('passport-total-huts');

        if (totalPointsEl) totalPointsEl.textContent = window.appStorage.getTotalPoints();
        if (totalCountEl) totalCountEl.textContent = visitedList.length;

        container.innerHTML = '';

        if (visitedList.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12 text-slate-400">
                    <i data-lucide="book-open" class="w-12 h-12 mx-auto mb-3 opacity-40"></i>
                    <p class="text-base font-semibold">Il tuo passaporto non ha ancora nessun timbro</p>
                    <p class="text-xs text-slate-500 mt-1">Avvia un'escursione con il GPS per registrare automaticamente i rifugi che incontri!</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            this.renderBadges();
            return;
        }

        visitedList.forEach(stamp => {
            const hut = this.huts.find(h => h.id === stamp.hutId);
            const card = document.createElement('div');
            card.className = 'glass-card rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden border-amber-500/20';

            card.innerHTML = `
                <div class="flex items-start gap-3">
                    <div class="w-16 h-16 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 shadow-md">
                        <img src="${stamp.photoUrl || (hut ? hut.image : '')}" class="w-full h-full object-cover" onerror="this.src='https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=200&q=80'" />
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 mb-0.5">
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">+${stamp.points} PT</span>
                            <span class="text-[10px] text-slate-400">${stamp.dateFormatted || ''}</span>
                        </div>
                        <h4 class="font-bold text-white text-sm truncate">${stamp.hutName}</h4>
                        <p class="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <i data-lucide="${stamp.source === 'gps_auto' ? 'navigation' : 'camera'}" class="w-3 h-3 text-emerald-400"></i>
                            ${stamp.source === 'gps_auto' ? 'Rilevato via GPS' : 'Verificato'}
                        </p>
                    </div>
                </div>

                <div class="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span class="text-slate-500">${stamp.timeFormatted || ''}</span>
                    <button onclick="window.app.openHutDetailModalById(${stamp.hutId})" class="text-amber-400 hover:text-amber-300 font-semibold text-xs">
                        Scheda rifugio &rarr;
                    </button>
                </div>
            `;

            container.appendChild(card);
        });

        this.renderBadges();
        if (window.lucide) window.lucide.createIcons();
    }

    renderBadges() {
        const badgesContainer = document.getElementById('passport-badges-container');
        if (!badgesContainer) return;

        const badges = window.appStorage.getBadges();
        badgesContainer.innerHTML = '';

        badges.forEach(b => {
            const badgeEl = document.createElement('div');
            badgeEl.className = `p-3 rounded-2xl flex items-center gap-3 border transition-all ${b.isUnlocked ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 shadow-md shadow-amber-500/5' : 'bg-slate-900/40 border-slate-800/60 text-slate-500 opacity-60'}`;

            badgeEl.innerHTML = `
                <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${b.isUnlocked ? 'bg-amber-400 text-slate-950 font-bold shadow-lg' : 'bg-slate-800 text-slate-600'}">
                    <i data-lucide="${b.icon}" class="w-5 h-5"></i>
                </div>
                <div>
                    <h5 class="font-bold text-xs ${b.isUnlocked ? 'text-white' : 'text-slate-400'}">${b.title}</h5>
                    <p class="text-[11px] text-slate-400">${b.desc}</p>
                </div>
            `;

            badgesContainer.appendChild(badgeEl);
        });
    }

    // ==========================================
    // CLASSIFICA (LEADERBOARD)
    // ==========================================
    renderLeaderboard() {
        const podiumContainer = document.getElementById('leaderboard-podium');
        const listContainer = document.getElementById('leaderboard-list');
        if (!podiumContainer || !listContainer) return;

        const users = window.appStorage.getLeaderboard();

        // Podio (primi 3 posti: 2°, 1°, 3°)
        podiumContainer.innerHTML = '';
        if (users.length >= 3) {
            const top3 = [users[1], users[0], users[2]]; // ordine podio visuale: Argento (sinistra), Oro (centro), Bronzo (destra)
            const ranks = [2, 1, 3];
            const colors = ['border-slate-400 text-slate-200', 'border-amber-400 text-amber-300 shadow-amber-500/20', 'border-amber-700 text-amber-600'];
            const heights = ['h-32', 'h-40', 'h-28'];

            top3.forEach((user, idx) => {
                const rankNum = ranks[idx];
                const podiumItem = document.createElement('div');
                podiumItem.className = `flex flex-col items-center flex-1 ${rankNum === 1 ? '-translate-y-2' : ''}`;

                podiumItem.innerHTML = `
                    <div class="relative mb-2">
                        <img src="${user.avatar}" class="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 ${colors[idx]} object-cover shadow-lg" />
                        <span class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${rankNum === 1 ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300' : 'bg-slate-800 text-white border border-slate-600'}">
                            ${rankNum}
                        </span>
                    </div>
                    <span class="font-bold text-xs text-white text-center truncate max-w-[90px]">${user.name}</span>
                    <span class="text-amber-400 font-extrabold text-xs">${user.points} pt</span>
                    <div class="w-full ${heights[idx]} mt-2 rounded-t-xl glass-panel border border-slate-800 flex flex-col items-center justify-center">
                        <span class="text-xs text-slate-400 font-medium">${user.huts} rifugi</span>
                    </div>
                `;

                podiumContainer.appendChild(podiumItem);
            });
        }

        // Tabella posizioni successive (dal 4° in poi)
        listContainer.innerHTML = '';
        users.slice(3).forEach(user => {
            const row = document.createElement('div');
            row.className = `flex items-center justify-between p-3.5 rounded-xl border transition-colors ${user.isCurrentUser ? 'bg-amber-500/10 border-amber-500/50 text-white font-bold' : 'glass-card text-slate-300'}`;

            row.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="w-6 text-center font-bold text-sm ${user.isCurrentUser ? 'text-amber-400' : 'text-slate-500'}">${user.rank}</span>
                    <img src="${user.avatar}" class="w-9 h-9 rounded-full object-cover border border-slate-700" />
                    <div>
                        <div class="text-sm font-semibold text-white flex items-center gap-1.5">
                            ${user.name}
                            ${user.isCurrentUser ? '<span class="text-[10px] bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded font-extrabold">TU</span>' : ''}
                        </div>
                        <div class="text-xs text-slate-400">${user.handle} &bull; ${user.badge}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-sm font-extrabold text-amber-400">${user.points} pt</div>
                    <div class="text-[11px] text-slate-400">${user.huts} rifugi</div>
                </div>
            `;

            listContainer.appendChild(row);
        });
    }

    // ==========================================
    // MODALI & DIALOGHI
    // ==========================================
    bindModals() {
        // Chiudi modali al click sulla croce o sullo sfondo
        document.querySelectorAll('.modal-close-trigger').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
            });
        });

        // Apri Impostazioni
        const btnSettings = document.getElementById('btn-open-settings');
        if (btnSettings) {
            btnSettings.addEventListener('click', () => {
                const modal = document.getElementById('modal-settings');
                if (modal) modal.classList.remove('hidden');
            });
        }

        // Apri Guida Pubblicazione & Standby
        const btnStandbyGuide = document.getElementById('btn-open-standby-guide');
        if (btnStandbyGuide) {
            btnStandbyGuide.addEventListener('click', () => {
                const modal = document.getElementById('modal-standby-guide');
                if (modal) modal.classList.remove('hidden');
            });
        }

        // Salva Impostazioni
        const formSettings = document.getElementById('form-app-settings');
        if (formSettings) {
            formSettings.addEventListener('submit', (e) => {
                e.preventDefault();
                const radius = parseInt(document.getElementById('setting-proximity-radius').value) || 100;
                const wakeLock = document.getElementById('setting-wake-lock').checked;
                const standby = document.getElementById('setting-standby-keepalive').checked;
                const sound = document.getElementById('setting-sound').checked;
                const vibration = document.getElementById('setting-vibration').checked;

                window.appStorage.saveSettings({
                    proximityRadius: radius,
                    wakeLockEnabled: wakeLock,
                    standbyKeepAlive: standby,
                    soundEnabled: sound,
                    vibrationEnabled: vibration
                });

                if (window.mountainAudio) {
                    window.mountainAudio.enabled = sound;
                }

                alert("Impostazioni salvate con successo!");
                document.getElementById('modal-settings').classList.add('hidden');
            });
        }
    }

    updateSettingsUI() {
        const s = window.appStorage.getSettings();
        const radiusEl = document.getElementById('setting-proximity-radius');
        const wakeLockEl = document.getElementById('setting-wake-lock');
        const standbyEl = document.getElementById('setting-standby-keepalive');
        const soundEl = document.getElementById('setting-sound');
        const vibrationEl = document.getElementById('setting-vibration');

        if (radiusEl) radiusEl.value = s.proximityRadius;
        if (wakeLockEl) wakeLockEl.checked = s.wakeLockEnabled;
        if (standbyEl) standbyEl.checked = s.standbyKeepAlive;
        if (soundEl) soundEl.checked = s.soundEnabled;
        if (vibrationEl) vibrationEl.checked = s.vibrationEnabled;
    }

    // Modal Dettaglio Rifugio
    openHutDetailModalById(hutId) {
        const hut = this.huts.find(h => h.id === Number(hutId));
        if (hut) this.openHutDetailModal(hut);
    }

    openHutDetailModal(hut) {
        const modal = document.getElementById('modal-hut-detail');
        if (!modal) return;

        const isVisited = window.appStorage.isHutVisited(hut.id);

        document.getElementById('modal-hut-img').src = hut.image;
        document.getElementById('modal-hut-name').textContent = hut.name;
        document.getElementById('modal-hut-elevation').textContent = hut.elevation;
        document.getElementById('modal-hut-area').textContent = hut.area;
        document.getElementById('modal-hut-points').textContent = `+${hut.points} PT`;
        document.getElementById('modal-hut-desc').textContent = hut.description;
        document.getElementById('modal-hut-coords').textContent = `${hut.lat.toFixed(4)}° N, ${hut.lng.toFixed(4)}° E`;

        const checkinBtn = document.getElementById('btn-modal-manual-checkin');
        if (checkinBtn) {
            if (isVisited) {
                checkinBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4 mr-1"></i> Rifugio Già Timbrato`;
                checkinBtn.className = 'w-full py-3 rounded-xl font-bold text-sm bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 cursor-default';
                checkinBtn.onclick = null;
            } else {
                checkinBtn.innerHTML = `<i data-lucide="camera" class="w-4 h-4 mr-1"></i> Timbra Passaporto (Foto / Check-in)`;
                checkinBtn.className = 'w-full py-3 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 transition-all';
                checkinBtn.onclick = () => {
                    modal.classList.add('hidden');
                    this.triggerManualCheckin(hut);
                };
            }
        }

        // Link navigatore Maps
        const navBtn = document.getElementById('btn-modal-directions');
        if (navBtn) {
            navBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${hut.lat},${hut.lng}`;
        }

        modal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
    }

    // Modal Celebrazione Rifugio Conquistato (Automatico durante l'escursione!)
    openHutConqueredModal(detectionData) {
        const modal = document.getElementById('modal-hut-conquered');
        if (!modal) return;

        const { hut, points, distance } = detectionData;

        document.getElementById('conquered-hut-name').textContent = hut.name;
        document.getElementById('conquered-hut-points').textContent = `+${points} PUNTI`;
        document.getElementById('conquered-hut-distance').textContent = `Rilevato a ${distance} metri`;
        document.getElementById('conquered-hut-image').src = hut.image;

        modal.classList.remove('hidden');

        // Effetto coriandoli celebrativi
        this.launchConfetti();
    }

    // Modal Riepilogo Escursione al termine
    openHikeSummaryModal(hike) {
        const modal = document.getElementById('modal-hike-summary');
        if (!modal) return;

        const sec = hike.durationSeconds;
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);

        document.getElementById('summary-hike-duration').textContent = `${h}h ${m}m`;
        document.getElementById('summary-hike-distance').textContent = `${(hike.distanceMeters / 1000).toFixed(2)} km`;
        document.getElementById('summary-hike-gain').textContent = `+${Math.round(hike.elevationGain)} m`;
        document.getElementById('summary-hike-huts-count').textContent = hike.hutsVisited.length;

        const hutsList = document.getElementById('summary-hike-huts-list');
        hutsList.innerHTML = '';
        if (hike.hutsVisited.length > 0) {
            hike.hutsVisited.forEach(h => {
                const li = document.createElement('li');
                li.className = 'flex items-center justify-between text-xs py-1 border-b border-slate-800';
                li.innerHTML = `
                    <span class="font-semibold text-white">${h.name}</span>
                    <span class="text-amber-400 font-bold">+${h.points} pt</span>
                `;
                hutsList.appendChild(li);
            });
        } else {
            hutsList.innerHTML = '<li class="text-xs text-slate-500 py-1">Nessun rifugio attraversato in questa traccia</li>';
        }

        const downloadGpxBtn = document.getElementById('btn-summary-download-gpx');
        if (downloadGpxBtn) {
            downloadGpxBtn.onclick = () => {
                window.hikeTracker.exportToGpx(hike);
            };
        }

        modal.classList.remove('hidden');
    }

    // Check-in manuale con caricamento foto o validazione istantanea
    triggerManualCheckin(hut) {
        const photoInput = document.createElement('input');
        photoInput.type = 'file';
        photoInput.accept = 'image/*';
        photoInput.capture = 'camera';

        photoInput.onchange = (e) => {
            const file = e.target.files[0];
            let photoUrl = hut.image;

            if (file) {
                photoUrl = URL.createObjectURL(file);
            }

            window.appStorage.stampHut(hut.id, hut.name, hut.points, photoUrl, 'photo_upload');
            if (window.mountainAudio) window.mountainAudio.playHutConquered();

            this.renderStatsHeader();
            this.renderHutsList();
            this.renderPassport();
            this.renderLeaderboard();

            this.openHutConqueredModal({
                hut: hut,
                points: hut.points,
                distance: 0
            });
        };

        photoInput.click();
    }

    // Generatore coriandoli su schermo
    launchConfetti() {
        const container = document.getElementById('confetti-container');
        if (!container) return;
        container.innerHTML = '';

        const colors = ['#f59e0b', '#fbbf24', '#10b981', '#38bdf8', '#f43f5e', '#ffffff'];
        for (let i = 0; i < 45; i++) {
            const c = document.createElement('div');
            c.className = 'absolute rounded-full';
            const size = Math.random() * 8 + 6;
            c.style.width = `${size}px`;
            c.style.height = `${size}px`;
            c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            c.style.left = `${Math.random() * 100}%`;
            c.style.top = `-20px`;
            c.style.opacity = Math.random() + 0.5;
            c.style.transform = `rotate(${Math.random() * 360}deg)`;

            const duration = Math.random() * 2 + 1.5;
            c.style.transition = `all ${duration}s cubic-bezier(0.25, 1, 0.5, 1)`;

            container.appendChild(c);

            setTimeout(() => {
                c.style.top = `${Math.random() * 80 + 20}%`;
                c.style.left = `${parseFloat(c.style.left) + (Math.random() * 30 - 15)}%`;
                c.style.opacity = '0';
            }, 50);
        }

        setTimeout(() => {
            container.innerHTML = '';
        }, 3500);
    }
}

// Inizializzazione globale
window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
