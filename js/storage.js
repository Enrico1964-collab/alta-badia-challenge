// Alta Badia Mountain Huts Challenge - LocalStorage & State Management
// Gestione persistenza dati: passaporto digitale, timbri rifugi, cronologia escursioni e classifica

const STORAGE_KEYS = {
    USER: 'ab_user_profile',
    VISITED: 'ab_visited_huts',
    HIKES: 'ab_hikes_history',
    SETTINGS: 'ab_app_settings'
};

const DEFAULT_SETTINGS = {
    proximityRadius: 100, // raggio di rilevamento in metri (50, 100, 150, 200)
    wakeLockEnabled: true, // mantieni schermo attivo durante l'escursione
    standbyKeepAlive: true, // mantieni tracciamento GPS attivo anche a schermo spento
    soundEnabled: true,
    vibrationEnabled: true,
    mapLayer: 'outdoors', // 'outdoors' | 'satellite' | 'topo'
    language: 'it'
};

const DEFAULT_USER = {
    name: 'Escursionista Dolomitico',
    handle: '@hiker_badia',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    joinedDate: '2026-05-15'
};

// Classifica comunitaria iniziale con cui competere
const SEED_LEADERBOARD = [
    { rank: 1, name: 'Matteo Trevisan', handle: '@matteo_dolomites', points: 215, huts: 39, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80', badge: 'Leggenda' },
    { rank: 2, name: 'Elena Kostner', handle: '@elena_valbadia', points: 198, huts: 36, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80', badge: 'Maestro' },
    { rank: 3, name: 'Lukas Comploi', handle: '@lukas_caminador', points: 174, huts: 31, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80', badge: 'Cacciatore' },
    { rank: 4, name: 'Chiara Bernardi', handle: '@chiara_climb', points: 142, huts: 25, avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80', badge: 'Cacciatore' },
    { rank: 5, name: 'Alex Alfreider', handle: '@alex_ladinia', points: 120, huts: 21, avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80', badge: 'Esploratore' },
    { rank: 6, name: 'Giulia Fabbri', handle: '@giulia_trek', points: 95, huts: 17, avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80', badge: 'Esploratore' },
    { rank: 7, name: 'Davide Pitscheider', handle: '@davide_piz', points: 72, huts: 13, avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80', badge: 'Pioniere' }
];

const BADGES_CONFIG = [
    {
        id: 'first_step',
        title: 'Primo Rintocco',
        desc: 'Conquista il tuo primo rifugio in Alta Badia',
        icon: 'mountain',
        unlocked: (visitedCount) => visitedCount >= 1
    },
    {
        id: 'pioneer_valleys',
        title: 'Pioniere delle Valli',
        desc: 'Visita almeno 5 rifugi diversi',
        icon: 'compass',
        unlocked: (visitedCount) => visitedCount >= 5
    },
    {
        id: 'peak_hunter',
        title: 'Cacciatore di Vette',
        desc: 'Visita 10 rifugi dolomitici',
        icon: 'flame',
        unlocked: (visitedCount) => visitedCount >= 10
    },
    {
        id: 'high_altitude_eagle',
        title: 'Aquila del Sella & Puez',
        desc: 'Conquista almeno 3 rifugi sopra i 2.200m di quota',
        icon: 'award',
        unlocked: (visitedCount, visitedList) => {
            const highHuts = visitedList.filter(h => {
                const hut = HUTS_DATA.find(x => x.id === h.hutId);
                return hut && hut.elevationM >= 2200;
            });
            return highHuts.length >= 3;
        }
    },
    {
        id: 'master_uties',
        title: 'Maestro delle Üties',
        desc: 'Raggiungi 25 rifugi dell\'Alta Badia Challenge',
        icon: 'trophy',
        unlocked: (visitedCount) => visitedCount >= 25
    },
    {
        id: 'legend_dolomites',
        title: 'Leggenda delle Dolomiti',
        desc: 'Completa tutti i 45 rifugi dell\'Alta Badia!',
        icon: 'crown',
        unlocked: (visitedCount) => visitedCount >= 45
    }
];

class AppStorage {
    constructor() {
        this.user = this.load(STORAGE_KEYS.USER, DEFAULT_USER);
        this.visited = this.load(STORAGE_KEYS.VISITED, {});
        this.hikes = this.load(STORAGE_KEYS.HIKES, []);
        this.settings = this.load(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);

        // Se l'utente non ha ancora nessun rifugio visitato, pre-registriamo 2 rifugi dimostrativi
        // per dare subito l'effetto visivo del passaporto timbrato
        if (Object.keys(this.visited).length === 0) {
            this.stampHut(1, 'Ütia Nagler', 5, 'https://www.utianagler.it/media/k2/galleries/178/1920/restaurant-nagler-1.jpg', 'demo_init');
            this.stampHut(5, 'Rifugio La Crusc - Santa Croce', 7, 'https://www.lacrusc.com/wp-content/uploads/2022/10/20220205_174539-scaled.jpg', 'demo_init');
        }
    }

    load(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            return { ...fallback, ...JSON.parse(raw) };
        } catch (e) {
            console.warn(`Errore caricamento storage key ${key}:`, e);
            return fallback;
        }
    }

    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error(`Errore salvataggio storage key ${key}:`, e);
        }
    }

    getUser() {
        return this.user;
    }

    saveUser(user) {
        this.user = { ...this.user, ...user };
        this.save(STORAGE_KEYS.USER, this.user);
    }

    getSettings() {
        return this.settings;
    }

    saveSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        this.save(STORAGE_KEYS.SETTINGS, this.settings);
    }

    getVisitedHuts() {
        return this.visited;
    }

    isHutVisited(hutId) {
        return !!this.visited[hutId];
    }

    // Timbra e registra il passaggio al rifugio
    stampHut(hutId, hutName, points, photoUrl = null, source = 'gps_auto', hikeId = null) {
        if (this.visited[hutId]) {
            return { alreadyVisited: true, record: this.visited[hutId] };
        }

        const now = new Date();
        const record = {
            hutId: Number(hutId),
            hutName: hutName,
            points: Number(points),
            timestamp: now.toISOString(),
            dateFormatted: now.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }),
            timeFormatted: now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
            photoUrl: photoUrl,
            source: source, // 'gps_auto', 'gps_manual', 'photo_upload'
            hikeId: hikeId
        };

        this.visited[hutId] = record;
        this.save(STORAGE_KEYS.VISITED, this.visited);
        return { alreadyVisited: false, record: record };
    }

    // Rimuove timbro (utile per reset o test)
    uncheckHut(hutId) {
        if (this.visited[hutId]) {
            delete this.visited[hutId];
            this.save(STORAGE_KEYS.VISITED, this.visited);
        }
    }

    // Calcolo punti totali accumulati
    getTotalPoints() {
        return Object.values(this.visited).reduce((sum, item) => sum + (item.points || 0), 0);
    }

    getVisitedCount() {
        return Object.keys(this.visited).length;
    }

    // Lista badge sbloccati
    getBadges() {
        const visitedList = Object.values(this.visited);
        const count = visitedList.length;

        return BADGES_CONFIG.map(badge => {
            const isUnlocked = badge.unlocked(count, visitedList);
            return {
                ...badge,
                isUnlocked: isUnlocked
            };
        });
    }

    // Cronologia Escursioni
    getHikes() {
        return this.hikes;
    }

    saveHike(hike) {
        this.hikes.unshift(hike);
        this.save(STORAGE_KEYS.HIKES, this.hikes);
    }

    deleteHike(hikeId) {
        this.hikes = this.hikes.filter(h => h.id !== hikeId);
        this.save(STORAGE_KEYS.HIKES, this.hikes);
    }

    // Calcolo Classifica Dinamica (include utente corrente posizionato correttamente)
    getLeaderboard() {
        const userPoints = this.getTotalPoints();
        const userHuts = this.getVisitedCount();

        const currentUserEntry = {
            isCurrentUser: true,
            name: this.user.name,
            handle: this.user.handle,
            points: userPoints,
            huts: userHuts,
            avatar: this.user.avatar,
            badge: userHuts >= 25 ? 'Maestro' : (userHuts >= 10 ? 'Cacciatore' : (userHuts >= 5 ? 'Esploratore' : 'Pioniere'))
        };

        const allUsers = [...SEED_LEADERBOARD, currentUserEntry];
        allUsers.sort((a, b) => b.points - a.points);

        return allUsers.map((item, idx) => ({
            ...item,
            rank: idx + 1
        }));
    }

    // Reset completo dati
    resetAll() {
        localStorage.removeItem(STORAGE_KEYS.VISITED);
        localStorage.removeItem(STORAGE_KEYS.HIKES);
        this.visited = {};
        this.hikes = [];
        this.stampHut(1, 'Ütia Nagler', 5, 'https://www.utianagler.it/media/k2/galleries/178/1920/restaurant-nagler-1.jpg', 'demo_init');
    }
}

window.appStorage = new AppStorage();
