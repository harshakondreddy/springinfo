(() => {
  const SETTINGS_KEY = "eurekaInlineSettings";
  const DEFAULTS = {
    requestTimeoutMs: 8000,
    infoAutoCloseMs: 1000,
    fallbackMode: "none",
    hideAmis: false,
    hideZones: false,
    hideOtherTables: false,
    enableDiagnostics: false
  };

  function q(id) {
    return document.getElementById(id);
  }

  function normalize(raw) {
    const fallback = raw && typeof raw.fallbackMode === "string" ? raw.fallbackMode : "none";
    return {
      requestTimeoutMs: Math.max(2000, Number((raw && raw.requestTimeoutMs) || DEFAULTS.requestTimeoutMs) || DEFAULTS.requestTimeoutMs),
      infoAutoCloseMs: Math.max(250, Number((raw && raw.infoAutoCloseMs) || DEFAULTS.infoAutoCloseMs) || DEFAULTS.infoAutoCloseMs),
      fallbackMode: fallback === "https-upgrade" || fallback === "skip-insecure" ? fallback : "none",
      hideAmis: Boolean(raw && raw.hideAmis),
      hideZones: Boolean(raw && raw.hideZones),
      hideOtherTables: Boolean(raw && raw.hideOtherTables),
      enableDiagnostics: Boolean(raw && raw.enableDiagnostics)
    };
  }

  function readForm() {
    return normalize({
      requestTimeoutMs: q("requestTimeoutMs").value,
      infoAutoCloseMs: q("infoAutoCloseMs").value,
      fallbackMode: q("fallbackMode").value,
      hideAmis: q("hideAmis").checked,
      hideZones: q("hideZones").checked,
      hideOtherTables: q("hideOtherTables").checked,
      enableDiagnostics: q("enableDiagnostics").checked
    });
  }

  function writeForm(settings) {
    q("requestTimeoutMs").value = String(settings.requestTimeoutMs);
    q("infoAutoCloseMs").value = String(settings.infoAutoCloseMs);
    q("fallbackMode").value = settings.fallbackMode;
    q("hideAmis").checked = settings.hideAmis;
    q("hideZones").checked = settings.hideZones;
    q("hideOtherTables").checked = settings.hideOtherTables;
    q("enableDiagnostics").checked = settings.enableDiagnostics;
  }

  function setStatus(text) {
    q("status").textContent = text;
    setTimeout(() => {
      if (q("status").textContent === text) {
        q("status").textContent = "";
      }
    }, 2000);
  }

  function load() {
    chrome.storage.sync.get(SETTINGS_KEY, (result) => {
      const settings = normalize((result && result[SETTINGS_KEY]) || DEFAULTS);
      writeForm(settings);
    });
  }

  function save() {
    const settings = readForm();
    chrome.storage.sync.set({ [SETTINGS_KEY]: settings }, () => {
      setStatus("Saved");
    });
  }

  function reset() {
    writeForm(DEFAULTS);
    chrome.storage.sync.set({ [SETTINGS_KEY]: DEFAULTS }, () => {
      setStatus("Defaults restored");
    });
  }

  q("saveBtn").addEventListener("click", save);
  q("resetBtn").addEventListener("click", reset);
  load();
})();
