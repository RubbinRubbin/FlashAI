# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FlashAI is an AI-powered flashcard generator that creates multiple-choice flashcards from uploaded documents (PDF, TXT, DOCX, MD). Built with Node.js/Express backend and vanilla JavaScript frontend, using OpenAI's GPT-4o-mini for flashcard generation. Features SM-2 spaced repetition, statistics dashboard, and quiz simulation.

## Development Commands

```bash
npm start              # Start production server on port 3000
npm run dev            # Start with nodemon for auto-reload during development
```

### Environment Setup
- Copy `.env.example` to `.env` and add `OPENAI_API_KEY`
- Uses OpenAI API (not Anthropic) — requires `OPENAI_API_KEY` in `.env`
- Default port is 3000 (configurable via `PORT` in `.env`)

## Architecture

### Backend (`backend/`)

- **`server.js`**: Express server, JSON file-based storage (`data/workspaces.json`, `data/flashcards.json`), multer file uploads, in-memory `uploadProgress` Map, progress polling endpoint. Saves `documentText` on workspace for regeneration. Includes `/regenerate` endpoint with cross-deduplication (Jaccard similarity).
- **`services/aiService.js`**: `generateFlashcardsFast()` splits text into ~3000 char chunks, generates 15-25 flashcards per batch. Uses `gpt-4o-mini` with `response_format: { type: "json_object" }`. Supports temperature override via `options` param (0.6 for regeneration vs 0.4 default).
- **`services/fileProcessor.js`**: Text extraction for PDF (pdf-parse), DOCX (mammoth), TXT/MD. `extractText()` for simple, `extractTextWithSections()` for structured extraction.

### Frontend (`frontend/`)

- **`app.js`**: Single global `state` object managing workspaces, flashcards, study/quiz modes, SRS data, and statistics. Key subsystems:
  - **SM-2 Spaced Repetition**: Per-card ease factor, intervals, repetitions stored in `localStorage` (`srs_${workspaceId}`). Cards sorted by review priority. Quality mapping: 0=wrong, 3=corrected, 5=first-try correct.
  - **Statistics Dashboard**: Tracks study/quiz sessions, card history, total time, streak, accuracy, improvement %, exam readiness score. Stored in `localStorage` (`stats_${workspaceId}`).
  - **Custom Dialogs**: `showConfirmDialog()` / `showAlertDialog()` replace all native browser dialogs with themed modals.
  - **Management Modal**: Gear icon opens modal overlay with workspace actions (view flashcards, generate more, create, edit, delete).
- **`index.html`**: Main layout with sidebar, workspace view, study/quiz shared view. Modals for workspace edit, flashcard edit, quiz config, management, confirm dialogs.
- **`styles.css`**: Dark minimal theme with CSS custom properties. Mobile-responsive.

### Data Flow

1. **Upload**: File → multer → `fileProcessor.extractText()` → save `documentText` on workspace → `aiService.generateFlashcardsFast()` → Save to `flashcards.json`
2. **Regeneration**: `POST /regenerate` → read saved `documentText` → generate with temp 0.6 → cross-deduplicate vs existing → append new unique cards
3. **Study**: Load flashcards → SRS filter (`isCardDueForReview`) → priority sort → render → update SRS on answer → record stats
4. **Quiz**: Configure (default 30min/30 questions) → timed session → themed result dialog → record quiz session stats

## Key Implementation Details

### Flashcard Structure
`{ id, workspaceId, question, options[4], correctAnswer (0-3), explanation }`

### Storage
- Server: JSON files under `data/`, uploaded files temp in `uploads/` (deleted after extraction)
- Client: `performance_${id}`, `srs_${id}`, `stats_${id}` in localStorage

### Study Mode vs Quiz Mode
- **Study**: Immediate feedback, keyboard shortcuts (1-4, Enter), SRS-filtered, edit/delete buttons
- **Quiz**: Timed (default 30min), no feedback until end, themed result summary
- Both share `renderStudyCard()` with conditional logic based on `state.quizMode.active`

### SM-2 Algorithm
- Tracks per-card: easeFactor (min 1.3), interval, repetitions, nextReview timestamp
- Quality < 3 resets repetitions; quality >= 3 increases interval exponentially
- Cards due for review: `nextReview <= now` or never reviewed

### Statistics (Exam Readiness Formula)
`(mastered*0.4 + accuracy*0.3 + coverage*0.2 + consistency*0.1) * 100`

## Common Development Tasks

When adding flashcard generation features:
- Modify `aiService.js` prompt structure (ultra-concise prompts work best with GPT-4o-mini)
- Progress callbacks receive `{ currentBatch, totalBatches, flashcardsGenerated, flashcards }`
- Always validate flashcard structure

When modifying study features:
- Update `state.studyMode` or `state.quizMode` objects
- SRS updates require `updateSRS(cardId, quality)` + `saveSRS()`
- Stats require `recordCardAnswer()` / `recordStudySession()` / `recordQuizSession()` + `saveStats()`
- Keyboard handlers in `handleStudyModeKeyPress()` must check `state.studyMode.active`

When adding UI dialogs:
- Use `showConfirmDialog(title, msg, confirmText, cancelText, isDanger)` — returns `Promise<boolean>`
- Use `showAlertDialog(title, msg, buttonText)` for info-only dialogs
- Never use native `confirm()` or `alert()`

## Limits

- Max file upload: 200MB (multer)
- Chunk size: 3000 chars
- Progress polling: 1s intervals
- PDF: Must contain selectable text (not scanned images)
