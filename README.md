# Kindle EPUB Fixer

Aplicação web local para diagnosticar, corrigir e reconstruir arquivos EPUB com foco em compatibilidade com o **Send to Kindle**.

A interface detecta automaticamente o idioma principal configurado no navegador:

- `pt-*`: Português
- qualquer outro idioma: English

Também é possível trocar manualmente entre **Português** e **English** no seletor do cabeçalho. A tradução inclui interface, progresso, diagnósticos, erros, relatório JSON e nomes dos arquivos gerados.

## Como usar

1. Extraia o arquivo ZIP do projeto.
2. Abra `index.html` no Chrome, Edge ou Firefox.
3. Arraste um arquivo `.epub` para a área indicada.
4. Mantenha as correções recomendadas ou ajuste as opções.
5. Clique em **Analisar e corrigir EPUB** / **Analyze and repair EPUB**.
6. Baixe o EPUB corrigido e, opcionalmente, o relatório JSON.

Não é necessário instalar dependências, usar terminal ou executar servidor. Todo o processamento acontece no navegador e o EPUB não é enviado para a internet.

## Principais verificações e correções

- Reconstrução do ZIP EPUB com `mimetype` como primeiro arquivo e sem compressão.
- Criação ou correção de `META-INF/container.xml`.
- Detecção automática do pacote OPF.
- Normalização segura de nomes de arquivos e diretórios.
- Atualização de referências em XHTML, HTML, XML, SVG, OPF, NCX e CSS.
- Correção de URLs percent-encoded, barras invertidas e diferenças de maiúsculas/minúsculas.
- Conversão de textos para UTF-8.
- Limpeza de caracteres XML inválidos e entidades HTML incompatíveis com XML.
- Correção de manifesto, IDs, tipos MIME e spine.
- Inclusão de arquivos não listados no manifesto.
- Remoção opcional de referências para arquivos inexistentes.
- Detecção e configuração da imagem de capa.
- Criação ou reconstrução de navegação EPUB 3 (`nav.xhtml`).
- Criação ou reconstrução do sumário NCX para compatibilidade legada.
- Remoção de arquivos inúteis de macOS, Windows e sistemas de controle de versão.
- Detecção de recursos remotos, arquivos vazios, caminhos longos e mídias muito grandes.
- Detecção de DRM e criptografia não suportada, sem tentar removê-los.
- Preservação responsável de fontes ofuscadas.
- Geração de relatório JSON detalhado no idioma selecionado.

## Estrutura do projeto

```text
kindle-epub-fixer/
├── index.html
├── styles.css
├── i18n.js
├── app.js
├── README.md
├── LICENSE.txt
└── vendor/
    └── jszip.min.js
```

## Privacy / Privacidade

The application uses browser APIs and JSZip. Files are processed only in the device memory and are never uploaded.

A aplicação usa APIs do navegador e JSZip. Os arquivos são processados somente na memória do dispositivo e nunca são enviados para a internet.

## Limitations / Limitações

- The tool does not remove DRM.
- EPUBs with severely corrupted XML may require manual editing.
- The browser must have enough memory to open and rebuild the EPUB.
- Structural compliance is improved, but acceptance by Send to Kindle cannot be guaranteed for every file.

- A ferramenta não remove DRM.
- EPUBs com XML muito corrompido podem exigir edição manual.
- O navegador precisa ter memória suficiente para abrir e reconstruir o EPUB.
- O resultado melhora a conformidade estrutural, mas não garante aceitação de todo arquivo pelo Send to Kindle.

## Included library / Biblioteca incluída

The project includes JSZip 3.10.1 in `vendor/jszip.min.js`, distributed under the MIT license.

O projeto inclui JSZip 3.10.1 em `vendor/jszip.min.js`, distribuído sob licença MIT.
