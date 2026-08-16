# CLAUDE.md

Orientações para o Claude Code trabalhar neste repositório.

## Visão geral

**Kindle EPUB Fix** — aplicação web 100% client-side que diagnostica, corrige e reconstrói arquivos EPUB visando compatibilidade com o **Send to Kindle**. Não há backend: o EPUB nunca sai do navegador. Publicada em Firebase Hosting (`https://kindle-epub-fix.web.app`).

Sem build step, sem npm, sem framework. JavaScript puro (IIFE, `"use strict"`), única dependência é `vendor/jszip.min.js`.

Funcionalidades principais: fila de arquivos (modo em lote, cada arquivo com suas próprias opções), 12 correções opcionais, prévia do livro em iframe antes de reparar, nota de compatibilidade, relatório JSON e sumário reconstruído com divisão de capítulos gigantescos.

## Regra crítica: editar na raiz, nunca em `public/`

Os arquivos da aplicação existem em duas cópias:

- **Raiz** (`index.html`, `app.js`, `i18n.js`, `styles.css`, `sitemap.txt`, `robots.txt`, `vendor/`) — **fonte da verdade, edite aqui**.
- **`public/`** — espelho de deploy. `deploy.cmd` sobrescreve `public/` a partir da raiz antes de publicar. Qualquer edição feita diretamente em `public/` é perdida.

Commits que sincronizam o espelho aparecem no histórico como `Sync public/ mirror with latest root changes`.

## Comandos

```cmd
:: Rodar localmente — basta abrir o arquivo, funciona em file://
start index.html

:: Copiar raiz -> public/ e publicar no Firebase Hosting
deploy.cmd
```

O `deploy.cmd` também apaga `sitemap.xml` da raiz e de `public/` (e aborta se sobrar
algum), porque o sitemap publicado hoje é o `sitemap.txt`.

O projeto não usa Node em nenhuma etapa obrigatória. `tools/generate-sitemap.js`
continua no repositório, mas gera o antigo `sitemap.xml` multilíngue e **não é mais
chamado pelo deploy** — está morto até que o sitemap XML volte a ser usado.

Não há testes automatizados. Validação é manual — o roteiro mínimo depois de qualquer mudança em `app.js`:

1. Abrir `index.html` direto no navegador (Chrome/Edge/Firefox) e conferir o console sem erros.
2. Arrastar `Bom dia inverno (Tamara Klink) RUIM.epub` (EPUB problemático de referência, na raiz — **não versionado**, `*.epub` está no `.gitignore`) e rodar **Analisar e reparar**.
3. Abrir a **prévia** antes de reparar e alternar os três modos de margem.
4. Conferir a lista de diagnósticos, a nota de compatibilidade e o sumário reconstruído.
5. Baixar o EPUB corrigido e o relatório JSON; verificar que o JSON saiu no idioma selecionado.
6. Trocar o idioma no seletor e reconferir a tela — chaves faltando aparecem como o nome cru da chave.

Para testar o modo em lote, repetir com dois ou mais arquivos selecionados de uma vez, mudando as opções de um arquivo só e conferindo que os outros não são afetados.

O `.csproj`/`.slnx` existem apenas para dar uma solution ao Visual Studio (`net10.0`, `EnableDefaultItems=false`). Não compilam código da aplicação — não é necessário rodar `dotnet build`.

## Arquitetura

| Arquivo | Papel |
| --- | --- |
| `index.html` | Marcação (~310 linhas), IDs dos controles, metadados SEO multilíngues |
| `app.js` | Toda a lógica (~3.100 linhas): leitura do ZIP, diagnósticos, correções, reconstrução, prévia, UI |
| `i18n.js` | Tabela de traduções (~4.950 linhas) + `LANGUAGE_META` |
| `styles.css` | Estilos |
| `vendor/jszip.min.js` | Leitura/escrita de ZIP |

`app.js` é uma IIFE única, sem módulos. Não há framework: o DOM é acessado por um objeto `dom` montado uma vez com `getElementById`, então **todo controle novo no `index.html` precisa de um `id` e de uma entrada em `dom`** — exceto as checkboxes de opção, que são lidas direto por `document.getElementById(id)` a partir de `optionIds`.

### Estado

- `jobs` — array de *jobs*, um por arquivo selecionado (`createJob()`). Cada job carrega `inputFile`, `options`, `customName`, `outputBlob`, `report`, `reportDocument`, `lastResult`, `status` (`pending` / `success` / `warning` / `error`).
- `state` — ponteiro para o job **ativo** (`setActiveJob()`), não um objeto de estado global. Funções como `addIssue()` e `calculateStats()` escrevem/leem implicitamente no job ativo, então trocar `state` no meio de um fluxo redireciona os efeitos colaterais.
- **As opções são por arquivo.** As checkboxes refletem sempre o job ativo; `onOptionChanged()` grava em `state.options` e, se o job já tinha sido processado, `resetJobResult()` o devolve para `pending`. `applyOptionsToAllJobs()` propaga as opções atuais para a fila inteira. O `localStorage` guarda só o último conjunto usado, como padrão para arquivos novos.
- `previewState` — zip aberto, lista de capítulos, cache de HTML e modo de margem da prévia.

### Opções de reparo

`optionIds` lista as **12** checkboxes: `reduceMargins`, `miniMargins` (mutuamente exclusivas, ver `bindExclusiveMarginOptions()`), `normalizePaths`, `removeJunk`, `repairPackage`, `repairNavigation`, `rebuildChapters`, `repairText`, `repairCover`, `addUnlisted`, `removeMissing`, `stripScripts`.

Uma opção nova precisa entrar em **três** lugares, senão fica meio funcional:

1. `optionIds` — habilita `readOptions()`, `persistOptions()`, `applyStoredOptions()`, `optionsDiffer()`.
2. O objeto `recommended` em `useRecommendedOptions()` — o botão "opções recomendadas" define explicitamente cada chave.
3. `index.html` com o `id` igual ao nome da opção.

### Pipeline de reparo

`repairJob(job)` é o orquestrador; `repairAllFiles()` apenas itera os jobs em lote. A ordem das etapas importa (cada uma assume o resultado da anterior) e é espelhada na barra de progresso:

`abrir ZIP` → `inspectEncryption` (DRM/ofuscação) → `locateOriginalOpf` → filtrar lixo (`isJunkPath`, se `removeJunk`) → `createPathMap` → ler e decodificar conteúdo (`decodeText`) → `rewriteAllInternalReferences` → `repairContainer` → `repairTextDocuments` → `repairPackageDocument` (manifest, spine, capa, navegação) ou `inspectPackageDocument` quando `repairPackage` está desligado → `validateFinalPackage` → regravar o ZIP → `createReportDocument`.

Saídas antecipadas, todas via `finalizeWithoutOutput()` e sem gerar EPUB: DRM bloqueante (`DRM_BLOCKED`), OPF não encontrado (`OPF_NOT_FOUND`) e falha no reparo do pacote (`OPF_REPAIR_FAILED`). Qualquer exceção vira `PROCESSING_EXCEPTION` e ainda produz relatório.

### Reconstrução do sumário e divisão de capítulos

Com `rebuildChapters` ligado, `expandNavigationFromChapters()` regenera `nav.xhtml` e `toc.ncx` a partir do spine. Antes de rotular, `splitHugeChapter()` decide a divisão de cada capítulo: em capítulos muito longos ele **injeta âncoras (`id`) nos parágrafos de quebra de cena** e devolve os fragmentos — o arquivo não é dividido, só o sumário passa a apontar para os trechos.

As quebras de cena são detectadas pelo CSS do próprio livro (`detectSceneBreakClasses`, `parseSpacingClasses`, `topMarginEm`): conta como quebra o bloco cuja margem superior passa de `SCENE_BREAK_MIN_EM`. Os limiares de tamanho ficam logo acima de `splitHugeChapter()` em `app.js`:

- `HUGE_CHAPTER_MIN_CHARS` (15000) — a partir de quantos caracteres visíveis um capítulo é candidato à divisão.
- `CHAPTER_SEGMENT_MIN_CHARS` (6000) — tamanho mínimo de cada trecho, exigido também do que sobra à frente, para não gerar um trecho final minúsculo.

Sem divisões, os rótulos são números sequenciais (1, 2, 3…); havendo divisões, os títulos existentes no sumário são preservados e os trechos seguintes ganham sufixo ` (n)`.

### Prévia

`openPreview()` abre o **arquivo de entrada** (não o reparado), monta o spine com `buildPreviewSpine()` e renderiza um capítulo por vez num `<iframe srcdoc>`. Os recursos (CSS, imagens) são embutidos como data URLs por `inlineAssetsAsDataUrls()`, porque o `srcdoc` não resolve caminhos do ZIP. `setPreviewMode()` alterna `original` / `reduced` / `mini` reaproveitando o mesmo `applyReducedMargins()` usado no reparo — não duplique essa lógica.

### Diagnósticos

`addIssue(level, message, file, code, params)` alimenta `state.report`. `level` é um de `error` / `warning` / `fixed` / `info`. O `code` (ex.: `DRM_BLOCKED`, `REMOTE_RESOURCES`, `CHAPTERS_SPLIT`) é a chave estável: é ele que resolve o texto traduzido em `getIssueDisplayMessage()` e que pesa na nota de compatibilidade — o `message` passado em português é só fallback de debug.

`computeCompatibilityScore()` parte de 100 e desconta 20 por erro, 8 por aviso listado em `HEAVY_WARNINGS` (`REMOTE_RESOURCES`, `LARGE_INTERNAL_FILE`, `LONG_INTERNAL_PATH`, `FINAL_XML_INVALID`, `MALFORMED_XML`) e 4 pelos demais avisos.

Ao criar um diagnóstico novo: escolha um `code` novo, adicione a chave correspondente nos 21 blocos de tradução e decida se ele entra em `HEAVY_WARNINGS`.

### Helpers

Já existem helpers para XML, caminhos e texto — reutilize em vez de escrever novos: `parseXml`, `serializeXmlDocument`, `decodeText`, `escapeXml`, `escapeHtml`, `findFirstByLocalName`, `findDirectChild`, `getDirectChildren`, `getElementText`, `collectXmlIds`, `createUniqueId`, `dirname`, `basename`, `relativePath`, `joinPath`, `normalizePackagePath`, `sanitizePackagePath`, `getExtension`, `normalizeWhitespace`, `stripTags`, `formatBytes`, `applyReducedMargins`.

### Invariantes do EPUB

Não quebre estas ao mexer na reconstrução:

- `mimetype` é o **primeiro** arquivo do ZIP e vai **sem compressão** (`STORE`). É a causa nº 1 de rejeição pelo Send to Kindle.
- As entradas do ZIP são gravadas com um `date` compensado pelo fuso (JSZip grava DOS time como se fosse UTC) — sem isso saem timestamps no futuro.
- Fontes ofuscadas são preservadas como estão — desofuscar quebraria a renderização.
- DRM é **detectado e reportado, nunca removido**. Não implemente contorno de DRM aqui.
- O identificador do livro (`dc:identifier`) é preservado quando já existe (`preserveIdentifier`), para não quebrar sincronização de leitura.

## Internacionalização

`i18n.js` define **21 idiomas** em `LANGUAGE_META` (ordem do seletor = número de falantes no mundo: en, zh, hi, es, fr, ar, bn, pt, ru, ur, id, de, nl, ja, tr, ko, vi, it, mr, te, ta) e um bloco correspondente em `translations`. As chaves são achatadas e há fallback por chave para o inglês em `translateWith`.

**Toda chave nova precisa entrar nos 21 blocos.** Traduções faltando são um bug recorrente do projeto (ver commit `Add missing batch-mode translations for all supported languages`). Atenção aos campos `dir: "rtl"` (ar, ur) e a `opfLang`, usado para preencher `dc:language` quando ausente no OPF.

Textos visíveis nunca são hardcoded no `app.js` — passam por `t("chave")`. Textos que vão **dentro do EPUB gerado** (títulos de navegação, rótulos de capítulo) usam `bookText(language, key)`, que resolve no idioma do livro e não no da interface — não troque um pelo outro.

O idioma também é dirigível por URL (`?lang=xx`, ver `applyLanguageFromUrl()`), persistido em `localStorage` e refletido nas metatags por `updateSeoMeta()`.

### Ao adicionar um novo idioma

Um idioma novo exige, além do bloco em `translations`:

1. A entrada em `LANGUAGE_META` (`i18n.js`), na posição correta da ordem por número de falantes.
2. **`index.html`** — uma linha `<link rel="alternate" hreflang="xx" href="…/?lang=xx">` e um `<meta property="og:locale:alternate">` correspondente. Ainda é manual.
3. **Sitemap** — nada a fazer. O `sitemap.txt` publicado tem só a URL raiz
   (`https://kindle-epub-fix.web.app/`), sem uma entrada por idioma, e é ele que o
   `robots.txt` aponta.

Use o `hreflang` de `LANGUAGE_META.htmlLang` (ex.: `zh` → `zh-CN`, `pt` → `pt-BR`), mas o parâmetro da URL é sempre o código curto (`?lang=zh`, `?lang=pt`).

## Convenções

- Comentários em português; identificadores, códigos de diagnóstico e chaves de i18n em inglês.
- Mensagens de commit em inglês, no imperativo, seguindo o histórico (`Add ...`, `Fix ...`).
- Sem dependências novas. O projeto roda de `file://` — nada de `import`/`export`, módulos ES, `fetch` de recursos externos ou CDNs. Se precisar de uma lib, ela entra minificada em `vendor/` e é carregada por `<script>` no `index.html`.
- Acesso a `localStorage` sempre pelos wrappers `safeStorageGet`/`safeStorageSet`, que engolem exceções — em `file://` e modo anônimo o acesso direto lança.
- Planos de implementação de features maiores ficam num `PLAN.md` temporário na raiz, removido quando a feature entra. Se ele existir, consulte antes de começar trabalho novo.

## Fragilidades conhecidas

- **`index.html` manual** — os `hreflang` e `og:locale:alternate` do `<head>` ainda são editados à mão, sem nenhuma verificação de que todos os idiomas de `LANGUAGE_META` estão lá.
- **Opção nova esquecida em `useRecommendedOptions()`** — o objeto `recommended` repete as 12 chaves à mão; uma opção que não entre lá simplesmente não é tocada pelo botão de recomendadas.
- **`tools/generate-sitemap.js` órfão** — sobrou do fluxo antigo de `sitemap.xml` multilíngue; ninguém o chama e o `deploy.cmd` agora apaga o XML que ele produziria.
- **Espelho `public/`** — só sincroniza via `deploy.cmd`; um commit que altera a raiz sem rodar o deploy deixa as duas cópias divergentes.
- **Traduções faltando** — não há verificação de que uma chave existe nos 21 blocos; o fallback silencioso para o inglês esconde a omissão.
- **EPUB de referência não versionado** — `*.epub` está no `.gitignore`, então o arquivo de teste existe só na máquina local; num clone limpo não há nada para validar.
