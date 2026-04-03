# JSON Formatter

JSON formatter, validator and minifier with syntax highlighting, tree view and error detection. Everything runs client-side -- no data is sent to any server.

**[Live Demo](https://gmowses.github.io/json-formatter)**

## Features

- **Format** -- pretty-print JSON with 2-space indentation
- **Minify** -- compact JSON by removing all whitespace
- **Syntax highlighting** -- color-coded keys, strings, numbers, booleans and nulls
- **Real-time validation** -- instant error detection with line number reporting
- **Tree view** -- collapsible interactive tree explorer of the JSON structure
- **Stats** -- key count, nesting depth, size in bytes, root type
- **Dark / Light mode** -- toggle or auto-detect from system preference
- **i18n** -- English and Portuguese (auto-detect from browser language)
- **Copy to clipboard** -- one-click copy with visual feedback
- **Zero backend** -- pure client-side, works fully offline

## Tech Stack

- React 19
- TypeScript
- Tailwind CSS v4
- Vite
- Lucide icons

## Getting Started

```bash
git clone https://github.com/gmowses/json-formatter.git
cd json-formatter
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Build

```bash
npm run build
```

Static files are generated in `dist/`.

## License

[MIT](LICENSE) -- Gabriel Mowses
