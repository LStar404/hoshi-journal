Local rendering dependencies, retrieved from the official npm registry on 2026-11-04.

Marked 18.1.3 (MIT)
https://marked.js.org/using_advanced
https://marked.js.org/using_pro
Browser UMD build is stored as marked.min.js (upstream distributable, filename retained for the local loader).

DOMPurify 3.4.17 (Apache-2.0 OR MPL-2.0)
https://github.com/cure53/DOMPurify

KaTeX 0.19.1 (MIT)
https://katex.org/docs/options
https://katex.org/docs/security
All 20 WOFF2 formula fonts are vendored. The local stylesheet removes only obsolete WOFF/TTF fallbacks; layout rules are unchanged.

Pinned versions, source package URLs and SHA256 package digests: versions.json.
Licenses are included alongside the libraries. No dependency is fetched from a CDN during site use.

Renderer behavior:
- Markdown supports GFM tables, tasks and code. Math is tokenized before Markdown escaping, then rendered after HTML sanitization.
- Formula delimiters: $...$, $$...$$, \(...\), \[...\]. Code spans and fences are left as code.
- TeX mode supports mathematical expressions and common matrix/alignment environments; it is not a full LaTeX document compiler. Full documents show an explicit explanation and the preserved source.
- Formula output includes accessible MathML. Untrusted commands are disabled; macro expansion and dimensions are limited.
- HTML preserves styles in a sandboxed, isolated iframe with no script/same-origin permissions. CSP blocks scripts, forms, external CSS/fonts and requests other than explicit HTTPS or data images.
- HTML and Markdown scripts/event handlers cannot run. External Markdown links open with noopener/noreferrer.
- Preview pauses above 300,000 characters; original text remains available for storage/export.
- Local scripts and formula styles/fonts load on the first rich preview; no per-keystroke network requests.
