/*
 * Gera sitemap.xml a partir de LANGUAGE_META (i18n.js) e SITE_ORIGIN (app.js).
 *
 * O sitemap e o cruzamento completo dos idiomas: uma <url> para a raiz e uma
 * por idioma (?lang=xx), cada uma repetindo os hreflang de todos os idiomas
 * mais x-default. Mante-lo a mao e inviavel a partir de ~20 idiomas.
 *
 * Uso:
 *   node tools/generate-sitemap.js                  grava sitemap.xml
 *   node tools/generate-sitemap.js --check          nao grava; falha se desatualizado
 *   node tools/generate-sitemap.js --lastmod=2026-07-19
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const I18N_PATH = path.join(ROOT, "i18n.js");
const APP_PATH = path.join(ROOT, "app.js");
const INDEX_PATH = path.join(ROOT, "index.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap.xml");

// --- argumentos -------------------------------------------------------------

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const lastmodArg = args.find((arg) => arg.startsWith("--lastmod="));
const lastmod = lastmodArg ? lastmodArg.slice("--lastmod=".length) : today();

if (!/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) {
  fail(`--lastmod invalido: "${lastmod}". Use o formato YYYY-MM-DD.`);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fail(message) {
  console.error(`ERRO: ${message}`);
  process.exit(1);
}

// --- leitura das fontes de verdade -----------------------------------------

/**
 * Extrai um literal de objeto do codigo-fonte contando chaves.
 * Os arquivos sao IIFEs de navegador, nao da para exigi-los com require().
 */
function extractObjectLiteral(source, declaration, filename) {
  const start = source.indexOf(declaration);
  if (start === -1) {
    fail(`nao encontrei "${declaration}" em ${filename}.`);
  }

  const open = source.indexOf("{", start);
  let depth = 0;

  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        const literal = source.slice(open, i + 1);
        // O literal vem do nosso proprio codigo-fonte, nao de entrada externa.
        return new Function(`return (${literal});`)();
      }
    }
  }

  fail(`literal de "${declaration}" sem fechamento em ${filename}.`);
}

function readLanguageMeta() {
  const source = fs.readFileSync(I18N_PATH, "utf8");
  const meta = extractObjectLiteral(source, "const LANGUAGE_META =", "i18n.js");
  const codes = Object.keys(meta);

  if (codes.length === 0) {
    fail("LANGUAGE_META esta vazio.");
  }

  for (const code of codes) {
    if (!meta[code].htmlLang) {
      fail(`idioma "${code}" nao define htmlLang em LANGUAGE_META.`);
    }
  }

  return meta;
}

function readSiteOrigin() {
  const source = fs.readFileSync(APP_PATH, "utf8");
  const match = source.match(/const SITE_ORIGIN\s*=\s*"([^"]+)"/);
  if (!match) {
    fail('nao encontrei SITE_ORIGIN em app.js.');
  }
  return match[1].replace(/\/$/, "");
}

// --- geracao ----------------------------------------------------------------

// O sitemap versionado usa CRLF; manter para o diff nao virar "arquivo inteiro".
const EOL = "\r\n";

function urlFor(origin, code) {
  return code ? `${origin}/?lang=${code}` : `${origin}/`;
}

function buildSitemap(meta, origin) {
  const codes = Object.keys(meta);

  // Os mesmos hreflang se repetem em toda <url>: monta uma vez so.
  const alternates = [
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor(origin, null)}" />`,
    ...codes.map(
      (code) =>
        `    <xhtml:link rel="alternate" hreflang="${meta[code].htmlLang}" href="${urlFor(origin, code)}" />`
    )
  ].join(EOL);

  // Raiz (deteccao automatica de idioma) + uma <url> por idioma.
  const blocks = [null, ...codes].map(
    (code) =>
      [
        "  <url>",
        `    <loc>${urlFor(origin, code)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        alternates,
        "  </url>"
      ].join(EOL)
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...blocks,
    "</urlset>",
    ""
  ].join(EOL);
}

// --- consistencia com index.html -------------------------------------------

/**
 * O index.html tem hreflang e og:locale:alternate proprios, mantidos a mao.
 * Aqui so avisamos sobre a divergencia: reescrever o <head> automaticamente
 * seria arriscado demais para o ganho.
 */
function checkIndexHtml(meta) {
  const source = fs.readFileSync(INDEX_PATH, "utf8");
  const missing = Object.keys(meta).filter(
    (code) => !source.includes(`hreflang="${meta[code].htmlLang}"`)
  );

  if (missing.length > 0) {
    console.warn(
      `AVISO: index.html nao tem <link rel="alternate"> para: ${missing.join(", ")}`
    );
    return false;
  }
  return true;
}

// --- main -------------------------------------------------------------------

const meta = readLanguageMeta();
const origin = readSiteOrigin();
const generated = buildSitemap(meta, origin);
const languageCount = Object.keys(meta).length;

const indexOk = checkIndexHtml(meta);

if (checkOnly) {
  const current = fs.existsSync(SITEMAP_PATH)
    ? fs.readFileSync(SITEMAP_PATH, "utf8")
    : "";

  // lastmod muda a cada dia e a quebra de linha varia por checkout:
  // comparar so a estrutura evita falso positivo.
  const normalize = (text) =>
    text.replace(/<lastmod>[^<]*<\/lastmod>/g, "").replace(/\r\n/g, "\n");

  if (normalize(current) !== normalize(generated)) {
    fail("sitemap.xml esta desatualizado. Rode: node tools/generate-sitemap.js");
  }

  console.log(`sitemap.xml esta atualizado (${languageCount} idiomas).`);
  process.exit(indexOk ? 0 : 1);
}

fs.writeFileSync(SITEMAP_PATH, generated, "utf8");
console.log(
  `sitemap.xml gerado: ${languageCount + 1} URLs, ${languageCount} idiomas, lastmod ${lastmod}.`
);
