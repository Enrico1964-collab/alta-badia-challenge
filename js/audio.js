// Alta Badia Mountain Huts Challenge - Web Audio API Synthesizer
// Generatore di suoni alpini (campanaccio, fanfara dei rifugi e audio keep-alive per standby)

class MountainAudio {
    constructor() {
        this.ctx = null;
        this.keepAliveInterval = null;
        this.keepAliveAudio = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // Suono realistico di campanaccio alpino (Alpine Cowbell)
    playCowbell() {
        if (!this.enabled) return;
        try {
            this.init();
            if (!this.ctx) return;
            const now = this.ctx.currentTime;

            // Frequenze caratteristiche del metallo forgiato del campanaccio dolomitico
            const freqs = [587, 845, 1175, 1560];
            freqs.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const bandpass = this.ctx.createBiquadFilter();

                bandpass.type = 'bandpass';
                bandpass.frequency.setValueAtTime(freq, now);
                bandpass.Q.setValueAtTime(15, now);

                osc.type = idx % 2 === 0 ? 'triangle' : 'square';
                osc.frequency.setValueAtTime(freq, now);

                const volume = 0.25 / (idx + 1);
                gain.gain.setValueAtTime(volume, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8 + idx * 0.1);

                osc.connect(bandpass);
                bandpass.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(now);
                osc.stop(now + 1.2);
            });

            // Secondo rintocco morbido (eco del batacchio)
            setTimeout(() => {
                if (!this.ctx) return;
                const echoNow = this.ctx.currentTime;
                const osc2 = this.ctx.createOscillator();
                const gain2 = this.ctx.createGain();
                osc2.type = 'triangle';
                osc2.frequency.setValueAtTime(845, echoNow);
                gain2.gain.setValueAtTime(0.12, echoNow);
                gain2.gain.exponentialRampToValueAtTime(0.0001, echoNow + 0.5);
                osc2.connect(gain2);
                gain2.connect(this.ctx.destination);
                osc2.start(echoNow);
                osc2.stop(echoNow + 0.6);
            }, 120);

        } catch (e) {
            console.warn("Impossibile riprodurre campanaccio audio:", e);
        }
    }

    // Chime melodioso trionfale all'assegnazione dei punti del rifugio
    playHutConquered() {
        if (!this.enabled) return;
        try {
            this.init();
            if (!this.ctx) return;
            const now = this.ctx.currentTime;
            
            // Accordo Maggiore ascendente: C5, E5, G5, C6 (Do, Mi, Sol, Do acuto)
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.12);
                
                gain.gain.setValueAtTime(0, now + i * 0.12);
                gain.gain.linearRampToValueAtTime(0.2, now + i * 0.12 + 0.04);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.9);
                
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                
                osc.start(now + i * 0.12);
                osc.stop(now + i * 0.12 + 1.0);
            });

            // Piccolo tocco di campanaccio di accompagnamento
            setTimeout(() => this.playCowbell(), 480);
        } catch (e) {
            console.warn("Audio checkin fallito:", e);
        }
    }

    // Fanfara per trofeo o badge sbloccato
    playBadgeUnlocked() {
        if (!this.enabled) return;
        try {
            this.init();
            if (!this.ctx) return;
            const now = this.ctx.currentTime;
            const melody = [
                { f: 523.25, d: 0.12 }, // C5
                { f: 659.25, d: 0.12 }, // E5
                { f: 783.99, d: 0.12 }, // G5
                { f: 1046.50, d: 0.35 } // C6
            ];

            let time = now;
            melody.forEach((note) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(note.f, time);
                gain.gain.setValueAtTime(0.2, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + note.d);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(time);
                osc.stop(time + note.d + 0.05);
                time += note.d;
            });
        } catch (e) {
            console.warn("Audio badge fallito:", e);
        }
    }

    // TECNICA STANDBY KEEP-ALIVE:
    // Riproduce un buffer audio impercettibile / quasi inudibile a ciclo continuo
    // Questo attiva la sessione multimediale del sistema operativo (iOS Safari / Android Chrome)
    // impedendo al browser di sospendere il thread JavaScript e il watcher GPS quando lo schermo si spegne.
    startStandbyKeepAlive() {
        try {
            this.init();
            if (!this.ctx) return;

            if (this.keepAliveInterval) {
                clearInterval(this.keepAliveInterval);
            }

            // Crea un brevissimo click a frequenza bassissima (10Hz) con volume infinitesimale
            // eseguito ogni 8 secondi per tenere sveglio il Web Audio engine
            this.keepAliveInterval = setInterval(() => {
                try {
                    if (this.ctx && this.ctx.state === 'running') {
                        const now = this.ctx.currentTime;
                        const osc = this.ctx.createOscillator();
                        const gain = this.ctx.createGain();
                        osc.frequency.setValueAtTime(20, now); // Quasi impercettibile all'orecchio umano
                        gain.gain.setValueAtTime(0.001, now);
                        gain.gain.exponentialRampToValueAtTime(0.00001, now + 0.1);
                        osc.connect(gain);
                        gain.connect(this.ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.15);
                    }
                } catch (err) {
                    // silenzioso
                }
            }, 8000);

            console.log("[Audio] Standby Keep-Alive attivo per tracciamento in background.");
        } catch (e) {
            console.warn("Inizializzazione Standby Keep-Alive fallita:", e);
        }
    }

    stopStandbyKeepAlive() {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
            console.log("[Audio] Standby Keep-Alive disattivato.");
        }
    }
}

window.mountainAudio = new MountainAudio();
