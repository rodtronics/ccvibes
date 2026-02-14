(function () {
  const STATUS_PREFIX = 'ccvibes.builderStatus.';
  const DRAFT_PREFIX = 'ccvibes.builderDraft.';
  const SAVED_PREFIX = 'ccvibes.builderSaved.';

  function safeJsonParse(value) {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function safeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function safeRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  const api = {
    statusKey(fileName) {
      return `${STATUS_PREFIX}${fileName}`;
    },
    draftKey(fileName) {
      return `${DRAFT_PREFIX}${fileName}`;
    },
    savedKey(fileName) {
      return `${SAVED_PREFIX}${fileName}`;
    },

    getStatus(fileName) {
      return safeJsonParse(safeGet(this.statusKey(fileName)));
    },
    setStatus(fileName, status) {
      return safeSet(this.statusKey(fileName), JSON.stringify(status));
    },
    clearStatus(fileName) {
      safeRemove(this.statusKey(fileName));
    },

    getDraft(fileName) {
      return safeJsonParse(safeGet(this.draftKey(fileName)));
    },
    setDraft(fileName, payload) {
      return safeSet(this.draftKey(fileName), JSON.stringify(payload));
    },
    clearDraft(fileName) {
      safeRemove(this.draftKey(fileName));
    },

    broadcastSaved(fileName) {
      safeSet(this.savedKey(fileName), String(Date.now()));
    }
  };

  window.CcvibesHubStorage = api;
})();

