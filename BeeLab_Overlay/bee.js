(() => {
  'use strict';

  const ROOT_ID = 'beelab-coach';
  const COLLAPSED_CLASS = 'beelab-collapsed';
  const DRAG_THRESHOLD = 6;

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

  class BeeGuide {
    constructor(coach) {
      this.coach = coach;
      this.highlightState = null;
      this.boundUpdate = this.updateHighlightPosition.bind(this);
    }

    highlightElement(target, message = '', options = {}) {
      const element = typeof target === 'string' ? document.querySelector(target) : target;
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
        closeButton: root.querySelector('.beelab-close'),
        modeButtons: Array.from(root.querySelectorAll('.beelab-mode-button')),
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

      this.guide = new BeeGuide(this);
    }

    init() {
      this.bindEvents();
      this.installDragging();
      this.updateModeButtons();
      this.prepareModelSlot();
      this.emitSystemMessage('Bee', 'Ready to guide you through the app! Try "Teach me funnels" or "Help me send a workflow".');
    }

    bindEvents() {
      const { avatarHandle, closeButton, modeButtons, promptForm, voiceButton } = this.elements;

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
        button.addEventListener('click', () => this.setMode(button.dataset.mode));
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

      const setPositionMode = () => {
        this.root.style.bottom = 'auto';
        this.root.style.right = 'auto';
        this.root.dataset.positioning = 'custom';
      };

      const onPointerDown = (event) => {
        if (event.button !== undefined && event.button !== 0) {
          return;
        }

        pointerId = event.pointerId;
        dragged = false;
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

        setPositionMode();
        const coachRect = this.root.getBoundingClientRect();
        const width = coachRect.width;
        const height = coachRect.height;
        let nextLeft = originLeft + deltaX;
        let nextTop = originTop + deltaY;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        nextLeft = Math.min(Math.max(12, nextLeft), viewportWidth - width - 12);
        nextTop = Math.min(Math.max(12, nextTop), viewportHeight - height - 12);

        this.root.style.left = `${nextLeft}px`;
        this.root.style.top = `${nextTop}px`;
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

        setTimeout(() => {
          this.state.wasDragged = false;
        }, 0);
      };

      handle.addEventListener('pointerdown', onPointerDown);
      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', onPointerUp);
      handle.addEventListener('pointercancel', onPointerUp);
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

    setMode(nextMode) {
      if (!nextMode || this.state.mode === nextMode) {
        return;
      }
      this.state.mode = nextMode;
      this.root.dataset.mode = nextMode;
      this.updateModeButtons();
      this.appendMessage('Bee', nextMode === 'teach'
        ? 'Teach mode activated. I will narrate the steps and highlight what matters.'
        : 'Do mode activated. I can suggest actions and execute them once you approve.');
    }

    updateModeButtons() {
      this.elements.modeButtons.forEach((button) => {
        const isActive = button.dataset.mode === this.state.mode;
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
      this.reveal();

      const typingMessage = 'I am getting ready to connect with my AI brain. Soon I will be able to take real actions for you.';
      this.appendMessage('Bee', typingMessage);

      // Placeholder for future AI integration hook.
      window.dispatchEvent(new CustomEvent('beelab:prompt', {
        detail: {
          message,
          mode: this.state.mode,
          context
        }
      }));
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

    moveToElement(target, options = {}) {
      const element = typeof target === 'string' ? document.querySelector(target) : target;
      if (!element) {
        return;
      }

      const elementRect = element.getBoundingClientRect();
      const coachRect = this.root.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let preferredLeft = elementRect.right + 16;
      if (options.prefer === 'left') {
        preferredLeft = elementRect.left - coachRect.width - 16;
      } else if (options.prefer === 'center') {
        preferredLeft = elementRect.left + (elementRect.width - coachRect.width) / 2;
      }

      let preferredTop = elementRect.top - coachRect.height - 16;
      if (options.prefer === 'bottom') {
        preferredTop = elementRect.bottom + 16;
      }

      preferredLeft = Math.min(Math.max(12, preferredLeft), viewportWidth - coachRect.width - 12);
      preferredTop = Math.min(Math.max(12, preferredTop), viewportHeight - coachRect.height - 12);

      this.root.style.left = `${preferredLeft}px`;
      this.root.style.top = `${preferredTop}px`;
      this.root.style.bottom = 'auto';
      this.root.style.right = 'auto';
      this.root.dataset.positioning = 'custom';
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
