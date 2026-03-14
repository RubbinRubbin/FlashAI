# FlashAI - AI-Powered Flashcard Generator

Applicazione web intelligente per generare flashcard a risposta multipla da qualsiasi documento.

## Caratteristiche

- Upload di file (PDF, TXT, DOCX, MD) fino a 200MB
- Analisi AI con OpenAI GPT-4o
- Gestione workspace per organizzare per argomenti
- Generazione automatica domande a risposta multipla in italiano
- Modalità Studio con navigazione tastiera e tracciamento performance
- Modalità Quiz a tempo con riepilogo finale
- Progresso in tempo reale durante la generazione
- Possibilità di interrompere e salvare flashcard parziali
- Salvataggio e recupero flashcard

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
2. Carica un file (PDF, documento, note) - supporta anche PDF grandi (180+ pagine)
3. L'AI analizzerà il contenuto e genererà flashcard a risposta multipla
4. Studia con le flashcard generate (tasti 1-4 per rispondere, Enter per avanzare)
5. Usa la modalità Quiz per un test a tempo

## Tecnologie

- **Backend**: Node.js, Express
- **AI**: OpenAI API (GPT-4o)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Storage**: JSON file-based
