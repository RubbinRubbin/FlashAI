const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Genera flashcard a risposta multipla da un testo usando OpenAI
 * Analizza sezione per sezione per generare un numero massimo di flashcard
 * @param {Object} documentData - Oggetto con fullText e sections
 * @param {Function} progressCallback - Callback per aggiornamenti di progresso
 * @returns {Promise<Array>} Array di flashcard generate
 */
async function generateFlashcardsProgressive(documentData, progressCallback = null) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY non configurata. Aggiungi la tua API key nel file .env');
    }

    const { sections, totalPages } = documentData;
    const allFlashcards = [];
    let processedSections = 0;

    console.log(`📚 Inizio analisi di ${sections.length} sezioni...`);

    // Processa ogni sezione
    for (const section of sections) {
      try {
        // Check if cancelled
        if (progressCallback) {
          const shouldContinue = progressCallback({
            section: section.pageNumber,
            totalSections: sections.length,
            sectionTitle: section.title,
            status: 'processing'
          });

          if (shouldContinue === false) {
            console.log('❌ Generazione cancellata dall\'utente');
            break;
          }
        }

        console.log(`\n📖 Analizzando sezione ${section.pageNumber}/${sections.length}: "${section.title}"`);

        const sectionFlashcards = await generateFlashcardsForSection(section);

        if (sectionFlashcards && sectionFlashcards.length > 0) {
          // Aggiungi informazioni sulla sezione a ogni flashcard
          const enrichedFlashcards = sectionFlashcards.map(fc => ({
            ...fc,
            sourceSection: section.pageNumber,
            sectionTitle: section.title
          }));

          allFlashcards.push(...enrichedFlashcards);
          console.log(`   ✅ Generate ${sectionFlashcards.length} flashcard dalla sezione "${section.title}"`);
        }

        // Aggiorna progresso SEMPRE dopo ogni sezione
        if (progressCallback) {
          progressCallback({
            section: section.pageNumber,
            totalSections: sections.length,
            sectionTitle: section.title,
            flashcardsGenerated: sectionFlashcards?.length || 0,
            totalFlashcards: allFlashcards.length,
            status: 'completed'
          });
        }

        processedSections++;

        // Nessuna pausa - massima velocità

      } catch (error) {
        console.error(`⚠️  Errore nella sezione ${section.pageNumber}: ${error.message}`);
        // Continua con le altre sezioni anche se una fallisce
        if (progressCallback) {
          progressCallback({
            section: section.pageNumber,
            totalSections: sections.length,
            sectionTitle: section.title,
            status: 'error',
            error: error.message
          });
        }
      }
    }

    console.log(`\n✅ Analisi completata! Totale flashcard generate: ${allFlashcards.length}`);

    if (allFlashcards.length === 0) {
      throw new Error('Nessuna flashcard generata dal documento');
    }

    return allFlashcards;

  } catch (error) {
    console.error('Error in progressive generation:', error);
    throw error;
  }
}

/**
 * Genera flashcard per una singola sezione di testo
 */
async function generateFlashcardsForSection(section) {
  // Calcola quante flashcard generare in base alla lunghezza del testo
  const textLength = section.text.length;
  let targetFlashcards;

  if (textLength < 500) {
    targetFlashcards = '3-5'; // Sezioni piccole
  } else if (textLength < 1500) {
    targetFlashcards = '5-8'; // Sezioni medie
  } else if (textLength < 3000) {
    targetFlashcards = '8-12'; // Sezioni grandi
  } else {
    targetFlashcards = '12-15'; // Sezioni molto grandi
  }

  const prompt = `Genera ${targetFlashcards} flashcard dal testo.

REGOLE:
- 4 opzioni/domanda (1 corretta)
- Spiegazione concisa
- Varia: definizioni, applicazioni, dettagli

JSON: {"flashcards":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"..."}]}

TESTO:
${section.text}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'system',
        content: 'JSON flashcard. Veloce.'
      }, {
        role: 'user',
        content: prompt
      }],
      temperature: 0.5,
      max_tokens: 6000,
      response_format: { type: "json_object" }
    });

    const responseText = response.choices[0].message.content;
    const parsedResponse = JSON.parse(responseText);

    // Extract flashcards array
    let flashcards;
    if (Array.isArray(parsedResponse)) {
      flashcards = parsedResponse;
    } else if (parsedResponse.flashcards && Array.isArray(parsedResponse.flashcards)) {
      flashcards = parsedResponse.flashcards;
    } else if (parsedResponse.cards && Array.isArray(parsedResponse.cards)) {
      flashcards = parsedResponse.cards;
    } else {
      console.warn('Unexpected response structure for section:', parsedResponse);
      return [];
    }

    // Validate each flashcard
    const validFlashcards = flashcards.filter((card, index) => {
      const isValid = card.question &&
        Array.isArray(card.options) &&
        card.options.length === 4 &&
        typeof card.correctAnswer === 'number' &&
        card.correctAnswer >= 0 &&
        card.correctAnswer <= 3 &&
        card.explanation;

      if (!isValid) {
        console.warn(`Skipping invalid flashcard ${index + 1} in section ${section.pageNumber}`);
      }

      return isValid;
    });

    return validFlashcards;

  } catch (error) {
    console.error(`Error generating flashcards for section ${section.pageNumber}:`, error.message);
    return [];
  }
}

/**
 * Genera flashcard da testo semplice (backward compatibility)
 * @param {string} text - Il testo da analizzare
 * @returns {Promise<Array>} Array di flashcard generate
 */
async function generateFlashcards(text) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY non configurata. Aggiungi la tua API key nel file .env');
    }

    const prompt = `Sei un esperto insegnante che crea flashcard educative di alta qualità.

Analizza il seguente testo in modo MOLTO DETTAGLIATO e PRECISO, punto per punto. Per ogni concetto importante, termine tecnico, definizione, processo, o informazione chiave presente nel testo, genera una flashcard a risposta multipla.

REGOLE IMPORTANTI:
1. Crea domande che testano la comprensione profonda, non solo la memorizzazione
2. Ogni domanda deve avere esattamente 4 opzioni di risposta (A, B, C, D)
3. Solo UNA risposta deve essere corretta
4. Le risposte sbagliate devono essere plausibili ma chiaramente errate
5. Includi sempre una spiegazione dettagliata della risposta corretta
6. Copri TUTTI i concetti importanti del testo, analizzandolo punto per punto
7. Varia il tipo di domande: definizioni, applicazioni, confronti, cause-effetti, esempi
8. Le domande devono essere chiare e non ambigue

FORMATO RICHIESTO (JSON):
{
  "flashcards": [
    {
      "question": "Domanda chiara e specifica?",
      "options": ["Opzione A", "Opzione B", "Opzione C", "Opzione D"],
      "correctAnswer": 0,
      "explanation": "Spiegazione dettagliata del perché questa è la risposta corretta e perché le altre sono sbagliate."
    }
  ]
}

Il campo "correctAnswer" è l'indice (0-3) dell'opzione corretta nell'array "options".

TESTO DA ANALIZZARE:
${text}

Genera almeno 5-10 flashcard (o più se il testo è lungo) che coprono tutti i concetti chiave. Rispondi SOLO con il JSON, nient'altro.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'system',
        content: 'Sei un assistente esperto nella creazione di flashcard educative. Rispondi SEMPRE e SOLO con JSON valido, senza testo aggiuntivo.'
      }, {
        role: 'user',
        content: prompt
      }],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    });

    const responseText = response.choices[0].message.content;
    const parsedResponse = JSON.parse(responseText);

    // Extract flashcards array
    let flashcards;
    if (Array.isArray(parsedResponse)) {
      flashcards = parsedResponse;
    } else if (parsedResponse.flashcards && Array.isArray(parsedResponse.flashcards)) {
      flashcards = parsedResponse.flashcards;
    } else if (parsedResponse.cards && Array.isArray(parsedResponse.cards)) {
      flashcards = parsedResponse.cards;
    } else {
      throw new Error('Formato risposta AI non riconosciuto');
    }

    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      throw new Error('Nessuna flashcard generata');
    }

    // Validate each flashcard
    flashcards.forEach((card, index) => {
      if (!card.question || !Array.isArray(card.options) || card.options.length !== 4 ||
          typeof card.correctAnswer !== 'number' || !card.explanation) {
        throw new Error(`Flashcard ${index + 1} ha un formato non valido`);
      }

      if (card.correctAnswer < 0 || card.correctAnswer > 3) {
        throw new Error(`Flashcard ${index + 1} ha un indice di risposta corretta non valido`);
      }
    });

    console.log(`✅ Generati ${flashcards.length} flashcard con successo`);
    return flashcards;

  } catch (error) {
    console.error('Error generating flashcards:', error);

    if (error.message.includes('API key')) {
      throw new Error('Errore di autenticazione API. Verifica la tua OPENAI_API_KEY nel file .env');
    }

    if (error.code === 'invalid_api_key') {
      throw new Error('API key OpenAI non valida. Verifica la tua chiave nel file .env');
    }

    throw new Error(`Errore nella generazione delle flashcard: ${error.message}`);
  }
}

// --- Configurazione (sovrascrivibile via .env) ---
const CONFIG = {
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  chunkSize: parseInt(process.env.CHUNK_SIZE) || 5000,
  maxFlashcardsPerChunk: parseInt(process.env.MAX_FLASHCARDS_PER_CHUNK) || 15,
  concurrency: parseInt(process.env.PARALLEL_CONCURRENCY) || 5,
  temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.4,
  chunkOverlap: 200,
};

/**
 * Divide il testo in chunk rispettando i confini dei paragrafi
 */
function splitIntoChunks(text, targetSize, overlap) {
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length > targetSize && current.length > 0) {
      chunks.push(current.trim());
      // Overlap: prendi la fine del chunk precedente come inizio del prossimo
      const overlapText = current.slice(-overlap);
      current = overlapText + '\n\n' + para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/**
 * Deduplicazione flashcard tramite Jaccard similarity sulle parole della domanda
 */
function deduplicateFlashcards(flashcards) {
  const threshold = 0.7;

  function getWords(text) {
    return new Set(text.toLowerCase().replace(/[^\w\sàèéìòùáéíóú]/g, '').split(/\s+/).filter(w => w.length > 2));
  }

  function jaccardSimilarity(setA, setB) {
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  const kept = [];
  const questionWords = [];

  for (const card of flashcards) {
    const words = getWords(card.question);
    let isDuplicate = false;

    for (const existingWords of questionWords) {
      if (jaccardSimilarity(words, existingWords) > threshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      kept.push(card);
      questionWords.push(words);
    }
  }

  return kept;
}

/**
 * Genera flashcard in modo veloce con processing parallelo e deduplicazione
 * @param {string} text - Il testo completo del documento
 * @param {Function} progressCallback - Callback per aggiornamenti (include flashcards parziali)
 * @param {Function} shouldCancel - Funzione che ritorna true se cancellato
 * @returns {Promise<Array>} Array di flashcard generate
 */
async function generateFlashcardsFast(text, progressCallback = null, shouldCancel = null) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY non configurata');
    }

    const { model, chunkSize, maxFlashcardsPerChunk, concurrency, temperature, chunkOverlap } = CONFIG;

    // Chunking intelligente per paragrafi con overlap
    const chunks = splitIntoChunks(text, chunkSize, chunkOverlap);
    const allFlashcards = [];
    let completedBatches = 0;
    let cancelled = false;

    console.log(`🚀 Generazione: ${chunks.length} batch, ${concurrency} paralleli, modello: ${model}`);

    // Funzione per processare un singolo chunk
    async function processChunk(chunk, index) {
      const targetCount = Math.max(5, Math.min(Math.floor(chunk.length / 500), maxFlashcardsPerChunk));

      const prompt = `Analizza il testo e genera circa ${targetCount} flashcard a risposta multipla IN ITALIANO.

REGOLE:
- 4 opzioni per domanda (1 corretta, 3 plausibili ma errate)
- Spiegazione concisa della risposta corretta
- Varia difficoltà: facile (definizioni), medio (applicazioni), difficile (analisi/confronti)
- Ogni flashcard deve testare un concetto DIVERSO
- Se il testo non contiene abbastanza concetti, genera MENO flashcard

FORMATO JSON:
{"flashcards":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","difficulty":"easy|medium|hard"}]}

TESTO:
${chunk}`;

      const response = await openai.chat.completions.create({
        model,
        messages: [{
          role: 'system',
          content: 'Genera flashcard educative in italiano. Rispondi SOLO con JSON valido.'
        }, {
          role: 'user',
          content: prompt
        }],
        temperature,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      });

      const parsed = JSON.parse(response.choices[0].message.content);
      let flashcards = parsed.flashcards || parsed.cards || [];

      // Valida struttura
      flashcards = flashcards.filter(card =>
        card.question &&
        Array.isArray(card.options) &&
        card.options.length === 4 &&
        typeof card.correctAnswer === 'number' &&
        card.correctAnswer >= 0 &&
        card.correctAnswer <= 3 &&
        card.explanation
      );

      return flashcards;
    }

    // Processing parallelo con pool di worker
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < chunks.length && !cancelled) {
        if (shouldCancel && shouldCancel()) {
          cancelled = true;
          break;
        }

        const idx = nextIndex++;
        try {
          const flashcards = await processChunk(chunks[idx], idx);

          if (flashcards.length > 0) {
            allFlashcards.push(...flashcards);
            console.log(`  ✅ Batch ${idx + 1}: +${flashcards.length} flashcard (totale: ${allFlashcards.length})`);
          }
        } catch (error) {
          console.error(`⚠️ Errore batch ${idx + 1}:`, error.message);
        }

        completedBatches++;

        // Notifica progresso
        if (progressCallback) {
          progressCallback({
            currentBatch: completedBatches,
            totalBatches: chunks.length,
            flashcardsGenerated: allFlashcards.length,
            flashcards: [...allFlashcards]
          });
        }
      }
    }

    // Lancia N worker paralleli
    const workers = Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker());
    await Promise.all(workers);

    if (cancelled) {
      console.log(`⏸️ Interrotto dopo ${completedBatches} batch. Flashcards: ${allFlashcards.length}`);
    }

    // Deduplicazione
    const before = allFlashcards.length;
    const deduplicated = deduplicateFlashcards(allFlashcards);
    if (before !== deduplicated.length) {
      console.log(`🔄 Deduplicazione: ${before} → ${deduplicated.length} flashcard (-${before - deduplicated.length} duplicati)`);
    }

    console.log(`✅ Completato! Totale: ${deduplicated.length} flashcard`);
    return deduplicated;

  } catch (error) {
    console.error('Error in fast generation:', error);
    throw new Error(`Errore generazione veloce: ${error.message}`);
  }
}

module.exports = {
  generateFlashcards,
  generateFlashcardsProgressive,
  generateFlashcardsFast
};
