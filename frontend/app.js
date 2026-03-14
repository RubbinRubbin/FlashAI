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
        viewingIncorrect: false,
        canAdvance: false,
        sessionStartTime: null
    },
    quizMode: {
        active: false,
        duration: 0,
        startTime: null,
        endTime: null,
        timerInterval: null,
        answers: []
    },
    performance: {
        correct: [],
        incorrect: [],
        correctFirstAttempt: []
    },
    srs: {},
    stats: {
        studySessions: [],
        quizSessions: [],
        cardHistory: {},
        totalStudyTimeMs: 0,
        totalQuizTimeMs: 0
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
    // Sidebar toggle
    document.getElementById('sidebarToggleBtn').addEventListener('click', toggleSidebar);
    document.getElementById('sidebarCloseBtn').addEventListener('click', closeSidebar);
    document.getElementById('sidebarBackdrop').addEventListener('click', closeSidebar);

    // Workspace management
    document.getElementById('newWorkspaceBtn').addEventListener('click', () => openWorkspaceModal(false));
    document.getElementById('editWorkspaceBtn').addEventListener('click', () => openWorkspaceModal(true));
    document.getElementById('deleteWorkspaceBtn').addEventListener('click', deleteCurrentWorkspace);

    // Management panel toggle
    document.getElementById('managementToggleBtn').addEventListener('click', toggleManagementPanel);

    // Modal
    document.getElementById('closeModalBtn').addEventListener('click', closeWorkspaceModal);
    document.getElementById('cancelModalBtn').addEventListener('click', closeWorkspaceModal);
    document.getElementById('saveWorkspaceBtn').addEventListener('click', saveWorkspace);

    // File upload
    const fileInput = document.getElementById('fileInput');
    document.getElementById('uploadDocumentBtn').addEventListener('click', () => fileInput.click());
    document.getElementById('viewFlashcardsBtn').addEventListener('click', toggleFlashcardsView);
    fileInput.addEventListener('change', handleFileSelect);

    // Cancel upload
    document.getElementById('cancelUploadBtn').addEventListener('click', cancelUpload);

    // Flashcard actions
    document.getElementById('regenerateFlashcardsBtn').addEventListener('click', regenerateFlashcards);
    document.getElementById('restartStudyBtn').addEventListener('click', restartStudy);
    document.getElementById('deleteAllFlashcardsBtn').addEventListener('click', deleteAllFlashcards);

    // Hub create flashcard
    document.getElementById('createFlashcardHubBtn').addEventListener('click', createNewFlashcard);

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

    // Create new flashcard (in flashcards section)
    document.getElementById('createFlashcardBtn').addEventListener('click', createNewFlashcard);

    // Close modal on outside click
    document.getElementById('workspaceModal').addEventListener('click', (e) => {
        if (e.target.id === 'workspaceModal') closeWorkspaceModal();
    });
    document.getElementById('quizModal').addEventListener('click', (e) => {
        if (e.target.id === 'quizModal') closeQuizModal();
    });
}

// ===================================
// SIDEBAR
// ===================================

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarBackdrop').classList.toggle('active');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarBackdrop').classList.remove('active');
}

// ===================================
// MANAGEMENT PANEL
// ===================================

function toggleManagementPanel() {
    const panel = document.getElementById('managementPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// ===================================
// API CALLS
// ===================================

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

// ===================================
// WORKSPACE MANAGEMENT
// ===================================

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
    closeSidebar();
    await loadFlashcards(workspaceId);
    loadPerformance();
    loadSRS();
    loadStats();
    showWorkspaceView();
    renderWorkspaceList();
    updateStatsPanel();
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

        await apiCall(`/workspaces/${workspaceId}`, { method: 'DELETE' });

        localStorage.removeItem(`performance_${workspaceId}`);
        localStorage.removeItem(`srs_${workspaceId}`);
        localStorage.removeItem(`stats_${workspaceId}`);

        state.workspaces = state.workspaces.filter(ws => ws.id !== workspaceId);
        state.currentWorkspace = null;
        state.currentFlashcards = [];
        state.performance = { correct: [], incorrect: [], correctFirstAttempt: [] };
        state.srs = {};
        state.stats = { studySessions: [], quizSessions: [], cardHistory: {}, totalStudyTimeMs: 0, totalQuizTimeMs: 0 };

        renderWorkspaceList();
        showWelcomeScreen();
        showToast('Workspace eliminato', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ===================================
// FLASHCARD MANAGEMENT
// ===================================

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
    const regenerateBtn = document.getElementById('regenerateFlashcardsBtn');
    const restartBtn = document.getElementById('restartStudyBtn');
    const viewFlashcardsBtn = document.getElementById('viewFlashcardsBtn');
    const deleteAllBtn = document.getElementById('deleteAllFlashcardsBtn');
    const mainActions = document.getElementById('mainActions');
    const statsPanel = document.getElementById('statsPanel');

    countEl.textContent = `${state.currentFlashcards.length} flashcard`;
    const hasFlashcards = state.currentFlashcards.length > 0;

    // Show/hide management items that need flashcards
    regenerateBtn.style.display = hasFlashcards ? 'flex' : 'none';
    restartBtn.style.display = hasFlashcards ? 'flex' : 'none';
    viewFlashcardsBtn.style.display = hasFlashcards ? 'flex' : 'none';
    deleteAllBtn.style.display = hasFlashcards ? 'flex' : 'none';

    // Show/hide main action buttons
    if (mainActions) mainActions.style.display = hasFlashcards ? 'flex' : 'none';

    // Show/hide stats panel
    if (statsPanel) statsPanel.style.display = hasFlashcards ? 'block' : 'none';

    // Flashcards section stays hidden by default (user toggles via management panel)

    updatePerformanceStats();

    if (state.currentFlashcards.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><p>Nessuna flashcard ancora. Carica un documento per iniziare!</p></div>';
        return;
    }

    listEl.innerHTML = state.currentFlashcards.map((card, index) => `
        <div class="flashcard" id="flashcard-${card.id}">
            <div class="flashcard-header">
                <div class="flashcard-question">${escapeHtml(card.question)}</div>
                <div class="flashcard-actions">
                    <button class="flashcard-edit" onclick="editFlashcard('${card.id}')" title="Modifica">&#9998;</button>
                    <button class="flashcard-delete" onclick="deleteFlashcard('${card.id}')" title="Elimina">&#128465;</button>
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
                <strong>Spiegazione:</strong> ${escapeHtml(card.explanation)}
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

    const alreadyAnswered = Array.from(options).some(opt =>
        opt.classList.contains('correct') || opt.classList.contains('incorrect')
    );

    options.forEach(opt => {
        opt.classList.remove('selected', 'correct', 'incorrect');
    });

    options[optionIndex].classList.add('selected');

    const isCorrect = optionIndex === card.correctAnswer;

    if (isCorrect) {
        options[optionIndex].classList.add('correct');
        if (!alreadyAnswered) trackAnswer(flashcardId, true);
    } else {
        options[optionIndex].classList.add('incorrect');
        options[card.correctAnswer].classList.add('correct');
        if (!alreadyAnswered) trackAnswer(flashcardId, false);
    }

    explanationEl.classList.add('show');
}

function trackAnswer(flashcardId, isCorrect) {
    if (isCorrect) {
        state.performance.correct.push({ id: flashcardId, timestamp: new Date() });
        state.performance.incorrect = state.performance.incorrect.filter(item => item.id !== flashcardId);
    } else {
        if (!state.performance.incorrect.some(item => item.id === flashcardId)) {
            state.performance.incorrect.push({ id: flashcardId, timestamp: new Date() });
        }
    }

    updatePerformanceStats();
    savePerformance();
}

function updatePerformanceStats() {
    if (!state.studyMode.active) return;

    const correctCount = document.getElementById('studyCorrectCount');
    const incorrectCount = document.getElementById('studyIncorrectCount');
    const accuracyPercent = document.getElementById('studyAccuracyPercent');

    const correct = state.performance.correct.length;
    const incorrect = state.performance.incorrect.length;
    const total = correct + incorrect;

    correctCount.textContent = correct;
    incorrectCount.textContent = incorrect;
    accuracyPercent.textContent = total > 0 ? `${((correct / total) * 100).toFixed(0)}%` : '0%';
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
        } else {
            state.performance = { correct: [], incorrect: [], correctFirstAttempt: [] };
        }
    }
}

async function deleteFlashcard(flashcardId) {
    if (!confirm('Sei sicuro di voler eliminare questa flashcard?')) return;

    try {
        await apiCall(`/flashcards/${flashcardId}`, { method: 'DELETE' });
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

    if (!confirm(`Sei sicuro di voler eliminare tutte le ${count} flashcard?`)) return;

    try {
        const result = await apiCall(`/workspaces/${state.currentWorkspace.id}/flashcards`, { method: 'DELETE' });

        state.currentFlashcards = [];
        state.performance = { correct: [], incorrect: [], correctFirstAttempt: [] };
        state.srs = {};
        savePerformance();
        saveSRS();

        renderFlashcards();
        showToast(`${result.deletedCount} flashcard eliminate`, 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function createNewFlashcard() {
    state.editingFlashcardId = null;

    document.getElementById('editQuestionInput').value = '';
    document.getElementById('editOption0').value = '';
    document.getElementById('editOption1').value = '';
    document.getElementById('editOption2').value = '';
    document.getElementById('editOption3').value = '';
    document.getElementById('editCorrectAnswer').value = '0';
    document.getElementById('editExplanation').value = '';

    document.getElementById('editFlashcardModal').classList.add('show');
}

function editFlashcard(flashcardId) {
    const card = state.currentFlashcards.find(fc => fc.id === flashcardId);
    if (!card) return;

    state.editingFlashcardId = flashcardId;

    document.getElementById('editQuestionInput').value = card.question;
    document.getElementById('editOption0').value = card.options[0];
    document.getElementById('editOption1').value = card.options[1];
    document.getElementById('editOption2').value = card.options[2];
    document.getElementById('editOption3').value = card.options[3];
    document.getElementById('editCorrectAnswer').value = card.correctAnswer;
    document.getElementById('editExplanation').value = card.explanation;

    document.getElementById('editFlashcardModal').classList.add('show');
}

// ===================================
// FLASHCARD VIEW TOGGLE
// ===================================

function toggleFlashcardsView() {
    const flashcardsSection = document.getElementById('flashcardsSection');
    const viewFlashcardsBtn = document.getElementById('viewFlashcardsBtn');
    const label = viewFlashcardsBtn.querySelector('span:last-child');

    if (flashcardsSection.style.display === 'none') {
        flashcardsSection.style.display = 'block';
        if (label) label.textContent = 'Nascondi Flashcard';
    } else {
        flashcardsSection.style.display = 'none';
        if (label) label.textContent = 'Visualizza Flashcard';
    }
}

// ===================================
// FILE UPLOAD
// ===================================

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) uploadFile(files[0]);
}

async function uploadFile(file) {
    if (!state.currentWorkspace) {
        showToast('Seleziona un workspace prima', 'error');
        return;
    }

    const allowedTypes = ['.pdf', '.txt', '.docx', '.doc', '.md'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!allowedTypes.includes(ext)) {
        showToast('Tipo file non supportato. Usa PDF, TXT, DOCX o MD', 'error');
        return;
    }

    if (file.size > 200 * 1024 * 1024) {
        showToast('File troppo grande. Massimo 200MB', 'error');
        return;
    }

    const uploadProgressEl = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const uploadStatus = document.getElementById('uploadStatus');

    uploadProgressEl.style.display = 'block';
    progressFill.style.width = '0%';
    uploadStatus.textContent = 'Caricamento file...';

    state.uploadProgress.active = true;
    state.uploadProgress.startTime = new Date();

    try {
        const formData = new FormData();
        formData.append('file', file);

        const progressInterval = startProgressPolling();

        const response = await fetch(`${API_BASE}/workspaces/${state.currentWorkspace.id}/upload`, {
            method: 'POST',
            body: formData
        });

        clearInterval(progressInterval);
        state.uploadProgress.active = false;

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Errore nel caricamento');
        }

        const result = await response.json();

        const finalProgress = await apiCall(`/workspaces/${state.currentWorkspace.id}/upload/progress`);
        const wasCancelled = finalProgress.status === 'cancelled';

        progressFill.style.width = '100%';

        if (wasCancelled) {
            uploadStatus.textContent = `Interrotto - ${result.flashcardsGenerated} flashcard salvate`;
            showToast(`Generazione interrotta. ${result.flashcardsGenerated} flashcard salvate!`, 'warning');
        } else {
            uploadStatus.textContent = `Generati ${result.flashcardsGenerated} flashcard!`;
            showToast(`${result.flashcardsGenerated} flashcard generate con successo!`, 'success');
        }

        state.currentFlashcards = [...state.currentFlashcards, ...result.flashcards];
        renderFlashcards();
        updateStatsPanel();

        setTimeout(() => {
            uploadProgressEl.style.display = 'none';
            document.getElementById('fileInput').value = '';
        }, 3000);

    } catch (error) {
        console.error('Upload error:', error);
        state.uploadProgress.active = false;
        uploadStatus.textContent = `Errore: ${error.message}`;
        progressFill.style.width = '100%';
        progressFill.style.background = 'var(--danger)';

        showToast(error.message, 'error');

        setTimeout(() => {
            uploadProgressEl.style.display = 'none';
            progressFill.style.background = '';
        }, 3000);
    }
}

// ===================================
// REGENERATE FLASHCARDS (from saved text)
// ===================================

async function regenerateFlashcards() {
    if (!state.currentWorkspace) return;

    if (!confirm('Vuoi generare nuove flashcard dal documento caricato? Le nuove verranno aggiunte alle esistenti.')) return;

    const workspaceId = state.currentWorkspace.id;

    const uploadProgressEl = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const uploadStatus = document.getElementById('uploadStatus');

    uploadProgressEl.style.display = 'block';
    progressFill.style.width = '0%';
    progressFill.style.background = '';
    uploadStatus.textContent = 'Generazione nuove flashcard...';
    state.uploadProgress.active = true;

    const pollInterval = startProgressPolling();

    try {
        const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/regenerate`, { method: 'POST' });
        const result = await response.json();

        clearInterval(pollInterval);
        state.uploadProgress.active = false;

        if (result.success) {
            progressFill.style.width = '100%';
            uploadStatus.textContent = `${result.flashcardsGenerated} nuove flashcard generate!`;

            await loadFlashcards(workspaceId);
            updateStatsPanel();
            showToast(`${result.flashcardsGenerated} nuove flashcard generate!`, 'success');
        } else {
            uploadStatus.textContent = result.error || 'Errore nella rigenerazione';
            showToast(result.error || 'Errore nella rigenerazione', 'error');
        }

        setTimeout(() => { uploadProgressEl.style.display = 'none'; }, 3000);
    } catch (error) {
        clearInterval(pollInterval);
        state.uploadProgress.active = false;
        uploadStatus.textContent = `Errore: ${error.message}`;
        showToast('Errore nella rigenerazione: ' + error.message, 'error');
        setTimeout(() => { uploadProgressEl.style.display = 'none'; }, 3000);
    }
}

// ===================================
// SM-2 SPACED REPETITION
// ===================================

function loadSRS() {
    if (state.currentWorkspace) {
        const saved = localStorage.getItem(`srs_${state.currentWorkspace.id}`);
        state.srs = saved ? JSON.parse(saved) : {};
    }
}

function saveSRS() {
    if (state.currentWorkspace) {
        localStorage.setItem(`srs_${state.currentWorkspace.id}`, JSON.stringify(state.srs));
    }
}

function getSRSData(cardId) {
    if (!state.srs[cardId]) {
        state.srs[cardId] = {
            easeFactor: 2.5,
            interval: 0,
            repetitions: 0,
            nextReview: 0
        };
    }
    return state.srs[cardId];
}

function updateSRS(cardId, quality) {
    const data = getSRSData(cardId);

    if (quality < 3) {
        data.repetitions = 0;
        data.interval = 0;
    } else {
        if (data.repetitions === 0) {
            data.interval = 1;
        } else if (data.repetitions === 1) {
            data.interval = 6;
        } else {
            data.interval = Math.round(data.interval * data.easeFactor);
        }
        data.repetitions++;
    }

    data.easeFactor = Math.max(1.3, data.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    data.nextReview = Date.now() + (data.interval * 24 * 60 * 60 * 1000);

    state.srs[cardId] = data;
    saveSRS();
}

function isCardDueForReview(cardId) {
    const data = getSRSData(cardId);
    return data.nextReview <= Date.now();
}

function sortCardsByReviewPriority(cards) {
    const now = Date.now();
    return [...cards].sort((a, b) => {
        const srsA = getSRSData(a.id);
        const srsB = getSRSData(b.id);
        const overdueA = now - srsA.nextReview;
        const overdueB = now - srsB.nextReview;
        return overdueB - overdueA;
    });
}

function getNextReviewTime() {
    let earliest = Infinity;
    for (const fc of state.currentFlashcards) {
        const data = getSRSData(fc.id);
        if (data.nextReview > Date.now() && data.nextReview < earliest) {
            earliest = data.nextReview;
        }
    }
    return earliest === Infinity ? null : earliest;
}

function formatRelativeTime(timestamp) {
    if (!timestamp) return 'mai';
    const diff = timestamp - Date.now();
    const hours = Math.round(diff / (1000 * 60 * 60));
    if (hours < 1) return 'tra pochi minuti';
    if (hours < 24) return `tra ${hours} ore`;
    const days = Math.round(hours / 24);
    return `tra ${days} giorn${days === 1 ? 'o' : 'i'}`;
}

// ===================================
// STATISTICS
// ===================================

function loadStats() {
    if (state.currentWorkspace) {
        const saved = localStorage.getItem(`stats_${state.currentWorkspace.id}`);
        if (saved) {
            state.stats = JSON.parse(saved);
        } else {
            state.stats = { studySessions: [], quizSessions: [], cardHistory: {}, totalStudyTimeMs: 0, totalQuizTimeMs: 0 };
        }
    }
}

function saveStats() {
    if (state.currentWorkspace) {
        localStorage.setItem(`stats_${state.currentWorkspace.id}`, JSON.stringify(state.stats));
    }
}

function recordStudySession(startTime, cardsStudied, correct, incorrect) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    state.stats.studySessions.push({ startTime, endTime, cardsStudied, correctCount: correct, incorrectCount: incorrect });
    state.stats.totalStudyTimeMs += duration;
    saveStats();
}

function recordQuizSession(startTime, endTime, totalQuestions, correct, incorrect, unanswered, score) {
    const duration = endTime - startTime;
    state.stats.quizSessions.push({ startTime, endTime, totalQuestions, correct, incorrect, unanswered, score });
    state.stats.totalQuizTimeMs += duration;
    saveStats();
}

function recordCardAnswer(cardId, correct, mode) {
    if (!state.stats.cardHistory[cardId]) {
        state.stats.cardHistory[cardId] = [];
    }
    state.stats.cardHistory[cardId].push({ timestamp: Date.now(), correct, mode });
    saveStats();
}

function calculateStreak() {
    const allSessions = [
        ...state.stats.studySessions.map(s => s.startTime),
        ...state.stats.quizSessions.map(s => s.startTime)
    ].sort((a, b) => b - a);

    if (allSessions.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessionDays = new Set();
    allSessions.forEach(ts => {
        const d = new Date(ts);
        d.setHours(0, 0, 0, 0);
        sessionDays.add(d.getTime());
    });

    let streak = 0;
    let checkDate = new Date(today);

    // Check if today or yesterday has a session
    if (!sessionDays.has(checkDate.getTime())) {
        checkDate.setDate(checkDate.getDate() - 1);
        if (!sessionDays.has(checkDate.getTime())) return 0;
    }

    while (sessionDays.has(checkDate.getTime())) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
    }

    return streak;
}

function calculateImprovement() {
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    let recentCorrect = 0, recentTotal = 0;
    let previousCorrect = 0, previousTotal = 0;

    for (const cardId in state.stats.cardHistory) {
        for (const entry of state.stats.cardHistory[cardId]) {
            const age = now - entry.timestamp;
            if (age < oneWeek) {
                recentTotal++;
                if (entry.correct) recentCorrect++;
            } else if (age < 2 * oneWeek) {
                previousTotal++;
                if (entry.correct) previousCorrect++;
            }
        }
    }

    if (previousTotal === 0 || recentTotal === 0) return null;

    const recentAccuracy = recentCorrect / recentTotal;
    const previousAccuracy = previousCorrect / previousTotal;

    return Math.round((recentAccuracy - previousAccuracy) * 100);
}

function calculateExamReadiness() {
    const total = state.currentFlashcards.length;
    if (total === 0) return 0;

    // Mastered: SRS interval >= 21 days
    let mastered = 0;
    let studied = 0;
    for (const fc of state.currentFlashcards) {
        const data = getSRSData(fc.id);
        if (data.interval >= 21) mastered++;
        if (data.repetitions > 0) studied++;
    }

    const masteredWeight = mastered / total;
    const coverageWeight = studied / total;

    // Recent accuracy
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    let recentCorrect = 0, recentTotal = 0;
    for (const cardId in state.stats.cardHistory) {
        for (const entry of state.stats.cardHistory[cardId]) {
            if (now - entry.timestamp < oneWeek) {
                recentTotal++;
                if (entry.correct) recentCorrect++;
            }
        }
    }
    const accuracyWeight = recentTotal > 0 ? recentCorrect / recentTotal : 0;

    // Consistency
    const streak = calculateStreak();
    const consistencyWeight = Math.min(1, streak / 7);

    const readiness = (masteredWeight * 0.4 + accuracyWeight * 0.3 + coverageWeight * 0.2 + consistencyWeight * 0.1) * 100;
    return Math.round(readiness);
}

function updateStatsPanel() {
    const panel = document.getElementById('statsPanel');
    if (!panel || state.currentFlashcards.length === 0) return;

    // Panoramica
    const studyHours = Math.floor(state.stats.totalStudyTimeMs / 3600000);
    const studyMins = Math.floor((state.stats.totalStudyTimeMs % 3600000) / 60000);
    document.getElementById('statTotalStudyTime').textContent = `${studyHours}h ${studyMins}m`;

    const quizHours = Math.floor(state.stats.totalQuizTimeMs / 3600000);
    const quizMins = Math.floor((state.stats.totalQuizTimeMs % 3600000) / 60000);
    document.getElementById('statTotalQuizTime').textContent = `${quizHours}h ${quizMins}m`;

    document.getElementById('statTotalSessions').textContent = state.stats.studySessions.length + state.stats.quizSessions.length;
    document.getElementById('statStreak').textContent = calculateStreak();

    // Rendimento
    let totalCorrect = 0, totalIncorrect = 0;
    for (const cardId in state.stats.cardHistory) {
        for (const entry of state.stats.cardHistory[cardId]) {
            if (entry.correct) totalCorrect++;
            else totalIncorrect++;
        }
    }

    document.getElementById('statCorrectTotal').textContent = totalCorrect;
    document.getElementById('statIncorrectTotal').textContent = totalIncorrect;

    const totalAnswers = totalCorrect + totalIncorrect;
    document.getElementById('statAccuracy').textContent = totalAnswers > 0 ? `${Math.round((totalCorrect / totalAnswers) * 100)}%` : '0%';

    const improvement = calculateImprovement();
    const improvementEl = document.getElementById('statImprovement');
    if (improvement !== null) {
        improvementEl.textContent = `${improvement > 0 ? '+' : ''}${improvement}%`;
        improvementEl.style.color = improvement >= 0 ? 'var(--success)' : 'var(--danger)';
    } else {
        improvementEl.textContent = '\u2014';
        improvementEl.style.color = '';
    }

    // Mastered & Critical
    let mastered = 0, critical = 0;
    for (const fc of state.currentFlashcards) {
        const data = getSRSData(fc.id);
        if (data.interval >= 21) mastered++;

        const history = state.stats.cardHistory[fc.id] || [];
        const wrongCount = history.filter(h => !h.correct).length;
        const lastCorrect = history.filter(h => h.correct).length > 0;
        if (wrongCount > 2 && !lastCorrect) critical++;
    }
    document.getElementById('statMastered').textContent = mastered;
    document.getElementById('statCritical').textContent = critical;

    // Exam Readiness
    const readiness = calculateExamReadiness();
    document.getElementById('statExamPercent').textContent = `${readiness}%`;

    const fillEl = document.getElementById('statExamFill');
    fillEl.style.width = `${readiness}%`;
    if (readiness < 30) {
        fillEl.style.background = 'var(--danger)';
    } else if (readiness < 70) {
        fillEl.style.background = '#f39c12';
    } else {
        fillEl.style.background = 'var(--success)';
    }

    let label = 'Inizio';
    if (readiness >= 85) label = 'Pronto!';
    else if (readiness >= 70) label = 'Buono';
    else if (readiness >= 50) label = 'Intermedio';
    else if (readiness >= 30) label = 'Base';
    document.getElementById('statExamLabel').textContent = label;

    // Quiz History
    const historyEl = document.getElementById('statQuizHistory');
    const recentQuizzes = state.stats.quizSessions.slice(-5).reverse();

    if (recentQuizzes.length === 0) {
        historyEl.innerHTML = '<p class="stats-empty">Nessun quiz completato</p>';
    } else {
        historyEl.innerHTML = recentQuizzes.map(q => {
            const date = new Date(q.startTime);
            const dateStr = date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
            const duration = Math.round((q.endTime - q.startTime) / 60000);
            return `<div class="quiz-history-item">
                <span class="quiz-history-date">${dateStr}</span>
                <span>${duration}min</span>
                <span>${q.totalQuestions} domande</span>
                <span class="quiz-history-score" style="color: ${q.score >= 60 ? 'var(--success)' : 'var(--danger)'}">${q.score}%</span>
            </div>`;
        }).join('');
    }
}

// ===================================
// STUDY MODE
// ===================================

function continueStudy() {
    enterStudyMode();
}

function enterStudyMode() {
    if (state.currentFlashcards.length === 0) return;

    // Filter cards due for review (SRS)
    let flashcardsToStudy = state.currentFlashcards.filter(fc => isCardDueForReview(fc.id));

    if (flashcardsToStudy.length === 0) {
        const nextReview = getNextReviewTime();
        if (nextReview) {
            showToast(`Nessuna flashcard da ripassare! Prossimo ripasso: ${formatRelativeTime(nextReview)}`, 'info');
        } else {
            showToast('Hai completato tutte le flashcard! Clicca "Ricomincia" nel menu gestione per ripeterle.', 'info');
        }
        return;
    }

    // Sort by review priority
    flashcardsToStudy = sortCardsByReviewPriority(flashcardsToStudy);

    state.studyMode.active = true;
    state.studyMode.flashcards = flashcardsToStudy;
    state.studyMode.currentIndex = 0;
    state.studyMode.viewingIncorrect = false;
    state.studyMode.canAdvance = false;
    state.studyMode.sessionStartTime = Date.now();

    document.getElementById('workspaceView').style.display = 'none';
    document.getElementById('studyModeView').style.display = 'block';

    // Show study progress bar, hide quiz
    document.getElementById('studyProgressBar').style.display = 'block';
    document.getElementById('quizProgressBar').style.display = 'none';

    // Show performance stats
    document.getElementById('studyPerformanceStats').style.display = 'flex';

    // Show study controls, hide quiz controls
    document.getElementById('shuffleBtn').style.display = 'inline-flex';
    document.getElementById('viewIncorrectBtn').style.display = 'inline-flex';
    document.getElementById('restartQuizBtn').style.display = 'none';
    document.getElementById('viewAllBtn').style.display = 'none';

    document.addEventListener('keydown', handleStudyModeKeyPress);

    renderStudyCard();
    updateIncorrectBadge();
}

function exitStudyMode() {
    // Record study session
    if (state.studyMode.sessionStartTime && !state.quizMode.active) {
        const correct = state.performance.correct.length;
        const incorrect = state.performance.incorrect.length;
        recordStudySession(state.studyMode.sessionStartTime, state.studyMode.flashcards.length, correct, incorrect);
    }

    // Stop quiz timer if active
    if (state.quizMode.active && state.quizMode.timerInterval) {
        clearInterval(state.quizMode.timerInterval);
        state.quizMode.timerInterval = null;
    }

    // Hide quiz timer
    document.getElementById('quizTimer').style.display = 'none';

    state.studyMode.active = false;
    state.studyMode.currentIndex = 0;
    state.studyMode.canAdvance = false;
    state.studyMode.sessionStartTime = null;
    state.quizMode.active = false;

    document.removeEventListener('keydown', handleStudyModeKeyPress);

    document.getElementById('studyModeView').style.display = 'none';
    document.getElementById('workspaceView').style.display = 'block';

    updateStatsPanel();
}

function renderStudyCard() {
    const card = state.studyMode.flashcards[state.studyMode.currentIndex];
    const cardEl = document.getElementById('studyCard');

    const isIncorrect = state.performance.incorrect.includes(card.id);

    cardEl.innerHTML = `
        ${isIncorrect ? '<div class="incorrect-badge" title="Risposta sbagliata"></div>' : ''}
        <div class="study-card-actions">
            <button class="btn-icon" onclick="editStudyFlashcard()" title="Modifica">&#9998;</button>
            <button class="btn-icon btn-danger" onclick="deleteStudyFlashcard()" title="Elimina">&#128465;</button>
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
            <strong>Spiegazione:</strong> ${escapeHtml(card.explanation)}
        </div>
    `;

    document.getElementById('prevCardBtn').disabled = state.studyMode.currentIndex === 0;
    document.getElementById('nextCardBtn').disabled = state.studyMode.currentIndex === state.studyMode.flashcards.length - 1;

    updateProgressBar();
    state.studyMode.canAdvance = false;
}

function updateProgressBar() {
    const completed = state.studyMode.currentIndex + 1;
    const total = state.studyMode.flashcards.length;
    const percentage = (completed / total) * 100;

    if (state.quizMode.active) {
        document.getElementById('quizProgressCompleted').textContent = completed;
        document.getElementById('quizProgressTotal').textContent = total;
        document.getElementById('quizProgressBarFill').style.width = `${percentage}%`;
    } else {
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

    // Quiz mode logic
    if (state.quizMode.active) {
        const alreadyAnswered = state.quizMode.answers.some(a => a.cardId === card.id);
        if (alreadyAnswered) return;

        const isCorrect = optionIndex === card.correctAnswer;

        state.quizMode.answers.push({
            cardId: card.id,
            selectedAnswer: optionIndex,
            correctAnswer: card.correctAnswer,
            isCorrect
        });

        // Record for stats
        recordCardAnswer(card.id, isCorrect, 'quiz');

        options.forEach(opt => opt.classList.remove('selected'));
        options[optionIndex].classList.add('selected');

        state.studyMode.canAdvance = true;

        if (state.studyMode.currentIndex < state.studyMode.flashcards.length - 1) {
            setTimeout(() => navigateStudyCard(1), 300);
        } else {
            setTimeout(() => endQuiz(), 300);
        }

        return;
    }

    // Study mode logic
    const alreadyAnswered = Array.from(options).some(opt =>
        opt.classList.contains('correct') || opt.classList.contains('incorrect')
    );

    if (alreadyAnswered) return;

    options.forEach(opt => {
        opt.classList.remove('selected', 'correct', 'incorrect');
    });

    options[optionIndex].classList.add('selected');

    const isCorrect = optionIndex === card.correctAnswer;

    if (isCorrect) {
        options[optionIndex].classList.add('correct');

        if (!state.performance.correct.includes(card.id)) {
            state.performance.correct.push(card.id);

            if (!state.performance.incorrect.includes(card.id) && !state.performance.correctFirstAttempt.includes(card.id)) {
                state.performance.correctFirstAttempt.push(card.id);
            }

            const incorrectIndex = state.performance.incorrect.indexOf(card.id);
            if (incorrectIndex > -1) {
                state.performance.incorrect.splice(incorrectIndex, 1);
            }
        }

        // SM-2: quality based on history
        const wasIncorrect = state.performance.incorrect.includes(card.id);
        updateSRS(card.id, wasIncorrect ? 3 : 5);
    } else {
        options[optionIndex].classList.add('incorrect');
        options[card.correctAnswer].classList.add('correct');

        if (!state.performance.incorrect.includes(card.id)) {
            state.performance.incorrect.push(card.id);

            const firstAttemptIndex = state.performance.correctFirstAttempt.indexOf(card.id);
            if (firstAttemptIndex > -1) {
                state.performance.correctFirstAttempt.splice(firstAttemptIndex, 1);
            }

            const correctIndex = state.performance.correct.indexOf(card.id);
            if (correctIndex > -1) {
                state.performance.correct.splice(correctIndex, 1);
            }
        }

        // SM-2: wrong answer
        updateSRS(card.id, 0);
    }

    // Record for stats
    recordCardAnswer(card.id, isCorrect, 'study');

    savePerformance();
    updatePerformanceStats();
    updateIncorrectBadge();

    explanationEl.classList.add('show');
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
    if (!state.studyMode.active) return;

    if (e.key === 'Enter' && state.studyMode.canAdvance) {
        e.preventDefault();
        if (state.studyMode.currentIndex < state.studyMode.flashcards.length - 1) {
            navigateStudyCard(1);
        }
    }

    if (e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const optionIndex = parseInt(e.key) - 1;
        const card = state.studyMode.flashcards[state.studyMode.currentIndex];
        if (optionIndex < card.options.length) {
            selectStudyAnswer(optionIndex);
        }
    }
}

// ===================================
// QUIZ MODE
// ===================================

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

    closeQuizModal();

    const shuffled = [...state.currentFlashcards].sort(() => Math.random() - 0.5);
    const selectedFlashcards = shuffled.slice(0, questionsCount);

    state.quizMode.active = true;
    state.quizMode.duration = duration;
    state.quizMode.startTime = Date.now();
    state.quizMode.endTime = Date.now() + (duration * 60 * 1000);
    state.quizMode.answers = [];

    state.studyMode.active = true;
    state.studyMode.flashcards = selectedFlashcards;
    state.studyMode.currentIndex = 0;
    state.studyMode.viewingIncorrect = false;
    state.studyMode.canAdvance = false;
    state.studyMode.sessionStartTime = Date.now();

    document.getElementById('workspaceView').style.display = 'none';
    document.getElementById('studyModeView').style.display = 'block';

    // Show quiz progress bar, hide study
    document.getElementById('studyProgressBar').style.display = 'none';
    document.getElementById('quizProgressBar').style.display = 'block';

    // Hide performance stats in quiz mode
    document.getElementById('studyPerformanceStats').style.display = 'none';

    // Hide study controls, keep restartQuiz hidden until needed
    document.getElementById('shuffleBtn').style.display = 'none';
    document.getElementById('viewIncorrectBtn').style.display = 'none';
    document.getElementById('viewAllBtn').style.display = 'none';
    document.getElementById('restartQuizBtn').style.display = 'none';

    // Show timer
    document.getElementById('quizTimer').style.display = 'inline';

    startQuizTimer();
    document.addEventListener('keydown', handleStudyModeKeyPress);

    renderStudyCard();
    showToast(`Quiz avviato! ${questionsCount} domande in ${duration} minuti`, 'success');
}

function startQuizTimer() {
    updateQuizTimer();
    state.quizMode.timerInterval = setInterval(() => {
        updateQuizTimer();
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

    document.getElementById('quizTimeRemaining').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const timerEl = document.getElementById('quizTimer');
    if (remaining < 120000) {
        timerEl.style.color = 'var(--danger)';
        timerEl.style.animation = 'pulse 1s infinite';
    }
}

function endQuiz() {
    if (state.quizMode.timerInterval) {
        clearInterval(state.quizMode.timerInterval);
        state.quizMode.timerInterval = null;
    }

    document.getElementById('quizTimer').style.display = 'none';

    const correctCount = state.quizMode.answers.filter(a => a.isCorrect).length;
    const answeredCount = state.quizMode.answers.length;
    const totalQuestions = state.studyMode.flashcards.length;
    const unansweredCount = totalQuestions - answeredCount;
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    // Record quiz session for stats
    recordQuizSession(
        state.quizMode.startTime,
        Date.now(),
        totalQuestions,
        correctCount,
        answeredCount - correctCount,
        unansweredCount,
        percentage
    );

    let resultMessage = `Quiz Terminato!\n\n`;
    resultMessage += `Risposte Corrette: ${correctCount}\n`;
    resultMessage += `Risposte Sbagliate: ${answeredCount - correctCount}\n`;
    if (unansweredCount > 0) {
        resultMessage += `Domande Non Risposte: ${unansweredCount}\n`;
    }
    resultMessage += `Totale Domande: ${totalQuestions}\n\n`;
    resultMessage += `Punteggio Finale: ${percentage}%`;

    alert(resultMessage);

    showToast(`Quiz terminato! ${correctCount}/${totalQuestions} corrette (${percentage}%)`,
        percentage >= 60 ? 'success' : 'warning');

    state.quizMode.active = false;
    state.quizMode.answers = [];

    exitStudyMode();
}

function restartQuiz() {
    if (!state.quizMode.active) return;

    state.studyMode.currentIndex = 0;
    state.quizMode.startTime = Date.now();
    state.quizMode.endTime = Date.now() + (state.quizMode.duration * 60 * 1000);
    state.quizMode.answers = [];

    if (state.quizMode.timerInterval) {
        clearInterval(state.quizMode.timerInterval);
    }
    startQuizTimer();

    renderStudyCard();
    showToast('Quiz riavviato!', 'info');
}

// ===================================
// STUDY ADVANCED FEATURES
// ===================================

function updateIncorrectBadge() {
    const badge = document.getElementById('incorrectCountBadge');
    if (badge) badge.textContent = state.performance.incorrect.length;
}

function shuffleFlashcards() {
    if (!state.studyMode.active) return;

    const flashcards = [...state.studyMode.flashcards];
    for (let i = flashcards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [flashcards[i], flashcards[j]] = [flashcards[j], flashcards[i]];
    }

    state.studyMode.flashcards = flashcards;
    state.studyMode.currentIndex = 0;
    renderStudyCard();
    showToast('Flashcard mescolate!', 'success');
}

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
    state.studyMode.viewingIncorrect = true;
    renderStudyCard();

    document.getElementById('viewAllBtn').style.display = 'inline-flex';
    showToast(`Mostrando ${incorrectFlashcards.length} flashcard sbagliate`, 'info');
}

function viewAllFlashcards() {
    if (!state.studyMode.active) return;

    // Show ALL cards regardless of SRS
    state.studyMode.flashcards = sortCardsByReviewPriority(state.currentFlashcards);
    state.studyMode.currentIndex = 0;
    state.studyMode.viewingIncorrect = false;
    renderStudyCard();

    document.getElementById('viewAllBtn').style.display = 'none';
    showToast(`Mostrando tutte le ${state.currentFlashcards.length} flashcard`, 'success');
}

function restartStudy() {
    if (state.currentFlashcards.length === 0) return;

    if (!confirm('Vuoi ricominciare da capo? Le statistiche e i progressi SRS verranno resettati.')) return;

    state.performance = { correct: [], incorrect: [], correctFirstAttempt: [] };
    state.srs = {};

    savePerformance();
    saveSRS();
    updatePerformanceStats();
    renderFlashcards();
    updateStatsPanel();

    showToast('Studio riavviato! Buona fortuna!', 'success');
}

// ===================================
// VIEW MANAGEMENT
// ===================================

function showWelcomeScreen() {
    document.getElementById('welcomeScreen').style.display = 'flex';
    document.getElementById('workspaceView').style.display = 'none';
}

function showWorkspaceView() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('workspaceView').style.display = 'block';

    // Close management panel by default
    document.getElementById('managementPanel').style.display = 'none';

    if (state.currentWorkspace) {
        document.getElementById('workspaceName').textContent = state.currentWorkspace.name;
        document.getElementById('workspaceDescription').textContent = state.currentWorkspace.description || 'Nessuna descrizione';
    }
}

// ===================================
// UTILITY FUNCTIONS
// ===================================

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

// ===================================
// PROGRESS POLLING
// ===================================

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
    }, 1000);
}

function updateProgressUI(progress) {
    const progressSection = document.getElementById('progressSection');
    const progressFlashcards = document.getElementById('progressFlashcards');
    const progressTime = document.getElementById('progressTime');
    const progressFill = document.getElementById('progressFill');
    const uploadStatus = document.getElementById('uploadStatus');

    const elapsed = new Date() - new Date(progress.startTime);

    if (progress.status === 'cancelled') {
        progressSection.textContent = `Interrotto`;
        progressFlashcards.textContent = `${progress.flashcardsGenerated} flashcard salvate`;
        progressFill.style.width = '100%';
        uploadStatus.textContent = `Interrotto - ${progress.flashcardsGenerated} flashcard salvate`;
        progressTime.textContent = '';
    } else if (progress.currentBatch > 0 && progress.totalBatches > 0) {
        const percentage = (progress.currentBatch / progress.totalBatches) * 100;

        progressSection.textContent = `Batch ${progress.currentBatch}/${progress.totalBatches}`;
        progressFlashcards.textContent = `${progress.flashcardsGenerated} flashcard generate`;
        progressFill.style.width = `${percentage}%`;
        uploadStatus.textContent = `Generando flashcard...`;

        const avgTimePerBatch = elapsed / progress.currentBatch;
        const remainingBatches = progress.totalBatches - progress.currentBatch;
        const estimatedRemainingMs = avgTimePerBatch * remainingBatches;

        if (remainingBatches > 0) {
            const estSeconds = Math.floor(estimatedRemainingMs / 1000);
            const estMinutes = Math.floor(estSeconds / 60);
            const estSecondsRemainder = estSeconds % 60;
            progressTime.textContent = `Tempo rimanente: ~${estMinutes}m ${estSecondsRemainder < 10 ? '0' : ''}${estSecondsRemainder}s`;
        } else {
            progressTime.textContent = `Completamento in corso...`;
        }
    } else {
        progressSection.textContent = `AI sta leggendo il documento...`;
        progressFlashcards.textContent = `Analisi in corso`;
        progressFill.style.width = '10%';
        uploadStatus.textContent = `Preparazione batch in corso...`;
        progressTime.textContent = `In attesa della prima risposta AI...`;
    }

    state.uploadProgress = { ...progress, active: true };
}

async function cancelUpload() {
    if (!state.currentWorkspace || !state.uploadProgress.active) return;

    if (!confirm('Sei sicuro di voler fermare la generazione? Le flashcard già create verranno salvate.')) return;

    try {
        await apiCall(`/workspaces/${state.currentWorkspace.id}/upload/cancel`, { method: 'POST' });
        state.uploadProgress.active = false;
        showToast('Generazione fermata', 'info');
    } catch (error) {
        showToast('Errore nel fermare la generazione', 'error');
    }
}

// ===================================
// EDIT/DELETE IN STUDY MODE
// ===================================

function editStudyFlashcard() {
    const card = state.studyMode.flashcards[state.studyMode.currentIndex];

    state.editingFlashcardId = card.id;

    document.getElementById('editQuestionInput').value = card.question;
    document.getElementById('editOption0').value = card.options[0];
    document.getElementById('editOption1').value = card.options[1];
    document.getElementById('editOption2').value = card.options[2];
    document.getElementById('editOption3').value = card.options[3];
    document.getElementById('editCorrectAnswer').value = card.correctAnswer;
    document.getElementById('editExplanation').value = card.explanation;

    document.getElementById('editFlashcardModal').classList.add('show');
}

function closeEditFlashcardModal() {
    document.getElementById('editFlashcardModal').classList.remove('show');
}

async function saveEditedFlashcard() {
    const flashcardId = state.editingFlashcardId;

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

    if (!cardData.question || cardData.options.some(opt => !opt) || !cardData.explanation) {
        showToast('Compila tutti i campi obbligatori', 'error');
        return;
    }

    try {
        let savedCard;

        if (flashcardId) {
            savedCard = await apiCall(`/flashcards/${flashcardId}`, {
                method: 'PUT',
                body: JSON.stringify(cardData)
            });

            const mainCard = state.currentFlashcards.find(fc => fc.id === flashcardId);
            if (mainCard) Object.assign(mainCard, savedCard);

            if (state.studyMode.active) {
                const studyCard = state.studyMode.flashcards[state.studyMode.currentIndex];
                if (studyCard && studyCard.id === flashcardId) {
                    Object.assign(studyCard, savedCard);
                }
                renderStudyCard();
            }

            showToast('Flashcard modificata con successo!', 'success');
        } else {
            savedCard = await apiCall(`/workspaces/${state.currentWorkspace.id}/flashcards`, {
                method: 'POST',
                body: JSON.stringify(cardData)
            });

            state.currentFlashcards.push(savedCard);
            showToast('Flashcard creata con successo!', 'success');
        }

        renderFlashcards();
        closeEditFlashcardModal();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteStudyFlashcard() {
    const card = state.studyMode.flashcards[state.studyMode.currentIndex];

    if (!confirm('Sei sicuro di voler eliminare questa flashcard?')) return;

    try {
        await apiCall(`/flashcards/${card.id}`, { method: 'DELETE' });

        state.studyMode.flashcards.splice(state.studyMode.currentIndex, 1);
        state.currentFlashcards = state.currentFlashcards.filter(fc => fc.id !== card.id);

        if (state.studyMode.flashcards.length === 0) {
            showToast('Tutte le flashcard eliminate', 'info');
            exitStudyMode();
            renderFlashcards();
            return;
        }

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

// ===================================
// EVENT LISTENERS FOR EDIT MODAL
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('closeEditFlashcardBtn').addEventListener('click', closeEditFlashcardModal);
    document.getElementById('cancelEditFlashcardBtn').addEventListener('click', closeEditFlashcardModal);
    document.getElementById('saveEditFlashcardBtn').addEventListener('click', saveEditedFlashcard);
});

// ===================================
// GLOBAL WINDOW FUNCTIONS
// ===================================

window.selectWorkspace = selectWorkspace;
window.selectAnswer = selectAnswer;
window.deleteFlashcard = deleteFlashcard;
window.selectStudyAnswer = selectStudyAnswer;
window.shuffleFlashcards = shuffleFlashcards;
window.viewIncorrectFlashcards = viewIncorrectFlashcards;
window.viewAllFlashcards = viewAllFlashcards;
window.editStudyFlashcard = editStudyFlashcard;
window.deleteStudyFlashcard = deleteStudyFlashcard;
window.editFlashcard = editFlashcard;
window.continueStudy = continueStudy;
window.restartQuiz = restartQuiz;
