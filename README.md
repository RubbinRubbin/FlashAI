# FlashAI - AI-Powered Flashcard Generator
Applicazione web intelligente per generare flashcard a risposta multipla da qualsiasi documento.

## Caratteristiche

-  Upload di file (PDF, TXT, DOCX, MD)
-  Analisi AI precisa con Claude (Anthropic)
-  Gestione workspace per organizzare per argomenti
-  Generazione automatica domande a risposta multipla
-  Salvataggio e recupero flashcard
-  Interfaccia moderna e intuitiva

## Installazione

1. Clona il repository
2. Installa le dipendenze:
```bash
npm install
```

3. Crea il file `.env` dalla template:
```bash
cp .env.example .env
```

4. Aggiungi la tua API key di Anthropic nel file `.env`

5. Avvia il server:
```bash
npm start
```

6. Apri il browser su `http://localhost:3000`

## Uso

1. Crea un nuovo workspace per un argomento di studio
2. Carica un file (PDF, documento, note)
3. L'AI analizzerà il contenuto e genererà flashcard
4. Studia con le flashcard generate
5. Gestisci i tuoi workspace e flashcard

## Tecnologie

- **Backend**: Node.js, Express
- **AI**: Claude API (Anthropic)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Storage**: JSON file-based
