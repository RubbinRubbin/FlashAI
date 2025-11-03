// State Management
const state = {
    workspaces: [],
    currentWorkspace: null,
    currentFlashcards: [],
    currentDocument: null,
    isEditMode: false,
    uploadProgress: {
        active: false,
        currentSection: 0,
        totalSections: 0,
        flashcardsGenerated: 0,
        startTime: null
    },
    studyMode: {
        active: false,
        currentIndex: 0,
        flashcards: [],
        correctAnswers: new Set(),
        incorrectAnswers: new Set(),
        lastIncorrectReview: null
    },
    quizMode: {
        active: false,
        duration: 0,
        startTime: null,
        endTime: null,
        timerInterval: null,
        answers: [] // Salva tutte le risposte per mostrarle alla fine
    },
    performance: {
        correct: [],
        incorrect: [],
        correctFirstAttempt: [] // Flashcard corrette al primo tentativo - non riproporle
    }
};

// API Configuration
const API_BASE = '/api';

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadWorkspaces();
});

// Event Listeners
function initializeEventListeners() {
    // Workspace management
    document.getElementById('newWorkspaceBtn').addEventListener('click', () => openWorkspaceModal(false));
    document.getElementById('editWorkspaceBtn').addEventListener('click', () => openWorkspaceModal(true));
    document.getElementById('deleteWorkspaceBtn').addEventListener('click', deleteCurrentWorkspace);

    // Modal
    document.getElementById('closeModalBtn').addEventListener('click', closeWorkspaceModal);
    document.getElementById('cancelModalBtn').addEventListener('click', closeWorkspaceModal);
    document.getElementById('saveWorkspaceBtn').addEventListener('click', saveWorkspace);

    // File upload
    const fileInput = document.getElementById('fileInput');
    const uploadDocumentBtn = document.getElementById('uploadDocumentBtn');
    const viewFlashcardsBtn = document.getElementById('viewFlashcardsBtn');

    if (uploadDocumentBtn) {
        uploadDocumentBtn.addEventListener('click', () => {
            fileInput.click();
        });
    }

    if (viewFlashcardsBtn) {
        viewFlashcardsBtn.addEventListener('click', toggleFlashcardsView);
    }

    fileInput.addEventListener('change', handleFileSelect);

    // Cancel upload
    document.getElementById('cancelUploadBtn').addEventListener('click', cancelUpload);

    // Flashcard actions
    document.getElementById('regenerateFlashcardsBtn').addEventListener('click', regenerateFlashcards);
    document.getElementById('restartStudyBtn').addEventListener('click', restartStudy);
    document.getElementById('deleteAllFlashcardsBtn').addEventListener('click', deleteAllFlashcards);

    // Study mode
    document.getElementById('studyModeBtn').addEventListener('click', enterStudyMode);
    document.getElementById('exitStudyBtn').addEventListener('click', exitStudyMode);
    document.getElementById('prevCardBtn').addEventListener('click', () => navigateStudyCard(-1));
    document.getElementById('nextCardBtn').addEventListener('click', () => navigateStudyCard(1));

    // Quiz mode
    document.getElementById('quizModeBtn').addEventListener('click', openQuizModal);
    document.getElementById('closeQuizModalBtn').addEventListener('click', closeQuizModal);
    document.getElementById('cancelQuizBtn').addEventListener('click', closeQuizModal);
    document.getElementById('startQuizBtn').addEventListener('click', startQuizMode);

    // Create new flashcard
    document.getElementById('createFlashcardBtn').addEventListener('click', createNewFlashcard);

    // Close modal on outside click
    document.getElementById('workspaceModal').addEventListener('click', (e) => {
        if (e.target.id === 'workspaceModal') {
            closeWorkspaceModal();
        }
    });

    document.getElementById('quizModal').addEventListener('click', (e) => {
        if (e.target.id === 'quizModal') {
            closeQuizModal();
        }
    });
}

// API Calls
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Errore del server');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Workspace Management
async function loadWorkspaces() {
    try {
        state.workspaces = await apiCall('/workspaces');
        renderWorkspaceList();

        if (state.workspaces.length === 0) {
            showWelcomeScreen();
        }
    } catch (error) {
        showToast('Errore nel caricamento dei workspace', 'error');
    }
}

function renderWorkspaceList() {
    const listEl = document.getElementById('workspaceList');

    if (state.workspaces.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><p>Nessun workspace. Creane uno!</p></div>';
        return;
    }

    listEl.innerHTML = state.workspaces.map(ws => `
        <div class="workspace-item ${state.currentWorkspace?.id === ws.id ? 'active' : ''}"
             onclick="selectWorkspace('${ws.id}')">
            <h3>${escapeHtml(ws.name)}</h3>
            <p>${escapeHtml(ws.description || 'Nessuna descrizione')}</p>
        </div>
    `).join('');
}

async function selectWorkspace(workspaceId) {
    const workspace = state.workspaces.find(ws => ws.id === workspaceId);
    if (!workspace) return;

    state.currentWorkspace = workspace;
    await loadFlashcards(workspaceId);
    loadPerformance();
    showWorkspaceView();
    renderWorkspaceList();
    startIncorrectReviewTimer();
}

function openWorkspaceModal(isEdit) {
    state.isEditMode = isEdit;
    const modal = document.getElementById('workspaceModal');
    const title = document.getElementById('modalTitle');
    const nameInput = document.getElementById('workspaceNameInput');
    const descInput = document.getElementById('workspaceDescriptionInput');

    if (isEdit && state.currentWorkspace) {
        title.textContent = 'Modifica Workspace';
        nameInput.value = state.currentWorkspace.name;
        descInput.value = state.currentWorkspace.description || '';
    } else {
        title.textContent = 'Nuovo Workspace';
        nameInput.value = '';
        descInput.value = '';
    }

    modal.classList.add('show');
    nameInput.focus();
}

function closeWorkspaceModal() {
    document.getElementById('workspaceModal').classList.remove('show');
}

async function saveWorkspace() {
    const name = document.getElementById('workspaceNameInput').value.trim();
    const description = document.getElementById('workspaceDescriptionInput').value.trim();

    if (!name) {
        showToast('Inserisci un nome per il workspace', 'error');
        return;
    }

    try {
        if (state.isEditMode && state.currentWorkspace) {
            // Update existing workspace
            const updated = await apiCall(`/workspaces/${state.currentWorkspace.id}`, {
                method: 'PUT',
                body: JSON.stringify({ name, description })
            });

            state.currentWorkspace = updated;
            const index = state.workspaces.findIndex(ws => ws.id === updated.id);
            state.workspaces[index] = updated;

            showToast('Workspace aggiornato!', 'success');
            showWorkspaceView();
        } else {
            // Create new workspace
            const newWorkspace = await apiCall('/workspaces', {
                method: 'POST',
                body: JSON.stringify({ name, description })
            });

            state.workspaces.push(newWorkspace);
            state.currentWorkspace = newWorkspace;
            state.currentFlashcards = [];

            showToast('Workspace creato!', 'success');
            showWorkspaceView();
        }

        renderWorkspaceList();
        closeWorkspaceModal();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteCurrentWorkspace() {
    if (!state.currentWorkspace) return;

    if (!confirm(`Sei sicuro di voler eliminare "${state.currentWorkspace.name}"? Tutte le flashcard associate verranno eliminate.`)) {
        return;
    }

    try {
        const workspaceId = state.currentWorkspace.id;

        await apiCall(`/workspaces/${workspaceId}`, {
            method: 'DELETE'
        });

        // Clean up localStorage performance data
        localStorage.removeItem(`performance_${workspaceId}`);

        state.workspaces = state.workspaces.filter(ws => ws.id !== workspaceId);
        state.currentWorkspace = null;
        state.currentFlashcards = [];
        state.performance = {
            correct: [],
            incorrect: [],
            correctFirstAttempt: []
        };

        renderWorkspaceList();

        if (state.workspaces.length === 0) {
            showWelcomeScreen();
        } else {
            showWelcomeScreen();
        }

        showToast('Workspace eliminato', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Flashcard Management
async function loadFlashcards(workspaceId) {
    try {
        state.currentFlashcards = await apiCall(`/workspaces/${workspaceId}/flashcards`);
        renderFlashcards();
    } catch (error) {
        showToast('Errore nel caricamento delle flashcard', 'error');
    }
}

function renderFlashcards() {
    const listEl = document.getElementById('flashcardsList');
    const countEl = document.getElementById('flashcardCount');
    const studyBtn = document.getElementById('studyModeBtn');
    const regenerateBtn = document.getElementById('regenerateFlashcardsBtn');
    const restartBtn = document.getElementById('restartStudyBtn');
    const viewFlashcardsBtn = document.getElementById('viewFlashcardsBtn');
    const quizModeBtn = document.getElementById('quizModeBtn');
    const deleteAllBtn = document.getElementById('deleteAllFlashcardsBtn');
    const flashcardsSection = document.getElementById('flashcardsSection');

    countEl.textContent = `${state.currentFlashcards.length} flashcard`;
    const hasFlashcards = state.currentFlashcards.length > 0;

    studyBtn.style.display = hasFlashcards ? 'flex' : 'none';
    regenerateBtn.style.display = hasFlashcards ? 'flex' : 'none';
    restartBtn.style.display = hasFlashcards ? 'flex' : 'none';
    viewFlashcardsBtn.style.display = hasFlashcards ? 'flex' : 'none';
    quizModeBtn.style.display = hasFlashcards ? 'flex' : 'none';
    deleteAllBtn.style.display = hasFlashcards ? 'flex' : 'none';

    // Show flashcards section if there are flashcards
    if (hasFlashcards) {
        flashcardsSection.style.display = 'block';
    }

    updatePerformanceStats();
    updateWorkspacePerformanceStats();

    if (state.currentFlashcards.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><p>📝 Nessuna flashcard ancora. Carica un documento per iniziare!</p></div>';
        return;
    }

    listEl.innerHTML = state.currentFlashcards.map((card, index) => `
        <div class="flashcard" id="flashcard-${card.id}">
            <div class="flashcard-header">
                <div class="flashcard-question">${escapeHtml(card.question)}</div>
                <div class="flashcard-actions">
                    <button class="flashcard-edit" onclick="editFlashcard('${card.id}')" title="Modifica">✏️</button>
                    <button class="flashcard-delete" onclick="deleteFlashcard('${card.id}')" title="Elimina">🗑️</button>
                </div>
            </div>
            <div class="flashcard-options">
                ${card.options.map((option, optIndex) => `
                    <div class="option" onclick="selectAnswer('${card.id}', ${optIndex})">
                        <span class="option-label">${String.fromCharCode(65 + optIndex)}.</span>
                        <span>${escapeHtml(option)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="flashcard-explanation" id="explanation-${card.id}">
                <strong>💡 Spiegazione:</strong> ${escapeHtml(card.explanation)}
            </div>
        </div>
    `).join('');
}

function selectAnswer(flashcardId, optionIndex) {
    const card = state.currentFlashcards.find(fc => fc.id === flashcardId);
    if (!card) return;

    const flashcardEl = document.getElementById(`flashcard-${flashcardId}`);
    const options = flashcardEl.querySelectorAll('.option');
    const explanationEl = document.getElementById(`explanation-${flashcardId}`);

    // Check if already answered
    const alreadyAnswered = Array.from(options).some(opt =>
        opt.classList.contains('correct') || opt.classList.contains('incorrect')
    );

    // Remove previous selections
    options.forEach(opt => {
        opt.classList.remove('selected', 'correct', 'incorrect');
    });

    // Mark selected option
    options[optionIndex].classList.add('selected');

    // Show if correct or incorrect
    const isCorrect = optionIndex === card.correctAnswer;

    if (isCorrect) {
        options[optionIndex].classList.add('correct');
        if (!alreadyAnswered) {
            trackAnswer(flashcardId, true);
        }
    } else {
        options[optionIndex].classList.add('incorrect');
        options[card.correctAnswer].classList.add('correct');
        if (!alreadyAnswered) {
            trackAnswer(flashcardId, false);
        }
    }

    // Show explanation
    explanationEl.classList.add('show');
}

function trackAnswer(flashcardId, isCorrect) {
    if (isCorrect) {
        state.performance.correct.push({
            id: flashcardId,
            timestamp: new Date()
        });
        // Rimuovi dalle sbagliate se era presente
        state.performance.incorrect = state.performance.incorrect.filter(item => item.id !== flashcardId);
    } else {
        // Aggiungi solo se non è già nelle sbagliate
        if (!state.performance.incorrect.some(item => item.id === flashcardId)) {
            state.performance.incorrect.push({
                id: flashcardId,
                timestamp: new Date()
            });
        }
    }

    updatePerformanceStats();
    savePerformance();
}

function updatePerformanceStats() {
    // Aggiorna solo se in modalità studio
    if (!state.studyMode.active) return;

    const correctCount = document.getElementById('studyCorrectCount');
    const incorrectCount = document.getElementById('studyIncorrectCount');
    const accuracyPercent = document.getElementById('studyAccuracyPercent');

    const correct = state.performance.correct.length;
    const incorrect = state.performance.incorrect.length;
    const total = correct + incorrect;

    correctCount.textContent = correct;
    incorrectCount.textContent = incorrect;

    if (total > 0) {
        const accuracy = ((correct / total) * 100).toFixed(0);
        accuracyPercent.textContent = `${accuracy}%`;
    } else {
        accuracyPercent.textContent = '0%';
    }
}

function updateWorkspacePerformanceStats() {
    const statsEl = document.getElementById('workspacePerformanceStats');
    const correctCountEl = document.getElementById('workspaceCorrectCount');
    const incorrectCountEl = document.getElementById('workspaceIncorrectCount');
    const remainingCountEl = document.getElementById('workspaceRemainingCount');

    const correct = state.performance.correct.length;
    const incorrect = state.performance.incorrect.length;
    const correctFirstAttempt = state.performance.correctFirstAttempt.length;
    const total = state.currentFlashcards.length;
    const remaining = total - correctFirstAttempt;

    if (total > 0 && (correct > 0 || incorrect > 0)) {
        statsEl.style.display = 'flex';
        correctCountEl.textContent = correct;
        incorrectCountEl.textContent = incorrect;
        remainingCountEl.textContent = remaining;
    } else {
        statsEl.style.display = 'none';
    }
}

function savePerformance() {
    if (state.currentWorkspace) {
        localStorage.setItem(`performance_${state.currentWorkspace.id}`, JSON.stringify(state.performance));
    }
}

function loadPerformance() {
    if (state.currentWorkspace) {
        const saved = localStorage.getItem(`performance_${state.currentWorkspace.id}`);
        if (saved) {
            state.performance = JSON.parse(saved);
            updatePerformanceStats();
        }
    }
}

async function deleteFlashcard(flashcardId) {
    if (!confirm('Sei sicuro di voler eliminare questa flashcard?')) {
        return;
    }

    try {
        await apiCall(`/flashcards/${flashcardId}`, {
            method: 'DELETE'
        });

        state.currentFlashcards = state.currentFlashcards.filter(fc => fc.id !== flashcardId);
        renderFlashcards();

        showToast('Flashcard eliminata', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteAllFlashcards() {
    if (!state.currentWorkspace) return;

    const count = state.currentFlashcards.length;
    if (count === 0) return;

    if (!confirm(`Sei sicuro di voler eliminare tutte le ${count} flashcard? Questa azione non può essere annullata.`)) {
        return;
    }

    try {
        const result = await apiCall(`/workspaces/${state.currentWorkspace.id}/flashcards`, {
            method: 'DELETE'
        });

        // Reset flashcards
        state.currentFlashcards = [];

        // Reset performance data for this workspace
        state.performance = {
            correct: [],
            incorrect: [],
            correctFirstAttempt: []
        };
        savePerformance();

        renderFlashcards();
        showToast(`${result.deletedCount} flashcard eliminate`, 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function createNewFlashcard() {
    // Resetta l'ID (segnala che stiamo creando una nuova flashcard)
    state.editingFlashcardId = null;

    // Svuota il modal
    document.getElementById('editQuestionInput').value = '';
    document.getElementById('editOption0').value = '';
    document.getElementById('editOption1').value = '';
    document.getElementById('editOption2').value = '';
    document.getElementById('editOption3').value = '';
    document.getElementById('editCorrectAnswer').value = '0';
    document.getElementById('editExplanation').value = '';

    // Mostra modal
    document.getElementById('editFlashcardModal').classList.add('show');
}

function editFlashcard(flashcardId) {
    const card = state.currentFlashcards.find(fc => fc.id === flashcardId);
    if (!card) return;

    // Salva l'ID per il salvataggio
    state.editingFlashcardId = flashcardId;

    // Popola il modal
    document.getElementById('editQuestionInput').value = card.question;
    document.getElementById('editOption0').value = card.options[0];
    document.getElementById('editOption1').value = card.options[1];
    document.getElementById('editOption2').value = card.options[2];
    document.getElementById('editOption3').value = card.options[3];
    document.getElementById('editCorrectAnswer').value = card.correctAnswer;
    document.getElementById('editExplanation').value = card.explanation;

    // Mostra modal
    document.getElementById('editFlashcardModal').classList.add('show');
}

// File Upload
function toggleFlashcardsView() {
    const flashcardsSection = document.getElementById('flashcardsSection');
    const viewFlashcardsBtn = document.getElementById('viewFlashcardsBtn');

    if (flashcardsSection.style.display === 'none') {
        flashcardsSection.style.display = 'block';
        viewFlashcardsBtn.textContent = '📋 Nascondi Flashcard';
    } else {
        flashcardsSection.style.display = 'none';
        viewFlashcardsBtn.innerHTML = '<span class="icon">📋</span> Visualizza Flashcard';
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        uploadFile(files[0]);
    }
}

async function uploadFile(file) {
    if (!state.currentWorkspace) {
        showToast('Seleziona un workspace prima', 'error');
        return;
    }

    // Validate file
    const allowedTypes = ['.pdf', '.txt', '.docx', '.doc', '.md'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!allowedTypes.includes(ext)) {
        showToast('Tipo file non supportato. Usa PDF, TXT, DOCX o MD', 'error');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showToast('File troppo grande. Massimo 10MB', 'error');
        return;
    }

    // Show progress
    const uploadProgressEl = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const uploadStatus = document.getElementById('uploadStatus');

    uploadProgressEl.style.display = 'block';
    progressFill.style.width = '0%';
    uploadStatus.textContent = 'Caricamento file...';

    // Initialize upload progress state
    state.uploadProgress.active = true;
    state.uploadProgress.startTime = new Date();

    try {
        const formData = new FormData();
        formData.append('file', file);

        // Start progress polling
        const progressInterval = startProgressPolling();

        const response = await fetch(`${API_BASE}/workspaces/${state.currentWorkspace.id}/upload`, {
            method: 'POST',
            body: formData
        });

        // Stop progress polling
        clearInterval(progressInterval);
        state.uploadProgress.active = false;

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Errore nel caricamento');
        }

        const result = await response.json();

        // Check if was cancelled
        const finalProgress = await apiCall(`/workspaces/${state.currentWorkspace.id}/upload/progress`);
        const wasCancelled = finalProgress.status === 'cancelled';

        progressFill.style.width = '100%';
        progressFill.style.background = wasCancelled ? '#f39c12' : 'var(--primary-color)';

        if (wasCancelled) {
            uploadStatus.textContent = `⏸️ Interrotto - ${result.flashcardsGenerated} flashcard salvate`;
            showToast(`Generazione interrotta. ${result.flashcardsGenerated} flashcard salvate!`, 'warning');
        } else {
            uploadStatus.textContent = `✅ Generati ${result.flashcardsGenerated} flashcard!`;
            showToast(`${result.flashcardsGenerated} flashcard generate con successo!`, 'success');
        }

        // Update flashcards - SEMPRE, anche se cancellato
        state.currentFlashcards = [...state.currentFlashcards, ...result.flashcards];
        renderFlashcards();

        // Reset after 3 seconds
        setTimeout(() => {
            uploadProgressEl.style.display = 'none';
            progressFill.style.background = 'var(--primary-color)';
            document.getElementById('fileInput').value = '';
        }, 3000);

    } catch (error) {
        console.error('Upload error:', error);
        state.uploadProgress.active = false;
        uploadStatus.textContent = `❌ ${error.message}`;
        progressFill.style.width = '100%';
        progressFill.style.background = 'var(--danger-color)';

        showToast(error.message, 'error');

        setTimeout(() => {
            uploadProgressEl.style.display = 'none';
            progressFill.style.background = 'var(--primary-color)';
        }, 3000);
    }
}

// Study Mode
function continueStudy() {
    // Semplicemente chiama enterStudyMode che già filtra le flashcard corrette al primo tentativo
    enterStudyMode();
}

function enterStudyMode() {
    if (state.currentFlashcards.length === 0) return;

    // Filtra le flashcard: escludi quelle corrette al primo tentativo
    const flashcardsToStudy = state.currentFlashcards.filter(fc =>
        !state.performance.correctFirstAttempt.includes(fc.id)
    );

    if (flashcardsToStudy.length === 0) {
        showToast('Hai già risposto correttamente a tutte le flashcard! Clicca "Ricomincia" per ripeterle.', 'info');
        return;
    }

    state.studyMode.active = true;
    state.studyMode.flashcards = flashcardsToStudy;
    state.studyMode.currentIndex = 0;
    state.studyMode.viewingIncorrect = false; // Reset flag
    state.studyMode.canAdvance = false; // Reset flag per Enter

    document.getElementById('workspaceView').style.display = 'none';
    document.getElementById('studyModeView').style.display = 'block';

    // Mostra barra studio, nascondi barra quiz
    document.getElementById('studyProgressBar').style.display = 'block';
    document.getElementById('quizProgressBar').style.display = 'none';

    // Mostra statistiche in modalità studio normale
    document.getElementById('studyPerformanceStats').style.display = 'flex';

    // Mostra pulsanti studio, nascondi pulsante quiz
    document.getElementById('shuffleBtn').style.display = 'inline-flex';
    document.getElementById('viewIncorrectBtn').style.display = 'inline-flex';
    document.getElementById('restartQuizBtn').style.display = 'none';

    // Nascondi pulsante "Mostra Tutte" all'inizio
    document.getElementById('viewAllBtn').style.display = 'none';

    // Aggiungi listener per Enter
    document.addEventListener('keydown', handleStudyModeKeyPress);

    renderStudyCard();
    updateIncorrectBadge();
    startIncorrectReviewTimer();
}

function exitStudyMode() {
    stopIncorrectReviewTimer();

    // Ferma timer quiz se attivo
    if (state.quizMode.active && state.quizMode.timerInterval) {
        clearInterval(state.quizMode.timerInterval);
        state.quizMode.timerInterval = null;
    }

    // Nascondi timer quiz
    document.getElementById('quizTimer').style.display = 'none';

    state.studyMode.active = false;
    state.studyMode.currentIndex = 0;
    state.studyMode.canAdvance = false;
    state.quizMode.active = false;

    // Rimuovi listener per Enter
    document.removeEventListener('keydown', handleStudyModeKeyPress);

    document.getElementById('studyModeView').style.display = 'none';
    document.getElementById('workspaceView').style.display = 'block';
}

function renderStudyCard() {
    const card = state.studyMode.flashcards[state.studyMode.currentIndex];
    const progressEl = document.getElementById('studyProgress');
    const cardEl = document.getElementById('studyCard');

    // Controlla se questa flashcard è stata sbagliata
    const isIncorrect = state.performance.incorrect.includes(card.id);

    progressEl.textContent = `${state.studyMode.currentIndex + 1} / ${state.studyMode.flashcards.length}`;

    cardEl.innerHTML = `
        ${isIncorrect ? '<div class="incorrect-badge" title="Risposta sbagliata"></div>' : ''}
        <div class="study-card-actions">
            <button class="btn-icon" onclick="editStudyFlashcard()" title="Modifica">
                ✏️
            </button>
            <button class="btn-icon btn-danger" onclick="deleteStudyFlashcard()" title="Elimina">
                🗑️
            </button>
        </div>
        <div class="study-question">${escapeHtml(card.question)}</div>
        <div class="flashcard-options">
            ${card.options.map((option, optIndex) => `
                <div class="option" onclick="selectStudyAnswer(${optIndex})">
                    <span class="option-label">${String.fromCharCode(65 + optIndex)}.</span>
                    <span>${escapeHtml(option)}</span>
                </div>
            `).join('')}
        </div>
        <div class="flashcard-explanation" id="study-explanation">
            <strong>💡 Spiegazione:</strong> ${escapeHtml(card.explanation)}
        </div>
    `;

    // Update navigation buttons
    document.getElementById('prevCardBtn').disabled = state.studyMode.currentIndex === 0;
    document.getElementById('nextCardBtn').disabled = state.studyMode.currentIndex === state.studyMode.flashcards.length - 1;

    // Update progress bar
    updateProgressBar();

    // Reset canAdvance per la prossima domanda
    state.studyMode.canAdvance = false;
}

function updateProgressBar() {
    const completed = state.studyMode.currentIndex + 1;
    const total = state.studyMode.flashcards.length;
    const percentage = (completed / total) * 100;

    if (state.quizMode.active) {
        // Aggiorna barra quiz
        document.getElementById('quizProgressCompleted').textContent = completed;
        document.getElementById('quizProgressTotal').textContent = total;
        document.getElementById('quizProgressBarFill').style.width = `${percentage}%`;
    } else {
        // Aggiorna barra studio normale
        document.getElementById('progressCompleted').textContent = completed;
        document.getElementById('progressTotal').textContent = total;
        document.getElementById('progressBarFill').style.width = `${percentage}%`;
    }
}

function selectStudyAnswer(optionIndex) {
    const card = state.studyMode.flashcards[state.studyMode.currentIndex];
    const cardEl = document.getElementById('studyCard');
    const options = cardEl.querySelectorAll('.option');
    const explanationEl = document.getElementById('study-explanation');

    // In modalità quiz, controlla se già risposto tramite l'array delle risposte
    if (state.quizMode.active) {
        const alreadyAnswered = state.quizMode.answers.some(a => a.cardId === card.id);
        if (alreadyAnswered) return;

        // Salva la risposta senza mostrare feedback
        state.quizMode.answers.push({
            cardId: card.id,
            selectedAnswer: optionIndex,
            correctAnswer: card.correctAnswer,
            isCorrect: optionIndex === card.correctAnswer
        });

        // Marca solo come selected senza mostrare se è corretta
        options.forEach(opt => opt.classList.remove('selected'));
        options[optionIndex].classList.add('selected');

        // Abilita avanzamento automatico
        state.studyMode.canAdvance = true;

        // Avanza automaticamente alla prossima domanda
        if (state.studyMode.currentIndex < state.studyMode.flashcards.length - 1) {
            setTimeout(() => navigateStudyCard(1), 300);
        } else {
            // Se è l'ultima domanda del quiz, termina il quiz
            setTimeout(() => endQuiz(), 300);
        }

        return;
    }

    // Modalità studio normale - mostra feedback
    // Controlla se già risposto
    const alreadyAnswered = Array.from(options).some(opt =>
        opt.classList.contains('correct') || opt.classList.contains('incorrect')
    );

    if (alreadyAnswered) return; // Non permettere di rispondere due volte

    // Remove previous selections
    options.forEach(opt => {
        opt.classList.remove('selected', 'correct', 'incorrect');
    });

    // Mark selected option
    options[optionIndex].classList.add('selected');

    // Show if correct or incorrect
    const isCorrect = optionIndex === card.correctAnswer;

    if (isCorrect) {
        options[optionIndex].classList.add('correct');

        // Aggiungi a corrette (se non già presente)
        if (!state.performance.correct.includes(card.id)) {
            state.performance.correct.push(card.id);

            // Se è la prima volta che rispondi e hai risposto correttamente, segna come "corretta al primo tentativo"
            if (!state.performance.incorrect.includes(card.id) && !state.performance.correctFirstAttempt.includes(card.id)) {
                state.performance.correctFirstAttempt.push(card.id);
            }

            // Rimuovi da sbagliate se presente
            const incorrectIndex = state.performance.incorrect.indexOf(card.id);
            if (incorrectIndex > -1) {
                state.performance.incorrect.splice(incorrectIndex, 1);
            }
        }
    } else {
        options[optionIndex].classList.add('incorrect');
        options[card.correctAnswer].classList.add('correct');

        // Aggiungi a sbagliate (se non già presente)
        if (!state.performance.incorrect.includes(card.id)) {
            state.performance.incorrect.push(card.id);

            // Rimuovi da "corrette al primo tentativo" se presente
            const firstAttemptIndex = state.performance.correctFirstAttempt.indexOf(card.id);
            if (firstAttemptIndex > -1) {
                state.performance.correctFirstAttempt.splice(firstAttemptIndex, 1);
            }

            // Rimuovi da corrette se presente
            const correctIndex = state.performance.correct.indexOf(card.id);
            if (correctIndex > -1) {
                state.performance.correct.splice(correctIndex, 1);
            }
        }
    }

    // Salva performance e aggiorna UI
    savePerformance();
    updatePerformanceStats();
    updateWorkspacePerformanceStats();
    updateIncorrectBadge();

    // Show explanation
    explanationEl.classList.add('show');

    // Abilita avanzamento automatico con Enter dopo aver risposto
    state.studyMode.canAdvance = true;
}

function navigateStudyCard(direction) {
    const newIndex = state.studyMode.currentIndex + direction;

    if (newIndex >= 0 && newIndex < state.studyMode.flashcards.length) {
        state.studyMode.currentIndex = newIndex;
        renderStudyCard();
    }
}

function handleStudyModeKeyPress(e) {
    // Solo se siamo in modalità studio
    if (!state.studyMode.active) return;

    // Enter avanza alla prossima flashcard se hai già risposto
    if (e.key === 'Enter' && state.studyMode.canAdvance) {
        e.preventDefault();

        // Avanza alla prossima flashcard se non è l'ultima
        if (state.studyMode.currentIndex < state.studyMode.flashcards.length - 1) {
            navigateStudyCard(1);
        }
    }

    // Numeri 1-4 per selezionare risposte
    if (e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const optionIndex = parseInt(e.key) - 1;
        const card = state.studyMode.flashcards[state.studyMode.currentIndex];

        // Seleziona solo se l'opzione esiste
        if (optionIndex < card.options.length) {
            selectStudyAnswer(optionIndex);
        }
    }
}

// Quiz Mode Functions
function openQuizModal() {
    if (state.currentFlashcards.length === 0) {
        showToast('Nessuna flashcard disponibile per il quiz', 'error');
        return;
    }

    const maxQuestions = state.currentFlashcards.length;
    document.getElementById('quizQuestionsCount').max = maxQuestions;
    document.getElementById('quizQuestionsCount').value = Math.min(20, maxQuestions);

    document.getElementById('quizModal').style.display = 'flex';
}

function closeQuizModal() {
    document.getElementById('quizModal').style.display = 'none';
}

function startQuizMode() {
    const duration = parseInt(document.getElementById('quizDuration').value);
    const questionsCount = parseInt(document.getElementById('quizQuestionsCount').value);

    if (!duration || duration < 1 || !questionsCount || questionsCount < 1) {
        showToast('Inserisci valori validi per durata e numero di domande', 'error');
        return;
    }

    if (questionsCount > state.currentFlashcards.length) {
        showToast(`Hai solo ${state.currentFlashcards.length} flashcard disponibili`, 'error');
        return;
    }

    // Chiudi modal
    closeQuizModal();

    // Seleziona domande casuali
    const shuffled = [...state.currentFlashcards].sort(() => Math.random() - 0.5);
    const selectedFlashcards = shuffled.slice(0, questionsCount);

    // Inizializza quiz mode
    state.quizMode.active = true;
    state.quizMode.duration = duration;
    state.quizMode.startTime = Date.now();
    state.quizMode.endTime = Date.now() + (duration * 60 * 1000);
    state.quizMode.answers = [];

    // Inizializza study mode con le domande selezionate
    state.studyMode.active = true;
    state.studyMode.flashcards = selectedFlashcards;
    state.studyMode.currentIndex = 0;
    state.studyMode.viewingIncorrect = false;
    state.studyMode.canAdvance = false;

    // Mostra vista studio
    document.getElementById('workspaceView').style.display = 'none';
    document.getElementById('studyModeView').style.display = 'block';

    // Mostra barra quiz, nascondi barra studio
    document.getElementById('studyProgressBar').style.display = 'none';
    document.getElementById('quizProgressBar').style.display = 'block';

    // Nascondi statistiche in modalità quiz
    document.getElementById('studyPerformanceStats').style.display = 'none';

    // Nascondi tutti i pulsanti in modalità quiz
    document.getElementById('shuffleBtn').style.display = 'none';
    document.getElementById('viewIncorrectBtn').style.display = 'none';
    document.getElementById('viewAllBtn').style.display = 'none';
    document.getElementById('restartQuizBtn').style.display = 'none';

    // Mostra timer
    document.getElementById('quizTimer').style.display = 'inline';

    // Avvia timer
    startQuizTimer();

    // Aggiungi listener per Enter
    document.addEventListener('keydown', handleStudyModeKeyPress);

    renderStudyCard();
    updatePerformanceStats();

    showToast(`Quiz avviato! ${questionsCount} domande in ${duration} minuti`, 'success');
}

function startQuizTimer() {
    updateQuizTimer();

    state.quizMode.timerInterval = setInterval(() => {
        updateQuizTimer();

        // Controlla se il tempo è scaduto
        if (Date.now() >= state.quizMode.endTime) {
            endQuiz();
        }
    }, 1000);
}

function updateQuizTimer() {
    const remaining = state.quizMode.endTime - Date.now();

    if (remaining <= 0) {
        document.getElementById('quizTimeRemaining').textContent = '00:00';
        return;
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    document.getElementById('quizTimeRemaining').textContent = display;

    // Cambia colore quando rimangono meno di 2 minuti
    const timerEl = document.getElementById('quizTimer');
    if (remaining < 120000) {
        timerEl.style.color = 'var(--danger)';
        timerEl.style.animation = 'pulse 1s infinite';
    }
}

function endQuiz() {
    // Ferma timer
    if (state.quizMode.timerInterval) {
        clearInterval(state.quizMode.timerInterval);
        state.quizMode.timerInterval = null;
    }

    // Nascondi timer
    document.getElementById('quizTimer').style.display = 'none';

    // Calcola punteggio dai risultati salvati
    const correctCount = state.quizMode.answers.filter(a => a.isCorrect).length;
    const totalQuestions = state.quizMode.answers.length;
    const answeredCount = state.quizMode.answers.length;
    const unansweredCount = state.studyMode.flashcards.length - answeredCount;
    const percentage = totalQuestions > 0 ? Math.round((correctCount / state.studyMode.flashcards.length) * 100) : 0;

    // Crea messaggio dettagliato dei risultati
    let resultMessage = `Quiz Terminato!\n\n`;
    resultMessage += `Risposte Corrette: ${correctCount}\n`;
    resultMessage += `Risposte Sbagliate: ${answeredCount - correctCount}\n`;
    if (unansweredCount > 0) {
        resultMessage += `Domande Non Risposte: ${unansweredCount}\n`;
    }
    resultMessage += `Totale Domande: ${state.studyMode.flashcards.length}\n\n`;
    resultMessage += `Punteggio Finale: ${percentage}%`;

    // Mostra risultato con alert per essere più visibile
    alert(resultMessage);

    // Mostra anche toast
    showToast(`Quiz terminato! ${correctCount}/${state.studyMode.flashcards.length} corrette (${percentage}%)`,
        percentage >= 60 ? 'success' : 'warning');

    // Reset quiz mode
    state.quizMode.active = false;
    state.quizMode.answers = [];

    // Esci dalla modalità studio
    exitStudyMode();
}

function restartQuiz() {
    if (!state.quizMode.active) return;

    // Reset quiz
    state.studyMode.currentIndex = 0;
    state.quizMode.startTime = Date.now();
    state.quizMode.endTime = Date.now() + (state.quizMode.duration * 60 * 1000);

    // Reset timer
    if (state.quizMode.timerInterval) {
        clearInterval(state.quizMode.timerInterval);
    }
    startQuizTimer();

    // Renderizza prima flashcard
    renderStudyCard();

    showToast('Quiz riavviato!', 'info');
}

// View Management
function showWelcomeScreen() {
    document.getElementById('welcomeScreen').style.display = 'flex';
    document.getElementById('workspaceView').style.display = 'none';
}

function showWorkspaceView() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('workspaceView').style.display = 'block';

    if (state.currentWorkspace) {
        document.getElementById('workspaceName').textContent = state.currentWorkspace.name;
        document.getElementById('workspaceDescription').textContent = state.currentWorkspace.description || 'Nessuna descrizione';
    }
}

// Utility Functions
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Progress Polling Functions
function startProgressPolling() {
    return setInterval(async () => {
        if (!state.currentWorkspace || !state.uploadProgress.active) return;

        try {
            const progress = await apiCall(`/workspaces/${state.currentWorkspace.id}/upload/progress`);

            if (progress.active) {
                updateProgressUI(progress);
            }
        } catch (error) {
            console.error('Error polling progress:', error);
        }
    }, 1000); // Poll every second
}

function updateProgressUI(progress) {
    const progressSection = document.getElementById('progressSection');
    const progressFlashcards = document.getElementById('progressFlashcards');
    const progressTime = document.getElementById('progressTime');
    const progressFill = document.getElementById('progressFill');
    const uploadStatus = document.getElementById('uploadStatus');

    // Calculate elapsed time
    const elapsed = new Date() - new Date(progress.startTime);
    const elapsedSeconds = Math.floor(elapsed / 1000);
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    const elapsedSecondsRemainder = elapsedSeconds % 60;

    // Update based on status
    if (progress.status === 'cancelled') {
        progressSection.textContent = `Interrotto`;
        progressFlashcards.textContent = `${progress.flashcardsGenerated} flashcard salvate`;
        progressFill.style.width = '100%';
        progressFill.style.background = 'var(--warning-color)';
        uploadStatus.textContent = `⏸️ Interrotto - ${progress.flashcardsGenerated} flashcard salvate`;
    } else if (progress.flashcardsGenerated > 0 && progress.currentBatch > 0) {
        // Generating flashcards - mostra progresso batch
        const percentage = progress.totalBatches > 0
            ? (progress.currentBatch / progress.totalBatches) * 100
            : 0;

        progressSection.textContent = `Batch ${progress.currentBatch}/${progress.totalBatches}`;
        progressFlashcards.textContent = `${progress.flashcardsGenerated} flashcard generate`;
        progressFill.style.width = `${percentage}%`;

        // Calculate estimated time remaining (NOT total time)
        if (progress.currentBatch > 0 && progress.currentBatch < progress.totalBatches) {
            const avgTimePerBatch = elapsed / progress.currentBatch; // ms per batch
            const remainingBatches = progress.totalBatches - progress.currentBatch;
            const estimatedRemainingMs = avgTimePerBatch * remainingBatches;

            const estSeconds = Math.floor(estimatedRemainingMs / 1000);
            const estMinutes = Math.floor(estSeconds / 60);
            const estSecondsRemainder = estSeconds % 60;

            uploadStatus.textContent = `Generando flashcard...`;
            progressTime.textContent = `Tempo rimanente: ~${estMinutes}m ${estSecondsRemainder}s`;
        } else {
            uploadStatus.textContent = `Generando flashcard...`;
            progressTime.textContent = `Tempo trascorso: ${elapsedMinutes}m ${elapsedSecondsRemainder}s`;
        }
    } else {
        // Still analyzing (prima batch)
        progressSection.textContent = `AI sta leggendo il documento...`;
        progressFlashcards.textContent = `Analisi in corso`;
        progressFill.style.width = '30%';
        progressFill.style.transition = 'width 2s ease-in-out';
        uploadStatus.textContent = `Analizzando documento (${elapsedSeconds}s)`;
        progressTime.textContent = `Tempo trascorso: ${elapsedMinutes}m ${elapsedSecondsRemainder}s`;
    }

    // Update global state
    state.uploadProgress = {
        ...progress,
        active: true
    };
}

async function cancelUpload() {
    if (!state.currentWorkspace || !state.uploadProgress.active) return;

    if (!confirm('Sei sicuro di voler fermare la generazione? Le flashcard già create verranno salvate.')) {
        return;
    }

    try {
        await apiCall(`/workspaces/${state.currentWorkspace.id}/upload/cancel`, {
            method: 'POST'
        });

        state.uploadProgress.active = false;

        showToast('Generazione fermata', 'info');
    } catch (error) {
        showToast('Errore nel fermare la generazione', 'error');
    }
}

// Regenerate & Restart Functions
async function regenerateFlashcards() {
    if (!state.currentWorkspace || !state.currentWorkspace.lastUploadedFile) {
        showToast('Nessun documento caricato da cui generare flashcard', 'error');
        return;
    }

    if (!confirm('Vuoi generare nuove flashcard dal documento caricato? Questo può richiedere alcuni minuti.')) {
        return;
    }

    showToast('Rigenerazione flashcard in corso... Controlla i log per il progresso!', 'info');
    // La rigenerazione richiederà di ricaricare il file
    // Per semplicità, mostra un messaggio all'utente
    showToast('Per generare nuove flashcard, ricarica il documento', 'info');
}

function restartStudy() {
    if (state.currentFlashcards.length === 0) return;

    if (!confirm('Vuoi ricominciare da capo? Le statistiche attuali verranno mantenute.')) {
        return;
    }

    // Resetta le statistiche solo per questa sessione
    state.performance = {
        correct: [],
        incorrect: [],
        correctFirstAttempt: [] // Reset anche le corrette al primo tentativo
    };

    savePerformance();
    updatePerformanceStats();

    // Ricarica le flashcard per resetare lo stato visivo
    renderFlashcards();

    showToast('Studio riavviato! Buona fortuna!', 'success');
}

// Sistema di Ripetizione Flashcard Sbagliate
// Funzioni per modalità studio avanzate

// Aggiorna badge delle flashcard sbagliate
function updateIncorrectBadge() {
    const badge = document.getElementById('incorrectCountBadge');
    if (badge) {
        badge.textContent = state.performance.incorrect.length;
    }
}

// Mescola le flashcard in modo random
function shuffleFlashcards() {
    if (!state.studyMode.active) return;

    const flashcards = [...state.studyMode.flashcards];

    // Fisher-Yates shuffle algorithm
    for (let i = flashcards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [flashcards[i], flashcards[j]] = [flashcards[j], flashcards[i]];
    }

    state.studyMode.flashcards = flashcards;
    state.studyMode.currentIndex = 0;
    renderStudyCard();

    showToast('Flashcard mescolate!', 'success');
}

// Visualizza solo le flashcard sbagliate
function viewIncorrectFlashcards() {
    if (!state.studyMode.active) return;

    const incorrectFlashcards = state.currentFlashcards.filter(fc =>
        state.performance.incorrect.includes(fc.id)
    );

    if (incorrectFlashcards.length === 0) {
        showToast('Non hai ancora flashcard sbagliate!', 'info');
        return;
    }

    state.studyMode.flashcards = incorrectFlashcards;
    state.studyMode.currentIndex = 0;
    state.studyMode.viewingIncorrect = true; // Flag per sapere se stai guardando solo sbagliate
    renderStudyCard();

    // Mostra pulsante "Mostra Tutte"
    document.getElementById('viewAllBtn').style.display = 'inline-block';

    showToast(`Mostrando ${incorrectFlashcards.length} flashcard sbagliate`, 'info');
}

// Visualizza tutte le flashcard (ritorna dalla vista "solo sbagliate")
function viewAllFlashcards() {
    if (!state.studyMode.active) return;

    // Mostra solo le flashcard non corrette al primo colpo (come in enterStudyMode)
    const flashcardsToStudy = state.currentFlashcards.filter(fc =>
        !state.performance.correctFirstAttempt.includes(fc.id)
    );

    state.studyMode.flashcards = flashcardsToStudy;
    state.studyMode.currentIndex = 0;
    state.studyMode.viewingIncorrect = false;
    renderStudyCard();

    // Nascondi pulsante "Mostra Tutte"
    document.getElementById('viewAllBtn').style.display = 'none';

    showToast(`Mostrando ${flashcardsToStudy.length} flashcard da studiare`, 'success');
}

// Timer per riproporre flashcard sbagliate ogni 3 minuti
let incorrectReviewInterval = null;

function startIncorrectReviewTimer() {
    // Pulisci timer esistente
    if (incorrectReviewInterval) {
        clearInterval(incorrectReviewInterval);
    }

    // Avvia timer solo se in modalità studio
    if (!state.studyMode.active) return;

    incorrectReviewInterval = setInterval(() => {
        // Solo se in modalità studio e ci sono sbagliate
        if (state.studyMode.active && state.performance.incorrect.length > 0) {
            const incorrectFlashcards = state.currentFlashcards.filter(fc =>
                state.performance.incorrect.includes(fc.id)
            );

            if (incorrectFlashcards.length > 0) {
                // Riproponi una flashcard sbagliata random
                const randomIncorrect = incorrectFlashcards[
                    Math.floor(Math.random() * incorrectFlashcards.length)
                ];

                // Trova l'indice nella lista attuale
                const index = state.studyMode.flashcards.findIndex(fc => fc.id === randomIncorrect.id);

                if (index !== -1) {
                    state.studyMode.currentIndex = index;
                    renderStudyCard();
                    showToast('💡 Ripasso: una flashcard che hai sbagliato!', 'warning');
                }
            }
        }
    }, 3 * 60 * 1000); // 3 minuti
}

function stopIncorrectReviewTimer() {
    if (incorrectReviewInterval) {
        clearInterval(incorrectReviewInterval);
        incorrectReviewInterval = null;
    }
}

// Funzioni modifica/elimina in modalità studio

function editStudyFlashcard() {
    const card = state.studyMode.flashcards[state.studyMode.currentIndex];

    // Salva l'ID per il salvataggio
    state.editingFlashcardId = card.id;

    // Popola il modal con i dati della flashcard
    document.getElementById('editQuestionInput').value = card.question;
    document.getElementById('editOption0').value = card.options[0];
    document.getElementById('editOption1').value = card.options[1];
    document.getElementById('editOption2').value = card.options[2];
    document.getElementById('editOption3').value = card.options[3];
    document.getElementById('editCorrectAnswer').value = card.correctAnswer;
    document.getElementById('editExplanation').value = card.explanation;

    // Mostra modal
    document.getElementById('editFlashcardModal').classList.add('show');
}

function closeEditFlashcardModal() {
    document.getElementById('editFlashcardModal').classList.remove('show');
}

async function saveEditedFlashcard() {
    const flashcardId = state.editingFlashcardId;

    // Raccogli dati dal form
    const cardData = {
        question: document.getElementById('editQuestionInput').value.trim(),
        options: [
            document.getElementById('editOption0').value.trim(),
            document.getElementById('editOption1').value.trim(),
            document.getElementById('editOption2').value.trim(),
            document.getElementById('editOption3').value.trim()
        ],
        correctAnswer: parseInt(document.getElementById('editCorrectAnswer').value),
        explanation: document.getElementById('editExplanation').value.trim()
    };

    // Validazione
    if (!cardData.question || cardData.options.some(opt => !opt) || !cardData.explanation) {
        showToast('Compila tutti i campi obbligatori', 'error');
        return;
    }

    try {
        let savedCard;

        if (flashcardId) {
            // Modifica esistente
            savedCard = await apiCall(`/flashcards/${flashcardId}`, {
                method: 'PUT',
                body: JSON.stringify(cardData)
            });

            // Aggiorna in currentFlashcards
            const mainCard = state.currentFlashcards.find(fc => fc.id === flashcardId);
            if (mainCard) {
                Object.assign(mainCard, savedCard);
            }

            // Aggiorna anche in studyMode se attivo
            if (state.studyMode.active) {
                const studyCard = state.studyMode.flashcards[state.studyMode.currentIndex];
                if (studyCard && studyCard.id === flashcardId) {
                    Object.assign(studyCard, savedCard);
                }
                renderStudyCard();
            }

            showToast('Flashcard modificata con successo!', 'success');
        } else {
            // Crea nuova
            savedCard = await apiCall(`/workspaces/${state.currentWorkspace.id}/flashcards`, {
                method: 'POST',
                body: JSON.stringify(cardData)
            });

            // Aggiungi a currentFlashcards
            state.currentFlashcards.push(savedCard);

            showToast('Flashcard creata con successo!', 'success');
        }

        // Re-render lista flashcards
        renderFlashcards();

        closeEditFlashcardModal();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteStudyFlashcard() {
    const card = state.studyMode.flashcards[state.studyMode.currentIndex];

    if (!confirm('Sei sicuro di voler eliminare questa flashcard?')) {
        return;
    }

    try {
        await apiCall(`/flashcards/${card.id}`, {
            method: 'DELETE'
        });

        // Rimuovi dalla lista studio
        state.studyMode.flashcards.splice(state.studyMode.currentIndex, 1);

        // Rimuovi da currentFlashcards
        state.currentFlashcards = state.currentFlashcards.filter(fc => fc.id !== card.id);

        // Se non ci sono più flashcard, esci dalla modalità studio
        if (state.studyMode.flashcards.length === 0) {
            showToast('Tutte le flashcard eliminate', 'info');
            exitStudyMode();
            renderFlashcards();
            return;
        }

        // Vai alla flashcard precedente se eri all'ultima
        if (state.studyMode.currentIndex >= state.studyMode.flashcards.length) {
            state.studyMode.currentIndex = state.studyMode.flashcards.length - 1;
        }

        renderStudyCard();
        renderFlashcards();
        showToast('Flashcard eliminata', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Event listeners per modal edit flashcard
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('closeEditFlashcardBtn').addEventListener('click', closeEditFlashcardModal);
    document.getElementById('cancelEditFlashcardBtn').addEventListener('click', closeEditFlashcardModal);
    document.getElementById('saveEditFlashcardBtn').addEventListener('click', saveEditedFlashcard);
});

// Make functions globally accessible for onclick handlers
window.selectWorkspace = selectWorkspace;
window.selectAnswer = selectAnswer;
window.deleteFlashcard = deleteFlashcard;
window.selectStudyAnswer = selectStudyAnswer;
window.shuffleFlashcards = shuffleFlashcards;
window.viewIncorrectFlashcards = viewIncorrectFlashcards;
window.viewAllFlashcards = viewAllFlashcards;
window.editStudyFlashcard = editStudyFlashcard;
window.deleteStudyFlashcard = deleteStudyFlashcard;
