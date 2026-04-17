const STORAGE_KEY = "limitless-ai-state-v1";
const DB_NAME = "limitless-ai-db";
const DB_STORE = "kv";
const MAX_FILE_TEXT_CHARS = 120000;
const MAX_CONTEXT_CHUNKS = 4;
const MAX_SEARCH_RESULTS = 5;
const MAX_REMOTE_PROMPT_CHARS = 2800;
const POLLINATIONS_TEXT_URL = "https://gen.pollinations.ai/text/";
const POLLINATIONS_IMAGE_URL = "https://gen.pollinations.ai/image/";
const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";

const MODE_DETAILS = {
  chat: {
    label: "Chat",
    placeholder: "Ask anything, reason over your uploaded files, or continue the conversation...",
    sendLabel: "Send",
  },
  search: {
    label: "Search",
    placeholder: "Search a topic and turn it into a short answer or brief...",
    sendLabel: "Search",
  },
  image: {
    label: "Image",
    placeholder: "Describe the image you want to generate...",
    sendLabel: "Generate",
  },
  agent: {
    label: "Agent",
    placeholder: "Give the active agent a multi-step goal...",
    sendLabel: "Run agent",
  },
};

const DEFAULT_ASSISTANTS = [
  {
    id: "assistant-core",
    name: "Limitless Core",
    description: "Balanced all-purpose assistant for chat, file Q&A, and research.",
    instructions:
      "Be direct, practical, and grounded in the user's uploaded files and search results when they exist. Prefer concise markdown, honest uncertainty, and concrete next steps.",
    builtin: true,
  },
  {
    id: "assistant-strategy",
    name: "Strategy Architect",
    description: "Turns rough ideas into plans, roadmaps, and execution moves.",
    instructions:
      "Think like a sharp product and strategy partner. Structure answers into priorities, risks, and clear sequences of action without sounding corporate or vague.",
    builtin: true,
  },
  {
    id: "assistant-file",
    name: "File Analyst",
    description: "Optimized for uploaded documents and grounded answers.",
    instructions:
      "Focus on evidence from uploaded files. Pull out the most relevant details, summarize patterns, and say explicitly when the documents do not contain enough information.",
    builtin: true,
  },
];

const AGENTS = [
  {
    id: "agent-research",
    name: "Research Scout",
    description: "Search, shortlist, and summarize public information into a brief.",
    shortLabel: "Research Scout",
  },
  {
    id: "agent-files",
    name: "File Investigator",
    description: "Scan uploaded files, surface themes, and answer grounded questions.",
    shortLabel: "File Investigator",
  },
  {
    id: "agent-planner",
    name: "Execution Planner",
    description: "Turn a goal into an actionable step-by-step plan with milestones.",
    shortLabel: "Execution Planner",
  },
];

const state = {
  chats: [],
  activeChatId: null,
  activeSection: "files",
  activeMode: "chat",
  activeAssistantId: DEFAULT_ASSISTANTS[0].id,
  activeAgentId: AGENTS[0].id,
  pendingFileIds: [],
  files: [],
  assistants: [],
  search: {
    query: "",
    results: [],
    summary: "",
    updatedAt: null,
  },
  agentRuns: [],
  settings: {
    webSearchInChat: false,
    autoSpeak: false,
    localOnly: false,
  },
  ui: {
    sidebarOpen: false,
    listening: false,
    awaitingResponse: false,
    assistantEditId: null,
  },
};

const elements = {};
let speechRecognitionHandle = null;

document.addEventListener("DOMContentLoaded", () => {
  void init();
});

async function init() {
  cacheElements();
  configureLibraries();
  bindEvents();
  await loadState();
  ensureSeedState();
  syncToggleInputs();
  renderAll();
}

function cacheElements() {
  Object.assign(elements, {
    backdrop: document.getElementById("backdrop"),
    sidebar: document.getElementById("sidebar"),
    mobileNavToggle: document.getElementById("mobileNavToggle"),
    newChatButton: document.getElementById("newChatButton"),
    navButtons: Array.from(document.querySelectorAll("[data-section]")),
    chatCountBadge: document.getElementById("chatCountBadge"),
    chatList: document.getElementById("chatList"),
    webSearchToggle: document.getElementById("webSearchToggle"),
    autoSpeakToggle: document.getElementById("autoSpeakToggle"),
    localOnlyToggle: document.getElementById("localOnlyToggle"),
    assistantPicker: document.getElementById("assistantPicker"),
    statusBadge: document.getElementById("statusBadge"),
    chatTitle: document.getElementById("chatTitle"),
    heroChatMetric: document.getElementById("heroChatMetric"),
    heroFileMetric: document.getElementById("heroFileMetric"),
    heroAgentMetric: document.getElementById("heroAgentMetric"),
    heroModeMetric: document.getElementById("heroModeMetric"),
    statusLine: document.getElementById("statusLine"),
    introPanel: document.getElementById("introPanel"),
    quickSuggestionList: document.getElementById("quickSuggestionList"),
    messageStream: document.getElementById("messageStream"),
    composerForm: document.getElementById("composerForm"),
    composerUploadButton: document.getElementById("composerUploadButton"),
    voiceButton: document.getElementById("voiceButton"),
    modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
    pendingFileStrip: document.getElementById("pendingFileStrip"),
    promptInput: document.getElementById("promptInput"),
    composerNote: document.getElementById("composerNote"),
    sendButton: document.getElementById("sendButton"),
    hiddenFileInput: document.getElementById("hiddenFileInput"),
    importInput: document.getElementById("importInput"),
    toolPanels: Array.from(document.querySelectorAll(".tool-panel")),
    fileUploadTrigger: document.getElementById("fileUploadTrigger"),
    fileUsageSummary: document.getElementById("fileUsageSummary"),
    libraryList: document.getElementById("libraryList"),
    searchForm: document.getElementById("searchForm"),
    searchInput: document.getElementById("searchInput"),
    searchSummary: document.getElementById("searchSummary"),
    searchResults: document.getElementById("searchResults"),
    useSearchInChatButton: document.getElementById("useSearchInChatButton"),
    assistantList: document.getElementById("assistantList"),
    assistantForm: document.getElementById("assistantForm"),
    assistantIdInput: document.getElementById("assistantIdInput"),
    assistantNameInput: document.getElementById("assistantNameInput"),
    assistantDescriptionInput: document.getElementById("assistantDescriptionInput"),
    assistantInstructionsInput: document.getElementById("assistantInstructionsInput"),
    cancelAssistantEditButton: document.getElementById("cancelAssistantEditButton"),
    agentList: document.getElementById("agentList"),
    agentGoalForm: document.getElementById("agentGoalForm"),
    agentGoalInput: document.getElementById("agentGoalInput"),
    agentRuns: document.getElementById("agentRuns"),
    exportChatsButton: document.getElementById("exportChatsButton"),
    exportWorkspaceButton: document.getElementById("exportWorkspaceButton"),
    importWorkspaceButton: document.getElementById("importWorkspaceButton"),
  });
}

function configureLibraries() {
  if (window.pdfjsLib?.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
  }
}

function bindEvents() {
  elements.mobileNavToggle.addEventListener("click", toggleSidebar);
  elements.backdrop.addEventListener("click", closeSidebar);

  elements.newChatButton.addEventListener("click", () => {
    createChat(true);
  });

  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveSection(button.getAttribute("data-section") || "files");
    });
  });

  elements.chatList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-chat-id]");

    if (!button) {
      return;
    }

    state.activeChatId = button.getAttribute("data-chat-id");
    persistState();
    renderAll();
    closeSidebar();
  });

  elements.webSearchToggle.addEventListener("change", () => {
    state.settings.webSearchInChat = elements.webSearchToggle.checked;
    persistState();
    renderStatusLine("Chat will include basic web context when helpful.");
  });

  elements.autoSpeakToggle.addEventListener("change", () => {
    state.settings.autoSpeak = elements.autoSpeakToggle.checked;
    persistState();
    renderStatusLine(state.settings.autoSpeak ? "Replies will be read aloud." : "Auto-speak is off.");
  });

  elements.localOnlyToggle.addEventListener("change", () => {
    state.settings.localOnly = elements.localOnlyToggle.checked;
    persistState();
    renderStatusLine(
      state.settings.localOnly
        ? "Local-only mode enabled. Public AI endpoints will be skipped."
        : "Free online providers may be used again."
    );
  });

  elements.assistantPicker.addEventListener("change", () => {
    state.activeAssistantId = elements.assistantPicker.value;
    persistState();
    renderAll();
  });

  elements.composerUploadButton.addEventListener("click", () => {
    elements.hiddenFileInput.click();
  });

  elements.fileUploadTrigger.addEventListener("click", () => {
    elements.hiddenFileInput.click();
  });

  elements.hiddenFileInput.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);

    if (!files.length) {
      return;
    }

    await ingestFiles(files, true);
    elements.hiddenFileInput.value = "";
  });

  elements.importWorkspaceButton.addEventListener("click", () => {
    elements.importInput.click();
  });

  elements.importInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await importWorkspace(file);
    elements.importInput.value = "";
  });

  elements.pendingFileStrip.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-pending]");

    if (!button) {
      return;
    }

    const fileId = button.getAttribute("data-remove-pending");
    state.pendingFileIds = state.pendingFileIds.filter((id) => id !== fileId);
    persistState();
    renderPendingFiles();
  });

  elements.quickSuggestionList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-suggestion]");

    if (!button) {
      return;
    }

    const suggestion = button.getAttribute("data-suggestion") || "";
    elements.promptInput.value = suggestion;
    autoGrowTextarea();
    elements.promptInput.focus();
  });

  elements.modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.getAttribute("data-mode") || "chat";
      setActiveMode(mode);
    });
  });

  elements.promptInput.addEventListener("input", autoGrowTextarea);

  elements.composerForm.addEventListener("submit", (event) => {
    void handleComposerSubmit(event);
  });

  elements.voiceButton.addEventListener("click", () => {
    void toggleVoiceInput();
  });

  elements.libraryList.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-file-action]");

    if (!actionButton) {
      return;
    }

    const action = actionButton.getAttribute("data-file-action");
    const fileId = actionButton.getAttribute("data-file-id");

    if (!action || !fileId) {
      return;
    }

    handleLibraryAction(action, fileId);
  });

  elements.searchForm.addEventListener("submit", (event) => {
    void handleSearchSubmit(event);
  });

  elements.useSearchInChatButton.addEventListener("click", () => {
    state.settings.webSearchInChat = true;
    syncToggleInputs();
    persistState();
    renderStatusLine("Web search will be blended into the next chat request.");
  });

  elements.assistantList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-assistant-action]");

    if (!button) {
      return;
    }

    const action = button.getAttribute("data-assistant-action");
    const assistantId = button.getAttribute("data-assistant-id");

    if (!action || !assistantId) {
      return;
    }

    handleAssistantAction(action, assistantId);
  });

  elements.assistantForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveAssistantFromForm();
  });

  elements.cancelAssistantEditButton.addEventListener("click", () => {
    clearAssistantForm();
  });

  elements.agentList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-agent-id]");

    if (!button) {
      return;
    }

    state.activeAgentId = button.getAttribute("data-agent-id") || AGENTS[0].id;
    persistState();
    renderAgentsPanel();
    renderHeroStrip();
  });

  elements.agentGoalForm.addEventListener("submit", (event) => {
    void handleAgentGoalSubmit(event);
  });

  elements.exportChatsButton.addEventListener("click", () => {
    exportChats();
  });

  elements.exportWorkspaceButton.addEventListener("click", () => {
    exportWorkspace();
  });
}

async function loadState() {
  try {
    const snapshot = await getPersistedValue(STORAGE_KEY);

    if (!snapshot) {
      return;
    }

    hydrateState(snapshot);
  } catch (error) {
    console.warn("Could not load Limitless AI state.", error);
  }
}

function hydrateState(snapshot) {
  state.chats = Array.isArray(snapshot.chats) ? snapshot.chats : [];
  state.activeChatId = snapshot.activeChatId || null;
  state.activeSection = typeof snapshot.activeSection === "string" ? snapshot.activeSection : "files";
  state.activeMode = MODE_DETAILS[snapshot.activeMode] ? snapshot.activeMode : "chat";
  state.activeAssistantId = snapshot.activeAssistantId || DEFAULT_ASSISTANTS[0].id;
  state.activeAgentId = snapshot.activeAgentId || AGENTS[0].id;
  state.pendingFileIds = Array.isArray(snapshot.pendingFileIds) ? snapshot.pendingFileIds : [];
  state.files = Array.isArray(snapshot.files) ? snapshot.files : [];
  state.assistants = Array.isArray(snapshot.assistants) ? snapshot.assistants : [];
  state.search = {
    query: snapshot.search?.query || "",
    results: Array.isArray(snapshot.search?.results) ? snapshot.search.results : [],
    summary: snapshot.search?.summary || "",
    updatedAt: snapshot.search?.updatedAt || null,
  };
  state.agentRuns = Array.isArray(snapshot.agentRuns) ? snapshot.agentRuns : [];
  state.settings = {
    webSearchInChat: Boolean(snapshot.settings?.webSearchInChat),
    autoSpeak: Boolean(snapshot.settings?.autoSpeak),
    localOnly: Boolean(snapshot.settings?.localOnly),
  };
}

function ensureSeedState() {
  state.assistants = mergeAssistants(DEFAULT_ASSISTANTS, state.assistants);
  state.files = state.files.map((file) => ({
    selected: true,
    sections: [],
    summary: "",
    previewUrl: "",
    ...file,
  }));

  if (!getAssistantById(state.activeAssistantId)) {
    state.activeAssistantId = DEFAULT_ASSISTANTS[0].id;
  }

  if (!getAgentById(state.activeAgentId)) {
    state.activeAgentId = AGENTS[0].id;
  }

  if (!MODE_DETAILS[state.activeMode]) {
    state.activeMode = "chat";
  }

  if (!state.chats.length) {
    createChat(false);
    return;
  }

  if (!getActiveChat()) {
    state.activeChatId = state.chats[0].id;
  }
}

function mergeAssistants(defaults, existing) {
  const customAssistants = existing.filter((assistant) => !defaults.some((item) => item.id === assistant.id));
  const mergedDefaults = defaults.map((assistant) => {
    const match = existing.find((item) => item.id === assistant.id);
    return match ? { ...assistant, ...match, builtin: true } : assistant;
  });

  return [...mergedDefaults, ...customAssistants];
}

function createWelcomeMessage() {
  return {
    id: createId(),
    role: "assistant",
    mode: "chat",
    provider: "Local-first",
    createdAt: new Date().toISOString(),
    text: [
      "Welcome to Limitless AI.",
      "- Upload PDFs, DOCX files, text files, or images and ask grounded questions about them.",
      "- Use browser voice input and speech synthesis with no account.",
      "- Generate images with a free public endpoint or stay in local-only fallback mode.",
      "- Build custom assistants and lightweight agents that all save locally in your browser.",
    ].join("\n"),
    citations: [],
    images: [],
    attachedFileIds: [],
  };
}

function createChat(focusPrompt) {
  const chat = {
    id: createId(),
    title: "New conversation",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [createWelcomeMessage()],
  };

  state.chats.unshift(chat);
  state.activeChatId = chat.id;
  state.pendingFileIds = [];
  void persistState();
  renderAll();

  if (focusPrompt) {
    elements.promptInput.focus();
  }
}

function getActiveChat() {
  return state.chats.find((chat) => chat.id === state.activeChatId) || null;
}

function getAssistantById(id) {
  return state.assistants.find((assistant) => assistant.id === id) || null;
}

function getAgentById(id) {
  return AGENTS.find((agent) => agent.id === id) || null;
}

function toggleSidebar() {
  state.ui.sidebarOpen = !state.ui.sidebarOpen;
  syncSidebar();
}

function closeSidebar() {
  state.ui.sidebarOpen = false;
  syncSidebar();
}

function syncSidebar() {
  elements.sidebar.classList.toggle("open", state.ui.sidebarOpen);
  elements.backdrop.hidden = !state.ui.sidebarOpen;
}

function setActiveSection(section) {
  state.activeSection = section;
  void persistState();
  renderPanels();
  renderNav();
  closeSidebar();
}

function setActiveMode(mode) {
  if (!MODE_DETAILS[mode]) {
    return;
  }

  state.activeMode = mode;
  void persistState();
  renderModeUI();
  renderHeroStrip();
}

function syncToggleInputs() {
  elements.webSearchToggle.checked = state.settings.webSearchInChat;
  elements.autoSpeakToggle.checked = state.settings.autoSpeak;
  elements.localOnlyToggle.checked = state.settings.localOnly;
}

function renderAll() {
  renderNav();
  renderSidebar();
  renderTopbar();
  renderHeroStrip();
  renderModeUI();
  renderMessages();
  renderPendingFiles();
  renderFilesPanel();
  renderSearchPanel();
  renderAssistantsPanel();
  renderAgentsPanel();
  renderPanels();
  syncSidebar();
}

function renderNav() {
  elements.navButtons.forEach((button) => {
    const isActive = button.getAttribute("data-section") === state.activeSection;
    button.classList.toggle("active", isActive);
  });
}

function renderSidebar() {
  const activeChat = getActiveChat();
  elements.chatCountBadge.textContent = String(state.chats.length);
  elements.chatList.innerHTML = state.chats
    .map((chat) => {
      const isActive = activeChat?.id === chat.id;
      const messageCount = chat.messages.filter((message) => !message.typing).length;
      const lastMessage = chat.messages.at(-1);

      return `
        <button class="chat-link ${isActive ? "active" : ""}" type="button" data-chat-id="${chat.id}">
          <strong>${escapeHtml(chat.title)}</strong>
          <small>${messageCount} message${messageCount === 1 ? "" : "s"} | ${escapeHtml(
            formatTimestamp(lastMessage?.createdAt || chat.updatedAt)
          )}</small>
        </button>
      `;
    })
    .join("");
}

function renderTopbar() {
  const activeChat = getActiveChat();
  const activeAssistant = getAssistantById(state.activeAssistantId) || DEFAULT_ASSISTANTS[0];

  elements.chatTitle.textContent = activeChat?.title || "Welcome to Limitless AI";
  elements.assistantPicker.innerHTML = state.assistants
    .map(
      (assistant) => `
        <option value="${assistant.id}" ${assistant.id === activeAssistant.id ? "selected" : ""}>
          ${escapeHtml(assistant.name)}
        </option>
      `
    )
    .join("");

  elements.statusBadge.textContent = state.settings.localOnly ? "Local only" : "Ready";
}

function renderHeroStrip() {
  elements.heroChatMetric.textContent = String(state.chats.length);
  elements.heroFileMetric.textContent = String(state.files.filter((file) => file.status === "ready").length);
  elements.heroModeMetric.textContent = MODE_DETAILS[state.activeMode].label;
  elements.heroAgentMetric.textContent = getAgentById(state.activeAgentId)?.shortLabel || AGENTS[0].shortLabel;
}

function renderModeUI() {
  const detail = MODE_DETAILS[state.activeMode];
  elements.promptInput.placeholder = detail.placeholder;
  elements.sendButton.textContent = detail.sendLabel;
  elements.composerNote.textContent = state.settings.localOnly
    ? "Local-only fallback is on. Browser storage stays local and public AI endpoints are skipped."
    : "Using browser storage, browser voice APIs, and free public AI/search providers where available.";

  elements.modeButtons.forEach((button) => {
    if (!button.hasAttribute("data-mode")) {
      return;
    }

    button.classList.toggle("active", button.getAttribute("data-mode") === state.activeMode);
  });

  updateVoiceButton();
}

function renderPanels() {
  elements.toolPanels.forEach((panel) => {
    const isActive = panel.getAttribute("data-panel") === state.activeSection;
    panel.classList.toggle("active", isActive);
  });
}

function renderMessages() {
  const chat = getActiveChat();

  if (!chat) {
    elements.introPanel.hidden = false;
    elements.messageStream.hidden = true;
    return;
  }

  const visibleMessages = chat.messages.filter((message) => !message.typing);
  const showIntroOnly = visibleMessages.length <= 1;

  elements.introPanel.hidden = !showIntroOnly;
  elements.messageStream.hidden = showIntroOnly;

  if (showIntroOnly) {
    return;
  }

  const stack = document.createElement("div");
  stack.className = "message-stack";

  chat.messages.forEach((message) => {
    stack.appendChild(renderMessage(message));
  });

  elements.messageStream.replaceChildren(stack);
  elements.messageStream.scrollTop = elements.messageStream.scrollHeight;
}

function renderMessage(message) {
  const row = document.createElement("article");
  row.className = `message-row ${message.role}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = message.role === "assistant" ? "AI" : "You";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.innerHTML = `
    <span>${escapeHtml(buildMetaLabel(message))}</span>
    <span>${escapeHtml(formatTimestamp(message.createdAt))}</span>
  `;

  const body = document.createElement("div");
  body.className = "message-body";

  if (message.typing) {
    body.innerHTML = `
      <div class="typing" aria-label="Generating response">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
  } else {
    body.innerHTML = formatRichText(message.text || "");
  }

  bubble.append(meta, body);

  if (message.attachedFileIds?.length) {
    const fileChips = document.createElement("div");
    fileChips.className = "source-list";
    message.attachedFileIds.forEach((fileId) => {
      const file = state.files.find((item) => item.id === fileId);

      if (!file) {
        return;
      }

      const chip = document.createElement("span");
      chip.className = "source-chip";
      chip.textContent = file.name;
      fileChips.appendChild(chip);
    });

    if (fileChips.childElementCount) {
      bubble.appendChild(fileChips);
    }
  }

  if (message.images?.length) {
    const grid = document.createElement("div");
    grid.className = "image-grid";

    message.images.forEach((image) => {
      const card = document.createElement("figure");
      card.className = "image-card";
      card.innerHTML = `
        <img src="${image.dataUrl}" alt="${escapeHtml(image.alt)}">
        <figcaption>${escapeHtml(image.caption)}</figcaption>
      `;
      grid.appendChild(card);
    });

    bubble.appendChild(grid);
  }

  if (message.agentLog?.length) {
    const log = document.createElement("div");
    log.className = "agent-log";

    message.agentLog.forEach((entry) => {
      const step = document.createElement("div");
      step.className = "agent-step";
      step.innerHTML = `
        <span class="step-dot"></span>
        <div>
          <strong>${escapeHtml(entry.title)}</strong>
          <p>${escapeHtml(entry.detail)}</p>
        </div>
      `;
      log.appendChild(step);
    });

    bubble.appendChild(log);
  }

  if (message.citations?.length) {
    const citations = document.createElement("div");
    citations.className = "source-list";

    message.citations.forEach((citation) => {
      const chip = document.createElement(citation.url ? "a" : "span");
      chip.className = "source-chip";
      chip.textContent = citation.label;

      if (citation.url) {
        chip.href = citation.url;
        chip.target = "_blank";
        chip.rel = "noreferrer";
      }

      citations.appendChild(chip);
    });

    bubble.appendChild(citations);
  }

  if (message.role === "assistant") {
    row.append(avatar, bubble);
  } else {
    row.append(bubble, avatar);
  }

  return row;
}

function buildMetaLabel(message) {
  if (message.typing) {
    return "Limitless AI";
  }

  if (message.role === "user") {
    return "You";
  }

  const label = MODE_DETAILS[message.mode || "chat"]?.label || "Assistant";
  return message.provider ? `${label} | ${message.provider}` : label;
}

function renderPendingFiles() {
  const files = state.pendingFileIds
    .map((id) => state.files.find((file) => file.id === id))
    .filter(Boolean);

  if (!files.length) {
    elements.pendingFileStrip.hidden = true;
    elements.pendingFileStrip.innerHTML = "";
    return;
  }

  elements.pendingFileStrip.hidden = false;
  elements.pendingFileStrip.innerHTML = files
    .map(
      (file) => `
        <div class="pending-chip">
          <div>
            <strong>${escapeHtml(trimText(file.name, 24))}</strong>
            <div class="muted">${escapeHtml(file.status === "ready" ? "Ready for context" : file.status)}</div>
          </div>
          <button class="ghost-button" type="button" data-remove-pending="${file.id}" aria-label="Remove pending file">Remove</button>
        </div>
      `
    )
    .join("");
}

function renderFilesPanel() {
  const readyCount = state.files.filter((file) => file.status === "ready").length;
  const selectedCount = state.files.filter((file) => file.status === "ready" && file.selected).length;

  elements.fileUsageSummary.textContent = state.files.length
    ? `${readyCount} ready file${readyCount === 1 ? "" : "s"} | ${selectedCount} selected for AI`
    : "No files uploaded yet.";

  if (!state.files.length) {
    elements.libraryList.innerHTML = `<div class="empty-panel">Upload PDFs, DOCX, TXT, or image files to extract text into local browser memory.</div>`;
    return;
  }

  elements.libraryList.innerHTML = state.files
    .map((file) => {
      const actionLabel = state.pendingFileIds.includes(file.id) ? "Attached next" : "Attach next";
      const toggleLabel = file.selected ? "Using in AI" : "Excluded";
      const summaryText =
        file.status === "error"
          ? file.error || "Could not process this file."
          : file.summary || "Text extraction will appear here once processing finishes.";

      return `
        <article class="file-card">
          <div class="file-header">
            <div>
              <strong>${escapeHtml(file.name)}</strong>
              <div class="file-meta">
                <span>${escapeHtml((file.kind || "file").toUpperCase())}</span>
                <span>${escapeHtml(formatFileSize(file.size || 0))}</span>
                <span class="file-status ${escapeHtml(file.status || "processing")}">${escapeHtml(
        file.status || "processing"
      )}</span>
              </div>
            </div>
          </div>
          ${
            file.previewUrl
              ? `<img class="file-preview" src="${file.previewUrl}" alt="${escapeHtml(file.name)}">`
              : ""
          }
          <p>${escapeHtml(trimText(summaryText, 320))}</p>
          <div class="file-actions">
            <button class="file-action" type="button" data-file-action="toggle" data-file-id="${file.id}">${escapeHtml(
        toggleLabel
      )}</button>
            <button class="file-action" type="button" data-file-action="attach" data-file-id="${file.id}">${escapeHtml(
        actionLabel
      )}</button>
            <button class="file-action" type="button" data-file-action="delete" data-file-id="${file.id}">Delete</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSearchPanel() {
  elements.searchInput.value = state.search.query;
  elements.searchSummary.innerHTML = state.search.summary
    ? formatRichText(state.search.summary)
    : `<p class="muted">Search summaries will appear here.</p>`;

  if (!state.search.results.length) {
    elements.searchResults.innerHTML = `<div class="empty-panel">Run a search to collect quick public context and blend it into chat or agents.</div>`;
    return;
  }

  elements.searchResults.innerHTML = state.search.results
    .map(
      (result) => `
        <article class="settings-card">
          <h4>${escapeHtml(result.title)}</h4>
          <p>${escapeHtml(result.snippet)}</p>
          <div class="card-actions">
            <a class="ghost-button" href="${result.url}" target="_blank" rel="noreferrer">Open source</a>
            <span class="inline-pill">${escapeHtml(result.source)}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAssistantsPanel() {
  elements.assistantList.innerHTML = state.assistants
    .map((assistant) => {
      const isActive = assistant.id === state.activeAssistantId;

      return `
        <article class="assistant-card ${isActive ? "active" : ""}">
          <div>
            <h4>${escapeHtml(assistant.name)}</h4>
            <p>${escapeHtml(assistant.description || "Custom instructions saved locally.")}</p>
          </div>
          <div class="card-actions">
            <button class="ghost-button" type="button" data-assistant-action="select" data-assistant-id="${assistant.id}">
              ${isActive ? "Selected" : "Use assistant"}
            </button>
            ${
              assistant.builtin
                ? `<span class="inline-pill">Built-in</span>`
                : `
                  <button class="ghost-button" type="button" data-assistant-action="edit" data-assistant-id="${assistant.id}">Edit</button>
                  <button class="ghost-button" type="button" data-assistant-action="delete" data-assistant-id="${assistant.id}">Delete</button>
                `
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAgentsPanel() {
  elements.agentList.innerHTML = AGENTS.map((agent) => {
    const isActive = agent.id === state.activeAgentId;

    return `
      <article class="agent-card ${isActive ? "active" : ""}">
        <div>
          <h4>${escapeHtml(agent.name)}</h4>
          <p>${escapeHtml(agent.description)}</p>
        </div>
        <div class="card-actions">
          <button class="ghost-button" type="button" data-agent-id="${agent.id}">
            ${isActive ? "Active agent" : "Use agent"}
          </button>
        </div>
      </article>
    `;
  }).join("");

  if (!state.agentRuns.length) {
    elements.agentRuns.innerHTML = `<div class="empty-panel">Agent runs will appear here with step-by-step logs.</div>`;
    return;
  }

  elements.agentRuns.innerHTML = state.agentRuns
    .slice(0, 6)
    .map(
      (run) => `
        <article class="agent-run">
          <div class="agent-run-meta">
            <strong>${escapeHtml(run.agentName)}</strong>
            <span class="inline-pill">${escapeHtml(formatTimestamp(run.createdAt))}</span>
          </div>
          <p>${escapeHtml(trimText(run.goal, 160))}</p>
          <div class="agent-log">
            ${run.steps
              .map(
                (step) => `
                  <div class="agent-step">
                    <span class="step-dot"></span>
                    <div>
                      <strong>${escapeHtml(step.title)}</strong>
                      <p>${escapeHtml(step.detail)}</p>
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      `
    )
    .join("");
}

async function handleComposerSubmit(event) {
  event.preventDefault();

  if (state.ui.awaitingResponse) {
    return;
  }

  const prompt = elements.promptInput.value.trim();

  if (!prompt && !state.pendingFileIds.length) {
    return;
  }

  if (!getActiveChat()) {
    createChat(false);
  }

  const activeChat = getActiveChat();
  const attachedFileIds = [...new Set(state.pendingFileIds)];
  const userMessage = {
    id: createId(),
    role: "user",
    mode: state.activeMode,
    provider: "",
    createdAt: new Date().toISOString(),
    text: prompt || "Use the attached files.",
    citations: [],
    images: [],
    attachedFileIds,
  };

  activeChat.messages.push(userMessage);
  activeChat.title = deriveChatTitle(activeChat, prompt);
  activeChat.updatedAt = new Date().toISOString();

  state.pendingFileIds = [];
  elements.promptInput.value = "";
  autoGrowTextarea();

  const typingMessage = {
    id: createId(),
    role: "assistant",
    mode: state.activeMode,
    provider: "",
    createdAt: new Date().toISOString(),
    text: "",
    typing: true,
    citations: [],
    images: [],
    attachedFileIds: [],
  };

  activeChat.messages.push(typingMessage);
  state.ui.awaitingResponse = true;
  renderStatusLine(`Running ${MODE_DETAILS[state.activeMode].label.toLowerCase()} flow...`);
  await persistState();
  renderAll();

  try {
    let assistantMessage;

    if (state.activeMode === "image") {
      assistantMessage = await createImageMessage(prompt);
    } else if (state.activeMode === "search") {
      assistantMessage = await createSearchMessage(prompt, attachedFileIds);
    } else if (state.activeMode === "agent") {
      assistantMessage = await createAgentMessage(prompt, attachedFileIds);
    } else {
      assistantMessage = await createChatMessage(prompt, activeChat, attachedFileIds);
    }

    replaceTypingMessage(activeChat.id, typingMessage.id, assistantMessage);

    if (assistantMessage.role === "assistant" && state.settings.autoSpeak) {
      speakText(stripMarkdown(assistantMessage.text));
    }

    renderStatusLine("Ready for the next request.");
  } catch (error) {
    replaceTypingMessage(activeChat.id, typingMessage.id, {
      id: createId(),
      role: "assistant",
      mode: state.activeMode,
      provider: "Fallback",
      createdAt: new Date().toISOString(),
      text: [
        "Something went wrong while generating that response.",
        `- ${error instanceof Error ? error.message : "Unknown error"}`,
        "- Your chats and files are still saved locally.",
      ].join("\n"),
      citations: [],
      images: [],
      attachedFileIds: [],
    });

    renderStatusLine("The request failed, but your local data is intact.");
  } finally {
    state.ui.awaitingResponse = false;
    await persistState();
    renderAll();
  }
}

function replaceTypingMessage(chatId, typingId, nextMessage) {
  const chat = state.chats.find((item) => item.id === chatId);

  if (!chat) {
    return;
  }

  const index = chat.messages.findIndex((message) => message.id === typingId);

  if (index >= 0) {
    chat.messages.splice(index, 1, nextMessage);
  } else {
    chat.messages.push(nextMessage);
  }

  chat.updatedAt = new Date().toISOString();
}

async function createChatMessage(prompt, chat, attachedFileIds) {
  const assistant = getAssistantById(state.activeAssistantId) || DEFAULT_ASSISTANTS[0];
  const fileContext = collectFileContext(prompt, attachedFileIds);
  const webPackage = state.settings.webSearchInChat ? await performSearch(prompt, false) : null;
  const modelResult = await runTextModel({
    prompt,
    assistant,
    chat,
    fileContext,
    webResults: webPackage?.results || [],
    mode: "chat",
  });

  return {
    id: createId(),
    role: "assistant",
    mode: "chat",
    provider: modelResult.provider,
    createdAt: new Date().toISOString(),
    text: modelResult.text,
    citations: [...fileContext.citations, ...(webPackage ? buildSearchCitations(webPackage.results) : [])],
    images: [],
    attachedFileIds: [],
  };
}

async function createSearchMessage(prompt, attachedFileIds) {
  const searchPackage = await performSearch(prompt, true);
  const assistant = getAssistantById(state.activeAssistantId) || DEFAULT_ASSISTANTS[0];
  const fileContext = collectFileContext(prompt, attachedFileIds);
  const modelResult = await runTextModel({
    prompt,
    assistant,
    chat: getActiveChat(),
    fileContext,
    webResults: searchPackage.results,
    mode: "search",
  });

  return {
    id: createId(),
    role: "assistant",
    mode: "search",
    provider: modelResult.provider,
    createdAt: new Date().toISOString(),
    text: `${searchPackage.summary}\n\n${modelResult.text}`,
    citations: [...buildSearchCitations(searchPackage.results), ...fileContext.citations],
    images: [],
    attachedFileIds: [],
  };
}

async function createImageMessage(prompt) {
  const images = await generateImages(prompt);

  return {
    id: createId(),
    role: "assistant",
    mode: "image",
    provider: state.settings.localOnly ? "Local concept" : "Pollinations",
    createdAt: new Date().toISOString(),
    text: state.settings.localOnly
      ? [
          `Local-only mode produced concept cards for "${prompt}".`,
          "- Turn off local-only mode to fetch remote AI-rendered images from a free public endpoint.",
        ].join("\n")
      : [
          `Generated ${images.length} image variation${images.length === 1 ? "" : "s"} for "${prompt}".`,
          "- These are saved into your local chat history so you can export them later.",
        ].join("\n"),
    citations: [],
    images,
    attachedFileIds: [],
  };
}

async function createAgentMessage(prompt, attachedFileIds) {
  const run = await executeAgent(state.activeAgentId, prompt, attachedFileIds);
  state.agentRuns.unshift(run);
  state.agentRuns = state.agentRuns.slice(0, 12);
  renderAgentsPanel();

  return {
    id: createId(),
    role: "assistant",
    mode: "agent",
    provider: run.provider,
    createdAt: new Date().toISOString(),
    text: run.output,
    citations: run.citations,
    images: [],
    attachedFileIds: [],
    agentLog: run.steps,
  };
}

async function runTextModel({ prompt, assistant, chat, fileContext, webResults, mode }) {
  const localFallback = buildLocalFallback({ prompt, assistant, fileContext, webResults, mode });

  if (state.settings.localOnly) {
    return {
      provider: "Local fallback",
      text: localFallback,
    };
  }

  const remotePrompt = buildRemotePrompt({ prompt, assistant, chat, fileContext, webResults, mode });

  try {
    const response = await fetch(`${POLLINATIONS_TEXT_URL}${encodeURIComponent(remotePrompt)}`);

    if (!response.ok) {
      throw new Error(`Text provider responded with ${response.status}.`);
    }

    const text = normalizeWhitespace(await response.text());

    return {
      provider: "Pollinations",
      text: text || localFallback,
    };
  } catch (error) {
    console.warn("Falling back to local text response.", error);

    return {
      provider: "Local fallback",
      text: localFallback,
    };
  }
}

function buildRemotePrompt({ prompt, assistant, chat, fileContext, webResults, mode }) {
  const recentMessages = (chat?.messages || [])
    .filter((message) => !message.typing)
    .slice(-6)
    .map((message) => `${message.role.toUpperCase()}: ${trimText(stripMarkdown(message.text || ""), 220)}`)
    .join("\n");

  const fileSummary = fileContext.sections
    .map((section) => `[${section.label}] ${trimText(section.text, 280)}`)
    .join("\n");

  const webSummary = webResults
    .slice(0, 3)
    .map((result, index) => `[Web ${index + 1}] ${result.title}: ${trimText(result.snippet, 220)}`)
    .join("\n");

  const promptParts = [
    "You are Limitless AI, a modern browser-first AI assistant in a no-login product.",
    `Current mode: ${mode}.`,
    assistant?.instructions ? `Assistant instructions:\n${assistant.instructions}` : "",
    recentMessages ? `Recent conversation:\n${recentMessages}` : "",
    fileSummary ? `Relevant uploaded file excerpts:\n${fileSummary}` : "",
    webSummary ? `Relevant web search results:\n${webSummary}` : "",
    `User request:\n${prompt}`,
    "Write a concise but strong markdown answer. Use bullets when helpful. Stay grounded in the context and avoid inventing facts missing from the files or search results.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return trimText(promptParts, MAX_REMOTE_PROMPT_CHARS);
}

function buildLocalFallback({ prompt, assistant, fileContext, webResults, mode }) {
  if (mode === "search" && webResults.length) {
    return [
      `Here is a local summary for "${prompt}".`,
      ...webResults.slice(0, 3).map((result) => `- ${result.title}: ${trimText(result.snippet, 180)}`),
      "- This answer used local summarization, so it stays grounded in the fetched snippets.",
    ].join("\n");
  }

  if (mode === "chat" && fileContext.sections.length) {
    return [
      `Using your uploaded files, here is the strongest local answer for "${prompt}".`,
      ...fileContext.sections.map((section) => `- ${section.label}: ${trimText(section.text, 180)}`),
      `- ${assistant?.name || "The active assistant"} stayed grounded in the extracted file context above.`,
    ].join("\n");
  }

  if (mode === "agent") {
    return [
      `I ran a local fallback workflow for "${prompt}".`,
      "- The agent still chained its steps and logged them below.",
      "- Turn off local-only mode if you want remote AI phrasing on top of the same local context.",
    ].join("\n");
  }

  return [
    `Here is a strong local-first answer for "${prompt}".`,
    "- Clarify the outcome you want most.",
    "- Use uploaded files or web search if you want grounded detail instead of a general reply.",
    "- Switch to image mode for visuals or agent mode for multi-step execution.",
  ].join("\n");
}

function collectFileContext(query, attachedFileIds) {
  const attached = attachedFileIds.length
    ? state.files.filter((file) => attachedFileIds.includes(file.id))
    : state.files.filter((file) => file.selected);

  const candidates = attached
    .filter((file) => file.status === "ready" && Array.isArray(file.sections))
    .flatMap((file) =>
      file.sections.map((section, index) => ({
        fileId: file.id,
        fileName: file.name,
        label: `${file.name} | ${section.label || `Excerpt ${index + 1}`}`,
        text: section.text,
        score: scoreText(query, section.text) + (attachedFileIds.includes(file.id) ? 5 : 0),
      }))
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CONTEXT_CHUNKS);

  return {
    sections: candidates,
    citations: dedupeByLabel(
      candidates.map((item) => ({
        type: "file",
        label: item.label,
      }))
    ),
  };
}

async function performSearch(query, persistResults) {
  const cleanedQuery = query.trim();

  if (!cleanedQuery) {
    return {
      query: "",
      results: [],
      summary: "No search query was provided.",
    };
  }

  const searchParams = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: cleanedQuery,
    srlimit: String(MAX_SEARCH_RESULTS),
    format: "json",
    origin: "*",
    utf8: "1",
  });

  const searchResponse = await fetch(`${WIKIPEDIA_API}?${searchParams.toString()}`);

  if (!searchResponse.ok) {
    throw new Error(`Search request failed with ${searchResponse.status}.`);
  }

  const searchData = await searchResponse.json();
  const hits = searchData.query?.search || [];

  if (!hits.length) {
    const emptyPackage = {
      query: cleanedQuery,
      results: [],
      summary: `No quick public results were found for "${cleanedQuery}".`,
    };

    if (persistResults) {
      state.search = { ...emptyPackage, updatedAt: new Date().toISOString() };
      await persistState();
      renderSearchPanel();
    }

    return emptyPackage;
  }

  const titles = hits.map((hit) => hit.title).join("|");
  const detailParams = new URLSearchParams({
    action: "query",
    prop: "extracts|info",
    inprop: "url",
    exintro: "1",
    explaintext: "1",
    titles,
    format: "json",
    origin: "*",
  });

  const detailResponse = await fetch(`${WIKIPEDIA_API}?${detailParams.toString()}`);
  const detailData = detailResponse.ok ? await detailResponse.json() : { query: { pages: {} } };
  const pages = Object.values(detailData.query?.pages || {});
  const pageMap = new Map(pages.map((page) => [page.title, page]));

  const results = hits.map((hit) => {
    const detail = pageMap.get(hit.title) || {};
    return {
      title: hit.title,
      source: "Wikipedia",
      snippet: trimText(normalizeWhitespace(detail.extract || stripHtml(hit.snippet) || ""), 260),
      url: detail.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replaceAll(" ", "_"))}`,
    };
  });

  const summary = buildSearchSummary(cleanedQuery, results);
  const searchPackage = {
    query: cleanedQuery,
    results,
    summary,
  };

  if (persistResults) {
    state.search = {
      ...searchPackage,
      updatedAt: new Date().toISOString(),
    };
    await persistState();
    renderSearchPanel();
  }

  return searchPackage;
}

function buildSearchSummary(query, results) {
  if (!results.length) {
    return `No public context found for "${query}".`;
  }

  return [
    `Quick brief for "${query}":`,
    ...results.slice(0, 3).map((result) => `- ${result.title}: ${trimText(result.snippet, 180)}`),
    "- Sources above can be opened directly or blended into chat and agent runs.",
  ].join("\n");
}

function buildSearchCitations(results) {
  return dedupeByLabel(
    results.slice(0, 3).map((result) => ({
      type: "web",
      label: `${result.source} | ${result.title}`,
      url: result.url,
    }))
  );
}

async function generateImages(prompt) {
  if (state.settings.localOnly) {
    return Array.from({ length: 2 }, (_, index) => createLocalConceptCard(prompt, index));
  }

  const variants = [0, 1];
  const generated = await Promise.all(
    variants.map(async (variant) => {
      try {
        const seed = Math.abs(hashValue(`${prompt}-${Date.now()}-${variant}`));
        const response = await fetch(
          `${POLLINATIONS_IMAGE_URL}${encodeURIComponent(prompt)}?seed=${seed}&width=896&height=896`
        );

        if (!response.ok) {
          throw new Error(`Image provider responded with ${response.status}.`);
        }

        const blob = await response.blob();
        const dataUrl = await blobToDataUrl(blob);

        return {
          id: createId(),
          alt: `${prompt} variation ${variant + 1}`,
          caption: `Variation ${variant + 1}`,
          dataUrl,
        };
      } catch (error) {
        console.warn("Falling back to local concept card.", error);
        return createLocalConceptCard(prompt, variant);
      }
    })
  );

  return generated;
}

function createLocalConceptCard(prompt, variant) {
  const palettes = [
    ["#71f0c5", "#16324a", "#050b10"],
    ["#ff7d9c", "#1f2f5f", "#06080d"],
  ];
  const palette = palettes[variant % palettes.length];
  const safePrompt = escapeHtml(prompt || "Untitled concept");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
      <defs>
        <linearGradient id="grad-${variant}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette[0]}"/>
          <stop offset="55%" stop-color="${palette[1]}"/>
          <stop offset="100%" stop-color="${palette[2]}"/>
        </linearGradient>
      </defs>
      <rect width="800" height="800" fill="url(#grad-${variant})"/>
      <circle cx="${190 + variant * 140}" cy="180" r="110" fill="rgba(255,255,255,0.12)"/>
      <path d="M0 610 C 120 560 260 700 420 610 S 700 470 800 580 L 800 800 L 0 800 Z" fill="rgba(0,0,0,0.28)"/>
      <rect x="42" y="42" width="716" height="716" rx="34" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
      <text x="70" y="122" fill="white" font-family="Space Grotesk, Segoe UI, sans-serif" font-size="30">LOCAL CONCEPT</text>
      <text x="70" y="640" fill="white" font-family="Fraunces, Georgia, serif" font-size="46">${safePrompt.slice(0, 26)}</text>
      <text x="70" y="690" fill="rgba(255,255,255,0.82)" font-family="Space Grotesk, Segoe UI, sans-serif" font-size="24">Fallback visual saved in browser memory</text>
    </svg>
  `;

  return {
    id: createId(),
    alt: `${prompt} concept ${variant + 1}`,
    caption: `Local concept ${variant + 1}`,
    dataUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
  };
}

async function executeAgent(agentId, goal, attachedFileIds) {
  const agent = getAgentById(agentId) || AGENTS[0];
  const steps = [];
  const citations = [];
  let output = "";
  let provider = state.settings.localOnly ? "Local fallback" : "Pollinations";

  if (agentId === "agent-research") {
    steps.push({ title: "Interpret goal", detail: "Turned the goal into a public search query." });
    const searchPackage = await performSearch(goal, false);
    steps.push({
      title: "Search public sources",
      detail: searchPackage.results.length
        ? `Collected ${searchPackage.results.length} quick results from public Wikipedia endpoints.`
        : "No public results were found, so the run stayed local and sparse.",
    });

    const result = await runTextModel({
      prompt: goal,
      assistant: getAssistantById(state.activeAssistantId),
      chat: getActiveChat(),
      fileContext: { sections: [], citations: [] },
      webResults: searchPackage.results,
      mode: "agent",
    });

    output = [searchPackage.summary, "", result.text].join("\n");
    provider = result.provider;
    citations.push(...buildSearchCitations(searchPackage.results));
    steps.push({ title: "Synthesize brief", detail: "Combined the search hits into a concise research answer." });
  } else if (agentId === "agent-files") {
    const fileContext = collectFileContext(goal, attachedFileIds);
    steps.push({
      title: "Scan selected files",
      detail: fileContext.sections.length
        ? `Ranked ${fileContext.sections.length} high-signal excerpts from your local file library.`
        : "No ready file excerpts were available, so the answer stayed high-level.",
    });

    const result = await runTextModel({
      prompt: goal,
      assistant: getAssistantById("assistant-file") || getAssistantById(state.activeAssistantId),
      chat: getActiveChat(),
      fileContext,
      webResults: [],
      mode: "agent",
    });

    output = result.text;
    provider = result.provider;
    citations.push(...fileContext.citations);
    steps.push({ title: "Ground the answer", detail: "Returned an answer anchored to the extracted document text." });
  } else {
    steps.push({ title: "Frame the objective", detail: "Identified the desired outcome and likely milestones." });
    const searchPackage = state.settings.webSearchInChat ? await performSearch(goal, false) : null;

    if (searchPackage?.results.length) {
      steps.push({
        title: "Blend web context",
        detail: `Pulled ${searchPackage.results.length} web snippets into the planning context.`,
      });
      citations.push(...buildSearchCitations(searchPackage.results));
    }

    const result = await runTextModel({
      prompt: `${goal}\n\nReturn a step-by-step execution plan with risks, milestones, and a strong first move.`,
      assistant: getAssistantById("assistant-strategy") || getAssistantById(state.activeAssistantId),
      chat: getActiveChat(),
      fileContext: collectFileContext(goal, attachedFileIds),
      webResults: searchPackage?.results || [],
      mode: "agent",
    });

    output = result.text;
    provider = result.provider;
    steps.push({ title: "Build execution plan", detail: "Converted the goal into sequenced actions and checkpoints." });
  }

  return {
    id: createId(),
    agentId: agent.id,
    agentName: agent.name,
    goal,
    createdAt: new Date().toISOString(),
    provider,
    output,
    citations,
    steps,
  };
}

async function handleSearchSubmit(event) {
  event.preventDefault();
  const query = elements.searchInput.value.trim();

  if (!query) {
    return;
  }

  renderStatusLine("Searching public sources...");
  await performSearch(query, true);
  renderStatusLine("Search results ready.");
}

async function handleAgentGoalSubmit(event) {
  event.preventDefault();
  const goal = elements.agentGoalInput.value.trim();

  if (!goal) {
    return;
  }

  state.activeMode = "agent";
  elements.promptInput.value = goal;
  autoGrowTextarea();
  elements.agentGoalInput.value = "";
  renderModeUI();
  renderHeroStrip();
  renderStatusLine("Running the active agent...");
  elements.composerForm.requestSubmit();
}

function handleLibraryAction(action, fileId) {
  const file = state.files.find((item) => item.id === fileId);

  if (!file) {
    return;
  }

  if (action === "toggle") {
    file.selected = !file.selected;
    renderStatusLine(file.selected ? `${file.name} will be used in AI context.` : `${file.name} is excluded from AI context.`);
  } else if (action === "attach") {
    const isAttached = state.pendingFileIds.includes(file.id);
    state.pendingFileIds = isAttached
      ? state.pendingFileIds.filter((id) => id !== file.id)
      : [...state.pendingFileIds, file.id];
    renderStatusLine(isAttached ? `${file.name} removed from the next prompt.` : `${file.name} attached to the next prompt.`);
  } else if (action === "delete") {
    state.files = state.files.filter((item) => item.id !== file.id);
    state.pendingFileIds = state.pendingFileIds.filter((id) => id !== file.id);
    renderStatusLine(`${file.name} was removed from the local library.`);
  }

  void persistState();
  renderFilesPanel();
  renderPendingFiles();
  renderHeroStrip();
}

function handleAssistantAction(action, assistantId) {
  const assistant = getAssistantById(assistantId);

  if (!assistant) {
    return;
  }

  if (action === "select") {
    state.activeAssistantId = assistant.id;
    renderStatusLine(`${assistant.name} is now active.`);
    void persistState();
    renderTopbar();
    renderAssistantsPanel();
    return;
  }

  if (assistant.builtin) {
    return;
  }

  if (action === "edit") {
    state.ui.assistantEditId = assistant.id;
    elements.assistantIdInput.value = assistant.id;
    elements.assistantNameInput.value = assistant.name || "";
    elements.assistantDescriptionInput.value = assistant.description || "";
    elements.assistantInstructionsInput.value = assistant.instructions || "";
    elements.cancelAssistantEditButton.hidden = false;
    renderStatusLine(`Editing ${assistant.name}.`);
    return;
  }

  if (action === "delete") {
    state.assistants = state.assistants.filter((item) => item.id !== assistant.id);

    if (state.activeAssistantId === assistant.id) {
      state.activeAssistantId = DEFAULT_ASSISTANTS[0].id;
    }

    clearAssistantForm();
    renderStatusLine(`${assistant.name} was deleted from local storage.`);
    void persistState();
    renderAll();
  }
}

function saveAssistantFromForm() {
  const name = elements.assistantNameInput.value.trim();
  const description = elements.assistantDescriptionInput.value.trim();
  const instructions = elements.assistantInstructionsInput.value.trim();

  if (!name || !instructions) {
    renderStatusLine("Assistant name and instructions are required.");
    return;
  }

  const existingId = elements.assistantIdInput.value.trim();

  if (existingId) {
    const target = state.assistants.find((assistant) => assistant.id === existingId && !assistant.builtin);

    if (!target) {
      return;
    }

    target.name = name;
    target.description = description;
    target.instructions = instructions;
    renderStatusLine(`${name} was updated locally.`);
  } else {
    const assistant = {
      id: createId(),
      name,
      description,
      instructions,
      builtin: false,
    };
    state.assistants.push(assistant);
    state.activeAssistantId = assistant.id;
    renderStatusLine(`${name} was saved as a custom assistant.`);
  }

  clearAssistantForm();
  void persistState();
  renderAll();
}

function clearAssistantForm() {
  state.ui.assistantEditId = null;
  elements.assistantIdInput.value = "";
  elements.assistantNameInput.value = "";
  elements.assistantDescriptionInput.value = "";
  elements.assistantInstructionsInput.value = "";
  elements.cancelAssistantEditButton.hidden = true;
}

async function ingestFiles(files, attachToPrompt) {
  for (const file of files) {
    const record = {
      id: createId(),
      name: file.name,
      size: file.size,
      kind: detectFileKind(file),
      status: "processing",
      selected: true,
      createdAt: new Date().toISOString(),
      previewUrl: "",
      summary: "Extracting text...",
      sections: [],
      error: "",
    };

    state.files.unshift(record);

    if (attachToPrompt) {
      state.pendingFileIds = [...state.pendingFileIds, record.id];
    }

    await persistState();
    renderFilesPanel();
    renderPendingFiles();
    renderHeroStrip();

    try {
      const extracted = await extractFileData(file);
      record.previewUrl = extracted.previewUrl || "";
      record.sections = extracted.sections;
      record.summary = extracted.summary;
      record.status = "ready";
      record.error = "";
      renderStatusLine(`${file.name} is ready for AI context.`);
    } catch (error) {
      record.status = "error";
      record.error = error instanceof Error ? error.message : "Unknown extraction error.";
      record.summary = record.error;
      renderStatusLine(`Could not process ${file.name}.`);
    }

    await persistState();
    renderFilesPanel();
    renderPendingFiles();
    renderHeroStrip();
  }
}

async function extractFileData(file) {
  const kind = detectFileKind(file);

  if (kind === "txt") {
    const text = normalizeWhitespace(await file.text());
    return buildExtractedFilePayload(text, "", "Text");
  }

  if (kind === "docx") {
    if (!window.mammoth?.extractRawText) {
      throw new Error("DOCX extraction library is not available.");
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    const text = normalizeWhitespace(result.value || "");
    return buildExtractedFilePayload(text, "", "Document");
  }

  if (kind === "pdf") {
    if (!window.pdfjsLib?.getDocument) {
      throw new Error("PDF extraction library is not available.");
    }

    const data = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data }).promise;
    const sections = [];
    let combinedText = "";

    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const textContent = await page.getTextContent();
      const pageText = normalizeWhitespace(textContent.items.map((item) => item.str).join(" "));

      if (!pageText) {
        continue;
      }

      combinedText += ` ${pageText}`;
      sections.push(...chunkText(pageText, `Page ${pageIndex}`));

      if (combinedText.length >= MAX_FILE_TEXT_CHARS) {
        break;
      }
    }

    return {
      previewUrl: "",
      sections: sections.slice(0, 24),
      summary: extractiveSummary(combinedText, "", 3),
    };
  }

  if (kind === "image") {
    const previewUrl = await fileToDataUrl(file);

    if (!window.Tesseract?.recognize) {
      return buildExtractedFilePayload("", previewUrl, "Image");
    }

    const result = await window.Tesseract.recognize(file, "eng");
    const text = normalizeWhitespace(result.data?.text || "");

    return buildExtractedFilePayload(text, previewUrl, "OCR");
  }

  throw new Error("Unsupported file type.");
}

function buildExtractedFilePayload(text, previewUrl, labelPrefix) {
  const limitedText = trimText(text, MAX_FILE_TEXT_CHARS);
  return {
    previewUrl,
    sections: limitedText ? chunkText(limitedText, labelPrefix) : [],
    summary: limitedText
      ? extractiveSummary(limitedText, "", 3)
      : "No text could be extracted, but the file is still stored locally for reference.",
  };
}

async function toggleVoiceInput() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!Recognition) {
    renderStatusLine("Speech recognition is not available in this browser.");
    return;
  }

  if (state.ui.listening && speechRecognitionHandle) {
    speechRecognitionHandle.stop();
    return;
  }

  speechRecognitionHandle = new Recognition();
  speechRecognitionHandle.lang = navigator.language || "en-US";
  speechRecognitionHandle.interimResults = false;
  speechRecognitionHandle.maxAlternatives = 1;

  speechRecognitionHandle.onstart = () => {
    state.ui.listening = true;
    updateVoiceButton();
    renderStatusLine("Listening...");
  };

  speechRecognitionHandle.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript?.trim();

    if (!transcript) {
      return;
    }

    elements.promptInput.value = `${elements.promptInput.value.trim()} ${transcript}`.trim();
    autoGrowTextarea();
    renderStatusLine("Voice input captured.");
  };

  speechRecognitionHandle.onerror = () => {
    state.ui.listening = false;
    updateVoiceButton();
    renderStatusLine("Voice input failed in this browser session.");
  };

  speechRecognitionHandle.onend = () => {
    state.ui.listening = false;
    updateVoiceButton();
  };

  speechRecognitionHandle.start();
}

function updateVoiceButton() {
  elements.voiceButton.textContent = state.ui.listening ? "Stop listening" : "Voice input";
}

function speakText(text) {
  if (!("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(trimText(text, 1200));
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function renderStatusLine(message) {
  elements.statusLine.textContent = message;
}

function autoGrowTextarea() {
  elements.promptInput.style.height = "auto";
  elements.promptInput.style.height = `${Math.min(elements.promptInput.scrollHeight, 200)}px`;
}

function deriveChatTitle(chat, prompt) {
  if (!prompt.trim()) {
    return chat.title;
  }

  return trimText(prompt.trim(), 42);
}

function detectFileKind(file) {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".pdf")) {
    return "pdf";
  }

  if (lowerName.endsWith(".docx")) {
    return "docx";
  }

  if (lowerName.endsWith(".txt")) {
    return "txt";
  }

  if (file.type.startsWith("image/")) {
    return "image";
  }

  return "file";
}

function chunkText(text, labelPrefix) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => normalizeWhitespace(paragraph))
    .filter(Boolean);
  const chunks = [];

  if (!paragraphs.length && text.trim()) {
    return [{ id: createId(), label: `${labelPrefix} 1`, text: trimText(text.trim(), 900) }];
  }

  let buffer = "";
  let count = 1;

  paragraphs.forEach((paragraph) => {
    if ((buffer + ` ${paragraph}`).trim().length > 850) {
      if (buffer.trim()) {
        chunks.push({
          id: createId(),
          label: `${labelPrefix} ${count}`,
          text: buffer.trim(),
        });
        count += 1;
      }
      buffer = paragraph;
    } else {
      buffer = `${buffer} ${paragraph}`.trim();
    }
  });

  if (buffer.trim()) {
    chunks.push({
      id: createId(),
      label: `${labelPrefix} ${count}`,
      text: buffer.trim(),
    });
  }

  return chunks.slice(0, 24);
}

function extractiveSummary(text, query, sentenceCount) {
  const sentences = splitSentences(text).slice(0, 40);

  if (!sentences.length) {
    return "Text extracted successfully.";
  }

  const scored = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score: scoreText(query, sentence) + Math.max(0, 3 - index * 0.1),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, sentenceCount)
    .sort((a, b) => a.index - b.index)
    .map((item) => `- ${trimText(item.sentence, 220)}`);

  return scored.join("\n");
}

function splitSentences(text) {
  return normalizeWhitespace(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 24);
}

function scoreText(query, text) {
  const queryTokens = tokenize(query);
  const haystack = tokenize(text);

  if (!queryTokens.length) {
    return text.length > 40 ? 1 : 0;
  }

  return queryTokens.reduce((score, token) => score + (haystack.includes(token) ? 3 : 0), 0);
}

function tokenize(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 2);
}

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, " ");
}

function stripMarkdown(value) {
  return String(value || "")
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatRichText(text) {
  const safeText = escapeHtml(text || "");

  if (!safeText.trim()) {
    return "";
  }

  return safeText
    .split("\n\n")
    .map((block) => {
      const lines = block.split("\n").filter(Boolean);
      const isList = lines.every((line) => /^[-*]\s/.test(line));

      if (isList) {
        return `<ul>${lines.map((line) => `<li>${line.replace(/^[-*]\s/, "")}</li>`).join("")}</ul>`;
      }

      return `<p>${lines.join("<br>")}</p>`;
    })
    .join("");
}

function formatTimestamp(value) {
  if (!value) {
    return "Now";
  }

  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function trimText(text, length) {
  const value = String(text || "");
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

function dedupeByLabel(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.label)) {
      return false;
    }

    seen.add(item.label);
    return true;
  });
}

function hashValue(value) {
  return Array.from(value).reduce((hash, character) => {
    return ((hash << 5) - hash + character.charCodeAt(0)) >>> 0;
  }, 0);
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not convert blob to data URL."));
    reader.readAsDataURL(blob);
  });
}

function exportChats() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    chats: state.chats,
  };
  downloadJson("limitless-ai-chats.json", payload);
  renderStatusLine("Chat export downloaded.");
}

function exportWorkspace() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    state: createPersistableSnapshot(),
  };
  downloadJson("limitless-ai-workspace.json", payload);
  renderStatusLine("Workspace export downloaded.");
}

async function importWorkspace(file) {
  try {
    const content = await file.text();
    const payload = JSON.parse(content);

    if (payload.state) {
      mergeImportedSnapshot(payload.state);
    } else if (payload.chats) {
      mergeImportedSnapshot({ chats: payload.chats });
    } else {
      throw new Error("This JSON file is not a Limitless AI export.");
    }

    ensureSeedState();
    await persistState();
    renderAll();
    renderStatusLine("Workspace import completed.");
  } catch (error) {
    renderStatusLine(error instanceof Error ? error.message : "Import failed.");
  }
}

function mergeImportedSnapshot(snapshot) {
  const existingChatIds = new Set(state.chats.map((chat) => chat.id));
  const existingFileIds = new Set(state.files.map((file) => file.id));
  const existingAssistantIds = new Set(state.assistants.map((assistant) => assistant.id));
  const existingRunIds = new Set(state.agentRuns.map((run) => run.id));

  if (Array.isArray(snapshot.chats)) {
    snapshot.chats.forEach((chat) => {
      if (!existingChatIds.has(chat.id)) {
        state.chats.push(chat);
      }
    });
  }

  if (Array.isArray(snapshot.files)) {
    snapshot.files.forEach((file) => {
      if (!existingFileIds.has(file.id)) {
        state.files.push(file);
      }
    });
  }

  if (Array.isArray(snapshot.assistants)) {
    snapshot.assistants.forEach((assistant) => {
      if (!existingAssistantIds.has(assistant.id)) {
        state.assistants.push(assistant);
      }
    });
  }

  if (Array.isArray(snapshot.agentRuns)) {
    snapshot.agentRuns.forEach((run) => {
      if (!existingRunIds.has(run.id)) {
        state.agentRuns.push(run);
      }
    });
  }

  if (snapshot.search) {
    state.search = {
      query: snapshot.search.query || state.search.query,
      results: Array.isArray(snapshot.search.results) ? snapshot.search.results : state.search.results,
      summary: snapshot.search.summary || state.search.summary,
      updatedAt: snapshot.search.updatedAt || state.search.updatedAt,
    };
  }
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function createPersistableSnapshot() {
  return {
    chats: state.chats,
    activeChatId: state.activeChatId,
    activeSection: state.activeSection,
    activeMode: state.activeMode,
    activeAssistantId: state.activeAssistantId,
    activeAgentId: state.activeAgentId,
    pendingFileIds: state.pendingFileIds,
    files: state.files,
    assistants: state.assistants,
    search: state.search,
    agentRuns: state.agentRuns,
    settings: state.settings,
  };
}

async function persistState() {
  const snapshot = createPersistableSnapshot();
  await setPersistedValue(STORAGE_KEY, snapshot);
}

async function getPersistedValue(key) {
  if (!("indexedDB" in window)) {
    const raw = safeLocalGet(key);
    return raw ? JSON.parse(raw) : null;
  }

  try {
    const db = await openDb();
    const value = await new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, "readonly");
      const store = transaction.objectStore(DB_STORE);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(request.error);
    });

    safeLocalSet(key, JSON.stringify(value));
    return value;
  } catch (error) {
    console.warn("IndexedDB read failed, falling back to localStorage.", error);
    const raw = safeLocalGet(key);
    return raw ? JSON.parse(raw) : null;
  }
}

async function setPersistedValue(key, value) {
  safeLocalSet(key, JSON.stringify(value));

  if (!("indexedDB" in window)) {
    return;
  }

  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, "readwrite");
      const store = transaction.objectStore(DB_STORE);
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("IndexedDB write failed; localStorage copy still exists.", error);
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function safeLocalGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn("localStorage read failed.", error);
    return null;
  }
}

function safeLocalSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn("localStorage write failed.", error);
  }
}
