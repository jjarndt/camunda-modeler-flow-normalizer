const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">' +
  '<path fill="currentColor" d="M3 11h2V9H3v2zm0 4h2v-2H3v2zm4-4h14V9H7v2zm0 4h14v-2H7v2zM3 7h2V5H3v2zm4 0h14V5H7v2z"/>' +
  '</svg>';

const GLOBAL_TOGGLE_KEY = '__flowNormalizerButton';

function createButton(onClick) {
  const button = document.createElement('button');
  button.className = 'btn flow-normalizer-button';
  button.title = 'Normalize all horizontal flow distances to equal spacing';

  if (onClick) {
    button.addEventListener('click', onClick);
  }

  const icon = document.createElement('span');
  icon.className = 'icon';
  icon.innerHTML = ICON_SVG;

  const label = document.createElement('span');
  label.textContent = 'Flows';

  button.appendChild(icon);
  button.appendChild(label);

  return button;
}

function getGlobalButton(statusbar) {
  if (!statusbar) {
    return null;
  }

  if (window[GLOBAL_TOGGLE_KEY]) {
    return window[GLOBAL_TOGGLE_KEY];
  }

  const global = {
    button: null,
    activeInstance: null,
    setActive(instance) {
      this.activeInstance = instance;
    },
    handleClick() {
      if (this.activeInstance) {
        this.activeInstance._normalize();
      }
    }
  };

  global.button = createButton(() => global.handleClick());

  // In status-bar__file einhaengen (links, neben Datei-Infos)
  const fileSection = statusbar.querySelector('.status-bar__file');
  if (fileSection) {
    fileSection.appendChild(global.button);
  } else {
    statusbar.appendChild(global.button);
  }

  window[GLOBAL_TOGGLE_KEY] = global;

  return global;
}

export default class FooterButton {

  constructor(canvas, flowNormalizerProvider, eventBus) {
    this._canvas = canvas;
    this._flowNormalizerProvider = flowNormalizerProvider;
    this._eventBus = eventBus;

    this._buttonElement = null;
    this._containerElement = null;
    this._activationHandler = null;

    eventBus.on('import.done', () => {
      this._init();
    });

    setTimeout(() => this._init(), 500);
  }

  _init() {
    if (this._containerElement) {
      return;
    }

    const container = this._canvas.getContainer();
    if (!container) {
      return;
    }

    const statusbar = document.querySelector('.status-bar');

    if (statusbar) {
      const global = getGlobalButton(statusbar);
      if (global) {
        this._buttonElement = global.button;
        this._containerElement = statusbar;
        this._registerActivation(container, global);
        global.setActive(this);
        return;
      }
    }

    // Fallback: floating button im Canvas-Bereich
    this._containerElement = this._createFloatingContainer(container);
    this._buttonElement = createButton(() => this._normalize());
    this._containerElement.appendChild(this._buttonElement);
  }

  _createFloatingContainer(canvasContainer) {
    const floatingContainer = document.createElement('div');
    floatingContainer.className = 'flow-normalizer-container';
    floatingContainer.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 10px;
      z-index: 1000;
    `;

    const parent = canvasContainer.parentElement;
    if (parent) {
      parent.style.position = 'relative';
      parent.appendChild(floatingContainer);
    }

    return floatingContainer;
  }

  _registerActivation(canvasContainer, global) {
    if (this._activationHandler || !canvasContainer) {
      return;
    }

    const activate = () => {
      global.setActive(this);
    };

    this._activationHandler = activate;

    canvasContainer.addEventListener('mouseenter', activate);
    canvasContainer.addEventListener('pointerdown', activate);
  }

  _normalize() {
    this._flowNormalizerProvider.normalizeAll();
  }
}

FooterButton.$inject = ['canvas', 'flowNormalizerProvider', 'eventBus'];
