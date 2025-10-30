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
  const TEACH_MAP = {
    settings: {
      selectorHints: ['[data-test="settings"]', 'a[href*="settings"]', 'nav a[href*="settings"]'],
      textHints: ['settings'],
      explainer: 'Open Settings to manage numbers, quiet hours, and defaults.'
    },
    conversations: {
      selectorHints: ['[data-test="conversations"]', 'a[href*="conversations"]'],
      textHints: ['conversations'],
      explainer: 'Conversations keeps every message thread in one place for your team.'
    },
    launchpad: {
      selectorHints: ['[data-test="launchpad"]', 'a[href*="launchpad"]'],
      textHints: ['launchpad'],
      explainer: 'Launchpad shows quick-start tiles so new accounts get value fast.'
    },
    sites: {
      selectorHints: ['[data-test="sites"]', 'a[href*="funnels"]', 'a[href*="websites"]'],
      textHints: ['sites', 'funnels'],
      explainer: 'Sites is where you build funnels, websites, and landing pages.'
    },
    workflows: {
      selectorHints: ['[data-test="workflows"]', 'a[href*="workflows"]'],
      textHints: ['workflows', 'automations'],
      explainer: 'Workflows automate follow-up, tasks, and complex customer journeys.'
    },
    calendars: {
      selectorHints: ['[data-test="calendars"]', 'a[href*="calendars"]'],
      textHints: ['calendars', 'calendar'],
      explainer: 'Calendars manages booking pages, availability, and appointment routing.'
    },
    reviews: {
      selectorHints: ['[data-test="reviews"]', 'a[href*="reviews"]'],
      textHints: ['reviews'],
      explainer: 'Reviews gathers testimonials and helps you request new ones seamlessly.'
    }
  };
  const QUICK_ACTIONS = {
    missedCallTextBack: {
      label: 'Missed-Call Text-Back',
      mat: {
        why: 'Turn missed calls into conversations so prospects feel seen even after hours.',
        what: 'Enable the missed-call text-back toggle, set the reply number, and craft the SMS that keeps the thread alive.',
        how: 'In Settings → Phone, open the Missed Call Text Back card and switch the automation on.',
        next: 'Once enabled, drop a test call and watch Conversations for the auto SMS to confirm delivery.'
      },
      doSteps: [
        { teachKey: 'settings', label: 'Settings' },
        {
          selectorHints: ['[data-test="phone"]', 'a[href*="phone"]', 'button[data-menu="phone"]'],
          textHints: ['phone'],
          label: 'Phone'
        }
      ]
    },
    quietHours: {
      label: 'Quiet Hours',
      mat: {
        why: 'Protect your brand by pausing calls and texts during the times clients need quiet.',
        what: 'Define the quiet hour window, choose the days it applies, and confirm which numbers respect it.',
        how: 'From Settings → Phone, open the Quiet Hours section and set the schedule boundaries.',
        next: 'After saving, note the hours in your playbook so every workflow respects the same limits.'
      },
      doSteps: [
        { teachKey: 'settings', label: 'Settings' },
        {
          selectorHints: ['[data-test="phone"]', 'a[href*="phone"]', 'button[data-menu="phone"]'],
          textHints: ['phone'],
          label: 'Phone'
        }
      ]
    },
    reviewsOn: {
      label: 'Reviews On',
      mat: {
        why: 'Keep fresh social proof flowing so new leads trust you faster.',
        what: 'Connect the review sources, enable request automations, and choose the sender profile.',
        how: 'Jump into the Reviews module, open Settings, and toggle on the review requests.',
        next: 'Schedule a weekly check on replies to celebrate wins and plug gaps quickly.'
      },
      doSteps: [
        { teachKey: 'reviews', label: 'Reviews' },
        {
          selectorHints: ['[data-test="reviews-settings"]', 'a[href*="settings"]', 'button[data-tab="settings"]'],
          textHints: ['settings'],
          label: 'Reviews Settings'
        }
      ]
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
        quickButtons: Array.from(root.querySelectorAll('.beelab-quick-button')),
        conversation: root.querySelector('.beelab-conversation'),
        promptForm: root.querySelector('.beelab-input'),
        promptInput: root.querySelector('#beelab-user-prompt'),
        voiceButton: root.querySelector('.beelab-voice'),
        confirmBubble: root.querySelector('.beelab-confirm-bubble'),
        confirmMessage: root.querySelector('#beelab-confirm-message'),
        confirmYes: root.querySelector('.beelab-confirm-yes'),
        confirmNo: root.querySelector('.beelab-confirm-no'),
        toastContainer: root.querySelector('.beelab-toast-container'),
        undoButton: root.querySelector('.beelab-undo')
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
      this.activePulses = new Set();
      this.pendingConfirmation = null;
      this.lastAction = null;

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
      this.updateUndoState();
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
        quickButtons,
        promptForm,
        voiceButton,
        confirmYes,
        confirmNo,
        undoButton
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

      if (quickButtons) {
        quickButtons.forEach((button) => {
          button.addEventListener('click', () => {
            const actionKey = button.dataset.action;
            if (actionKey) {
              this.handleQuickAction(actionKey);
            }
          });
        });
      }

      if (confirmYes) {
        confirmYes.addEventListener('click', () => this.resolveConfirmation(true));
      }

      if (confirmNo) {
        confirmNo.addEventListener('click', () => this.resolveConfirmation(false));
      }

      if (undoButton) {
        undoButton.addEventListener('click', () => this.undoLastAction());
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

    findTeachElement(entry) {
      if (!entry) {
        return null;
      }
      const selectors = Array.isArray(entry.selectorHints) ? entry.selectorHints : [];
      for (const selector of selectors) {
        if (!selector) {
          continue;
        }
        let candidate = null;
        try {
          candidate = document.querySelector(selector);
        } catch (error) {
          console.warn('[BeeLab Coach] Invalid teach selector', selector, error);
        }
        if (candidate && this.isElementReachable(candidate)) {
          return candidate;
        }
      }

      const textHints = Array.isArray(entry.textHints) ? entry.textHints : [];
      for (const hint of textHints) {
        const found = queryByText(hint);
        if (found && this.isElementReachable(found)) {
          return found;
        }
      }

      return null;
    }

    isElementReachable(element) {
      if (!(element instanceof Element)) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) {
        return false;
      }
      const style = window.getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') {
        return false;
      }
      return true;
    }

    getTeachTopics() {
      return Object.keys(TEACH_MAP);
    }

    teach(topicRaw) {
      if (!topicRaw) {
        return false;
      }
      const topic = topicRaw.toLowerCase();
      const entry = TEACH_MAP[topic];
      if (!entry) {
        this.appendMessage('Bee', `I do not have a Teach walkthrough for "${topic}" yet. Try /help.`);
        return false;
      }

      const element = this.findTeachElement(entry);
      if (!element) {
        this.appendMessage('Bee', `I could not find ${topic} on this screen. Navigate there and try again.`);
        return false;
      }

      this.reveal();
      this.setMode('teach', { silent: true, skipSave: false });
      this.flyTo(element, { prefer: 'left' });
      this.highlightElement(element, entry.explainer, { duration: 2800 });
      this.spawnPagePulse(element);
      this.appendMessage('Bee', entry.explainer);
      return true;
    }

    spawnPagePulse(target) {
      const rect = target instanceof Element ? target.getBoundingClientRect() : target;
      if (!rect) {
        return;
      }
      const pulse = document.createElement('div');
      pulse.className = 'beelab-page-pulse';
      const top = rect.top + window.scrollY + rect.height / 2;
      const left = rect.left + window.scrollX + rect.width / 2;
      pulse.style.top = `${top}px`;
      pulse.style.left = `${left}px`;
      document.body.appendChild(pulse);
      this.activePulses.add(pulse);
      const timer = window.setTimeout(() => {
        pulse.remove();
        this.activePulses.delete(pulse);
      }, 2600);
      pulse.dataset.timer = String(timer);
    }

    wait(ms = 0) {
      return new Promise((resolve) => window.setTimeout(resolve, ms));
    }

    showToast(message) {
      const { toastContainer } = this.elements;
      if (!toastContainer) {
        return;
      }
      const toast = document.createElement('div');
      toast.className = 'beelab-toast';
      toast.textContent = message;
      toastContainer.appendChild(toast);
      requestAnimationFrame(() => {
        toast.classList.add('beelab-toast--show');
      });
      window.setTimeout(() => {
        toast.classList.remove('beelab-toast--show');
        window.setTimeout(() => {
          toast.remove();
        }, 240);
      }, 2000);
    }

    requestConfirmation(message = 'Do you want me to click this?') {
      const { confirmBubble, confirmMessage, confirmYes } = this.elements;
      if (!confirmBubble || !this.elements.confirmYes || !this.elements.confirmNo) {
        return Promise.resolve(true);
      }

      if (this.pendingConfirmation) {
        this.resolveConfirmation(false);
      }

      confirmBubble.dataset.visible = 'true';
      if (confirmMessage) {
        confirmMessage.textContent = message;
      }

      return new Promise((resolve) => {
        this.pendingConfirmation = { resolve };
        window.setTimeout(() => {
          if (confirmYes) {
            confirmYes.focus({ preventScroll: true });
          }
        }, 25);
      });
    }

    resolveConfirmation(result) {
      const pending = this.pendingConfirmation;
      this.pendingConfirmation = null;
      const { confirmBubble } = this.elements;
      if (confirmBubble) {
        confirmBubble.dataset.visible = 'false';
      }
      if (pending) {
        pending.resolve(Boolean(result));
      }
    }

    updateUndoState() {
      const { undoButton } = this.elements;
      if (!undoButton) {
        return;
      }
      const enabled = Boolean(this.lastAction);
      undoButton.disabled = !enabled;
      undoButton.setAttribute('aria-disabled', String(!enabled));
    }

    setLastAction(action) {
      this.lastAction = action;
      this.updateUndoState();
    }

    clearLastAction() {
      this.lastAction = null;
      this.updateUndoState();
    }

    undoLastAction() {
      if (!this.lastAction) {
        this.appendMessage('Bee', 'Nothing to undo yet. Try a Do action first.');
        return;
      }

      const { previousFocus, selector } = this.lastAction;
      let refocused = false;
      if (previousFocus && typeof previousFocus.focus === 'function') {
        try {
          previousFocus.focus({ preventScroll: false });
          refocused = true;
        } catch (error) {
          console.warn('[BeeLab Coach] Unable to focus previous element', error);
        }
      }

      if (!refocused && selector) {
        try {
          const candidate = document.querySelector(selector);
          if (candidate && typeof candidate.focus === 'function') {
            candidate.focus({ preventScroll: false });
            refocused = true;
          }
        } catch (error) {
          console.warn('[BeeLab Coach] Undo selector lookup failed', error);
        }
      }

      this.showToast(refocused ? 'Focus restored' : 'Undo queued');
      this.appendMessage('Bee', 'Undo preview: I restored focus. Full reversal is coming soon.');
      this.clearLastAction();
    }

    buildSelector(element) {
      if (!(element instanceof Element)) {
        return null;
      }
      if (element.id) {
        return `#${element.id}`;
      }
      const dataTest = element.getAttribute('data-test');
      if (dataTest) {
        return `[data-test="${dataTest}"]`;
      }
      const name = element.getAttribute('name');
      if (name) {
        return `${element.tagName.toLowerCase()}[name="${name}"]`;
      }
      const role = element.getAttribute('role');
      if (role) {
        return `${element.tagName.toLowerCase()}[role="${role}"]`;
      }
      return element.tagName ? element.tagName.toLowerCase() : null;
    }

    isElementInViewport(element, tolerance = 8) {
      if (!(element instanceof Element)) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      if (!rect) {
        return false;
      }
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      return (
        rect.bottom >= -tolerance &&
        rect.right >= -tolerance &&
        rect.top <= viewportHeight + tolerance &&
        rect.left <= viewportWidth + tolerance
      );
    }

    isElementDisabled(element) {
      if (!(element instanceof Element)) {
        return true;
      }
      if (typeof element.matches === 'function') {
        try {
          if (element.matches(':disabled')) {
            return true;
          }
        } catch (error) {
          // ignore selector errors for custom elements
        }
      }
      return element.getAttribute('aria-disabled') === 'true';
    }

    async ensureElementReady(element) {
      if (!element || !element.isConnected) {
        return false;
      }

      if (!this.isElementReachable(element) || this.isElementDisabled(element)) {
        return false;
      }

      if (!this.isElementInViewport(element)) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        await this.wait(420);
      }

      if (!this.isElementInViewport(element)) {
        element.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
        await this.wait(200);
      }

      return this.isElementReachable(element) &&
        !this.isElementDisabled(element) &&
        this.isElementInViewport(element);
    }

    async safeClick(element, options = {}) {
      if (!(element instanceof Element)) {
        this.appendMessage('Bee', 'I could not find something to click.');
        return false;
      }

      this.reveal();

      const ready = await this.ensureElementReady(element);
      if (!ready) {
        this.appendMessage('Bee', 'I could not safely reach that element to click it.');
        return false;
      }

      const confirmed = await this.requestConfirmation(options.confirmMessage || 'Do you want me to click this?');
      if (!confirmed) {
        this.appendMessage('Bee', 'Okay, I will stay put.');
        return false;
      }

      const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      try {
        element.click();
      } catch (error) {
        console.error('[BeeLab Coach] Click failed', error);
        this.appendMessage('Bee', 'Hmm, the page would not let me click that.');
        return false;
      }

      this.showToast('Done');
      const label = options.label ? options.label : 'that item';
      this.appendMessage('Bee', `Done! Clicked ${label}.`);
      this.setLastAction({
        type: 'click',
        selector: options.selector || this.buildSelector(element),
        previousFocus
      });
      return true;
    }

    handleOpenCommand(topic) {
      const entry = TEACH_MAP[topic];
      if (!entry) {
        this.appendMessage('Bee', `I do not know how to open ${topic} yet.`);
        return;
      }

      if (this.state.mode !== 'do') {
        this.appendMessage('Bee', 'Switch to Do mode so I can take that action for you.');
        return;
      }

      const element = this.findTeachElement(entry);
      if (!element) {
        this.appendMessage('Bee', `I could not find ${topic} here. Navigate there and try again.`);
        return;
      }

      this.appendMessage('Bee', `Preview ready. Confirm if you want me to open ${topic}.`);
      this.flyTo(element, { prefer: 'left' });
      this.highlightElement(element, `Ready to open ${topic}.`, { duration: 2400 });
      this.spawnPagePulse(element);

      (async () => {
        await this.safeClick(element, {
          label: topic,
          selector: entry.selectorHints && entry.selectorHints.length ? entry.selectorHints[0] : this.buildSelector(element)
        });
      })();
    }

    handleQuickAction(actionKey) {
      const action = QUICK_ACTIONS[actionKey];
      if (!action) {
        this.appendMessage('Bee', 'That quick action is not wired yet, but I can still guide you manually.');
        return;
      }

      if (this.state.mode === 'teach') {
        this.performTeachLesson(actionKey, action);
      } else {
        void this.performDoNavigation(actionKey, action);
      }
    }

    performTeachLesson(actionKey, action) {
      const { label, mat, doSteps } = action;
      if (!mat) {
        this.appendMessage('Bee', `${label} is on my roadmap. I will add the full breakdown soon.`);
        return;
      }

      this.appendMessage('Bee', `${label}: here is the 4MAT plan.`);
      this.appendMessage('Bee', `Why: ${mat.why}`);
      this.appendMessage('Bee', `What: ${mat.what}`);
      this.appendMessage('Bee', `How: ${mat.how}`);
      this.appendMessage('Bee', `Next: ${mat.next}`);

      if (doSteps && doSteps.length) {
        const firstStep = this.resolveQuickStep(doSteps[0]);
        if (firstStep.element) {
          this.flyTo(firstStep.element, { prefer: 'left' });
          this.highlightElement(firstStep.element, mat.how, { duration: 3600 });
          this.spawnPagePulse(firstStep.element);
        }
      }
    }

    async performDoNavigation(actionKey, action) {
      const { label, doSteps } = action;
      if (!doSteps || !doSteps.length) {
        this.appendMessage('Bee', `${label} isn’t automated yet, but I can walk beside you if you click it manually.`);
        return;
      }

      this.appendMessage('Bee', `Let me take you to ${label}. I will stick to the sidebar only.`);

      for (const step of doSteps) {
        const resolved = this.resolveQuickStep(step);
        if (!resolved.element) {
          this.appendMessage('Bee', `I could not spot ${step.label || 'that item'} on this page. Can you open it and then tap the tile again?`);
          return;
        }

        const confirmation = `Click ${step.label || label}?`;
        this.highlightElement(resolved.element, `Queued: ${step.label || label}`, { duration: 2400 });
        this.spawnPagePulse(resolved.element);
        const success = await this.safeClick(resolved.element, {
          label: step.label || label,
          selector: resolved.selector,
          confirmMessage: confirmation
        });

        if (!success) {
          return;
        }

        await this.wait(step.pause || 320);
      }

      this.appendMessage('Bee', 'I’m at the right spot—tell me what to fill next.');
    }

    resolveQuickStep(step) {
      if (!step) {
        return { element: null, selector: null };
      }

      let entry = step;
      if (step.teachKey && TEACH_MAP[step.teachKey]) {
        entry = TEACH_MAP[step.teachKey];
      }

      const element = this.findTeachElement(entry);
      const selector = step.selector || (entry && entry.selectorHints && entry.selectorHints.length ? entry.selectorHints[0] : null);

      return { element, selector };
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

      const openMatch = input.match(/^open\s+(settings|conversations|launchpad|sites|workflows|calendars|reviews)\b/i);
      if (openMatch) {
        const topic = openMatch[1].toLowerCase();
        this.handleOpenCommand(topic);
        return true;
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

      if (input === '/help') {
        const topics = this.getTeachTopics();
        this.appendMessage('Bee', `You can try teach ${topics.map((item) => item).join(', ')}.`);
        const quickList = Object.values(QUICK_ACTIONS).map((action) => action.label).join(', ');
        this.appendMessage('Bee', `Quick tiles: ${quickList}. Tap one or ask me to open a module in Do mode.`);
        return true;
      }

      const teachMatch = input.match(/^teach\s+([a-z0-9\-\s]+)$/i);
      if (teachMatch) {
        const topic = teachMatch[1].trim().toLowerCase().replace(/\s+/g, ' ');
        if (!topic) {
          this.appendMessage('Bee', 'Tell me what to teach, like "teach workflows".');
          return true;
        }
        const canonical = topic.replace(/\s+/g, '');
        const teachTarget = this.getTeachTopics().find((name) => (
          name === canonical ||
          name === topic ||
          topic.includes(name) ||
          name.includes(canonical) ||
          canonical.includes(name)
        ));
        if (!teachTarget) {
          this.appendMessage('Bee', `I do not have that teach script yet. Type /help to see options.`);
          return true;
        }
        this.teach(teachTarget);
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

    highlightElement(target, message = '', options = {}) {
      return this.guide.highlightElement(target, message, options);
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
