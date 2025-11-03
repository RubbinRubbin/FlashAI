# Guida all'Installazione di FlashAI

## Requisiti

- Node.js 16+ installato
- Account Anthropic con API Key (gratuito su [console.anthropic.com](https://console.anthropic.com))

## Passo 1: Installazione delle Dipendenze

Le dipendenze sono già state installate! Se hai bisogno di reinstallarle:

```bash
npm install
```

## Passo 2: Configurare l'API Key di Anthropic

1. Vai su [console.anthropic.com](https://console.anthropic.com)
2. Crea un account gratuito (se non ce l'hai già)
3. Vai su "API Keys" e crea una nuova chiave
4. Copia la tua API key

5. Apri il file `.env` nella root del progetto
6. Sostituisci `your_anthropic_api_key_here` con la tua API key:

```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx
PORT=3000
```

## Passo 3: Avviare l'Applicazione

```bash
npm start
```

Vedrai un messaggio:
```
🚀 FlashAI server running on http://localhost:3000
📚 Upload your documents to generate AI-powered flashcards!
```

## Passo 4: Usare l'Applicazione

1. Apri il browser su `http://localhost:3000`
2. Clicca su "Nuovo Workspace" e crea un workspace (es. "Storia")
3. Carica un file di test (c'è `esempio-test.txt` nella root del progetto)
4. L'AI analizzerà il documento e genererà flashcard automaticamente!
5. Clicca su "Modalità Studio" per studiare le flashcard in modo interattivo

## Tipi di File Supportati

- **PDF** (.pdf) - Documenti, libri, articoli
- **Word** (.docx, .doc) - Documenti Microsoft Word
- **Testo** (.txt) - File di testo semplice
- **Markdown** (.md) - File markdown

## Risoluzione Problemi

### Errore: "ANTHROPIC_API_KEY non configurata"
- Verifica di aver modificato il file `.env` con la tua vera API key
- Riavvia il server dopo aver modificato il file `.env`

### Errore: "Impossibile estrarre testo dal file"
- Assicurati che il file contenga testo (non immagini)
- I PDF devono contenere testo selezionabile (non scansioni)
- Prova con il file `esempio-test.txt` incluso

### La porta 3000 è già in uso
- Modifica la porta nel file `.env`:
```env
PORT=3001
```

## Funzionalità Principali

### Workspace
- Crea workspace multipli per organizzare le flashcard per argomento
- Modifica nome e descrizione dei workspace
- Elimina workspace (con tutte le flashcard associate)

### Flashcard
- Generazione automatica con AI da qualsiasi documento
- Domande a risposta multipla (4 opzioni)
- Spiegazioni dettagliate per ogni risposta
- Elimina flashcard singole

### Modalità Studio
- Interfaccia dedicata per lo studio
- Naviga tra le flashcard
- Feedback immediato su risposte corrette/sbagliate
- Visualizza spiegazioni dopo aver risposto

## Sviluppo

Per sviluppo con auto-reload:

```bash
npm run dev
```

## Struttura del Progetto

```
FlashAI/
├── backend/
│   ├── server.js              # Server Express principale
│   └── services/
│       ├── aiService.js       # Integrazione Claude AI
│       └── fileProcessor.js   # Estrazione testo da file
├── frontend/
│   ├── index.html            # Interfaccia utente
│   ├── styles.css            # Stili CSS
│   └── app.js                # Logica frontend
├── data/                     # Storage JSON (generato automaticamente)
├── uploads/                  # File caricati temporaneamente
├── .env                      # Configurazione (API keys)
└── package.json              # Dipendenze

```

## Note sulla Sicurezza

- Non condividere mai la tua API key di Anthropic
- Il file `.env` è già in `.gitignore` per evitare commit accidentali
- I file caricati vengono eliminati dopo l'elaborazione

## Limiti

- Dimensione massima file: 10MB
- I file PDF devono contenere testo selezionabile
- Richiede connessione internet per l'API AI

## Supporto

Per problemi o domande, consulta:
- [Documentazione Claude API](https://docs.anthropic.com)
- [Node.js Documentation](https://nodejs.org)

Buono studio con FlashAI! 📚⚡
