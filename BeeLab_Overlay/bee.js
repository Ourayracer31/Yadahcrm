(() => {
  'use strict';

  const ROOT_ID = 'beelab-coach';
  const COLLAPSED_CLASS = 'beelab-collapsed';
  const DRAG_THRESHOLD = 6;
  const STORAGE_KEY = 'beelab-coach-state';
  const PERSONAS = {
    contractor: {
      name: 'contractor',
      label: 'Contractor Bee',
      badge: 'CT',
      greeting: 'Hard hat on. Ready to build your next workflow.'
    },
    pilot: {
      name: 'pilot',
      label: 'Pilot Bee',
      badge: 'PL',
      greeting: 'Flight plan locked. Let\'s chart the best route.'
    },
    cute: {
      name: 'cute',
      label: 'Cute Bee',
      badge: 'CU',
      greeting: 'Buzz buzz! I\'ll make this fun and easy.'
    },
    glasses: {
      name: 'glasses',
      label: 'Bee with Glasses',
      badge: 'GL',
      greeting: 'Specs on. I\'ll keep the details crisp and clear.'
    }
  };

  if (window.__beeLabCoachInjected) {
    return;
  }
  window.__beeLabCoachInjected = true;

  const whenDocumentReady = (callback) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  };

  const fetchResource = async (resourcePath) => {
    const url = chrome.runtime.getURL(resourcePath);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`BeeLab Coach failed to load ${resourcePath}`);
    }
    return response.text();
  };

  const injectInterface = async () => {
    const [html, css] = await Promise.all([
      fetchResource('bee.html'),
      fetchResource('style.css')
    ]);

    const styleTag = document.createElement('style');
    styleTag.setAttribute('data-beelab', 'coach-style');
    styleTag.textContent = css;
    document.head.appendChild(styleTag);

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();

    const root = wrapper.querySelector(`#${ROOT_ID}`);
    const templates = wrapper.querySelectorAll('template');

    if (!root) {
      throw new Error('BeeLab Coach markup missing root element.');
    }

    document.body.appendChild(root);
    templates.forEach((template) => {
      document.body.appendChild(template);
    });

    return { root, templates };
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const normalizeText = (value) => (value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const queryByText = (needle) => {
    const target = normalizeText(needle);
    if (!target) {
      return null;
    }

    const candidates = document.querySelectorAll([
      'button',
      'a',
      '[role]',
      '[aria-label]',
      'label',
      'input',
      'textarea',
      'select',
      'summary',
      'span',
      'div',
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'li'
    ].join(','));

    let bestMatch = null;
    let bestScore = Infinity;

    candidates.forEach((element) => {
      if (!(element instanceof HTMLElement)) {
        return;
      }
      if (!element.offsetParent && element !== document.body) {
        return;
      }

      const label = normalizeText(
        element.getAttribute('aria-label') || element.textContent || ''
      );

      if (!label) {
        return;
      }

      const index = label.indexOf(target);
      if (index === -1) {
        return;
      }

      const score = Math.abs(label.length - target.length) + index;
      if (score < bestScore) {
        bestScore = score;
        bestMatch = element;
      }
    });

    return bestMatch;
  };

  const parseTextSelector = (raw) => {
    if (typeof raw !== 'string') {
      return null;
    }
    const trimmed = raw.trim();
    const match = trimmed.match(/^text\s*:\s*(?:"([^"]+)"|'([^']+)'|(.+))$/i);
    if (!match) {
      return null;
    }
    const textValue = match[1] || match[2] || match[3];
    return typeof textValue === 'string' ? textValue.trim() : null;
  };

  class BeeGuide {
    constructor(coach) {
      this.coach = coach;
      this.highlightState = null;
      this.boundUpdate = this.updateHighlightPosition.bind(this);
      this.highlightTimer = null;
    }

    highlightElement(target, message = '', options = {}) {
      const spec = this.coach ? this.coach.resolveTargetSpec(target) : { element: target };
      const element = spec.element || (target instanceof Element ? target : null);
      if (!element) {
        console.warn('[BeeLab Coach] highlightElement: target not found', target);
        return null;
      }

      this.clearHighlight();

      const template = document.getElementById('beelab-highlight-template');
      if (!template) {
        console.warn('[BeeLab Coach] highlight template missing');
        return null;
      }

      const overlay = template.content.firstElementChild.cloneNode(true);
      const tooltip = overlay.querySelector('.beelab-highlight-tooltip');
      if (tooltip && message) {
        tooltip.textContent = message;
      }

      document.body.appendChild(overlay);

      this.highlightState = {
        element,
        overlay,
        message,
        options
      };

      this.updateHighlightPosition();
      window.addEventListener('resize', this.boundUpdate);
      window.addEventListener('scroll', this.boundUpdate, true);

      const duration = typeof options.duration === 'number' ? options.duration : 2000;
      this.highlightTimer = window.setTimeout(() => this.clearHighlight(), duration);

      if (options.autoReveal !== false) {
        this.coach.reveal();
        this.coach.moveToElement(element, { prefer: options.preferSide });
      }

      return overlay;
    }

    updateHighlightPosition() {
      if (!this.highlightState) {
        return;
      }

      const { element, overlay, options } = this.highlightState;
      const rect = element.getBoundingClientRect();

      if (rect.width === 0 && rect.height === 0) {
        overlay.style.opacity = '0';
        return;
      }

      overlay.style.opacity = '1';
      overlay.style.position = 'fixed';
      overlay.style.top = `${Math.max(0, rect.top - 8)}px`;
      overlay.style.left = `${Math.max(0, rect.left - 8)}px`;
      overlay.style.width = `${rect.width + 16}px`;
      overlay.style.height = `${rect.height + 16}px`;

      const tooltip = overlay.querySelector('.beelab-highlight-tooltip');
      if (tooltip && options.tooltipPosition === 'bottom') {
        tooltip.style.top = 'auto';
        tooltip.style.bottom = '-36px';
      }
    }

    clearHighlight() {
      if (!this.highlightState) {
        return;
      }
      const { overlay } = this.highlightState;
      overlay.remove();
      this.highlightState = null;
      window.removeEventListener('resize', this.boundUpdate);
      window.removeEventListener('scroll', this.boundUpdate, true);
      if (this.highlightTimer) {
        window.clearTimeout(this.highlightTimer);
        this.highlightTimer = null;
      }
    }
  }

  class BeeLabCoach {
    constructor(root) {
      this.root = root;
      this.state = {
        mode: root.dataset.mode || 'teach',
        collapsed: root.classList.contains(COLLAPSED_CLASS),
        wasDragged: false
      };

      this.elements = {
        avatarHandle: root.querySelector('.beelab-avatar-handle'),
        avatarWrapper: root.querySelector('.bee-avatar'),
        avatarIcon: root.querySelector('.bee-avatar-icon'),
        closeButton: root.querySelector('.beelab-close'),
        modeButtons: Array.from(root.querySelectorAll('.beelab-mode-button')),
        personaButtons: Array.from(root.querySelectorAll('.beelab-persona-button')),
        conversation: root.querySelector('.beelab-conversation'),
        promptForm: root.querySelector('.beelab-input'),
        promptInput: root.querySelector('#beelab-user-prompt'),
        voiceButton: root.querySelector('.beelab-voice')
      };

      this.templates = {
        message: document.getElementById('beelab-message-template')
      };

      this.voiceState = {
        recognition: null,
        listening: false
      };

      this.settings = {
        persona: root.dataset.persona || 'cute'
      };

      this.position = { x: null, y: null };
      this.activeFlight = null;
      this.flightFallback = null;
      this.pendingPosition = null;

      this.guide = new BeeGuide(this);
    }

    init() {
      this.bindEvents();
      this.installDragging();
      requestAnimationFrame(() => this.ensurePosition(true));
      this.restoreState();
      this.setPersona(this.settings.persona, { silent: true, skipSave: true });
      this.setMode(this.state.mode, { silent: true, skipSave: true });
      this.updatePersonaButtons();
      this.updateModeButtons();
      this.prepareModelSlot();

      const persona = PERSONAS[this.settings.persona] || PERSONAS.cute;
      this.emitSystemMessage('Bee', persona.greeting);
    }

    bindEvents() {
      const {
        avatarHandle,
        closeButton,
        modeButtons,
        personaButtons,
        promptForm,
        voiceButton
      } = this.elements;

      if (avatarHandle) {
        avatarHandle.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.toggleCollapse();
          }
        });
      }

      if (closeButton) {
        closeButton.addEventListener('click', () => this.collapse(true));
      }

      modeButtons.forEach((button) => {
        button.addEventListener('click', () => {
          const targetMode = button.dataset.mode;
          this.setMode(targetMode);
        });
      });

      personaButtons.forEach((button) => {
        button.addEventListener('click', () => {
          const personaName = button.dataset.persona;
          if (personaName) {
            this.reveal();
            if (!this.setPersona(personaName)) {
              this.appendMessage('Bee', 'That persona is still warming up.');
            }
          }
        });
        button.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            button.click();
          }
        });
      });

      if (promptForm) {
        promptForm.addEventListener('submit', (event) => {
          event.preventDefault();
          const textarea = this.elements.promptInput;
          if (!textarea) {
            return;
          }
          const value = textarea.value.trim();
          if (!value) {
            return;
          }
          textarea.value = '';
          this.appendMessage('You', value);
          this.handlePrompt(value, { origin: 'text' });
        });
      }

      if (voiceButton) {
        const startVoice = () => this.startVoiceCapture();
        const stopVoice = () => this.stopVoiceCapture();

        voiceButton.addEventListener('mousedown', (event) => {
          event.preventDefault();
          startVoice();
        });
        voiceButton.addEventListener('mouseup', stopVoice);
        voiceButton.addEventListener('mouseleave', () => {
          if (this.voiceState.listening) {
            stopVoice();
          }
        });
        voiceButton.addEventListener('touchstart', (event) => {
          event.preventDefault();
          startVoice();
        }, { passive: false });
        voiceButton.addEventListener('touchend', stopVoice);
      }
    }

    installDragging() {
      const handle = this.elements.avatarHandle;
      if (!handle) {
        return;
      }

      let pointerId = null;
      let startX = 0;
      let startY = 0;
      let originLeft = 0;
      let originTop = 0;
      let dragged = false;

      const onPointerDown = (event) => {
        if (event.button !== undefined && event.button !== 0) {
          return;
        }

        pointerId = event.pointerId;
        dragged = false;
        this.cancelFlight(true);
        this.ensurePosition();
        const rect = this.root.getBoundingClientRect();
        startX = event.clientX;
        startY = event.clientY;
        originLeft = rect.left;
        originTop = rect.top;
        handle.setPointerCapture(pointerId);
        this.root.classList.add('beelab-dragging');
      };

      const onPointerMove = (event) => {
        if (pointerId === null || event.pointerId !== pointerId) {
          return;
        }

        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        if (!dragged && Math.hypot(deltaX, deltaY) > DRAG_THRESHOLD) {
          dragged = true;
          this.state.wasDragged = true;
        }

        if (!dragged) {
          return;
        }

        const coachRect = this.root.getBoundingClientRect();
        const width = coachRect.width;
        const height = coachRect.height;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let nextLeft = originLeft + deltaX;
        let nextTop = originTop + deltaY;

        nextLeft = clamp(nextLeft, 12, viewportWidth - width - 12);
        nextTop = clamp(nextTop, 12, viewportHeight - height - 12);

        this.root.classList.remove('bee-fly');
        this.root.style.transform = '';
        this.root.style.left = `${nextLeft}px`;
        this.root.style.top = `${nextTop}px`;
        this.root.style.bottom = 'auto';
        this.root.style.right = 'auto';
        this.root.dataset.positioning = 'custom';
        this.position.x = nextLeft;
        this.position.y = nextTop;
      };

      const onPointerUp = (event) => {
        if (pointerId === null || event.pointerId !== pointerId) {
          return;
        }

        handle.releasePointerCapture(pointerId);
        pointerId = null;
        this.root.classList.remove('beelab-dragging');

        if (!dragged) {
          this.toggleCollapse();
        }

        this.state.wasDragged = false;
      };

      handle.addEventListener('pointerdown', onPointerDown);
      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', onPointerUp);
      handle.addEventListener('pointercancel', onPointerUp);
    }

    ensurePosition(force = false) {
      if (!force && this.position.x !== null && this.position.y !== null) {
        return;
      }
      const rect = this.root.getBoundingClientRect();
      this.position.x = rect.left;
      this.position.y = rect.top;
      this.root.style.left = `${rect.left}px`;
      this.root.style.top = `${rect.top}px`;
      this.root.style.bottom = 'auto';
      this.root.style.right = 'auto';
      this.root.style.transform = '';
      this.root.dataset.positioning = 'custom';
    }

    cancelFlight(applyPending = false) {
      if (this.activeFlight) {
        this.root.removeEventListener('transitionend', this.activeFlight);
        this.root.removeEventListener('transitioncancel', this.activeFlight);
        this.activeFlight = null;
      }
      if (this.flightFallback) {
        window.clearTimeout(this.flightFallback);
        this.flightFallback = null;
      }
      if (applyPending && this.pendingPosition) {
        this.root.style.left = `${this.pendingPosition.x}px`;
        this.root.style.top = `${this.pendingPosition.y}px`;
        this.position.x = this.pendingPosition.x;
        this.position.y = this.pendingPosition.y;
      }
      this.pendingPosition = null;
      this.root.classList.remove('bee-fly');
      this.root.style.transform = '';
    }

    animateTo(x, y) {
      this.cancelFlight(true);
      this.ensurePosition();

      const deltaX = x - this.position.x;
      const deltaY = y - this.position.y;

      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        return false;
      }

      this.pendingPosition = { x, y };

      const finalize = () => {
        if (!this.pendingPosition) {
          return;
        }
        this.cancelFlight(false);
        this.root.style.left = `${x}px`;
        this.root.style.top = `${y}px`;
        this.position.x = x;
        this.position.y = y;
        this.root.dataset.positioning = 'custom';
        this.pendingPosition = null;
      };

      const onTransitionComplete = (event) => {
        if (event && event.target !== this.root) {
          return;
        }
        finalize();
      };

      this.activeFlight = onTransitionComplete;
      this.root.addEventListener('transitionend', onTransitionComplete);
      this.root.addEventListener('transitioncancel', onTransitionComplete);

      this.flightFallback = window.setTimeout(finalize, 520);

      this.root.classList.add('bee-fly');
      void this.root.offsetWidth;
      this.root.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;

      return true;
    }

    flyTo(selectorOrRect, options = {}) {
      const spec = this.resolveTargetSpec(selectorOrRect);
      const targetRect = spec.element ? spec.element.getBoundingClientRect() : spec.rect;
      if (!targetRect || (targetRect.width === 0 && targetRect.height === 0)) {
        return false;
      }

      const coachRect = this.root.getBoundingClientRect();
      const offset = options.offset ?? 28;
      const margin = 12;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const directions = ['right', 'left', 'bottom', 'top'];
      if (options.prefer) {
        const preferIndex = directions.indexOf(options.prefer);
        if (preferIndex > -1) {
          const [preferred] = directions.splice(preferIndex, 1);
          directions.unshift(preferred);
        }
      }

      const width = coachRect.width;
      const height = coachRect.height;
      const candidates = directions.map((direction) => {
        switch (direction) {
          case 'left':
            return { x: targetRect.left - width - offset, y: targetRect.top };
          case 'bottom':
            return { x: targetRect.left, y: targetRect.bottom + offset };
          case 'top':
            return { x: targetRect.left, y: targetRect.top - height - offset };
          case 'right':
          default:
            return { x: targetRect.right + offset, y: targetRect.top };
        }
      });

      let chosen = null;
      for (const candidate of candidates) {
        const candidateX = clamp(candidate.x, margin, viewportWidth - width - margin);
        const candidateY = clamp(candidate.y, margin, viewportHeight - height - margin);
        const overlapsHoriz = candidateX < targetRect.right && candidateX + width > targetRect.left;
        const overlapsVert = candidateY < targetRect.bottom && candidateY + height > targetRect.top;
        if (!(overlapsHoriz && overlapsVert)) {
          chosen = { x: candidateX, y: candidateY };
          break;
        }
      }

      if (!chosen) {
        const fallback = candidates[0] || { x: margin, y: margin };
        chosen = {
          x: clamp(fallback.x, margin, viewportWidth - width - margin),
          y: clamp(fallback.y, margin, viewportHeight - height - margin)
        };
      }

      const moved = this.animateTo(chosen.x, chosen.y);
      if (moved && options.autoReveal !== false) {
        this.reveal();
      }
      return moved;
    }

    moveToElement(target, options = {}) {
      this.flyTo(target, options);
    }

    resolveTargetSpec(target) {
      if (target instanceof Element) {
        return {
          element: target,
          rect: null,
          label: target.id ? `#${target.id}` : target.tagName.toLowerCase()
        };
      }

      if (target && typeof target === 'object') {
        const { x, y, width, height } = target;
        if ([x, y, width, height].every((value) => typeof value === 'number')) {
          return {
            element: null,
            rect: target,
            label: 'that area'
          };
        }
      }

      if (typeof target === 'string') {
        const textValue = parseTextSelector(target);
        if (textValue) {
          const element = queryByText(textValue);
          return {
            element,
            rect: null,
            label: `"${textValue}"`
          };
        }

        const trimmed = target.trim();
        let element = null;
        try {
          element = trimmed ? document.querySelector(trimmed) : null;
        } catch (error) {
          console.warn('[BeeLab Coach] Invalid selector', trimmed, error);
        }
        return {
          element,
          rect: null,
          label: trimmed || 'that target'
        };
      }

      return {
        element: null,
        rect: null,
        label: 'that target'
      };
    }

    toggleCollapse(force) {
      const isCollapsed = this.root.classList.contains(COLLAPSED_CLASS);
      const shouldCollapse = typeof force === 'boolean' ? force : !isCollapsed;
      this.collapse(shouldCollapse);
    }

    collapse(shouldCollapse) {
      if (!shouldCollapse) {
        this.reveal();
        return;
      }
      this.root.classList.add(COLLAPSED_CLASS);
      this.state.collapsed = true;
      const handle = this.elements.avatarHandle;
      if (handle) {
        handle.setAttribute('aria-pressed', 'false');
      }
    }

    reveal() {
      this.root.classList.remove(COLLAPSED_CLASS);
      this.state.collapsed = false;
      const handle = this.elements.avatarHandle;
      if (handle) {
        handle.setAttribute('aria-pressed', 'true');
      }
    }

    setMode(nextMode, options = {}) {
      if (nextMode !== 'teach' && nextMode !== 'do') {
        return;
      }
      const changed = this.state.mode !== nextMode;
      this.state.mode = nextMode;
      this.root.dataset.mode = nextMode;
      this.updateModeButtons();

      if (changed && !options.silent) {
        this.appendMessage('Bee', nextMode === 'teach'
          ? 'Teach mode activated. I will narrate the steps and highlight what matters.'
          : 'Do mode activated. I can suggest actions and execute them once you approve.');
      }

      if (!options.skipSave) {
        this.saveState();
      }
    }

    updateModeButtons() {
      this.elements.modeButtons.forEach((button) => {
        const isActive = button.dataset.mode === this.state.mode;
        button.setAttribute('aria-pressed', String(isActive));
      });
    }

    setPersona(name, options = {}) {
      const persona = PERSONAS[name];
      if (!persona) {
        return false;
      }

      const changed = this.settings.persona !== persona.name;
      this.settings.persona = persona.name;
      this.root.dataset.persona = persona.name;

      if (this.elements.avatarWrapper) {
        this.elements.avatarWrapper.dataset.persona = persona.name;
      }
      if (this.elements.avatarIcon) {
        this.elements.avatarIcon.textContent = persona.badge;
      }

      this.updatePersonaButtons(persona.name);

      if (!options.silent) {
        const message = changed ? persona.greeting : `${persona.label} already on duty.`;
        this.appendMessage('Bee', message);
      }

      if (!options.skipSave) {
        this.saveState();
      }

      return true;
    }

    updatePersonaButtons(active = this.settings.persona) {
      this.elements.personaButtons.forEach((button) => {
        const isActive = button.dataset.persona === active;
        button.setAttribute('aria-pressed', String(isActive));
      });
    }

    appendMessage(speaker, text, variant = 'bee') {
      const template = this.templates.message;
      const conversation = this.elements.conversation;
      if (!template || !conversation) {
        return;
      }
      const instance = template.content.firstElementChild.cloneNode(true);
      const speakerEl = instance.querySelector('.beelab-message-speaker');
      const textEl = instance.querySelector('.beelab-message-text');
      if (speakerEl) {
        speakerEl.textContent = `${speaker}:`;
      }
      if (textEl) {
        textEl.textContent = text;
      }
      instance.classList.toggle('beelab-message--bee', variant === 'bee');
      conversation.appendChild(instance);
      conversation.scrollTo({ top: conversation.scrollHeight, behavior: 'smooth' });
    }

    emitSystemMessage(speaker, message) {
      this.appendMessage(speaker, message, 'bee');
    }

    handlePrompt(message, context) {
      if (this.tryHandleCommand(message)) {
        return;
      }

      this.reveal();

      const typingMessage = 'I am getting ready to connect with my AI brain. Soon I will be able to take real actions for you.';
      this.appendMessage('Bee', typingMessage);

      window.dispatchEvent(new CustomEvent('beelab:prompt', {
        detail: {
          message,
          mode: this.state.mode,
          context
        }
      }));
    }

    tryHandleCommand(rawInput) {
      if (!rawInput) {
        return false;
      }

      const input = rawInput.trim();
      if (!input) {
        return false;
      }

      const personaMatch = input.match(/^persona\s+(contractor|pilot|cute|glasses)\b/i);
      if (personaMatch) {
        const personaName = personaMatch[1].toLowerCase();
        this.reveal();
        const previousPersona = this.settings.persona;
        const success = this.setPersona(personaName, { silent: true });
        if (success && PERSONAS[personaName]) {
          const changed = previousPersona !== this.settings.persona;
          const response = changed
            ? `${PERSONAS[personaName].label} ready to assist.`
            : `${PERSONAS[personaName].label} already on duty.`;
          this.appendMessage('Bee', response);
        } else {
          this.appendMessage('Bee', 'I do not have that persona yet.');
        }
        return true;
      }

      const moveMatch = input.match(/^move\s+to\s+(.+)$/i);
      if (moveMatch) {
        const targetSpec = moveMatch[1].trim();
        const spec = this.resolveTargetSpec(targetSpec);
        this.reveal();
        if (spec.element || spec.rect) {
          const success = this.flyTo(spec.element || spec.rect);
          if (success) {
            this.appendMessage('Bee', `On my way near ${spec.label || 'that spot'}.`);
          } else {
            this.appendMessage('Bee', `I could not move near ${spec.label || 'that spot'} just yet.`);
          }
        } else {
          this.appendMessage('Bee', `I could not find ${spec.label || 'that target'}.`);
        }
        return true;
      }

      const highlightMatch = input.match(/^highlight\s+(.+)$/i);
      if (highlightMatch) {
        const targetSpec = highlightMatch[1].trim();
        const spec = this.resolveTargetSpec(targetSpec);
        this.reveal();
        if (spec.element) {
          this.highlightElement(spec.element);
          this.appendMessage('Bee', `Highlighting ${spec.label || 'that target'} for two seconds.`);
        } else {
          this.appendMessage('Bee', `I could not highlight ${spec.label || 'that target'} right now.`);
        }
        return true;
      }

      const personaCommandMatch = input.match(/^persona\b/i);
      if (personaCommandMatch) {
        this.appendMessage('Bee', 'Try "persona contractor", "persona pilot", "persona cute", or "persona glasses".');
        return true;
      }

      return false;
    }

    highlightElement(target, options = {}) {
      return this.guide.highlightElement(target, options.message || '', options);
    }

    startVoiceCapture() {
      if (this.voiceState.listening) {
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        this.appendMessage('Bee', 'Voice capture is not supported in this browser. Try typing instead.');
        return;
      }

      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.addEventListener('result', (event) => {
          const result = event.results[0];
          if (!result) {
            return;
          }
          const transcript = result[0].transcript.trim();
          if (transcript) {
            this.appendMessage('You', transcript);
            this.handlePrompt(transcript, { origin: 'voice' });
          }
        });

        recognition.addEventListener('speechend', () => {
          recognition.stop();
        });

        recognition.addEventListener('end', () => {
          this.voiceState.listening = false;
          this.voiceState.recognition = null;
          this.updateVoiceButton(false);
        });

        recognition.addEventListener('error', (event) => {
          this.appendMessage('Bee', `Voice capture error: ${event.error}`);
        });

        recognition.start();
        this.voiceState = {
          recognition,
          listening: true
        };
        this.updateVoiceButton(true);
      } catch (error) {
        console.error('[BeeLab Coach] Voice capture failed', error);
        this.appendMessage('Bee', 'I could not access the microphone. Please check your permissions.');
      }
    }

    stopVoiceCapture() {
      if (!this.voiceState.listening || !this.voiceState.recognition) {
        return;
      }
      this.voiceState.recognition.stop();
      this.voiceState.listening = false;
      this.updateVoiceButton(false);
    }

    updateVoiceButton(active) {
      const { voiceButton } = this.elements;
      if (voiceButton) {
        voiceButton.setAttribute('aria-pressed', String(Boolean(active)));
      }
    }

    saveState() {
      try {
        const payload = {
          persona: this.settings.persona,
          mode: this.state.mode
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (error) {
        console.warn('[BeeLab Coach] Failed to persist state', error);
      }
    }

    restoreState() {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          return;
        }
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          if (parsed.mode === 'teach' || parsed.mode === 'do') {
            this.state.mode = parsed.mode;
            this.root.dataset.mode = parsed.mode;
          }
          if (parsed.persona && PERSONAS[parsed.persona]) {
            this.settings.persona = parsed.persona;
          }
        }
      } catch (error) {
        console.warn('[BeeLab Coach] Failed to restore state', error);
      }
    }

    prepareModelSlot() {
      const shell = this.root.querySelector('.beelab-3d-shell');
      if (!shell) {
        return;
      }
      window.dispatchEvent(new CustomEvent('beelab:3d-placeholder', {
        detail: {
          mountPoint: shell,
          modelUrl: chrome.runtime.getURL('bee.glb')
        }
      }));
    }
  }

  const initializeCoach = async () => {
    try {
      const { root } = await injectInterface();
      const coach = new BeeLabCoach(root);
      coach.init();
      window.BeeLabCoach = coach;
      window.BeeLabGuide = coach.guide;
    } catch (error) {
      console.error('[BeeLab Coach] Failed to initialize', error);
    }
  };

  whenDocumentReady(() => {
    if (!document.body) {
      const observer = new MutationObserver(() => {
        if (document.body) {
          observer.disconnect();
          initializeCoach();
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      return;
    }
    initializeCoach();
  });
})();
