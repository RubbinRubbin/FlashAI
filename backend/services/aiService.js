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
      model: 'gpt-4o-mini',
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
      model: 'gpt-4o-mini',
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

/**
 * Genera flashcard in modo veloce con possibilità di interruzione
 * Divide il documento in chunk e genera in batch
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

    // Batch PICCOLI e VELOCI - genera più flashcard totali
    // ~3000 caratteri per chunk = tanti batch veloci
    const chunkSize = 3000;
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }

    const allFlashcards = [];

    console.log(`🚀 Generazione veloce: ${chunks.length} batch da processare`);

    for (let i = 0; i < chunks.length; i++) {
      // Check se cancellato
      if (shouldCancel && shouldCancel()) {
        console.log(`⏸️ Generazione interrotta dopo ${i} batch. Flashcards salvate: ${allFlashcards.length}`);
        break;
      }

      const chunk = chunks[i];
      // ~15-25 flashcard per batch (veloce e affidabile)
      const targetCount = Math.min(Math.floor(chunk.length / 150), 25);

      console.log(`📝 Batch ${i + 1}/${chunks.length}: target ~${targetCount} flashcard`);

      // Prompt ultra-conciso
      const prompt = `Genera ${targetCount} flashcard dal testo.

REGOLE:
- 4 opzioni (1 corretta)
- Spiegazione breve
- Domande difficili su concetti chiave

JSON: {"flashcards":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"..."}]}

TESTO:
${chunk}`;

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'system',
            content: 'Genera flashcard JSON.'
          }, {
            role: 'user',
            content: prompt
          }],
          temperature: 0.5,
          max_tokens: 2500,
          response_format: { type: "json_object" }
        });

        const responseText = response.choices[0].message.content;

        // Con response_format JSON, il contenuto è già JSON valido
        try {
          const parsedResponse = JSON.parse(responseText);
          let flashcards = parsedResponse.flashcards || parsedResponse.cards || [];

          // Valida
          flashcards = flashcards.filter(card =>
            card.question &&
            Array.isArray(card.options) &&
            card.options.length === 4 &&
            typeof card.correctAnswer === 'number' &&
            card.correctAnswer >= 0 &&
            card.correctAnswer <= 3 &&
            card.explanation
          );

          if (flashcards.length > 0) {
            allFlashcards.push(...flashcards);
            console.log(`  ✅ +${flashcards.length} flashcard (totale: ${allFlashcards.length})`);

            // Notifica progresso con flashcards parziali
            if (progressCallback) {
              progressCallback({
                currentBatch: i + 1,
                totalBatches: chunks.length,
                flashcardsGenerated: allFlashcards.length,
                flashcards: [...allFlashcards] // Copia delle flashcard generate finora
              });
            }
          } else {
            console.warn(`⚠️ Batch ${i + 1}: nessuna flashcard valida generata`);
          }
        } catch (parseError) {
          console.error(`⚠️ Errore parsing JSON batch ${i + 1}:`, parseError.message);
          console.log('Risposta ricevuta:', responseText.substring(0, 500));
        }
      } catch (error) {
        console.error(`⚠️ Errore batch ${i + 1}:`, error.message);
        // Continua con il prossimo batch
      }
    }

    console.log(`✅ Completato! Totale: ${allFlashcards.length} flashcard`);
    return allFlashcards;

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
