# 🏔️ Alta Badia Mountain Huts Challenge

Un'applicazione web progressiva (PWA) moderna, immersiva e ricca di funzionalità ispirata alla sfida dei rifugi dell'**Alta Badia** (Dolomiti, Alto Adige).

L'app include tutti i **45 rifugi ufficiali**, la mappa topografica interattiva, il passaporto digitale con timbri e medaglie, la classifica in tempo reale e un **motore di tracciamento escursioni GPS con rilevamento automatico di prossimità** (geofencing) e supporto al funzionamento a **schermo spento (standby)**.

---

## ✨ Funzionalità Principali

### 1. 🥾 Catalogo Completo dei 45 Rifugi
- Tutti i 45 rifugi dell'Alta Badia estratti con dati verificati:
  - Nome ladino autentico (es. *Ütia Nagler*, *Ütia de Bioch*, *Rifugio Alpino Pralongià*, *Rifugio Scotoni*, *Rifugio Cavazza al Pisciadù*, ecc.)
  - Quota altimetrica esatta (m) e coordinate GPS ad alta precisione
  - Punteggio challenge da **3 a 7 punti** in base all'isolamento e al dislivello
  - Fotografie in alta risoluzione
  - Descrizione culturale, gastronomica e geografica
  - Zona di appartenenza (*Badia / La Crusc*, *Corvara / Col Alt*, *San Cassiano / Pralongià*, *La Villa / Gardenaccia*, *Colfosco / Passo Gardena*, *Passo Campolongo / Sella*)
- Ricerca in tempo reale e filtri per area, difficoltà, quota, punteggio e stato visita.

### 2. 🗺️ Mappa Topografica Interattiva (Leaflet)
- Mappa escursionistica completa con tutti i rifugi georeferenziati.
- Pin personalizzati con badge dei punti e corona dorata per i rifugi già conquistati.
- Localizzazione istantanea dell'utente con cerchio di precisione GPS.
- Popup con anteprima fotografica e pulsante di navigazione verso i sentieri.

### 3. 📡 Tracciamento Escursione & Rilevamento Automatico di Prossimità (Geofencing)
- **Registrazione Live**: traccia il sentiero GPS in tempo reale sulla mappa.
- **Metriche HUD**:
  - Tempo trascorso (hh:mm:ss)
  - Distanza percorsa (km con filtro anti-jitter)
  - Dislivello positivo accumulato (D+ in metri)
  - Quota altimetrica istantanea (m)
  - Velocità istantanea (km/h) e andatura media
- **Radar di Prossimità**: calcola la distanza in metri verso il rifugio più vicino.
- **Assegnazione Automatica dei Punti**: quando l'escursionista si trova entro il raggio stabilito (default 100m, configurabile da 50m a 200m):
  - Rintocco di campana alpina (sintetizzatore audio realistico Web Audio API)
  - Vibrazione tattile dello smartphone
  - Schermata celebrativa con coriandoli
  - Timbro digitale e punti accreditati all'istante!
- **Profilo Altimetrico Canvas**: grafico dinamico che disegna il profilo altimetrico dell'escursione in tempo reale.
- **Modalità Simulazione (1-Click Demo)**: per testare l'app e il passaggio ai rifugi comodamente dal divano a velocità 1x, 5x o 10x!
- **Esportazione GPX**: scarica la traccia in formato standard `.gpx` compatibile con **Strava**, **Garmin Connect**, **Komoot** e **AllTrails**.

### 4. 🛂 Passaporto Digitale & Medagliere ("I Miei Rifugi")
- Album dei timbri conquistati con data, ora, quota e tipologia di rilevamento (GPS automatico o foto verificata).
- Livelli di progressione:
  1. *Pioniere* (1° rifugio)
  2. *Esploratore di Badia* (5 rifugi)
  3. *Cacciatore di Vette* (10 rifugi)
  4. *Maestro delle Üties* (25 rifugi)
  5. *Leggenda delle Dolomiti* (tutti i 45 rifugi!)
- Trofei e medaglie speciali (es. *Aquila del Sella & Puez* per i rifugi oltre i 2.200m).
- Check-in fotografico con fotocamera dello smartphone.

### 5. 🏆 Classifica Comunitaria (Leaderboard)
- Podio grafico (Oro, Argento, Bronzo) con atleti della stagione.
- Integrazione dinamica della posizione dell'utente con calcolo istantaneo del rank in classifica.
- Spiegazione delle regole e del sistema di attribuzione dei punti.

---

## 🔋 Come Funziona il Tracciamento in Standby (a Schermo Spento)

I sistemi operativi mobili (**iOS** e **Android**) congelano l'esecuzione JavaScript delle normali schede del browser quando lo schermo si spegne per risparmiare batteria.

In questa app abbiamo implementato tre livelli di garanzia:

1. **Screen Wake Lock API**: mantiene acceso lo schermo a luminosità ridotta durante la camminata, evitando che il telefono vada in standby.
2. **Web Audio Keep-Alive**: riproduce ciclicamente un buffer audio impercettibile ad altissima efficienza. Questo notifica al sistema operativo mobile che è in corso una sessione audio/multimediale attiva, **impedendo a iOS Safari e Android Chrome di sospendere la geolocalizzazione GPS a schermo bloccato**.
3. **PWA Standalone**: una volta installata sulla schermata Home, l'app gira in un processo isolato senza le restrizioni delle schede browser.

---

## 🚀 Dove Pubblicare l'App GRATIS (Guida Completa)

Per permettere al GPS, al Service Worker e al Wake Lock di funzionare sugli smartphone, l'app **deve essere servita tramite connessione sicura HTTPS**. Ecco le migliori piattaforme 100% gratuite:

### Opzione 1: Vercel (Consigliata - Pronta in 60 secondi)
1. Crea un account gratuito su [vercel.com](https://vercel.com).
2. Trascina direttamente la cartella del progetto nella dashboard di Vercel, oppure collega la tua repository GitHub.
3. Vercel assegnerà istantaneamente un URL HTTPS pubblico gratuito (es. `https://alta-badia-challenge.vercel.app`).
4. Apri il link dal tuo smartphone ed effettua l'installazione come PWA.

### Opzione 2: Netlify (Drag & Drop Diretto)
1. Vai su [netlify.com](https://www.netlify.com) ed esegui l'accesso gratuito.
2. Apri la sezione **Sites** e trascina la cartella `Alta Badia Mountain Huts Challenhe` nel riquadro *"Drag and drop your site output folder here"*.
3. Il tuo sito sarà online in 10 secondi con HTTPS attivo e PWA abilitata.

### Opzione 3: GitHub Pages
1. Crea una repository su GitHub e carica i file di questa cartella.
2. Vai su **Settings > Pages**.
3. Sotto **Build and deployment**, seleziona il branch `main` e la cartella `/ (root)`.
4. Clicca **Save**: l'app sarà raggiungibile gratuitamente all'indirizzo `https://<tuo-utente>.github.io/<nome-repo>/`.

### Opzione 4: Pacchetto APK Nativo Android con Capacitor (Zero Costi)
Se desideri un tracciamento in background ancora più indistruttibile su smartphone Android (con notifica persistente nella barra di stato che non viene mai chiusa dal task killer di Samsung, Xiaomi o Huawei):
1. Inizializza Capacitor nel progetto:
   ```bash
   npx @capacitor/cli create
   npx @capacitor/core
   npx cap add android
   ```
2. Installa il plugin di geolocalizzazione in background:
   ```bash
   npm install @capacitor-community/background-geolocation
   ```
3. Compila l'APK con **GitHub Actions** (gratuito) o Android Studio e scarica il file `.apk` direttamente sul tuo telefono per un'installazione nativa senza dover pagare la licenza Google Play Store!

---

## 📲 Come Installare l'App sullo Smartphone

- **iPhone (iOS Safari)**:
  1. Apri il link dell'app in Safari.
  2. Tocca il pulsante **Condividi** (icona del quadrato con la freccia verso l'alto).
  3. Scorri e seleziona **"Aggiungi alla schermata Home"**.
- **Android (Google Chrome)**:
  1. Apri il link dell'app in Chrome.
  2. Tocca il banner che compare in basso *"Aggiungi ad Home"* oppure tocca i 3 puntini in alto a destra e seleziona **"Installa app"**.

L'app si aprirà a schermo intero come una vera applicazione nativa, funzionando anche offline nei tratti di montagna privi di segnale 4G/5G!
