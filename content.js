(() => {
  if (window.__imageAnalyzerLoaded) return;
  window.__imageAnalyzerLoaded = true;

  let overlay = null;
  let imageBox = null;
  let spinner = null;
  let formattedBox = null;
  let rawBox = null;
  let copyBtn = null;
  let copyStatus = null;
  let tabFormatted = null;
  let tabRaw = null;

  let currentRawJson = "";
  let currentFormatted = "";
  let cssLoaded = false;
  let htmlLoaded = false;

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function copyFallback(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-999999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }

    textarea.remove();
    return ok;
  }

  async function copyRawJson() {
    const text = currentRawJson || "";
    if (!text) return;

    let ok = false;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      } else {
        ok = copyFallback(text);
      }
    } catch {
      ok = copyFallback(text);
    }

    copyStatus.textContent = ok ? "Copied" : "Copy failed";

    setTimeout(() => {
      if (copyStatus) copyStatus.textContent = "";
    }, 1500);
  }

  function activateTab(name) {
    const showFormatted = name === "formatted";

    tabFormatted.classList.toggle("ia-tab-active", showFormatted);
    tabRaw.classList.toggle("ia-tab-active", !showFormatted);

    formattedBox.classList.toggle("ia-hidden", !showFormatted);
    rawBox.classList.toggle("ia-hidden", showFormatted);
  }

  function simpleMarkdownToHtml(text) {
    const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let inOl = false;
    let inUl = false;

    function closeLists() {
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
    }

    function inlineFormat(s) {
      let html = escapeHtml(s);
      html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
      html = html.replace(/`(.+?)`/g, "<code>$1</code>");
      return html;
    }

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        closeLists();
        continue;
      }

      if (trimmed.startsWith("### ")) {
        closeLists();
        out.push(`<h3>${inlineFormat(trimmed.slice(4))}</h3>`);
        continue;
      }

      if (trimmed.startsWith("## ")) {
        closeLists();
        out.push(`<h2>${inlineFormat(trimmed.slice(3))}</h2>`);
        continue;
      }

      if (trimmed.startsWith("# ")) {
        closeLists();
        out.push(`<h1>${inlineFormat(trimmed.slice(2))}</h1>`);
        continue;
      }

      if (/^\d+\.\s+/.test(trimmed)) {
        if (inUl) {
          out.push("</ul>");
          inUl = false;
        }
        if (!inOl) {
          out.push("<ol>");
          inOl = true;
        }
        out.push(`<li>${inlineFormat(trimmed.replace(/^\d+\.\s+/, ""))}</li>`);
        continue;
      }

      if (/^-\s+/.test(trimmed) || /^\*\s+/.test(trimmed)) {
        if (inOl) {
          out.push("</ol>");
          inOl = false;
        }
        if (!inUl) {
          out.push("<ul>");
          inUl = true;
        }
        out.push(`<li>${inlineFormat(trimmed.replace(/^[-*]\s+/, ""))}</li>`);
        continue;
      }

      closeLists();
      out.push(`<p>${inlineFormat(trimmed)}</p>`);
    }

    closeLists();
    return out.join("");
  }

  async function ensureCssLoaded() {
    if (cssLoaded) return;

    const href = chrome.runtime.getURL("content.css");

    if (!document.querySelector(`link[data-image-analyzer-css="${href}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.imageAnalyzerCss = href;
      document.documentElement.appendChild(link);
    }

    cssLoaded = true;
  }

  async function loadHtmlTemplate() {
    const url = chrome.runtime.getURL("content.html");
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load content.html: HTTP ${response.status}`);
    }
    return await response.text();
  }

  function cacheModalNodes(root) {
    imageBox = root.querySelector("#image-analyzer-image-url");
    spinner = root.querySelector("#image-analyzer-spinner");
    formattedBox = root.querySelector("#image-analyzer-formatted");
    rawBox = root.querySelector("#image-analyzer-raw");
    copyBtn = root.querySelector("#ia-copy-btn");
    copyStatus = root.querySelector("#ia-copy-status");
    tabFormatted = root.querySelector("#ia-tab-formatted");
    tabRaw = root.querySelector("#ia-tab-raw");
  }

  function attachModalEvents(root) {
    root.querySelector("#image-analyzer-close").addEventListener("click", () => {
      overlay.remove();
      overlay = null;
    });

    root.addEventListener("click", (e) => {
      if (e.target === root) {
        overlay.remove();
        overlay = null;
      }
    });

    tabFormatted.addEventListener("click", () => activateTab("formatted"));
    tabRaw.addEventListener("click", () => activateTab("raw"));
    copyBtn.addEventListener("click", copyRawJson);
  }

  async function ensureModal() {
    if (overlay) return;

    await ensureCssLoaded();

    const html = await loadHtmlTemplate();
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html.trim();

    overlay = wrapper.firstElementChild;
    if (!overlay) {
      throw new Error("content.html did not produce a root element");
    }

    document.documentElement.appendChild(overlay);

    cacheModalNodes(overlay);
    attachModalEvents(overlay);
    htmlLoaded = true;
  }

  window.__imageAnalyzerShowLoading = async (imageUrl) => {
    await ensureModal();

    currentRawJson = "";
    currentFormatted = "";

    imageBox.textContent = imageUrl || "";
    formattedBox.innerHTML = "";
    rawBox.textContent = "";
    copyStatus.textContent = "";
    spinner.classList.remove("ia-hidden");

    activateTab("formatted");
  };

  window.__imageAnalyzerShowResult = async (imageUrl, formattedText, rawJsonText) => {
    await ensureModal();

    currentRawJson = typeof rawJsonText === "string" ? rawJsonText : "";
    currentFormatted = simpleMarkdownToHtml(formattedText || "No result");

    imageBox.textContent = imageUrl || "";
    spinner.classList.add("ia-hidden");
    formattedBox.innerHTML = currentFormatted;
    rawBox.textContent = currentRawJson || "No raw JSON available";
    copyStatus.textContent = "";

    activateTab("formatted");
  };
})();