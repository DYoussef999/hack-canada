'use client';

import { useState } from 'react';
import { X, Upload, AlertTriangle, FileText, CheckCircle } from 'lucide-react';
import type { Node } from 'reactflow';
import type { AnyNodeData } from '@/types/nodes';
import type { NodeCategory } from '@/types/nodes';

interface Props {
  onClose: () => void;
  onImport: (nodes: Node<AnyNodeData>[], edges: unknown[]) => void;
}

// ── Client-side CSV → nodes (no backend required) ────────────────────────────

/** Words in a category/type cell that indicate this is a revenue row. */
const REVENUE_SIGNALS = new Set([
  'revenue', 'income', 'sales', 'source', 'grant', 'subscription',
  'deposit', 'receipt', 'earning', 'earnings',
]);

/** Map category cell values → NodeCategory */
const CATEGORY_MAP: Record<string, NodeCategory> = {
  // Staff
  staff: 'Staff', labor: 'Staff', labour: 'Staff', wages: 'Staff',
  wage: 'Staff', salary: 'Staff', payroll: 'Staff', 'part-time': 'Staff',
  // Overhead
  overhead: 'Overhead', rent: 'Overhead', utilities: 'Overhead', utility: 'Overhead',
  hydro: 'Overhead', insurance: 'Overhead', 'fixed cost': 'Overhead',
  'fixed costs': 'Overhead', lease: 'Overhead', gas: 'Overhead', electric: 'Overhead',
  // OpEx
  opex: 'OpEx', marketing: 'OpEx', software: 'OpEx', inventory: 'OpEx',
  supplies: 'OpEx', cogs: 'OpEx', 'cost of goods': 'OpEx', advertising: 'OpEx',
  subscription: 'OpEx', equipment: 'OpEx', maintenance: 'OpEx',
};

/** Frequency string → monthly multiplier */
function frequencyMultiplier(freq: string): number {
  const f = freq.toLowerCase().trim();
  if (f.includes('daily')   || f === 'day')                    return 30;
  if (f.includes('weekly')  || f === 'week')                   return 4.33;
  if (f.includes('bi-week') || f.includes('biweek') || f.includes('bi week') || f.includes('every 2')) return 2.17;
  if (f.includes('month')   || f === '')                       return 1;
  if (f.includes('quarter'))                                   return 1 / 3;
  if (f.includes('semi') || f.includes('half'))                return 1 / 6;
  if (f.includes('annual')  || f.includes('year'))             return 1 / 12;
  if (f.includes('one-time') || f.includes('onetime') || f.includes('one time') || f.includes('single')) return 1;
  return 1; // unknown → assume monthly
}

/** Fuzzy find a column index whose header contains any of the given keywords. */
function findCol(headers: string[], ...keywords: string[]): number {
  return headers.findIndex((h) => keywords.some((k) => h.includes(k)));
}

function guessCategory(label: string, rawCat: string): NodeCategory {
  const cat = rawCat.toLowerCase().trim();
  if (CATEGORY_MAP[cat]) return CATEGORY_MAP[cat];
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (cat.includes(key) || key.includes(cat)) return val;
  }
  const words = label.toLowerCase().split(/\s+/);
  for (const w of words) {
    if (CATEGORY_MAP[w]) return CATEGORY_MAP[w];
  }
  return 'OpEx';
}

function isRevenueRow(typeVal: string, categoryVal: string): boolean {
  const combined = `${typeVal} ${categoryVal}`.toLowerCase();
  return Array.from(REVENUE_SIGNALS).some((s) => combined.includes(s));
}

function parseCsvToNodes(raw: string): { nodes: Node<AnyNodeData>[]; error: string | null } {
  const lines = raw.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return { nodes: [], error: 'Need at least a header row and one data row.' };

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

  const labelCol    = findCol(headers, 'description', 'label', 'name', 'item', 'product', 'service', 'line');
  const valueCol    = findCol(headers, 'amount', 'value', 'cost', 'price', 'payment', 'total', 'revenue', 'monthly');
  const freqCol     = findCol(headers, 'frequency', 'freq', 'period', 'schedule', 'recurrence', 'recurring');
  const categoryCol = findCol(headers, 'category', 'cat', 'type', 'kind', 'class', 'bucket', 'group');

  if (labelCol  === -1) return { nodes: [], error: 'Could not find a label/description column.' };
  if (valueCol  === -1) return { nodes: [], error: 'Could not find an amount/value column.' };

  const nodes: Node<AnyNodeData>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals    = lines[i].split(',').map((v) => v.trim());
    const label   = vals[labelCol]    ?? '';
    const rawAmt  = vals[valueCol]    ?? '0';
    const rawFreq = freqCol >= 0      ? (vals[freqCol]    ?? '') : '';
    const rawCat  = categoryCol >= 0  ? (vals[categoryCol] ?? '') : '';

    if (!label) continue;

    const amount     = parseFloat(rawAmt.replace(/[$,\s]/g, '')) || 0;
    const multiplier = frequencyMultiplier(rawFreq);
    const monthly    = Math.round(amount * multiplier);
    const isSource   = isRevenueRow('', rawCat);

    const freqNote   = rawFreq && rawFreq.toLowerCase() !== 'monthly'
      ? ` (${rawFreq} → monthly)`
      : '';

    const node: Node<AnyNodeData> = {
      id: `imported-${Date.now()}-${i}`,
      type: isSource ? 'source' : 'expense',
      position: { x: 0, y: 0 },
      data: isSource
        ? { label: label + freqNote, value: monthly }
        : { label: label + freqNote, value: monthly, category: guessCategory(label, rawCat) },
    };
    nodes.push(node);
  }

  if (nodes.length === 0) return { nodes: [], error: 'No valid rows found. Check your column names and values.' };
  return { nodes, error: null };
}

// ─────────────────────────────────────────────────────────────────────────────

const PLACEHOLDER = `Description,Amount,Frequency,Category
Daily Bread Sales,450.00,Daily,Revenue
Monthly Rent - Unit 104,2800.00,Monthly,Fixed Cost
Enbridge Gas Bill,315.40,Monthly,Utilities
Part-time Staff Wages,1200.00,Weekly,Labor
Bulk Flour and Yeast,850.00,Bi-weekly,Inventory
Coffee Bean Subscription,200.00,Monthly,Inventory
Custom Cake Deposit,150.00,One-time,Revenue
Liability Insurance,120.00,Monthly,Insurance`;

function PreviewRow({ node }: { node: Node<AnyNodeData> }) {
  const isSource = node.type === 'source';
  const data = node.data as { label: string; value: number; category?: string };
  return (
    <div
      className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs border ${
        isSource
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-rose-50 border-rose-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold ${isSource ? 'text-emerald-600' : 'text-rose-600'}`}>
          {isSource ? 'REV' : 'EXP'}
        </span>
        <span style={{ color: 'var(--forest)' }}>{data.label}</span>
        {data.category && (
          <span
            className="text-[9px] px-1 rounded border"
            style={{ color: 'var(--moss)', borderColor: 'var(--forest-rim)', background: 'var(--forest-mid)' }}
          >
            {data.category}
          </span>
        )}
      </div>
      <span className={`tabular-nums font-medium ${isSource ? 'text-emerald-600' : 'text-rose-600'}`}>
        ${data.value.toLocaleString()}
      </span>
    </div>
  );
}

export default function ImportModal({ onClose, onImport }: Props) {
  const [csv, setCsv]     = useState('');
  const [error, setError] = useState<string | null>(null);

  const { nodes: preview, error: previewError } = csv.trim()
    ? parseCsvToNodes(csv)
    : { nodes: [], error: null };

  const handleImport = () => {
    const { nodes, error: parseError } = parseCsvToNodes(csv);
    if (parseError) { setError(parseError); return; }
    onImport(nodes, []);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg mx-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--cream)', border: '1px solid var(--forest-rim)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--forest-rim)' }}
        >
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4" style={{ color: 'var(--sage)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--forest)' }}>Import from CSV</h2>
          </div>
          <button
            onClick={onClose}
            className="transition-colors"
            style={{ color: 'var(--moss)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--forest)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--moss)')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--moss)' }}>
            Paste any CSV — column names are detected automatically. Amounts are normalized to monthly
            using the frequency column (Daily, Weekly, Bi-weekly, Monthly, Annual, etc.).
            Rows with a category containing "Revenue" or "Income" become revenue nodes; everything else is an expense.
          </p>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--moss)' }}>
                Spreadsheet Data
              </label>
              <button
                onClick={() => { setCsv(PLACEHOLDER); setError(null); }}
                className="text-[10px] transition-colors"
                style={{ color: 'var(--sage)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--moss)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--sage)')}
              >
                Load example
              </button>
            </div>
            <textarea
              value={csv}
              onChange={(e) => { setCsv(e.target.value); setError(null); }}
              placeholder={PLACEHOLDER}
              rows={6}
              className="w-full rounded-lg px-3 py-2.5 text-xs focus:outline-none transition-colors resize-none font-mono leading-relaxed"
              style={{
                background: 'var(--forest-mid)',
                border: '1px solid var(--forest-rim)',
                color: 'var(--forest)',
              }}
            />
          </div>

          {/* Live preview */}
          {preview.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-3 h-3 text-emerald-600" />
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--moss)' }}>
                  Preview — {preview.length} node{preview.length !== 1 ? 's' : ''} detected
                </span>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {preview.map((n) => <PreviewRow key={n.id} node={n} />)}
              </div>
            </div>
          )}

          {(error || (csv.trim() && previewError)) && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-600">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {error ?? previewError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-5 py-4"
          style={{ borderTop: '1px solid var(--forest-rim)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{ color: 'var(--moss)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--forest)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--moss)')}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={preview.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ background: 'var(--forest)' }}
            onMouseEnter={(e) => { if (preview.length > 0) (e.currentTarget as HTMLButtonElement).style.background = 'var(--moss)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--forest)'; }}
          >
            <Upload className="w-4 h-4" />
            Add {preview.length > 0 ? `${preview.length} ` : ''}Nodes to Canvas
          </button>
        </div>
      </div>
    </div>
  );
}
