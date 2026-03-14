const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const aiService = require('./services/aiService');
const fileProcessor = require('./services/fileProcessor');

const app = express();
const PORT = process.env.PORT || 3000;

// Global progress tracking
const uploadProgress = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit - supporta PDF grandi
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.txt', '.docx', '.md', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo file non supportato. Usa PDF, TXT, DOCX o MD'));
    }
  }
});

// Data storage paths
const DATA_DIR = path.join(__dirname, '../data');
const WORKSPACES_FILE = path.join(DATA_DIR, 'workspaces.json');
const FLASHCARDS_FILE = path.join(DATA_DIR, 'flashcards.json');

// Initialize data files
async function initializeDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(WORKSPACES_FILE);
  } catch {
    await fs.writeFile(WORKSPACES_FILE, JSON.stringify([]));
  }

  try {
    await fs.access(FLASHCARDS_FILE);
  } catch {
    await fs.writeFile(FLASHCARDS_FILE, JSON.stringify([]));
  }
}

// Helper functions for data persistence
async function readWorkspaces() {
  const data = await fs.readFile(WORKSPACES_FILE, 'utf-8');
  return JSON.parse(data);
}

async function writeWorkspaces(workspaces) {
  await fs.writeFile(WORKSPACES_FILE, JSON.stringify(workspaces, null, 2));
}

async function readFlashcards() {
  const data = await fs.readFile(FLASHCARDS_FILE, 'utf-8');
  return JSON.parse(data);
}

async function writeFlashcards(flashcards) {
  await fs.writeFile(FLASHCARDS_FILE, JSON.stringify(flashcards, null, 2));
}

// API Routes

// Get all workspaces
app.get('/api/workspaces', async (req, res) => {
  try {
    const workspaces = await readWorkspaces();
    res.json(workspaces);
  } catch (error) {
    console.error('Error reading workspaces:', error);
    res.status(500).json({ error: 'Errore nel caricamento dei workspace' });
  }
});

// Create new workspace
app.post('/api/workspaces', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome workspace richiesto' });
    }

    const workspaces = await readWorkspaces();
    const newWorkspace = {
      id: uuidv4(),
      name,
      description: description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    workspaces.push(newWorkspace);
    await writeWorkspaces(workspaces);

    res.json(newWorkspace);
  } catch (error) {
    console.error('Error creating workspace:', error);
    res.status(500).json({ error: 'Errore nella creazione del workspace' });
  }
});

// Update workspace
app.put('/api/workspaces/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const workspaces = await readWorkspaces();
    const index = workspaces.findIndex(w => w.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Workspace non trovato' });
    }

    workspaces[index] = {
      ...workspaces[index],
      name: name || workspaces[index].name,
      description: description !== undefined ? description : workspaces[index].description,
      updatedAt: new Date().toISOString()
    };

    await writeWorkspaces(workspaces);
    res.json(workspaces[index]);
  } catch (error) {
    console.error('Error updating workspace:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento del workspace' });
  }
});

// Delete workspace
app.delete('/api/workspaces/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const workspaces = await readWorkspaces();
    const filteredWorkspaces = workspaces.filter(w => w.id !== id);

    if (workspaces.length === filteredWorkspaces.length) {
      return res.status(404).json({ error: 'Workspace non trovato' });
    }

    await writeWorkspaces(filteredWorkspaces);

    // Delete associated flashcards
    const flashcards = await readFlashcards();
    const filteredFlashcards = flashcards.filter(f => f.workspaceId !== id);
    await writeFlashcards(filteredFlashcards);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione del workspace' });
  }
});

// Get flashcards for a workspace
app.get('/api/workspaces/:id/flashcards', async (req, res) => {
  try {
    const { id } = req.params;
    const flashcards = await readFlashcards();
    const workspaceFlashcards = flashcards.filter(f => f.workspaceId === id);
    res.json(workspaceFlashcards);
  } catch (error) {
    console.error('Error reading flashcards:', error);
    res.status(500).json({ error: 'Errore nel caricamento delle flashcard' });
  }
});

// Delete all flashcards for a workspace
app.delete('/api/workspaces/:id/flashcards', async (req, res) => {
  try {
    const { id } = req.params;

    const flashcards = await readFlashcards();
    const filteredFlashcards = flashcards.filter(f => f.workspaceId !== id);
    await writeFlashcards(filteredFlashcards);

    res.json({ success: true, deletedCount: flashcards.length - filteredFlashcards.length });
  } catch (error) {
    console.error('Error deleting flashcards:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione delle flashcard' });
  }
});

// Get upload progress
app.get('/api/workspaces/:id/upload/progress', (req, res) => {
  const { id } = req.params;
  const progress = uploadProgress.get(id) || {
    active: false,
    currentSection: 0,
    totalSections: 0,
    flashcardsGenerated: 0,
    startTime: null
  };
  res.json(progress);
});

// Cancel upload
app.post('/api/workspaces/:id/upload/cancel', (req, res) => {
  const { id } = req.params;
  const progress = uploadProgress.get(id);

  if (progress) {
    progress.cancelled = true;
    uploadProgress.set(id, progress);
  }

  res.json({ success: true });
});

// Upload file and generate flashcards
app.post('/api/workspaces/:id/upload', upload.single('file'), async (req, res) => {
  // Timeout esteso per documenti grandi (30 minuti)
  req.setTimeout(30 * 60 * 1000);
  res.setTimeout(30 * 60 * 1000);
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    // Verify workspace exists
    const workspaces = await readWorkspaces();
    const workspace = workspaces.find(w => w.id === id);

    if (!workspace) {
      await fs.unlink(file.path); // Clean up uploaded file
      return res.status(404).json({ error: 'Workspace non trovato' });
    }

    // Extract text
    console.log('Processing file:', file.originalname);
    const text = await fileProcessor.extractText(file.path, file.mimetype);

    if (!text || text.trim().length === 0) {
      await fs.unlink(file.path);
      return res.status(400).json({ error: 'Impossibile estrarre testo dal file' });
    }

    console.log(`📄 Documento: ${text.length} caratteri`);

    // Initialize progress tracking
    const startTime = new Date();
    uploadProgress.set(id, {
      active: true,
      currentBatch: 0,
      totalBatches: 1,
      flashcardsGenerated: 0,
      startTime: startTime,
      cancelled: false,
      status: 'processing'
    });

    // Generate flashcards using fast method with callbacks
    console.log('🚀 Generazione veloce con AI...');

    let partialFlashcards = [];

    const generatedFlashcards = await aiService.generateFlashcardsFast(
      text,
      // Progress callback - aggiorna progresso e salva flashcard parziali
      (progress) => {
        partialFlashcards = progress.flashcards || [];
        uploadProgress.set(id, {
          active: true,
          currentBatch: progress.currentBatch,
          totalBatches: progress.totalBatches,
          flashcardsGenerated: progress.flashcardsGenerated,
          startTime: startTime,
          cancelled: uploadProgress.get(id)?.cancelled || false,
          status: 'processing'
        });
      },
      // Should cancel callback
      () => uploadProgress.get(id)?.cancelled === true
    );

    // Usa le flashcard generate (o parziali se cancellato)
    const flashcardsToSave = generatedFlashcards.length > 0 ? generatedFlashcards : partialFlashcards;

    if (flashcardsToSave.length === 0) {
      await fs.unlink(file.path);
      uploadProgress.delete(id);
      return res.status(400).json({ error: 'Nessuna flashcard generata' });
    }

    // Save flashcards
    const flashcards = await readFlashcards();
    const newFlashcards = flashcardsToSave.map(fc => ({
      id: uuidv4(),
      workspaceId: id,
      question: fc.question,
      options: fc.options,
      correctAnswer: fc.correctAnswer,
      explanation: fc.explanation,
      createdAt: new Date().toISOString()
    }));

    flashcards.push(...newFlashcards);
    await writeFlashcards(flashcards);

    // Update workspace timestamp
    workspace.updatedAt = new Date().toISOString();
    await writeWorkspaces(workspaces);

    // Clean up temporary uploaded file
    await fs.unlink(file.path);

    const wasCancelled = uploadProgress.get(id)?.cancelled === true;

    // Mark as completed
    uploadProgress.set(id, {
      active: false,
      currentBatch: uploadProgress.get(id)?.totalBatches || 1,
      totalBatches: uploadProgress.get(id)?.totalBatches || 1,
      flashcardsGenerated: newFlashcards.length,
      startTime: startTime,
      status: wasCancelled ? 'cancelled' : 'completed'
    });

    res.json({
      success: true,
      flashcardsGenerated: newFlashcards.length,
      flashcards: newFlashcards
    });

  } catch (error) {
    console.error('Error processing file:', error);

    // Clean up file if exists
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }

    res.status(500).json({
      error: 'Errore nel processare il file',
      details: error.message
    });
  }
});

// Update flashcard
// Create flashcard
app.post('/api/workspaces/:workspaceId/flashcards', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { question, options, correctAnswer, explanation } = req.body;

    // Validazione
    if (!question || !Array.isArray(options) || options.length !== 4 ||
        typeof correctAnswer !== 'number' || correctAnswer < 0 || correctAnswer > 3 ||
        !explanation) {
      return res.status(400).json({ error: 'Dati flashcard non validi' });
    }

    const flashcards = await readFlashcards();

    // Crea nuova flashcard
    const newFlashcard = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      workspaceId,
      question,
      options,
      correctAnswer,
      explanation,
      createdAt: new Date().toISOString()
    };

    flashcards.push(newFlashcard);
    await writeFlashcards(flashcards);

    res.json(newFlashcard);
  } catch (error) {
    console.error('Error creating flashcard:', error);
    res.status(500).json({ error: 'Errore nella creazione della flashcard' });
  }
});

app.put('/api/flashcards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { question, options, correctAnswer, explanation } = req.body;

    // Validazione
    if (!question || !Array.isArray(options) || options.length !== 4 ||
        typeof correctAnswer !== 'number' || correctAnswer < 0 || correctAnswer > 3 ||
        !explanation) {
      return res.status(400).json({ error: 'Dati flashcard non validi' });
    }

    const flashcards = await readFlashcards();
    const flashcard = flashcards.find(f => f.id === id);

    if (!flashcard) {
      return res.status(404).json({ error: 'Flashcard non trovata' });
    }

    // Aggiorna i campi
    flashcard.question = question;
    flashcard.options = options;
    flashcard.correctAnswer = correctAnswer;
    flashcard.explanation = explanation;

    await writeFlashcards(flashcards);

    res.json(flashcard);
  } catch (error) {
    console.error('Error updating flashcard:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento della flashcard' });
  }
});

// Delete flashcard
app.delete('/api/flashcards/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const flashcards = await readFlashcards();
    const filteredFlashcards = flashcards.filter(f => f.id !== id);

    if (flashcards.length === filteredFlashcards.length) {
      return res.status(404).json({ error: 'Flashcard non trovata' });
    }

    await writeFlashcards(filteredFlashcards);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting flashcard:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione della flashcard' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Errore del server',
    message: error.message
  });
});

// Start server
async function startServer() {
  await initializeDataFiles();

  app.listen(PORT, () => {
    console.log(`🚀 FlashAI server running on http://localhost:${PORT}`);
    console.log(`📚 Upload your documents to generate AI-powered flashcards!`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
