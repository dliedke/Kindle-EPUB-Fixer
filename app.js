(() => {
  "use strict";

  const APP_NAME = "Kindle EPUB Fixer";
  const APP_VERSION = "1.1.0";
  const i18n = window.EpubFixerI18n;
  const SITE_ORIGIN = "https://kindle-epub-fixer.web.app";
  let urlLanguageParamActive = false;

  function t(key, variables = {}) {
    return i18n?.t(key, variables) || key;
  }
  const XMLNS_OPF = "http://www.idpf.org/2007/opf";
  const XMLNS_DC = "http://purl.org/dc/elements/1.1/";
  const XMLNS_XHTML = "http://www.w3.org/1999/xhtml";
  const XMLNS_NCX = "http://www.daisy.org/z3986/2005/ncx/";
  const FONT_OBFUSCATION_ALGORITHMS = new Set([
    "http://www.idpf.org/2008/embedding",
    "http://ns.adobe.com/pdf/enc#RC"
  ]);

  const MEDIA_TYPES = Object.freeze({
    ".xhtml": "application/xhtml+xml",
    ".html": "application/xhtml+xml",
    ".htm": "application/xhtml+xml",
    ".xml": "application/xml",
    ".opf": "application/oebps-package+xml",
    ".ncx": "application/x-dtbncx+xml",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".bmp": "image/bmp",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".mp4": "video/mp4",
    ".smil": "application/smil+xml",
    ".js": "text/javascript",
    ".json": "application/json",
    ".txt": "text/plain"
  });

  const TEXT_EXTENSIONS = new Set([
    ".xhtml", ".html", ".htm", ".xml", ".opf", ".ncx", ".css", ".svg", ".js", ".json", ".txt"
  ]);

  const MANIFEST_EXTENSIONS = new Set([
    ".xhtml", ".html", ".htm", ".css", ".svg", ".jpg", ".jpeg", ".png", ".gif",
    ".webp", ".avif", ".woff", ".woff2", ".ttf", ".otf", ".mp3", ".m4a", ".mp4", ".smil", ".js"
  ]);

  const JUNK_PATTERNS = [
    /(^|\/)__MACOSX(\/|$)/i,
    /(^|\/)\.DS_Store$/i,
    /(^|\/)Thumbs\.db$/i,
    /(^|\/)desktop\.ini$/i,
    /(^|\/)\.Spotlight-V100(\/|$)/i,
    /(^|\/)\.Trashes(\/|$)/i,
    /(^|\/)\._[^/]+$/,
    /(^|\/)~\$[^/]+$/,
    /(^|\/)\.git(\/|$)/i,
    /(^|\/)\.svn(\/|$)/i
  ];

  const dom = {
    languageSelect: document.getElementById("languageSelect"),
    dropZone: document.getElementById("dropZone"),
    fileInput: document.getElementById("fileInput"),
    selectedFile: document.getElementById("selectedFile"),
    fileName: document.getElementById("fileName"),
    fileSize: document.getElementById("fileSize"),
    removeFileButton: document.getElementById("removeFileButton"),
    recommendedButton: document.getElementById("recommendedButton"),
    idleState: document.getElementById("idleState"),
    progressState: document.getElementById("progressState"),
    resultState: document.getElementById("resultState"),
    progressLabel: document.getElementById("progressLabel"),
    progressPercent: document.getElementById("progressPercent"),
    progressBar: document.getElementById("progressBar"),
    progressDetail: document.getElementById("progressDetail"),
    repairButton: document.getElementById("repairButton"),
    previewButton: document.getElementById("previewButton"),
    previewOverlay: document.getElementById("previewOverlay"),
    previewClose: document.getElementById("previewClose"),
    previewFrame: document.getElementById("previewFrame"),
    previewPrev: document.getElementById("previewPrev"),
    previewNext: document.getElementById("previewNext"),
    previewPageLabel: document.getElementById("previewPageLabel"),
    downloadButton: document.getElementById("downloadButton"),
    sendToKindleLink: document.getElementById("sendToKindleLink"),
    supportLink: document.getElementById("supportLink"),
    filenameField: document.getElementById("filenameField"),
    outputFilenameInput: document.getElementById("outputFilenameInput"),
    downloadReportButton: document.getElementById("downloadReportButton"),
    reportDetails: document.getElementById("reportDetails"),
    reportList: document.getElementById("reportList"),
    errorCount: document.getElementById("errorCount"),
    warningCount: document.getElementById("warningCount"),
    fixedCount: document.getElementById("fixedCount"),
    fileCount: document.getElementById("fileCount"),
    resultBanner: document.getElementById("resultBanner"),
    resultTitle: document.getElementById("resultTitle"),
    resultText: document.getElementById("resultText"),
    scoreCard: document.getElementById("scoreCard"),
    scoreValue: document.getElementById("scoreValue"),
    scoreTier: document.getElementById("scoreTier")
  };

  const optionIds = [
    "reduceMargins", "miniMargins", "normalizePaths", "removeJunk", "repairPackage", "repairNavigation", "repairText",
    "repairCover", "addUnlisted", "removeMissing", "stripScripts"
  ];

  const state = {
    inputFile: null,
    outputBlob: null,
    outputName: "",
    report: [],
    reportFilter: "all",
    reportDocument: null,
    processing: false,
    lastResult: null
  };

  const STORAGE_KEYS = { options: "kef.options", lang: "kef.lang" };

  function safeStorageGet(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  function safeStorageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch { /* indisponível (file://, modo anônimo) */ }
  }

  function persistOptions() {
    safeStorageSet(STORAGE_KEYS.options, JSON.stringify(readOptions()));
  }

  function applyStoredOptions() {
    const raw = safeStorageGet(STORAGE_KEYS.options);
    if (!raw) return;
    let saved;
    try { saved = JSON.parse(raw); } catch { return; }
    for (const id of optionIds) {
      const element = document.getElementById(id);
      if (element && typeof saved[id] === "boolean" && !element.disabled) element.checked = saved[id];
    }
    const miniMarginsInput = document.getElementById("miniMargins");
    const reduceMarginsInput = document.getElementById("reduceMargins");
    if (miniMarginsInput?.checked && reduceMarginsInput) reduceMarginsInput.checked = false;
  }

  function applyStoredLanguage() {
    const stored = safeStorageGet(STORAGE_KEYS.lang);
    if (!stored) return;
    const supported = i18n?.getLanguages?.().some((language) => language.code === stored);
    if (!supported) return;
    i18n?.setLanguage(stored);
  }

  function initialize() {
    i18n?.initialize();
    if (!applyLanguageFromUrl()) applyStoredLanguage();
    if (dom.languageSelect) {
      populateLanguageOptions();
      dom.languageSelect.value = i18n?.getLanguage() || "en";
      dom.languageSelect.addEventListener("change", () => {
        i18n?.setLanguage(dom.languageSelect.value);
        urlLanguageParamActive = true;
        updateUrlLanguageParam(dom.languageSelect.value);
        safeStorageSet(STORAGE_KEYS.lang, dom.languageSelect.value);
      });
    }
    window.addEventListener("epubfixer:languagechange", refreshLocalizedInterface);
    updateSeoMeta();

    if (typeof JSZip === "undefined") {
      setFatalInterfaceError(t("runtime.jszipMissing"));
      return;
    }

    dom.dropZone.addEventListener("click", () => dom.fileInput.click());
    dom.dropZone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        dom.fileInput.click();
      }
    });
    dom.fileInput.addEventListener("change", () => selectFile(dom.fileInput.files?.[0] ?? null));
    dom.removeFileButton.addEventListener("click", clearSelectedFile);
    dom.recommendedButton.addEventListener("click", useRecommendedOptions);
    dom.repairButton.addEventListener("click", repairSelectedFile);
    if (dom.previewButton) dom.previewButton.addEventListener("click", openPreview);
    if (dom.previewClose) dom.previewClose.addEventListener("click", closePreview);
    if (dom.previewOverlay) {
      dom.previewOverlay.addEventListener("click", (event) => {
        if (event.target === dom.previewOverlay) closePreview();
      });
    }
    if (dom.previewPrev) dom.previewPrev.addEventListener("click", () => showPreviewChapter(previewState.index - 1));
    if (dom.previewNext) dom.previewNext.addEventListener("click", () => showPreviewChapter(previewState.index + 1));
    document.addEventListener("keydown", (event) => {
      if (!dom.previewOverlay || dom.previewOverlay.classList.contains("hidden")) return;
      if (event.key === "Escape") closePreview();
      else if (event.key === "ArrowLeft") showPreviewChapter(previewState.index - 1);
      else if (event.key === "ArrowRight") showPreviewChapter(previewState.index + 1);
    });
    document.querySelectorAll(".preview-mode").forEach((button) => {
      button.addEventListener("click", () => setPreviewMode(button.dataset.mode || "original"));
    });
    dom.downloadButton.addEventListener("click", downloadOutput);
    dom.downloadReportButton.addEventListener("click", downloadReport);

    for (const eventName of ["dragenter", "dragover"]) {
      dom.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dom.dropZone.classList.add("dragging");
      });
    }
    for (const eventName of ["dragleave", "drop"]) {
      dom.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dom.dropZone.classList.remove("dragging");
      });
    }
    dom.dropZone.addEventListener("drop", (event) => selectFile(event.dataTransfer?.files?.[0] ?? null));

    document.querySelectorAll(".filter-button").forEach((button) => {
      button.addEventListener("click", () => {
        state.reportFilter = button.dataset.filter || "all";
        document.querySelectorAll(".filter-button").forEach((item) => item.classList.toggle("active", item === button));
        renderReport();
      });
    });

    bindExclusiveMarginOptions();

    applyStoredOptions();
    for (const id of optionIds) {
      document.getElementById(id)?.addEventListener("change", persistOptions);
    }
  }

  // Só troca o idioma via URL quando ?lang= vier explícito e for suportado;
  // sem o parâmetro, mantém a detecção automática do navegador feita por i18n.initialize().
  function applyLanguageFromUrl() {
    const requested = new URLSearchParams(window.location.search).get("lang");
    if (!requested) return false;
    const supported = i18n?.getLanguages?.().some((language) => language.code === requested);
    if (!supported) return false;
    urlLanguageParamActive = true;
    i18n?.setLanguage(requested);
    return true;
  }

  function updateUrlLanguageParam(code) {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", code);
    window.history.replaceState({}, "", url);
  }

  function setMetaAttribute(selector, attribute, value) {
    const element = document.querySelector(selector);
    if (element) element.setAttribute(attribute, value);
  }

  function updateSeoMeta() {
    const code = i18n?.getLanguage() || "en";
    const description = t("hero.copy");
    const title = t("document.title");
    const locale = (i18n?.getLocale?.() || "en-US").replace("-", "_");
    const canonicalUrl = urlLanguageParamActive ? `${SITE_ORIGIN}/?lang=${code}` : `${SITE_ORIGIN}/`;

    setMetaAttribute('meta[name="description"]', "content", description);
    setMetaAttribute('link[rel="canonical"]', "href", canonicalUrl);
    setMetaAttribute('meta[property="og:title"]', "content", title);
    setMetaAttribute('meta[property="og:description"]', "content", description);
    setMetaAttribute('meta[property="og:url"]', "content", canonicalUrl);
    setMetaAttribute('meta[property="og:locale"]', "content", locale);
    setMetaAttribute('meta[name="twitter:title"]', "content", title);
    setMetaAttribute('meta[name="twitter:description"]', "content", description);
  }

  function populateLanguageOptions() {
    const languages = i18n?.getLanguages?.();
    if (!dom.languageSelect || !Array.isArray(languages) || !languages.length) return;
    dom.languageSelect.replaceChildren();
    for (const { code, native, english } of languages) {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = english && english !== native ? `${native} (${english})` : native;
      dom.languageSelect.appendChild(option);
    }
  }

  function bindExclusiveMarginOptions() {
    const reduceMarginsInput = document.getElementById("reduceMargins");
    const miniMarginsInput = document.getElementById("miniMargins");
    if (!reduceMarginsInput || !miniMarginsInput) return;
    reduceMarginsInput.addEventListener("change", () => {
      if (reduceMarginsInput.checked) miniMarginsInput.checked = false;
    });
    miniMarginsInput.addEventListener("change", () => {
      if (miniMarginsInput.checked) reduceMarginsInput.checked = false;
    });
  }

  function setFatalInterfaceError(message) {
    dom.idleState.innerHTML = `<div class="state-icon" aria-hidden="true">!</div><h3>${escapeHtml(t("runtime.startFailed"))}</h3><p>${escapeHtml(message)}</p>`;
  }

  function refreshLocalizedInterface() {
    updateSeoMeta();
    if (dom.languageSelect) dom.languageSelect.value = i18n?.getLanguage() || "en";
    if (state.inputFile) dom.fileSize.textContent = formatBytes(state.inputFile.size);
    if (state.outputBlob && state.inputFile) {
      state.outputName = buildOutputName(state.inputFile.name);
      const outputIssue = state.report.find((issue) => issue.code === "OUTPUT_READY");
      if (outputIssue) outputIssue.file = state.outputName;
    }
    if (state.lastResult && !dom.resultState.classList.contains("hidden")) {
      showResults(state.lastResult.fileCount, state.lastResult.hasOutput);
    } else {
      renderReport();
    }
  }

  function selectFile(file) {
    if (!file) return;
    const validExtension = file.name.toLowerCase().endsWith(".epub");
    if (!validExtension) {
      window.alert(t("runtime.chooseEpub"));
      return;
    }

    state.inputFile = file;
    state.outputBlob = null;
    state.outputName = "";
    state.report = [];
    state.reportDocument = null;
    state.lastResult = null;
    dom.fileName.textContent = file.name;
    dom.fileSize.textContent = formatBytes(file.size);
    dom.dropZone.classList.add("hidden");
    dom.selectedFile.classList.remove("hidden");
    dom.repairButton.disabled = false;
    if (dom.previewButton) dom.previewButton.classList.remove("hidden");
    dom.downloadButton.classList.add("hidden");
    if (dom.sendToKindleLink) dom.sendToKindleLink.classList.add("hidden");
    if (dom.supportLink) dom.supportLink.classList.add("hidden");
    if (dom.filenameField) dom.filenameField.classList.add("hidden");
    showIdleState();
  }

  function clearSelectedFile() {
    if (state.processing) return;
    state.inputFile = null;
    state.outputBlob = null;
    state.outputName = "";
    state.report = [];
    state.reportDocument = null;
    state.lastResult = null;
    dom.fileInput.value = "";
    dom.dropZone.classList.remove("hidden");
    dom.selectedFile.classList.add("hidden");
    dom.repairButton.disabled = true;
    if (dom.previewButton) dom.previewButton.classList.add("hidden");
    dom.downloadButton.classList.add("hidden");
    if (dom.sendToKindleLink) dom.sendToKindleLink.classList.add("hidden");
    if (dom.supportLink) dom.supportLink.classList.add("hidden");
    if (dom.filenameField) dom.filenameField.classList.add("hidden");
    showIdleState();
  }

  function useRecommendedOptions() {
    const recommended = {
      reduceMargins: false,
      miniMargins: false,
      normalizePaths: true,
      removeJunk: true,
      repairPackage: true,
      repairNavigation: true,
      repairText: true,
      repairCover: true,
      addUnlisted: true,
      removeMissing: true,
      stripScripts: false
    };
    for (const [id, checked] of Object.entries(recommended)) {
      const element = document.getElementById(id);
      if (element) element.checked = checked;
    }
    persistOptions();
  }

  function readOptions() {
    return Object.fromEntries(optionIds.map((id) => [id, Boolean(document.getElementById(id)?.checked)]));
  }

  function showIdleState() {
    dom.idleState.classList.remove("hidden");
    dom.progressState.classList.add("hidden");
    dom.resultState.classList.add("hidden");
  }

  function showProgress(label, percent, detail) {
    dom.idleState.classList.add("hidden");
    dom.resultState.classList.add("hidden");
    dom.progressState.classList.remove("hidden");
    dom.progressLabel.textContent = label;
    dom.progressPercent.textContent = `${Math.max(0, Math.min(100, Math.round(percent)))}%`;
    dom.progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    dom.progressDetail.textContent = detail;
  }

  async function updateProgress(label, percent, detail) {
    showProgress(label, percent, detail);
    await nextFrame();
  }

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }

  async function repairSelectedFile() {
    if (!state.inputFile || state.processing) return;

    state.processing = true;
    state.outputBlob = null;
    state.report = [];
    state.reportDocument = null;
    state.lastResult = null;
    dom.repairButton.disabled = true;
    if (dom.languageSelect) dom.languageSelect.disabled = true;
    dom.downloadButton.classList.add("hidden");
    if (dom.sendToKindleLink) dom.sendToKindleLink.classList.add("hidden");
    if (dom.supportLink) dom.supportLink.classList.add("hidden");
    if (dom.filenameField) dom.filenameField.classList.add("hidden");
    const options = readOptions();

    try {
      await updateProgress(t("progress.opening.label"), 3, t("progress.opening.detail"));
      const sourceZip = await JSZip.loadAsync(state.inputFile, {
        checkCRC32: true,
        createFolders: true
      });

      const sourcePaths = Object.values(sourceZip.files)
        .filter((entry) => !entry.dir)
        .map((entry) => normalizeSlashes(entry.name));

      if (sourcePaths.length === 0) {
        throw new Error("EMPTY_ZIP");
      }

      addIssue("info", "Arquivo ZIP aberto com sucesso.", "", "ZIP_OPENED");
      await updateProgress(t("progress.security.label"), 9, t("progress.security.detail"));

      const encryptionStatus = await inspectEncryption(sourceZip, sourcePaths);
      if (encryptionStatus.blocked) {
        addIssue(
          "error",
          "O EPUB contém criptografia ou DRM não compatível com reparo seguro. Nenhum conteúdo foi alterado.",
          "META-INF/encryption.xml",
          "DRM_BLOCKED"
        );
        finalizeWithoutOutput(sourcePaths.length, options);
        return;
      }

      if (encryptionStatus.fontObfuscation) {
        addIssue(
          "warning",
          "Foram detectadas fontes ofuscadas. O identificador do livro será preservado para não invalidar as fontes.",
          "META-INF/encryption.xml",
          "FONT_OBFUSCATION"
        );
      }

      await updateProgress(t("progress.mapping.label"), 15, t("progress.mapping.detail"));
      const originalOpfPath = await locateOriginalOpf(sourceZip, sourcePaths);
      if (!originalOpfPath) {
        addIssue("error", "Nenhum arquivo OPF foi localizado no EPUB.", "META-INF/container.xml", "OPF_NOT_FOUND");
        finalizeWithoutOutput(sourcePaths.length, options);
        return;
      }

      const filteredPaths = [];
      for (const path of sourcePaths) {
        if (path === "mimetype") continue;
        if (options.removeJunk && isJunkPath(path)) {
          addIssue("fixed", "Arquivo inútil removido do pacote.", path, "JUNK_REMOVED");
          continue;
        }
        filteredPaths.push(path);
      }

      const pathMap = createPathMap(filteredPaths, options.normalizePaths);
      for (const [oldPath, newPath] of pathMap.entries()) {
        if (oldPath !== newPath) {
          addIssue("fixed", `Caminho normalizado para “${newPath}”.`, oldPath, "PATH_NORMALIZED", { newPath });
        }
      }

      const mappedOpfPath = pathMap.get(originalOpfPath) || sanitizePackagePath(originalOpfPath);
      await updateProgress(t("progress.reading.label"), 24, t("progress.reading.detail"));

      const contentMap = new Map();
      let readIndex = 0;
      for (const oldPath of filteredPaths) {
        readIndex += 1;
        const entry = sourceZip.file(oldPath) || sourceZip.file(findExactZipName(sourceZip, oldPath));
        if (!entry) {
          addIssue("warning", "O arquivo listado no ZIP não pôde ser lido.", oldPath, "ZIP_ENTRY_UNREADABLE");
          continue;
        }

        const newPath = pathMap.get(oldPath) || oldPath;
        const extension = getExtension(oldPath);
        const isText = TEXT_EXTENSIONS.has(extension) || oldPath === "META-INF/container.xml" || oldPath === "META-INF/encryption.xml";
        const bytes = await entry.async("uint8array");

        if (isText) {
          const decoded = decodeText(bytes);
          if (decoded.convertedEncoding) {
            addIssue("fixed", `Texto convertido de ${decoded.sourceEncoding} para UTF-8.`, oldPath, "TEXT_REENCODED", { encoding: decoded.sourceEncoding });
          }
          contentMap.set(newPath, {
            data: decoded.text,
            isText: true,
            sourcePath: oldPath
          });
        } else {
          contentMap.set(newPath, {
            data: bytes,
            isText: false,
            sourcePath: oldPath
          });
        }

        if (bytes.length === 0) {
          addIssue("warning", "Arquivo vazio encontrado no pacote.", oldPath, "EMPTY_FILE");
        }

        if (readIndex % 25 === 0) {
          const fraction = readIndex / Math.max(filteredPaths.length, 1);
          await updateProgress(t("progress.reading.label"), 24 + fraction * 12, t("runtime.filesProcessed", { current: readIndex, total: filteredPaths.length }));
        }
      }

      await updateProgress(t("progress.references.label"), 39, t("progress.references.detail"));
      rewriteAllInternalReferences(contentMap, pathMap, filteredPaths, options);

      await updateProgress(t("progress.container.label"), 47, t("progress.container.detail"));
      repairContainer(contentMap, mappedOpfPath);

      if (options.repairText || options.reduceMargins || options.miniMargins) {
        await updateProgress(t("progress.content.label"), 54, t("progress.content.detail"));
        repairTextDocuments(contentMap, options);
      }

      let packageResult = null;
      if (options.repairPackage) {
        await updateProgress(t("progress.package.label"), 64, t("progress.package.detail"));
        packageResult = repairPackageDocument(contentMap, mappedOpfPath, options, encryptionStatus.fontObfuscation);
      } else {
        packageResult = inspectPackageDocument(contentMap, mappedOpfPath);
      }

      if (!packageResult.ok) {
        addIssue(
          "error",
          packageResult.message || "Não foi possível reparar o pacote OPF.",
          mappedOpfPath,
          "OPF_REPAIR_FAILED",
          { reasonKey: packageResult.messageKey || "", reason: packageResult.message || "" }
        );
        finalizeWithoutOutput(contentMap.size, options);
        return;
      }

      await updateProgress(t("progress.validation.label"), 76, t("progress.validation.detail"));
      validateFinalPackage(contentMap, mappedOpfPath, packageResult);

      await updateProgress(t("progress.rebuild.label"), 86, t("progress.rebuild.detail"));
      const outputZip = new JSZip();
      // JSZip grava o horário como UTC no formato DOS (que é local); compensa o
      // fuso para não gerar timestamps no futuro dentro do ZIP.
      const zipDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
      outputZip.file("mimetype", "application/epub+zip", {
        binary: false,
        compression: "STORE",
        createFolders: false,
        date: zipDate
      });

      const sortedOutputPaths = [...contentMap.keys()]
        .filter((path) => path !== "mimetype")
        .sort(compareEpubPaths);

      for (const path of sortedOutputPaths) {
        const item = contentMap.get(path);
        if (!item) continue;
        outputZip.file(path, item.data, {
          binary: !item.isText,
          compression: "DEFLATE",
          compressionOptions: { level: 9 },
          createFolders: false,
          date: zipDate
        });
      }

      state.outputBlob = await outputZip.generateAsync({
        type: "blob",
        mimeType: "application/epub+zip",
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
        platform: "DOS",
        streamFiles: false
      }, (metadata) => {
        const percent = 86 + (metadata.percent / 100) * 12;
        showProgress(t("progress.rebuild.label"), percent, metadata.currentFile ? t("runtime.compacting", { file: metadata.currentFile }) : t("runtime.finalizing"));
      });

      state.outputName = buildOutputName(state.inputFile.name);
      addIssue("fixed", "EPUB reconstruído com mimetype na primeira posição e sem compressão.", "mimetype", "EPUB_REBUILT");
      addIssue("info", `Novo arquivo gerado com ${formatBytes(state.outputBlob.size)}.`, state.outputName, "OUTPUT_READY", { size: state.outputBlob.size });

      state.reportDocument = createReportDocument({
        options,
        inputFile: state.inputFile,
        outputName: state.outputName,
        outputSize: state.outputBlob.size,
        fileCount: contentMap.size + 1,
        packageResult
      });

      await updateProgress(t("progress.complete.label"), 100, t("progress.complete.detail"));
      await nextFrame();
      showResults(contentMap.size + 1, true);
    } catch (error) {
      console.error(error);
      const rawMessage = error instanceof Error ? error.message : String(error);
      addIssue(
        "error",
        describeProcessingError(rawMessage),
        state.inputFile?.name || "",
        "PROCESSING_EXCEPTION",
        { rawMessage }
      );
      state.outputBlob = null;
      state.reportDocument = createReportDocument({
        options,
        inputFile: state.inputFile,
        outputName: null,
        outputSize: null,
        fileCount: 0,
        packageResult: null
      });
      showResults(0, false);
    } finally {
      state.processing = false;
      dom.repairButton.disabled = !state.inputFile;
      if (dom.languageSelect) dom.languageSelect.disabled = false;
    }
  }

  const previewState = { zip: null, chapters: [], index: 0, mode: "original", cache: new Map(), baseHtml: null };

  async function openPreview() {
    if (!state.inputFile || !dom.previewOverlay) return;
    let spine = null;
    let zip = null;
    try {
      zip = await JSZip.loadAsync(state.inputFile, { checkCRC32: true, createFolders: true });
      spine = await buildPreviewSpine(zip);
    } catch {
      spine = null;
    }
    if (!spine) {
      window.alert(t("preview.unavailable"));
      return;
    }
    previewState.zip = zip;
    previewState.chapters = spine.chapters;
    previewState.cache.clear();
    previewState.mode = "original";
    document.querySelectorAll(".preview-mode").forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === "original");
    });
    dom.previewOverlay.classList.remove("hidden");
    await showPreviewChapter(0);
  }

  function closePreview() {
    if (!dom.previewOverlay) return;
    dom.previewOverlay.classList.add("hidden");
    if (dom.previewFrame) dom.previewFrame.srcdoc = "";
    previewState.zip = null;
    previewState.chapters = [];
    previewState.cache.clear();
    previewState.baseHtml = null;
  }

  async function showPreviewChapter(index) {
    if (!previewState.chapters.length || !dom.previewFrame) return;
    const clamped = Math.min(Math.max(index, 0), previewState.chapters.length - 1);
    previewState.index = clamped;
    let html = previewState.cache.get(clamped);
    if (html === undefined) {
      html = await extractChapterHtml(previewState.zip, previewState.chapters[clamped]).catch(() => null);
      previewState.cache.set(clamped, html || null);
    }
    previewState.baseHtml = html;
    updatePreviewNav();
    renderPreviewFrame();
  }

  function updatePreviewNav() {
    if (dom.previewPageLabel) {
      dom.previewPageLabel.textContent = t("preview.pageLabel", {
        current: previewState.index + 1,
        total: previewState.chapters.length
      });
    }
    if (dom.previewPrev) dom.previewPrev.disabled = previewState.index <= 0;
    if (dom.previewNext) dom.previewNext.disabled = previewState.index >= previewState.chapters.length - 1;
  }

  function renderPreviewFrame() {
    if (!dom.previewFrame) return;
    if (!previewState.baseHtml) {
      dom.previewFrame.srcdoc = "";
      return;
    }
    dom.previewFrame.srcdoc = previewState.mode === "original"
      ? previewState.baseHtml
      : applyReducedMargins(previewState.baseHtml, previewState.mode === "mini" ? "mini" : "reduced");
  }

  function setPreviewMode(mode) {
    previewState.mode = mode;
    document.querySelectorAll(".preview-mode").forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === mode);
    });
    renderPreviewFrame();
  }

  function bytesToDataUrl(bytes, mime) {
    let binary = "";
    const CHUNK = 0x8000;
    for (let index = 0; index < bytes.length; index += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
    }
    return `data:${mime || "application/octet-stream"};base64,${btoa(binary)}`;
  }

  const PREVIEW_MAX_ASSET_BYTES = 2 * 1024 * 1024;

  async function findOpfPathQuiet(zip, sourcePaths) {
    const containerPath = sourcePaths.find((path) => path.toLowerCase() === "meta-inf/container.xml");
    if (containerPath) {
      const entry = zip.file(containerPath) || zip.file(findExactZipName(zip, containerPath));
      if (entry) {
        const text = decodeText(await entry.async("uint8array")).text;
        const documentNode = parseXml(text);
        if (documentNode) {
          const rootfile = findFirstByLocalName(documentNode, "rootfile");
          const fullPath = rootfile?.getAttribute("full-path");
          if (fullPath) {
            const matched = findPathLoosely(sourcePaths, fullPath);
            if (matched) return matched;
          }
        }
        const regexMatch = text.match(/full-path\s*=\s*["']([^"']+)["']/i);
        if (regexMatch) {
          const matched = findPathLoosely(sourcePaths, regexMatch[1]);
          if (matched) return matched;
        }
      }
    }
    const opfCandidates = sourcePaths.filter((path) => getExtension(path) === ".opf");
    if (opfCandidates.length === 1) return opfCandidates[0];
    if (opfCandidates.length > 1) {
      return opfCandidates.find((path) => /(^|\/)(content|package|book)\.opf$/i.test(path)) || opfCandidates[0];
    }
    return null;
  }

  async function readZipTextQuiet(zip, path) {
    const entry = zip.file(path) || zip.file(findExactZipName(zip, path));
    if (!entry) return null;
    return decodeText(await entry.async("uint8array")).text;
  }

  async function readZipBytesQuiet(zip, path) {
    const entry = zip.file(path) || zip.file(findExactZipName(zip, path));
    if (!entry) return null;
    return entry.async("uint8array");
  }

  async function inlineAssetsAsDataUrls(text, basePath, zip) {
    const replacements = new Map();

    const collectReference = (reference) => {
      const trimmed = (reference || "").trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("data:") || isExternalReference(trimmed)) return null;
      const { pathPart } = splitReference(trimmed);
      if (!pathPart) return null;
      return normalizePackagePath(joinPath(dirname(basePath), pathPart));
    };

    const resolveDataUrl = async (reference) => {
      const resolvedPath = collectReference(reference);
      if (!resolvedPath) return null;
      if (replacements.has(resolvedPath)) return replacements.get(resolvedPath);
      try {
        const bytes = await readZipBytesQuiet(zip, resolvedPath);
        if (!bytes || bytes.byteLength > PREVIEW_MAX_ASSET_BYTES) return null;
        const dataUrl = bytesToDataUrl(bytes, mediaTypeForPath(resolvedPath) || "application/octet-stream");
        replacements.set(resolvedPath, dataUrl);
        return dataUrl;
      } catch {
        return null;
      }
    };

    let output = text;
    const attributeMatches = [...output.matchAll(/(\b(?:src|xlink:href)\s*=\s*)(["'])([\s\S]*?)\2/gi)];
    for (const match of attributeMatches) {
      const dataUrl = await resolveDataUrl(match[3]);
      if (dataUrl) output = output.replace(match[0], `${match[1]}${match[2]}${dataUrl}${match[2]}`);
    }

    const urlMatches = [...output.matchAll(/url\(\s*(["']?)([^)'"\s][^)]*?)\1\s*\)/gi)];
    for (const match of urlMatches) {
      const dataUrl = await resolveDataUrl(match[2]);
      if (dataUrl) output = output.replace(match[0], `url(${dataUrl})`);
    }

    return output;
  }

  async function buildPreviewSpine(zip) {
    const sourcePaths = Object.values(zip.files)
      .filter((entry) => !entry.dir)
      .map((entry) => normalizeSlashes(entry.name));
    if (!sourcePaths.length) return null;

    const opfPath = await findOpfPathQuiet(zip, sourcePaths);
    if (!opfPath) return null;

    const opfText = await readZipTextQuiet(zip, opfPath);
    if (!opfText) return null;
    const opfDocument = parseXml(opfText);
    if (!opfDocument) return null;

    const packageElement = opfDocument.documentElement;
    const manifest = findDirectChild(packageElement, "manifest");
    const spine = findDirectChild(packageElement, "spine");
    if (!manifest || !spine) return null;

    const itemsById = new Map();
    for (const item of getDirectChildren(manifest, "item")) {
      const id = item.getAttribute("id");
      if (id) itemsById.set(id, item);
    }

    const chapters = [];
    for (const itemref of getDirectChildren(spine, "itemref")) {
      const item = itemsById.get(itemref.getAttribute("idref") || "");
      if (!item) continue;
      const mediaType = item.getAttribute("media-type") || "";
      if (mediaType !== "application/xhtml+xml" && mediaType !== "text/html") continue;
      const href = item.getAttribute("href") || "";
      const { pathPart } = splitReference(href);
      if (!pathPart) continue;
      chapters.push(normalizePackagePath(joinPath(dirname(opfPath), pathPart)));
    }
    if (!chapters.length) return null;

    return { opfPath, chapters };
  }

  async function extractChapterHtml(zip, chapterPath) {
    let chapterHtml = await readZipTextQuiet(zip, chapterPath);
    if (!chapterHtml) return null;

    const styleLinks = [...chapterHtml.matchAll(/<link\b[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi)];
    let cssText = "";
    for (const linkMatch of styleLinks) {
      const hrefMatch = linkMatch[0].match(/href\s*=\s*["']([^"']+)["']/i);
      if (!hrefMatch) continue;
      const cssPath = normalizePackagePath(joinPath(dirname(chapterPath), hrefMatch[1]));
      const css = await readZipTextQuiet(zip, cssPath);
      if (css) cssText += `\n${await inlineAssetsAsDataUrls(css, cssPath, zip)}`;
      chapterHtml = chapterHtml.replace(linkMatch[0], "");
    }

    chapterHtml = await inlineAssetsAsDataUrls(chapterHtml, chapterPath, zip);

    if (cssText) {
      const styleTag = `<style type="text/css">${cssText}</style>`;
      chapterHtml = /<\/head>/i.test(chapterHtml)
        ? chapterHtml.replace(/<\/head>/i, `${styleTag}</head>`)
        : chapterHtml.replace(/(<html\b[^>]*>)/i, `$1<head>${styleTag}</head>`);
    }

    return chapterHtml;
  }

  async function inspectEncryption(zip, paths) {
    const encryptionPath = paths.find((path) => path.toLowerCase() === "meta-inf/encryption.xml");
    if (!encryptionPath) return { blocked: false, fontObfuscation: false };

    const entry = zip.file(encryptionPath) || zip.file(findExactZipName(zip, encryptionPath));
    if (!entry) return { blocked: false, fontObfuscation: false };
    const text = decodeText(await entry.async("uint8array")).text;
    const algorithms = [...text.matchAll(/Algorithm\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
    if (algorithms.length === 0) {
      return { blocked: true, fontObfuscation: false };
    }
    const unknownAlgorithms = algorithms.filter((algorithm) => !FONT_OBFUSCATION_ALGORITHMS.has(algorithm));
    return {
      blocked: unknownAlgorithms.length > 0,
      fontObfuscation: unknownAlgorithms.length === 0 && algorithms.length > 0
    };
  }

  async function locateOriginalOpf(zip, sourcePaths) {
    const containerPath = sourcePaths.find((path) => path.toLowerCase() === "meta-inf/container.xml");
    if (containerPath) {
      const entry = zip.file(containerPath) || zip.file(findExactZipName(zip, containerPath));
      if (entry) {
        const text = decodeText(await entry.async("uint8array")).text;
        const documentNode = parseXml(text);
        if (documentNode) {
          const rootfile = findFirstByLocalName(documentNode, "rootfile");
          const fullPath = rootfile?.getAttribute("full-path");
          if (fullPath) {
            const matched = findPathLoosely(sourcePaths, fullPath);
            if (matched) return matched;
          }
        }
        const regexMatch = text.match(/full-path\s*=\s*["']([^"']+)["']/i);
        if (regexMatch) {
          const matched = findPathLoosely(sourcePaths, regexMatch[1]);
          if (matched) return matched;
        }
      }
    }

    const opfCandidates = sourcePaths.filter((path) => getExtension(path) === ".opf");
    if (opfCandidates.length === 1) {
      addIssue("fixed", "Container ausente ou inválido; o único OPF do pacote foi localizado automaticamente.", opfCandidates[0], "OPF_AUTO_DETECTED");
      return opfCandidates[0];
    }
    if (opfCandidates.length > 1) {
      const preferred = opfCandidates.find((path) => /(^|\/)(content|package|book)\.opf$/i.test(path)) || opfCandidates[0];
      addIssue("warning", `Mais de um OPF foi encontrado; “${preferred}” foi selecionado.`, preferred, "MULTIPLE_OPF_FILES", { path: preferred });
      return preferred;
    }
    return null;
  }

  function createPathMap(paths, normalizePathsOption) {
    const result = new Map();
    const occupied = new Set(["mimetype"]);

    for (const oldPath of paths) {
      let desiredPath = normalizePathsOption ? sanitizePackagePath(oldPath) : normalizePackagePath(oldPath);
      if (oldPath.toLowerCase() === "meta-inf/container.xml") desiredPath = "META-INF/container.xml";
      if (oldPath.toLowerCase() === "meta-inf/encryption.xml") desiredPath = "META-INF/encryption.xml";
      if (oldPath.toLowerCase() === "meta-inf/signatures.xml") desiredPath = "META-INF/signatures.xml";
      const uniquePath = makeUniquePath(desiredPath, occupied);
      occupied.add(uniquePath.toLowerCase());
      result.set(oldPath, uniquePath);
    }
    return result;
  }

  function sanitizePackagePath(inputPath) {
    const normalized = normalizePackagePath(inputPath);
    const segments = normalized.split("/").filter(Boolean).map((segment, index) => {
      if (index === 0 && segment.toLowerCase() === "meta-inf") return "META-INF";
      return sanitizePathSegment(segment);
    });
    return segments.join("/") || "file";
  }

  function sanitizePathSegment(inputSegment) {
    let segment = iterativeDecode(inputSegment);
    segment = segment.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    segment = segment.replace(/[\u0000-\u001f\u007f]/g, "");
    segment = segment.replace(/[^A-Za-z0-9._-]+/g, "-");
    segment = segment.replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
    if (!segment) segment = "file";

    const extension = getExtension(segment);
    if (extension) {
      const stem = segment.slice(0, -extension.length).replace(/\.+$/g, "") || "file";
      return `${stem.toLowerCase()}${extension.toLowerCase()}`;
    }
    return segment.toLowerCase();
  }

  function normalizePackagePath(inputPath) {
    const slashed = normalizeSlashes(iterativeDecode(String(inputPath || ""))).replace(/^\/+/, "");
    const output = [];
    for (const segment of slashed.split("/")) {
      if (!segment || segment === ".") continue;
      if (segment === "..") {
        output.pop();
      } else {
        output.push(segment);
      }
    }
    return output.join("/");
  }

  function makeUniquePath(path, occupiedLowercase) {
    if (!occupiedLowercase.has(path.toLowerCase())) return path;
    const directory = dirname(path);
    const filename = basename(path);
    const extension = getExtension(filename);
    const stem = extension ? filename.slice(0, -extension.length) : filename;
    let counter = 2;
    while (true) {
      const candidateName = `${stem}-${counter}${extension}`;
      const candidate = directory ? `${directory}/${candidateName}` : candidateName;
      if (!occupiedLowercase.has(candidate.toLowerCase())) return candidate;
      counter += 1;
    }
  }

  function rewriteAllInternalReferences(contentMap, pathMap, originalPaths, options) {
    const originalLookup = buildPathLookup(originalPaths);
    const entries = [...contentMap.entries()];

    for (const [newPath, item] of entries) {
      if (!item.isText) continue;
      const oldPath = item.sourcePath;
      let text = item.data;
      let changedCount = 0;

      const replaceReference = (rawReference) => {
        const decodedAttribute = decodeXmlAttribute(rawReference);
        const replacement = mapReference(oldPath, newPath, decodedAttribute, originalLookup, pathMap);
        if (!replacement || replacement === decodedAttribute) return rawReference;
        changedCount += 1;
        return encodeXmlAttribute(replacement, rawReference);
      };

      text = text.replace(/(\b(?:href|src|poster|data|xlink:href|URI)\s*=\s*)(["'])([\s\S]*?)\2/gi, (full, prefix, quote, value) => {
        return `${prefix}${quote}${replaceReference(value)}${quote}`;
      });

      text = text.replace(/url\(\s*(["']?)([^)'"\s][^)]*?)\1\s*\)/gi, (full, quote, value) => {
        const cleanValue = value.trim();
        const replacement = replaceReference(cleanValue);
        if (replacement === cleanValue) return full;
        const outputQuote = quote || (/[\s()]/.test(replacement) ? '"' : "");
        return `url(${outputQuote}${replacement}${outputQuote})`;
      });

      text = text.replace(/(@import\s+)(["'])([^"']+)\2/gi, (full, prefix, quote, value) => {
        return `${prefix}${quote}${replaceReference(value)}${quote}`;
      });

      if (changedCount > 0) {
        item.data = text;
        addIssue("fixed", `${changedCount} referência(s) interna(s) atualizada(s).`, newPath, "REFERENCES_REWRITTEN", { count: changedCount });
      }

      if (options.repairText && /(?:https?:)?\/\//i.test(text)) {
        const remoteMatches = text.match(/(?:src|href)\s*=\s*["'](?:https?:)?\/\//gi);
        if (remoteMatches?.length) {
          addIssue("warning", "O documento possui recursos remotos; o Kindle pode ignorá-los quando estiver offline.", newPath, "REMOTE_RESOURCES");
        }
      }
    }
  }

  function mapReference(oldSourcePath, newSourcePath, reference, originalLookup, pathMap) {
    const trimmed = reference.trim();
    if (!trimmed || trimmed.startsWith("#") || isExternalReference(trimmed)) return null;

    const { pathPart, suffix } = splitReference(trimmed);
    if (!pathPart) return null;

    let resolvedOldPath;
    if (pathPart.startsWith("/")) {
      resolvedOldPath = normalizePackagePath(pathPart);
    } else {
      resolvedOldPath = normalizePackagePath(joinPath(dirname(oldSourcePath), pathPart));
    }

    const actualOldPath = lookupPath(originalLookup, resolvedOldPath) || lookupPath(originalLookup, pathPart);
    if (!actualOldPath) return null;
    const targetNewPath = pathMap.get(actualOldPath) || actualOldPath;
    const relative = relativePath(dirname(newSourcePath), targetNewPath);
    return `${relative || basename(targetNewPath)}${suffix}`;
  }

  function repairContainer(contentMap, opfPath) {
    const containerPath = "META-INF/container.xml";
    const oldContainer = [...contentMap.keys()].find((path) => path.toLowerCase() === "meta-inf/container.xml");
    if (oldContainer && oldContainer !== containerPath) contentMap.delete(oldContainer);
    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n  <rootfiles>\n    <rootfile full-path="${escapeXml(opfPath)}" media-type="application/oebps-package+xml"/>\n  </rootfiles>\n</container>\n`;
    const previous = contentMap.get(containerPath)?.data;
    contentMap.set(containerPath, { data: containerXml, isText: true, sourcePath: containerPath });
    if (previous !== containerXml) {
      addIssue("fixed", "META-INF/container.xml reconstruído e vinculado ao OPF correto.", containerPath, "CONTAINER_REBUILT");
    }
  }

  function repairTextDocuments(contentMap, options) {
    for (const [path, item] of contentMap.entries()) {
      if (!item.isText) continue;
      const extension = getExtension(path);
      if (!TEXT_EXTENSIONS.has(extension) && !path.toLowerCase().endsWith("container.xml")) continue;

      let text = String(item.data);
      const original = text;
      text = text.replace(/^\uFEFF/, "");
      text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

      if ([".xhtml", ".html", ".htm", ".svg", ".xml", ".opf", ".ncx"].includes(extension)) {
        text = replaceUnsafeNamedEntities(text);
      }

      if ([".xhtml", ".html", ".htm"].includes(extension)) {
        text = ensureXhtmlNamespace(text);
        if (options.stripScripts) {
          const withoutScripts = text.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");
          if (withoutScripts !== text) {
            addIssue("fixed", "Elementos JavaScript removidos do documento.", path, "SCRIPTS_REMOVED");
            text = withoutScripts;
          }
        }
        if (options.miniMargins || options.reduceMargins) {
          const marginLevel = options.miniMargins ? "mini" : "reduced";
          const withReducedMargins = applyReducedMargins(text, marginLevel);
          if (withReducedMargins !== text) {
            const message = marginLevel === "mini"
              ? "Mini-margens aplicadas neste documento."
              : "Margens laterais reduzidas neste documento.";
            addIssue("fixed", message, path, "MARGINS_REDUCED");
            text = withReducedMargins;
          }
        }
      }

      if (extension === ".css") {
        text = text.replace(/^\s*@charset\s+["'][^"']+["'];?/i, '@charset "UTF-8";');
      }

      if (text !== original) {
        item.data = text;
        addIssue("fixed", "Codificação e caracteres inválidos normalizados.", path, "TEXT_SANITIZED");
      }

      if ([".xhtml", ".svg", ".xml", ".opf", ".ncx"].includes(extension)) {
        const parsed = parseXml(text);
        if (!parsed) {
          addIssue("warning", "O documento ainda contém XML malformado e pode precisar de revisão manual.", path, "MALFORMED_XML");
        }
      }
    }
  }

  function repairPackageDocument(contentMap, opfPath, options, preserveIdentifier) {
    const opfItem = contentMap.get(opfPath);
    if (!opfItem?.isText) {
      return { ok: false, message: "O arquivo OPF não existe no caminho indicado pelo container.", messageKey: "opfMissingAtContainerPath" };
    }

    const documentNode = parseXml(opfItem.data);
    if (!documentNode) {
      return { ok: false, message: "O arquivo OPF contém XML inválido e não pôde ser interpretado.", messageKey: "opfInvalidXml" };
    }

    const packageElement = documentNode.documentElement;
    if (!packageElement || packageElement.localName !== "package") {
      return { ok: false, message: "O documento OPF não contém o elemento package.", messageKey: "opfMissingPackage" };
    }

    const opfNamespace = packageElement.namespaceURI || XMLNS_OPF;
    let metadata = findDirectChild(packageElement, "metadata");
    let manifest = findDirectChild(packageElement, "manifest");
    let spine = findDirectChild(packageElement, "spine");

    if (!metadata) {
      metadata = documentNode.createElementNS(opfNamespace, "metadata");
      packageElement.insertBefore(metadata, packageElement.firstChild);
      addIssue("fixed", "Seção metadata criada no OPF.", opfPath, "METADATA_CREATED");
    }
    if (!manifest) {
      manifest = documentNode.createElementNS(opfNamespace, "manifest");
      packageElement.appendChild(manifest);
      addIssue("fixed", "Manifesto criado no OPF.", opfPath, "MANIFEST_CREATED");
    }
    if (!spine) {
      spine = documentNode.createElementNS(opfNamespace, "spine");
      packageElement.appendChild(spine);
      addIssue("fixed", "Spine criado no OPF.", opfPath, "SPINE_CREATED");
    }

    const title = ensureMetadataElement(documentNode, metadata, "title", t("book.untitled"), "title", opfPath);
    const language = ensureMetadataElement(documentNode, metadata, "language", i18n?.getOpfLanguage?.() || "en", "language", opfPath);
    const identifierResult = ensureIdentifier(documentNode, packageElement, metadata, opfPath, preserveIdentifier);
    const bookIdentifier = identifierResult.value;

    const manifestInfo = repairManifest(documentNode, manifest, spine, contentMap, opfPath, options);
    repairSpine(documentNode, spine, manifestInfo, contentMap, opfPath, options);

    let navigationInfo = { navPath: null, ncxPath: null };
    if (options.repairNavigation) {
      navigationInfo = repairNavigationDocuments({
        documentNode,
        packageElement,
        manifest,
        spine,
        metadata,
        manifestInfo,
        contentMap,
        opfPath,
        title,
        language,
        bookIdentifier,
        opfNamespace
      });
    }

    if (options.repairCover) {
      repairCoverMetadata(documentNode, metadata, manifest, manifestInfo, opfPath);
    }

    packageElement.setAttribute("version", packageElement.getAttribute("version") || "3.0");
    removeUnusedPackagePrefixes(documentNode, packageElement, opfPath);
    updateModifiedTimestamp(documentNode, packageElement, metadata, opfPath);
    const serialized = serializeXmlDocument(documentNode);
    opfItem.data = serialized;
    addIssue("fixed", "Pacote OPF validado e normalizado.", opfPath, "OPF_NORMALIZED");

    return {
      ok: true,
      opfPath,
      title,
      language,
      identifier: bookIdentifier,
      manifestCount: getDirectChildren(manifest, "item").length,
      spineCount: getDirectChildren(spine, "itemref").length,
      navPath: navigationInfo.navPath,
      ncxPath: navigationInfo.ncxPath
    };
  }

  function removeUnusedPackagePrefixes(documentNode, packageElement, opfPath) {
    const declaration = packageElement.getAttribute("prefix");
    if (!declaration) return;

    // Prefixos reservados do EPUB 3 dispensam declaração.
    const reservedPrefixes = new Set(["a11y", "dcterms", "marc", "media", "onix", "rendition", "schema", "xsd"]);
    const usedPrefixes = new Set();
    const prefixedValueAttributes = ["property", "properties", "rel", "scheme", "epub:type"];
    for (const element of documentNode.getElementsByTagName("*")) {
      for (const attributeName of prefixedValueAttributes) {
        const value = element.getAttribute(attributeName);
        if (!value) continue;
        for (const token of value.split(/\s+/)) {
          const separator = token.indexOf(":");
          if (separator > 0) usedPrefixes.add(token.slice(0, separator));
        }
      }
    }

    const declaredPairs = [...declaration.matchAll(/(\S+):\s+(\S+)/g)];
    const keptPairs = declaredPairs.filter(([, name]) => usedPrefixes.has(name) && !reservedPrefixes.has(name));
    if (keptPairs.length === declaredPairs.length) return;

    if (keptPairs.length) {
      packageElement.setAttribute("prefix", keptPairs.map(([pair]) => pair).join(" "));
    } else {
      packageElement.removeAttribute("prefix");
    }
    addIssue("fixed", "Declarações de prefixo não utilizadas removidas do OPF para compatibilidade com o conversor do Kindle.", opfPath, "OPF_PREFIX_CLEANED");
  }

  function updateModifiedTimestamp(documentNode, packageElement, metadata, opfPath) {
    const isEpub3 = /^3/.test(packageElement.getAttribute("version") || "3.0");
    let modifiedMeta = [...metadata.getElementsByTagNameNS("*", "meta")]
      .find((element) => (element.getAttribute("property") || "").trim() === "dcterms:modified");
    if (!modifiedMeta) {
      if (!isEpub3) return;
      modifiedMeta = documentNode.createElementNS(metadata.namespaceURI || XMLNS_OPF, "meta");
      modifiedMeta.setAttribute("property", "dcterms:modified");
      metadata.appendChild(modifiedMeta);
    }
    modifiedMeta.textContent = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    addIssue("fixed", "Data de modificação (dcterms:modified) atualizada para o Kindle tratar o arquivo como novo documento.", opfPath, "OPF_MODIFIED_UPDATED");
  }

  function inspectPackageDocument(contentMap, opfPath) {
    const item = contentMap.get(opfPath);
    if (!item?.isText) return { ok: false, message: "OPF não encontrado.", messageKey: "opfNotFound" };
    const documentNode = parseXml(item.data);
    if (!documentNode) return { ok: false, message: "OPF inválido.", messageKey: "opfInvalid" };
    const packageElement = documentNode.documentElement;
    const metadata = findDirectChild(packageElement, "metadata");
    const title = getElementText(findFirstByLocalName(metadata, "title")) || t("book.generic");
    const language = getElementText(findFirstByLocalName(metadata, "language")) || "und";
    const identifier = getElementText(findFirstByLocalName(metadata, "identifier")) || "";
    return { ok: true, opfPath, title, language, identifier };
  }

  function ensureMetadataElement(documentNode, metadata, localName, fallbackValue, label, opfPath) {
    let element = getDirectChildren(metadata, localName)[0] || findFirstByLocalName(metadata, localName);
    let value = getElementText(element);
    if (!element) {
      element = documentNode.createElementNS(XMLNS_DC, `dc:${localName}`);
      metadata.appendChild(element);
    }
    if (!value) {
      value = fallbackValue;
      element.textContent = value;
      addIssue("fixed", `Metadado dc:${label} adicionado ao OPF.`, opfPath, `METADATA_${label.toUpperCase()}_ADDED`, { label });
    }
    return value;
  }

  function ensureIdentifier(documentNode, packageElement, metadata, opfPath, preserveIdentifier) {
    const identifiers = [...metadata.getElementsByTagNameNS("*", "identifier")];
    let identifier = identifiers.find((element) => getElementText(element)) || identifiers[0];
    if (!identifier) {
      identifier = documentNode.createElementNS(XMLNS_DC, "dc:identifier");
      metadata.appendChild(identifier);
    }

    let value = getElementText(identifier);
    if (!value) {
      value = `urn:uuid:${createUuid()}`;
      identifier.textContent = value;
      addIssue(
        preserveIdentifier ? "warning" : "fixed",
        preserveIdentifier
          ? "O livro não tinha identificador, mas usa fontes ofuscadas; um identificador foi criado e as fontes podem exigir revisão."
          : "Identificador UUID adicionado ao OPF.",
        opfPath,
        "IDENTIFIER_ADDED",
        { preserveIdentifier }
      );
    }

    let id = identifier.getAttribute("id");
    if (!id) {
      id = "book-id";
      const existingIds = collectXmlIds(documentNode);
      let counter = 2;
      while (existingIds.has(id)) {
        id = `book-id-${counter}`;
        counter += 1;
      }
      identifier.setAttribute("id", id);
      addIssue("fixed", "ID do identificador principal adicionado.", opfPath, "IDENTIFIER_ID_ADDED");
    }
    if (packageElement.getAttribute("unique-identifier") !== id) {
      packageElement.setAttribute("unique-identifier", id);
      addIssue("fixed", "Atributo unique-identifier corrigido no package.", opfPath, "UNIQUE_IDENTIFIER_FIXED");
    }
    return { element: identifier, value, id };
  }

  function repairManifest(documentNode, manifest, spine, contentMap, opfPath, options) {
    const items = getDirectChildren(manifest, "item");
    const usedIds = new Set();
    const removedIds = new Set();
    const itemRecords = [];
    const targetToRecord = new Map();

    for (const item of items) {
      let id = (item.getAttribute("id") || "").trim();
      if (!id || usedIds.has(id)) {
        const oldId = id;
        id = createUniqueId(id || stemName(item.getAttribute("href") || "item"), usedIds);
        item.setAttribute("id", id);
        addIssue("fixed", oldId ? `ID duplicado “${oldId}” renomeado para “${id}”.` : `ID “${id}” criado para item do manifesto.`, opfPath, "MANIFEST_ID_FIXED", { oldId, id, created: !oldId });
      }
      usedIds.add(id);

      const href = item.getAttribute("href") || "";
      const target = resolveExistingContentPath(opfPath, href, contentMap);
      if (!target) {
        if (options.removeMissing) {
          manifest.removeChild(item);
          removedIds.add(id);
          addIssue("fixed", "Item do manifesto removido porque o arquivo não existe.", `${opfPath} → ${href || id}`, "MISSING_MANIFEST_ITEM_REMOVED");
        } else {
          addIssue("error", "Item do manifesto aponta para um arquivo inexistente.", `${opfPath} → ${href || id}`, "MISSING_MANIFEST_TARGET");
        }
        continue;
      }

      const canonicalHref = relativePath(dirname(opfPath), target);
      if (href !== canonicalHref) {
        item.setAttribute("href", canonicalHref);
        addIssue("fixed", "Caminho de item do manifesto corrigido.", `${opfPath} → ${canonicalHref}`, "MANIFEST_HREF_FIXED");
      }

      const expectedMediaType = mediaTypeForPath(target);
      if (expectedMediaType && item.getAttribute("media-type") !== expectedMediaType) {
        item.setAttribute("media-type", expectedMediaType);
        addIssue("fixed", `Media type corrigido para ${expectedMediaType}.`, target, "MEDIA_TYPE_FIXED", { mediaType: expectedMediaType });
      }

      const record = { element: item, id, href: canonicalHref, target, mediaType: item.getAttribute("media-type") || expectedMediaType || "" };
      itemRecords.push(record);
      targetToRecord.set(target.toLowerCase(), record);
    }

    if (options.addUnlisted) {
      for (const path of contentMap.keys()) {
        if (!shouldAddToManifest(path, opfPath)) continue;
        if (targetToRecord.has(path.toLowerCase())) continue;
        const mediaType = mediaTypeForPath(path);
        if (!mediaType) continue;

        const item = documentNode.createElementNS(manifest.namespaceURI || XMLNS_OPF, "item");
        const id = createUniqueId(stemName(path), usedIds);
        const href = relativePath(dirname(opfPath), path);
        item.setAttribute("id", id);
        item.setAttribute("href", href);
        item.setAttribute("media-type", mediaType);
        manifest.appendChild(item);
        const record = { element: item, id, href, target: path, mediaType };
        itemRecords.push(record);
        targetToRecord.set(path.toLowerCase(), record);
        addIssue("fixed", "Arquivo adicionado ao manifesto.", path, "UNLISTED_FILE_ADDED");
      }
    }

    return { usedIds, removedIds, itemRecords, targetToRecord };
  }

  function repairSpine(documentNode, spine, manifestInfo, contentMap, opfPath, options) {
    const recordById = new Map(manifestInfo.itemRecords.map((record) => [record.id, record]));
    const referencedIds = new Set();

    for (const itemref of [...getDirectChildren(spine, "itemref")]) {
      const idref = (itemref.getAttribute("idref") || "").trim();
      const record = recordById.get(idref);
      if (!record || !isDocumentMediaType(record.mediaType)) {
        if (options.removeMissing) {
          spine.removeChild(itemref);
          addIssue("fixed", "Referência inválida removida do spine.", `${opfPath} → ${idref || "sem idref"}`, "INVALID_SPINE_ITEM_REMOVED");
        } else {
          addIssue("error", "Spine contém uma referência inexistente ou não textual.", `${opfPath} → ${idref || "sem idref"}`, "INVALID_SPINE_REFERENCE");
        }
        continue;
      }
      referencedIds.add(idref);
    }

    for (const record of manifestInfo.itemRecords) {
      if (!isDocumentMediaType(record.mediaType)) continue;
      const properties = record.element.getAttribute("properties") || "";
      if (/\bnav\b/.test(properties)) continue;
      if (referencedIds.has(record.id)) continue;
      const itemref = documentNode.createElementNS(spine.namespaceURI || XMLNS_OPF, "itemref");
      itemref.setAttribute("idref", record.id);
      spine.appendChild(itemref);
      referencedIds.add(record.id);
      addIssue("fixed", "Documento de leitura adicionado ao spine.", record.target, "SPINE_ITEM_ADDED");
    }

    if (getDirectChildren(spine, "itemref").length === 0) {
      addIssue("error", "O spine está vazio; nenhum documento de leitura foi encontrado.", opfPath, "EMPTY_SPINE");
    }
  }

  function repairNavigationDocuments(context) {
    const {
      documentNode, manifest, spine, manifestInfo, contentMap, opfPath,
      title, language, bookIdentifier
    } = context;

    let navRecord = manifestInfo.itemRecords.find((record) => /(?:^|\s)nav(?:\s|$)/.test(record.element.getAttribute("properties") || ""));
    if (!navRecord) {
      navRecord = manifestInfo.itemRecords.find((record) => /(^|\/)nav\.xhtml$/i.test(record.target));
    }

    const spineRecords = collectSpineRecords(spine, manifestInfo.itemRecords);
    if (!navRecord) {
      const navPath = makeUniqueContentPath(joinPath(dirname(opfPath), "nav.xhtml"), contentMap);
      const navId = createUniqueId("nav", manifestInfo.usedIds);
      const navItem = documentNode.createElementNS(manifest.namespaceURI || XMLNS_OPF, "item");
      navItem.setAttribute("id", navId);
      navItem.setAttribute("href", relativePath(dirname(opfPath), navPath));
      navItem.setAttribute("media-type", "application/xhtml+xml");
      navItem.setAttribute("properties", "nav");
      manifest.appendChild(navItem);
      navRecord = { element: navItem, id: navId, href: navItem.getAttribute("href"), target: navPath, mediaType: "application/xhtml+xml" };
      manifestInfo.itemRecords.push(navRecord);
      manifestInfo.targetToRecord.set(navPath.toLowerCase(), navRecord);
      contentMap.set(navPath, { data: generateNavXhtml(navPath, title, language, spineRecords, contentMap), isText: true, sourcePath: navPath });
      addIssue("fixed", "Documento de navegação EPUB 3 criado.", navPath, "NAV_CREATED");
    } else {
      const navItem = contentMap.get(navRecord.target);
      const currentText = navItem?.isText ? navItem.data : "";
      if (!hasUsableNav(currentText)) {
        contentMap.set(navRecord.target, {
          data: generateNavXhtml(navRecord.target, title, language, spineRecords, contentMap),
          isText: true,
          sourcePath: navRecord.target
        });
        addIssue("fixed", "Documento NAV vazio ou inválido foi reconstruído.", navRecord.target, "NAV_REBUILT");
      }
      const properties = new Set((navRecord.element.getAttribute("properties") || "").split(/\s+/).filter(Boolean));
      if (!properties.has("nav")) {
        properties.add("nav");
        navRecord.element.setAttribute("properties", [...properties].join(" "));
        addIssue("fixed", "Propriedade nav adicionada ao item de navegação.", opfPath, "NAV_PROPERTY_ADDED");
      }
    }

    let ncxRecord = manifestInfo.itemRecords.find((record) => record.mediaType === "application/x-dtbncx+xml");
    if (!ncxRecord) {
      const ncxPath = makeUniqueContentPath(joinPath(dirname(opfPath), "toc.ncx"), contentMap);
      const ncxId = createUniqueId("ncx", manifestInfo.usedIds);
      const ncxItem = documentNode.createElementNS(manifest.namespaceURI || XMLNS_OPF, "item");
      ncxItem.setAttribute("id", ncxId);
      ncxItem.setAttribute("href", relativePath(dirname(opfPath), ncxPath));
      ncxItem.setAttribute("media-type", "application/x-dtbncx+xml");
      manifest.appendChild(ncxItem);
      ncxRecord = { element: ncxItem, id: ncxId, href: ncxItem.getAttribute("href"), target: ncxPath, mediaType: "application/x-dtbncx+xml" };
      manifestInfo.itemRecords.push(ncxRecord);
      manifestInfo.targetToRecord.set(ncxPath.toLowerCase(), ncxRecord);
      contentMap.set(ncxPath, { data: generateNcx(ncxPath, title, bookIdentifier, spineRecords, contentMap), isText: true, sourcePath: ncxPath });
      addIssue("fixed", "Sumário NCX criado para compatibilidade legada com Kindle.", ncxPath, "NCX_CREATED");
    } else {
      const ncxItem = contentMap.get(ncxRecord.target);
      const currentText = ncxItem?.isText ? ncxItem.data : "";
      if (!hasUsableNcx(currentText)) {
        contentMap.set(ncxRecord.target, {
          data: generateNcx(ncxRecord.target, title, bookIdentifier, spineRecords, contentMap),
          isText: true,
          sourcePath: ncxRecord.target
        });
        addIssue("fixed", "Sumário NCX vazio ou inválido foi reconstruído.", ncxRecord.target, "NCX_REBUILT");
      } else {
        ensureNcxPlayOrder(contentMap, ncxRecord.target);
      }
    }

    if (spine.getAttribute("toc") !== ncxRecord.id) {
      spine.setAttribute("toc", ncxRecord.id);
      addIssue("fixed", "Spine vinculado ao sumário NCX.", opfPath, "SPINE_TOC_FIXED");
    }

    return { navPath: navRecord.target, ncxPath: ncxRecord.target };
  }

  function ensureNcxPlayOrder(contentMap, ncxPath) {
    const ncxItem = contentMap.get(ncxPath);
    if (!ncxItem?.isText) return;
    const documentNode = parseXml(ncxItem.data);
    if (!documentNode) return;
    const navPoints = [...documentNode.getElementsByTagNameNS("*", "navPoint")];
    if (!navPoints.length || navPoints.every((navPoint) => navPoint.getAttribute("playOrder"))) return;
    navPoints.forEach((navPoint, index) => {
      navPoint.setAttribute("playOrder", String(index + 1));
    });
    ncxItem.data = serializeXmlDocument(documentNode);
    addIssue("fixed", "Atributo playOrder adicionado aos itens do sumário NCX para compatibilidade com o Kindle.", ncxPath, "NCX_PLAYORDER_ADDED");
  }

  function repairCoverMetadata(documentNode, metadata, manifest, manifestInfo, opfPath) {
    let coverRecord = manifestInfo.itemRecords.find((record) => /(?:^|\s)cover-image(?:\s|$)/.test(record.element.getAttribute("properties") || ""));
    const legacyMeta = [...metadata.getElementsByTagNameNS("*", "meta")].find((element) => (element.getAttribute("name") || "").toLowerCase() === "cover");

    if (!coverRecord && legacyMeta?.getAttribute("content")) {
      coverRecord = manifestInfo.itemRecords.find((record) => record.id === legacyMeta.getAttribute("content"));
    }

    if (!coverRecord) {
      const imageRecords = manifestInfo.itemRecords.filter((record) => record.mediaType.startsWith("image/") && record.mediaType !== "image/svg+xml");
      coverRecord = imageRecords.find((record) => /(^|[\/_-])(cover|capa)([\/_-]|\.|$)/i.test(record.target)) ||
        imageRecords.find((record) => /cover|capa/i.test(record.id));
    }

    if (!coverRecord) {
      addIssue("warning", "Nenhuma imagem de capa pôde ser identificada automaticamente.", opfPath, "COVER_NOT_FOUND");
      return;
    }

    const properties = new Set((coverRecord.element.getAttribute("properties") || "").split(/\s+/).filter(Boolean));
    if (!properties.has("cover-image")) {
      properties.add("cover-image");
      coverRecord.element.setAttribute("properties", [...properties].join(" "));
      addIssue("fixed", "Propriedade cover-image adicionada à imagem de capa.", coverRecord.target, "COVER_PROPERTY_ADDED");
    }

    if (legacyMeta) {
      if (legacyMeta.getAttribute("content") !== coverRecord.id) {
        legacyMeta.setAttribute("content", coverRecord.id);
        addIssue("fixed", "Metadado legado de capa corrigido.", opfPath, "COVER_META_FIXED");
      }
    } else {
      const meta = documentNode.createElementNS(metadata.namespaceURI || XMLNS_OPF, "meta");
      meta.setAttribute("name", "cover");
      meta.setAttribute("content", coverRecord.id);
      metadata.appendChild(meta);
      addIssue("fixed", "Metadado legado de capa adicionado para compatibilidade.", opfPath, "COVER_META_ADDED");
    }
  }

  function bookText(language, key, variables = {}) {
    // Usa o idioma declarado no próprio EPUB quando conhecido; senão cai no idioma da interface.
    const tag = language && language !== "und" ? language : null;
    if (i18n?.translateFor) return i18n.translateFor(tag, `book.${key}`, variables);
    return t(`book.${key}`, variables);
  }

  function generateNavXhtml(navPath, title, language, spineRecords, contentMap) {
    const links = spineRecords.map((record, index) => {
      const label = extractDocumentTitle(contentMap.get(record.target)?.data, record.target, index + 1);
      const href = relativePath(dirname(navPath), record.target);
      return `      <li><a href="${escapeXml(href)}">${escapeXml(label)}</a></li>`;
    }).join("\n");

    const tocLabel = bookText(language, "toc");
    const genericBook = bookText(language, "generic");
    const contentLabel = bookText(language, "content");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="${XMLNS_XHTML}" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(language || "und")}" xml:lang="${escapeXml(language || "und")}">\n<head>\n  <meta charset="UTF-8"/>\n  <title>${escapeXml(tocLabel)} — ${escapeXml(title || genericBook)}</title>\n</head>\n<body>\n  <nav epub:type="toc" id="toc">\n    <h1>${escapeXml(tocLabel)}</h1>\n    <ol>\n${links || `      <li>${escapeXml(contentLabel)}</li>`}\n    </ol>\n  </nav>\n</body>\n</html>\n`;
  }

  function generateNcx(ncxPath, title, identifier, spineRecords, contentMap) {
    const navPoints = spineRecords.map((record, index) => {
      const label = extractDocumentTitle(contentMap.get(record.target)?.data, record.target, index + 1);
      const src = relativePath(dirname(ncxPath), record.target);
      return `    <navPoint id="navPoint-${index + 1}" playOrder="${index + 1}">\n      <navLabel><text>${escapeXml(label)}</text></navLabel>\n      <content src="${escapeXml(src)}"/>\n    </navPoint>`;
    }).join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>\n<ncx xmlns="${XMLNS_NCX}" version="2005-1">\n  <head>\n    <meta name="dtb:uid" content="${escapeXml(identifier || `urn:uuid:${createUuid()}`)}"/>\n    <meta name="dtb:depth" content="1"/>\n    <meta name="dtb:totalPageCount" content="0"/>\n    <meta name="dtb:maxPageNumber" content="0"/>\n  </head>\n  <docTitle><text>${escapeXml(title || bookText("und", "generic"))}</text></docTitle>\n  <navMap>\n${navPoints}\n  </navMap>\n</ncx>\n`;
  }

  function validateFinalPackage(contentMap, opfPath, packageResult) {
    const containerItem = contentMap.get("META-INF/container.xml");
    if (!containerItem) addIssue("error", "META-INF/container.xml não existe no resultado.", "META-INF/container.xml", "FINAL_CONTAINER_MISSING");
    if (!contentMap.has(opfPath)) addIssue("error", "O OPF apontado pelo container não existe no resultado.", opfPath, "FINAL_OPF_MISSING");

    const opfItem = contentMap.get(opfPath);
    const documentNode = opfItem?.isText ? parseXml(opfItem.data) : null;
    if (!documentNode) {
      addIssue("error", "O OPF final não é XML válido.", opfPath, "FINAL_OPF_INVALID");
      return;
    }

    const manifest = findFirstByLocalName(documentNode, "manifest");
    const spine = findFirstByLocalName(documentNode, "spine");
    const manifestIds = new Set();
    const manifestTargets = new Set();

    for (const item of getDirectChildren(manifest, "item")) {
      const id = item.getAttribute("id") || "";
      const href = item.getAttribute("href") || "";
      const target = resolveExistingContentPath(opfPath, href, contentMap);
      if (!id) addIssue("error", "Item do manifesto sem ID.", opfPath, "FINAL_MANIFEST_ID_MISSING");
      if (manifestIds.has(id)) addIssue("error", `ID duplicado no manifesto: ${id}.`, opfPath, "FINAL_MANIFEST_ID_DUPLICATE", { id });
      manifestIds.add(id);
      if (!target) addIssue("error", "Manifesto ainda aponta para arquivo inexistente.", `${opfPath} → ${href}`, "FINAL_MANIFEST_TARGET_MISSING");
      if (target) manifestTargets.add(target.toLowerCase());
    }

    for (const itemref of getDirectChildren(spine, "itemref")) {
      const idref = itemref.getAttribute("idref") || "";
      if (!manifestIds.has(idref)) addIssue("error", `Spine aponta para ID inexistente: ${idref}.`, opfPath, "FINAL_SPINE_REFERENCE_MISSING", { idref });
    }

    for (const [path, item] of contentMap.entries()) {
      const extension = getExtension(path);
      if (item.isText && [".xhtml", ".svg", ".xml", ".opf", ".ncx"].includes(extension) && !parseXml(item.data)) {
        addIssue("warning", "Documento XML/XHTML inválido no resultado.", path, "FINAL_XML_INVALID");
      }
      if (path.length > 180) {
        addIssue("warning", "Caminho interno muito longo; alguns conversores podem falhar.", path, "LONG_INTERNAL_PATH");
      }
      if (item.data instanceof Uint8Array && item.data.byteLength > 25 * 1024 * 1024) {
        addIssue("warning", "Arquivo interno muito grande; considere otimizar mídia ou imagem.", path, "LARGE_INTERNAL_FILE");
      }
    }

    if (packageResult.navPath && !contentMap.has(packageResult.navPath)) {
      addIssue("error", "O documento NAV informado não existe.", packageResult.navPath, "FINAL_NAV_MISSING");
    }
    if (packageResult.ncxPath && !contentMap.has(packageResult.ncxPath)) {
      addIssue("error", "O documento NCX informado não existe.", packageResult.ncxPath, "FINAL_NCX_MISSING");
    }

    if (![...state.report].some((issue) => issue.level === "error")) {
      addIssue("info", "Validação estrutural final concluída sem erros bloqueantes.", opfPath, "FINAL_VALIDATION_OK");
    }
  }

  function finalizeWithoutOutput(fileCount, options) {
    state.outputBlob = null;
    state.reportDocument = createReportDocument({
      options,
      inputFile: state.inputFile,
      outputName: null,
      outputSize: null,
      fileCount,
      packageResult: null
    });
    showResults(fileCount, false);
  }

  function showResults(fileCount, hasOutput) {
    state.lastResult = { fileCount, hasOutput };
    dom.idleState.classList.add("hidden");
    dom.progressState.classList.add("hidden");
    dom.resultState.classList.remove("hidden");

    const stats = calculateStats();
    dom.errorCount.textContent = String(stats.errors);
    dom.warningCount.textContent = String(stats.warnings);
    dom.fixedCount.textContent = String(stats.fixed);
    dom.fileCount.textContent = String(fileCount);

    if (dom.scoreCard && dom.scoreValue && dom.scoreTier) {
      const score = computeCompatibilityScore(stats, hasOutput);
      dom.scoreValue.textContent = String(score.value);
      dom.scoreTier.textContent = t(`score.tier.${score.tierKey}`);
      dom.scoreCard.classList.remove("hidden", "score-excellent", "score-good", "score-fair", "score-low", "score-incompatible");
      dom.scoreCard.classList.add(`score-${score.tierKey}`);
    }

    dom.resultBanner.classList.remove("warning", "error");
    if (hasOutput && stats.errors === 0) {
      dom.resultTitle.textContent = t("result.successTitle");
      dom.resultText.textContent = t("result.successText");
      dom.downloadButton.classList.remove("hidden");
      if (dom.sendToKindleLink) dom.sendToKindleLink.classList.remove("hidden");
      if (dom.supportLink) dom.supportLink.classList.remove("hidden");
      showFilenameField();
    } else if (hasOutput) {
      dom.resultBanner.classList.add("warning");
      dom.resultTitle.textContent = t("result.warningTitle");
      dom.resultText.textContent = t("result.warningText");
      dom.downloadButton.classList.remove("hidden");
      if (dom.sendToKindleLink) dom.sendToKindleLink.classList.remove("hidden");
      if (dom.supportLink) dom.supportLink.classList.remove("hidden");
      showFilenameField();
    } else {
      dom.resultBanner.classList.add("error");
      dom.resultTitle.textContent = t("result.errorTitle");
      dom.resultText.textContent = t("result.errorText");
      dom.downloadButton.classList.add("hidden");
      if (dom.sendToKindleLink) dom.sendToKindleLink.classList.add("hidden");
      if (dom.supportLink) dom.supportLink.classList.add("hidden");
      if (dom.filenameField) dom.filenameField.classList.add("hidden");
    }
    if (dom.reportDetails) dom.reportDetails.open = !hasOutput || stats.errors > 0;
    renderReport();
  }

  function renderReport() {
    const filtered = state.report.filter((issue) => state.reportFilter === "all" || issue.level === state.reportFilter);
    if (filtered.length === 0) {
      dom.reportList.innerHTML = `<div class="empty-report">${escapeHtml(t("runtime.noItems"))}</div>`;
      return;
    }

    dom.reportList.innerHTML = filtered.map((issue) => {
      const symbol = issue.level === "error" ? "!" : issue.level === "warning" ? "△" : issue.level === "fixed" ? "✓" : "i";
      return `<article class="report-item ${issue.level}">
        <div class="report-dot" aria-hidden="true">${symbol}</div>
        <div class="report-copy">
          <strong>${escapeHtml(getIssueDisplayMessage(issue))}</strong>
          ${issue.file ? `<span>${escapeHtml(issue.file)}</span>` : ""}
        </div>
      </article>`;
    }).join("");
  }

  function getIssueDisplayMessage(issue) {
    const params = { ...(issue.params || {}) };

    if (issue.code === "PROCESSING_EXCEPTION") {
      return t("issue.PROCESSING_EXCEPTION", {
        reason: describeProcessingError(params.rawMessage || issue.message)
      });
    }

    if (issue.code === "OPF_REPAIR_FAILED") {
      const reason = params.reasonKey
        ? t(`error.${params.reasonKey}`)
        : translateInternalError(params.reason || issue.message);
      return t("issue.OPF_REPAIR_FAILED", { reason });
    }

    if (issue.code === "IDENTIFIER_ADDED") {
      return t(params.preserveIdentifier ? "issue.IDENTIFIER_ADDED_OBFUSCATED" : "issue.IDENTIFIER_ADDED");
    }

    if (issue.code === "MANIFEST_ID_FIXED") {
      return t(params.created ? "issue.MANIFEST_ID_CREATED" : "issue.MANIFEST_ID_RENAMED", params);
    }

    if (issue.code === "OUTPUT_READY" && Number.isFinite(params.size)) {
      params.size = formatBytes(params.size);
    }

    const key = `issue.${issue.code}`;
    return i18n?.has(key) ? t(key, params) : issue.message;
  }

  function translateInternalError(message) {
    const knownMessages = new Map([
      ["O arquivo OPF não existe no caminho indicado pelo container.", "opfMissingAtContainerPath"],
      ["O arquivo OPF contém XML inválido e não pôde ser interpretado.", "opfInvalidXml"],
      ["O documento OPF não contém o elemento package.", "opfMissingPackage"],
      ["OPF não encontrado.", "opfNotFound"],
      ["OPF inválido.", "opfInvalid"]
    ]);
    const key = knownMessages.get(String(message || ""));
    return key ? t(`error.${key}`) : String(message || "").trim();
  }

  function addIssue(level, message, file = "", code = "", params = {}) {
    state.report.push({
      level,
      message,
      file,
      code,
      params,
      timestamp: new Date().toISOString()
    });
  }

  function calculateStats() {
    return {
      errors: state.report.filter((issue) => issue.level === "error").length,
      warnings: state.report.filter((issue) => issue.level === "warning").length,
      fixed: state.report.filter((issue) => issue.level === "fixed").length,
      info: state.report.filter((issue) => issue.level === "info").length
    };
  }

  const HEAVY_WARNINGS = new Set([
    "REMOTE_RESOURCES", "LARGE_INTERNAL_FILE", "LONG_INTERNAL_PATH", "FINAL_XML_INVALID", "MALFORMED_XML"
  ]);

  function computeCompatibilityScore(stats, hasOutput) {
    if (!hasOutput) return { value: 0, tierKey: "incompatible" };
    let score = 100 - stats.errors * 20;
    for (const issue of state.report) {
      if (issue.level !== "warning") continue;
      score -= HEAVY_WARNINGS.has(issue.code) ? 8 : 4;
    }
    score = Math.max(5, Math.min(100, Math.round(score)));
    const tierKey = score >= 90 ? "excellent" : score >= 75 ? "good" : score >= 50 ? "fair" : "low";
    return { value: score, tierKey };
  }

  function localizedIssues() {
    return state.report.map((issue) => ({
      level: issue.level,
      message: getIssueDisplayMessage(issue),
      file: issue.file,
      code: issue.code,
      timestamp: issue.timestamp
    }));
  }

  function createReportDocument({ options, inputFile, outputName, outputSize, fileCount, packageResult }) {
    return {
      application: APP_NAME,
      version: APP_VERSION,
      language: i18n?.getLanguage() || "en",
      generatedAt: new Date().toISOString(),
      input: inputFile ? { name: inputFile.name, size: inputFile.size, type: inputFile.type || "application/epub+zip" } : null,
      output: outputName ? { name: outputName, size: outputSize, type: "application/epub+zip" } : null,
      options,
      summary: {
        ...calculateStats(),
        filesInOutput: fileCount,
        compatibilityScore: computeCompatibilityScore(calculateStats(), Boolean(outputName)).value
      },
      package: packageResult,
      issues: localizedIssues()
    };
  }

  function showFilenameField() {
    if (!dom.filenameField || !dom.outputFilenameInput) return;
    dom.outputFilenameInput.value = state.outputName || `${t("filename.defaultBook")}-${t("filename.fixedSuffix")}.epub`;
    dom.filenameField.classList.remove("hidden");
  }

  function resolveChosenOutputFilename() {
    const fallback = state.outputName || `${t("filename.defaultBook")}-${t("filename.fixedSuffix")}.epub`;
    const typed = dom.outputFilenameInput?.value?.trim();
    if (!typed) return fallback;
    const withExtension = /\.epub$/i.test(typed) ? typed : `${typed}.epub`;
    const safe = withExtension.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
    return safe.replace(/^\.+/, "") || fallback;
  }

  function downloadOutput() {
    if (!state.outputBlob) return;
    triggerBlobDownload(state.outputBlob, resolveChosenOutputFilename());
  }


  function downloadReport() {
    const baseDocument = state.reportDocument || createReportDocument({
      options: readOptions(), inputFile: state.inputFile, outputName: state.outputName || null,
      outputSize: state.outputBlob?.size || null, fileCount: state.lastResult?.fileCount || 0, packageResult: null
    });
    const reportDocument = {
      ...baseDocument,
      language: i18n?.getLanguage() || "en",
      generatedAt: new Date().toISOString(),
      issues: localizedIssues()
    };
    const blob = new Blob([JSON.stringify(reportDocument, null, 2)], { type: "application/json;charset=utf-8" });
    const base = (state.inputFile?.name || "epub").replace(/\.epub$/i, "");
    triggerBlobDownload(blob, `${sanitizeDownloadBase(base)}-${t("filename.reportSuffix")}.json`);
  }

  const SAVE_PICKER_TYPES = {
    ".epub": { description: "EPUB", accept: { "application/epub+zip": [".epub"] } },
    ".json": { description: "JSON", accept: { "application/json": [".json"] } }
  };

  async function triggerBlobDownload(blob, filename) {
    if (typeof window.showSaveFilePicker === "function") {
      const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase();
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: SAVE_PICKER_TYPES[extension] ? [SAVE_PICKER_TYPES[extension]] : undefined
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function buildOutputName(inputName) {
    const base = inputName.replace(/\.epub$/i, "");
    return `${sanitizeDownloadBase(base)}-${t("filename.fixedSuffix")}.epub`;
  }

  function sanitizeDownloadBase(value) {
    const clean = value.normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "");
    return clean || t("filename.defaultBook");
  }

  function describeProcessingError(errorOrMessage) {
    const message = errorOrMessage instanceof Error ? errorOrMessage.message : String(errorOrMessage || "");
    if (message === "EMPTY_ZIP") return t("error.emptyZip");
    if (/crc32/i.test(message)) return t("error.crc");
    if (/zip/i.test(message) || /central directory/i.test(message)) return t("error.invalidZip");
    return t("error.processing", { message });
  }

  function decodeText(bytes) {
    let encoding = "utf-8";
    let offset = 0;
    let convertedEncoding = false;

    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      encoding = "utf-8";
      offset = 3;
    } else if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      encoding = "utf-16le";
      offset = 2;
      convertedEncoding = true;
    } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      encoding = "utf-16be";
      offset = 2;
      convertedEncoding = true;
    } else {
      const probe = new TextDecoder("windows-1252").decode(bytes.slice(0, 300));
      const match = probe.match(/encoding\s*=\s*["']\s*([^"']+)\s*["']/i) || probe.match(/charset\s*=\s*["']?\s*([^\s"';/>]+)/i);
      if (match) {
        const declared = match[1].toLowerCase();
        if (!["utf-8", "utf8", "us-ascii", "ascii"].includes(declared)) {
          encoding = declared;
          convertedEncoding = true;
        }
      }
    }

    let decoder;
    try {
      decoder = new TextDecoder(encoding, { fatal: false });
    } catch {
      encoding = "windows-1252";
      decoder = new TextDecoder(encoding, { fatal: false });
      convertedEncoding = true;
    }

    let text = decoder.decode(bytes.slice(offset));
    text = text.replace(/^\uFEFF/, "");
    text = text.replace(/<\?xml([^>]*?)encoding\s*=\s*["'][^"']+["']([^>]*?)\?>/i, '<?xml$1encoding="UTF-8"$2?>');
    return { text, sourceEncoding: encoding, convertedEncoding };
  }

  function parseXml(text) {
    try {
      const documentNode = new DOMParser().parseFromString(String(text), "application/xml");
      if (documentNode.getElementsByTagName("parsererror").length > 0) return null;
      return documentNode;
    } catch {
      return null;
    }
  }

  function serializeXmlDocument(documentNode) {
    let text = new XMLSerializer().serializeToString(documentNode);
    text = text.replace(/^<\?xml[^>]*\?>\s*/i, "");
    return `<?xml version="1.0" encoding="UTF-8"?>\n${text}\n`;
  }

  function replaceUnsafeNamedEntities(text) {
    const entities = {
      nbsp: "&#160;", copy: "&#169;", reg: "&#174;", trade: "&#8482;", hellip: "&#8230;",
      ndash: "&#8211;", mdash: "&#8212;", lsquo: "&#8216;", rsquo: "&#8217;",
      ldquo: "&#8220;", rdquo: "&#8221;", bull: "&#8226;", euro: "&#8364;"
    };
    return text.replace(/&([A-Za-z][A-Za-z0-9]+);/g, (full, name) => entities[name] || full);
  }

  function ensureXhtmlNamespace(text) {
    if (!/<html\b/i.test(text)) return text;
    let output = text;
    if (!/<html\b[^>]*\bxmlns\s*=/i.test(output)) {
      output = output.replace(/<html\b/i, `<html xmlns="${XMLNS_XHTML}"`);
    }
    return output;
  }

  function applyReducedMargins(text, level = "reduced") {
    const padding = level === "mini" ? "0" : "0 2%";
    const marginStyle = `<style type="text/css">html,body{margin:0 !important;padding:${padding} !important;}</style>`;
    if (/<\/head>/i.test(text)) {
      return text.replace(/<\/head>/i, `${marginStyle}</head>`);
    }
    if (/<head\b[^>]*>/i.test(text)) {
      return text.replace(/(<head\b[^>]*>)/i, `$1${marginStyle}`);
    }
    if (/<html\b[^>]*>/i.test(text)) {
      return text.replace(/(<html\b[^>]*>)/i, `$1<head>${marginStyle}</head>`);
    }
    return text;
  }

  function hasUsableNav(text) {
    if (!text) return false;
    const documentNode = parseXml(text);
    if (!documentNode) return false;
    const navElements = [...documentNode.getElementsByTagNameNS("*", "nav")];
    return navElements.some((nav) => nav.getElementsByTagNameNS("*", "a").length > 0);
  }

  function hasUsableNcx(text) {
    if (!text) return false;
    const documentNode = parseXml(text);
    if (!documentNode) return false;
    return documentNode.getElementsByTagNameNS("*", "navPoint").length > 0;
  }

  function collectSpineRecords(spine, records) {
    const byId = new Map(records.map((record) => [record.id, record]));
    return getDirectChildren(spine, "itemref")
      .map((itemref) => byId.get(itemref.getAttribute("idref") || ""))
      .filter((record) => record && isDocumentMediaType(record.mediaType));
  }

  function extractDocumentTitle(text, path, fallbackIndex) {
    if (typeof text === "string") {
      const documentNode = parseXml(text);
      if (documentNode) {
        const candidates = ["h1", "h2", "title"];
        for (const tag of candidates) {
          const element = findFirstByLocalName(documentNode, tag);
          const value = getElementText(element);
          if (value) return normalizeWhitespace(value).slice(0, 180);
        }
      }
      const titleMatch = text.match(/<(?:h1|h2|title)\b[^>]*>([\s\S]*?)<\/(?:h1|h2|title)>/i);
      if (titleMatch) {
        const value = normalizeWhitespace(stripTags(titleMatch[1]));
        if (value) return value.slice(0, 180);
      }
    }
    const stem = stemName(path).replace(/[-_]+/g, " ").trim();
    return stem || t("book.section", { number: fallbackIndex });
  }

  function shouldAddToManifest(path, opfPath) {
    if (path === opfPath || path === "mimetype") return false;
    if (path.toLowerCase().startsWith("meta-inf/")) return false;
    return MANIFEST_EXTENSIONS.has(getExtension(path));
  }

  function resolveExistingContentPath(opfPath, href, contentMap) {
    if (!href || isExternalReference(href)) return null;
    const { pathPart } = splitReference(decodeXmlAttribute(href));
    const direct = normalizePackagePath(joinPath(dirname(opfPath), pathPart));
    if (contentMap.has(direct)) return direct;
    const lower = direct.toLowerCase();
    return [...contentMap.keys()].find((path) => path.toLowerCase() === lower) || null;
  }

  function makeUniqueContentPath(desiredPath, contentMap) {
    if (!contentMap.has(desiredPath)) return desiredPath;
    const occupied = new Set([...contentMap.keys()].map((path) => path.toLowerCase()));
    return makeUniquePath(desiredPath, occupied);
  }

  function isDocumentMediaType(mediaType) {
    return mediaType === "application/xhtml+xml" || mediaType === "text/html";
  }

  function mediaTypeForPath(path) {
    return MEDIA_TYPES[getExtension(path)] || "";
  }

  function createUniqueId(seed, usedIds) {
    let base = String(seed || "item")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9_.-]+/g, "-")
      .replace(/^[^A-Za-z_]+/, "")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "") || "item";
    if (!usedIds.has(base)) {
      usedIds.add(base);
      return base;
    }
    let counter = 2;
    while (usedIds.has(`${base}-${counter}`)) counter += 1;
    const id = `${base}-${counter}`;
    usedIds.add(id);
    return id;
  }

  function collectXmlIds(documentNode) {
    const ids = new Set();
    for (const element of documentNode.getElementsByTagName("*")) {
      const id = element.getAttribute("id");
      if (id) ids.add(id);
    }
    return ids;
  }

  function findFirstByLocalName(root, localName) {
    if (!root) return null;
    if (root.nodeType === Node.ELEMENT_NODE && root.localName === localName) return root;
    const elements = root.getElementsByTagNameNS ? root.getElementsByTagNameNS("*", localName) : [];
    return elements[0] || null;
  }

  function findDirectChild(parent, localName) {
    return getDirectChildren(parent, localName)[0] || null;
  }

  function getDirectChildren(parent, localName) {
    if (!parent) return [];
    return [...parent.childNodes].filter((node) => node.nodeType === Node.ELEMENT_NODE && (!localName || node.localName === localName));
  }

  function getElementText(element) {
    return normalizeWhitespace(element?.textContent || "");
  }

  function buildPathLookup(paths) {
    const lookup = new Map();
    for (const path of paths) {
      for (const candidate of pathVariants(path)) {
        if (!lookup.has(candidate)) lookup.set(candidate, path);
      }
    }
    return lookup;
  }

  function lookupPath(lookup, path) {
    for (const candidate of pathVariants(path)) {
      const found = lookup.get(candidate);
      if (found) return found;
    }
    return null;
  }

  function findPathLoosely(paths, path) {
    return lookupPath(buildPathLookup(paths), path);
  }

  function pathVariants(path) {
    const normalized = normalizePackagePath(path);
    const decoded = normalizePackagePath(iterativeDecode(path));
    const encodedSpaces = normalized.replace(/ /g, "%20");
    const literalPercent = normalized.replace(/%25/gi, "%");
    return new Set([
      normalized,
      decoded,
      encodedSpaces,
      literalPercent,
      normalized.toLowerCase(),
      decoded.toLowerCase(),
      encodedSpaces.toLowerCase(),
      literalPercent.toLowerCase()
    ]);
  }

  function iterativeDecode(value) {
    let output = String(value || "");
    for (let iteration = 0; iteration < 3; iteration += 1) {
      try {
        const decoded = decodeURIComponent(output);
        if (decoded === output) break;
        output = decoded;
      } catch {
        break;
      }
    }
    return output;
  }

  function splitReference(reference) {
    const hashIndex = reference.indexOf("#");
    const queryIndex = reference.indexOf("?");
    let cutIndex = reference.length;
    if (hashIndex >= 0) cutIndex = Math.min(cutIndex, hashIndex);
    if (queryIndex >= 0) cutIndex = Math.min(cutIndex, queryIndex);
    return { pathPart: reference.slice(0, cutIndex), suffix: reference.slice(cutIndex) };
  }

  function isExternalReference(reference) {
    return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(reference) || reference.startsWith("//") || reference.startsWith("data:");
  }

  function decodeXmlAttribute(value) {
    return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  }

  function encodeXmlAttribute(value, originalValue) {
    let output = value.replace(/&/g, "&amp;");
    if (originalValue.includes("&quot;")) output = output.replace(/"/g, "&quot;");
    if (originalValue.includes("&apos;")) output = output.replace(/'/g, "&apos;");
    return output;
  }

  function normalizeSlashes(value) {
    return String(value || "").replace(/\\+/g, "/").replace(/\/{2,}/g, "/");
  }

  function joinPath(...parts) {
    return normalizePackagePath(parts.filter(Boolean).join("/"));
  }

  function dirname(path) {
    const normalized = normalizePackagePath(path);
    const index = normalized.lastIndexOf("/");
    return index >= 0 ? normalized.slice(0, index) : "";
  }

  function basename(path) {
    const normalized = normalizePackagePath(path);
    const index = normalized.lastIndexOf("/");
    return index >= 0 ? normalized.slice(index + 1) : normalized;
  }

  function relativePath(fromDirectory, toPath) {
    const from = normalizePackagePath(fromDirectory).split("/").filter(Boolean);
    const to = normalizePackagePath(toPath).split("/").filter(Boolean);
    let common = 0;
    while (common < from.length && common < to.length && from[common] === to[common]) common += 1;
    const up = Array(from.length - common).fill("..");
    const down = to.slice(common);
    return [...up, ...down].join("/") || basename(toPath);
  }

  function getExtension(path) {
    const name = basename(path);
    const index = name.lastIndexOf(".");
    return index > 0 ? name.slice(index).toLowerCase() : "";
  }

  function stemName(path) {
    const name = basename(path);
    const extension = getExtension(name);
    return extension ? name.slice(0, -extension.length) : name;
  }

  function isJunkPath(path) {
    return JUNK_PATTERNS.some((pattern) => pattern.test(normalizeSlashes(path)));
  }

  function compareEpubPaths(left, right) {
    const priority = (path) => {
      if (path === "META-INF/container.xml") return 0;
      if (path.startsWith("META-INF/")) return 1;
      if (getExtension(path) === ".opf") return 2;
      return 3;
    };
    return priority(left) - priority(right) || left.localeCompare(right, "en", { numeric: true, sensitivity: "base" });
  }

  function findExactZipName(zip, normalizedPath) {
    return Object.keys(zip.files).find((name) => normalizeSlashes(name) === normalizedPath) || normalizedPath;
  }

  function createUuid() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    globalThis.crypto?.getRandomValues?.(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function stripTags(value) {
    return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ");
  }

  function normalizeWhitespace(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function escapeXml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function escapeHtml(value) {
    return escapeXml(value);
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "—";
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** index);
    const maximumFractionDigits = index === 0 || value >= 10 ? 0 : 1;
    const locale = i18n?.getLocale?.() || "en-US";
    const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
    return `${formatted} ${units[index]}`;
  }

  if (globalThis.__KEF_TEST_MODE__) {
    globalThis.__KEF_TEST_API__ = {
      state,
      selectFile,
      repairSelectedFile,
      readOptions,
      createPathMap,
      normalizePackagePath,
      sanitizePackagePath,
      rewriteAllInternalReferences,
      repairContainer,
      repairTextDocuments,
      repairPackageDocument,
      validateFinalPackage,
      parseXml,
      mediaTypeForPath
    };
  } else {
    initialize();
  }
})();
