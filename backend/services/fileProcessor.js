const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Estrae il testo da un file basandosi sul suo tipo MIME
 * @param {string} filePath - Percorso del file
 * @param {string} mimeType - Tipo MIME del file
 * @returns {Promise<string>} Testo estratto
 */
async function extractText(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase();

  try {
    switch (ext) {
      case '.pdf':
        return await extractFromPDF(filePath);

      case '.docx':
      case '.doc':
        return await extractFromDOCX(filePath);

      case '.txt':
      case '.md':
        return await extractFromText(filePath);

      default:
        throw new Error(`Tipo file non supportato: ${ext}`);
    }
  } catch (error) {
    console.error(`Error extracting text from ${ext}:`, error);
    throw new Error(`Impossibile estrarre testo dal file: ${error.message}`);
  }
}

/**
 * Estrae testo da file PDF con informazioni per pagina
 * @param {string} filePath - Percorso del file PDF
 * @returns {Promise<Object>} Oggetto con testo totale e sezioni
 */
async function extractTextWithSections(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  try {
    switch (ext) {
      case '.pdf':
        return await extractFromPDFWithPages(filePath);

      case '.docx':
      case '.doc':
        return await extractFromDOCXWithSections(filePath);

      case '.txt':
      case '.md':
        return await extractFromTextWithSections(filePath);

      default:
        throw new Error(`Tipo file non supportato: ${ext}`);
    }
  } catch (error) {
    console.error(`Error extracting text from ${ext}:`, error);
    throw new Error(`Impossibile estrarre testo dal file: ${error.message}`);
  }
}

/**
 * Estrae testo da PDF con informazioni per pagina
 */
async function extractFromPDFWithPages(filePath) {
  const dataBuffer = await fs.readFile(filePath);

  // Estrai il testo completo
  const data = await pdfParse(dataBuffer);

  if (!data.text || data.text.trim().length === 0) {
    throw new Error('Il PDF non contiene testo estraibile');
  }

  const fullText = cleanText(data.text);
  const numPages = data.numpages;

  // Dividi il testo in sezioni approssimative (basato su lunghezza)
  const sections = splitTextIntoSections(fullText, numPages);

  return {
    fullText,
    sections,
    totalPages: numPages,
    fileType: 'pdf'
  };
}

/**
 * Estrae testo da DOCX con sezioni
 */
async function extractFromDOCXWithSections(filePath) {
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });

  if (!result.value || result.value.trim().length === 0) {
    throw new Error('Il documento non contiene testo estraibile');
  }

  const fullText = cleanText(result.value);

  // Dividi in sezioni basandoti su paragrafi o titoli
  const sections = splitTextByParagraphs(fullText);

  return {
    fullText,
    sections,
    totalPages: sections.length,
    fileType: 'docx'
  };
}

/**
 * Estrae testo da file di testo con sezioni
 */
async function extractFromTextWithSections(filePath) {
  const text = await fs.readFile(filePath, 'utf-8');

  if (!text || text.trim().length === 0) {
    throw new Error('Il file di testo è vuoto');
  }

  const fullText = cleanText(text);
  const sections = splitTextByParagraphs(fullText);

  return {
    fullText,
    sections,
    totalPages: sections.length,
    fileType: 'text'
  };
}

/**
 * Divide il testo in sezioni approssimative per numero di pagine
 */
function splitTextIntoSections(text, numPages) {
  const charsPerPage = Math.ceil(text.length / numPages);
  const sections = [];

  for (let i = 0; i < numPages; i++) {
    const start = i * charsPerPage;
    const end = Math.min((i + 1) * charsPerPage, text.length);

    let sectionText = text.substring(start, end);

    // Cerca di spezzare su un punto/a capo per non tagliare frasi
    if (end < text.length) {
      const lastNewline = sectionText.lastIndexOf('\n');
      const lastPeriod = sectionText.lastIndexOf('. ');
      const breakPoint = Math.max(lastNewline, lastPeriod);

      if (breakPoint > sectionText.length * 0.7) {
        sectionText = sectionText.substring(0, breakPoint + 1);
      }
    }

    sections.push({
      pageNumber: i + 1,
      text: sectionText.trim(),
      title: extractSectionTitle(sectionText)
    });
  }

  return sections;
}

/**
 * Divide il testo in paragrafi/sezioni logiche
 */
function splitTextByParagraphs(text) {
  // Dividi in blocchi basandoti su titoli o paragrafi vuoti
  const paragraphs = text.split(/\n\n+/);
  const sections = [];
  const CHARS_PER_SECTION = 3000; // ~1 pagina di testo

  let currentSection = '';
  let sectionNumber = 1;

  for (const para of paragraphs) {
    if (currentSection.length + para.length > CHARS_PER_SECTION && currentSection.length > 0) {
      sections.push({
        pageNumber: sectionNumber,
        text: currentSection.trim(),
        title: extractSectionTitle(currentSection)
      });
      sectionNumber++;
      currentSection = para;
    } else {
      currentSection += (currentSection ? '\n\n' : '') + para;
    }
  }

  // Aggiungi l'ultima sezione
  if (currentSection.trim()) {
    sections.push({
      pageNumber: sectionNumber,
      text: currentSection.trim(),
      title: extractSectionTitle(currentSection)
    });
  }

  return sections;
}

/**
 * Estrae un titolo dalla sezione (prime parole o titolo rilevato)
 */
function extractSectionTitle(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return 'Sezione senza titolo';

  // Prendi la prima riga non vuota (probabilmente un titolo)
  const firstLine = lines[0].trim();

  // Se è corta e in maiuscolo, probabilmente è un titolo
  if (firstLine.length < 100) {
    return firstLine;
  }

  // Altrimenti prendi le prime parole
  const words = firstLine.split(' ').slice(0, 8).join(' ');
  return words + (firstLine.length > words.length ? '...' : '');
}

/**
 * Estrae testo da file PDF (metodo semplice per compatibilità)
 */
async function extractFromPDF(filePath) {
  const dataBuffer = await fs.readFile(filePath);
  const data = await pdfParse(dataBuffer);

  if (!data.text || data.text.trim().length === 0) {
    throw new Error('Il PDF non contiene testo estraibile');
  }

  return cleanText(data.text);
}

/**
 * Estrae testo da file DOCX
 */
async function extractFromDOCX(filePath) {
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });

  if (!result.value || result.value.trim().length === 0) {
    throw new Error('Il documento non contiene testo estraibile');
  }

  return cleanText(result.value);
}

/**
 * Estrae testo da file di testo normale
 */
async function extractFromText(filePath) {
  const text = await fs.readFile(filePath, 'utf-8');

  if (!text || text.trim().length === 0) {
    throw new Error('Il file di testo è vuoto');
  }

  return cleanText(text);
}

/**
 * Pulisce e normalizza il testo estratto
 */
function cleanText(text) {
  return text
    // Rimuovi caratteri di controllo ma mantieni newline e tab
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    // Normalizza spazi multipli
    .replace(/[ \t]+/g, ' ')
    // Normalizza newline multiple (max 2)
    .replace(/\n{3,}/g, '\n\n')
    // Rimuovi spazi a inizio/fine riga
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    // Trim generale
    .trim();
}

/**
 * Salva una copia del file caricato per visualizzazione
 */
async function saveFileForViewing(sourcePath, workspaceId, originalName) {
  const uploadsDir = path.join(__dirname, '../../uploads');
  const fileName = `${workspaceId}-${Date.now()}-${originalName}`;
  const destPath = path.join(uploadsDir, fileName);

  await fs.copyFile(sourcePath, destPath);

  return {
    fileName,
    filePath: destPath,
    viewUrl: `/uploads/${fileName}`
  };
}

/**
 * Verifica se un file è supportato
 */
function isSupportedFile(filename) {
  const supportedExtensions = ['.pdf', '.txt', '.docx', '.doc', '.md'];
  const ext = path.extname(filename).toLowerCase();
  return supportedExtensions.includes(ext);
}

/**
 * Ottieni informazioni sul file
 */
async function getFileInfo(filePath) {
  const stats = await fs.stat(filePath);
  const ext = path.extname(filePath).toLowerCase();

  return {
    size: stats.size,
    extension: ext,
    isSupported: isSupportedFile(filePath),
    modified: stats.mtime
  };
}

module.exports = {
  extractText,
  extractTextWithSections,
  saveFileForViewing,
  isSupportedFile,
  getFileInfo,
  cleanText
};
