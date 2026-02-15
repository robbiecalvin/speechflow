let activeBubble = null;
const sidebarEl = document.getElementById('sidebar');

function getSidebarWidth() {
  if (!sidebarEl) return 280;
  return sidebarEl.getBoundingClientRect().width;
}

function getWorkspaceWidth() {
  return Math.max(window.innerWidth - getSidebarWidth(), 1);
}

function getWorkspaceCenterWorld() {
  return {
    x: camX + getWorkspaceWidth() / 2 / zoom,
    y: camY + window.innerHeight / 2 / zoom
  };
}

function screenToWorldX(clientX) {
  return camX + (clientX - getSidebarWidth()) / zoom;
}

function clampBubbleToWorkspace(data) {
  if (data.x < camX) {
    data.x = camX;
  }
}

function clampCameraToWorkspace() {
  if (!bubbles.length) return;
  const leftmostBubbleX = Math.min(...bubbles.map((b) => b.x));
  if (camX > leftmostBubbleX) {
    camX = leftmostBubbleX;
  }
}

function highlightBubble(bubbleEl) {
  document.querySelectorAll('.bubble').forEach(b => b.classList.remove('active'));
  if (bubbleEl) bubbleEl.classList.add('active');
}

function getBubbleDisplayText(bubbleData) {
  return (bubbleData.textEl?.textContent || '').trim();
}

const ALLOWED_BUBBLE_TYPES = ['idea', 'task', 'question', 'blocker', 'note'];
const DEFAULT_BUBBLE_TYPE_LABELS = {
  idea: 'Idea',
  task: 'Task',
  question: 'Question',
  blocker: 'Blocker',
  note: 'Note'
};
let bubbleTypeLabels = { ...DEFAULT_BUBBLE_TYPE_LABELS };
let bubbleTypesLocked = false;
let mapName = 'Untitled Map';
let isBubbleColumnCollapsed = false;
let collapsedAudioStep = 0;
let mapDatabase = [];
let activeMapId = null;
const bubbleTypeInputs = {
  idea: document.getElementById('bubbleTypeIdea'),
  task: document.getElementById('bubbleTypeTask'),
  question: document.getElementById('bubbleTypeQuestion'),
  blocker: document.getElementById('bubbleTypeBlocker'),
  note: document.getElementById('bubbleTypeNote')
};
const saveBubbleTypesBtn = document.getElementById('saveBubbleTypes');
const sidebarColumnsEl = document.getElementById('sidebarColumns');
const floatingMapNameEl = document.getElementById('floatingMapName');
const newMapBtn = document.getElementById('newMapBtn');
const mapHistoryBtn = document.getElementById('mapHistoryBtn');
const exportMapIconBtn = document.getElementById('exportMapIconBtn');
const importMapIconBtn = document.getElementById('importMapIconBtn');
const toggleBubbleColumnBtn = document.getElementById('toggleBubbleColumn');
const mapSetupModal = document.getElementById('mapSetupModal');
const mapNameInput = document.getElementById('mapNameInput');
const closeMapSetupBtn = document.getElementById('closeMapSetup');
const mapSetupError = document.getElementById('mapSetupError');
const mapHistoryModal = document.getElementById('mapHistoryModal');
const mapHistoryList = document.getElementById('mapHistoryList');
const closeMapHistoryBtn = document.getElementById('closeMapHistory');
const promptModal = document.getElementById('promptModal');
const promptModalInput = document.getElementById('promptModalInput');
const promptModalError = document.getElementById('promptModalError');
const promptModalCreateBtn = document.getElementById('promptModalCreate');
const promptModalCancelBtn = document.getElementById('promptModalCancel');
const audioExpandedControls = document.getElementById('audioExpandedControls');
const audioSingleToggle = document.getElementById('audioSingleToggle');
const audioPlayStopToggle = document.getElementById('audioPlayStopToggle');
const audioPauseResumeToggle = document.getElementById('audioPauseResumeToggle');
const audioPlayStopIcon = audioPlayStopToggle?.querySelector('.btn-icon');
const audioPlayStopLabel = audioPlayStopToggle?.querySelector('.btn-label');
const audioPauseResumeIcon = audioPauseResumeToggle?.querySelector('.btn-icon');
const audioPauseResumeLabel = audioPauseResumeToggle?.querySelector('.btn-label');
const audioSingleIcon = audioSingleToggle?.querySelector('.btn-icon');
const audioSingleLabel = audioSingleToggle?.querySelector('.btn-label');
const bubbleEditorModal = document.getElementById('bubbleEditorModal');
const bubbleEditorMeta = document.getElementById('bubbleEditorMeta');
const bubbleEditorInputArea = document.getElementById('bubbleEditorInputArea');
const bubbleEditorInputLabel = document.getElementById('bubbleEditorInputLabel');
const bubbleEditorTextInput = document.getElementById('bubbleEditorTextInput');
const bubbleEditorTypeSelect = document.getElementById('bubbleEditorTypeSelect');
const bubbleEditorOrderInput = document.getElementById('bubbleEditorOrderInput');
const bubbleEditorError = document.getElementById('bubbleEditorError');
const bubbleEditorApply = document.getElementById('bubbleEditorApply');
const bubbleEditorClose = document.getElementById('bubbleEditorClose');
let bubbleEditorState = { bubbleData: null, action: null };

function titleCaseFirst(input) {
  if (!input) return input;
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function setMapName(nextName) {
  mapName = (nextName || '').trim() || 'Untitled Map';
  if (floatingMapNameEl) floatingMapNameEl.textContent = mapName;
}

function generateMapId() {
  return `map_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadMapDatabase() {
  try {
    const raw = localStorage.getItem('mapDatabase');
    mapDatabase = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(mapDatabase)) mapDatabase = [];
  } catch (err) {
    mapDatabase = [];
  }
}

function saveMapDatabase() {
  localStorage.setItem('mapDatabase', JSON.stringify(mapDatabase));
}

function upsertCurrentMapRecord() {
  if (!activeMapId || !undoStack.length) return;
  const latestSnapshot = undoStack[undoStack.length - 1];
  const idx = mapDatabase.findIndex((m) => m.id === activeMapId);
  const record = {
    id: activeMapId,
    name: mapName,
    snapshot: latestSnapshot,
    updatedAt: Date.now()
  };
  if (idx >= 0) mapDatabase[idx] = record;
  else mapDatabase.push(record);
  saveMapDatabase();
}

function renderMapHistoryList() {
  if (!mapHistoryList) return;
  mapHistoryList.innerHTML = '';
  const sorted = [...mapDatabase].sort((a, b) => b.updatedAt - a.updatedAt);
  if (!sorted.length) {
    const empty = document.createElement('div');
    empty.className = 'history-meta';
    empty.textContent = 'No saved maps yet.';
    mapHistoryList.appendChild(empty);
    return;
  }
  sorted.forEach((record) => {
    const row = document.createElement('div');
    row.className = 'history-item';

    const metaWrap = document.createElement('div');
    const nameEl = document.createElement('div');
    nameEl.className = 'history-name';
    nameEl.textContent = record.name || 'Untitled Map';
    const dateEl = document.createElement('div');
    dateEl.className = 'history-meta';
    dateEl.textContent = new Date(record.updatedAt).toLocaleString();
    metaWrap.appendChild(nameEl);
    metaWrap.appendChild(dateEl);

    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.textContent = 'Load';
    loadBtn.addEventListener('click', () => {
      activeMapId = record.id;
      restoreStateFromSnapshot(record.snapshot);
      closeMapHistoryModal();
      saveSnapshot();
    });

    row.appendChild(metaWrap);
    row.appendChild(loadBtn);
    mapHistoryList.appendChild(row);
  });
}

function clearMapData() {
  document.querySelectorAll('.bubble').forEach((b) => b.remove());
  bubbles.length = 0;
  connections.length = 0;
  activeBubble = null;
  pendingConnectionFrom = null;
  selectedBubble = null;
  playbackActive = false;
  playbackPaused = false;
  orderedPlayback = [];
  playbackIndex = 0;
  window.speechSynthesis.cancel();
  updateAudioControlsUI();
  updateSidebar();
}

function normalizeBubbleTypeLabel(label, fallback) {
  const trimmed = (label || '').trim();
  return trimmed || fallback;
}

function getBubbleTypeLabel(type) {
  return bubbleTypeLabels[type] || DEFAULT_BUBBLE_TYPE_LABELS[type] || titleCaseFirst(type);
}

function refreshBubbleTypeSelectOptions() {
  if (!bubbleEditorTypeSelect) return;
  Array.from(bubbleEditorTypeSelect.options).forEach((opt) => {
    opt.textContent = getBubbleTypeLabel(opt.value);
  });
}

function setBubbleTypesLocked(locked) {
  bubbleTypesLocked = !!locked;
  ALLOWED_BUBBLE_TYPES.forEach((type) => {
    if (bubbleTypeInputs[type]) bubbleTypeInputs[type].disabled = bubbleTypesLocked;
  });
  if (saveBubbleTypesBtn) {
    saveBubbleTypesBtn.disabled = bubbleTypesLocked;
    saveBubbleTypesBtn.textContent = bubbleTypesLocked ? 'Bubble Types Saved' : 'Save Bubble Types';
  }
}

function applyBubbleTypeConfig(config = {}) {
  const nextLabels = config.labels || {};
  const usePlaceholders = !!config.usePlaceholders;
  ALLOWED_BUBBLE_TYPES.forEach((type) => {
    const fallback = DEFAULT_BUBBLE_TYPE_LABELS[type];
    const nextValue = normalizeBubbleTypeLabel(nextLabels[type], fallback);
    bubbleTypeLabels[type] = nextValue;
    if (bubbleTypeInputs[type]) {
      bubbleTypeInputs[type].value = usePlaceholders ? '' : nextValue;
    }
  });
  setBubbleTypesLocked(!!config.locked);
  refreshBubbleTypeSelectOptions();
}

function saveConfiguredBubbleTypes(saveHistory = true) {
  if (bubbleTypesLocked) return;
  ALLOWED_BUBBLE_TYPES.forEach((type) => {
    const fallback = DEFAULT_BUBBLE_TYPE_LABELS[type];
    bubbleTypeLabels[type] = normalizeBubbleTypeLabel(bubbleTypeInputs[type]?.value, fallback);
    if (bubbleTypeInputs[type]) bubbleTypeInputs[type].value = bubbleTypeLabels[type];
  });
  setBubbleTypesLocked(true);
  refreshBubbleTypeSelectOptions();
  if (saveHistory) saveSnapshot();
}

function updateBubbleColumnLayout() {
  if (!sidebarColumnsEl) return;
  sidebarColumnsEl.classList.toggle('collapsed', isBubbleColumnCollapsed);
  if (sidebarEl) {
    sidebarEl.classList.toggle('collapsed', isBubbleColumnCollapsed);
  }
  if (toggleBubbleColumnBtn) {
    const icon = toggleBubbleColumnBtn.querySelector('.btn-icon');
    if (icon) icon.textContent = isBubbleColumnCollapsed ? '▸' : '◂';
  }
  updateAudioControlsUI();
}

function updateAudioControlsUI() {
  if (!audioExpandedControls || !audioSingleToggle) return;
  if (isBubbleColumnCollapsed) {
    audioExpandedControls.classList.add('hidden');
    audioSingleToggle.classList.remove('hidden');
    if (audioSingleLabel) audioSingleLabel.textContent = 'Play / Pause / Resume / Stop';
    if (audioSingleIcon) {
      if (collapsedAudioStep === 0) audioSingleIcon.textContent = '▶️';
      else if (collapsedAudioStep === 1) audioSingleIcon.textContent = '⏸';
      else if (collapsedAudioStep === 2) audioSingleIcon.textContent = '⏵';
      else audioSingleIcon.textContent = '⏹';
    }
    return;
  }

  audioExpandedControls.classList.remove('hidden');
  audioSingleToggle.classList.add('hidden');

  if (!playbackActive) {
    if (audioPlayStopIcon) audioPlayStopIcon.textContent = '▶️';
    if (audioPlayStopLabel) audioPlayStopLabel.textContent = 'Play';
    if (audioPauseResumeIcon) audioPauseResumeIcon.textContent = '⏸';
    if (audioPauseResumeLabel) audioPauseResumeLabel.textContent = 'Pause';
    audioPauseResumeToggle.disabled = true;
    return;
  }

  if (audioPlayStopIcon) audioPlayStopIcon.textContent = '⏹';
  if (audioPlayStopLabel) audioPlayStopLabel.textContent = 'Stop';
  audioPauseResumeToggle.disabled = false;
  if (audioPauseResumeIcon) audioPauseResumeIcon.textContent = playbackPaused ? '▶️' : '⏸';
  if (audioPauseResumeLabel) audioPauseResumeLabel.textContent = playbackPaused ? 'Resume' : 'Pause';
}

function openMapSetupModal(prefillFromCurrent = false) {
  if (!mapSetupModal) return;
  mapSetupError.classList.add('hidden');
  mapSetupError.textContent = '';
  mapNameInput.value = prefillFromCurrent ? mapName : '';
  ALLOWED_BUBBLE_TYPES.forEach((type) => {
    if (bubbleTypeInputs[type]) {
      bubbleTypeInputs[type].value = prefillFromCurrent ? getBubbleTypeLabel(type) : '';
      bubbleTypeInputs[type].disabled = false;
    }
  });
  bubbleTypesLocked = false;
  if (saveBubbleTypesBtn) {
    saveBubbleTypesBtn.disabled = false;
    saveBubbleTypesBtn.textContent = 'Save Bubble Types';
  }
  mapSetupModal.classList.remove('hidden');
  mapSetupModal.setAttribute('aria-hidden', 'false');
}

function closeMapSetupModal() {
  if (!mapSetupModal) return;
  mapSetupModal.classList.add('hidden');
  mapSetupModal.setAttribute('aria-hidden', 'true');
}

function openMapHistoryModal() {
  if (!mapHistoryModal) return;
  renderMapHistoryList();
  mapHistoryModal.classList.remove('hidden');
  mapHistoryModal.setAttribute('aria-hidden', 'false');
}

function closeMapHistoryModal() {
  if (!mapHistoryModal) return;
  mapHistoryModal.classList.add('hidden');
  mapHistoryModal.setAttribute('aria-hidden', 'true');
}

function openPromptModal() {
  if (!promptModal) return;
  promptModal.classList.remove('hidden');
  promptModal.setAttribute('aria-hidden', 'false');
  promptModalError.classList.add('hidden');
  promptModalError.textContent = '';
  promptModalInput.value = '';
  promptModalInput.focus();
}

function closePromptModal() {
  if (!promptModal) return;
  promptModal.classList.add('hidden');
  promptModal.setAttribute('aria-hidden', 'true');
}

function createFromPromptText(prompt) {
  const text = (prompt || '').trim();
  if (!text) {
    promptModalError.textContent = 'Type something first.';
    promptModalError.classList.remove('hidden');
    return;
  }

  const center = getWorkspaceCenterWorld();
  const centerX = center.x;
  const centerY = center.y;
  const centerBubble = createBubble(text, centerX, centerY, 'idea');

  const related = [
    `Why is "${text}" important?`,
    `How does "${text}" affect others?`,
    `What comes after "${text}"?`,
    `Obstacles to "${text}"`,
    `Steps to achieve "${text}"`
  ];

  shuffleArray(related);
  const count = Math.floor(Math.random() * 3) + 3;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i;
    const radius = 220;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    const childBubble = createBubble(related[i], x, y, 'question');
    connections.push({ from: centerBubble, to: childBubble, label: '' });
  }

  updateSidebar();
  saveSnapshot();
  closePromptModal();
}

function createNewMapFromSetup() {
  const proposedMapName = (mapNameInput?.value || '').trim();
  if (!proposedMapName) {
    mapSetupError.textContent = 'Map name is required.';
    mapSetupError.classList.remove('hidden');
    return;
  }
  const configuredLabels = {};
  ALLOWED_BUBBLE_TYPES.forEach((type) => {
    configuredLabels[type] = normalizeBubbleTypeLabel(
      bubbleTypeInputs[type]?.value,
      DEFAULT_BUBBLE_TYPE_LABELS[type]
    );
  });
  setMapName(proposedMapName);
  activeMapId = generateMapId();
  undoStack = [];
  redoStack = [];
  localStorage.removeItem('bubbleHistory');
  clearMapData();
  applyBubbleTypeConfig({ labels: configuredLabels, locked: true, usePlaceholders: false });
  closeMapSetupModal();
  saveSnapshot();
}

function setBubbleType(data, newType) {
  if (!ALLOWED_BUBBLE_TYPES.includes(newType)) return;
  data.type = newType;
  data.el.className = `bubble ${newType}`;
  data.el.classList.toggle('locked', !!data.locked);
  if (activeBubble === data) data.el.classList.add('active');
}

function removeBubble(data, shouldSaveSnapshot = true) {
  if (data?.el?.parentNode) data.el.parentNode.removeChild(data.el);
  const index = bubbles.indexOf(data);
  if (index > -1) bubbles.splice(index, 1);
  for (let i = connections.length - 1; i >= 0; i--) {
    if (connections[i].from === data || connections[i].to === data) {
      connections.splice(i, 1);
    }
  }
  if (activeBubble === data) activeBubble = null;
  updateBubbleIds();
  updateSidebar();
  if (shouldSaveSnapshot) saveSnapshot();
}

function moveBubbleToIndex(bubbleData, targetIndex) {
  const fromIndex = bubbles.indexOf(bubbleData);
  if (fromIndex < 0) return false;
  const boundedIndex = Math.max(0, Math.min(targetIndex, bubbles.length - 1));
  if (fromIndex === boundedIndex) return false;
  const [moving] = bubbles.splice(fromIndex, 1);
  bubbles.splice(boundedIndex, 0, moving);
  return true;
}

function closeBubbleEditorModal() {
  if (!bubbleEditorModal) return;
  bubbleEditorModal.classList.add('hidden');
  bubbleEditorModal.setAttribute('aria-hidden', 'true');
  bubbleEditorState = { bubbleData: null, action: null };
  bubbleEditorInputArea.classList.add('hidden');
  bubbleEditorTextInput.classList.add('hidden');
  bubbleEditorTypeSelect.classList.add('hidden');
  bubbleEditorOrderInput.classList.add('hidden');
  bubbleEditorApply.classList.add('hidden');
  bubbleEditorError.classList.add('hidden');
  bubbleEditorError.textContent = '';
}

function showBubbleEditorError(message) {
  bubbleEditorError.textContent = message;
  bubbleEditorError.classList.remove('hidden');
}

function setBubbleEditorAction(action) {
  bubbleEditorState.action = action;
  bubbleEditorError.classList.add('hidden');
  bubbleEditorError.textContent = '';

  if (action === 'delete') {
    removeBubble(bubbleEditorState.bubbleData, true);
    closeBubbleEditorModal();
    return;
  }

  bubbleEditorInputArea.classList.remove('hidden');
  bubbleEditorApply.classList.remove('hidden');
  bubbleEditorTextInput.classList.add('hidden');
  bubbleEditorTypeSelect.classList.add('hidden');
  bubbleEditorOrderInput.classList.add('hidden');

  if (action === 'edit') {
    bubbleEditorInputLabel.textContent = 'Edit bubble text';
    bubbleEditorTextInput.value = getBubbleDisplayText(bubbleEditorState.bubbleData);
    bubbleEditorTextInput.classList.remove('hidden');
    bubbleEditorTextInput.focus();
    bubbleEditorTextInput.select();
  } else if (action === 'type') {
    bubbleEditorInputLabel.textContent = 'Choose bubble type';
    refreshBubbleTypeSelectOptions();
    bubbleEditorTypeSelect.value = bubbleEditorState.bubbleData.type || 'idea';
    bubbleEditorTypeSelect.classList.remove('hidden');
    bubbleEditorTypeSelect.focus();
  } else if (action === 'order') {
    bubbleEditorInputLabel.textContent = 'Set playback order (number)';
    bubbleEditorOrderInput.value = bubbles.indexOf(bubbleEditorState.bubbleData) + 1;
    bubbleEditorOrderInput.classList.remove('hidden');
    bubbleEditorOrderInput.focus();
    bubbleEditorOrderInput.select();
  }
}

function applyBubbleEditorAction() {
  const { bubbleData, action } = bubbleEditorState;
  if (!bubbleData || !action) return;

  if (action === 'edit') {
    const newText = bubbleEditorTextInput.value.trim();
    if (!newText) {
      showBubbleEditorError('Text cannot be empty.');
      return;
    }
    bubbleData.textEl.textContent = titleCaseFirst(newText);
    updateSidebar();
    saveSnapshot();
    closeBubbleEditorModal();
    return;
  }

  if (action === 'type') {
    const newType = bubbleEditorTypeSelect.value;
    if (!ALLOWED_BUBBLE_TYPES.includes(newType)) {
      showBubbleEditorError('Select a valid bubble type.');
      return;
    }
    setBubbleType(bubbleData, newType);
    updateSidebar();
    saveSnapshot();
    closeBubbleEditorModal();
    return;
  }

  if (action === 'order') {
    const rawOrder = bubbleEditorOrderInput.value.trim();
    const parsedOrder = parseInt(rawOrder, 10);
    if (!Number.isInteger(parsedOrder) || parsedOrder < 1) {
      showBubbleEditorError('Playback order must be a number greater than 0.');
      return;
    }
    moveBubbleToIndex(bubbleData, parsedOrder - 1);
    bubbleData.locked = true;
    bubbleData.el.classList.add('locked');
    updateBubbleIds();
    updateSidebar();
    saveSnapshot();
    closeBubbleEditorModal();
  }
}

function openBubbleEditorModal(data) {
  if (!bubbleEditorModal || !data) return;
  bubbleEditorState = { bubbleData: data, action: null };
  const bubbleIndex = bubbles.indexOf(data) + 1;
  bubbleEditorMeta.textContent = `Bubble ${bubbleIndex}: ${getBubbleDisplayText(data).slice(0, 40)}`;
  bubbleEditorModal.classList.remove('hidden');
  bubbleEditorModal.setAttribute('aria-hidden', 'false');
  bubbleEditorInputArea.classList.add('hidden');
  bubbleEditorApply.classList.add('hidden');
  bubbleEditorError.classList.add('hidden');
  bubbleEditorError.textContent = '';
}

function attachBubbleDblClickHandler(bubble, data) {
  bubble.addEventListener('dblclick', () => {
    openBubbleEditorModal(data);
  });
}

if (bubbleEditorModal) {
  bubbleEditorModal.querySelectorAll('[data-modal-action]').forEach((btn) => {
    btn.addEventListener('click', () => setBubbleEditorAction(btn.dataset.modalAction));
  });
  bubbleEditorApply.addEventListener('click', applyBubbleEditorAction);
  bubbleEditorClose.addEventListener('click', closeBubbleEditorModal);
  bubbleEditorModal.addEventListener('click', (e) => {
    if (e.target === bubbleEditorModal) closeBubbleEditorModal();
  });
  [bubbleEditorTextInput, bubbleEditorTypeSelect, bubbleEditorOrderInput].forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyBubbleEditorAction();
      if (e.key === 'Escape') closeBubbleEditorModal();
    });
  });
}

if (saveBubbleTypesBtn) {
  saveBubbleTypesBtn.addEventListener('click', () => {
    createNewMapFromSetup();
  });
}

if (newMapBtn) {
  newMapBtn.addEventListener('click', () => {
    openMapSetupModal(false);
  });
}

if (mapHistoryBtn) {
  mapHistoryBtn.addEventListener('click', openMapHistoryModal);
}

if (exportMapIconBtn) {
  exportMapIconBtn.addEventListener('click', () => {
    const json = getStateSnapshot();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${mapName.replace(/\s+/g, '_').toLowerCase() || 'mindmap'}.json`;
    link.click();
  });
}

if (importMapIconBtn) {
  importMapIconBtn.addEventListener('click', () => {
    document.getElementById('importMap').click();
  });
}

if (toggleBubbleColumnBtn) {
  toggleBubbleColumnBtn.addEventListener('click', () => {
    isBubbleColumnCollapsed = !isBubbleColumnCollapsed;
    updateBubbleColumnLayout();
  });
}

if (closeMapSetupBtn) {
  closeMapSetupBtn.addEventListener('click', closeMapSetupModal);
}

if (mapSetupModal) {
  mapSetupModal.addEventListener('click', (e) => {
    if (e.target === mapSetupModal) closeMapSetupModal();
  });
}

if (closeMapHistoryBtn) {
  closeMapHistoryBtn.addEventListener('click', closeMapHistoryModal);
}

if (mapHistoryModal) {
  mapHistoryModal.addEventListener('click', (e) => {
    if (e.target === mapHistoryModal) closeMapHistoryModal();
  });
}

if (promptModalCreateBtn) {
  promptModalCreateBtn.addEventListener('click', () => {
    createFromPromptText(promptModalInput?.value || '');
  });
}

if (promptModalCancelBtn) {
  promptModalCancelBtn.addEventListener('click', closePromptModal);
}

if (promptModal) {
  promptModal.addEventListener('click', (e) => {
    if (e.target === promptModal) closePromptModal();
  });
}

if (promptModalInput) {
  promptModalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createFromPromptText(promptModalInput.value);
  });
}

setMapName('Untitled Map');
applyBubbleTypeConfig({ labels: DEFAULT_BUBBLE_TYPE_LABELS, locked: false, usePlaceholders: true });
loadMapDatabase();


function findValidBubblePosition(parent, bubbleWidth = 220, bubbleHeight = 100) {
  const idealDistance = 250;
  const spacingBuffer = 40;
  const maxAttempts = 120;
  const angleIncrement = 15;

  const viewBiasX = camX + getWorkspaceWidth() / 2 / zoom;
  const viewBiasY = camY + window.innerHeight / 2 / zoom;

  let bestScore = -Infinity;
  let bestPosition = null;

  let radius = idealDistance;
  let angle = 0;

  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    const rad = (angle / 180) * Math.PI;
    const testX = parent.x + Math.cos(rad) * radius;
    const testY = parent.y + Math.sin(rad) * radius;

    let tooClose = false;
    let repulsion = 0;

    for (const b of bubbles) {
      const dx = b.x - testX;
      const dy = b.y - testY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < bubbleWidth + spacingBuffer) {
        tooClose = true;
        break;
      }

      repulsion += 1 / (dist * dist); // inverse square repulsion
    }

    if (!tooClose) {
      const biasDx = viewBiasX - testX;
      const biasDy = viewBiasY - testY;
      const biasScore = -(biasDx * biasDx + biasDy * biasDy); // closer to center = better

      const totalScore = -repulsion + biasScore;
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestPosition = { x: testX, y: testY };
      }
    }

    angle += angleIncrement;
    if (angle >= 360) {
      angle = 0;
      radius += 50;
    }
  }

  if (bestPosition) return bestPosition;

  // Last-ditch fallback far off
  return {
    x: parent.x + 600 + Math.random() * 300,
    y: parent.y + 600 + Math.random() * 300
  };
}



const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.interimResults = false;
recognition.lang = 'en-US';

const controlPanel = document.getElementById('controlPanel');
const canvas = document.getElementById('connections');
const ctx = canvas.getContext('2d');
const bubbles = [];

const connections = [];
let lastSpokenIntent = null;
let pendingConnectionFrom = null;
let selectedBubble = null;
let isConnectMode = false;

let camX = 0, camY = 0, zoom = 1;
const MIN_ZOOM = 0.001;
const MAX_ZOOM = 64;
let isPanning = false;
let panStart = {}, camStart = {};



window.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (e.target.closest('#sidebar')) return;
  if (e.target.closest('.bubble')) return;
  isAutoPanning = false; // interrupt auto-pan
  isPanning = true;
  panStart = { x: e.clientX, y: e.clientY };
  camStart = { x: camX, y: camY };
});

window.addEventListener('mouseup', () => isPanning = false);
window.addEventListener('mousemove', (e) => {
  if (!isPanning) return;
  const dx = (e.clientX - panStart.x) / zoom;
  const dy = (e.clientY - panStart.y) / zoom;
  camX = camStart.x - dx;
  camY = camStart.y - dy;
  clampCameraToWorkspace();
});
function handleWorkspaceWheelZoom(e) {
  if (e.target.closest('#sidebar')) return;
  e.preventDefault();
  const scale = -e.deltaY * 0.001;
  const prevZoom = zoom;
  zoom = Math.min(Math.max(zoom * (1 + scale), MIN_ZOOM), MAX_ZOOM);

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const wx = (mx / prevZoom) + camX;
  const wy = (my / prevZoom) + camY;
  camX = wx - (mx / zoom);
  camY = wy - (my / zoom);
  clampCameraToWorkspace();
}

window.addEventListener('wheel', handleWorkspaceWheelZoom, { passive: false });

recognition.onresult = (e) => {
  const last = e.results.length - 1;
  const raw = e.results[last][0].transcript.trim();
  const text = raw.toLowerCase();

  if (handleTriggers(text)) return;

  let transcript = raw;

  if (lastSpokenIntent === 'question' && transcript.toLowerCase().startsWith("question ")) {
    transcript = transcript.slice(9).trim();
  }

  transcript = transcript.charAt(0).toUpperCase() + transcript.slice(1);

  if (lastSpokenIntent === 'question' && !transcript.endsWith('?')) {
    transcript += '?';
  }

  if (handleTriggers(text)) return;

  let x, y;
  if (pendingConnectionFrom) {
    const pos = findValidBubblePosition(pendingConnectionFrom);
    x = pos.x;
    y = pos.y;
  } else {
const canvasWidth = getWorkspaceWidth();

x = camX + Math.random() * (canvasWidth - 100); // buffer for bubble width
y = camY + Math.random() * (window.innerHeight - 100);
  }
  x = Math.max(x, camX);

  const bubble = document.createElement('div');
  bubble.style.position = 'absolute'; // ✅ REQUIRED

  const data = { el: bubble, x, y, dragging: false, locked: false, visible: true, order: null, type: lastSpokenIntent ||'idea' };
  bubble.className = `bubble ${data.type}`;
  const textSpan = document.createElement('span');
textSpan.className = 'bubble-text';
textSpan.textContent = transcript;
bubble.appendChild(textSpan);
data.textEl = textSpan;

  
  const idLabel = document.createElement('div');
idLabel.className = 'bubble-id-label';
bubble.appendChild(idLabel);
data.idLabel = idLabel;

  bubble.style.opacity = 0;
  updateSidebar();
  document.body.appendChild(bubble);

  

  attachBubbleDblClickHandler(bubble, data);
  updateSidebar();

  bubble.addEventListener('click', () => {
    if (isConnectMode) {
      if (!selectedBubble) {
        selectedBubble = data;
        bubble.style.outline = '2px solid yellow';
      } else {
        connections.push({ from: selectedBubble, to: data, label: '' });

        selectedBubble.el.style.outline = '';
        selectedBubble = null;
      }
    }
  });

  enableDragging(bubble, data);
  enableBubbleInteractions(bubble, data);

bubbles.push(data);
lastSpokenIntent = null;



  updateSidebar();
  updateBubbleIds();
  updateSidebar();


  if (pendingConnectionFrom) {
    setTimeout(() => {
      connections.push({ from: pendingConnectionFrom, to: data });
      pendingConnectionFrom = null;
      bubble.style.opacity = 1;
    }, 300);
  } else {
    bubble.style.opacity = 1;
  }
};

function handleTriggers(text) {
  if (text.includes('clear')) {
    clearMapData();
    saveSnapshot();
    return true;
  }

  if (text.includes('connect mode')) {
    isConnectMode = !isConnectMode;
    selectedBubble = null;
    alert(`Connect mode ${isConnectMode ? 'enabled' : 'disabled'}`);
    return true;
  }

  if (text.startsWith('question ')) {
    lastSpokenIntent = 'question';
    return false; // allow bubble creation to proceed
  }

  const bubbleMatch = text.match(/^bubble\s+(\d+)\b/);
  if (bubbleMatch) {
    const bubbleNumber = parseInt(bubbleMatch[1], 10);
    const targetIndex = bubbleNumber - 1;
    if (targetIndex >= 0 && targetIndex < bubbles.length) {
      const target = bubbles[targetIndex];
      makeBubbleActive(target);
      camX = target.x - getWorkspaceWidth() / 2 / zoom;
      camY = target.y - window.innerHeight / 2 / zoom;
      clampCameraToWorkspace();
    }
    return true;
  }

  return false;
}


function speakText(text) {
  if (!window.speechSynthesis) {
    console.warn("Speech Synthesis not supported");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1; // Adjust rate if needed
  utterance.pitch = 1;
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
}


let playbackActive = false;
let playbackPaused = false;
let playbackIndex = 0;
let orderedPlayback = [];

updateBubbleColumnLayout();

function startPlayback() {
  if (!bubbles.length) return;
  playbackActive = true;
  playbackPaused = false;
  collapsedAudioStep = 1;

  // Hide all first
  bubbles.forEach(b => {
    b.visible = false;
    b.el.style.display = 'none';
    b.el.style.opacity = 0;
  });

  orderedPlayback = bubbles.slice();

  playbackIndex = 0;
  updateAudioControlsUI();
  playNextBubble();
}

function stopPlayback() {
  playbackActive = false;
  playbackPaused = false;
  orderedPlayback = [];
  playbackIndex = 0;
  window.speechSynthesis.cancel();
  collapsedAudioStep = 0;
  updateAudioControlsUI();
}

function pausePlayback() {
  if (!playbackActive || playbackPaused) return;
  playbackPaused = true;
  window.speechSynthesis.pause();
  collapsedAudioStep = 2;
  updateAudioControlsUI();
}

function resumePlayback() {
  if (!playbackActive || !playbackPaused) return;
  playbackPaused = false;
  window.speechSynthesis.resume();
  collapsedAudioStep = 3;
  updateAudioControlsUI();
  playNextBubble();
}

function playNextBubble() {
  if (!playbackActive || playbackPaused) return;
  if (playbackIndex >= orderedPlayback.length) {
    stopPlayback();
    return;
  }

  const b = orderedPlayback[playbackIndex++];

  b.visible = true;
  b.el.style.display = 'block';
  b.el.style.opacity = 1;
  highlightBubble(b.el);
  speakText(b.textEl?.textContent || '');

  panToTarget(b.x - getWorkspaceWidth() / 2 / zoom, b.y - window.innerHeight / 2 / zoom);

  setTimeout(() => {
    if (!playbackPaused) {
      playNextBubble();
    }
  }, 3000);
}

function handleCollapsedAudioToggle() {
  if (collapsedAudioStep === 0) {
    startPlayback();
    return;
  }
  if (collapsedAudioStep === 1) {
    pausePlayback();
    return;
  }
  if (collapsedAudioStep === 2) {
    resumePlayback();
    return;
  }
  stopPlayback();
}

let isAutoPanning = false;

function panToTarget(x, y, duration = 600) {
  isAutoPanning = true;
  const startX = camX;
  const startY = camY;
  const dx = x - camX;
  const dy = y - camY;
  const startTime = performance.now();

  function animateFrame(time) {
    if (!isAutoPanning) return; // cancel if interrupted

    const t = Math.min((time - startTime) / duration, 1);
    camX = startX + dx * t;
    camY = startY + dy * t;
    clampCameraToWorkspace();

    if (t < 1) {
      requestAnimationFrame(animateFrame);
    } else {
      isAutoPanning = false;
    }
  }

  requestAnimationFrame(animateFrame);
}




const clickLayer = document.getElementById('clickLayer');
const clickCtx = clickLayer.getContext('2d');

clickLayer.addEventListener('click', e => {
  const rect = clickLayer.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  for (const conn of connections) {
    if (conn._clickPath && clickCtx.isPointInStroke(conn._clickPath, x, y)) {
      const newLabel = prompt("Label this connection:", conn.label || '');
      if (newLabel !== null) {
        conn.label = newLabel;
        saveSnapshot();
      }
      break;
    }
  }
});



function animate() {
canvas.width = getWorkspaceWidth();
canvas.height = window.innerHeight;
canvas.style.left = `${getSidebarWidth()}px`;
canvas.style.width = `${getWorkspaceWidth()}px`;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(0,0,0)';
  ctx.lineWidth = 3;
  connections.forEach(conn => {
    if (!conn.from.visible || !conn.to.visible) return;

    let fromX = (conn.from.x - camX) * zoom + conn.from.el.offsetWidth / 2;
    let fromY = (conn.from.y - camY) * zoom + conn.from.el.offsetHeight / 2;
    let toX = (conn.to.x - camX) * zoom + conn.to.el.offsetWidth / 2;
    let toY = (conn.to.y - camY) * zoom + conn.to.el.offsetHeight / 2;

    const midX1 = fromX + (toX - fromX) * 0.25;
    const midY1 = fromY - 50 * zoom;
    const midX2 = toX - (toX - fromX) * 0.25;
    const midY2 = toY - 50 * zoom;

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.bezierCurveTo(midX1, midY1, midX2, midY2, toX, toY);
    ctx.stroke();
    ctx.font = '14px sans-serif';
ctx.fillStyle = 'black';
ctx.textAlign = 'center';

connections.forEach(conn => {
  if (!conn.from.visible || !conn.to.visible) return;

  let fromX = (conn.from.x - camX) * zoom + conn.from.el.offsetWidth / 2;
  let fromY = (conn.from.y - camY) * zoom + conn.from.el.offsetHeight / 2;
  let toX = (conn.to.x - camX) * zoom + conn.to.el.offsetWidth / 2;
  let toY = (conn.to.y - camY) * zoom + conn.to.el.offsetHeight / 2;

  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2 - 10 * zoom;

  ctx.fillText(conn.label || '', midX, midY);
});

  });

clickLayer.width = getWorkspaceWidth();
clickLayer.height = window.innerHeight;
clickLayer.style.left = `${getSidebarWidth()}px`;
clickLayer.style.width = `${getWorkspaceWidth()}px`;

clickCtx.clearRect(0, 0, clickLayer.width, clickLayer.height);
clickCtx.lineWidth = 10;
clickCtx.strokeStyle = 'rgba(0,0,0,0)'; // invisible but clickable

connections.forEach((conn, i) => {
  if (!conn.from.visible || !conn.to.visible) return;

  let fromX = (conn.from.x - camX) * zoom + conn.from.el.offsetWidth / 2;
  let fromY = (conn.from.y - camY) * zoom + conn.from.el.offsetHeight / 2;
  let toX = (conn.to.x - camX) * zoom + conn.to.el.offsetWidth / 2;
  let toY = (conn.to.y - camY) * zoom + conn.to.el.offsetHeight / 2;

  const midX1 = fromX + (toX - fromX) * 0.25;
  const midY1 = fromY - 50 * zoom;
  const midX2 = toX - (toX - fromX) * 0.25;
  const midY2 = toY - 50 * zoom;

  clickCtx.beginPath();
  clickCtx.moveTo(fromX, fromY);
  clickCtx.bezierCurveTo(midX1, midY1, midX2, midY2, toX, toY);
  clickCtx.stroke();

  conn._clickPath = new Path2D();
  conn._clickPath.moveTo(fromX, fromY);
  conn._clickPath.bezierCurveTo(midX1, midY1, midX2, midY2, toX, toY);
});


  bubbles.forEach(b => {
    if (!b.visible) return;
    b.el.style.left = `${getSidebarWidth() + (b.x - camX) * zoom}px`;
    b.el.style.top = `${(b.y - camY) * zoom}px`;
    b.el.style.transform = `scale(${zoom})`;
  });
  requestAnimationFrame(animate);
}

function enableDragging(el, data) {
  let isDragging = false, offsetX = 0, offsetY = 0;

  el.addEventListener('mousedown', e => {
    if (data.locked) return;
    isDragging = true;
    data.dragging = true;
    offsetX = screenToWorldX(e.clientX) - data.x;
    offsetY = e.clientY / zoom - data.y + camY;
  });

  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    data.x = screenToWorldX(e.clientX) - offsetX;
    data.y = (e.clientY / zoom - offsetY) + camY;
    clampBubbleToWorkspace(data);
  });

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    data.dragging = false;
    saveSnapshot();
  }
});

}

recognition.onend = () => recognition.start();
recognition.onerror = e => console.error("Speech error:", e.error);
recognition.start();
animate();

let undoStack = [];
let redoStack = [];

function getStateSnapshot() {
  return JSON.stringify({
    mapId: activeMapId,
    mapName,
    bubbleTypes: {
      labels: { ...bubbleTypeLabels },
      locked: bubbleTypesLocked
    },
    bubbles: bubbles.map(b => ({
      text: getBubbleDisplayText(b),
      x: b.x,
      y: b.y,
      locked: b.locked,
      order: b.order,
      type: b.type
    })),
    connections: connections.map(conn => ({
      from: bubbles.indexOf(conn.from),
      to: bubbles.indexOf(conn.to)
    }))
  });
}

function restoreStateFromSnapshot(snapshot) {
  const state = JSON.parse(snapshot);
  activeMapId = state.mapId || activeMapId || generateMapId();
  setMapName(state.mapName || 'Untitled Map');
  applyBubbleTypeConfig(state.bubbleTypes || { labels: DEFAULT_BUBBLE_TYPE_LABELS, locked: false, usePlaceholders: true });
  document.querySelectorAll('.bubble').forEach(b => b.remove());
  bubbles.length = 0;
  connections.length = 0;

  state.bubbles.forEach(b => {
    const bubble = document.createElement('div');
        const data = {
      el: bubble,
      x: b.x,
      y: b.y,
      locked: b.locked,
      order: b.order,
      dragging: false,
      visible: true,
      type: b.type || 'idea'
    };
    bubble.className = `bubble ${data.type}`;
const textSpan = document.createElement('span');
textSpan.className = 'bubble-text';
textSpan.textContent = b.text;
bubble.appendChild(textSpan);
data.textEl = textSpan;

    bubble.style.position = 'absolute'; // ✅ REQUIRED

    bubble.style.opacity = 1;
    document.body.appendChild(bubble);
    const idLabel = document.createElement('div');
idLabel.className = 'bubble-id-label';
bubble.appendChild(idLabel);
data.idLabel = idLabel;




    if (b.order !== null) bubble.classList.add('locked');

attachBubbleDblClickHandler(bubble, data);
updateSidebar();


    bubble.addEventListener('click', () => {
      if (isConnectMode) {
        if (!selectedBubble) {
          selectedBubble = data;
          bubble.style.outline = '2px solid yellow';
        } else {
          connections.push({ from: selectedBubble, to: data, label: '' });

          selectedBubble.el.style.outline = '';
          selectedBubble = null;
          saveSnapshot();
        }
      }
    });

    enableDragging(bubble, data);
    enableBubbleInteractions(bubble, data);

bubbles.push(data);


    updateSidebar();
    updateBubbleIds();
    updateSidebar();

  });

  state.connections.forEach(conn => {
    if (bubbles[conn.from] && bubbles[conn.to]) {
connections.push({
  from: bubbles[conn.from],
  to: bubbles[conn.to],
  label: conn.label || ''
});
    }
  });
  updateSidebar();
  updateAudioControlsUI();
}

function saveSnapshot() {
  const snap = getStateSnapshot();
  undoStack.push(snap);
  redoStack.length = 0;
  localStorage.setItem('bubbleHistory', JSON.stringify(undoStack));
  upsertCurrentMapRecord();
}
function updateBubbleIds() {
  bubbles.forEach((b, i) => {
    b.order = i + 1;
    if (b.idLabel) b.idLabel.textContent = `${i + 1}`;
  });
}


function undo() {
  if (undoStack.length <= 1) return;
  const snap = undoStack.pop();
  redoStack.push(snap);
  restoreStateFromSnapshot(undoStack[undoStack.length - 1]);
  localStorage.setItem('bubbleHistory', JSON.stringify(undoStack));
}

function redo() {
  if (redoStack.length === 0) return;
  const snap = redoStack.pop();
  undoStack.push(snap);
  restoreStateFromSnapshot(snap);
  localStorage.setItem('bubbleHistory', JSON.stringify(undoStack));
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && bubbleEditorModal && !bubbleEditorModal.classList.contains('hidden')) {
    closeBubbleEditorModal();
    return;
  }
  if (e.key === 'Escape' && mapSetupModal && !mapSetupModal.classList.contains('hidden')) {
    closeMapSetupModal();
    return;
  }
  if (e.key === 'Escape' && mapHistoryModal && !mapHistoryModal.classList.contains('hidden')) {
    closeMapHistoryModal();
    return;
  }
  if (e.key === 'Escape' && promptModal && !promptModal.classList.contains('hidden')) {
    closePromptModal();
    return;
  }
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    undo();
  } else if (e.ctrlKey && e.key === 'y') {
    e.preventDefault();
    redo();
  }
});

// Restore last session
const history = localStorage.getItem('bubbleHistory');
if (history) {
  undoStack = JSON.parse(history);
  if (undoStack.length) {
    restoreStateFromSnapshot(undoStack[undoStack.length - 1]);
  }
}

if (!activeMapId) {
  activeMapId = generateMapId();
  if (!undoStack.length) {
    saveSnapshot();
  } else {
    upsertCurrentMapRecord();
  }
}
document.getElementById('importMap').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      activeMapId = generateMapId();
      const content = reader.result;
      undoStack.push(content); // push to undo
      redoStack.length = 0;
      restoreStateFromSnapshot(content);
      localStorage.setItem('bubbleHistory', JSON.stringify(undoStack));
      upsertCurrentMapRecord();
    } catch (err) {
      alert("Failed to import file. Not valid JSON?");
      console.error(err);
    }
  };
  reader.readAsText(file);
});



// When user clicks a bubble, make it the activeBubble
function makeBubbleActive(data) {
  if (activeBubble) activeBubble.el.classList.remove('active');
  activeBubble = data;
  data.el.classList.add('active');
  updateSidebar();
}


// Attach to all bubbles after creation
function enableBubbleInteractions(bubble, data) {
  bubble.addEventListener('click', () => {
    makeBubbleActive(data);
  });
}

// Lock/Unlock toggle
controlPanel.querySelector('#lockToggle').addEventListener('click', () => {
  if (!activeBubble) return alert("No bubble selected.");
  activeBubble.locked = !activeBubble.locked;
  activeBubble.el.classList.toggle('locked', activeBubble.locked);
  saveSnapshot();
});

// Delete
controlPanel.querySelector('#deleteBubble').addEventListener('click', () => {
  if (!activeBubble) return alert("No bubble selected.");
  removeBubble(activeBubble, true);
});

// Quick connect (to another selected bubble)
controlPanel.querySelector('#quickConnect').addEventListener('click', () => {
  if (!activeBubble) return alert("Select a source bubble.");

  const menu = document.createElement('select');
  menu.style.position = 'fixed';
  menu.style.top = '50%';
  menu.style.left = '50%';
  menu.style.transform = 'translate(-50%, -50%)';
  menu.style.zIndex = 9999;
  menu.style.fontSize = '16px';

  const placeholder = document.createElement('option');
  placeholder.textContent = 'Select target bubble...';
  placeholder.disabled = true;
  placeholder.selected = true;
  menu.appendChild(placeholder);

  bubbles.forEach((b, i) => {
    if (b === activeBubble) return;
    const exists = connections.some(c => c.from === activeBubble && c.to === b);
    if (exists) return;

    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${i + 1}: ${getBubbleDisplayText(b).slice(0, 30)}`;
    menu.appendChild(opt);
  });

  menu.addEventListener('change', () => {
    const target = bubbles[parseInt(menu.value)];
    if (target) {
      connections.push({ from: activeBubble, to: target, label: '' });
      saveSnapshot();
      document.body.removeChild(menu);
    }
  });

  document.body.appendChild(menu);
});


// Snap all bubbles to viewport center while preserving formation
controlPanel.querySelector('#snapCenter').addEventListener('click', () => {
  if (!bubbles.length) return;
  const minX = Math.min(...bubbles.map((b) => b.x));
  const maxX = Math.max(...bubbles.map((b) => b.x));
  const minY = Math.min(...bubbles.map((b) => b.y));
  const maxY = Math.max(...bubbles.map((b) => b.y));
  const clusterCenterX = (minX + maxX) / 2;
  const clusterCenterY = (minY + maxY) / 2;
  const viewportCenterX = camX + getWorkspaceWidth() / 2 / zoom;
  const viewportCenterY = camY + window.innerHeight / 2 / zoom;
  const offsetX = viewportCenterX - clusterCenterX;
  const offsetY = viewportCenterY - clusterCenterY;
  bubbles.forEach((b) => {
    b.x += offsetX;
    b.y += offsetY;
  });
  clampCameraToWorkspace();
  saveSnapshot();
});

// Export image
controlPanel.querySelector('#exportImageBtn').addEventListener('click', () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  document.querySelectorAll('.bubble').forEach(bubble => {
    const rect = bubble.getBoundingClientRect();
    const style = getComputedStyle(bubble);

    ctx.fillStyle = style.backgroundColor || '#000';
    ctx.beginPath();
    ctx.ellipse(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      rect.width / 2,
      rect.height / 2,
      0, 0, 2 * Math.PI
    );
    ctx.fill();

    const text = bubble.querySelector('.bubble-text')?.textContent || '';
    ctx.fillStyle = style.color || '#fff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      text,
      rect.left + rect.width / 2,
      rect.top + rect.height / 2 + 6
    );
  });

  const link = document.createElement('a');
  link.download = 'speechflow_map.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// Add bubble at random position
controlPanel.querySelector('#addBubbleBtn').addEventListener('click', () => {
  const x = camX + Math.random() * Math.max(getWorkspaceWidth() - 120, 1);
  const y = camY + Math.random() * (window.innerHeight - 200);
  createBubble("New idea", x, y, 'idea');
  updateSidebar();
  saveSnapshot();
});




// Clear map with confirmation
controlPanel.querySelector('#clearMap').addEventListener('click', () => {
  if (confirm("Are you sure you want to clear the entire map?")) {
    clearMapData();
    saveSnapshot();
  }
});

// Generate from prompt
controlPanel.querySelector('#generateFromPrompt').addEventListener('click', () => {
  openPromptModal();
});



function updateSidebar() {
  const list = document.getElementById('bubbleList');
  list.innerHTML = '';

  bubbles.forEach((b, i) => {
    const li = document.createElement('li');
    li.classList.add(`type-${b.type || 'idea'}`);
    li.textContent = `${i + 1}: ${getBubbleDisplayText(b).slice(0, 30)}`;
    if (b === activeBubble) li.classList.add('active');

    li.draggable = true;

    li.addEventListener('click', () => {
      makeBubbleActive(b);
      camX = b.x - getWorkspaceWidth() / 2 / zoom;
      camY = b.y - window.innerHeight / 2 / zoom;
      clampCameraToWorkspace();
    });

    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', i);
    });

    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      li.style.borderTop = '2px solid #F24E1E';
    });

    li.addEventListener('dragleave', () => {
      li.style.borderTop = '';
    });

    li.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const toIndex = i;
      if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= bubbles.length) return;
      const moving = bubbles[fromIndex];
      moveBubbleToIndex(moving, toIndex);
      updateBubbleIds();
      updateSidebar();
      saveSnapshot();
    });

    list.appendChild(li);
  });
}

if (audioPlayStopToggle) {
  audioPlayStopToggle.addEventListener('click', () => {
    if (playbackActive) {
      stopPlayback();
      return;
    }
    startPlayback();
  });
}

if (audioPauseResumeToggle) {
  audioPauseResumeToggle.addEventListener('click', () => {
    if (!playbackActive) return;
    if (playbackPaused) {
      resumePlayback();
      return;
    }
    pausePlayback();
  });
}

if (audioSingleToggle) {
  audioSingleToggle.addEventListener('click', handleCollapsedAudioToggle);
}

function createBubble(text, x, y, type = 'idea') {
  x = Math.max(x, camX);
  const bubble = document.createElement('div');
  bubble.className = `bubble ${type}`;
  bubble.style.position = 'absolute';

  const textSpan = document.createElement('span');
  textSpan.className = 'bubble-text';
  textSpan.textContent = text;
  bubble.appendChild(textSpan);

  const data = {
    el: bubble,
    x,
    y,
    dragging: false,
    locked: false,
    visible: true,
    order: null,
    type,
    textEl: textSpan
  };

  const idLabel = document.createElement('div');
  idLabel.className = 'bubble-id-label';
  bubble.appendChild(idLabel);
  data.idLabel = idLabel;

  attachBubbleDblClickHandler(bubble, data);


  enableDragging(bubble, data);
  enableBubbleInteractions(bubble, data);

  document.body.appendChild(bubble);
  bubbles.push(data);
  updateBubbleIds();
  return data;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
