# FlashAI - AI-Powered Flashcard Generator

Applicazione web intelligente per generare flashcard a risposta multipla da qualsiasi documento, con ripetizione spaziata SM-2 e dashboard statistiche.

## Caratteristiche

### Generazione AI
- Upload di file (PDF, TXT, DOCX, MD) fino a 200MB
- Analisi AI con OpenAI GPT-4o-mini per generazione flashcard in italiano
- Rigenerazione di nuove flashcard dallo stesso documento (con deduplicazione)
- Creazione manuale di flashcard personalizzate
- Progresso in tempo reale durante la generazione con possibilità di interruzione

### Studio Intelligente
- **Ripetizione Spaziata SM-2**: Algoritmo che ottimizza i tempi di revisione per ogni flashcard
- Navigazione con tastiera (1-4 per rispondere, Enter per avanzare)
- Filtro automatico: mostra solo le card da ripassare
- Ordinamento per priorità di revisione
- Mescola e filtra per sbagliate

### Quiz a Tempo
- Simulazione esame con timer configurabile (default: 30 minuti, 30 domande)
- Nessun feedback durante il quiz — risultati mostrati alla fine
- Riepilogo dettagliato con punteggio finale

### Dashboard Statistiche
- Tempo totale di studio e quiz
- Conteggio sessioni e streak giornaliera
- Risposte corrette/sbagliate con percentuale di precisione
- Percentuale di miglioramento (ultimi 7 giorni vs precedenti)
- Flashcard padroneggiate e critiche
- Barra di preparazione esame (0-100%)
- Storico quiz recenti

### Gestione
- Workspace multipli per organizzare per argomento
- Pannello gestione come modal overlay (icona ingranaggio)
- Dialog personalizzati al posto degli alert del browser
- Pulsanti rapidi: Ricomincia studio e Reset statistiche

## Installazione e avvio

### Requisiti
- Node.js (v18+)
- Una API key di OpenAI

### Setup

1. Clona il repository:
```bash
git clone <url-repo>
cd FlashAI
```

2. Installa le dipendenze:
```bash
npm install
```

3. Crea il file `.env` dalla template:
```bash
cp .env.example .env
```

4. Aggiungi la tua API key di OpenAI nel file `.env`:
```
OPENAI_API_KEY=sk-...
PORT=3000
```

### Avvio

**Produzione:**
```bash
npm start
```

**Sviluppo (auto-reload):**
```bash
npm run dev
```

Apri il browser su [http://localhost:3000](http://localhost:3000)

## Uso

1. Crea un nuovo workspace per un argomento di studio
2. Carica un file (PDF, documento, note) — supporta anche PDF grandi (180+ pagine)
3. L'AI analizzerà il contenuto e genererà flashcard a risposta multipla
4. Studia con le flashcard — l'algoritmo SM-2 ottimizza quali ripassare
5. Usa la modalità Quiz per un test a tempo simulato
6. Consulta le statistiche per monitorare i tuoi progressi

## Tecnologie

- **Backend**: Node.js, Express
- **AI**: OpenAI API (GPT-4o-mini)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Storage**: JSON file-based (server) + localStorage (client)
- **Algoritmo**: SM-2 Spaced Repetition
