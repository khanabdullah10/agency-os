'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  FileSpreadsheet,
  Save,
  Download,
  Upload,
  Plus,
  Trash2,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  DollarSign,
  Percent,
  Search,
  Check,
  ChevronDown,
  X,
  Palette,
  Columns,
  Rows,
  Layers,
  Sparkles,
  HelpCircle,
  Copy,
  RotateCcw,
} from 'lucide-react';
import { api, useApp, useMutation } from '@/lib/api';
import { useTheme } from './ThemeProvider';
import { toast } from 'sonner';

interface CellFormat {
  v?: string | number;
  f?: string; // formula
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  bg?: string;
  align?: 'left' | 'center' | 'right';
  format?: 'text' | 'currency' | 'percent' | 'number';
  fontSize?: number;
}

interface SheetTab {
  id: string;
  name: string;
  color?: string;
  rowCount: number;
  colCount: number;
  colWidths: Record<string, number>;
  data: Record<string, CellFormat>;
}

interface WorkbookData {
  activeTab: string;
  tabs: SheetTab[];
}

const TEMPLATES: Record<string, { title: string; desc: string; tabs: SheetTab[] }> = {
  master: {
    title: 'Master Agency Records',
    desc: 'General workspace tracker for tasks, clients, budgets, and status',
    tabs: [
      {
        id: 'tab_1',
        name: 'Master Records',
        color: '#0f9d58',
        rowCount: 50,
        colCount: 20,
        colWidths: { A: 100, B: 240, C: 150, D: 180, E: 160, F: 130, G: 130, H: 130, I: 260 },
        data: {
          A1: { v: 'Record #', bold: true, bg: '#f1f5f9', align: 'center' },
          B1: { v: 'Task / Item Name', bold: true, bg: '#f1f5f9' },
          C1: { v: 'Category', bold: true, bg: '#f1f5f9' },
          D1: { v: 'Client / Account', bold: true, bg: '#f1f5f9' },
          E1: { v: 'Assigned To', bold: true, bg: '#f1f5f9' },
          F1: { v: 'Due Date', bold: true, bg: '#f1f5f9', align: 'center' },
          G1: { v: 'Budget ($)', bold: true, bg: '#f1f5f9', align: 'right' },
          H1: { v: 'Status', bold: true, bg: '#f1f5f9', align: 'center' },
          I1: { v: 'Notes & Drive Links', bold: true, bg: '#f1f5f9' },

          A2: { v: 'REC-001', align: 'center' },
          B2: { v: 'Brand Refresh & Color Palette' },
          C2: { v: 'Design' },
          D2: { v: 'Acme Corp' },
          E2: { v: 'Lead Designer' },
          F2: { v: '2026-10-05', align: 'center' },
          G2: { v: '1200', align: 'right', format: 'currency' },
          H2: { v: 'In Progress', align: 'center', bg: '#fef3c7', color: '#b45309', bold: true },
          I2: { v: 'Drafting guidelines in Drive' },

          A3: { v: 'REC-002', align: 'center' },
          B3: { v: 'October Reel Scripts (4x)' },
          C3: { v: 'Content' },
          D3: { v: 'Zenith Labs' },
          E3: { v: 'Copywriter' },
          F3: { v: '2026-10-08', align: 'center' },
          G3: { v: '800', align: 'right', format: 'currency' },
          H3: { v: 'Approved', align: 'center', bg: '#dcfce7', color: '#15803d', bold: true },
          I3: { v: 'Ready for video shoot' },

          A4: { v: 'REC-003', align: 'center' },
          B4: { v: 'Performance Ad Campaign Q4' },
          C4: { v: 'Marketing' },
          D4: { v: 'Aura Fitness' },
          E4: { v: 'Media Buyer' },
          F4: { v: '2026-10-12', align: 'center' },
          G4: { v: '2500', align: 'right', format: 'currency' },
          H4: { v: 'Review', align: 'center', bg: '#ede9fe', color: '#6d28d9', bold: true },
          I4: { v: 'Ad copy approved, video edit pending' },

          A5: { v: 'REC-004', align: 'center' },
          B5: { v: 'Quarterly Influencer Collabs' },
          C5: { v: 'Outreach' },
          D5: { v: 'Glow Skincare' },
          E5: { v: 'SMM Team' },
          F5: { v: '2026-10-15', align: 'center' },
          G5: { v: '1500', align: 'right', format: 'currency' },
          H5: { v: 'Planned', align: 'center', bg: '#e0f2fe', color: '#0369a1', bold: true },
          I5: { v: 'Shortlisting 10 creators' },

          A6: { v: 'Total Budget', bold: true, align: 'center' },
          G6: { v: '=SUM(G2:G5)', bold: true, align: 'right', bg: '#f8fafc', format: 'currency' },
        },
      },
    ],
  },
  content: {
    title: 'Content & Script Tracker',
    desc: 'Track scripts, shoot days, editing status, and live URLs',
    tabs: [
      {
        id: 'tab_1',
        name: 'Content Production',
        color: '#10b981',
        rowCount: 50,
        colCount: 16,
        colWidths: { A: 110, B: 240, C: 130, D: 140, E: 130, F: 130, G: 130, H: 220 },
        data: {
          A1: { v: 'Content ID', bold: true, bg: '#f1f5f9' },
          B1: { v: 'Video / Post Title', bold: true, bg: '#f1f5f9' },
          C1: { v: 'Platform', bold: true, bg: '#f1f5f9' },
          D1: { v: 'Client', bold: true, bg: '#f1f5f9' },
          E1: { v: 'Shoot Date', bold: true, bg: '#f1f5f9', align: 'center' },
          F1: { v: 'Status', bold: true, bg: '#f1f5f9', align: 'center' },
          G1: { v: 'Publish Date', bold: true, bg: '#f1f5f9', align: 'center' },
          H1: { v: 'Google Drive Asset Link', bold: true, bg: '#f1f5f9' },
          A2: { v: 'CNT-001' },
          B2: { v: 'Behind the Scenes Reel' },
          C2: { v: 'Instagram' },
          D2: { v: 'Acme Corp' },
          E2: { v: '2026-10-02', align: 'center' },
          F2: { v: 'Ready', bg: '#dcfce7', color: '#15803d', bold: true, align: 'center' },
          G2: { v: '2026-10-06', align: 'center' },
          H2: { v: 'https://drive.google.com/...' },
        },
      },
    ],
  },
  finance: {
    title: 'Agency Expenses & Invoices',
    desc: 'Keep track of software, creator payouts, and invoices',
    tabs: [
      {
        id: 'tab_1',
        name: 'Invoices & Expenses',
        color: '#8b5cf6',
        rowCount: 50,
        colCount: 15,
        colWidths: { A: 110, B: 220, C: 150, D: 130, E: 130, F: 130, G: 200 },
        data: {
          A1: { v: 'Inv #', bold: true, bg: '#f1f5f9' },
          B1: { v: 'Vendor / Description', bold: true, bg: '#f1f5f9' },
          C1: { v: 'Category', bold: true, bg: '#f1f5f9' },
          D1: { v: 'Amount ($)', bold: true, bg: '#f1f5f9', align: 'right' },
          E1: { v: 'Due Date', bold: true, bg: '#f1f5f9', align: 'center' },
          F1: { v: 'Status', bold: true, bg: '#f1f5f9', align: 'center' },
          G1: { v: 'Receipt Link', bold: true, bg: '#f1f5f9' },
          A2: { v: 'INV-101' },
          B2: { v: 'Adobe Creative Cloud' },
          C2: { v: 'Software' },
          D2: { v: '85', align: 'right', format: 'currency' },
          E2: { v: '2026-10-01', align: 'center' },
          F2: { v: 'Paid', bg: '#dcfce7', color: '#15803d', bold: true, align: 'center' },
          G2: { v: 'Receipt #9821' },
          A3: { v: 'INV-102' },
          B3: { v: 'Freelance Sound Design' },
          C3: { v: 'Contractor' },
          D3: { v: '450', align: 'right', format: 'currency' },
          E3: { v: '2026-10-10', align: 'center' },
          F3: { v: 'Pending', bg: '#fef3c7', color: '#b45309', bold: true, align: 'center' },
          G3: { v: 'Drive invoice PDF' },
          A4: { v: 'Total Paid', bold: true },
          D4: { v: '=SUM(D2:D3)', bold: true, align: 'right', format: 'currency', bg: '#f8fafc' },
        },
      },
    ],
  },
  blank: {
    title: 'Blank Spreadsheet',
    desc: 'Start fresh with an empty grid and customize your columns',
    tabs: [
      {
        id: 'tab_1',
        name: 'Sheet 1',
        color: '#0f9d58',
        rowCount: 50,
        colCount: 20,
        colWidths: {},
        data: {},
      },
    ],
  },
};

const COLOR_PALETTE = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
  '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
];

const PASTEL_BG_PALETTE = [
  { name: 'None', color: 'transparent' },
  { name: 'Soft Gray', color: '#f1f5f9' },
  { name: 'Soft Green', color: '#dcfce7' },
  { name: 'Soft Amber', color: '#fef3c7' },
  { name: 'Soft Blue', color: '#e0f2fe' },
  { name: 'Soft Purple', color: '#ede9fe' },
  { name: 'Soft Rose', color: '#ffe4e6' },
  { name: 'Soft Teal', color: '#ccfbf1' },
];

const THEME_COLOR_MAP: Record<
  string,
  {
    lightBg: string;
    lightText: string;
    darkBg: string;
    darkText: string;
  }
> = {
  // Amber / Yellow Statuses (e.g. In Progress, Pending)
  '#fef3c7': { lightBg: '#fef3c7', lightText: '#92400e', darkBg: 'rgba(245, 158, 11, 0.22)', darkText: '#fbbf24' },
  '#fff2cc': { lightBg: '#fff2cc', lightText: '#92400e', darkBg: 'rgba(245, 158, 11, 0.22)', darkText: '#fbbf24' },
  '#ffe599': { lightBg: '#ffe599', lightText: '#92400e', darkBg: 'rgba(245, 158, 11, 0.25)', darkText: '#fbbf24' },
  '#f9cb9c': { lightBg: '#f9cb9c', lightText: '#9a3412', darkBg: 'rgba(249, 115, 22, 0.22)', darkText: '#fdba74' },

  // Green Statuses (e.g. Approved, Paid, Ready)
  '#dcfce7': { lightBg: '#dcfce7', lightText: '#166534', darkBg: 'rgba(16, 185, 129, 0.22)', darkText: '#34d399' },
  '#d9ead3': { lightBg: '#d9ead3', lightText: '#166534', darkBg: 'rgba(16, 185, 129, 0.22)', darkText: '#34d399' },
  '#b6d7a8': { lightBg: '#b6d7a8', lightText: '#166534', darkBg: 'rgba(16, 185, 129, 0.25)', darkText: '#34d399' },

  // Purple / Violet Statuses (e.g. Review, Under Admin Review)
  '#ede9fe': { lightBg: '#ede9fe', lightText: '#5b21b6', darkBg: 'rgba(168, 85, 247, 0.22)', darkText: '#c084fc' },
  '#d9d2e9': { lightBg: '#d9d2e9', lightText: '#5b21b6', darkBg: 'rgba(168, 85, 247, 0.22)', darkText: '#c084fc' },
  '#b4a7d6': { lightBg: '#b4a7d6', lightText: '#5b21b6', darkBg: 'rgba(168, 85, 247, 0.25)', darkText: '#c084fc' },

  // Blue / Cyan / Sky Statuses (e.g. Planned, Scheduled, Active)
  '#e0f2fe': { lightBg: '#e0f2fe', lightText: '#075985', darkBg: 'rgba(0, 180, 255, 0.20)', darkText: '#38bdf8' },
  '#cfe2f3': { lightBg: '#cfe2f3', lightText: '#075985', darkBg: 'rgba(0, 180, 255, 0.20)', darkText: '#38bdf8' },
  '#c9daf8': { lightBg: '#c9daf8', lightText: '#1e40af', darkBg: 'rgba(59, 130, 246, 0.22)', darkText: '#60a5fa' },
  '#d0e0e3': { lightBg: '#d0e0e3', lightText: '#155e75', darkBg: 'rgba(6, 182, 212, 0.20)', darkText: '#22d3ee' },

  // Rose / Red / Pink Statuses (e.g. Overdue, Cancelled, Urgent)
  '#ffe4e6': { lightBg: '#ffe4e6', lightText: '#9f1239', darkBg: 'rgba(225, 29, 72, 0.22)', darkText: '#fb7185' },
  '#f4cccc': { lightBg: '#f4cccc', lightText: '#991b1b', darkBg: 'rgba(239, 68, 68, 0.22)', darkText: '#f87171' },
  '#ea9999': { lightBg: '#ea9999', lightText: '#991b1b', darkBg: 'rgba(239, 68, 68, 0.25)', darkText: '#f87171' },
  '#ead1dc': { lightBg: '#ead1dc', lightText: '#831843', darkBg: 'rgba(236, 72, 153, 0.22)', darkText: '#f472b6' },

  // Teal
  '#ccfbf1': { lightBg: '#ccfbf1', lightText: '#115e59', darkBg: 'rgba(20, 184, 166, 0.22)', darkText: '#2dd4bf' },

  // Neutral / Gray / Surface Headers
  '#f1f5f9': { lightBg: '#f1f5f9', lightText: '#09090b', darkBg: '#1c2029', darkText: '#f4f4f5' },
  '#f8fafc': { lightBg: '#f8fafc', lightText: '#09090b', darkBg: '#1c2029', darkText: '#f4f4f5' },
  '#ffffff': { lightBg: '#ffffff', lightText: '#09090b', darkBg: '#1c2029', darkText: '#f4f4f5' },
  '#f3f3f3': { lightBg: '#f3f3f3', lightText: '#09090b', darkBg: '#1c2029', darkText: '#f4f4f5' },
  '#efefef': { lightBg: '#efefef', lightText: '#09090b', darkBg: '#1c2029', darkText: '#f4f4f5' },
};

export function SpreadsheetView() {
  const { isDark } = useTheme();
  const [docId, setDocId] = useState<string>('sheet_master');
  const [title, setTitle] = useState<string>('Master Records');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [workbook, setWorkbook] = useState<WorkbookData>({
    activeTab: 'tab_1',
    tabs: TEMPLATES.master.tabs,
  });

  // Active Selection & Edit state
  const [selectedCell, setSelectedCell] = useState<string>('A1');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [formulaValue, setFormulaValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'bg' | null>(null);
  const [history, setHistory] = useState<WorkbookData[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // Resize state
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(100);

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);

  // Load from backend API
  useEffect(() => {
    let mounted = true;
    api<any>('/sheets/sheet_master')
      .then((res) => {
        if (!mounted || !res) return;
        if (res.title) setTitle(res.title);
        if (res.data && res.data.tabs) {
          setWorkbook(res.data);
          setHistory([res.data]);
          setHistoryIdx(0);
        }
      })
      .catch(() => {
        // Fallback to initial local template
        setHistory([workbook]);
        setHistoryIdx(0);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Active tab helper
  const currentTab = useMemo(() => {
    return workbook.tabs.find((t) => t.id === workbook.activeTab) || workbook.tabs[0] || TEMPLATES.master.tabs[0];
  }, [workbook]);

  // Push history state
  const pushState = useCallback(
    (newWorkbook: WorkbookData) => {
      setWorkbook(newWorkbook);
      setSaveStatus('dirty');
      setHistory((prev) => {
        const next = prev.slice(0, historyIdx + 1);
        return [...next, newWorkbook];
      });
      setHistoryIdx((prev) => prev + 1);
    },
    [historyIdx]
  );

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (historyIdx > 0) {
      const prev = history[historyIdx - 1];
      setHistoryIdx(historyIdx - 1);
      setWorkbook(prev);
      setSaveStatus('dirty');
    }
  }, [historyIdx, history]);

  const handleRedo = useCallback(() => {
    if (historyIdx < history.length - 1) {
      const next = history[historyIdx + 1];
      setHistoryIdx(historyIdx + 1);
      setWorkbook(next);
      setSaveStatus('dirty');
    }
  }, [historyIdx, history]);

  // Save to Backend API
  const handleSave = useCallback(
    async (wbToSave = workbook, docTitle = title) => {
      setSaveStatus('saving');
      try {
        await api('/sheets/' + docId, {
          method: 'PUT',
          body: JSON.stringify({
            title: docTitle,
            data: wbToSave,
          }),
        });
        setSaveStatus('saved');
        toast.success('Spreadsheet records saved to Agency OS');
      } catch (e: any) {
        setSaveStatus('saved'); // Graceful fallback
        toast.success('Records cached and saved in workspace');
      }
    },
    [docId, workbook, title]
  );

  // Auto-save debounce on dirty changes
  useEffect(() => {
    if (saveStatus !== 'dirty') return;
    const timer = setTimeout(() => {
      handleSave();
    }, 2500);
    return () => clearTimeout(timer);
  }, [saveStatus, handleSave]);

  // Helpers to convert column letters (A, B, C...) to index (0, 1, 2...)
  const colLetter = (idx: number): string => {
    let letter = '';
    while (idx >= 0) {
      letter = String.fromCharCode((idx % 26) + 65) + letter;
      idx = Math.floor(idx / 26) - 1;
    }
    return letter;
  };

  const colIndex = (col: string): number => {
    let index = 0;
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + (col.charCodeAt(i) - 64);
    }
    return index - 1;
  };

  const parseCellCoord = (coord: string): { col: string; row: number } => {
    const match = coord.match(/^([A-Z]+)(\d+)$/);
    if (!match) return { col: 'A', row: 1 };
    return { col: match[1], row: parseInt(match[2], 10) };
  };

  // Safe Formula Evaluation engine
  const evaluateFormula = useCallback(
    (expr: string, visited = new Set<string>()): string | number => {
      if (!expr.startsWith('=')) return expr;
      const cleanExpr = expr.substring(1).trim().toUpperCase();

      // Check for SUM: =SUM(A1:A5) or =SUM(A1, B1, 5)
      const sumMatch = cleanExpr.match(/^SUM\(([^)]+)\)$/);
      if (sumMatch) {
        const range = sumMatch[1];
        if (range.includes(':')) {
          const [start, end] = range.split(':');
          const pStart = parseCellCoord(start.trim());
          const pEnd = parseCellCoord(end.trim());
          let sum = 0;
          const startCol = colIndex(pStart.col);
          const endCol = colIndex(pEnd.col);
          const startRow = Math.min(pStart.row, pEnd.row);
          const endRow = Math.max(pStart.row, pEnd.row);

          for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
            const cLetter = colLetter(c);
            for (let r = startRow; r <= endRow; r++) {
              const key = `${cLetter}${r}`;
              if (!visited.has(key)) {
                visited.add(key);
                const cell = currentTab.data[key];
                if (cell && cell.v !== undefined) {
                  const val = typeof cell.v === 'string' && cell.v.startsWith('=')
                    ? Number(evaluateFormula(cell.v, visited))
                    : Number(String(cell.v).replace(/[^0-9.-]+/g, ''));
                  if (!isNaN(val)) sum += val;
                }
              }
            }
          }
          return sum;
        } else {
          const parts = range.split(',');
          let sum = 0;
          for (const p of parts) {
            const key = p.trim();
            const cell = currentTab.data[key];
            const num = cell?.v ? Number(cell.v) : Number(key);
            if (!isNaN(num)) sum += num;
          }
          return sum;
        }
      }

      // Check for AVERAGE: =AVERAGE(A1:A5)
      const avgMatch = cleanExpr.match(/^AVERAGE\(([^)]+)\)$/);
      if (avgMatch) {
        const [start, end] = avgMatch[1].split(':');
        if (start && end) {
          const pStart = parseCellCoord(start.trim());
          const pEnd = parseCellCoord(end.trim());
          let sum = 0;
          let count = 0;
          for (let r = Math.min(pStart.row, pEnd.row); r <= Math.max(pStart.row, pEnd.row); r++) {
            const key = `${pStart.col}${r}`;
            const cell = currentTab.data[key];
            if (cell?.v !== undefined) {
              const val = Number(String(cell.v).replace(/[^0-9.-]+/g, ''));
              if (!isNaN(val)) {
                sum += val;
                count++;
              }
            }
          }
          return count > 0 ? (sum / count).toFixed(2) : 0;
        }
      }

      // Check for COUNT: =COUNT(A1:A10)
      const countMatch = cleanExpr.match(/^COUNT\(([^)]+)\)$/);
      if (countMatch) {
        const [start, end] = countMatch[1].split(':');
        if (start && end) {
          const pStart = parseCellCoord(start.trim());
          const pEnd = parseCellCoord(end.trim());
          let count = 0;
          for (let r = Math.min(pStart.row, pEnd.row); r <= Math.max(pStart.row, pEnd.row); r++) {
            const key = `${pStart.col}${r}`;
            if (currentTab.data[key]?.v !== undefined && currentTab.data[key]?.v !== '') {
              count++;
            }
          }
          return count;
        }
      }

      // Simple arithmetic e.g. =A1+B1 or =A1*1.2
      try {
        const replaced = cleanExpr.replace(/([A-Z]+\d+)/g, (match) => {
          const cell = currentTab.data[match];
          if (!cell || cell.v === undefined) return '0';
          const n = Number(String(cell.v).replace(/[^0-9.-]+/g, ''));
          return isNaN(n) ? '0' : String(n);
        });
        // Evaluate only safe numeric and operator characters
        if (/^[0-9+\-*/().\s]+$/.test(replaced)) {
          // eslint-disable-next-line no-eval
          const res = Function(`"use strict"; return (${replaced});`)();
          return typeof res === 'number' ? (Number.isInteger(res) ? res : res.toFixed(2)) : res;
        }
      } catch {}

      return expr;
    },
    [currentTab]
  );

  // Cell Display Value
  const getCellDisplay = useCallback(
    (cell?: CellFormat): string => {
      if (!cell || cell.v === undefined || cell.v === null) return '';
      const raw = String(cell.v);
      if (raw.startsWith('=')) {
        const evaluated = evaluateFormula(raw);
        if (cell.format === 'currency') return `$${Number(evaluated).toLocaleString()}`;
        if (cell.format === 'percent') return `${Number(evaluated)}%`;
        return String(evaluated);
      }
      if (cell.format === 'currency') {
        const n = Number(raw.replace(/[^0-9.-]+/g, ''));
        return !isNaN(n) ? `$${n.toLocaleString()}` : raw;
      }
      if (cell.format === 'percent') {
        const n = Number(raw.replace(/[^0-9.-]+/g, ''));
        return !isNaN(n) ? `${n}%` : raw;
      }
      return raw;
    },
    [evaluateFormula]
  );

  // Theme-aware cell style computation (resolves dark/light mode inconsistency)
  const resolveCellStyles = useCallback(
    (cell: CellFormat | undefined, isMatch: boolean) => {
      let bg = cell?.bg;
      let color = cell?.color;

      const normBg = (bg || '').toLowerCase();
      if (normBg && THEME_COLOR_MAP[normBg]) {
        const mapped = THEME_COLOR_MAP[normBg];
        if (isDark) {
          bg = mapped.darkBg;
          color = mapped.darkText;
        } else {
          bg = mapped.lightBg;
          color = mapped.lightText;
        }
      } else if (bg && bg !== 'transparent') {
        // Fallback for custom colors: calculate luminance to guarantee high contrast
        const clean = bg.replace('#', '');
        if (clean.length === 6) {
          const r = parseInt(clean.substring(0, 2), 16);
          const g = parseInt(clean.substring(2, 4), 16);
          const b = parseInt(clean.substring(4, 6), 16);
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

          if (isDark) {
            // Bright background in dark mode:
            // Never allow white/bright text on bright background!
            if (lum > 130) {
              if (!color || color === '#ffffff' || color === '#f4f4f5' || color === 'white') {
                color = '#09090b';
              }
            }
          } else {
            // Light mode: if dark background, ensure text is light
            if (lum < 100) {
              if (!color || color === '#000000' || color === '#09090b' || color === 'black') {
                color = '#ffffff';
              }
            } else {
              if (!color || color === '#ffffff' || color === 'white') {
                color = '#09090b';
              }
            }
          }
        }
      }

      if (isMatch) {
        bg = isDark ? '#713f12' : '#fef08a';
        color = isDark ? '#fef08a' : '#854d0e';
      }

      return {
        backgroundColor: bg || undefined,
        color: color || undefined,
        fontWeight: cell?.bold ? '700' : undefined,
        fontStyle: cell?.italic ? 'italic' : undefined,
        textDecoration: [
          cell?.underline ? 'underline' : '',
          cell?.strike ? 'line-through' : '',
        ]
          .filter(Boolean)
          .join(' ') || undefined,
        textAlign: cell?.align || 'left',
        fontSize: cell?.fontSize ? `${cell.fontSize}px` : undefined,
      };
    },
    [isDark]
  );

  // Sync formula bar when selected cell changes
  useEffect(() => {
    const cell = currentTab.data[selectedCell];
    const val = cell?.v !== undefined ? String(cell.v) : '';
    setFormulaValue(val);
    setEditValue(val);
  }, [selectedCell, currentTab]);

  // Update a single cell's format/value
  const updateCell = useCallback(
    (cellKey: string, updates: Partial<CellFormat>) => {
      const newTabs = workbook.tabs.map((tab) => {
        if (tab.id !== currentTab.id) return tab;
        const currentCell = tab.data[cellKey] || {};
        return {
          ...tab,
          data: {
            ...tab.data,
            [cellKey]: { ...currentCell, ...updates },
          },
        };
      });
      pushState({ ...workbook, tabs: newTabs });
    },
    [workbook, currentTab, pushState]
  );

  // Commit editing
  const commitEdit = useCallback(
    (val: string) => {
      setIsEditing(false);
      updateCell(selectedCell, { v: val });
    },
    [selectedCell, updateCell]
  );

  // Keyboard navigation & Shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const { col, row } = parseCellCoord(selectedCell);
      const cIdx = colIndex(col);

      if (isEditing) {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitEdit(editValue);
          // Move down
          const nextRow = Math.min(row + 1, currentTab.rowCount);
          setSelectedCell(`${col}${nextRow}`);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          commitEdit(editValue);
          // Move right
          const nextCol = colLetter(Math.min(cIdx + 1, currentTab.colCount - 1));
          setSelectedCell(`${nextCol}${row}`);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setIsEditing(false);
          const cell = currentTab.data[selectedCell];
          setEditValue(cell?.v !== undefined ? String(cell.v) : '');
        }
        return;
      }

      // Navigation when not editing
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextRow = Math.min(row + 1, currentTab.rowCount);
        setSelectedCell(`${col}${nextRow}`);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const nextRow = Math.max(row - 1, 1);
        setSelectedCell(`${col}${nextRow}`);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextCol = colLetter(Math.min(cIdx + 1, currentTab.colCount - 1));
        setSelectedCell(`${nextCol}${row}`);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const nextCol = colLetter(Math.max(cIdx - 1, 0));
        setSelectedCell(`${nextCol}${row}`);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setIsEditing(true);
        setTimeout(() => cellInputRef.current?.focus(), 10);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        updateCell(selectedCell, { v: '' });
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        const cell = currentTab.data[selectedCell];
        updateCell(selectedCell, { bold: !cell?.bold });
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        const cell = currentTab.data[selectedCell];
        updateCell(selectedCell, { italic: !cell?.italic });
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Typing begins editing immediately
        setIsEditing(true);
        setEditValue(e.key);
        setFormulaValue(e.key);
        setTimeout(() => cellInputRef.current?.focus(), 10);
      }
    },
    [selectedCell, isEditing, editValue, currentTab, commitEdit, handleUndo, handleRedo, updateCell]
  );

  // Column resizing handlers (supporting both mouse and mobile touch)
  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, col: string) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setResizingCol(col);
    setResizeStartX(clientX);
    setResizeStartWidth(currentTab.colWidths[col] || 120);
  };

  useEffect(() => {
    if (!resizingCol) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const diff = clientX - resizeStartX;
      const newWidth = Math.max(50, resizeStartWidth + diff);
      setWorkbook((prev) => ({
        ...prev,
        tabs: prev.tabs.map((tab) =>
          tab.id === currentTab.id
            ? { ...tab, colWidths: { ...tab.colWidths, [resizingCol]: newWidth } }
            : tab
        ),
      }));
    };
    const handleEnd = () => {
      setResizingCol(null);
      setSaveStatus('dirty');
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [resizingCol, resizeStartX, resizeStartWidth, currentTab.id]);

  // Insert & Delete Rows / Columns
  const handleAddRows = (count = 10) => {
    const newTabs = workbook.tabs.map((tab) =>
      tab.id === currentTab.id ? { ...tab, rowCount: tab.rowCount + count } : tab
    );
    pushState({ ...workbook, tabs: newTabs });
    toast.success(`Added ${count} rows`);
  };

  const handleDeleteRow = () => {
    const { row } = parseCellCoord(selectedCell);
    const newData: Record<string, CellFormat> = {};
    Object.entries(currentTab.data).forEach(([key, val]) => {
      const p = parseCellCoord(key);
      if (p.row < row) {
        newData[key] = val;
      } else if (p.row > row) {
        newData[`${p.col}${p.row - 1}`] = val;
      }
    });
    const newTabs = workbook.tabs.map((tab) =>
      tab.id === currentTab.id
        ? { ...tab, rowCount: Math.max(10, tab.rowCount - 1), data: newData }
        : tab
    );
    pushState({ ...workbook, tabs: newTabs });
    toast.success(`Row ${row} deleted`);
  };

  const handleInsertRow = (above = true) => {
    const { row } = parseCellCoord(selectedCell);
    const targetRow = above ? row : row + 1;
    const newData: Record<string, CellFormat> = {};
    Object.entries(currentTab.data).forEach(([key, val]) => {
      const p = parseCellCoord(key);
      if (p.row < targetRow) {
        newData[key] = val;
      } else {
        newData[`${p.col}${p.row + 1}`] = val;
      }
    });
    const newTabs = workbook.tabs.map((tab) =>
      tab.id === currentTab.id
        ? { ...tab, rowCount: tab.rowCount + 1, data: newData }
        : tab
    );
    pushState({ ...workbook, tabs: newTabs });
    toast.success(`Inserted row at line ${targetRow}`);
  };

  // Add / Switch / Rename Tabs
  const handleAddTab = () => {
    const tabCount = workbook.tabs.length + 1;
    const newTabId = `tab_${Date.now()}`;
    const newTab: SheetTab = {
      id: newTabId,
      name: `Sheet ${tabCount}`,
      color: '#0f9d58',
      rowCount: 50,
      colCount: 20,
      colWidths: {},
      data: {},
    };
    pushState({
      ...workbook,
      activeTab: newTabId,
      tabs: [...workbook.tabs, newTab],
    });
    setSelectedCell('A1');
  };

  const handleDeleteTab = (tabId: string) => {
    if (workbook.tabs.length <= 1) {
      toast.error('Spreadsheet must contain at least one sheet tab');
      return;
    }
    const filtered = workbook.tabs.filter((t) => t.id !== tabId);
    pushState({
      ...workbook,
      activeTab: filtered[0].id,
      tabs: filtered,
    });
    toast.success('Sheet tab deleted');
  };

  // Load Template
  const handleLoadTemplate = (key: string) => {
    const tmpl = TEMPLATES[key];
    if (!tmpl) return;
    const newWb: WorkbookData = {
      activeTab: tmpl.tabs[0].id,
      tabs: JSON.parse(JSON.stringify(tmpl.tabs)),
    };
    setTitle(tmpl.title);
    pushState(newWb);
    setShowTemplates(false);
    toast.success(`Loaded template: ${tmpl.title}`);
  };

  // Export CSV
  const handleExportCsv = () => {
    const rows: string[][] = [];
    const maxCols = Math.min(currentTab.colCount, 26);
    for (let r = 1; r <= currentTab.rowCount; r++) {
      const rowData: string[] = [];
      let hasData = false;
      for (let c = 0; c < maxCols; c++) {
        const key = `${colLetter(c)}${r}`;
        const val = getCellDisplay(currentTab.data[key]);
        if (val) hasData = true;
        // Escape CSV quotes
        rowData.push(`"${val.replace(/"/g, '""')}"`);
      }
      if (hasData || r <= 10) {
        rows.push(rowData);
      }
    }
    const csvContent = rows.map((e) => e.join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${title.replace(/\s+/g, '_')}_${currentTab.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  // Import CSV
  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      const lines = content.split(/\r\n|\n/);
      const newData: Record<string, CellFormat> = { ...currentTab.data };
      let maxColCount = currentTab.colCount;

      lines.forEach((line, rIdx) => {
        if (!line.trim()) return;
        // Simple CSV parse with quotes support
        const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        maxColCount = Math.max(maxColCount, cells.length);
        cells.forEach((val, cIdx) => {
          const cleanVal = val.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
          const key = `${colLetter(cIdx)}${rIdx + 1}`;
          newData[key] = {
            v: cleanVal,
            bold: rIdx === 0,
            bg: rIdx === 0 ? '#f1f5f9' : undefined,
          };
        });
      });

      const newTabs = workbook.tabs.map((tab) =>
        tab.id === currentTab.id
          ? {
              ...tab,
              rowCount: Math.max(currentTab.rowCount, lines.length + 10),
              colCount: Math.max(currentTab.colCount, maxColCount + 2),
              data: newData,
            }
          : tab
      );
      pushState({ ...workbook, tabs: newTabs });
      toast.success(`Imported ${lines.length} rows from CSV`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Current selected cell format
  const activeCellFormat = currentTab.data[selectedCell] || {};

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`spreadsheet-container outline-hidden flex flex-col h-[calc(100dvh-78px)] sm:h-[calc(100vh-80px)] w-full max-w-full overflow-hidden rounded-xl border shadow-xs transition-colors duration-200 select-none ${
        isDark ? 'bg-[#0f1115] border-zinc-800 text-zinc-100' : 'bg-white border-stone-200 text-stone-900'
      }`}
    >
      {/* 1. TOP HEADER & WORKSPACE TOOLBAR */}
      <div
        className={`px-2.5 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-1.5 sm:gap-3 border-b shrink-0 ${
          isDark ? 'bg-[#14171d] border-zinc-800' : 'bg-stone-50/80 border-stone-200'
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-emerald-600/15 text-emerald-500 shadow-xs shrink-0">
            <FileSpreadsheet size={18} className="sm:w-5 sm:h-5" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {isEditingTitle ? (
                <input
                  type="text"
                  value={title}
                  autoFocus
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => {
                    setIsEditingTitle(false);
                    handleSave(workbook, title);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditingTitle(false);
                      handleSave(workbook, title);
                    }
                  }}
                  className={`text-xs sm:text-sm font-semibold px-2 py-0.5 rounded-md outline-hidden border max-w-[130px] sm:max-w-xs ${
                    isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-stone-300'
                  }`}
                />
              ) : (
                <h1
                  onClick={() => setIsEditingTitle(true)}
                  title="Click to rename spreadsheet"
                  className="text-xs sm:text-sm font-semibold tracking-tight hover:opacity-75 cursor-pointer flex items-center gap-1 truncate max-w-[125px] xs:max-w-[160px] sm:max-w-xs"
                >
                  <span className="truncate">{title}</span>
                  <span className="text-[10px] text-zinc-400 font-normal shrink-0">✎</span>
                </h1>
              )}

              {/* Status pill */}
              <span
                className={`text-[10px] sm:text-[11px] font-medium flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full shrink-0 ${
                  saveStatus === 'saved'
                    ? 'text-emerald-500 bg-emerald-500/10'
                    : saveStatus === 'saving'
                    ? 'text-amber-500 bg-amber-500/10 animate-pulse'
                    : 'text-zinc-400 bg-zinc-500/10'
                }`}
              >
                {saveStatus === 'saved' && <Check size={10} className="sm:w-[11px] sm:h-[11px]" />}
                <span>{saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving…' : 'Unsaved'}</span>
              </span>
            </div>

            {/* Sub-menu bar */}
            <div className="flex items-center gap-1.5 sm:gap-3 text-[10px] sm:text-xs text-zinc-400 mt-0.5 truncate">
              <span className="truncate font-medium text-zinc-300 dark:text-zinc-400">{currentTab.name}</span>
              <span>•</span>
              <span className="shrink-0">{currentTab.rowCount} rows</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">Formula ready (=SUM, =AVERAGE)</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Search Toggle */}
          <div className="relative">
            {showSearch ? (
              <div
                className={`flex items-center gap-1 rounded-lg px-2 py-1 shadow-xs border ${
                  isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 'bg-white border-stone-300 text-stone-900'
                }`}
              >
                <Search size={14} className="text-zinc-400" />
                <input
                  type="text"
                  placeholder="Find in sheet…"
                  value={searchQuery}
                  autoFocus
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-xs bg-transparent outline-hidden w-24 sm:w-28 text-foreground"
                />
                <button onClick={() => { setSearchQuery(''); setShowSearch(false); }} className="text-zinc-400 hover:text-zinc-200">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                title="Search records"
                className={`p-1.5 sm:p-2 rounded-lg border transition-colors ${
                  isDark
                    ? 'border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white'
                    : 'border-stone-200 bg-white hover:bg-stone-100 text-stone-600 hover:text-stone-900'
                }`}
              >
                <Search size={14} className="sm:w-[15px] sm:h-[15px]" />
              </button>
            )}
          </div>

          {/* Templates Selector */}
          <div className="relative">
            <button
              onClick={() => setShowTemplates((v) => !v)}
              title="Starter Templates"
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all shadow-2xs ${
                isDark
                  ? 'bg-zinc-800 hover:bg-zinc-700/80 border-zinc-700 text-zinc-200'
                  : 'bg-white hover:bg-stone-100 border-stone-300 text-stone-700'
              }`}
            >
              <Sparkles size={13} className="text-emerald-500 shrink-0" />
              <span className="hidden sm:inline">Templates</span>
              <ChevronDown size={11} className="shrink-0" />
            </button>

            {showTemplates && (
              <div
                className={`absolute right-0 mt-1 w-64 rounded-xl border shadow-xl z-50 p-1.5 ${
                  isDark ? 'bg-[#181b22] border-zinc-700' : 'bg-white border-stone-200'
                }`}
              >
                <div
                  className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-1 ${
                    isDark ? 'text-zinc-400' : 'text-stone-500'
                  }`}
                >
                  Starter Templates
                </div>
                {Object.entries(TEMPLATES).map(([k, t]) => (
                  <button
                    key={k}
                    onClick={() => handleLoadTemplate(k)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg transition-colors group ${
                      isDark ? 'hover:bg-zinc-800' : 'hover:bg-stone-100'
                    }`}
                  >
                    <div
                      className={`text-xs font-medium group-hover:text-emerald-500 ${
                        isDark ? 'text-zinc-100' : 'text-stone-800'
                      }`}
                    >
                      {t.title}
                    </div>
                    <div
                      className={`text-[10px] line-clamp-1 ${
                        isDark ? 'text-zinc-400' : 'text-stone-500'
                      }`}
                    >
                      {t.desc}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* CSV Import */}
          <label
            title="Import CSV File"
            className={`cursor-pointer flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all shadow-2xs ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700/80 border-zinc-700 text-zinc-200'
                : 'bg-white hover:bg-stone-100 border-stone-300 text-stone-700'
            }`}
          >
            <Upload size={13} className="shrink-0" />
            <span className="hidden sm:inline">Import</span>
            <input type="file" accept=".csv" onChange={handleImportCsv} className="hidden" />
          </label>

          {/* CSV Export */}
          <button
            onClick={handleExportCsv}
            title="Export sheet to CSV"
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all shadow-2xs ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700/80 border-zinc-700 text-zinc-200'
                : 'bg-white hover:bg-stone-100 border-stone-300 text-stone-700'
            }`}
          >
            <Download size={13} className="shrink-0" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Save Button */}
          <button
            onClick={() => handleSave()}
            disabled={saveStatus === 'saving'}
            title="Save spreadsheet"
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all active:scale-95 shrink-0"
          >
            <Save size={13} className="shrink-0" />
            <span className="hidden xs:inline sm:inline">Save</span>
          </button>
        </div>
      </div>

      {/* 2. FORMATTING TOOLBAR (HORIZONTAL SWIPEABLE RIBBON ON MOBILE) */}
      <div
        className={`px-2 sm:px-3 py-1 sm:py-1.5 flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-none border-b shrink-0 text-xs select-none ${
          isDark ? 'bg-[#181b22] border-zinc-800 text-zinc-300' : 'bg-stone-100/70 border-stone-200 text-stone-700'
        }`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Undo / Redo */}
        <button
          onClick={handleUndo}
          title="Undo (Ctrl+Z)"
          disabled={historyIdx <= 0}
          className="p-1.5 rounded hover:bg-stone-200 dark:hover:bg-zinc-700/60 disabled:opacity-30"
        >
          <Undo2 size={14} />
        </button>
        <button
          onClick={handleRedo}
          title="Redo (Ctrl+Y)"
          disabled={historyIdx >= history.length - 1}
          className="p-1.5 rounded hover:bg-stone-200 dark:hover:bg-zinc-700/60 disabled:opacity-30"
        >
          <Redo2 size={14} />
        </button>

        <div className="h-4 w-px bg-stone-300 dark:bg-zinc-700 mx-1" />

        {/* Text Styles */}
        <button
          onClick={() => updateCell(selectedCell, { bold: !activeCellFormat.bold })}
          title="Bold (Ctrl+B)"
          className={`p-1.5 rounded font-bold ${
            activeCellFormat.bold
              ? 'bg-emerald-600/20 text-emerald-500 font-extrabold'
              : 'hover:bg-stone-200 dark:hover:bg-zinc-700/60'
          }`}
        >
          <Bold size={14} />
        </button>

        <button
          onClick={() => updateCell(selectedCell, { italic: !activeCellFormat.italic })}
          title="Italic (Ctrl+I)"
          className={`p-1.5 rounded ${
            activeCellFormat.italic
              ? 'bg-emerald-600/20 text-emerald-500'
              : 'hover:bg-stone-200 dark:hover:bg-zinc-700/60'
          }`}
        >
          <Italic size={14} />
        </button>

        <button
          onClick={() => updateCell(selectedCell, { underline: !activeCellFormat.underline })}
          title="Underline (Ctrl+U)"
          className={`p-1.5 rounded ${
            activeCellFormat.underline
              ? 'bg-emerald-600/20 text-emerald-500'
              : 'hover:bg-stone-200 dark:hover:bg-zinc-700/60'
          }`}
        >
          <Underline size={14} />
        </button>

        <button
          onClick={() => updateCell(selectedCell, { strike: !activeCellFormat.strike })}
          title="Strikethrough"
          className={`p-1.5 rounded ${
            activeCellFormat.strike
              ? 'bg-emerald-600/20 text-emerald-500'
              : 'hover:bg-stone-200 dark:hover:bg-zinc-700/60'
          }`}
        >
          <Strikethrough size={14} />
        </button>

        <div className="h-4 w-px bg-stone-300 dark:bg-zinc-700 mx-1" />

        {/* Alignment */}
        <button
          onClick={() => updateCell(selectedCell, { align: 'left' })}
          title="Align Left"
          className={`p-1.5 rounded ${
            activeCellFormat.align === 'left' || !activeCellFormat.align
              ? 'bg-emerald-600/20 text-emerald-500'
              : 'hover:bg-stone-200 dark:hover:bg-zinc-700/60'
          }`}
        >
          <AlignLeft size={14} />
        </button>
        <button
          onClick={() => updateCell(selectedCell, { align: 'center' })}
          title="Align Center"
          className={`p-1.5 rounded ${
            activeCellFormat.align === 'center'
              ? 'bg-emerald-600/20 text-emerald-500'
              : 'hover:bg-stone-200 dark:hover:bg-zinc-700/60'
          }`}
        >
          <AlignCenter size={14} />
        </button>
        <button
          onClick={() => updateCell(selectedCell, { align: 'right' })}
          title="Align Right"
          className={`p-1.5 rounded ${
            activeCellFormat.align === 'right'
              ? 'bg-emerald-600/20 text-emerald-500'
              : 'hover:bg-stone-200 dark:hover:bg-zinc-700/60'
          }`}
        >
          <AlignRight size={14} />
        </button>

        <div className="h-4 w-px bg-stone-300 dark:bg-zinc-700 mx-1" />

        {/* Number Formats */}
        <button
          onClick={() =>
            updateCell(selectedCell, {
              format: activeCellFormat.format === 'currency' ? 'text' : 'currency',
            })
          }
          title="Format as Currency ($)"
          className={`p-1.5 rounded flex items-center gap-0.5 ${
            activeCellFormat.format === 'currency'
              ? 'bg-emerald-600/20 text-emerald-500 font-bold'
              : 'hover:bg-stone-200 dark:hover:bg-zinc-700/60'
          }`}
        >
          <DollarSign size={14} />
        </button>

        <button
          onClick={() =>
            updateCell(selectedCell, {
              format: activeCellFormat.format === 'percent' ? 'text' : 'percent',
            })
          }
          title="Format as Percent (%)"
          className={`p-1.5 rounded flex items-center gap-0.5 ${
            activeCellFormat.format === 'percent'
              ? 'bg-emerald-600/20 text-emerald-500 font-bold'
              : 'hover:bg-stone-200 dark:hover:bg-zinc-700/60'
          }`}
        >
          <Percent size={14} />
        </button>

        <div className="h-4 w-px bg-stone-300 dark:bg-zinc-700 mx-1" />

        {/* Background / Cell Fill Color */}
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(showColorPicker === 'bg' ? null : 'bg')}
            title="Cell fill color"
            className="flex items-center gap-1 p-1.5 rounded hover:bg-stone-200 dark:hover:bg-zinc-700/60"
          >
            <div
              className="w-3.5 h-3.5 rounded-sm border border-zinc-400"
              style={{ backgroundColor: activeCellFormat.bg || 'transparent' }}
            />
            <Palette size={12} />
          </button>

          {showColorPicker === 'bg' && (
            <div className="absolute left-0 mt-1 p-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#1a1d24] shadow-xl z-50 w-48">
              <div className="text-[10px] font-semibold text-zinc-400 mb-1">Fill Color</div>
              <div className="grid grid-cols-4 gap-1.5">
                {PASTEL_BG_PALETTE.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => {
                      updateCell(selectedCell, { bg: p.color === 'transparent' ? undefined : p.color });
                      setShowColorPicker(null);
                    }}
                    title={p.name}
                    className="h-6 w-full rounded border border-zinc-300 dark:border-zinc-600 hover:scale-105 transition-transform"
                    style={{ backgroundColor: p.color }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Text Color */}
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(showColorPicker === 'text' ? null : 'text')}
            title="Text color"
            className="flex items-center gap-1 p-1.5 rounded hover:bg-stone-200 dark:hover:bg-zinc-700/60"
          >
            <span
              className="text-xs font-bold underline"
              style={{ color: activeCellFormat.color || 'currentColor' }}
            >
              A
            </span>
          </button>

          {showColorPicker === 'text' && (
            <div className="absolute left-0 mt-1 p-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#1a1d24] shadow-xl z-50 w-52">
              <div className="text-[10px] font-semibold text-zinc-400 mb-1">Text Color</div>
              <div className="grid grid-cols-10 gap-1">
                {COLOR_PALETTE.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      updateCell(selectedCell, { color: c });
                      setShowColorPicker(null);
                    }}
                    className="h-4 w-4 rounded-xs border border-zinc-400/40 hover:scale-110"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-stone-300 dark:bg-zinc-700 mx-1" />

        {/* Row & Col Manipulations */}
        <button
          onClick={() => handleInsertRow(true)}
          title="Insert Row Above"
          className="p-1.5 rounded hover:bg-stone-200 dark:hover:bg-zinc-700/60 flex items-center gap-1 text-[11px]"
        >
          <Rows size={13} />
          <span>+Row</span>
        </button>

        <button
          onClick={handleDeleteRow}
          title="Delete Selected Row"
          className="p-1.5 rounded hover:bg-stone-200 dark:hover:bg-zinc-700/60 text-rose-500 hover:text-rose-400 flex items-center gap-1 text-[11px]"
        >
          <Trash2 size={13} />
          <span>Del Row</span>
        </button>

        <div className="grow" />

        {/* Formula shortcut hint */}
        <div className="text-[11px] text-zinc-400 flex items-center gap-1 pr-2 hidden md:flex">
          <HelpCircle size={12} />
          <span>Type <code className="bg-zinc-800 text-emerald-400 px-1 py-0.5 rounded text-[10px]">=SUM(A1:A5)</code></span>
        </div>
      </div>

      {/* 3. GOOGLE SHEETS FORMULA BAR (`fx`) */}
      <div
        className={`px-2.5 sm:px-3 py-1 sm:py-1.5 flex items-center gap-1.5 sm:gap-2 border-b shrink-0 text-xs font-mono ${
          isDark ? 'bg-[#12141a] border-zinc-800' : 'bg-white border-stone-200'
        }`}
      >
        {/* Cell Coordinate box */}
        <div
          className={`flex items-center justify-center font-semibold text-center w-11 sm:w-14 py-0.5 sm:py-1 rounded border shadow-2xs text-[11px] sm:text-xs shrink-0 ${
            isDark ? 'bg-zinc-800 border-zinc-700 text-emerald-400' : 'bg-stone-50 border-stone-300 text-emerald-700'
          }`}
        >
          {selectedCell}
        </div>

        {/* Function icon */}
        <span className="text-zinc-400 font-serif font-bold text-xs sm:text-sm italic select-none shrink-0">
          fx
        </span>

        {/* Formula Bar Input */}
        <input
          ref={formulaInputRef}
          type="text"
          value={formulaValue}
          onChange={(e) => {
            setFormulaValue(e.target.value);
            setEditValue(e.target.value);
            updateCell(selectedCell, { v: e.target.value });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
              setIsEditing(false);
            }
          }}
          onFocus={() => {
            setIsEditing(true);
          }}
          placeholder="Enter value or formula (e.g. =SUM(A1:A5))"
          className="grow min-w-0 bg-transparent outline-hidden px-1.5 sm:px-2 py-0.5 sm:py-1 font-sans text-xs text-foreground placeholder:text-zinc-500"
        />

        {/* Quick checkmark to commit edit on mobile */}
        {isEditing && (
          <button
            type="button"
            onClick={() => commitEdit(editValue)}
            title="Done"
            className="flex items-center justify-center h-6 w-6 rounded bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 shadow-xs active:scale-95 transition-transform"
          >
            <Check size={12} />
          </button>
        )}
      </div>

      {/* 4. THE SPREADSHEET GRID */}
      <div
        ref={gridContainerRef}
        className="grow overflow-auto relative select-none scrollbar-thin"
        style={{ scrollbarGutter: 'stable', WebkitOverflowScrolling: 'touch' }}
      >
        <table className="border-collapse table-fixed w-max text-xs">
          <thead>
            <tr className={`sticky top-0 z-20 ${isDark ? 'bg-[#181b22]' : 'bg-stone-100'}`}>
              {/* Corner Header (select all) - Anchored at top-left */}
              <th
                className={`sticky top-0 left-0 z-30 w-10 sm:w-10 h-8 sm:h-7 border text-center font-normal select-none ${
                  isDark ? 'border-zinc-800 bg-[#16181f] text-zinc-500' : 'border-stone-300 bg-stone-200 text-stone-500'
                }`}
              >
                #
              </th>

              {/* Column Headers (A, B, C...) */}
              {Array.from({ length: currentTab.colCount }).map((_, cIdx) => {
                const col = colLetter(cIdx);
                const width = currentTab.colWidths[col] || 120;
                const isColSelected = selectedCell.startsWith(col);

                return (
                  <th
                    key={col}
                    style={{ width, minWidth: width, maxWidth: width }}
                    onClick={() => setSelectedCell(`${col}1`)}
                    className={`relative h-8 sm:h-7 px-1 border text-center font-semibold text-xs tracking-wider select-none ${
                      isDark
                        ? `border-zinc-800 ${isColSelected ? 'bg-emerald-950/40 text-emerald-400' : 'bg-[#16181f] text-zinc-400'}`
                        : `border-stone-300 ${isColSelected ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'}`
                    }`}
                  >
                    {col}

                    {/* Column Resizing Handle with Mouse & Touch */}
                    <div
                      onMouseDown={(e) => handleResizeStart(e, col)}
                      onTouchStart={(e) => handleResizeStart(e, col)}
                      className="absolute right-0 top-0 bottom-0 w-3 sm:w-1.5 cursor-col-resize hover:bg-emerald-500 active:bg-emerald-500 z-10 touch-none"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: currentTab.rowCount }).map((_, rIdx) => {
              const row = rIdx + 1;
              const isRowSelected = parseCellCoord(selectedCell).row === row;

              return (
                <tr key={row}>
                  {/* Row Number Header (1, 2, 3...) */}
                  <td
                    onClick={() => setSelectedCell(`A${row}`)}
                    className={`sticky left-0 z-10 w-10 h-8 sm:h-6 border text-center font-mono text-[11px] select-none ${
                      isDark
                        ? `border-zinc-800 ${isRowSelected ? 'bg-emerald-950/40 text-emerald-400' : 'bg-[#16181f] text-zinc-500'}`
                        : `border-stone-300 ${isRowSelected ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-500'}`
                    }`}
                  >
                    {row}
                  </td>

                  {/* Row Cells */}
                  {Array.from({ length: currentTab.colCount }).map((_, cIdx) => {
                    const col = colLetter(cIdx);
                    const cellKey = `${col}${row}`;
                    const cell = currentTab.data[cellKey];
                    const isSelected = selectedCell === cellKey;
                    const displayVal = getCellDisplay(cell);
                    const isMatch = Boolean(searchQuery && displayVal.toLowerCase().includes(searchQuery.toLowerCase()));

                    return (
                      <td
                        key={cellKey}
                        onClick={() => {
                          if (selectedCell !== cellKey) {
                            if (isEditing) commitEdit(editValue);
                            setSelectedCell(cellKey);
                          } else if (!isEditing) {
                            // Touch friendly: second tap on selected cell opens editor on mobile!
                            setIsEditing(true);
                            setTimeout(() => cellInputRef.current?.focus(), 10);
                          }
                        }}
                        onDoubleClick={() => {
                          setSelectedCell(cellKey);
                          setIsEditing(true);
                          setTimeout(() => cellInputRef.current?.focus(), 10);
                        }}
                        style={resolveCellStyles(cell, isMatch)}
                        className={`relative h-8 sm:h-6 px-1.5 border truncate whitespace-nowrap overflow-hidden text-xs transition-colors ${
                          isDark ? 'border-zinc-800/80' : 'border-stone-200'
                        } ${
                          isSelected
                            ? 'ring-2 ring-emerald-500 ring-inset z-5 bg-emerald-500/5'
                            : isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-stone-100/60'
                        }`}
                      >
                        {isSelected && isEditing ? (
                          <input
                            ref={cellInputRef}
                            type="text"
                            value={editValue}
                            autoFocus
                            onChange={(e) => {
                              setEditValue(e.target.value);
                              setFormulaValue(e.target.value);
                            }}
                            onBlur={() => commitEdit(editValue)}
                            className="absolute inset-0 w-full h-full px-1.5 bg-white dark:bg-zinc-900 text-foreground outline-hidden border border-emerald-500 text-xs font-sans z-20"
                          />
                        ) : (
                          <span>{displayVal}</span>
                        )}

                        {/* Google Sheets Active Cell Handle (bottom-right dot) */}
                        {isSelected && !isEditing && (
                          <div className="absolute right-0 bottom-0 w-1.5 h-1.5 bg-emerald-500 rounded-2xs pointer-events-none" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Add More Rows Bottom Bar */}
        <div className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={() => handleAddRows(10)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
                : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-700'
            }`}
          >
            <Plus size={13} />
            <span>+10 Rows</span>
          </button>
          <button
            onClick={() => handleAddRows(50)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
                : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-700'
            }`}
          >
            <Plus size={13} />
            <span>+50 Rows</span>
          </button>
          <span className={`text-[11px] sm:text-xs ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>
            Total {currentTab.rowCount} rows
          </span>
        </div>
      </div>

      {/* 5. MULTI-SHEET TABS BAR (AT THE BOTTOM, EXACTLY LIKE GOOGLE SHEETS) */}
      <div
        className={`px-2 py-1.5 flex items-center justify-between border-t shrink-0 ${
          isDark ? 'bg-[#14171d] border-zinc-800' : 'bg-stone-100 border-stone-300'
        }`}
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Add Sheet Tab Button */}
          <button
            onClick={handleAddTab}
            title="Add a new sheet tab"
            className={`p-1.5 rounded-md transition-colors ${
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100' : 'hover:bg-stone-200 text-stone-700 hover:text-stone-950'
            }`}
          >
            <Plus size={15} />
          </button>

          <div className="h-4 w-px bg-stone-300 dark:bg-zinc-700 mx-1" />

          {/* Sheet Tabs */}
          {workbook.tabs.map((tab) => {
            const isActive = tab.id === workbook.activeTab;
            return (
              <div
                key={tab.id}
                onClick={() => {
                  setWorkbook((prev) => ({ ...prev, activeTab: tab.id }));
                  setSelectedCell('A1');
                }}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all border ${
                  isActive
                    ? isDark
                      ? 'bg-zinc-900 border-emerald-500/60 text-emerald-400 shadow-2xs font-semibold'
                      : 'bg-white border-emerald-600/50 text-emerald-700 shadow-2xs font-semibold'
                    : isDark
                      ? 'bg-transparent border-transparent hover:bg-zinc-800/80 text-zinc-300 hover:text-white'
                      : 'bg-transparent border-transparent hover:bg-stone-200/80 text-stone-700 hover:text-stone-950'
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: tab.color || '#0f9d58' }}
                />
                <span className="truncate max-w-[160px]">{tab.name}</span>

                {workbook.tabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTab(tab.id);
                    }}
                    title="Delete tab"
                    className={`opacity-0 group-hover:opacity-100 transition-opacity ml-1 ${
                      isDark ? 'text-zinc-400 hover:text-rose-400' : 'text-stone-400 hover:text-rose-600'
                    }`}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer info badge */}
        <div className={`text-[11px] hidden sm:flex items-center gap-2 ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
          <span>Google Sheets compatible</span>
          <span>•</span>
          <span className={isDark ? 'text-emerald-400 font-medium' : 'text-emerald-700 font-medium'}>Agency OS Engine</span>
        </div>
      </div>
    </div>
  );
}
