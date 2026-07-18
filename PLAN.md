# Plano de implementação — 3 features

Features a implementar:
- **6. Persistir preferências** (localStorage): salvar opções de correção + idioma.
- **7. Prévia antes/depois** (1º capítulo, foco em margens): iframe protegido com toggle.
- **9. Nota de compatibilidade** (score 0–100) no resultado e no JSON.

## Regras do projeto
- **Editar sempre na raiz** (`index.html`, `app.js`, `i18n.js`, `styles.css`). `deploy.cmd` sobrescreve `public/` a partir da raiz.
- `app.js` é uma IIFE. Âncoras úteis:
  - `state` (`app.js:114`), `optionIds` (`app.js:109`), `initialize()` (`app.js:125`)
  - `readOptions()` (`app.js:332`), `useRecommendedOptions()` (`app.js:312`), `bindExclusiveMarginOptions()` (`app.js:235`)
  - `selectFile()` (`app.js:267`), `clearSelectedFile()` (`app.js:293`)
  - `showResults()` (`app.js:410`), `calculateStats()` (`app.js:1525`), `createReportDocument()` (`app.js:1544`), `refreshLocalizedInterface()` (`app.js:251`)
  - `applyReducedMargins(text, level)` (`app.js:1727`) — reutilizar na prévia
  - helpers reutilizáveis: `parseXml`, `decodeText`, `findFirstByLocalName`, `getDirectChildren`, `dirname`, `relativePath`, `joinPath`, `normalizePackagePath`, `getExtension`, `escapeXml`, `locateOriginalOpf` (`app.js:622`)
- `i18n.js`: 21 blocos em `translations` (pt `:35`, en `:233`, … nl `:3995`). Chaves achatadas. Fallback por-chave pro inglês em `translateWith` (`:4232`). **Toda chave nova entra nos 21 blocos.**

---

## Feature 6 — Persistir preferências (localStorage)

**app.js** — wrappers seguros (funciona em `file://` e modo anônimo):

```js
const STORAGE_KEYS = { options: "kef.options", lang: "kef.lang" };

function safeStorageGet(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function safeStorageSet(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* indisponível */ }
}

function persistOptions() {
  safeStorageSet(STORAGE_KEYS.options, JSON.stringify(readOptions()));
}
function applyStoredOptions() {
  const raw = safeStorageGet(STORAGE_KEYS.options);
  if (!raw) return;
  let saved; try { saved = JSON.parse(raw); } catch { return; }
  for (const id of optionIds) {
    const el = document.getElementById(id);
    if (el && typeof saved[id] === "boolean" && !el.disabled) el.checked = saved[id];
  }
  const mini = document.getElementById("miniMargins");
  const reduce = document.getElementById("reduceMargins");
  if (mini?.checked && reduce) reduce.checked = false; // mini vence reduzidas
}
```

Ligar em `initialize()` (perto de `app.js:181`, antes de `bindExclusiveMarginOptions()`):
```js
applyStoredOptions();
for (const id of optionIds) {
  document.getElementById(id)?.addEventListener("change", persistOptions);
}
bindExclusiveMarginOptions();
```
Em `useRecommendedOptions()` (`app.js:312`), no fim: `persistOptions();`.

**Idioma** — prioridade `?lang=` > localStorage > navegador. Em `initialize()` (`app.js:127`) trocar `applyLanguageFromUrl();` por:
```js
if (!applyLanguageFromUrl()) applyStoredLanguage();
```
- `applyLanguageFromUrl()` (`app.js:186`): retornar `true` quando aplicou via URL, `false` caso contrário.
- `applyStoredLanguage()` novo: lê `kef.lang`; se suportado, `i18n?.setLanguage(code)` **sem** mexer em `urlLanguageParamActive` nem na URL (preserva canonical de SEO).
- Listener do seletor (`app.js:131`): adicionar `safeStorageSet(STORAGE_KEYS.lang, dom.languageSelect.value);`.

Sem mudança de HTML/CSS/i18n.

---

## Feature 7 — Prévia antes/depois (1º capítulo, foco em margens)

**index.html** — botão perto de `repairButton` (`:184`):
```html
<button id="previewButton" class="secondary-button hidden" type="button">
  <span aria-hidden="true">👁</span>
  <span data-i18n="button.preview">Ver prévia das margens</span>
</button>
```
Overlay antes de `</main>` (`:311`):
```html
<div id="previewOverlay" class="preview-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="preview-title">
  <div class="preview-dialog">
    <header class="preview-head">
      <strong id="preview-title" data-i18n="preview.title">Prévia do primeiro capítulo</strong>
      <button id="previewClose" class="icon-button" type="button" data-i18n-aria-label="preview.close" aria-label="Fechar">×</button>
    </header>
    <div class="preview-modes" role="group" data-i18n-aria-label="preview.modesLabel" aria-label="Modo de margem">
      <button class="preview-mode active" data-mode="original" type="button" data-i18n="preview.original">Original</button>
      <button class="preview-mode" data-mode="reduced" type="button" data-i18n="preview.reduced">Margens reduzidas</button>
      <button class="preview-mode" data-mode="mini" type="button" data-i18n="preview.mini">Mini-margens</button>
    </div>
    <div id="previewBody" class="preview-body"><iframe id="previewFrame" sandbox="" title="Prévia"></iframe></div>
    <p id="previewNote" class="preview-note" data-i18n="preview.note">Prévia aproximada, sem scripts. O Kindle pode renderizar de forma diferente.</p>
  </div>
</div>
```

**app.js**
- Registrar refs no objeto `dom` e mostrar `previewButton` em `selectFile()` (`app.js:285`, `classList.remove("hidden")`); esconder em `clearSelectedFile()` (`app.js:302`).
- Handlers em `initialize()`: `previewButton→openPreview`, `previewClose`/backdrop/`Esc`→fechar, `.preview-mode`→`setPreviewMode`.

```js
let previewState = { baseHtml: null };

async function openPreview() {
  if (!state.inputFile) return;
  const chapter = await extractFirstChapter(state.inputFile); // {html} ou null
  if (!chapter) { window.alert(t("preview.unavailable")); return; }
  previewState.baseHtml = chapter.html;
  setPreviewMode("original");
  dom.previewOverlay.classList.remove("hidden");
}

function setPreviewMode(mode) {
  const html = mode === "original" ? previewState.baseHtml
    : applyReducedMargins(previewState.baseHtml, mode === "mini" ? "mini" : "reduced");
  dom.previewFrame.srcdoc = html;
  document.querySelectorAll(".preview-mode")
    .forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
}

function bytesToDataUrl(bytes, mime) {
  let bin = ""; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  return `data:${mime};base64,${btoa(bin)}`;
}
```

`extractFirstChapter(file)` — **NÃO chama `addIssue`** (não polui `state.report`). Passos:
1. `const zip = await JSZip.loadAsync(file)`; montar `sourcePaths` como em `app.js:384`.
2. `findOpfPathQuiet(zip, paths)`: mesma lógica de `locateOriginalOpf` (`app.js:622`) **sem** os `addIssue` (parse do `container.xml` → `full-path`; fallback pro único `.opf`).
3. Parsear OPF (`decodeText`/`parseXml`); mapa `id → {href, mediaType}` dos `<item>` (`getDirectChildren(manifest,"item")`); 1º `<itemref idref>` do spine cujo item seja `application/xhtml+xml`.
4. Resolver caminho do capítulo: `normalizePackagePath(joinPath(dirname(opfPath), href))`; ler texto com `decodeText`.
5. **CSS**: achar `<link rel="stylesheet" href>`, resolver cada, ler texto, concatenar; remover os `<link>` do HTML e injetar tudo num `<style>` no `<head>`.
6. **Imagens** (melhor esforço, cap ~2 MB/imagem, `try/catch` por recurso): `<img src>`, `<image xlink:href>` e `url(...)` no CSS → resolver caminho, ler bytes, `bytesToDataUrl`.
7. Retornar `{ html }` auto-contido. **iframe `sandbox=""`** (sem `allow-scripts`/`allow-same-origin`) tem origem opaca → **tudo inline via `data:`** (blob URL não funciona). Falha em qualquer passo → retornar `null`.

**styles.css**:
```css
.preview-overlay { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 20px; background: rgba(3,6,12,.72); backdrop-filter: blur(6px); }
.preview-dialog { width: min(880px, 100%); max-height: 90vh; display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel-strong); box-shadow: var(--shadow); overflow: hidden; }
.preview-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--line); }
.preview-modes { display: flex; gap: 6px; flex-wrap: wrap; padding: 12px 18px; }
.preview-mode { border: 1px solid var(--line); border-radius: 9px; padding: 6px 12px; background: transparent; color: var(--muted); cursor: pointer; font-size: .82rem; }
.preview-mode.active, .preview-mode:hover { color: #fff; border-color: rgba(167,139,250,.45); background: rgba(124,58,237,.12); }
.preview-body { flex: 1; min-height: 0; padding: 0 18px; }
.preview-body iframe { width: 100%; height: 60vh; border: 0; border-radius: 12px; background: #fff; }
.preview-note { margin: 0; padding: 12px 18px; color: var(--muted); font-size: .78rem; }
```

---

## Feature 9 — Nota de compatibilidade (score)

**app.js**:
```js
const HEAVY_WARNINGS = new Set(["REMOTE_RESOURCES","LARGE_INTERNAL_FILE","LONG_INTERNAL_PATH","FINAL_XML_INVALID","MALFORMED_XML"]);

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
```
- Em `showResults()` (`app.js:410`), após `calculateStats()` (`:1416`): calcular score, preencher `#scoreValue`/`#scoreTier` (rótulo `t("score.tier." + tierKey)`), aplicar classe de cor (`score-excellent`/`good`/`fair`/`low`/`incompatible`), remover `hidden` de `#scoreCard`. Guardar em `state.lastResult` (sobrevive à troca de idioma via `refreshLocalizedInterface`, `app.js:251`).
- Em `createReportDocument()` (`app.js:1544`), no `summary`: `compatibilityScore: computeCompatibilityScore(calculateStats(), Boolean(outputName)).value`.

**index.html** — acima do `resultBanner` (`:158`), dentro de `resultState`:
```html
<div id="scoreCard" class="score-card hidden">
  <div class="score-ring"><span id="scoreValue">0</span><small>/100</small></div>
  <div class="score-copy">
    <strong data-i18n="score.title">Nota de compatibilidade</strong>
    <span id="scoreTier"></span>
  </div>
</div>
```

**styles.css** — badge com anel colorido por tier (verde `--success` / amarelo `--warning` / vermelho `--danger`); fundo sólido por classe de tier ou `conic-gradient`.

---

## i18n — chaves novas nos 21 idiomas

Adicionar a **cada** bloco de `translations` (`i18n.js`). Referência pt/en:

| chave | pt | en |
|---|---|---|
| `button.preview` | Ver prévia das margens | Preview margins |
| `preview.title` | Prévia do primeiro capítulo | First chapter preview |
| `preview.close` | Fechar | Close |
| `preview.modesLabel` | Modo de margem | Margin mode |
| `preview.original` | Original | Original |
| `preview.reduced` | Margens reduzidas | Reduced margins |
| `preview.mini` | Mini-margens | Mini margins |
| `preview.note` | Prévia aproximada, sem scripts. O Kindle pode renderizar de forma diferente. | Approximate preview, no scripts. Kindle may render differently. |
| `preview.unavailable` | Não foi possível gerar a prévia deste EPUB. | Could not generate a preview for this EPUB. |
| `score.title` | Nota de compatibilidade | Compatibility score |
| `score.tier.excellent` | Excelente | Excellent |
| `score.tier.good` | Bom | Good |
| `score.tier.fair` | Regular | Fair |
| `score.tier.low` | Baixo | Low |
| `score.tier.incompatible` | Incompatível | Incompatible |

---

## Ordem e testes

1. **Feature 6** → marcar mini-margens, recarregar (persiste); trocar idioma, recarregar (mantém).
2. **Feature 9** → EPUB limpo (nota alta), com avisos (média), com erro/sem output (incompatível); conferir `compatibilityScore` no JSON.
3. **Feature 7** → EPUB com CSS+imagens: prévia abre, toggle muda texto, imagens aparecem, `Esc`/backdrop fecham, EPUB inválido → `preview.unavailable`.

**Cuidados:**
- Prévia: `sandbox=""` exige tudo inline em `data:` (blob URL não funciona com origem opaca). Cap de tamanho por imagem + `try/catch` por recurso.
- `applyReducedMargins()` já injeta `<style>` no `<head>` — reutilizar garante paridade com o resultado real.
- localStorage sempre via `safeStorage*` (roda em `file://` e modo anônimo).
- Score/prévia: preservar estado em `state.lastResult` para a troca de idioma re-renderizar sem reprocessar.
