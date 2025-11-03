# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FlashAI is an AI-powered flashcard generator that creates multiple-choice flashcards from uploaded documents (PDF, TXT, DOCX, MD). Built with Node.js/Express backend and vanilla JavaScript frontend, using OpenAI's GPT-4o-mini for flashcard generation.

## Development Commands

### Running the Application
```bash
npm start              # Start production server on port 3000
npm run dev            # Start with nodemon for auto-reload during development
```

### Environment Setup
- Copy `.env.example` to `.env` and add `OPENAI_API_KEY`
- The app requires an OpenAI API key (not Anthropic, despite the documentation mentioning Claude)
- Default port is 3000 (configurable via `PORT` in `.env`)

## Architecture

### Backend Structure (`backend/`)

**Main Server** (`server.js`):
- Express server with JSON file-based storage (no database)
- Two data files: `data/workspaces.json` and `data/flashcards.json`
- Global `uploadProgress` Map tracks real-time generation progress per workspace
- File uploads handled by multer, saved to `uploads/` directory (temporary, deleted after processing)
- Progress polling endpoint: `GET /api/workspaces/:id/upload/progress` (polled every 1s by frontend)

**AI Service** (`services/aiService.js`):
- **Primary method**: `generateFlashcardsFast()` - splits document into ~3000 char chunks, generates 15-25 flashcards per batch
- Uses OpenAI `gpt-4o-mini` model with `response_format: { type: "json_object" }` for reliable JSON parsing
- Supports progress callbacks and cancellation via `shouldCancel()` function
- Legacy methods: `generateFlashcards()` (backward compatibility), `generateFlashcardsProgressive()` (section-based)

**File Processor** (`services/fileProcessor.js`):
- `extractText()`: Main entry point for simple text extraction
- `extractTextWithSections()`: Returns structured data with sections/pages (used for progressive generation)
- Supports: PDF (pdf-parse), DOCX (mammoth), TXT/MD (direct read)
- `cleanText()`: Normalizes whitespace, removes control characters, limits consecutive newlines

### Frontend Structure (`frontend/`)

**State Management** (`app.js`):
- Single global `state` object with nested structures:
  - `workspaces`, `currentWorkspace`, `currentFlashcards`
  - `uploadProgress`: tracks active uploads with real-time batch/flashcard counts
  - `studyMode`: manages study session state (current index, correct/incorrect tracking)
  - `quizMode`: timed quiz with hidden answers until completion
  - `performance`: tracks correct/incorrect/correctFirstAttempt per workspace (localStorage persistence)

**Key Features**:
- **Study Mode**: Navigate flashcards, keyboard shortcuts (1-4 for answers, Enter to advance), excludes cards correct on first attempt
- **Quiz Mode**: Timed mode, hides answers until quiz ends, auto-advances, shows summary at end
- **Performance Tracking**: Per-workspace localStorage storage, tracks first-attempt correctness to hide mastered cards
- **Real-time Progress**: 1-second polling during upload shows batch progress, flashcard count, estimated time remaining

### Data Flow

1. **Upload**: File → multer → `fileProcessor.extractText()` → `aiService.generateFlashcardsFast()` → Save to `flashcards.json`
2. **Progress**: Backend updates `uploadProgress` Map → Frontend polls every 1s → Updates UI with batch/flashcard counts
3. **Cancellation**: Frontend sets `cancelled: true` → Backend checks `shouldCancel()` between batches → Returns partial flashcards
4. **Study**: Load flashcards → Filter out `correctFirstAttempt` → Render with keyboard navigation → Update performance → Save to localStorage

## Important Implementation Details

### API Key Configuration
- Despite README mentioning Anthropic/Claude, the app **actually uses OpenAI** (`aiService.js:3-5`)
- Requires `OPENAI_API_KEY` in `.env`, not `ANTHROPIC_API_KEY`
- Uses `gpt-4o-mini` model for cost-effective flashcard generation

### Flashcard Generation Strategy
- Documents split into ~3000 character chunks for optimal balance of speed and quality
- Each chunk targets 15-25 flashcards based on length (`chunk.length / 150`)
- Batch processing with progress callbacks allows cancellation and partial saves
- JSON response format enforced via OpenAI's `response_format` parameter (more reliable than prompt-only)

### File Storage
- No database - all data in JSON files under `data/`
- Uploaded files temporarily stored in `uploads/`, deleted after text extraction
- Workspaces have UUID identifiers, flashcards linked via `workspaceId` foreign key
- Performance data stored in browser localStorage: `performance_${workspaceId}`

### Study Mode vs Quiz Mode
- **Study Mode**: Immediate feedback, keyboard shortcuts, excludes mastered cards, includes Edit/Delete buttons
- **Quiz Mode**: Timed, no feedback until end, auto-advance, shows final summary alert
- Both share same rendering code (`renderStudyCard()`) with conditional logic based on `state.quizMode.active`

### Progress Tracking Implementation
- Backend maintains in-memory Map (lost on restart - acceptable for temporary upload progress)
- Frontend polls every 1 second during active uploads
- Shows: batch number, total batches, flashcards generated, estimated time remaining
- Cancel button sets `cancelled: true`, AI service checks between batches and saves partial results

## Common Development Tasks

When adding flashcard generation features:
- Modify `aiService.js` prompt structure (ultra-concise prompts work best with GPT-4o-mini)
- Progress callbacks receive `{ currentBatch, totalBatches, flashcardsGenerated, flashcards }` object
- Always validate flashcard structure: `{ question, options[4], correctAnswer (0-3), explanation }`

When modifying study features:
- Update `state.studyMode` or `state.quizMode` objects
- Performance tracking requires both in-memory updates and `savePerformance()` call
- Keyboard event handlers in `handleStudyModeKeyPress()` must check `state.studyMode.active`

When changing file processing:
- Update supported extensions in both `server.js` (multer filter) and `fileProcessor.js`
- New file types need extraction logic in `extractText()` switch statement
- Consider section-based extraction for structured documents

## File Size and Performance Limits

- Maximum file upload: 10MB (enforced by multer)
- Chunk size: 3000 characters (balance between API calls and quality)
- Progress polling: 1 second intervals (balance between responsiveness and server load)
- PDF requirements: Must contain selectable text (not scanned images)
