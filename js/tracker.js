// Alta Badia Mountain Huts Challenge - GPS Hiking Tracker & Geofencing Engine
// Motore di tracciamento escursione in tempo reale con rilevamento prossimità rifugi e standby background keep-alive

class HikeTracker {
    constructor() {
        this.isRecording = false;
        this.isPaused = false;
        this.watchId = null;
        this.wakeLock = null;
        this.timerInterval = null;
        this.simulationInterval = null;
        this.isSimulating = false;

        // Dati dell'escursione corrente
        this.currentHike = null;

        // Callback per aggiornamento interfaccia grafica
        this.onLocationUpdate = null;
        this.onHutDetected = null;
        this.onStatsUpdate = null;
        this.onStatusChange = null;

        // Cache ultimo punto GPS per calcolo incrementale
        this.lastPosition = null;
        this.lastAltitude = null;
        this.closestHut = null;
        this.minDistanceToHut = Infinity;

        this.initWakeLockListener();
    }

    // Gestione schermo sempre attivo (Screen Wake Lock API)
    initWakeLockListener() {
        if ('wakeLock' in navigator) {
            document.addEventListener('visibilitychange', async () => {
                if (this.wakeLock !== null && document.visibilityState === 'visible' && this.isRecording && !this.isPaused) {
                    await this.requestWakeLock();
                }
            });
        }
    }

    async requestWakeLock() {
        try {
            if ('wakeLock' in navigator && window.appStorage.getSettings().wakeLockEnabled) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                this.wakeLock.addEventListener('release', () => {
                    this.wakeLock = null;
                });
                console.log("[WakeLock] Schermo bloccato attivo con successo.");
            }
        } catch (err) {
            console.warn("[WakeLock] Richiesta non riuscita:", err);
        }
    }

    releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release().then(() => {
                this.wakeLock = null;
                console.log("[WakeLock] Schermo sbloccato.");
            }).catch(e => console.warn(e));
        }
    }

    // Formula dell'Everseno per calcolo distanza tra due coordinate geografiche in metri
    calcHaversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Raggio della Terra in metri
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Avvia registrazione escursione
    startHike() {
        if (this.isRecording) return;

        const startTime = new Date();
        this.currentHike = {
            id: 'hike_' + Date.now(),
            name: `Escursione ${startTime.toLocaleDateString('it-IT')}`,
            startTime: startTime.toISOString(),
            endTime: null,
            durationSeconds: 0,
            distanceMeters: 0,
            elevationGain: 0,
            maxElevation: 0,
            minElevation: 9999,
            avgSpeedKmH: 0,
            currentSpeedKmH: 0,
            currentAltitude: null,
            trackPoints: [], // [ { lat, lng, alt, time, speed } ]
            hutsVisited: []  // [ { id, name, time, points } ]
        };

        this.isRecording = true;
        this.isPaused = false;
        this.lastPosition = null;
        this.lastAltitude = null;

        // Attiva WakeLock e Standby Keep-Alive
        this.requestWakeLock();
        if (window.appStorage.getSettings().standbyKeepAlive && window.mountainAudio) {
            window.mountainAudio.startStandbyKeepAlive();
        }

        // Avvia timer durata
        this.timerInterval = setInterval(() => {
            if (!this.isPaused && this.currentHike) {
                this.currentHike.durationSeconds++;
                if (this.onStatsUpdate) {
                    this.onStatsUpdate(this.getSummaryStats());
                }
            }
        }, 1000);

        // Se in esecuzione all'interno dell'app nativa Capacitor Android
        const CapacitorPlugins = window.Capacitor ? window.Capacitor.Plugins : null;
        const NativeBgGeo = CapacitorPlugins ? (CapacitorPlugins.BackgroundGeolocation || window.BackgroundGeolocation) : null;

        if (NativeBgGeo) {
            console.log("[HikeTracker] Avvio Foreground Service nativo Android per tracciamento 24/7...");
            NativeBgGeo.addWatcher(
                {
                    backgroundTitle: "Alta Badia Huts Challenge",
                    backgroundMessage: "Tracciamento sentiero e rilevamento rifugi attivo a schermo spento.",
                    requestAlwaysPermission: true,
                    distanceFilter: 2
                },
                (location, error) => {
                    if (location) {
                        this.handleGpsUpdate({
                            coords: {
                                latitude: location.latitude,
                                longitude: location.longitude,
                                altitude: location.altitude || 1900,
                                speed: location.speed || 0,
                                accuracy: location.accuracy || 5
                            },
                            timestamp: location.time || Date.now()
                        });
                    }
                }
            ).then((watcherId) => {
                this.nativeWatcherId = watcherId;
                console.log("[HikeTracker] Watcher nativo Android registrato con ID:", watcherId);
            }).catch((err) => {
                console.warn("[HikeTracker] Fallback a Geolocation standard:", err);
                this.startStandardGeolocation();
            });
        } else {
            this.startStandardGeolocation();
        }

        if (this.onStatusChange) this.onStatusChange('recording');
        console.log("[HikeTracker] Escursione avviata!");
    }

    // Geolocation standard Web / PWA
    startStandardGeolocation() {
        if ('geolocation' in navigator) {
            this.watchId = navigator.geolocation.watchPosition(
                (pos) => this.handleGpsUpdate(pos),
                (err) => console.warn("[GPS] Errore posizione:", err.message),
                {
                    enableHighAccuracy: true,
                    maximumAge: 1000,
                    timeout: 15000
                }
            );
        } else {
            alert("Il tuo dispositivo non supporta il GPS integrato.");
        }
    }

    // Gestione nuovo punto GPS ricevuto
    handleGpsUpdate(position) {
        if (!this.isRecording || this.isPaused || !this.currentHike) return;

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const alt = position.coords.altitude || (this.lastAltitude || 1900);
        const speed = position.coords.speed ? (position.coords.speed * 3.6) : 0;
        const now = new Date();

        const point = {
            lat: lat,
            lng: lng,
            alt: Math.round(alt),
            speed: Math.max(0, Math.round(speed * 10) / 10),
            time: now.toISOString()
        };

        // Calcolo distanza e dislivello positivo incrementale
        if (this.lastPosition) {
            const dist = this.calcHaversineDistance(
                this.lastPosition.lat,
                this.lastPosition.lng,
                lat,
                lng
            );

            // Filtro jitter GPS (ignora scatti inferiori a 2 metri o superiori a 100m in un singolo secondo)
            if (dist >= 2 && dist < 120) {
                this.currentHike.distanceMeters += dist;

                // Calcolo dislivello (filtro variazioni minori di 1 metro)
                if (this.lastAltitude !== null) {
                    const diffAlt = alt - this.lastAltitude;
                    if (diffAlt > 1) {
                        this.currentHike.elevationGain += diffAlt;
                    }
                }
                this.lastAltitude = alt;
            }
        } else {
            this.lastAltitude = alt;
        }

        this.lastPosition = point;
        this.currentHike.trackPoints.push(point);
        this.currentHike.currentAltitude = Math.round(alt);
        this.currentHike.currentSpeedKmH = point.speed;

        if (alt > this.currentHike.maxElevation) this.currentHike.maxElevation = Math.round(alt);
        if (alt < this.currentHike.minElevation) this.currentHike.minElevation = Math.round(alt);

        // Calcola velocità media
        if (this.currentHike.durationSeconds > 0) {
            const hours = this.currentHike.durationSeconds / 3600;
            const km = this.currentHike.distanceMeters / 1000;
            this.currentHike.avgSpeedKmH = Math.round((km / hours) * 10) / 10;
        }

        // ==========================================
        // MOTORE DI GEOFENCING E RILEVAMENTO RIFUGI
        // ==========================================
        this.checkHutsProximity(lat, lng, alt);

        // Notifica callbacks
        if (this.onLocationUpdate) {
            this.onLocationUpdate(point, this.currentHike.trackPoints);
        }
        if (this.onStatsUpdate) {
            this.onStatsUpdate(this.getSummaryStats());
        }
    }

    // Scansione di prossimità verso tutti i 45 rifugi
    checkHutsProximity(userLat, userLng, userAlt) {
        const proximityThreshold = window.appStorage.getSettings().proximityRadius || 100;
        let closest = null;
        let minDistance = Infinity;

        HUTS_DATA.forEach((hut) => {
            const distance = this.calcHaversineDistance(userLat, userLng, hut.lat, hut.lng);

            if (distance < minDistance) {
                minDistance = distance;
                closest = hut;
            }

            // Se l'utente si trova entro il raggio di rilevamento (default 100 metri)
            if (distance <= proximityThreshold) {
                this.triggerHutArrival(hut, distance, userAlt);
            }
        });

        this.closestHut = closest;
        this.minDistanceToHut = Math.round(minDistance);
    }

    // Trigger evento conquista rifugio
    triggerHutArrival(hut, distanceMeters, altitude) {
        // Verifica se il rifugio è già stato timbrato in questa escursione
        const alreadyInHike = this.currentHike.hutsVisited.some(h => h.id === hut.id);
        if (alreadyInHike) return;

        // Registra nel passaporto digitale
        const result = window.appStorage.stampHut(
            hut.id,
            hut.name,
            hut.points,
            hut.image,
            'gps_auto',
            this.currentHike.id
        );

        // Aggiungi alla lista rifugi visitati durante questa escursione
        this.currentHike.hutsVisited.push({
            id: hut.id,
            name: hut.name,
            points: hut.points,
            distance: Math.round(distanceMeters),
            time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
        });

        // Feedback sonoro (chime trionfale e campanaccio)
        if (window.mountainAudio) {
            window.mountainAudio.playHutConquered();
        }

        // Feedback vibrazione tattile sullo smartphone
        if ('vibrate' in navigator && window.appStorage.getSettings().vibrationEnabled) {
            navigator.vibrate([200, 100, 250, 100, 400]);
        }

        console.log(`[Geofencing] RIFUGIO CONQUISTATO: ${hut.name} (${distanceMeters.toFixed(1)}m)! Punti: +${hut.points}`);

        // Notifica UI per mostrare modal celebrativo
        if (this.onHutDetected) {
            this.onHutDetected({
                hut: hut,
                points: hut.points,
                distance: Math.round(distanceMeters),
                isNewStamp: !result.alreadyVisited
            });
        }
    }

    // Pausa escursione
    pauseHike() {
        if (!this.isRecording || this.isPaused) return;
        this.isPaused = true;
        if (this.onStatusChange) this.onStatusChange('paused');
    }

    // Riprendi escursione
    resumeHike() {
        if (!this.isRecording || !this.isPaused) return;
        this.isPaused = false;
        this.requestWakeLock();
        if (this.onStatusChange) this.onStatusChange('recording');
    }

    // Termina e salva escursione
    stopHike() {
        if (!this.isRecording) return null;

        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        // Rilascia watcher nativo Android se attivo
        if (this.nativeWatcherId) {
            const CapacitorPlugins = window.Capacitor ? window.Capacitor.Plugins : null;
            const NativeBgGeo = CapacitorPlugins ? (CapacitorPlugins.BackgroundGeolocation || window.BackgroundGeolocation) : null;
            if (NativeBgGeo) {
                NativeBgGeo.removeWatcher({ id: this.nativeWatcherId }).catch(e => console.warn(e));
            }
            this.nativeWatcherId = null;
        }

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
            this.isSimulating = false;
        }

        this.releaseWakeLock();
        if (window.mountainAudio) {
            window.mountainAudio.stopStandbyKeepAlive();
        }

        this.currentHike.endTime = new Date().toISOString();
        const finishedHike = { ...this.currentHike };

        // Salva se ha almeno 1 punto o 30 secondi di durata
        if (finishedHike.trackPoints.length > 0 || finishedHike.durationSeconds > 10) {
            window.appStorage.saveHike(finishedHike);
        }

        this.isRecording = false;
        this.isPaused = false;
        this.currentHike = null;
        this.lastPosition = null;

        if (this.onStatusChange) this.onStatusChange('stopped');
        return finishedHike;
    }

    // Ritorna le statistiche formattate per la dashboard
    getSummaryStats() {
        if (!this.currentHike) {
            return {
                durationStr: '00:00:00',
                distanceKm: '0.00',
                elevationGainM: 0,
                currentAltM: 0,
                currentSpeedKmH: 0,
                avgSpeedKmH: 0,
                closestHutName: '-',
                closestHutDistM: 0,
                hutsVisitedCount: 0
            };
        }

        const sec = this.currentHike.durationSeconds;
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        const durationStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

        return {
            durationStr: durationStr,
            durationSeconds: sec,
            distanceKm: (this.currentHike.distanceMeters / 1000).toFixed(2),
            elevationGainM: Math.round(this.currentHike.elevationGain),
            currentAltM: this.currentHike.currentAltitude || 1800,
            currentSpeedKmH: this.currentHike.currentSpeedKmH || 0,
            avgSpeedKmH: this.currentHike.avgSpeedKmH || 0,
            closestHutName: this.closestHut ? this.closestHut.name : 'Nessun rifugio nelle vicinanze',
            closestHutDistM: this.minDistanceToHut === Infinity ? 0 : this.minDistanceToHut,
            hutsVisitedCount: this.currentHike.hutsVisited.length,
            hutsVisited: this.currentHike.hutsVisited
        };
    }

    // ========================================================
    // MODALITÀ SIMULAZIONE ESCURSIONE (TEST & DIMOSTRAZIONE)
    // ========================================================
    // Permette all'utente di collaudare il rilevamento GPS e il passaggio ai rifugi
    // anche senza essere fisicamente in cammino in Alta Badia
    startSimulation(speedMultiplier = 5) {
        if (this.isRecording) {
            this.stopHike();
        }

        // Percorso panoramico reale sull'altopiano dell'Alta Badia:
        // Piz La Ila -> Club Moritzino -> Ütia de Bioch -> Rifugio Pralongià -> Ütia Punta Trieste -> Capanna Nera
        const routePoints = [
            { lat: 46.5665, lng: 11.9050, alt: 2080 }, // Partenza funivia Piz La Ila
            { lat: 46.5651, lng: 11.9065, alt: 2100 }, // ARRIVO: Club Moritzino (Check-in)
            { lat: 46.5620, lng: 11.9075, alt: 2090 },
            { lat: 46.5580, lng: 11.9080, alt: 2085 },
            { lat: 46.5539, lng: 11.9125, alt: 1970 }, // ARRIVO: Ütia La Para (Check-in)
            { lat: 46.5517, lng: 11.9070, alt: 2040 }, // ARRIVO: I Tablá (Check-in)
            { lat: 46.5470, lng: 11.9095, alt: 2079 }, // ARRIVO: Ütia de Bioch (Check-in)
            { lat: 46.5410, lng: 11.9120, alt: 2110 },
            { lat: 46.5336, lng: 11.9163, alt: 2157 }, // ARRIVO: Rifugio Alpino Pralongià (Check-in)
            { lat: 46.5347, lng: 11.9048, alt: 1900 }, // ARRIVO: Ütia Punta Trieste (Check-in)
            { lat: 46.5403, lng: 11.8943, alt: 2050 }  // ARRIVO: Rifugio Capanna Nera (Check-in)
        ];

        // Interpola punti intermedi per creare un tracciato GPS fluido
        const interpolated = [];
        for (let i = 0; i < routePoints.length - 1; i++) {
            const p1 = routePoints[i];
            const p2 = routePoints[i + 1];
            const steps = 10;
            for (let s = 0; s < steps; s++) {
                const ratio = s / steps;
                interpolated.push({
                    lat: p1.lat + (p2.lat - p1.lat) * ratio,
                    lng: p1.lng + (p2.lng - p1.lng) * ratio,
                    alt: Math.round(p1.alt + (p2.alt - p1.alt) * ratio),
                    speed: 4.8 // 4.8 km/h andatura camminata
                });
            }
        }
        interpolated.push(routePoints[routePoints.length - 1]);

        this.startHike();
        this.isSimulating = true;
        this.currentHike.name = "Simulazione: Altopiano Pralongià";

        let stepIndex = 0;
        const intervalMs = Math.max(500, Math.floor(1500 / speedMultiplier));

        this.simulationInterval = setInterval(() => {
            if (!this.isRecording || this.isPaused) return;

            if (stepIndex >= interpolated.length) {
                clearInterval(this.simulationInterval);
                this.simulationInterval = null;
                this.isSimulating = false;
                console.log("[Simulation] Percorso simulato completato!");
                return;
            }

            const pt = interpolated[stepIndex];
            const simulatedPos = {
                coords: {
                    latitude: pt.lat,
                    longitude: pt.lng,
                    altitude: pt.alt,
                    speed: (pt.speed / 3.6),
                    accuracy: 5
                },
                timestamp: Date.now()
            };

            this.handleGpsUpdate(simulatedPos);
            stepIndex++;
        }, intervalMs);

        console.log(`[Simulation] Modalità simulazione avviata (${interpolated.length} waypoints, ${speedMultiplier}x speed)`);
    }

    // ========================================================
    // ESPORTATORE FILE GPX (Compatibile Strava, Garmin, Komoot)
    // ========================================================
    exportToGpx(hike) {
        const hikeData = hike || this.currentHike;
        if (!hikeData || !hikeData.trackPoints || hikeData.trackPoints.length === 0) {
            alert("Nessun punto traccia registrato per l'esportazione GPX.");
            return null;
        }

        const creator = "Alta Badia Mountain Huts Challenge";
        let gpx = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        gpx += `<gpx version="1.1" creator="${creator}" xmlns="http://www.topografix.com/GPX/1/1">\n`;
        gpx += `  <metadata>\n`;
        gpx += `    <name>${hikeData.name}</name>\n`;
        gpx += `    <time>${hikeData.startTime}</time>\n`;
        gpx += `    <desc>Escursione registrata con Alta Badia Mountain Huts Challenge. Rifugi visitati: ${hikeData.hutsVisited ? hikeData.hutsVisited.map(h => h.name).join(', ') : 'Nessuno'}</desc>\n`;
        gpx += `  </metadata>\n`;

        // Waypoints per i rifugi visitati
        if (hikeData.hutsVisited && hikeData.hutsVisited.length > 0) {
            hikeData.hutsVisited.forEach(h => {
                const hutObj = HUTS_DATA.find(x => x.id === h.id);
                if (hutObj) {
                    gpx += `  <wpt lat="${hutObj.lat}" lon="${hutObj.lng}">\n`;
                    gpx += `    <ele>${hutObj.elevationM}</ele>\n`;
                    gpx += `    <name>${hutObj.name}</name>\n`;
                    gpx += `    <sym>Campground</sym>\n`;
                    gpx += `  </wpt>\n`;
                }
            });
        }

        // Traccia
        gpx += `  <trk>\n`;
        gpx += `    <name>${hikeData.name}</name>\n`;
        gpx += `    <trkseg>\n`;
        hikeData.trackPoints.forEach(pt => {
            gpx += `      <trkpt lat="${pt.lat}" lon="${pt.lng}">\n`;
            if (pt.alt !== null && pt.alt !== undefined) {
                gpx += `        <ele>${pt.alt}</ele>\n`;
            }
            if (pt.time) {
                gpx += `        <time>${pt.time}</time>\n`;
            }
            gpx += `      </trkpt>\n`;
        });
        gpx += `    </trkseg>\n`;
        gpx += `  </trk>\n`;
        gpx += `</gpx>`;

        // Download file browser
        const blob = new Blob([gpx], { type: 'application/gpx+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = `${hikeData.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.gpx`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return gpx;
    }
}

window.hikeTracker = new HikeTracker();
