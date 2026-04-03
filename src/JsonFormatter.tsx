import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Copy, Check, Trash2, Sun, Moon, Languages,
  ChevronRight, ChevronDown, AlertCircle, FileJson,
  Minimize2, AlignLeft, TreePine,
} from 'lucide-react'

// ── i18n ─────────────────────────────────────────────────────────────────────
const translations = {
  en: {
    title: 'JSON Formatter',
    subtitle: 'Format, validate and minify JSON instantly. Everything runs client-side — nothing is sent to any server.',
    inputLabel: 'JSON Input',
    inputPlaceholder: 'Paste your JSON here...',
    outputLabel: 'Output',
    format: 'Format',
    minify: 'Minify',
    copy: 'Copy',
    copied: 'Copied!',
    clear: 'Clear',
    treeView: 'Tree View',
    formatted: 'Formatted',
    valid: 'Valid JSON',
    invalid: 'Invalid JSON',
    empty: 'No input',
    errorLine: 'Error at',
    statsKeys: 'Keys',
    statsDepth: 'Depth',
    statsSize: 'Size',
    statsType: 'Type',
    outputPlaceholder: 'Formatted JSON will appear here...',
    treeEmpty: 'Format JSON to see the tree view.',
    builtBy: 'Built by',
    object: 'object',
    array: 'array',
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    null: 'null',
    collapseAll: 'Collapse all',
    expandAll: 'Expand all',
  },
  pt: {
    title: 'Formatador JSON',
    subtitle: 'Formate, valide e minifique JSON instantaneamente. Tudo roda no navegador — nenhum dado e enviado ao servidor.',
    inputLabel: 'Entrada JSON',
    inputPlaceholder: 'Cole seu JSON aqui...',
    outputLabel: 'Saida',
    format: 'Formatar',
    minify: 'Minificar',
    copy: 'Copiar',
    copied: 'Copiado!',
    clear: 'Limpar',
    treeView: 'Arvore',
    formatted: 'Formatado',
    valid: 'JSON valido',
    invalid: 'JSON invalido',
    empty: 'Sem entrada',
    errorLine: 'Erro na linha',
    statsKeys: 'Chaves',
    statsDepth: 'Profundidade',
    statsSize: 'Tamanho',
    statsType: 'Tipo',
    outputPlaceholder: 'O JSON formatado aparecera aqui...',
    treeEmpty: 'Formate um JSON para ver a arvore.',
    builtBy: 'Criado por',
    object: 'objeto',
    array: 'array',
    string: 'texto',
    number: 'numero',
    boolean: 'booleano',
    null: 'nulo',
    collapseAll: 'Recolher tudo',
    expandAll: 'Expandir tudo',
  },
} as const

type Lang = keyof typeof translations

// ── JSON utilities ────────────────────────────────────────────────────────────
interface ParseResult {
  ok: boolean
  value?: unknown
  error?: string
  errorLine?: number
}

function parseJSON(input: string): ParseResult {
  if (!input.trim()) return { ok: false }
  try {
    const value = JSON.parse(input)
    return { ok: true, value }
  } catch (e) {
    const msg = (e as Error).message
    // Try to extract line number from error message
    const lineMatch = msg.match(/line (\d+)/) || msg.match(/position (\d+)/)
    let errorLine: number | undefined
    if (lineMatch) {
      if (msg.includes('position')) {
        // Calculate line from char position
        const pos = parseInt(lineMatch[1], 10)
        errorLine = input.slice(0, pos).split('\n').length
      } else {
        errorLine = parseInt(lineMatch[1], 10)
      }
    }
    return { ok: false, error: msg, errorLine }
  }
}

function countKeys(val: unknown): number {
  if (val === null || typeof val !== 'object') return 0
  if (Array.isArray(val)) return val.reduce<number>((acc, v) => acc + countKeys(v), 0)
  const obj = val as Record<string, unknown>
  return Object.keys(obj).length + Object.values(obj).reduce<number>((acc, v) => acc + countKeys(v), 0)
}

function calcDepth(val: unknown): number {
  if (val === null || typeof val !== 'object') return 0
  if (Array.isArray(val)) return val.length === 0 ? 1 : 1 + Math.max(...val.map(calcDepth))
  const obj = val as Record<string, unknown>
  const values = Object.values(obj)
  return values.length === 0 ? 1 : 1 + Math.max(...values.map(calcDepth))
}

function getTopType(val: unknown): string {
  if (val === null) return 'null'
  if (Array.isArray(val)) return 'array'
  return typeof val
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

// ── Syntax highlight ──────────────────────────────────────────────────────────
function syntaxHighlight(json: string): string {
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'text-cyan-600 dark:text-cyan-400' // number
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'text-zinc-800 dark:text-zinc-200 font-medium' // key
        } else {
          cls = 'text-emerald-600 dark:text-emerald-400' // string value
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-violet-600 dark:text-violet-400'
      } else if (/null/.test(match)) {
        cls = 'text-zinc-400 dark:text-zinc-500 italic'
      }
      return `<span class="${cls}">${match}</span>`
    }
  )
}

// ── Tree node ─────────────────────────────────────────────────────────────────
interface TreeNodeProps {
  name: string | null
  value: unknown
  depth: number
  defaultExpanded: boolean
}

function TreeNode({ name, value, depth, defaultExpanded }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const isObject = value !== null && typeof value === 'object'
  const isArray = Array.isArray(value)
  const entries = isObject
    ? isArray
      ? (value as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
      : Object.entries(value as Record<string, unknown>)
    : []
  const count = entries.length

  const typeColor = () => {
    if (value === null) return 'text-zinc-400 dark:text-zinc-500'
    if (isArray) return 'text-amber-600 dark:text-amber-400'
    if (isObject) return 'text-blue-600 dark:text-blue-400'
    if (typeof value === 'string') return 'text-emerald-600 dark:text-emerald-400'
    if (typeof value === 'number') return 'text-cyan-600 dark:text-cyan-400'
    if (typeof value === 'boolean') return 'text-violet-600 dark:text-violet-400'
    return 'text-zinc-600 dark:text-zinc-300'
  }

  const renderValue = () => {
    if (value === null) return <span className="text-zinc-400 dark:text-zinc-500 italic">null</span>
    if (isArray) return <span className="text-zinc-400 dark:text-zinc-500 text-xs">[{count} items]</span>
    if (isObject) return <span className="text-zinc-400 dark:text-zinc-500 text-xs">{`{${count} keys}`}</span>
    if (typeof value === 'string') return <span className={typeColor()}>"{value}"</span>
    if (typeof value === 'boolean') return <span className={typeColor()}>{String(value)}</span>
    return <span className={typeColor()}>{String(value)}</span>
  }

  return (
    <div className="text-sm font-mono leading-relaxed" style={{ marginLeft: depth > 0 ? '1.25rem' : 0 }}>
      <div
        className={`flex items-start gap-1 py-0.5 rounded px-1 -mx-1 ${isObject ? 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/60' : ''}`}
        onClick={isObject ? () => setExpanded(e => !e) : undefined}
      >
        {isObject ? (
          <span className="mt-0.5 text-zinc-400 dark:text-zinc-500 shrink-0 w-3.5">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {name !== null && (
          <span className="text-zinc-700 dark:text-zinc-300 font-medium shrink-0">
            {isArray ? <span className="text-zinc-400 dark:text-zinc-500">[{name}]</span> : `"${name}"`}
            <span className="text-zinc-400 dark:text-zinc-500 font-normal">: </span>
          </span>
        )}
        {renderValue()}
      </div>
      {isObject && expanded && entries.map(([k, v]) => (
        <TreeNode key={k} name={k} value={v} depth={depth + 1} defaultExpanded={depth < 1} />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function JsonFormatter() {
  const [lang, setLang] = useState<Lang>(() => (navigator.language.startsWith('pt') ? 'pt' : 'en'))
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [mode, setMode] = useState<'formatted' | 'minified' | 'tree'>('formatted')
  const [copied, setCopied] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult>({ ok: false })
  const [treeKey, setTreeKey] = useState(0)
  const outputRef = useRef<HTMLPreElement>(null)

  const t = translations[lang]

  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])

  // Real-time validation
  useEffect(() => {
    if (!input.trim()) {
      setParseResult({ ok: false })
      return
    }
    setParseResult(parseJSON(input))
  }, [input])

  const handleFormat = useCallback(() => {
    const result = parseJSON(input)
    if (!result.ok) return
    const pretty = JSON.stringify(result.value, null, 2)
    setOutput(pretty)
    setMode('formatted')
    setTreeKey(k => k + 1)
  }, [input])

  const handleMinify = useCallback(() => {
    const result = parseJSON(input)
    if (!result.ok) return
    const mini = JSON.stringify(result.value)
    setOutput(mini)
    setMode('minified')
  }, [input])

  const handleTreeView = useCallback(() => {
    const result = parseJSON(input)
    if (!result.ok) return
    if (!output) {
      const pretty = JSON.stringify(result.value, null, 2)
      setOutput(pretty)
    }
    setMode('tree')
    setTreeKey(k => k + 1)
  }, [input, output])

  const handleCopy = () => {
    const text = mode === 'tree' ? output : output
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleClear = () => {
    setInput('')
    setOutput('')
    setMode('formatted')
    setParseResult({ ok: false })
  }

  // Stats
  const stats = parseResult.ok && parseResult.value !== undefined ? {
    keys: countKeys(parseResult.value),
    depth: calcDepth(parseResult.value),
    size: formatBytes(new TextEncoder().encode(input).length),
    type: getTopType(parseResult.value),
  } : null

  const statusColor = !input.trim()
    ? 'text-zinc-400 dark:text-zinc-500'
    : parseResult.ok
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-500 dark:text-red-400'

  const statusIcon = !input.trim()
    ? null
    : parseResult.ok
    ? <Check size={13} />
    : <AlertCircle size={13} />

  const statusText = !input.trim() ? t.empty : parseResult.ok ? t.valid : t.invalid

  // Highlight output for display
  const highlightedOutput = output ? syntaxHighlight(
    output.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  ) : ''

  const parsedValue = parseResult.ok ? parseResult.value : undefined

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center">
              <FileJson size={18} className="text-white" />
            </div>
            <span className="font-semibold">JSON Formatter</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(l => l === 'en' ? 'pt' : 'en')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Toggle language"
            >
              <Languages size={14} />
              {lang.toUpperCase()}
            </button>
            <button
              onClick={() => setDark(d => !d)}
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Toggle theme"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <a
              href="https://github.com/gmowses/json-formatter"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Title */}
          <div>
            <h1 className="text-3xl font-bold">{t.title}</h1>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">{t.subtitle}</p>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleFormat}
              disabled={!parseResult.ok}
              className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <AlignLeft size={15} />
              {t.format}
            </button>
            <button
              onClick={handleMinify}
              disabled={!parseResult.ok}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Minimize2 size={15} />
              {t.minify}
            </button>
            <button
              onClick={handleTreeView}
              disabled={!parseResult.ok}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                mode === 'tree'
                  ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400'
                  : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <TreePine size={15} />
              {t.treeView}
            </button>
            <div className="flex-1" />
            <button
              onClick={handleCopy}
              disabled={!output}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
              {copied ? t.copied : t.copy}
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Trash2 size={15} />
              {t.clear}
            </button>
          </div>

          {/* Editor panes */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Input */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {t.inputLabel}
                </span>
                <span className={`flex items-center gap-1 text-xs font-medium ${statusColor}`}>
                  {statusIcon}
                  {statusText}
                  {parseResult.errorLine && (
                    <span className="text-zinc-400 dark:text-zinc-500">
                      — {t.errorLine} {parseResult.errorLine}
                    </span>
                  )}
                </span>
              </div>
              <div className="relative">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={t.inputPlaceholder}
                  spellCheck={false}
                  className={`w-full h-[480px] rounded-xl border bg-zinc-50 dark:bg-zinc-900 px-4 py-3 font-mono text-sm resize-none outline-none transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:ring-2 focus:ring-cyan-500/30 ${
                    input && !parseResult.ok
                      ? 'border-red-400 dark:border-red-700'
                      : 'border-zinc-200 dark:border-zinc-800'
                  }`}
                />
                {parseResult.error && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2">
                    <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600 dark:text-red-400 font-mono break-all">{parseResult.error}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Output */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {t.outputLabel}
                  {output && mode !== 'tree' && (
                    <span className="ml-2 normal-case font-normal text-zinc-400 dark:text-zinc-500">
                      — {mode === 'minified' ? t.minify : t.formatted}
                    </span>
                  )}
                </span>
                {output && mode === 'tree' && (
                  <span className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">{t.treeView}</span>
                )}
              </div>

              <div className="h-[480px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 overflow-auto">
                {mode === 'tree' && parsedValue !== undefined ? (
                  <div key={treeKey} className="p-4">
                    <TreeNode name={null} value={parsedValue} depth={0} defaultExpanded={true} />
                  </div>
                ) : output ? (
                  <pre
                    ref={outputRef}
                    className="p-4 text-sm font-mono leading-relaxed whitespace-pre-wrap break-all text-zinc-800 dark:text-zinc-200"
                    dangerouslySetInnerHTML={{ __html: highlightedOutput }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-zinc-400 dark:text-zinc-600">{t.outputPlaceholder}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: t.statsKeys, value: stats.keys.toLocaleString() },
                { label: t.statsDepth, value: stats.depth.toString() },
                { label: t.statsSize, value: stats.size },
                { label: t.statsType, value: stats.type },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3"
                >
                  <p className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-0.5">{label}</p>
                  <p className="text-sm font-semibold tabular-nums capitalize">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-zinc-400">
          <span>
            {t.builtBy}{' '}
            <a
              href="https://github.com/gmowses"
              className="text-zinc-600 dark:text-zinc-300 hover:text-cyan-500 transition-colors"
            >
              Gabriel Mowses
            </a>
          </span>
          <span>MIT License</span>
        </div>
      </footer>
    </div>
  )
}
