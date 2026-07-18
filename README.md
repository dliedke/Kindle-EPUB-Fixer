# Kindle EPUB Fixer

Local web application to diagnose, fix, and rebuild EPUB files with a focus on compatibility with **Send to Kindle**.

The interface automatically detects the browser's main configured language:

- `pt-*`: Portuguese
- any other language: English

You can also manually switch between **Português** and **English** using the selector in the header. The translation covers the interface, progress, diagnostics, errors, JSON report, and generated file names.

## How to use

1. Extract the project ZIP file.
2. Open `index.html` in Chrome, Edge, or Firefox.
3. Drag an `.epub` file into the indicated area.
4. Keep the recommended fixes or adjust the options.
5. Click **Analyze and repair EPUB**.
6. Download the fixed EPUB and, optionally, the JSON report.

No dependencies, terminal, or server are required. All processing happens in the browser, and the EPUB is never uploaded to the internet.

## Main checks and fixes

- Rebuilds the EPUB ZIP with `mimetype` as the first file and without compression.
- Creates or fixes `META-INF/container.xml`.
- Automatically detects the OPF package.
- Safely normalizes file and directory names.
- Updates references in XHTML, HTML, XML, SVG, OPF, NCX, and CSS.
- Fixes percent-encoded URLs, backslashes, and case-sensitivity differences.
- Converts text to UTF-8.
- Cleans up invalid XML characters and HTML entities incompatible with XML.
- Fixes the manifest, IDs, MIME types, and spine.
- Includes files not listed in the manifest.
- Optionally removes references to nonexistent files.
- Detects and configures the cover image.
- Creates or rebuilds EPUB 3 navigation (`nav.xhtml`).
- Creates or rebuilds the NCX table of contents for legacy compatibility.
- Removes unnecessary macOS, Windows, and version control system files.
- Detects remote resources, empty files, long paths, and oversized media.
- Detects DRM and unsupported encryption, without attempting to remove them.
- Responsibly preserves obfuscated fonts.
- Generates a detailed JSON report in the selected language.

## Project structure

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

## Privacy

The application uses browser APIs and JSZip. Files are processed only in the device memory and are never uploaded.

## Limitations

- The tool does not remove DRM.
- EPUBs with severely corrupted XML may require manual editing.
- The browser must have enough memory to open and rebuild the EPUB.
- Structural compliance is improved, but acceptance by Send to Kindle cannot be guaranteed for every file.

## Included library

The project includes JSZip 3.10.1 in `vendor/jszip.min.js`, distributed under the MIT license.
