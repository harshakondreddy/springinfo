(() => {
  const EXT_ROOT_CLASS = "eureka-inline-ext";
  const PANEL_CLASS = "eureka-inline-info-slot";
  const SUMMARY_ID = "eureka-inline-summary";
  const SETTINGS_KEY = "eurekaInlineSettings";
  let hasDropdownViewportListener = false;
  let hasOutsideClickCloseListener = false;
  const dropdownCloseTimers = new WeakMap();

  const DEFAULT_SETTINGS = {
    requestTimeoutMs: 8000,
    infoAutoCloseMs: 1000,
    fallbackMode: "none",
    hideAmis: false,
    hideZones: false,
    hideOtherTables: false,
    enableDiagnostics: false
  };

  const MAX_PARALLEL_ROWS = 4;
  const MAX_ENDPOINTS_PER_ROW = 5;

  function safeParseJson(text) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function shorten(value, maxLen) {
    const str = String(value || "").trim();
    if (!str) return "N/A";
    return str.length <= maxLen ? str : `${str.slice(0, maxLen - 3)}...`;
  }

  function normalizeErrorText(text) {
    if (!text) return "";
    return String(text)
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildHttpError(status, rawText, contentType) {
    const ct = String(contentType || "").toLowerCase();
    const cleaned = normalizeErrorText(rawText);
    if (ct.includes("text/html")) {
      return `HTTP ${status} (HTML response)`;
    }
    if (!cleaned) {
      return `HTTP ${status}`;
    }
    return `HTTP ${status}: ${shorten(cleaned, 140)}`;
  }

  function buildNonJsonError(rawText, contentType) {
    const ct = String(contentType || "").toLowerCase();
    const cleaned = normalizeErrorText(rawText);
    if (ct.includes("text/html")) {
      return "Non-JSON response (HTML)";
    }
    return cleaned ? `Non-JSON response: ${shorten(cleaned, 140)}` : "Non-JSON response";
  }

  function normalizeSettings(raw) {
    const fallback = raw && typeof raw.fallbackMode === "string" ? raw.fallbackMode : "none";
    return {
      requestTimeoutMs: Math.max(
        2000,
        Number((raw && raw.requestTimeoutMs) || DEFAULT_SETTINGS.requestTimeoutMs) || DEFAULT_SETTINGS.requestTimeoutMs
      ),
      infoAutoCloseMs: Math.max(
        250,
        Number((raw && raw.infoAutoCloseMs) || DEFAULT_SETTINGS.infoAutoCloseMs) || DEFAULT_SETTINGS.infoAutoCloseMs
      ),
      fallbackMode: fallback === "https-upgrade" || fallback === "skip-insecure" ? fallback : "none",
      hideAmis: Boolean(raw && raw.hideAmis),
      hideZones: Boolean(raw && raw.hideZones),
      hideOtherTables: Boolean(raw && raw.hideOtherTables),
      enableDiagnostics: Boolean(raw && raw.enableDiagnostics)
    };
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}

    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "true");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }

  function buildDiagnosticsPayload(settings, summary, errors) {
    const sanitizeUrl = (value) => {
      try {
        const u = new URL(value, window.location.origin);
        return `${u.origin}${u.pathname}`;
      } catch {
        return "";
      }
    };

    return {
      generatedAt: new Date().toISOString(),
      page: sanitizeUrl(window.location.href),
      origin: window.location.origin,
      settings: {
        requestTimeoutMs: settings.requestTimeoutMs,
        infoAutoCloseMs: settings.infoAutoCloseMs,
        fallbackMode: settings.fallbackMode,
        hideAmis: settings.hideAmis,
        hideZones: settings.hideZones,
        hideOtherTables: settings.hideOtherTables
      },
      summary,
      errorSamples: (errors || []).map((item) => ({
        instance: item.instance || "unknown",
        sourceUrl: sanitizeUrl(item.sourceUrl || ""),
        error: item.error || ""
      }))
    };
  }

  function updateStoredSettings(patch) {
    if (!chrome.storage || !chrome.storage.sync) {
      return;
    }
    chrome.storage.sync.get(SETTINGS_KEY, (result) => {
      const current = normalizeSettings((result && result[SETTINGS_KEY]) || DEFAULT_SETTINGS);
      const next = { ...current, ...patch };
      chrome.storage.sync.set({ [SETTINGS_KEY]: next });
    });
  }

  function getStoredSettings() {
    return new Promise((resolve) => {
      if (!chrome.storage || !chrome.storage.sync) {
        resolve(DEFAULT_SETTINGS);
        return;
      }
      chrome.storage.sync.get(SETTINGS_KEY, (result) => {
        resolve(normalizeSettings((result && result[SETTINGS_KEY]) || DEFAULT_SETTINGS));
      });
    });
  }

  function extractInstanceToken(instanceLabel) {
    const value = (instanceLabel || "").trim();
    const parts = value.split("-");
    if (parts.length > 1) return parts[parts.length - 1];
    if (/^[a-f0-9]{16,}$/i.test(value) || /^[a-f0-9-]{32,}$/i.test(value)) return value;
    return "";
  }

  function buildInfoCandidates(baseHref, instanceLabel, fallbackMode) {
    try {
      const raw = new URL(baseHref, window.location.origin);
      const token = extractInstanceToken(instanceLabel);
      if (!token) return [];

      raw.searchParams.set("instance", token);
      const pageIsHttps = window.location.protocol === "https:";
      const targetIsHttp = raw.protocol === "http:";

      if (pageIsHttps && targetIsHttp) {
        if (fallbackMode === "skip-insecure") {
          return [];
        }
        const upgraded = new URL(raw.toString());
        upgraded.protocol = "https:";
        return [upgraded.toString()];
      }

      return [raw.toString()];
    } catch {
      return [];
    }
  }

  function getRegistryTable() {
    const tables = Array.from(document.querySelectorAll("table"));
    return (
      tables.find((tbl) => {
        const headers = Array.from(tbl.querySelectorAll("th")).map((th) => (th.textContent || "").trim().toLowerCase());
        return headers.includes("application") && headers.includes("status");
      }) || null
    );
  }

  function getRegistryRows(table) {
    return Array.from(table.querySelectorAll("tbody tr")).filter((tr) => tr.querySelectorAll("td").length >= 4);
  }

  function getStatusCell(row) {
    const cells = row.querySelectorAll("td");
    return cells.length >= 4 ? cells[3] : null;
  }

  function getStatusLinks(row) {
    const cell = getStatusCell(row);
    if (!cell) return [];
    const links = Array.from(cell.querySelectorAll("a")).filter((a) => a.parentElement === cell);
    return links.filter((a) => !a.closest(`.${PANEL_CLASS}`));
  }

  function shouldHandleLink(linkEl) {
    const href = (linkEl.getAttribute("href") || "").toLowerCase();
    return href.includes("/actuator/info") || href.endsWith("/info") || href.includes("/info?");
  }

  function dedupeLinks(links) {
    return links.filter((link, idx, arr) => {
      const key = `${(link.textContent || "").trim()}|${link.getAttribute("href") || ""}`;
      return (
        arr.findIndex((candidate) => {
          const cKey = `${(candidate.textContent || "").trim()}|${candidate.getAttribute("href") || ""}`;
          return cKey === key;
        }) === idx
      );
    });
  }

  function deriveSwaggerUrlFromInfoHref(infoHref) {
    try {
      const url = new URL(infoHref, window.location.origin);
      const cleanPath = url.pathname.replace(/\/+$/, "");

      if (cleanPath.endsWith("/actuator/info")) {
        url.pathname = `${cleanPath.replace(/\/actuator\/info$/, "")}/swagger-ui/index.html`;
        url.search = "";
        return url.toString();
      }

      if (cleanPath.endsWith("/info")) {
        url.pathname = `${cleanPath.replace(/\/info$/, "")}/swagger-ui/index.html`;
        url.search = "";
        return url.toString();
      }

      if (cleanPath.includes("/actuator/info")) {
        url.pathname = `${cleanPath.replace("/actuator/info", "")}/swagger-ui/index.html`;
        url.search = "";
        return url.toString();
      }

      if (cleanPath && cleanPath !== "/") {
        url.pathname = `${cleanPath}/swagger-ui/index.html`;
      } else {
        url.pathname = "/swagger-ui/index.html";
      }
      url.search = "";
      return url.toString();
    } catch {
      return "";
    }
  }

  function createSwaggerLink(swaggerUrl) {
    const anchor = document.createElement("a");
    anchor.className = "eureka-swagger-link";
    anchor.href = swaggerUrl;
    anchor.target = "_blank";
    anchor.rel = "noreferrer noopener";
    anchor.textContent = "swagger";
    return anchor;
  }

  function positionInfoDropdown(details) {
    if (!details) return;
    details.classList.remove("eureka-info-dropdown-right");
    if (!details.open) return;

    const body = details.querySelector(".eureka-info-body");
    if (!body) return;

    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const rect = body.getBoundingClientRect();
    if (rect.right > viewportWidth - 8) {
      details.classList.add("eureka-info-dropdown-right");
    }
  }

  function ensureDropdownViewportListener() {
    if (hasDropdownViewportListener) return;
    hasDropdownViewportListener = true;
    window.addEventListener("resize", () => {
      const openDropdowns = document.querySelectorAll(".eureka-info-dropdown[open]");
      openDropdowns.forEach((dropdown) => positionInfoDropdown(dropdown));
    });
  }

  function closeOpenInfoDropdowns(exceptDetails = null) {
    const openDropdowns = document.querySelectorAll(".eureka-info-dropdown[open]");
    openDropdowns.forEach((dropdown) => {
      if (dropdown !== exceptDetails) {
        dropdown.removeAttribute("open");
      }
    });
  }

  function ensureOutsideClickCloseListener() {
    if (hasOutsideClickCloseListener) return;
    hasOutsideClickCloseListener = true;

    document.addEventListener(
      "pointerdown",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest(".eureka-info-dropdown")) return;
        closeOpenInfoDropdowns();
      },
      true
    );
  }

  function cancelDropdownClose(details) {
    const timerId = dropdownCloseTimers.get(details);
    if (timerId) {
      window.clearTimeout(timerId);
      dropdownCloseTimers.delete(details);
    }
  }

  function isInteractingWithDropdown(details) {
    if (!details || !details.open) return false;
    if (details.matches(":hover")) return true;

    const activeEl = document.activeElement;
    if (activeEl && details.contains(activeEl)) return true;

    const selection = window.getSelection ? window.getSelection() : null;
    if (selection && !selection.isCollapsed) {
      const anchorInside = selection.anchorNode && details.contains(selection.anchorNode);
      const focusInside = selection.focusNode && details.contains(selection.focusNode);
      if (anchorInside || focusInside) return true;
    }

    return false;
  }

  function scheduleDropdownClose(details, delayMs) {
    cancelDropdownClose(details);
    const timerId = window.setTimeout(() => {
      if (isInteractingWithDropdown(details)) {
        scheduleDropdownClose(details, delayMs);
        return;
      }
      details.removeAttribute("open");
      dropdownCloseTimers.delete(details);
    }, delayMs);
    dropdownCloseTimers.set(details, timerId);
  }

  async function fetchInstanceInfo(linkEl, settings) {
    const instanceName = (linkEl.textContent || "").trim();
    const href = linkEl.getAttribute("href") || linkEl.href || "";
    const candidates = buildInfoCandidates(href, instanceName, settings.fallbackMode);
    const sourceUrl = candidates[0] || href || window.location.href;

    if (!candidates.length) {
      return { instanceName, sourceUrl, error: "No compatible endpoint" };
    }

    let lastError = "Endpoint not reachable";

    for (const url of candidates) {
      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), settings.requestTimeoutMs);
        const response = await fetch(url, { credentials: "include", signal: controller.signal });
        window.clearTimeout(timeoutId);

        const text = await response.text();
        const contentType = response.headers.get("content-type") || "";
        const json = safeParseJson(text);

        if (!response.ok) {
          lastError = buildHttpError(response.status, text, contentType);
          continue;
        }

        if (!json) {
          lastError = buildNonJsonError(text, contentType);
          continue;
        }

        return { instanceName, sourceUrl: url, payload: json };
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return { instanceName, sourceUrl: url, error: `Timeout (${settings.requestTimeoutMs}ms)` };
        }
        lastError = "Endpoint not reachable";
      }
    }

    return { instanceName, sourceUrl, error: lastError };
  }

  function ensureInlineSlot(row) {
    const statusCell = getStatusCell(row);
    if (!statusCell) return null;

    let slot = statusCell.querySelector(`.${PANEL_CLASS}`);
    if (!slot) {
      slot = document.createElement("span");
      slot.className = PANEL_CLASS;
      const firstLink = Array.from(statusCell.querySelectorAll("a")).find((a) => a.parentElement === statusCell);
      if (firstLink) {
        statusCell.insertBefore(slot, firstLink);
      } else {
        statusCell.append(slot);
      }
    }

    slot.textContent = "";
    return slot;
  }

  function createInfoDropdown(results, settings) {
    const details = document.createElement("details");
    details.className = "eureka-info-dropdown";
    ensureDropdownViewportListener();
    ensureOutsideClickCloseListener();
    const closeDelayMs = Math.max(250, Number(settings && settings.infoAutoCloseMs) || DEFAULT_SETTINGS.infoAutoCloseMs);

    details.addEventListener("pointerenter", () => {
      cancelDropdownClose(details);
    });

    details.addEventListener("pointerleave", () => {
      if (details.open) {
        scheduleDropdownClose(details, closeDelayMs);
      }
    });

    details.addEventListener("focusin", () => {
      cancelDropdownClose(details);
    });

    details.addEventListener("focusout", (event) => {
      const nextTarget = event.relatedTarget;
      if (details.open && (!nextTarget || !details.contains(nextTarget))) {
        scheduleDropdownClose(details, closeDelayMs);
      }
    });

    details.addEventListener("toggle", () => {
      if (details.open) {
        closeOpenInfoDropdowns(details);
        positionInfoDropdown(details);
      } else {
        cancelDropdownClose(details);
      }
    });

    const summary = document.createElement("summary");
    summary.className = "eureka-info-summary";

    const infoChip = document.createElement("span");
    infoChip.className = "eureka-chip eureka-chip-info";
    infoChip.textContent = "info";

    const countChip = document.createElement("span");
    countChip.className = "eureka-chip";
    countChip.textContent = String(results.length);

    summary.append(infoChip, countChip);
    details.append(summary);

    const body = document.createElement("div");
    body.className = "eureka-info-body";

    results.forEach((result, index) => {
      const section = document.createElement("div");
      section.className = "eureka-info-section";

      const header = document.createElement("div");
      header.className = "eureka-info-section-header";

      const title = document.createElement("div");
      title.className = "eureka-info-section-title";
      title.textContent = `Instance ${index + 1}`;

      const endpoint = document.createElement("a");
      endpoint.className = "eureka-source-link";
      endpoint.href = result.sourceUrl || "#";
      endpoint.target = "_blank";
      endpoint.rel = "noreferrer noopener";
      endpoint.textContent = "open endpoint";

      header.append(title, endpoint);
      section.append(header);

      if (result.error) {
        const err = document.createElement("div");
        err.className = "eureka-error";
        err.textContent = result.error;
        section.append(err);
      } else {
        const pre = document.createElement("pre");
        pre.className = "eureka-json-pre";
        pre.textContent = JSON.stringify(result.payload, null, 2);
        section.append(pre);
      }

      body.append(section);
    });

    details.append(body);
    return details;
  }

  function setColumnHidden(table, index, hidden) {
    const rows = table.querySelectorAll("tr");
    rows.forEach((tr) => {
      const cells = tr.querySelectorAll("th, td");
      if (cells[index]) {
        cells[index].style.display = hidden ? "none" : "";
      }
    });
  }

  function toggleOtherSections(registryTable, hidden) {
    const tables = Array.from(document.querySelectorAll("table"));
    tables.forEach((tbl) => {
      if (tbl === registryTable) return;
      tbl.style.display = hidden ? "none" : "";
    });

    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4"));
    headings.forEach((h) => {
      const text = (h.textContent || "").toLowerCase();
      if (text.includes("instances currently registered with eureka")) return;
      h.style.display = hidden ? "none" : "";
    });

    const lists = Array.from(document.querySelectorAll("ul"));
    lists.forEach((ul) => {
      if (registryTable.contains(ul)) return;
      ul.style.display = hidden ? "none" : "";
    });
  }

  function makeToggleButton(onText, offText, initialActive, onToggle) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "eureka-toggle-btn";
    let active = Boolean(initialActive);

    const render = () => {
      btn.textContent = active ? offText : onText;
      btn.dataset.active = active ? "1" : "0";
    };

    render();
    btn.addEventListener("click", () => {
      active = !active;
      render();
      onToggle(active);
    });

    btn.setActiveState = (nextActive, shouldTrigger = false) => {
      active = Boolean(nextActive);
      render();
      if (shouldTrigger) {
        onToggle(active);
      }
    };

    return btn;
  }

  function renderSummary(table, summary, settings, errorSamples) {
    let bar = document.getElementById(SUMMARY_ID);
    if (!bar) {
      bar = document.createElement("div");
      bar.id = SUMMARY_ID;
      bar.className = "eureka-summary-bar";
      table.parentNode.insertBefore(bar, table);
    }

    bar.textContent = "";

    const chips = [
      { label: "Extension", value: "active" },
      { label: "Rows", value: summary.rows },
      { label: "Instances", value: summary.instances },
      { label: "OK", value: summary.ok, tone: "good" },
      { label: "Issues", value: summary.issues, tone: "bad" },
      { label: "Skipped", value: summary.skipped }
    ];

    chips.forEach((chip) => {
      const el = document.createElement("span");
      el.className = `eureka-summary-chip${chip.tone ? ` eureka-summary-chip-${chip.tone}` : ""}`;
      el.textContent = `${chip.label}: ${chip.value}`;
      bar.append(el);
    });

    setColumnHidden(table, 1, settings.hideAmis);
    setColumnHidden(table, 2, settings.hideZones);
    toggleOtherSections(table, settings.hideOtherTables);

    const controls = document.createElement("span");
    controls.className = "eureka-summary-controls";
    const amisToggle = makeToggleButton("Hide AMIs", "Show AMIs", settings.hideAmis, (active) => {
        setColumnHidden(table, 1, active);
        updateStoredSettings({ hideAmis: active });
      });
    const zonesToggle = makeToggleButton("Hide Zones", "Show Zones", settings.hideZones, (active) => {
        setColumnHidden(table, 2, active);
        updateStoredSettings({ hideZones: active });
      });
    const otherTablesToggle = makeToggleButton("Hide Other Tables", "Show Other Tables", settings.hideOtherTables, (active) => {
        toggleOtherSections(table, active);
        updateStoredSettings({ hideOtherTables: active });
      });

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "eureka-toggle-btn eureka-reset-btn";
    resetBtn.textContent = "Reset View";
    resetBtn.addEventListener("click", () => {
      amisToggle.setActiveState(false, true);
      zonesToggle.setActiveState(false, true);
      otherTablesToggle.setActiveState(false, true);
      updateStoredSettings({ hideAmis: false, hideZones: false, hideOtherTables: false });
    });

    const controlsToAppend = [amisToggle, zonesToggle, otherTablesToggle, resetBtn];

    if (settings.enableDiagnostics) {
      const debugBtn = document.createElement("button");
      debugBtn.type = "button";
      debugBtn.className = "eureka-toggle-btn";
      debugBtn.textContent = "Copy Debug";
      debugBtn.addEventListener("click", async () => {
        const payload = buildDiagnosticsPayload(settings, summary, errorSamples || []);
        const copied = await copyToClipboard(JSON.stringify(payload, null, 2));
        const original = debugBtn.textContent;
        debugBtn.textContent = copied ? "Copied" : "Copy Failed";
        window.setTimeout(() => {
          debugBtn.textContent = original;
        }, 1200);
      });
      controlsToAppend.push(debugBtn);
    }

    controls.append(...controlsToAppend);
    bar.append(controls);
  }

  async function runOnce(settings) {
    if (!window.location.pathname.includes("registry")) return;

    const table = getRegistryTable();
    if (!table) return;

    document.body.classList.add(EXT_ROOT_CLASS);

    const rows = getRegistryRows(table);
    const summary = { rows: rows.length, instances: 0, ok: 0, issues: 0, skipped: 0 };
    const errorSamples = [];

    for (let i = 0; i < rows.length; i += MAX_PARALLEL_ROWS) {
      const batch = rows.slice(i, i + MAX_PARALLEL_ROWS);
      await Promise.all(
        batch.map(async (row) => {
          try {
            const slot = ensureInlineSlot(row);
            if (!slot) return;

            const links = dedupeLinks(getStatusLinks(row).filter(shouldHandleLink)).slice(0, MAX_ENDPOINTS_PER_ROW);
            if (!links.length) {
              summary.skipped += 1;
              return;
            }

            const swaggerUrl = deriveSwaggerUrlFromInfoHref((links[0].getAttribute("href") || links[0].href || ""));
            if (swaggerUrl) {
              slot.append(createSwaggerLink(swaggerUrl));

              const sep = document.createElement("span");
              sep.className = "eureka-inline-sep";
              sep.textContent = "|";
              slot.append(sep);
            }

            const results = await Promise.all(links.map((link) => fetchInstanceInfo(link, settings)));
            summary.instances += results.length;
            results.forEach((r) => {
              if (r.error) {
                summary.issues += 1;
                if (errorSamples.length < 20) {
                  errorSamples.push({
                    instance: r.instanceName || "unknown",
                    sourceUrl: r.sourceUrl || "",
                    error: r.error
                  });
                }
              } else {
                summary.ok += 1;
              }
            });

            slot.append(createInfoDropdown(results, settings));
          } catch {
            summary.issues += 1;
            if (errorSamples.length < 20) {
              errorSamples.push({
                instance: "unknown",
                sourceUrl: window.location.href,
                error: "Row processing failure"
              });
            }
          }
        })
      );
    }

    renderSummary(table, summary, settings, errorSamples);
  }

  getStoredSettings().then((settings) => {
    runOnce(settings).catch(() => {});
  });
})();
