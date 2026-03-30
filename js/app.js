/**
 * DISCIPLINE AI — Application Logic
 * Responsible AI-Assisted Reasoning Framework
 * Powered by Google Gemini API
 */

(function () {
    'use strict';

    // ──────────────────────────────────
    // Configuration & State
    // ──────────────────────────────────
    const GEMINI_MODEL = 'gemini-2.0-flash';
    const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    const PHASE_CONFIG = {
        open: {
            label: 'Open Dialogue',
            system: `You are "Discipline AI", a responsible reasoning assistant built on an Instruction-Discipline Framework. 
You assist users in thinking clearly, building strong arguments, and producing well-structured analysis.
Your core protection line is: you must NEVER dilute the user's core argument or idea.
Be precise, substantive, and intellectually rigorous. Avoid filler language.
When the user shares an idea or issue, help them think through it systematically.
Use structured formatting with headings, bullet points, and clear sections where appropriate.`
        },
        identify: {
            label: '3.1 — Idea Identification',
            system: `You are operating in Phase 3.1 (Idea/Issue Identification) of the Instruction-Discipline Framework.
The user will present a raw idea, issue, observation, or content.
Your job: distill it to its absolute core in minimal, precise terms. Identify the fundamental problem or observation.
Do NOT expand or elaborate extensively. Be sharp and concise.
Protection line: do not dilute the core argument.
Structure your response as:
**Core Issue:** [one clear sentence]
**Key Dimensions:** [2-4 bullet points]
**Initial Tension:** [what makes this issue non-trivial]`
        },
        expand: {
            label: '3.2 — Question Expansion',
            system: `You are operating in Phase 3.2 (Question Expansion) of the Instruction-Discipline Framework.
From the issue or idea the user presents, generate ALL meaningful questions that arise.
Map the full analytical space. Categorize questions by type: factual, conceptual, ethical, practical, systemic.
Be exhaustive but relevant. Each question should open a genuine line of inquiry.
Protection line: do not dilute the core argument.`
        },
        scope: {
            label: '3.3 — Scope Control',
            system: `You are operating in Phase 3.3 (Scope Control / Domain Mapping) of the Instruction-Discipline Framework.
Categorize the user's issue by domain: science, law, economy, public health, governance, technology, ethics, and any other relevant domains.
For EACH domain, indicate:
- Relevance (high/medium/low)
- Feasible depth of analysis (surface/moderate/deep)
- Key considerations in that domain
This prevents domain confusion and analytical overreach.
Protection line: do not dilute the core argument.`
        },
        authority: {
            label: '3.4 — Authority Building',
            system: `You are operating in Phase 3.4 (Authority Building) of the Instruction-Discipline Framework.
Analyse the user's issue using established research, data, known precedents, and institutional positions.
AVOID speculation entirely. If evidence is limited, say so clearly.
Cite types of sources (peer-reviewed research, government reports, legal precedents, etc.) even if you cannot provide exact URLs.
Ground every claim in evidence or established reasoning.
Protection line: do not dilute the core argument.`
        },
        output: {
            label: '3.5 — Output Selection',
            system: `You are operating in Phase 3.5 (Output Selection) of the Instruction-Discipline Framework.
Convert the user's analysis or idea into the requested output format.
Common formats: policy note, research proposal, academic abstract, public communication, executive brief, op-ed, technical memo.
If no format is specified, ask the user what format they need.
Maintain full substance during conversion. Adapt tone and structure to the format, never the depth.
Protection line: do not dilute the core argument.`
        },
        refine: {
            label: '4.0 — Instruction Discipline',
            system: `You are operating in Phase 4 (Instruction Discipline / Refinement) of the Instruction-Discipline Framework.
The user will give you content along with a specific instruction (e.g., grammar fix, summarise, critique, stress-test, sharpen, restructure).
Apply ONLY the requested operation. Do not add unsolicited content or change the argument.
If asked to critique, be genuinely rigorous — identify real weaknesses.
If asked to stress-test, present the strongest possible counter-arguments.
Protection line: NEVER dilute the core argument.`
        }
    };

    let state = {
        apiKey: '',
        currentPhase: 'open',
        sessions: [],          // { id, title, phase, messages[] }
        activeSessionId: null,
        isGenerating: false
    };

    // ──────────────────────────────────
    // DOM References
    // ──────────────────────────────────
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {
        apiOverlay: $('#apiOverlay'),
        apiKeyInput: $('#apiKeyInput'),
        apiSubmit: $('#apiSubmit'),
        toggleKeyVis: $('#toggleKeyVis'),
        appContainer: $('#appContainer'),
        sidebar: $('#sidebar'),
        sidebarToggle: $('#sidebarToggle'),
        newChatBtn: $('#newChatBtn'),
        historyList: $('#historyList'),
        clearAllBtn: $('#clearAllBtn'),
        changeKeyBtn: $('#changeKeyBtn'),
        headerPhaseLabel: $('#headerPhaseLabel'),
        messagesContainer: $('#messagesContainer'),
        welcomeScreen: $('#welcomeScreen'),
        messagesList: $('#messagesList'),
        refinementChips: $('#refinementChips'),
        userInput: $('#userInput'),
        sendBtn: $('#sendBtn')
    };

    // ──────────────────────────────────
    // Initialization
    // ──────────────────────────────────
    function init() {
        loadState();
        bindEvents();

        if (state.apiKey) {
            showApp();
        }
    }

    function loadState() {
        try {
            const saved = localStorage.getItem('discipline_ai_state');
            if (saved) {
                const parsed = JSON.parse(saved);
                state.apiKey = parsed.apiKey || '';
                state.sessions = parsed.sessions || [];
                state.activeSessionId = parsed.activeSessionId || null;
                state.currentPhase = parsed.currentPhase || 'open';
            }
        } catch (e) {
            console.warn('Failed to load state:', e);
        }
    }

    function saveState() {
        try {
            localStorage.setItem('discipline_ai_state', JSON.stringify({
                apiKey: state.apiKey,
                sessions: state.sessions,
                activeSessionId: state.activeSessionId,
                currentPhase: state.currentPhase
            }));
        } catch (e) {
            console.warn('Failed to save state:', e);
        }
    }

    // ──────────────────────────────────
    // Event Bindings
    // ──────────────────────────────────
    function bindEvents() {
        // API key entry
        dom.apiSubmit.addEventListener('click', handleApiSubmit);
        dom.apiKeyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleApiSubmit();
        });
        dom.toggleKeyVis.addEventListener('click', () => {
            const inp = dom.apiKeyInput;
            inp.type = inp.type === 'password' ? 'text' : 'password';
        });

        // New chat
        dom.newChatBtn.addEventListener('click', () => {
            createNewSession();
            closeSidebarMobile();
        });

        // Phase navigation
        $$('.phase-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                setPhase(btn.dataset.phase);
                closeSidebarMobile();
            });
        });

        // Send message
        dom.sendBtn.addEventListener('click', handleSend);
        dom.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        // Auto-resize textarea
        dom.userInput.addEventListener('input', autoResize);

        // Enable/disable send button
        dom.userInput.addEventListener('input', () => {
            dom.sendBtn.disabled = !dom.userInput.value.trim() || state.isGenerating;
        });

        // Welcome cards
        $$('.welcome-card').forEach(card => {
            card.addEventListener('click', () => {
                dom.userInput.value = card.dataset.prompt;
                autoResize();
                dom.sendBtn.disabled = false;
                dom.userInput.focus();
            });
        });

        // Refinement chips
        $$('.ref-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const currentVal = dom.userInput.value.trim();
                const instruction = chip.dataset.instruction;
                if (currentVal) {
                    dom.userInput.value = instruction + '\n\nContent:\n' + currentVal;
                } else {
                    dom.userInput.value = instruction + '\n\nContent:\n';
                }
                autoResize();
                dom.sendBtn.disabled = false;
                dom.userInput.focus();
            });
        });

        // Sidebar toggle (mobile)
        dom.sidebarToggle.addEventListener('click', toggleSidebar);

        // Clear all
        dom.clearAllBtn.addEventListener('click', () => {
            if (confirm('Clear all sessions? This cannot be undone.')) {
                state.sessions = [];
                state.activeSessionId = null;
                saveState();
                renderHistory();
                createNewSession();
            }
        });

        // Change API key
        dom.changeKeyBtn.addEventListener('click', () => {
            state.apiKey = '';
            saveState();
            dom.appContainer.classList.remove('visible');
            dom.apiOverlay.classList.remove('hidden');
            dom.apiKeyInput.value = '';
            dom.apiKeyInput.focus();
        });
    }

    // ──────────────────────────────────
    // API Key & App Entry
    // ──────────────────────────────────
    function handleApiSubmit() {
        const key = dom.apiKeyInput.value.trim();
        if (!key) {
            dom.apiKeyInput.focus();
            return;
        }
        state.apiKey = key;
        saveState();
        showApp();
    }

    function showApp() {
        dom.apiOverlay.classList.add('hidden');
        dom.appContainer.classList.add('visible');

        if (state.activeSessionId) {
            const session = getSession(state.activeSessionId);
            if (session) {
                state.currentPhase = session.phase;
                updatePhaseUI();
                renderMessages(session);
            } else {
                createNewSession();
            }
        } else {
            createNewSession();
        }
        renderHistory();
    }

    // ──────────────────────────────────
    // Sessions
    // ──────────────────────────────────
    function createNewSession() {
        const session = {
            id: generateId(),
            title: 'New session',
            phase: state.currentPhase,
            messages: [],
            createdAt: Date.now()
        };
        state.sessions.unshift(session);
        state.activeSessionId = session.id;
        saveState();

        dom.messagesList.innerHTML = '';
        dom.welcomeScreen.classList.remove('hidden');
        updatePhaseUI();
        renderHistory();
        dom.userInput.value = '';
        dom.userInput.focus();
        autoResize();
    }

    function getSession(id) {
        return state.sessions.find(s => s.id === id);
    }

    function switchSession(id) {
        const session = getSession(id);
        if (!session) return;

        state.activeSessionId = id;
        state.currentPhase = session.phase;
        saveState();

        updatePhaseUI();
        renderMessages(session);
        renderHistory();
    }

    function deleteSession(id) {
        state.sessions = state.sessions.filter(s => s.id !== id);
        if (state.activeSessionId === id) {
            if (state.sessions.length > 0) {
                switchSession(state.sessions[0].id);
            } else {
                createNewSession();
            }
        }
        saveState();
        renderHistory();
    }

    function generateId() {
        return 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }

    // ──────────────────────────────────
    // Phase Management
    // ──────────────────────────────────
    function setPhase(phase) {
        state.currentPhase = phase;

        const session = getSession(state.activeSessionId);
        if (session) {
            session.phase = phase;
        }
        saveState();
        updatePhaseUI();
    }

    function updatePhaseUI() {
        const config = PHASE_CONFIG[state.currentPhase];
        dom.headerPhaseLabel.textContent = config.label;

        // Update sidebar active state
        $$('.phase-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.phase === state.currentPhase);
        });

        // Show/hide refinement chips
        dom.refinementChips.style.display = state.currentPhase === 'refine' ? 'flex' : 'none';

        // Update placeholder
        const placeholders = {
            open: 'Describe your idea, issue, or observation…',
            identify: 'Paste your raw idea or observation here…',
            expand: 'State the issue to generate analytical questions…',
            scope: 'Describe the issue for domain mapping…',
            authority: 'Present the issue for evidence-based analysis…',
            output: 'Provide analysis and specify the output format…',
            refine: 'Paste content to refine, or use the chips above…'
        };
        dom.userInput.placeholder = placeholders[state.currentPhase] || placeholders.open;
    }

    // ──────────────────────────────────
    // Message Handling
    // ──────────────────────────────────
    function handleSend() {
        const text = dom.userInput.value.trim();
        if (!text || state.isGenerating) return;

        const session = getSession(state.activeSessionId);
        if (!session) return;

        // Hide welcome screen
        dom.welcomeScreen.classList.add('hidden');

        // Add user message
        const userMsg = { role: 'user', content: text, timestamp: Date.now() };
        session.messages.push(userMsg);

        // Update session title from first message
        if (session.messages.length === 1) {
            session.title = text.substring(0, 50) + (text.length > 50 ? '…' : '');
        }
        saveState();

        appendMessage(userMsg);
        dom.userInput.value = '';
        autoResize();
        dom.sendBtn.disabled = true;

        // Generate AI response
        generateResponse(session);
        renderHistory();
    }

    async function generateResponse(session) {
        state.isGenerating = true;
        dom.sendBtn.disabled = true;

        // Show typing indicator
        const typingEl = appendTypingIndicator();

        try {
            const phaseConfig = PHASE_CONFIG[session.phase] || PHASE_CONFIG.open;

            // Build conversation history for Gemini
            const contents = [];

            // Add conversation history
            for (const msg of session.messages) {
                contents.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                });
            }

            const requestBody = {
                contents: contents,
                systemInstruction: {
                    parts: [{ text: phaseConfig.system }]
                },
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.9,
                    topK: 40,
                    maxOutputTokens: 4096
                }
            };

            const response = await fetch(`${API_ENDPOINT}?key=${state.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMsg = errData?.error?.message || `API error ${response.status}`;
                throw new Error(errMsg);
            }

            const data = await response.json();
            const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!aiText) {
                throw new Error('Empty response from Gemini API');
            }

            // Remove typing indicator
            typingEl.remove();

            // Add AI message
            const aiMsg = { role: 'assistant', content: aiText, timestamp: Date.now() };
            session.messages.push(aiMsg);
            saveState();

            appendMessage(aiMsg);

        } catch (error) {
            typingEl.remove();
            showError(error.message);
            console.error('Generation error:', error);
        } finally {
            state.isGenerating = false;
            dom.sendBtn.disabled = !dom.userInput.value.trim();
        }

        scrollToBottom();
    }

    // ──────────────────────────────────
    // Rendering
    // ──────────────────────────────────
    function appendMessage(msg) {
        const div = document.createElement('div');
        div.className = 'message';

        const isUser = msg.role === 'user';

        div.innerHTML = `
            <div class="msg-avatar ${isUser ? 'user-avatar' : 'ai-avatar'}">
                ${isUser ? 'You' : 'AI'}
            </div>
            <div class="msg-body">
                <div class="msg-label ${isUser ? 'user-label' : 'ai-label'}">
                    ${isUser ? 'You' : 'Discipline AI'}
                </div>
                <div class="msg-content">${isUser ? escapeHtml(msg.content) : renderMarkdown(msg.content)}</div>
                ${!isUser ? `
                <div class="msg-actions">
                    <button class="msg-action-btn copy-btn" title="Copy response">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                        </svg>
                        Copy
                    </button>
                </div>` : ''}
            </div>
        `;

        dom.messagesList.appendChild(div);

        // Copy button handler
        const copyBtn = div.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(msg.content).then(() => {
                    copyBtn.classList.add('copied');
                    copyBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Copied`;
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyBtn.innerHTML = `
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                            </svg>
                            Copy`;
                    }, 2000);
                });
            });
        }

        scrollToBottom();
    }

    function appendTypingIndicator() {
        const div = document.createElement('div');
        div.className = 'message';
        div.id = 'typingMessage';
        div.innerHTML = `
            <div class="msg-avatar ai-avatar">AI</div>
            <div class="msg-body">
                <div class="msg-label ai-label">Discipline AI</div>
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        dom.messagesList.appendChild(div);
        scrollToBottom();
        return div;
    }

    function renderMessages(session) {
        dom.messagesList.innerHTML = '';

        if (session.messages.length === 0) {
            dom.welcomeScreen.classList.remove('hidden');
        } else {
            dom.welcomeScreen.classList.add('hidden');
            session.messages.forEach(msg => appendMessage(msg));
        }
    }

    function renderHistory() {
        if (state.sessions.length === 0) {
            dom.historyList.innerHTML = '<div class="history-empty">No previous sessions</div>';
            return;
        }

        dom.historyList.innerHTML = '';
        state.sessions.forEach(session => {
            const item = document.createElement('div');
            item.className = 'history-item' + (session.id === state.activeSessionId ? ' active' : '');
            item.innerHTML = `
                <span class="history-item-text">${escapeHtml(session.title)}</span>
                <button class="history-item-del" title="Delete session">✕</button>
            `;

            item.querySelector('.history-item-text').addEventListener('click', () => {
                switchSession(session.id);
                closeSidebarMobile();
            });

            item.querySelector('.history-item-del').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteSession(session.id);
            });

            dom.historyList.appendChild(item);
        });
    }

    // ──────────────────────────────────
    // Markdown Renderer (lightweight)
    // ──────────────────────────────────
    function renderMarkdown(text) {
        let html = escapeHtml(text);

        // Code blocks
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code class="lang-${lang}">${code.trim()}</code></pre>`;
        });

        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Headers
        html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
        html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
        html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

        // Blockquotes
        html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>');

        // Unordered lists
        html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
        html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

        // Ordered lists
        html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

        // Horizontal rule
        html = html.replace(/^---$/gm, '<hr>');

        // Paragraphs — convert double newlines
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');

        // Wrap in paragraph if not already structured
        if (!html.startsWith('<')) {
            html = '<p>' + html + '</p>';
        }

        // Clean up empty paragraphs
        html = html.replace(/<p><\/p>/g, '');
        html = html.replace(/<p>(<h[1-6]>)/g, '$1');
        html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
        html = html.replace(/<p>(<ul>)/g, '$1');
        html = html.replace(/(<\/ul>)<\/p>/g, '$1');
        html = html.replace(/<p>(<pre>)/g, '$1');
        html = html.replace(/(<\/pre>)<\/p>/g, '$1');
        html = html.replace(/<p>(<blockquote>)/g, '$1');
        html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
        html = html.replace(/<p>(<hr>)<\/p>/g, '$1');

        return html;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ──────────────────────────────────
    // Utilities
    // ──────────────────────────────────
    function autoResize() {
        const ta = dom.userInput;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, parseInt(getComputedStyle(document.documentElement).getPropertyValue('--input-max-height'))) + 'px';
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
        });
    }

    function showError(message) {
        let toast = document.querySelector('.error-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'error-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('visible');

        setTimeout(() => {
            toast.classList.remove('visible');
        }, 5000);
    }

    function toggleSidebar() {
        dom.sidebar.classList.toggle('open');
        let backdrop = document.querySelector('.sidebar-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'sidebar-backdrop';
            document.body.appendChild(backdrop);
            backdrop.addEventListener('click', closeSidebarMobile);
        }
        backdrop.classList.toggle('visible', dom.sidebar.classList.contains('open'));
    }

    function closeSidebarMobile() {
        dom.sidebar.classList.remove('open');
        const backdrop = document.querySelector('.sidebar-backdrop');
        if (backdrop) backdrop.classList.remove('visible');
    }

    // ──────────────────────────────────
    // Boot
    // ──────────────────────────────────
    document.addEventListener('DOMContentLoaded', init);

})();
