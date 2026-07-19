# CLAUDE.md

Orientações para o Claude Code trabalhar neste repositório.

## Visão geral

**Kindle EPUB Fixer** — aplicação web 100% client-side que diagnostica, corrige e reconstrói arquivos EPUB visando compatibilidade com o **Send to Kindle**. Não há backend: o EPUB nunca sai do navegador. Publicada em Firebase Hosting (`https://kindle-epub-fixer.web.app`).

Sem build step, sem npm, sem framework. JavaScript puro (IIFE, `"use strict"`), única dependência é `vendor/jszip.min.js`.

## Regra crítica: editar na raiz, nunca em `public/`

Os arquivos da aplicação existem em duas cópias:

- **Raiz** (`index.html`, `app.js`, `i18n.js`, `styles.css`, `sitemap.xml`, `robots.txt`, `vendor/`) — **fonte da verdade, edite aqui**.
- **`public/`** — espelho de deploy. `deploy.cmd` sobrescreve `public/` a partir da raiz antes de publicar. Qualquer edição feita diretamente em `public/` é perdida.

Commits que sincronizam o espelho aparecem no histórico como `Sync public/ mirror with latest root changes`.

## Comandos

```cmd
:: Rodar localmente — basta abrir o arquivo, funciona em file://
start index.html

:: Gerar sitemap.xml a partir de LANGUAGE_META (i18n.js)
node tools\generate-sitemap.js

:: Verificar se o sitemap esta atualizado, sem gravar (sai != 0 se divergir)
node tools\generate-sitemap.js --check

:: Gerar sitemap, copiar raiz -> public/ e publicar no Firebase Hosting
deploy.cmd
```

O único uso de Node no projeto é o gerador de sitemap — a aplicação em si não depende dele.

Não há testes automatizados. Validação é manual — o roteiro mínimo depois de qualquer mudança em `app.js`:

1. Abrir `index.html` direto no navegador (Chrome/Edge/Firefox) e conferir o console sem erros.
2. Arrastar `Bom dia inverno (Tamara Klink) RUIM.epub` (EPUB problemático de referência, na raiz) e rodar **Analisar e reparar**.
3. Conferir a lista de diagnósticos, a nota de compatibilidade e a prévia de margens.
4. Baixar o EPUB corrigido e o relatório JSON; verificar que o JSON saiu no idioma selecionado.
5. Trocar o idioma no seletor e reconferir a tela — chaves faltando aparecem como o nome cru da chave.

Para testar o modo em lote, repetir com dois ou mais arquivos selecionados de uma vez.

O `.csproj`/`.slnx` existem apenas para dar uma solution ao Visual Studio (`net10.0`, `EnableDefaultItems=false`). Não compilam código da aplicação — não é necessário rodar `dotnet build`.

## Arquitetura

| Arquivo | Papel |
| --- | --- |
| `index.html` | Marcação, IDs dos controles, metadados SEO multilíngues |
| `app.js` | Toda a lógica: leitura do ZIP, diagnósticos, correções, reconstrução, UI |
| `i18n.js` | Tabela de traduções + metadados de idioma |
| `styles.css` | Estilos |
| `vendor/jszip.min.js` | Leitura/escrita de ZIP |

`app.js` é uma IIFE única de ~2.400 linhas, sem módulos. Não há framework: o DOM é acessado por um objeto `dom` montado uma vez com `getElementById`, então **todo controle novo no `index.html` precisa de um `id` e de uma entrada em `dom`**.

### Estado

- `jobs` — array de *jobs*, um por arquivo selecionado (`createJob()`). Cada job carrega `inputFile`, `outputBlob`, `report`, `reportDocument`, `status`.
- `state` — ponteiro para o job **ativo** (`setActiveJob()`), não um objeto de estado global. Funções como `addIssue()` e `calculateStats()` escrevem/leem implicitamente no job ativo, então trocar `state` no meio de um fluxo redireciona os efeitos colaterais.
- `optionIds` — lista das 12 checkboxes de correção; dirige `readOptions()`, `persistOptions()` e `applyStoredOptions()`. **Uma opção nova precisa entrar nesse array**, senão não é lida nem persistida.

### Pipeline de reparo

`repairJob(job)` é o orquestrador; `repairAllFiles()` apenas itera os jobs em lote. A ordem das etapas importa (cada uma assume o resultado da anterior) e é espelhada na barra de progresso:

`abrir ZIP` → `inspectEncryption` (DRM/ofuscação) → mapear caminhos (`createPathMap`) → ler conteúdo → `rewriteAllInternalReferences` → `repairContainer` → `repairTextDocuments` → `repairPackageDocument` (manifest, spine, capa, navegação) → `validateFinalPackage` → regravar o ZIP.

Saída antecipada: DRM bloqueante chama `finalizeWithoutOutput()` e retorna sem produzir EPUB.

### Diagnósticos

`addIssue(level, message, file, code, params)` alimenta `state.report`. `level` é um de `error` / `warning` / `fixed` / `info`. O `code` (ex.: `DRM_BLOCKED`, `REMOTE_RESOURCES`) é a chave estável: é ele que resolve o texto traduzido em `getIssueDisplayMessage()` e que pesa na nota de compatibilidade — o `message` passado em português é só fallback de debug. Códigos listados em `HEAVY_WARNINGS` descontam 8 pontos em `computeCompatibilityScore()`, os demais avisos 4, e cada erro 20.

Ao criar um diagnóstico novo: escolha um `code` novo, adicione a chave correspondente nos 21 blocos de tradução e decida se ele entra em `HEAVY_WARNINGS`.

### Helpers

Já existem helpers para XML e caminhos — reutilize em vez de escrever novos: `parseXml`, `serializeXmlDocument`, `decodeText`, `escapeXml`, `findFirstByLocalName`, `getDirectChildren`, `dirname`, `relativePath`, `joinPath`, `normalizePackagePath`, `sanitizePackagePath`, `getExtension`, `applyReducedMargins` (usado tanto no reparo quanto na prévia).

### Invariantes do EPUB

Não quebre estas ao mexer na reconstrução:

- `mimetype` é o **primeiro** arquivo do ZIP e vai **sem compressão** (`STORE`). É a causa nº 1 de rejeição pelo Send to Kindle.
- Fontes ofuscadas são preservadas como estão — desofuscar quebraria a renderização.
- DRM é **detectado e reportado, nunca removido**. Não implemente contorno de DRM aqui.
- O identificador do livro (`dc:identifier`) é preservado quando já existe (`preserveIdentifier`), para não quebrar sincronização de leitura.

## Internacionalização

`i18n.js` define **21 idiomas** em `LANGUAGE_META` (ordem do seletor = número de falantes no mundo) e um bloco correspondente em `translations`. As chaves são achatadas e há fallback por chave para o inglês em `translateWith`.

**Toda chave nova precisa entrar nos 21 blocos.** Traduções faltando são um bug recorrente do projeto (ver commit `Add missing batch-mode translations for all supported languages`). Atenção aos campos `dir: "rtl"` (ar, ur) e a `opfLang`, usado para preencher `dc:language` quando ausente no OPF.

Textos visíveis nunca são hardcoded no `app.js` — passam por `t("chave")`. Textos que vão **dentro do EPUB gerado** (títulos de navegação, rótulos de capítulo) usam `bookText(language, key)`, que resolve no idioma do livro e não no da interface — não troque um pelo outro.

O idioma também é dirigível por URL (`?lang=xx`, ver `applyLanguageFromUrl()`), persistido em `localStorage` e refletido nas metatags por `updateSeoMeta()`.

### Ao adicionar um novo idioma

Um idioma novo exige, além do bloco em `translations`:

1. A entrada em `LANGUAGE_META` (`i18n.js`), na posição correta da ordem por número de falantes.
2. **`index.html`** — uma linha `<link rel="alternate" hreflang="xx" href="…/?lang=xx">` e um `<meta property="og:locale:alternate">` correspondente. Ainda é manual.
3. **`sitemap.xml`** — **não edite à mão**, é gerado:

```cmd
node tools\generate-sitemap.js
```

O `<lastmod>` usa a data de hoje; use `--lastmod=YYYY-MM-DD` para fixar. O `deploy.cmd` roda o gerador automaticamente antes de copiar para `public/`, e aborta o deploy se ele falhar.

Use o `hreflang` de `LANGUAGE_META.htmlLang` (ex.: `zh` → `zh-CN`, `pt` → `pt-BR`), mas o parâmetro da URL é sempre o código curto (`?lang=zh`, `?lang=pt`).

## Convenções

- Comentários em português; identificadores, códigos de diagnóstico e chaves de i18n em inglês.
- Mensagens de commit em inglês, no imperativo, seguindo o histórico (`Add ...`, `Fix ...`).
- Sem dependências novas. O projeto roda de `file://` — nada de `import`/`export`, módulos ES, `fetch` de recursos externos ou CDNs. Se precisar de uma lib, ela entra minificada em `vendor/` e é carregada por `<script>` no `index.html`.
- Acesso a `localStorage` sempre pelos wrappers `safeStorageGet`/`safeStorageSet`, que engolem exceções — em `file://` e modo anônimo o acesso direto lança.
- `PLAN.md` guarda planos de implementação de features em andamento; consulte antes de iniciar trabalho novo.

## Fragilidades conhecidas

- **`index.html` manual** — os `hreflang` e `og:locale:alternate` do `<head>` ainda são editados à mão. `tools/generate-sitemap.js` avisa quando um idioma de `LANGUAGE_META` não tem `hreflang` no `index.html`, mas não corrige.
- **Espelho `public/`** — só sincroniza via `deploy.cmd`; um commit que altera a raiz sem rodar o deploy deixa as duas cópias divergentes.
- **Traduções faltando** — não há verificação de que uma chave existe nos 21 blocos; o fallback silencioso para o inglês esconde a omissão.
