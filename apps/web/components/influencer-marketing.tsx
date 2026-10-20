'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  Users2,
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
  RotateCcw,
  ExternalLink,
  Copy,
  FileSpreadsheet,
  Building2,
  ShieldAlert,
  CheckSquare2,
  Square,
  FormInput,
  Layers,
  ArrowRight,
  FileText,
  Filter,
  RefreshCw,
  SlidersHorizontal,
  Minus,
  Rows,
  Columns,
  Maximize2,
  Minimize2,
  Lock,
  Unlock,
  Gift,
  CreditCard,
} from 'lucide-react';
import { api, useApp } from '@/lib/api';
import { useTheme } from './ThemeProvider';
import { toast } from 'sonner';
import { COMMERCIAL_RANGES, formatInstagramUrl } from './influencer-intake';

// Cell format interface
interface CellFormat {
  v?: string | number;
  f?: string;
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

  // Rose / Red / Pink Statuses (e.g. Overdue, Cancelled, Urgent, Influencer theme)
  '#fdf2f8': { lightBg: '#fdf2f8', lightText: '#9d174d', darkBg: 'rgba(236, 72, 153, 0.18)', darkText: '#f472b6' },
  '#fce7f3': { lightBg: '#fce7f3', lightText: '#9d174d', darkBg: 'rgba(236, 72, 153, 0.22)', darkText: '#f472b6' },
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

export interface SheetColumn {
  key: string;
  label: string;
  col: string;
  defaultWidth: number;
}

export interface RangeFilters {
  ageMin: string;
  ageMax: string;
  followersMin: string;
  followersMax: string;
  reelMin: string;
  reelMax: string;
  storyMin: string;
  storyMax: string;
}

export const initialRangeFilters: RangeFilters = {
  ageMin: '',
  ageMax: '',
  followersMin: '',
  followersMax: '',
  reelMin: '',
  reelMax: '',
  storyMin: '',
  storyMax: '',
};

export function parseNumericValue(val: any): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim().toLowerCase().replace(/,/g, '');
  if (!s) return null;

  // Suffix checks (k, m, b, l, cr)
  const crMatch = s.match(/([0-9.]+)\s*cr/i);
  if (crMatch) {
    const num = parseFloat(crMatch[1]);
    return isNaN(num) ? null : num * 10000000;
  }
  const lMatch = s.match(/([0-9.]+)\s*l/i);
  if (lMatch) {
    const num = parseFloat(lMatch[1]);
    return isNaN(num) ? null : num * 100000;
  }
  const mMatch = s.match(/([0-9.]+)\s*m/i);
  if (mMatch) {
    const num = parseFloat(mMatch[1]);
    return isNaN(num) ? null : num * 1000000;
  }
  const kMatch = s.match(/([0-9.]+)\s*k/i);
  if (kMatch) {
    const num = parseFloat(kMatch[1]);
    return isNaN(num) ? null : num * 1000;
  }

  const clean = s.replace(/[^0-9.-]/g, '');
  if (!clean) return null;
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? null : parsed;
}

interface SheetTab {
  id: string;
  name: string;
  color?: string;
  rowCount: number;
  colCount: number;
  colWidths: Record<string, number>;
  data: Record<string, CellFormat>;
  columns?: SheetColumn[];
  isLocked?: boolean;
}

interface WorkbookData {
  activeTab: string;
  tabs: SheetTab[];
  columns?: SheetColumn[];
  deletedBrands?: string[];
  isLocked?: boolean;
}

export const INFLUENCER_FIELDS = [
  { key: 'name', label: 'Name', col: 'A', defaultWidth: 160 },
  { key: 'instaId', label: 'Insta Id', col: 'B', defaultWidth: 150 },
  { key: 'phone', label: 'Phone', col: 'C', defaultWidth: 130 },
  { key: 'email', label: 'Email', col: 'D', defaultWidth: 180 },
  { key: 'genre', label: 'Genre', col: 'E', defaultWidth: 130 },
  { key: 'age', label: 'Age', col: 'F', defaultWidth: 70 },
  { key: 'gender', label: 'Gender', col: 'G', defaultWidth: 90 },
  { key: 'city', label: 'City', col: 'H', defaultWidth: 120 },
  { key: 'address', label: 'Address', col: 'I', defaultWidth: 220 },
  { key: 'followers', label: 'Followers', col: 'J', defaultWidth: 100 },
  { key: 'brand', label: 'Brand', col: 'K', defaultWidth: 150 },
  { key: 'reel', label: 'Reel Commercial', col: 'L', defaultWidth: 130 },
  { key: 'story', label: 'Story Commercial', col: 'M', defaultWidth: 130 },
  { key: 'status', label: 'Status', col: 'N', defaultWidth: 110 },
];

function colLetter(colIdx: number): string {
  let str = '';
  let temp = colIdx;
  while (temp >= 0) {
    str = String.fromCharCode((temp % 26) + 65) + str;
    temp = Math.floor(temp / 26) - 1;
  }
  return str;
}

function parseCellKey(key: string): { col: string; row: number; colIdx: number } | null {
  const match = key.match(/^([A-Z]+)([0-9]+)$/);
  if (!match) return null;
  const col = match[1];
  const row = parseInt(match[2], 10);
  let colIdx = 0;
  for (let i = 0; i < col.length; i++) {
    colIdx = colIdx * 26 + (col.charCodeAt(i) - 64);
  }
  return { col, row, colIdx: colIdx - 1 };
}

export function isInfluencerRole(actor: any): boolean {
  if (!actor) return false;
  if (actor.isSuperAdmin) return true;
  const role = (actor.roleName || '').toLowerCase().trim();
  return (
    role === 'super admin' ||
    role === 'admin' ||
    role === 'developer' ||
    role === 'smm' ||
    role === 'social media manager' ||
    role.includes('admin') ||
    role.includes('developer') ||
    role.includes('smm')
  );
}

export function InfluencerMarketingView() {
  const { actor } = useApp();
  const { isDark } = useTheme();

  // Access permission check
  const hasAccess = isInfluencerRole(actor);

  // Workbook state
  const [workbook, setWorkbook] = useState<WorkbookData>({
    activeTab: 'tab_master',
    tabs: [
      {
        id: 'tab_master',
        name: '🌟 Master Influencers',
        color: '#be185d',
        rowCount: 50,
        colCount: 20,
        colWidths: {
          A: 160, B: 150, C: 130, D: 180, E: 130, F: 70, G: 90, H: 120, I: 220, J: 100, K: 150, L: 130, M: 130, N: 110
        },
        data: {},
      },
    ],
  });

  const [columns, setColumns] = useState<SheetColumn[]>(() => {
    return INFLUENCER_FIELDS.map((f) => ({ ...f }));
  });

  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [selectedCell, setSelectedCell] = useState<string>('A2');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [formulaValue, setFormulaValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'bg' | null>(null);
  const [colorPickerAnchor, setColorPickerAnchor] = useState<{ top: number; left: number } | null>(null);

  // Close color picker on outside click, window resize or scroll
  useEffect(() => {
    if (!showColorPicker) return;
    const handleClose = () => {
      setShowColorPicker(null);
      setColorPickerAnchor(null);
    };
    window.addEventListener('resize', handleClose);
    const scrollTimer = setTimeout(() => {
      window.addEventListener('scroll', handleClose, true);
    }, 150);
    return () => {
      clearTimeout(scrollTimer);
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, [showColorPicker]);

  const toggleColorPicker = (type: 'text' | 'bg', e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (showColorPicker === type) {
      setShowColorPicker(null);
      setColorPickerAnchor(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const popupWidth = 260;
      const popupHeight = type === 'text' ? 200 : 310;
      const left = typeof window !== 'undefined'
        ? Math.max(8, Math.min(rect.left, window.innerWidth - popupWidth - 10))
        : rect.left;
      const top = typeof window !== 'undefined' && rect.bottom + popupHeight > window.innerHeight
        ? Math.max(8, rect.top - popupHeight - 6)
        : rect.bottom + 6;
      setColorPickerAnchor({
        top,
        left,
      });
      setShowColorPicker(type);
    }
  };

  // Range Filters state
  const [rangeFilterOpen, setRangeFilterOpen] = useState(false);
  const [rangeFilters, setRangeFilters] = useState<RangeFilters>(initialRangeFilters);

  // Add / Remove Column state
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColWidth, setNewColWidth] = useState(140);
  const [removeColumnOpen, setRemoveColumnOpen] = useState(false);
  const [colToDelete, setColToDelete] = useState('');

  // Undo / Redo history
  const [history, setHistory] = useState<WorkbookData[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // Modals state
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [intakeSyncOpen, setIntakeSyncOpen] = useState(false);
  const [addBrandOpen, setAddBrandOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [sheetToDelete, setSheetToDelete] = useState<SheetTab | null>(null);
  const [clearBrandFromMaster, setClearBrandFromMaster] = useState(true);

  // Export options state
  const [exportScope, setExportScope] = useState<'current' | 'all'>('current');
  const [exportColumns, setExportColumns] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    INFLUENCER_FIELDS.forEach((f) => {
      init[f.col] = true;
    });
    return init;
  });

  useEffect(() => {
    setExportColumns((prev) => {
      const next = { ...prev };
      columns.forEach((c) => {
        if (next[c.col] === undefined) next[c.col] = true;
      });
      return next;
    });
  }, [columns]);

  // Import state
  const [importTargetTab, setImportTargetTab] = useState<'master' | 'current'>('master');
  const [importRowsPreview, setImportRowsPreview] = useState<any[]>([]);

  // Quick add creator state
  const [quickCreator, setQuickCreator] = useState({
    name: '',
    instaId: '',
    phone: '',
    email: '',
    genre: 'Fashion & Style',
    age: '',
    gender: 'Female',
    city: '',
    address: '',
    followers: '',
    brand: '',
    reel: '',
    story: '',
  });

  // Column resizing state
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(100);

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);
  const brandInputRef = useRef<HTMLInputElement>(null);

  // Focus brand input and ensure background cell editing is cleared when Add Brand modal is open
  useEffect(() => {
    if (addBrandOpen) {
      setIsEditing(false);
      const timer = setTimeout(() => {
        brandInputRef.current?.focus();
        brandInputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [addBrandOpen]);

  // Exit fullscreen on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen && !isEditing) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFullscreen, isEditing]);

  // Load workbook from backend
  useEffect(() => {
    if (!hasAccess) return;
    let mounted = true;
    setLoading(true);

    api<any>('/influencers/sheet')
      .then((res) => {
        if (!mounted || !res?.data?.tabs) return;
        setWorkbook(res.data);
        if (res.data.columns && Array.isArray(res.data.columns) && res.data.columns.length > 0) {
          setColumns(res.data.columns);
        } else if (res.data.tabs[0]?.columns && Array.isArray(res.data.tabs[0].columns) && res.data.tabs[0].columns.length > 0) {
          setColumns(res.data.tabs[0].columns);
        }
        setHistory([res.data]);
        setHistoryIdx(0);
      })
      .catch((err) => {
        console.error('Failed to load influencer sheet:', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [hasAccess]);

  // Parsed selected cell coordinates
  const parsedSelectedCell = useMemo(() => parseCellKey(selectedCell), [selectedCell]);
  const selectedRow = parsedSelectedCell?.row || 2;
  const selectedCol = parsedSelectedCell?.col || 'A';

  // Active numeric filters count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (rangeFilters.ageMin || rangeFilters.ageMax) count++;
    if (rangeFilters.followersMin || rangeFilters.followersMax) count++;
    if (rangeFilters.reelMin || rangeFilters.reelMax) count++;
    if (rangeFilters.storyMin || rangeFilters.storyMax) count++;
    return count;
  }, [rangeFilters]);

  // Current active tab
  const currentTab = useMemo(() => {
    return workbook.tabs.find((t) => t.id === workbook.activeTab) || workbook.tabs[0];
  }, [workbook]);

  // Master tab
  const masterTab = useMemo(() => {
    return workbook.tabs.find((t) => t.id === 'tab_master' || t.name.includes('Master')) || workbook.tabs[0];
  }, [workbook]);

  // Active cell format
  const activeCellFormat: CellFormat = useMemo(() => {
    return currentTab.data[selectedCell] || {};
  }, [currentTab, selectedCell]);

  // Sync formula bar when selected cell changes
  useEffect(() => {
    const cell = currentTab.data[selectedCell];
    const val = cell?.v !== undefined ? String(cell.v) : '';
    setFormulaValue(val);
    setEditValue(val);
  }, [selectedCell, currentTab]);

  // Push state to history
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

  // Save to backend
  const handleSave = useCallback(
    async (wbToSave = workbook) => {
      setSaveStatus('saving');
      try {
        await api('/influencers/sheet', {
          method: 'PUT',
          body: JSON.stringify({
            title: 'Influencer Marketing',
            data: wbToSave,
          }),
        });
        setSaveStatus('saved');
        toast.success('Influencer Marketing sheet saved');
      } catch (err: any) {
        setSaveStatus('saved');
        toast.error('Could not save to remote server, saved locally');
      }
    },
    [workbook]
  );

  // Lock / Unlock current sheet tab
  const handleToggleLock = useCallback(() => {
    const nextLocked = !currentTab.isLocked;
    const newTabs = workbook.tabs.map((tab) =>
      tab.id === currentTab.id ? { ...tab, isLocked: nextLocked } : tab
    );
    const updated = { ...workbook, tabs: newTabs };
    pushState(updated);
    handleSave(updated);
    if (nextLocked) {
      setIsEditing(false);
      setShowColorPicker(null);
      toast.success(`"${currentTab.name}" locked`, {
        description: 'Sheet is protected against accidental edits.',
      });
    } else {
      toast.success(`"${currentTab.name}" unlocked`, {
        description: 'Editing enabled for this sheet tab.',
      });
    }
  }, [currentTab, workbook, pushState, handleSave]);

  /**
   * AUTOMATIC BRAND SHEET SYNCHRONIZATION ENGINE
   * Harmonizes Master Sheet rows into dedicated brand sheet tabs.
   */
  const syncBrandSheets = useCallback(
    (sourceWb = workbook): WorkbookData => {
      const mTab = sourceWb.tabs.find((t) => t.id === 'tab_master' || t.name.includes('Master')) || sourceWb.tabs[0];
      const activeCols = sourceWb.columns || columns || INFLUENCER_FIELDS;

      // Extract all rows from Master
      const masterRows: Record<string, string>[] = [];
      for (let r = 2; r <= mTab.rowCount; r++) {
        const nameVal = mTab.data[`A${r}`]?.v;
        const instaVal = mTab.data[`B${r}`]?.v;
        if (!nameVal && !instaVal) continue;

        const rowObj: Record<string, string> = {};
        activeCols.forEach((f) => {
          rowObj[f.col] = String(mTab.data[`${f.col}${r}`]?.v || '');
        });
        masterRows.push(rowObj);
      }

      // Collect all distinct brands
      const brandSet = new Set<string>();
      masterRows.forEach((r) => {
        const b = (r['K'] || '').trim();
        if (b) brandSet.add(b);
      });

      // Keep existing brand tabs and create missing ones
      const existingBrandTabs = sourceWb.tabs.filter((t) => t.id !== mTab.id);
      const existingBrandNames = new Set(existingBrandTabs.map((t) => t.name.toLowerCase().trim()));

      // Any brand present in Master data gets a tab
      const updatedTabs: SheetTab[] = [mTab];

      // Helper to build sheet data for a brand
      const buildBrandTab = (tabId: string, bName: string, rowsForBrand: Record<string, string>[]) => {
        const data: Record<string, CellFormat> = {};
        activeCols.forEach((f) => {
          data[`${f.col}1`] = mTab.data[`${f.col}1`] || {
            v: f.label,
            bold: true,
            bg: '#fdf2f8',
            color: '#be185d',
            align: f.col === 'F' || f.col === 'G' || f.col === 'N' ? ('center' as const) : f.col === 'J' || f.col === 'L' || f.col === 'M' ? ('right' as const) : ('left' as const),
          };
        });

        rowsForBrand.forEach((item, idx) => {
          const r = idx + 2;
          activeCols.forEach((f) => {
            const val = item[f.col] || '';
            const cellAlign: 'left' | 'center' | 'right' =
              f.col === 'F' || f.col === 'G' || f.col === 'N'
                ? 'center'
                : f.col === 'J' || f.col === 'L' || f.col === 'M'
                ? 'right'
                : 'left';
            data[`${f.col}${r}`] = {
              v: val,
              align: cellAlign,
              bold: f.col === 'K' || f.col === 'J' || f.col === 'N',
              color: f.col === 'B' ? '#0284c7' : f.col === 'K' ? '#be185d' : undefined,
              bg: f.col === 'N' ? (val === 'Onboarded' ? '#dcfce7' : val === 'Shortlisted' ? '#fef3c7' : '#e0f2fe') : undefined,
            };
          });
        });

        return {
          id: tabId,
          name: bName,
          color: '#e1306c',
          rowCount: Math.max(50, rowsForBrand.length + 10),
          colCount: Math.max(20, activeCols.length + 2),
          colWidths: mTab.colWidths,
          columns: activeCols,
          data,
        };
      };

      // Populate existing brand tabs with updated rows
      existingBrandTabs.forEach((bTab) => {
        const rowsForThisBrand = masterRows.filter(
          (r) => (r['K'] || '').toLowerCase().trim() === bTab.name.toLowerCase().trim()
        );
        updatedTabs.push(buildBrandTab(bTab.id, bTab.name, rowsForThisBrand));
      });

      // Respect deleted brands so they are not resurrected automatically
      const deletedBrandsSet = new Set(
        (sourceWb.deletedBrands || []).map((b) => b.toLowerCase().trim())
      );

      // Add newly introduced brands that don't have a tab yet and were not deleted
      brandSet.forEach((bName) => {
        const cleanName = bName.toLowerCase().trim();
        if (deletedBrandsSet.has(cleanName)) return;
        if (!existingBrandNames.has(cleanName)) {
          const rowsForThisBrand = masterRows.filter(
            (r) => (r['K'] || '').toLowerCase().trim() === cleanName
          );
          const newTabId = 'tab_brand_' + Math.random().toString(36).substring(2, 8);
          updatedTabs.push(buildBrandTab(newTabId, bName, rowsForThisBrand));
        }
      });

      return {
        ...sourceWb,
        columns: activeCols,
        tabs: updatedTabs,
      };
    },
    [workbook, columns]
  );

  const colIndex = (col: string): number => {
    let index = 0;
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + (col.charCodeAt(i) - 64);
    }
    return index - 1;
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
          const pStart = parseCellKey(start.trim());
          const pEnd = parseCellKey(end.trim());
          if (!pStart || !pEnd) return expr;

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
                  const val =
                    typeof cell.v === 'string' && cell.v.startsWith('=')
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
            const num = cell?.v ? Number(String(cell.v).replace(/[^0-9.-]+/g, '')) : Number(key);
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
          const pStart = parseCellKey(start.trim());
          const pEnd = parseCellKey(end.trim());
          if (!pStart || !pEnd) return expr;

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
          const pStart = parseCellKey(start.trim());
          const pEnd = parseCellKey(end.trim());
          if (!pStart || !pEnd) return expr;

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

      // Simple arithmetic e.g. =A1+B1 or =L2*1.18
      try {
        const replaced = cleanExpr.replace(/([A-Z]+\d+)/g, (match) => {
          const cell = currentTab.data[match];
          if (!cell || cell.v === undefined) return '0';
          const n = Number(String(cell.v).replace(/[^0-9.-]+/g, ''));
          return isNaN(n) ? '0' : String(n);
        });
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

  // Cell display value (evaluates formulas and formats currency/percent)
  const getCellDisplay = useCallback(
    (cell?: CellFormat): string => {
      if (!cell || cell.v === undefined || cell.v === null) return '';
      const raw = String(cell.v);
      if (raw.startsWith('=')) {
        const evaluated = evaluateFormula(raw);
        if (cell.format === 'currency') return `₹${Number(evaluated).toLocaleString()}`;
        if (cell.format === 'percent') return `${Number(evaluated)}%`;
        return String(evaluated);
      }
      if (cell.format === 'currency') {
        const n = Number(raw.replace(/[^0-9.-]+/g, ''));
        return !isNaN(n) ? `₹${n.toLocaleString()}` : raw;
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
    (cell: CellFormat | undefined, isMatch = false) => {
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
        const clean = bg.replace('#', '');
        if (clean.length === 6) {
          const r = parseInt(clean.substring(0, 2), 16);
          const g = parseInt(clean.substring(2, 4), 16);
          const b = parseInt(clean.substring(4, 6), 16);
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

          if (isDark) {
            if (lum > 130) {
              if (!color || color === '#ffffff' || color === '#f4f4f5' || color === 'white') {
                color = '#09090b';
              }
            }
          } else {
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

  // Update a single cell's format/value
  const updateCell = useCallback(
    (cellKey: string, updates: Partial<CellFormat>) => {
      if (currentTab.isLocked) {
        toast.error('Sheet is locked', {
          description: 'Unlock this sheet tab from the top toolbar to make changes.',
        });
        return;
      }
      const parsed = parseCellKey(cellKey);
      if (!parsed) return;

      const oldCell = currentTab.data[cellKey] || {};
      const updatedCell: CellFormat = { ...oldCell, ...updates };

      const newTab: SheetTab = {
        ...currentTab,
        data: {
          ...currentTab.data,
          [cellKey]: updatedCell,
        },
      };

      let newWorkbook: WorkbookData;

      // If currently on Master Tab and Column K (Brand) is changed, trigger automatic brand tab sync!
      if (currentTab.id === masterTab.id) {
        const intermediateWb: WorkbookData = {
          ...workbook,
          tabs: workbook.tabs.map((t) => (t.id === currentTab.id ? newTab : t)),
        };
        if (parsed.col === 'K' && updates.v !== undefined) {
          newWorkbook = syncBrandSheets(intermediateWb);
        } else {
          newWorkbook = intermediateWb;
        }
      } else {
        // If currently on a Brand Tab:
        // Sync the changed cell back to the Master tab!
        const brandName = currentTab.name;
        const rowInBrand = parsed.row;
        const nameInBrand =
          parsed.col === 'A' && updates.v !== undefined
            ? updates.v
            : currentTab.data[`A${rowInBrand}`]?.v;
        const instaInBrand =
          parsed.col === 'B' && updates.v !== undefined
            ? updates.v
            : currentTab.data[`B${rowInBrand}`]?.v;

        const updatedMasterData = { ...masterTab.data };
        let foundMasterRow = -1;
        for (let r = 2; r <= masterTab.rowCount; r++) {
          const mName = masterTab.data[`A${r}`]?.v;
          const mInsta = masterTab.data[`B${r}`]?.v;
          const mBrand = masterTab.data[`K${r}`]?.v;
          if (
            ((nameInBrand && mName === nameInBrand) || (instaInBrand && mInsta === instaInBrand)) &&
            mBrand === brandName
          ) {
            foundMasterRow = r;
            break;
          }
        }

        if (foundMasterRow !== -1) {
          const currentMCell = updatedMasterData[`${parsed.col}${foundMasterRow}`] || {};
          updatedMasterData[`${parsed.col}${foundMasterRow}`] = {
            ...currentMCell,
            ...updates,
          };
        }

        const updatedMasterTab = {
          ...masterTab,
          data: updatedMasterData,
        };

        newWorkbook = {
          ...workbook,
          tabs: workbook.tabs.map((t) => {
            if (t.id === currentTab.id) return newTab;
            if (t.id === masterTab.id) return updatedMasterTab;
            return t;
          }),
        };
      }

      pushState(newWorkbook);
    },
    [workbook, currentTab, masterTab, pushState, syncBrandSheets]
  );

  // Commit cell edit
  const commitEdit = useCallback(
    (newVal: string) => {
      setIsEditing(false);
      if (currentTab.isLocked) return;
      updateCell(selectedCell, { v: newVal });
    },
    [selectedCell, updateCell, currentTab.isLocked]
  );

  // Keyboard navigation & Shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // 1. If any modal is open, completely disable spreadsheet hotkeys
      if (
        addBrandOpen ||
        addColumnOpen ||
        removeColumnOpen ||
        exportOpen ||
        importOpen ||
        intakeSyncOpen ||
        rangeFilterOpen ||
        deleteSheetOpen
      ) {
        return;
      }

      // 2. If focus is on ANY input, textarea, select, or modal, NEVER capture spreadsheet keys
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.closest('input, textarea, select, [role="dialog"], [data-modal]'))
      ) {
        // Only allow cell editor and formula bar through
        if (target !== cellInputRef.current && target !== formulaInputRef.current) {
          return;
        }
      }

      const parsed = parseCellKey(selectedCell);
      if (!parsed) return;
      const { col, row, colIdx } = parsed;

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
          const nextCol = colLetter(Math.min(colIdx + 1, columns.length - 1));
          setSelectedCell(`${nextCol}${row}`);
        } else if (e.key === 'Escape') {
          setIsEditing(false);
        }
        return;
      }

      // Hotkeys when not editing
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        updateCell(selectedCell, { bold: !activeCellFormat.bold });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        updateCell(selectedCell, { italic: !activeCellFormat.italic });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        updateCell(selectedCell, { underline: !activeCellFormat.underline });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (currentTab.isLocked) {
          toast.error('Sheet is locked', { description: 'Unlock this sheet tab to delete contents.' });
          return;
        }
        updateCell(selectedCell, { v: '' });
      } else if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        if (currentTab.isLocked) {
          toast.error('Sheet is locked', { description: 'Unlock this sheet tab to edit cells.' });
          return;
        }
        setIsEditing(true);
        setEditValue(String(activeCellFormat.v || ''));
        setTimeout(() => cellInputRef.current?.focus({ preventScroll: true }), 10);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (row > 2) setSelectedCell(`${col}${row - 1}`);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (row < currentTab.rowCount) setSelectedCell(`${col}${row + 1}`);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (colIdx > 0) setSelectedCell(`${colLetter(colIdx - 1)}${row}`);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (colIdx < columns.length - 1) setSelectedCell(`${colLetter(colIdx + 1)}${row}`);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          if (colIdx > 0) setSelectedCell(`${colLetter(colIdx - 1)}${row}`);
        } else {
          if (colIdx < columns.length - 1) setSelectedCell(`${colLetter(colIdx + 1)}${row}`);
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (currentTab.isLocked) {
          toast.error('Sheet is locked', { description: 'Unlock this sheet tab to edit cells.' });
          return;
        }
        // Direct typing starts edit
        setIsEditing(true);
        setEditValue(e.key);
        setTimeout(() => cellInputRef.current?.focus({ preventScroll: true }), 10);
      }
    },
    [
      selectedCell,
      isEditing,
      editValue,
      currentTab,
      columns,
      activeCellFormat,
      commitEdit,
      updateCell,
      addBrandOpen,
      addColumnOpen,
      removeColumnOpen,
      exportOpen,
      importOpen,
      intakeSyncOpen,
      rangeFilterOpen,
      deleteSheetOpen,
    ]
  );

  // Add row in current tab (append to end)
  const handleAddRow = () => {
    if (currentTab.isLocked) {
      toast.error('Sheet is locked', { description: 'Unlock this sheet tab to add rows.' });
      return;
    }
    let nextRow = 2;
    while (currentTab.data[`A${nextRow}`]?.v || currentTab.data[`B${nextRow}`]?.v) {
      nextRow++;
    }

    const isBrandTab = currentTab.id !== masterTab.id;
    const prefillBrand = isBrandTab ? currentTab.name : '';

    const newTab: SheetTab = {
      ...currentTab,
      rowCount: Math.max(currentTab.rowCount, nextRow + 5),
      data: {
        ...currentTab.data,
        [`A${nextRow}`]: { v: '' },
        [`K${nextRow}`]: prefillBrand ? { v: prefillBrand, bold: true, color: '#be185d' } : { v: '' },
        [`N${nextRow}`]: { v: 'New', align: 'center' as const, bold: true, bg: '#e0f2fe', color: '#0369a1' },
      },
    };

    let newWorkbook: WorkbookData;
    if (isBrandTab) {
      let mNextRow = 2;
      while (masterTab.data[`A${mNextRow}`]?.v || masterTab.data[`B${mNextRow}`]?.v) {
        mNextRow++;
      }
      const updatedMasterTab: SheetTab = {
        ...masterTab,
        rowCount: Math.max(masterTab.rowCount, mNextRow + 5),
        data: {
          ...masterTab.data,
          [`A${mNextRow}`]: { v: '' },
          [`K${mNextRow}`]: { v: prefillBrand, bold: true, color: '#be185d' },
          [`N${mNextRow}`]: { v: 'New', align: 'center' as const, bold: true, bg: '#e0f2fe', color: '#0369a1' },
        },
      };

      newWorkbook = {
        ...workbook,
        tabs: workbook.tabs.map((t) => {
          if (t.id === currentTab.id) return newTab;
          if (t.id === masterTab.id) return updatedMasterTab;
          return t;
        }),
      };
    } else {
      newWorkbook = {
        ...workbook,
        tabs: workbook.tabs.map((t) => (t.id === currentTab.id ? newTab : t)),
      };
    }

    pushState(newWorkbook);
    setSelectedCell(`A${nextRow}`);
    setIsEditing(true);
    setEditValue('');
    toast.success(`Added new creator row at #${nextRow}`);
  };

  // Insert row (either after target row or append)
  const handleInsertRow = (afterRow?: number) => {
    if (currentTab.isLocked) {
      toast.error('Sheet is locked', { description: 'Unlock this sheet tab to insert rows.' });
      return;
    }
    const targetRow = afterRow !== undefined ? afterRow : selectedRow;
    if (targetRow && targetRow >= 1 && targetRow < currentTab.rowCount) {
      const isBrandTab = currentTab.id !== masterTab.id;
      const prefillBrand = isBrandTab ? currentTab.name : '';

      const updatedData: Record<string, CellFormat> = {};
      Object.entries(currentTab.data).forEach(([key, val]) => {
        const parsed = parseCellKey(key);
        if (!parsed) return;
        if (parsed.row <= targetRow) {
          updatedData[key] = val;
        } else {
          updatedData[`${parsed.col}${parsed.row + 1}`] = val;
        }
      });

      const newRow = targetRow + 1;
      updatedData[`A${newRow}`] = { v: '' };
      if (prefillBrand) {
        updatedData[`K${newRow}`] = { v: prefillBrand, bold: true, color: '#be185d' };
      }
      updatedData[`N${newRow}`] = { v: 'New', align: 'center' as const, bold: true, bg: '#e0f2fe', color: '#0369a1' };

      const updatedTab: SheetTab = {
        ...currentTab,
        rowCount: currentTab.rowCount + 1,
        data: updatedData,
      };

      const intermediateWb: WorkbookData = {
        ...workbook,
        tabs: workbook.tabs.map((t) => (t.id === currentTab.id ? updatedTab : t)),
      };
      const synchronizedWb = syncBrandSheets(intermediateWb);
      pushState(synchronizedWb);
      setSelectedCell(`A${newRow}`);
      setIsEditing(true);
      setEditValue('');
      toast.success(`Inserted creator row at #${newRow}`);
    } else {
      handleAddRow();
    }
  };

  // Delete row (shifts subsequent rows up by 1)
  const handleDeleteRow = (targetRow?: number) => {
    if (currentTab.isLocked) {
      toast.error('Sheet is locked', { description: 'Unlock this sheet tab to delete rows.' });
      return;
    }
    const rowToDelete = targetRow !== undefined ? targetRow : selectedRow;
    if (rowToDelete < 2) {
      toast.error('Cannot delete the header row');
      return;
    }

    const creatorName =
      currentTab.data[`A${rowToDelete}`]?.v ||
      currentTab.data[`B${rowToDelete}`]?.v ||
      `Row ${rowToDelete}`;

    const updatedData: Record<string, CellFormat> = {};
    Object.entries(currentTab.data).forEach(([key, val]) => {
      const parsed = parseCellKey(key);
      if (!parsed) return;
      if (parsed.row < rowToDelete) {
        updatedData[key] = val;
      } else if (parsed.row > rowToDelete) {
        updatedData[`${parsed.col}${parsed.row - 1}`] = val;
      }
    });

    const updatedTab: SheetTab = {
      ...currentTab,
      rowCount: Math.max(10, currentTab.rowCount - 1),
      data: updatedData,
    };

    const intermediateWb: WorkbookData = {
      ...workbook,
      tabs: workbook.tabs.map((t) => (t.id === currentTab.id ? updatedTab : t)),
    };

    const synchronizedWb = syncBrandSheets(intermediateWb);
    pushState(synchronizedWb);

    if (selectedRow >= rowToDelete && selectedRow > 2) {
      setSelectedCell(`${selectedCol}${selectedRow - 1}`);
    }

    toast.success(`Deleted Row ${rowToDelete} (${creatorName})`);
  };

  // Add a new column to the workspace
  const handleAddColumn = (label: string, width = 140) => {
    const trimmed = label.trim();
    if (!trimmed) {
      toast.error('Please enter a column name');
      return;
    }

    const usedCols = new Set(columns.map((c) => c.col));
    let nextIdx = columns.length;
    let nextLetter = colLetter(nextIdx);
    while (usedCols.has(nextLetter)) {
      nextIdx++;
      nextLetter = colLetter(nextIdx);
    }

    const key = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '_') || `col_${nextLetter.toLowerCase()}`;
    const newCol: SheetColumn = {
      key,
      label: trimmed,
      col: nextLetter,
      defaultWidth: width,
    };

    const updatedColumns = [...columns, newCol];
    setColumns(updatedColumns);

    const updatedWb: WorkbookData = {
      ...workbook,
      columns: updatedColumns,
      tabs: workbook.tabs.map((tab) => ({
        ...tab,
        colCount: Math.max(tab.colCount, updatedColumns.length + 1),
        colWidths: { ...tab.colWidths, [nextLetter]: width },
        columns: updatedColumns,
        data: {
          ...tab.data,
          [`${nextLetter}1`]: {
            v: trimmed,
            bold: true,
            bg: '#fdf2f8',
            color: '#be185d',
            align: 'left' as const,
          },
        },
      })),
    };

    pushState(updatedWb);
    setAddColumnOpen(false);
    setNewColLabel('');
    toast.success(`Added column "${trimmed}" (${nextLetter})`);
  };

  // Remove a column from the workspace
  const handleRemoveColumn = (colToRemove: string) => {
    if (columns.length <= 1) {
      toast.error('Cannot remove the last remaining column');
      return;
    }

    const targetCol = columns.find((c) => c.col === colToRemove);
    if (!targetCol) {
      toast.error(`Column ${colToRemove} not found`);
      return;
    }

    const updatedColumns = columns.filter((c) => c.col !== colToRemove);
    setColumns(updatedColumns);

    const updatedWb: WorkbookData = {
      ...workbook,
      columns: updatedColumns,
      tabs: workbook.tabs.map((tab) => {
        const updatedData: Record<string, CellFormat> = {};
        Object.entries(tab.data).forEach(([key, val]) => {
          if (!key.startsWith(colToRemove)) {
            updatedData[key] = val;
          }
        });
        return {
          ...tab,
          columns: updatedColumns,
          data: updatedData,
        };
      }),
    };

    pushState(updatedWb);
    setRemoveColumnOpen(false);
    toast.success(`Removed column "${targetCol.label}" (${colToRemove})`);
  };

  // Add a new brand sheet tab
  const handleCreateBrandSheet = (bName: string) => {
    const trimmed = bName.trim();
    if (!trimmed) {
      toast.error('Please enter a brand name');
      return;
    }

    const existing = workbook.tabs.find((t) => t.name.toLowerCase().trim() === trimmed.toLowerCase());
    if (existing) {
      setWorkbook((p) => ({ ...p, activeTab: existing.id }));
      setAddBrandOpen(false);
      setNewBrandName('');
      toast.info(`Switched to existing sheet for ${trimmed}`);
      return;
    }

    const newTabId = 'tab_brand_' + Math.random().toString(36).substring(2, 8);
    const newTab: SheetTab = {
      id: newTabId,
      name: trimmed,
      color: '#e1306c',
      rowCount: 50,
      colCount: 20,
      colWidths: masterTab.colWidths,
      data: (() => {
        const d: Record<string, CellFormat> = {};
        columns.forEach((f) => {
          d[`${f.col}1`] = {
            v: f.label,
            bold: true,
            bg: '#fdf2f8',
            color: '#be185d',
            align:
              f.col === 'F' || f.col === 'G' || f.col === 'N'
                ? ('center' as const)
                : f.col === 'J' || f.col === 'L' || f.col === 'M'
                ? ('right' as const)
                : ('left' as const),
          };
        });
        return d;
      })(),
    };

    // Unmark from deletedBrands if previously deleted
    const updatedDeletedBrands = (workbook.deletedBrands || []).filter(
      (b) => b.toLowerCase().trim() !== trimmed.toLowerCase()
    );

    const nextWb = {
      ...workbook,
      activeTab: newTabId,
      tabs: [...workbook.tabs, newTab],
      deletedBrands: updatedDeletedBrands,
    };

    pushState(nextWb);
    setAddBrandOpen(false);
    setNewBrandName('');
    toast.success(`Created separated sheet for ${trimmed}`);
  };

  // Delete a brand sheet tab
  const handleDeleteSheet = (tabId: string, clearFromMaster = true) => {
    if (tabId === masterTab.id) {
      toast.error('Cannot delete the Master Influencers sheet');
      return;
    }

    const targetTab = workbook.tabs.find((t) => t.id === tabId);
    if (!targetTab) return;

    const brandName = targetTab.name.trim();

    // Optionally clear the Brand column (K) on Master Sheet rows for this brand
    let updatedMasterTab = masterTab;
    if (clearFromMaster) {
      const updatedMasterData = { ...masterTab.data };
      for (let r = 2; r <= masterTab.rowCount; r++) {
        const val = String(updatedMasterData[`K${r}`]?.v || '').trim();
        if (val.toLowerCase() === brandName.toLowerCase()) {
          updatedMasterData[`K${r}`] = {
            ...updatedMasterData[`K${r}`],
            v: '',
          };
        }
      }
      updatedMasterTab = {
        ...masterTab,
        data: updatedMasterData,
      };
    }

    // Add brand to deletedBrands set to prevent auto-regeneration
    const updatedDeletedBrands = Array.from(
      new Set([...(workbook.deletedBrands || []), brandName.toLowerCase()])
    );

    const updatedTabs = workbook.tabs
      .filter((t) => t.id !== tabId)
      .map((t) => (t.id === masterTab.id ? updatedMasterTab : t));

    const nextWb: WorkbookData = {
      ...workbook,
      activeTab: workbook.activeTab === tabId ? masterTab.id : workbook.activeTab,
      tabs: updatedTabs,
      deletedBrands: updatedDeletedBrands,
    };

    pushState(nextWb);
    handleSave(nextWb);
    setDeleteSheetOpen(false);
    setSheetToDelete(null);
    toast.success(`Deleted sheet "${brandName}"`);
  };

  /**
   * EXPORT ENGINE WITH COLUMN SELECTION CHECKBOXES
   */
  const handleExport = () => {
    const targetTab = exportScope === 'all' ? masterTab : currentTab;
    const selectedFields = columns.filter((f) => exportColumns[f.col]);

    if (selectedFields.length === 0) {
      toast.error('Please select at least one column to export');
      return;
    }

    const rows: string[][] = [];

    // Header row
    rows.push(selectedFields.map((f) => `"${f.label.replace(/"/g, '""')}"`));

    // Data rows
    for (let r = 2; r <= targetTab.rowCount; r++) {
      const nameVal = targetTab.data[`A${r}`]?.v;
      const instaVal = targetTab.data[`B${r}`]?.v;
      if (!nameVal && !instaVal) continue;

      const rowData = selectedFields.map((f) => {
        const val = String(targetTab.data[`${f.col}${r}`]?.v || '');
        return `"${val.replace(/"/g, '""')}"`;
      });
      rows.push(rowData);
    }

    const csvContent = rows.map((e) => e.join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Influencers_${targetTab.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportOpen(false);
    toast.success(`Exported ${rows.length - 1} records with ${selectedFields.length} columns`);
  };

  /**
   * IMPORT ENGINE
   */
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        toast.error('File must contain a header and at least one row');
        return;
      }

      // Parse header line
      const headers = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((h) =>
        h.replace(/^"|"$/g, '').replace(/""/g, '"').trim().toLowerCase()
      );

      const parsedRecords: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) =>
          c.replace(/^"|"$/g, '').replace(/""/g, '"').trim()
        );

        const rec: any = {};
        headers.forEach((h, idx) => {
          const val = cells[idx] || '';
          if (h.includes('name')) rec.name = val;
          else if (h.includes('insta') || h.includes('handle')) rec.instaId = val;
          else if (h.includes('phone') || h.includes('mobile')) rec.phone = val;
          else if (h.includes('email')) rec.email = val;
          else if (h.includes('genre') || h.includes('niche')) rec.genre = val;
          else if (h.includes('age')) rec.age = val;
          else if (h.includes('gender')) rec.gender = val;
          else if (h.includes('city')) rec.city = val;
          else if (h.includes('address')) rec.address = val;
          else if (h.includes('follower')) rec.followers = val;
          else if (h.includes('brand')) rec.brand = val;
          else if (h.includes('reel')) rec.reel = val;
          else if (h.includes('story')) rec.story = val;
          else if (h.includes('status')) rec.status = val;
        });

        if (rec.name || rec.instaId) {
          parsedRecords.push(rec);
        }
      }

      setImportRowsPreview(parsedRecords);
    };

    reader.readAsText(file);
  };

  const handleApplyImport = () => {
    if (importRowsPreview.length === 0) {
      toast.error('No valid rows found to import');
      return;
    }

    const targetTab = importTargetTab === 'current' ? currentTab : masterTab;
    const updatedData: Record<string, CellFormat> = { ...targetTab.data };

    let nextRow = 2;
    while (updatedData[`A${nextRow}`]?.v || updatedData[`B${nextRow}`]?.v) {
      nextRow++;
    }

    importRowsPreview.forEach((item, idx) => {
      const r = nextRow + idx;
      updatedData[`A${r}`] = { v: item.name || '' };
      updatedData[`B${r}`] = { v: item.instaId || '', color: '#0284c7' };
      updatedData[`C${r}`] = { v: item.phone || '' };
      updatedData[`D${r}`] = { v: item.email || '' };
      updatedData[`E${r}`] = { v: item.genre || '' };
      updatedData[`F${r}`] = { v: item.age || '', align: 'center' as const };
      updatedData[`G${r}`] = { v: item.gender || '', align: 'center' as const };
      updatedData[`H${r}`] = { v: item.city || '' };
      updatedData[`I${r}`] = { v: item.address || '' };
      updatedData[`J${r}`] = { v: item.followers || '', align: 'right' as const, bold: true };
      updatedData[`K${r}`] = {
        v: item.brand || (targetTab.id !== masterTab.id ? targetTab.name : 'General'),
        bold: true,
        color: '#be185d',
      };
      updatedData[`L${r}`] = { v: item.reel || '', align: 'right' as const };
      updatedData[`M${r}`] = { v: item.story || '', align: 'right' as const };
      updatedData[`N${r}`] = {
        v: item.status || 'Imported',
        align: 'center' as const,
        bold: true,
        bg: '#dcfce7',
        color: '#15803d',
      };
    });

    const updatedTab: SheetTab = {
      ...targetTab,
      rowCount: Math.max(targetTab.rowCount, nextRow + importRowsPreview.length + 5),
      data: updatedData,
    };

    const intermediateWb = {
      ...workbook,
      tabs: workbook.tabs.map((t) => (t.id === targetTab.id ? updatedTab : t)),
    };

    const synchronizedWb = syncBrandSheets(intermediateWb);
    pushState(synchronizedWb);

    setImportOpen(false);
    setImportRowsPreview([]);
    toast.success(`Successfully imported ${importRowsPreview.length} creators into workspace`);
  };

  /**
   * QUICK ADD CREATOR
   */
  const handleQuickAddCreator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCreator.name || !quickCreator.instaId) {
      toast.error('Please enter Creator Name and Instagram Profile URL / Handle');
      return;
    }

    const trimmedInsta = quickCreator.instaId.trim();
    const finalInsta = trimmedInsta.startsWith('http') || trimmedInsta.includes('instagram.com')
      ? formatInstagramUrl(trimmedInsta)
      : (trimmedInsta.startsWith('@') ? trimmedInsta : `@${trimmedInsta}`);

    const payload = {
      name: quickCreator.name.trim(),
      instaId: finalInsta,
      phone: quickCreator.phone.trim(),
      email: quickCreator.email.trim(),
      genre: quickCreator.genre,
      age: quickCreator.age.trim(),
      gender: quickCreator.gender,
      city: quickCreator.city.trim(),
      address: quickCreator.address.trim(),
      followers: quickCreator.followers.trim(),
      brand: quickCreator.brand.trim() || (currentTab.id !== masterTab.id ? currentTab.name : 'General'),
      reel: quickCreator.reel.trim(),
      story: quickCreator.story.trim(),
      status: quickCreator.reel === 'Barter' || quickCreator.story === 'Barter' ? 'Barter Collab' : 'New Intake',
    };

    try {
      await api('/influencers/quick-add', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Reload workbook
      const res = await api<any>('/influencers/sheet');
      if (res?.data?.tabs) {
        setWorkbook(res.data);
      }
      setIntakeSyncOpen(false);
      setQuickCreator({
        name: '',
        instaId: '',
        phone: '',
        email: '',
        genre: 'Fashion & Style',
        age: '',
        gender: 'Female',
        city: '',
        address: '',
        followers: '',
        brand: '',
        reel: '',
        story: '',
      });
      toast.success(`Added ${payload.name} to Master and ${payload.brand} sheets`);
    } catch {
      toast.error('Failed to add creator');
    }
  };

  // Resizing column listeners
  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setResizingCol(col);
    setResizeStartX(clientX);
    setResizeStartWidth(currentTab.colWidths[col] || 100);
  };

  useEffect(() => {
    if (!resizingCol) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
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
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [resizingCol, resizeStartX, resizeStartWidth, currentTab.id]);

  // If user does not have permission
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="h-16 w-16 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
          <ShieldAlert size={36} />
        </div>
        <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
        <p className="text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
          The <strong>Influencer Marketing</strong> workspace contains confidential creator commercial contracts, rate cards, and client allocations. Access is restricted to <strong>Admin, Super Admin, Developer, and SMM</strong> roles.
        </p>
        <button
          onClick={() => (window.location.href = '/dashboard')}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Calculate metrics
  const activeRowCount = useMemo(() => {
    let count = 0;
    for (let r = 2; r <= currentTab.rowCount; r++) {
      if (currentTab.data[`A${r}`]?.v || currentTab.data[`B${r}`]?.v) count++;
    }
    return count;
  }, [currentTab]);

  const filteredRowCount = useMemo(() => {
    if (!searchQuery && activeFilterCount === 0) return activeRowCount;
    let count = 0;
    for (let row = 2; row <= currentTab.rowCount; row++) {
      const hasContent = columns.some((c) => !!currentTab.data[`${c.col}${row}`]?.v);
      if (!hasContent) continue;

      if (searchQuery) {
        const rowText = columns
          .map((f) => currentTab.data[`${f.col}${row}`]?.v || '')
          .join(' ')
          .toLowerCase();
        if (!rowText.includes(searchQuery.toLowerCase())) continue;
      }

      if (activeFilterCount > 0) {
        const ageCol = columns.find((c) => c.key === 'age')?.col || 'F';
        const ageVal = parseNumericValue(currentTab.data[`${ageCol}${row}`]?.v);
        const minAge = parseNumericValue(rangeFilters.ageMin);
        const maxAge = parseNumericValue(rangeFilters.ageMax);
        if (minAge !== null && (ageVal === null || ageVal < minAge)) continue;
        if (maxAge !== null && (ageVal === null || ageVal > maxAge)) continue;

        const folCol = columns.find((c) => c.key === 'followers')?.col || 'J';
        const folVal = parseNumericValue(currentTab.data[`${folCol}${row}`]?.v);
        const minFol = parseNumericValue(rangeFilters.followersMin);
        const maxFol = parseNumericValue(rangeFilters.followersMax);
        if (minFol !== null && (folVal === null || folVal < minFol)) continue;
        if (maxFol !== null && (folVal === null || folVal > maxFol)) continue;

        const reelCol = columns.find((c) => c.key === 'reel')?.col || 'L';
        const reelVal = parseNumericValue(currentTab.data[`${reelCol}${row}`]?.v);
        const minReel = parseNumericValue(rangeFilters.reelMin);
        const maxReel = parseNumericValue(rangeFilters.reelMax);
        if (minReel !== null && (reelVal === null || reelVal < minReel)) continue;
        if (maxReel !== null && (reelVal === null || reelVal > maxReel)) continue;

        const storyCol = columns.find((c) => c.key === 'story')?.col || 'M';
        const storyVal = parseNumericValue(currentTab.data[`${storyCol}${row}`]?.v);
        const minStory = parseNumericValue(rangeFilters.storyMin);
        const maxStory = parseNumericValue(rangeFilters.storyMax);
        if (minStory !== null && (storyVal === null || storyVal < minStory)) continue;
        if (maxStory !== null && (storyVal === null || storyVal > maxStory)) continue;
      }

      count++;
    }
    return count;
  }, [currentTab, columns, searchQuery, activeFilterCount, rangeFilters, activeRowCount]);

  const brandTabsCount = useMemo(() => {
    return workbook.tabs.filter((t) => t.id !== masterTab.id).length;
  }, [workbook, masterTab]);

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`flex flex-col outline-hidden ${
        isFullscreen
          ? 'fixed inset-0 z-[9999] h-screen w-screen rounded-none border-0'
          : 'h-full max-h-full min-h-0 flex-1 rounded-xl border'
      } max-w-full overflow-hidden select-none ${
        isDark ? 'bg-[#0f1117] text-zinc-200 border-zinc-800' : 'bg-white text-stone-900 border-stone-200'
      }`}
    >
      {/* 1. TOP HEADER & METRICS BAR */}
      <div
        className={`px-3 py-2 border-b shrink-0 flex items-center justify-between gap-2 sm:gap-4 flex-wrap ${
          isDark ? 'bg-[#141720] border-zinc-800' : 'bg-white border-stone-200'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 shadow-xs ${
              isDark ? 'bg-pink-500/15 text-pink-400' : 'bg-pink-100 text-pink-700'
            }`}
          >
            <Sparkles size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className={`text-xs sm:text-sm font-bold tracking-tight truncate ${isDark ? 'text-zinc-100' : 'text-stone-900'}`}>
                Influencer Marketing
              </h1>
              <span
                className={`hidden xs:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  isDark ? 'bg-pink-500/15 text-pink-400 border-pink-500/25' : 'bg-pink-50 text-pink-700 border-pink-200'
                }`}
              >
                {currentTab.name}
              </span>
              {currentTab.isLocked && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                  <Lock size={10} className="shrink-0" />
                  <span>Locked</span>
                </span>
              )}
            </div>
            <p className={`text-[10px] sm:text-[11px] truncate ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>
              {activeFilterCount > 0 || searchQuery
                ? `${filteredRowCount} of ${activeRowCount} Creators matching filters in ${currentTab.name}`
                : `${activeRowCount} Creators in ${currentTab.name}`} • {brandTabsCount} Brand Sheets Synced
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Intake & Google Form Sync Button */}
          <button
            onClick={() => setIntakeSyncOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all shadow-xs ${
              isDark
                ? 'bg-gradient-to-r from-pink-600/15 to-rose-600/15 hover:from-pink-600/25 hover:to-rose-600/25 border-pink-500/35 text-pink-300'
                : 'bg-pink-50 hover:bg-pink-100 border-pink-300 text-pink-700'
            }`}
            title="Share Intake Form link or configure Google Forms integration"
          >
            <FormInput size={13} className={isDark ? 'text-pink-400' : 'text-pink-600'} />
            <span className="hidden sm:inline">Google Form & Intake</span>
          </button>

          {/* Quick Add Influencer */}
          <button
            onClick={handleAddRow}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all shadow-xs ${
              isDark
                ? 'bg-emerald-600/15 hover:bg-emerald-600/25 border-emerald-500/35 text-emerald-300'
                : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-700'
            }`}
            title="Add Creator Row"
          >
            <Plus size={13} />
            <span className="hidden sm:inline">Add Creator</span>
          </button>

          {/* Sync Brand Sheets */}
          <button
            onClick={() => {
              const res = syncBrandSheets();
              pushState(res);
              toast.success('Brand sheets harmonized with Master Influencer data');
            }}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-2xs ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700/80 border-zinc-700 text-zinc-200'
                : 'bg-white hover:bg-stone-100 border-stone-300 text-stone-700'
            }`}
            title="Re-synchronize Master Sheet and Brand Tabs"
          >
            <RefreshCw size={13} />
            <span className="hidden md:inline">Sync Sheets</span>
          </button>

          {/* Import */}
          <button
            onClick={() => setImportOpen(true)}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-2xs ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700/80 border-zinc-700 text-zinc-200'
                : 'bg-white hover:bg-stone-100 border-stone-300 text-stone-700'
            }`}
            title="Import Influencer CSV"
          >
            <Upload size={13} />
            <span className="hidden sm:inline">Import</span>
          </button>

          {/* Export with Checkbox column selection */}
          <button
            onClick={() => setExportOpen(true)}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-2xs ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700/80 border-zinc-700 text-zinc-200'
                : 'bg-white hover:bg-stone-100 border-stone-300 text-stone-700'
            }`}
            title="Export with custom columns"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Lock / Unlock Toggle */}
          <button
            onClick={handleToggleLock}
            title={currentTab.isLocked ? "Sheet is protected (read-only). Click to unlock." : "Lock sheet to protect against edits"}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all shadow-2xs shrink-0 ${
              currentTab.isLocked
                ? isDark
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/40 hover:bg-amber-500/25'
                  : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                : isDark
                ? 'bg-zinc-800 hover:bg-zinc-700/80 border-zinc-700 text-zinc-300'
                : 'bg-white hover:bg-stone-100 border-stone-300 text-stone-700'
            }`}
          >
            {currentTab.isLocked ? (
              <>
                <Lock size={13} className="text-amber-500 shrink-0" />
                <span className="font-semibold text-amber-600 dark:text-amber-400">Locked</span>
              </>
            ) : (
              <>
                <Unlock size={13} className="text-zinc-400 shrink-0" />
                <span className="hidden sm:inline">Lock</span>
              </>
            )}
          </button>

          {/* Full Screen Toggle */}
          <button
            onClick={() => setIsFullscreen((prev) => !prev)}
            title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Enter Full Screen'}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all shadow-2xs shrink-0 ${
              isFullscreen
                ? isDark
                  ? 'bg-pink-500/20 text-pink-400 border-pink-500/40'
                  : 'bg-pink-50 text-pink-700 border-pink-300'
                : isDark
                ? 'bg-zinc-800 hover:bg-zinc-700/80 border-zinc-700 text-zinc-200'
                : 'bg-white hover:bg-stone-100 border-stone-300 text-stone-700'
            }`}
          >
            {isFullscreen ? <Minimize2 size={13} className="shrink-0" /> : <Maximize2 size={13} className="shrink-0" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit Fullscreen' : 'Full Screen'}</span>
          </button>

          {/* Save Button */}
          <button
            onClick={() => handleSave()}
            disabled={saveStatus === 'saving'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
              saveStatus === 'dirty'
                ? 'bg-pink-600 hover:bg-pink-500 text-white animate-pulse shadow-md shadow-pink-600/30'
                : isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                : 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 shadow-2xs'
            }`}
          >
            <Save size={13} />
            <span>{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'dirty' ? 'Save *' : 'Saved'}</span>
          </button>
        </div>
      </div>

      {/* 2. FORMATTING TOOLBAR & WORKFLOW CONTROLS (HORIZONTAL SWIPEABLE RIBBON) */}
      <div
        className={`px-2 py-1.5 border-b flex items-center gap-1 shrink-0 overflow-x-auto whitespace-nowrap scrollbar-none text-xs select-none ${
          isDark ? 'bg-[#12141a] border-zinc-800 text-zinc-300' : 'bg-stone-100 border-stone-200 text-stone-700'
        }`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {currentTab.isLocked && (
          <>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[11px] font-semibold shrink-0">
              <Lock size={12} className="shrink-0" />
              <span>Read-Only</span>
            </div>
            <div className={`h-4 w-px mx-0.5 shrink-0 ${isDark ? 'bg-zinc-700/40' : 'bg-stone-300'}`} />
          </>
        )}

        {/* Undo / Redo */}
        <button
          onClick={handleUndo}
          disabled={historyIdx <= 0 || currentTab.isLocked}
          title="Undo (Ctrl+Z)"
          className={`p-1.5 rounded disabled:opacity-30 shrink-0 transition-colors ${
            isDark ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-stone-200 text-stone-700'
          }`}
        >
          <Undo2 size={13} />
        </button>
        <button
          onClick={handleRedo}
          disabled={historyIdx >= history.length - 1 || currentTab.isLocked}
          title="Redo (Ctrl+Y)"
          className={`p-1.5 rounded disabled:opacity-30 shrink-0 transition-colors ${
            isDark ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-stone-200 text-stone-700'
          }`}
        >
          <Redo2 size={13} />
        </button>

        <div className={`h-4 w-px mx-0.5 shrink-0 ${isDark ? 'bg-zinc-700/40' : 'bg-stone-300'}`} />

        {/* Text Styles */}
        <button
          onClick={() => updateCell(selectedCell, { bold: !activeCellFormat.bold })}
          title="Bold (Ctrl+B)"
          className={`p-1.5 rounded font-bold transition-colors ${
            activeCellFormat.bold
              ? isDark
                ? 'bg-pink-500/20 text-pink-400 font-extrabold'
                : 'bg-pink-100 text-pink-700 font-extrabold'
              : isDark
              ? 'hover:bg-zinc-800 text-zinc-300'
              : 'hover:bg-stone-200 text-stone-700'
          }`}
        >
          <Bold size={13} />
        </button>

        <button
          onClick={() => updateCell(selectedCell, { italic: !activeCellFormat.italic })}
          title="Italic (Ctrl+I)"
          className={`p-1.5 rounded transition-colors ${
            activeCellFormat.italic
              ? isDark
                ? 'bg-pink-500/20 text-pink-400'
                : 'bg-pink-100 text-pink-700'
              : isDark
              ? 'hover:bg-zinc-800 text-zinc-300'
              : 'hover:bg-stone-200 text-stone-700'
          }`}
        >
          <Italic size={13} />
        </button>

        <button
          onClick={() => updateCell(selectedCell, { underline: !activeCellFormat.underline })}
          title="Underline (Ctrl+U)"
          className={`p-1.5 rounded transition-colors ${
            activeCellFormat.underline
              ? isDark
                ? 'bg-pink-500/20 text-pink-400'
                : 'bg-pink-100 text-pink-700'
              : isDark
              ? 'hover:bg-zinc-800 text-zinc-300'
              : 'hover:bg-stone-200 text-stone-700'
          }`}
        >
          <Underline size={13} />
        </button>

        <button
          onClick={() => updateCell(selectedCell, { strike: !activeCellFormat.strike })}
          title="Strikethrough"
          className={`p-1.5 rounded transition-colors ${
            activeCellFormat.strike
              ? isDark
                ? 'bg-pink-500/20 text-pink-400'
                : 'bg-pink-100 text-pink-700'
              : isDark
              ? 'hover:bg-zinc-800 text-zinc-300'
              : 'hover:bg-stone-200 text-stone-700'
          }`}
        >
          <Strikethrough size={13} />
        </button>

        <div className={`h-4 w-px mx-0.5 shrink-0 ${isDark ? 'bg-zinc-700/40' : 'bg-stone-300'}`} />

        {/* Text Alignment */}
        <button
          onClick={() => updateCell(selectedCell, { align: 'left' })}
          title="Align Left"
          className={`p-1.5 rounded transition-colors ${
            activeCellFormat.align === 'left' || !activeCellFormat.align
              ? isDark
                ? 'bg-pink-500/20 text-pink-400'
                : 'bg-pink-100 text-pink-700'
              : isDark
              ? 'hover:bg-zinc-800 text-zinc-300'
              : 'hover:bg-stone-200 text-stone-700'
          }`}
        >
          <AlignLeft size={13} />
        </button>
        <button
          onClick={() => updateCell(selectedCell, { align: 'center' })}
          title="Align Center"
          className={`p-1.5 rounded transition-colors ${
            activeCellFormat.align === 'center'
              ? isDark
                ? 'bg-pink-500/20 text-pink-400'
                : 'bg-pink-100 text-pink-700'
              : isDark
              ? 'hover:bg-zinc-800 text-zinc-300'
              : 'hover:bg-stone-200 text-stone-700'
          }`}
        >
          <AlignCenter size={13} />
        </button>
        <button
          onClick={() => updateCell(selectedCell, { align: 'right' })}
          title="Align Right"
          className={`p-1.5 rounded transition-colors ${
            activeCellFormat.align === 'right'
              ? isDark
                ? 'bg-pink-500/20 text-pink-400'
                : 'bg-pink-100 text-pink-700'
              : isDark
              ? 'hover:bg-zinc-800 text-zinc-300'
              : 'hover:bg-stone-200 text-stone-700'
          }`}
        >
          <AlignRight size={13} />
        </button>

        <div className={`h-4 w-px mx-0.5 shrink-0 ${isDark ? 'bg-zinc-700/40' : 'bg-stone-300'}`} />

        {/* Number Formats */}
        <button
          onClick={() =>
            updateCell(selectedCell, {
              format: activeCellFormat.format === 'currency' ? 'text' : 'currency',
            })
          }
          title="Format as Currency (₹ / $)"
          className={`p-1.5 rounded flex items-center gap-0.5 transition-colors ${
            activeCellFormat.format === 'currency'
              ? isDark
                ? 'bg-pink-500/20 text-pink-400 font-bold'
                : 'bg-pink-100 text-pink-700 font-bold'
              : isDark
              ? 'hover:bg-zinc-800 text-zinc-300'
              : 'hover:bg-stone-200 text-stone-700'
          }`}
        >
          <DollarSign size={13} />
        </button>

        <button
          onClick={() =>
            updateCell(selectedCell, {
              format: activeCellFormat.format === 'percent' ? 'text' : 'percent',
            })
          }
          title="Format as Percent (%)"
          className={`p-1.5 rounded flex items-center gap-0.5 transition-colors ${
            activeCellFormat.format === 'percent'
              ? isDark
                ? 'bg-pink-500/20 text-pink-400 font-bold'
                : 'bg-pink-100 text-pink-700 font-bold'
              : isDark
              ? 'hover:bg-zinc-800 text-zinc-300'
              : 'hover:bg-stone-200 text-stone-700'
          }`}
        >
          <Percent size={13} />
        </button>

        <div className={`h-4 w-px mx-0.5 shrink-0 ${isDark ? 'bg-zinc-700/40' : 'bg-stone-300'}`} />

        {/* Background / Cell Fill Color */}
        <div className="relative">
          <button
            onClick={(e) => toggleColorPicker('bg', e)}
            title="Cell fill color"
            className={`flex items-center gap-1 p-1.5 rounded transition-colors ${
              showColorPicker === 'bg'
                ? isDark
                  ? 'bg-zinc-800'
                  : 'bg-stone-200'
                : isDark
                ? 'hover:bg-zinc-800 text-zinc-300'
                : 'hover:bg-stone-200 text-stone-700'
            }`}
          >
            <div
              className="w-3.5 h-3.5 rounded-xs border border-zinc-400"
              style={{ backgroundColor: activeCellFormat.bg || 'transparent' }}
            />
            <Palette size={12} />
          </button>
        </div>

        {/* Text Color */}
        <div className="relative">
          <button
            onClick={(e) => toggleColorPicker('text', e)}
            title="Text color"
            className={`flex items-center gap-1 p-1.5 rounded transition-colors ${
              showColorPicker === 'text'
                ? isDark
                  ? 'bg-zinc-800'
                  : 'bg-stone-200'
                : isDark
                ? 'hover:bg-zinc-800 text-zinc-300'
                : 'hover:bg-stone-200 text-stone-700'
            }`}
          >
            <span
              className="text-xs font-bold underline"
              style={{ color: activeCellFormat.color || 'currentColor' }}
            >
              A
            </span>
          </button>
        </div>

        {/* Floating Portal Color Pickers to avoid overflow and composited layer clipping */}
        {typeof document !== 'undefined' && showColorPicker === 'bg' && colorPickerAnchor && createPortal(
          <>
            <div
              className="fixed inset-0 z-[99998] bg-transparent cursor-default"
              onClick={() => {
                setShowColorPicker(null);
                setColorPickerAnchor(null);
              }}
            />
            <div
              style={{
                position: 'fixed',
                top: `${colorPickerAnchor.top}px`,
                left: `${colorPickerAnchor.left}px`,
              }}
              onClick={(e) => e.stopPropagation()}
              className={`fixed z-[99999] p-3 rounded-xl border shadow-2xl w-64 select-none ${
                isDark ? 'bg-[#1a1d24] border-zinc-700 text-white' : 'bg-white border-stone-200 text-stone-900'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${isDark ? 'text-zinc-200' : 'text-stone-700'}`}>Fill Color</span>
                <button
                  type="button"
                  onClick={() => {
                    updateCell(selectedCell, { bg: undefined });
                    setShowColorPicker(null);
                    setColorPickerAnchor(null);
                  }}
                  className={`text-[11px] font-medium hover:underline cursor-pointer ${
                    isDark ? 'text-zinc-400 hover:text-rose-400' : 'text-stone-500 hover:text-rose-500'
                  }`}
                >
                  Reset (No Fill)
                </button>
              </div>

              <div className="mb-2.5">
                <div className={`text-[10px] font-medium mb-1.5 uppercase tracking-wider ${
                  isDark ? 'text-zinc-400' : 'text-stone-400'
                }`}>
                  Pastel Tints
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {PASTEL_BG_PALETTE.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => {
                        updateCell(selectedCell, { bg: p.color === 'transparent' ? undefined : p.color });
                        setShowColorPicker(null);
                        setColorPickerAnchor(null);
                      }}
                      title={p.name}
                      className="h-6 w-full rounded border border-zinc-300 dark:border-zinc-600 hover:scale-105 active:scale-95 transition-transform"
                      style={{ backgroundColor: p.color }}
                    />
                  ))}
                </div>
              </div>

              <div className={`h-px my-2 ${isDark ? 'bg-zinc-800' : 'bg-stone-200'}`} />

              <div>
                <div className={`text-[10px] font-medium mb-1.5 uppercase tracking-wider ${
                  isDark ? 'text-zinc-400' : 'text-stone-400'
                }`}>
                  Standard Palette
                </div>
                <div className="grid grid-cols-10 gap-1">
                  {COLOR_PALETTE.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        updateCell(selectedCell, { bg: c });
                        setShowColorPicker(null);
                        setColorPickerAnchor(null);
                      }}
                      className="h-4.5 w-4.5 rounded-xs border border-zinc-400/40 hover:scale-115 active:scale-95 transition-transform"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>,
          document.body
        )}

        {typeof document !== 'undefined' && showColorPicker === 'text' && colorPickerAnchor && createPortal(
          <>
            <div
              className="fixed inset-0 z-[99998] bg-transparent cursor-default"
              onClick={() => {
                setShowColorPicker(null);
                setColorPickerAnchor(null);
              }}
            />
            <div
              style={{
                position: 'fixed',
                top: `${colorPickerAnchor.top}px`,
                left: `${colorPickerAnchor.left}px`,
              }}
              onClick={(e) => e.stopPropagation()}
              className={`fixed z-[99999] p-3 rounded-xl border shadow-2xl w-64 select-none ${
                isDark ? 'bg-[#1a1d24] border-zinc-700 text-white' : 'bg-white border-stone-200 text-stone-900'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${isDark ? 'text-zinc-200' : 'text-stone-700'}`}>Text Color</span>
                <button
                  type="button"
                  onClick={() => {
                    updateCell(selectedCell, { color: undefined });
                    setShowColorPicker(null);
                    setColorPickerAnchor(null);
                  }}
                  className={`text-[11px] font-medium hover:underline cursor-pointer ${
                    isDark ? 'text-zinc-400 hover:text-rose-400' : 'text-stone-500 hover:text-rose-500'
                  }`}
                >
                  Reset (Default)
                </button>
              </div>
              <div className="grid grid-cols-10 gap-1">
                {COLOR_PALETTE.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      updateCell(selectedCell, { color: c });
                      setShowColorPicker(null);
                      setColorPickerAnchor(null);
                    }}
                    className="h-4.5 w-4.5 rounded-xs border border-zinc-400/40 hover:scale-115 active:scale-95 transition-transform"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </>,
          document.body
        )}

        <div className={`h-4 w-px mx-0.5 shrink-0 ${isDark ? 'bg-zinc-700/40' : 'bg-stone-300'}`} />

        {/* Brand Selector Pill */}
        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>Tab:</span>
          <select
            value={workbook.activeTab}
            onChange={(e) => setWorkbook((p) => ({ ...p, activeTab: e.target.value }))}
            className={`text-xs font-bold px-2 py-1 rounded border outline-hidden ${
              isDark ? 'bg-zinc-900 border-zinc-700 text-pink-400' : 'bg-white border-stone-300 text-pink-700'
            }`}
          >
            {workbook.tabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setAddBrandOpen(true)}
          className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded border shrink-0 transition-colors ${
            isDark
              ? 'border-pink-500/35 bg-pink-500/10 text-pink-300 hover:bg-pink-500/20'
              : 'border-pink-300 bg-pink-50 text-pink-700 hover:bg-pink-100'
          }`}
          title="Create a new brand tab"
        >
          <Plus size={11} />
          <span>New Brand</span>
        </button>

        {currentTab.id !== masterTab.id && (
          <button
            onClick={() => {
              setSheetToDelete(currentTab);
              setDeleteSheetOpen(true);
            }}
            className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded border shrink-0 transition-colors ${
              isDark
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                : 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
            title={`Delete brand sheet "${currentTab.name}"`}
          >
            <Trash2 size={11} />
            <span>Delete Sheet</span>
          </button>
        )}

        <div className={`h-4 w-px mx-0.5 shrink-0 ${isDark ? 'bg-zinc-700/40' : 'bg-stone-300'}`} />

        {/* Row Operations */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => handleInsertRow()}
            title="Add creator row"
            className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded border shrink-0 transition-colors ${
              isDark
                ? 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100 shadow-2xs'
            }`}
          >
            <Plus size={11} className="text-emerald-500" />
            <span>+ Row</span>
          </button>
          <button
            onClick={() => handleDeleteRow(selectedRow)}
            disabled={selectedRow < 2}
            title={selectedRow >= 2 ? `Delete Row ${selectedRow}` : 'Select a creator row to delete'}
            className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded border shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              selectedRow >= 2
                ? isDark
                  ? 'bg-zinc-900 border-zinc-700 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30'
                  : 'bg-white border-stone-300 text-rose-600 hover:bg-rose-50 hover:border-rose-300 shadow-2xs'
                : isDark
                ? 'bg-zinc-900/50 border-zinc-800 text-zinc-500'
                : 'bg-stone-100 border-stone-200 text-stone-400'
            }`}
          >
            <Trash2 size={11} />
            <span>- Row {selectedRow >= 2 ? `(${selectedRow})` : ''}</span>
          </button>
        </div>

        <div className={`h-4 w-px mx-0.5 shrink-0 ${isDark ? 'bg-zinc-700/40' : 'bg-stone-300'}`} />

        {/* Column Operations */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setAddColumnOpen(true)}
            title="Add a custom column to sheet"
            className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded border shrink-0 transition-colors ${
              isDark
                ? 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100 shadow-2xs'
            }`}
          >
            <Plus size={11} className="text-pink-500" />
            <span>+ Column</span>
          </button>
          <button
            onClick={() => {
              setColToDelete(selectedCol);
              setRemoveColumnOpen(true);
            }}
            title="Remove a column"
            className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded border shrink-0 transition-colors ${
              isDark
                ? 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100 shadow-2xs'
            }`}
          >
            <Minus size={11} className="text-zinc-400" />
            <span>- Column</span>
          </button>
        </div>

        <div className={`h-4 w-px mx-0.5 shrink-0 ${isDark ? 'bg-zinc-700/40' : 'bg-stone-300'}`} />

        {/* Search in Sheet */}
        <div className="relative shrink-0 flex items-center">
          <Search size={12} className={`absolute left-2 ${isDark ? 'text-zinc-500' : 'text-stone-400'}`} />
          <input
            type="text"
            placeholder="Search creators…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`pl-6 pr-2 py-1 text-xs rounded border outline-hidden w-28 sm:w-36 ${
              isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200 placeholder:text-zinc-500' : 'bg-white border-stone-300 text-stone-800 placeholder:text-stone-400'
            }`}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className={`absolute right-1 ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-stone-400 hover:text-stone-600'}`}>
              <X size={11} />
            </button>
          )}
        </div>

        {/* Range Filters Button */}
        <button
          onClick={() => setRangeFilterOpen(true)}
          title="Open Numeric Range Filters (Age, Followers, Reel Rate, Story Rate)"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition-all shrink-0 ${
            activeFilterCount > 0
              ? isDark
                ? 'bg-pink-500/20 border-pink-500/50 text-pink-300 shadow-xs'
                : 'bg-pink-50 border-pink-300 text-pink-700 shadow-xs font-bold'
              : isDark
              ? 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100 shadow-2xs'
          }`}
        >
          <SlidersHorizontal size={12} className={activeFilterCount > 0 ? (isDark ? 'text-pink-400' : 'text-pink-600') : (isDark ? 'text-zinc-400' : 'text-stone-500')} />
          <span>Range Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-pink-600 text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={() => setRangeFilters(initialRangeFilters)}
            className="text-[10px] font-semibold text-rose-500 hover:underline shrink-0"
            title="Reset numeric range filters"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* 2b. ACTIVE FILTERS CHIP BAR */}
      {activeFilterCount > 0 && (
        <div
          className={`px-3 py-1 border-b flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0 scrollbar-none ${
            isDark ? 'bg-pink-950/20 border-pink-900/30 text-pink-300' : 'bg-pink-50/70 border-pink-100 text-pink-800'
          }`}
        >
          <span className="font-semibold text-[10px] uppercase tracking-wider opacity-75">Active Filters:</span>
          {(rangeFilters.ageMin || rangeFilters.ageMax) && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium shrink-0 ${isDark ? 'bg-zinc-900 border-pink-500/30' : 'bg-white border-pink-200'}`}>
              Age: {rangeFilters.ageMin || '0'} – {rangeFilters.ageMax || '∞'} yrs
              <button onClick={() => setRangeFilters((p) => ({ ...p, ageMin: '', ageMax: '' }))} className="hover:text-rose-500">
                <X size={10} />
              </button>
            </span>
          )}
          {(rangeFilters.followersMin || rangeFilters.followersMax) && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium shrink-0 ${isDark ? 'bg-zinc-900 border-pink-500/30' : 'bg-white border-pink-200'}`}>
              Followers: {rangeFilters.followersMin || '0'} – {rangeFilters.followersMax || '∞'}
              <button onClick={() => setRangeFilters((p) => ({ ...p, followersMin: '', followersMax: '' }))} className="hover:text-rose-500">
                <X size={10} />
              </button>
            </span>
          )}
          {(rangeFilters.reelMin || rangeFilters.reelMax) && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium shrink-0 ${isDark ? 'bg-zinc-900 border-pink-500/30' : 'bg-white border-pink-200'}`}>
              Reel: ₹{rangeFilters.reelMin || '0'} – ₹{rangeFilters.reelMax || '∞'}
              <button onClick={() => setRangeFilters((p) => ({ ...p, reelMin: '', reelMax: '' }))} className="hover:text-rose-500">
                <X size={10} />
              </button>
            </span>
          )}
          {(rangeFilters.storyMin || rangeFilters.storyMax) && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium shrink-0 ${isDark ? 'bg-zinc-900 border-pink-500/30' : 'bg-white border-pink-200'}`}>
              Story: ₹{rangeFilters.storyMin || '0'} – ₹{rangeFilters.storyMax || '∞'}
              <button onClick={() => setRangeFilters((p) => ({ ...p, storyMin: '', storyMax: '' }))} className="hover:text-rose-500">
                <X size={10} />
              </button>
            </span>
          )}
          <button
            onClick={() => setRangeFilters(initialRangeFilters)}
            className="text-[10px] underline hover:opacity-80 ml-auto font-medium shrink-0"
          >
            Clear All
          </button>
        </div>
      )}

      {/* 3. FORMULA / CELL BAR */}
      <div
        className={`px-2 sm:px-3 py-1 sm:py-1.5 border-b flex items-center gap-2 shrink-0 ${
          isDark ? 'bg-[#14161f] border-zinc-800' : 'bg-white border-stone-200'
        }`}
      >
        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border select-none ${isDark ? 'text-pink-400 bg-pink-500/10 border-pink-500/20' : 'text-pink-700 bg-pink-50 border-pink-200'}`}>
          {selectedCell}
        </span>
        <div className={`text-xs font-mono font-bold select-none ${isDark ? 'text-pink-400' : 'text-pink-600'}`}>fx</div>
        <input
          ref={formulaInputRef}
          type="text"
          value={formulaValue}
          disabled={currentTab.isLocked}
          onChange={(e) => {
            if (currentTab.isLocked) return;
            setFormulaValue(e.target.value);
            if (!isEditing) {
              setIsEditing(true);
              setEditValue(e.target.value);
            } else {
              setEditValue(e.target.value);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitEdit(formulaValue);
            }
          }}
          onFocus={() => {
            if (!currentTab.isLocked) {
              setIsEditing(true);
              setEditValue(formulaValue);
            }
          }}
          placeholder={currentTab.isLocked ? "Sheet is locked (view-only)" : "Enter creator detail, rate, or formula (=SUM, =AVERAGE, =COUNT)"}
          className={`grow min-w-0 bg-transparent outline-hidden text-xs ${
            currentTab.isLocked ? 'cursor-not-allowed opacity-60' : ''
          } ${isDark ? 'text-zinc-200 placeholder:text-zinc-500' : 'text-stone-900 placeholder:text-stone-400'}`}
        />
        {isEditing && (
          <button
            onClick={() => commitEdit(formulaValue)}
            className="flex h-6 w-6 items-center justify-center rounded bg-pink-600 text-white shrink-0 hover:bg-pink-500"
            title="Commit Edit"
          >
            <Check size={12} />
          </button>
        )}
      </div>

      {/* 4. SPREADSHEET GRID */}
      <div
        ref={gridContainerRef}
        className="grow min-h-0 overflow-x-auto overflow-y-auto relative select-none scrollbar-thin [contain:paint]"
        style={{ scrollbarGutter: 'stable', WebkitOverflowScrolling: 'touch' }}
      >
        <table className="border-collapse table-fixed w-max text-xs">
          <thead>
            <tr className={`sticky top-0 z-20 ${isDark ? 'bg-[#181b24]' : 'bg-stone-100'}`}>
              {/* Corner Header Anchor */}
              <th
                style={{ width: 48, minWidth: 48, maxWidth: 48 }}
                onClick={() => {
                  setSelectedCell('A2');
                  if (gridContainerRef.current) {
                    gridContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                  }
                }}
                className={`sticky top-0 left-0 z-30 h-8 border text-center font-mono text-xs select-none overflow-hidden cursor-pointer ${
                  isDark ? 'border-zinc-800 bg-[#161822] text-zinc-500' : 'border-stone-300 bg-stone-200 text-stone-500'
                }`}
              >
                #
              </th>

              {/* Column Headers */}
              {columns.map((field) => {
                const col = field.col;
                const width = currentTab.colWidths[col] || field.defaultWidth;
                return (
                  <th
                    key={col}
                    style={{ width, minWidth: width, maxWidth: width }}
                    onClick={() => setSelectedCell(`${col}2`)}
                    className={`relative h-8 px-1.5 border text-center font-bold text-xs tracking-wider select-none group/col ${
                      isDark
                        ? 'border-zinc-800 bg-[#191c26] text-pink-400'
                        : 'border-stone-300 bg-stone-200 text-pink-700'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{field.label}</span>
                      <span className="text-[10px] font-mono text-zinc-500 opacity-60">({col})</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setColToDelete(col);
                          setRemoveColumnOpen(true);
                        }}
                        title={`Remove column ${field.label} (${col})`}
                        className="opacity-0 group-hover/col:opacity-100 p-0.5 rounded text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all ml-0.5"
                      >
                        <X size={10} />
                      </button>
                    </div>

                    {/* Resize Handle */}
                    <div
                      onMouseDown={(e) => handleResizeStart(e, col)}
                      onTouchStart={(e) => handleResizeStart(e, col)}
                      className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-pink-500 active:bg-pink-500 z-10 touch-none"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: currentTab.rowCount }).map((_, rIdx) => {
              const row = rIdx + 1;
              if (row === 1) return null; // Row 1 is header

              const hasContent = columns.some((c) => !!currentTab.data[`${c.col}${row}`]?.v);
              if (!hasContent && (searchQuery || activeFilterCount > 0)) {
                return null;
              }

              // Check search filter match
              if (searchQuery) {
                const rowText = columns
                  .map((f) => currentTab.data[`${f.col}${row}`]?.v || '')
                  .join(' ')
                  .toLowerCase();
                if (!rowText.includes(searchQuery.toLowerCase())) {
                  return null;
                }
              }

              // Check Numeric Range Filters
              if (activeFilterCount > 0) {
                const ageCol = columns.find((c) => c.key === 'age')?.col || 'F';
                const ageVal = parseNumericValue(currentTab.data[`${ageCol}${row}`]?.v);
                const minAge = parseNumericValue(rangeFilters.ageMin);
                const maxAge = parseNumericValue(rangeFilters.ageMax);
                if (minAge !== null && (ageVal === null || ageVal < minAge)) return null;
                if (maxAge !== null && (ageVal === null || ageVal > maxAge)) return null;

                const folCol = columns.find((c) => c.key === 'followers')?.col || 'J';
                const folVal = parseNumericValue(currentTab.data[`${folCol}${row}`]?.v);
                const minFol = parseNumericValue(rangeFilters.followersMin);
                const maxFol = parseNumericValue(rangeFilters.followersMax);
                if (minFol !== null && (folVal === null || folVal < minFol)) return null;
                if (maxFol !== null && (folVal === null || folVal > maxFol)) return null;

                const reelCol = columns.find((c) => c.key === 'reel')?.col || 'L';
                const reelVal = parseNumericValue(currentTab.data[`${reelCol}${row}`]?.v);
                const minReel = parseNumericValue(rangeFilters.reelMin);
                const maxReel = parseNumericValue(rangeFilters.reelMax);
                if (minReel !== null && (reelVal === null || reelVal < minReel)) return null;
                if (maxReel !== null && (reelVal === null || reelVal > maxReel)) return null;

                const storyCol = columns.find((c) => c.key === 'story')?.col || 'M';
                const storyVal = parseNumericValue(currentTab.data[`${storyCol}${row}`]?.v);
                const minStory = parseNumericValue(rangeFilters.storyMin);
                const maxStory = parseNumericValue(rangeFilters.storyMax);
                if (minStory !== null && (storyVal === null || storyVal < minStory)) return null;
                if (maxStory !== null && (storyVal === null || storyVal > maxStory)) return null;
              }

              return (
                <tr key={row} className="transition-colors">
                  {/* Sticky Row Number */}
                  <td
                    style={{ width: 48, minWidth: 48, maxWidth: 48 }}
                    onClick={() => {
                      setSelectedCell(`A${row}`);
                      if (gridContainerRef.current && gridContainerRef.current.scrollLeft > 0 && gridContainerRef.current.scrollLeft < 200) {
                        gridContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                      }
                    }}
                    className={`sticky left-0 z-10 h-8 border text-center font-mono text-[11px] select-none group/row overflow-hidden ${
                      isDark ? 'border-zinc-800 bg-[#161822] text-zinc-500' : 'border-stone-300 bg-stone-200 text-stone-500'
                    }`}
                  >
                    <div className="flex items-center justify-between px-1 w-full overflow-hidden">
                      <span className="truncate">{row}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRow(row);
                        }}
                        title={`Delete row ${row}`}
                        className="opacity-0 group-hover/row:opacity-100 p-0.5 rounded text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all shrink-0"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </td>

                  {/* Cells */}
                  {columns.map((field) => {
                    const col = field.col;
                    const cellKey = `${col}${row}`;
                    const cell = currentTab.data[cellKey];
                    const isSelected = selectedCell === cellKey;
                    const isColSelected = selectedCell.startsWith(col);
                    const isSearchMatch = searchQuery
                      ? String(cell?.v || '').toLowerCase().includes(searchQuery.toLowerCase())
                      : false;
                    const cellStyles = resolveCellStyles(cell, isSearchMatch);

                    const width = currentTab.colWidths[col] || field.defaultWidth;

                    return (
                      <td
                        key={col}
                        style={{
                          width,
                          minWidth: width,
                          maxWidth: width,
                          ...cellStyles,
                        }}
                        onClick={() => {
                          if (selectedCell !== cellKey) {
                            if (isEditing) commitEdit(editValue);
                            setSelectedCell(cellKey);
                          } else if (!isEditing) {
                            if (currentTab.isLocked) {
                              toast.error('Sheet is locked', {
                                description: 'Unlock this sheet tab from the top toolbar to edit.',
                              });
                              return;
                            }
                            setIsEditing(true);
                            setEditValue(String(cell?.v || ''));
                            setTimeout(() => cellInputRef.current?.focus({ preventScroll: true }), 10);
                          }
                        }}
                        onDoubleClick={() => {
                          if (currentTab.isLocked) {
                            toast.error('Sheet is locked', {
                              description: 'Unlock this sheet tab from the top toolbar to edit.',
                            });
                            return;
                          }
                          setIsEditing(true);
                          setEditValue(String(cell?.v || ''));
                          setTimeout(() => cellInputRef.current?.focus({ preventScroll: true }), 10);
                        }}
                        className={`relative h-8 px-2 border truncate whitespace-nowrap overflow-hidden text-xs transition-colors ${
                          isDark ? 'border-zinc-800/80' : 'border-stone-200'
                        } ${
                          isSelected
                            ? isDark
                              ? 'ring-2 ring-pink-500 ring-inset bg-pink-500/10'
                              : 'ring-2 ring-pink-600 ring-inset bg-pink-50'
                            : isColSelected
                            ? isDark
                              ? 'bg-zinc-900/40'
                              : 'bg-stone-50/70'
                            : ''
                        }`}
                      >
                        {isSelected && isEditing ? (
                          <input
                            ref={cellInputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit(editValue);
                              if (e.key === 'Escape') setIsEditing(false);
                            }}
                            onBlur={() => commitEdit(editValue)}
                            className="absolute inset-0 w-full h-full px-2 bg-transparent outline-hidden font-sans text-xs text-foreground z-10"
                            autoFocus
                          />
                        ) : (
                          <span
                            className={`${cell?.bold ? 'font-bold' : ''} ${
                              col === 'B' && !cell?.color
                                ? isDark
                                  ? 'text-sky-400 font-medium'
                                  : 'text-sky-700 font-semibold'
                                : ''
                            } ${
                              col === 'K' && !cell?.color
                                ? isDark
                                  ? 'text-pink-400 font-bold'
                                  : 'text-pink-700 font-bold'
                                : ''
                            } ${
                              col === 'N' && !cell?.bg
                                ? cell?.v === 'Onboarded'
                                  ? isDark
                                    ? 'px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold text-[10px]'
                                    : 'px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[10px]'
                                  : cell?.v === 'Shortlisted'
                                  ? isDark
                                    ? 'px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold text-[10px]'
                                    : 'px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold text-[10px]'
                                  : isDark
                                  ? 'px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-semibold text-[10px]'
                                  : 'px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-semibold text-[10px]'
                                : ''
                            }`}
                          >
                            {getCellDisplay(cell)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Add creator button at bottom of grid */}
        <div className="p-3 flex items-center gap-2">
          <button
            onClick={handleAddRow}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              isDark
                ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-pink-400'
                : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-pink-700'
            }`}
          >
            <Plus size={13} />
            <span>+ Add Row in {currentTab.name}</span>
          </button>
        </div>
      </div>

      {/* 5. BOTTOM TABS BAR */}
      <div
        className={`px-3 py-2 flex items-center justify-between border-t shrink-0 min-h-[42px] ${
          isDark ? 'bg-[#141720] border-zinc-800' : 'bg-stone-100 border-stone-300'
        }`}
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Add Brand Sheet Tab Button */}
          <button
            onClick={() => setAddBrandOpen(true)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold shrink-0 border transition-colors ${
              isDark
                ? 'bg-pink-600/10 hover:bg-pink-600/20 text-pink-400 border-pink-500/30'
                : 'bg-pink-50 hover:bg-pink-100 text-pink-700 border-pink-300'
            }`}
            title="Create Brand Sheet"
          >
            <Plus size={12} />
            <span>New Brand Sheet</span>
          </button>

          <div className={`h-4 w-px mx-1 shrink-0 ${isDark ? 'bg-zinc-700/50' : 'bg-stone-300'}`} />

          {/* Tab Buttons */}
          {workbook.tabs.map((tab) => {
            const isActive = tab.id === workbook.activeTab;
            const isMaster = tab.id === masterTab.id;
            return (
              <div
                key={tab.id}
                className={`group flex items-center rounded text-xs transition-all shrink-0 border ${
                  isActive
                    ? isDark
                      ? 'bg-zinc-900 border-pink-500 text-pink-400 shadow-xs'
                      : 'bg-white border-pink-500 text-pink-700 shadow-xs font-bold'
                    : isDark
                    ? 'border-transparent text-zinc-400 hover:bg-zinc-800/60'
                    : 'border-transparent text-stone-600 hover:bg-stone-200'
                }`}
              >
                <button
                  onClick={() => setWorkbook((p) => ({ ...p, activeTab: tab.id }))}
                  className="flex items-center gap-1.5 px-2.5 py-1 font-medium"
                >
                  {isMaster ? (
                    <Sparkles size={12} className="text-pink-500 shrink-0" />
                  ) : (
                    <Building2 size={12} className={`shrink-0 ${isDark ? 'text-zinc-400' : 'text-stone-500'}`} />
                  )}
                  <span>{tab.name}</span>
                  {tab.isLocked && (
                    <span title="Sheet is locked" className="inline-flex items-center">
                      <Lock size={10} className="text-amber-500 shrink-0" />
                    </span>
                  )}
                </button>
                {!isMaster && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (tab.isLocked) {
                        toast.error('Sheet is locked', {
                          description: 'Unlock this sheet tab before deleting.',
                        });
                        return;
                      }
                      setSheetToDelete(tab);
                      setDeleteSheetOpen(true);
                    }}
                    title={`Delete sheet "${tab.name}"`}
                    className={`p-1 mr-1 rounded text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors ${
                      isActive ? 'opacity-80 hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className={`hidden sm:flex items-center gap-2 text-[11px] shrink-0 pl-2 ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>
          <span>Brand syncing: Active</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: EXPORT MODAL WITH COLUMN CHECKBOXES */}
      {/* ========================================================================= */}
      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className={`max-w-md w-full rounded-2xl border p-5 shadow-2xl ${
              isDark ? 'bg-[#141720] border-zinc-800 text-zinc-100' : 'bg-white border-stone-200 text-stone-900'
            }`}
          >
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-zinc-800' : 'border-stone-200'}`}>
              <div className="flex items-center gap-2">
                <Download size={16} className="text-pink-500" />
                <h3 className="text-sm font-bold">Export Influencers Data</h3>
              </div>
              <button
                onClick={() => setExportOpen(false)}
                className={isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-stone-400 hover:text-stone-600'}
              >
                <X size={15} />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Export Scope */}
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                  Sheet Scope
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportScope('current')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium text-left transition-colors ${
                      exportScope === 'current'
                        ? isDark
                          ? 'border-pink-500 bg-pink-500/10 text-pink-400 font-semibold'
                          : 'border-pink-500 bg-pink-50 text-pink-700 font-bold'
                        : isDark
                        ? 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800/50'
                        : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    Current Sheet ({currentTab.name})
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportScope('all')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium text-left transition-colors ${
                      exportScope === 'all'
                        ? isDark
                          ? 'border-pink-500 bg-pink-500/10 text-pink-400 font-semibold'
                          : 'border-pink-500 bg-pink-50 text-pink-700 font-bold'
                        : isDark
                        ? 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800/50'
                        : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    All Master Influencers
                  </button>
                </div>
              </div>

              {/* Column Selection Checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`text-xs font-semibold ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                    Select Columns to Export ({Object.values(exportColumns).filter(Boolean).length}/{INFLUENCER_FIELDS.length})
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        const allOn: Record<string, boolean> = {};
                        INFLUENCER_FIELDS.forEach((f) => (allOn[f.col] = true));
                        setExportColumns(allOn);
                      }}
                      className={isDark ? 'text-pink-400 hover:underline' : 'text-pink-700 hover:underline font-medium'}
                    >
                      Select All
                    </button>
                    <span className={isDark ? 'text-zinc-600' : 'text-stone-400'}>•</span>
                    <button
                      type="button"
                      onClick={() => setExportColumns({})}
                      className={isDark ? 'text-zinc-400 hover:underline' : 'text-stone-500 hover:underline'}
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div
                  className={`grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-lg border text-xs ${
                    isDark ? 'border-zinc-800/80 bg-zinc-900/40 text-zinc-200' : 'border-stone-200 bg-stone-50 text-stone-800'
                  }`}
                >
                  {INFLUENCER_FIELDS.map((field) => {
                    const isChecked = !!exportColumns[field.col];
                    return (
                      <label
                        key={field.col}
                        className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                          isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-stone-200/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setExportColumns((prev) => ({
                              ...prev,
                              [field.col]: e.target.checked,
                            }))
                          }
                          className="rounded text-pink-600 focus:ring-pink-500 cursor-pointer"
                        />
                        <span className="truncate">{field.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className={`flex items-center justify-end gap-2 pt-3 border-t ${isDark ? 'border-zinc-800' : 'border-stone-200'}`}>
              <button
                onClick={() => setExportOpen(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isDark
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 shadow-md shadow-pink-600/20"
              >
                Download Export File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: INTAKE & GOOGLE FORM SYNC MODAL */}
      {/* ========================================================================= */}
      {intakeSyncOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className={`max-w-xl w-full rounded-2xl border p-5 sm:p-6 shadow-2xl ${
              isDark ? 'bg-[#141720] border-zinc-800 text-zinc-100' : 'bg-white border-stone-200 text-stone-900'
            }`}
          >
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-zinc-800' : 'border-stone-200'}`}>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-pink-500" />
                <h3 className="text-sm font-bold">Google Form & Public Intake Sync</h3>
              </div>
              <button
                onClick={() => setIntakeSyncOpen(false)}
                className={isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-stone-400 hover:text-stone-600'}
              >
                <X size={15} />
              </button>
            </div>

            <div className="py-4 space-y-5 text-xs">
              {/* Option 1: Built-in Paid Commercial Intake Form */}
              <div
                className={`p-3.5 rounded-xl border space-y-2 ${
                  isDark ? 'border-pink-500/30 bg-pink-500/5' : 'border-pink-200 bg-pink-50/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <strong className={`text-xs flex items-center gap-1.5 font-bold ${isDark ? 'text-pink-400' : 'text-pink-700'}`}>
                    <CreditCard size={14} /> 1. Paid Campaign Intake Form (Commercial Rate Ranges)
                  </strong>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      isDark ? 'bg-pink-500/20 text-pink-300' : 'bg-pink-100 text-pink-700'
                    }`}
                  >
                    0-5k, 5k-10k... Ranges
                  </span>
                </div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                  Share with creators for paid brand campaigns. Collects Instagram profile URL, reach, and commercial rate ranges (0-5k, 5k-10k, ..., 45-50k) via dropdowns.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}/influencer-intake` : '/influencer-intake'}
                    className={`grow px-2.5 py-1.5 rounded-lg border font-mono text-[11px] ${
                      isDark ? 'border-zinc-700 bg-zinc-900 text-pink-300' : 'border-stone-300 bg-white text-pink-700'
                    }`}
                  />
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(`${window.location.origin}/influencer-intake`);
                        toast.success('Paid campaign intake link copied to clipboard!');
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shrink-0 flex items-center gap-1"
                  >
                    <Copy size={12} />
                    <span>Copy</span>
                  </button>
                  <button
                    onClick={() => window.open('/influencer-intake', '_blank')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs shrink-0 transition-colors ${
                      isDark
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300'
                    }`}
                    title="Open in new tab"
                  >
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>

              {/* Option 2: Dedicated Barter Collaboration Intake Form */}
              <div
                className={`p-3.5 rounded-xl border space-y-2 ${
                  isDark ? 'border-amber-500/30 bg-amber-500/5' : 'border-amber-200 bg-amber-50/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <strong className={`text-xs flex items-center gap-1.5 font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                    <Gift size={14} /> 2. Barter Collaboration Intake Form (Zero Commercials)
                  </strong>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    100% Barter / Gifting
                  </span>
                </div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                  Dedicated form for product gifting and barter roster. Commercials are not required or asked; gathers shipping address for dispatching brand samples.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}/influencer-barter` : '/influencer-barter'}
                    className={`grow px-2.5 py-1.5 rounded-lg border font-mono text-[11px] ${
                      isDark ? 'border-zinc-700 bg-zinc-900 text-amber-300' : 'border-stone-300 bg-white text-amber-700'
                    }`}
                  />
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(`${window.location.origin}/influencer-barter`);
                        toast.success('Barter intake link copied to clipboard!');
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shrink-0 flex items-center gap-1"
                  >
                    <Copy size={12} />
                    <span>Copy</span>
                  </button>
                  <button
                    onClick={() => window.open('/influencer-barter', '_blank')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs shrink-0 transition-colors ${
                      isDark
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300'
                    }`}
                    title="Open in new tab"
                  >
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>

              {/* Option 2: Google Forms Webhook Integration */}
              <div
                className={`p-3.5 rounded-xl border space-y-2.5 ${
                  isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-stone-200 bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <strong className={`text-xs flex items-center gap-1.5 font-bold ${isDark ? 'text-zinc-100' : 'text-stone-900'}`}>
                    <Layers size={14} className="text-amber-500" /> Google Forms Real-Time Webhook
                  </strong>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-500' : 'text-stone-500'}`}>
                    POST /api/influencers/webhook
                  </span>
                </div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                  Have an existing Google Form? Paste this 5-line Google Apps Script into your Google Form so every submission automatically pushes straight into this sheet!
                </p>

                <div className="bg-[#090b10] p-2.5 rounded-lg border border-zinc-800 font-mono text-[10px] text-zinc-300 overflow-x-auto max-h-32">
                  <pre>{`function onFormSubmit(e) {
  var itemResponses = e.response.getItemResponses();
  var data = {};
  for (var i = 0; i < itemResponses.length; i++) {
    var title = itemResponses[i].getItem().getTitle().toLowerCase();
    data[title] = itemResponses[i].getResponse();
  }
  UrlFetchApp.fetch('${typeof window !== 'undefined' ? window.location.origin : ''}/api/influencers/webhook', {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(data)
  });
}`}</pre>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>
                    Setup takes 30 seconds via Apps Script trigger
                  </span>
                  <button
                    onClick={() => {
                      const origin = typeof window !== 'undefined' ? window.location.origin : '';
                      const script = `function onFormSubmit(e) {\n  var itemResponses = e.response.getItemResponses();\n  var data = {};\n  for (var i = 0; i < itemResponses.length; i++) {\n    var title = itemResponses[i].getItem().getTitle().toLowerCase();\n    data[title] = itemResponses[i].getResponse();\n  }\n  UrlFetchApp.fetch('${origin}/api/influencers/webhook', {\n    method: 'post', contentType: 'application/json', payload: JSON.stringify(data)\n  });\n}`;
                      navigator.clipboard.writeText(script);
                      toast.success('Google Apps Script copied! Paste into Form -> Extensions -> Apps Script');
                    }}
                    className={`px-3 py-1.5 rounded-lg border font-semibold text-xs flex items-center gap-1 transition-colors ${
                      isDark
                        ? 'border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                        : 'border-stone-300 bg-white hover:bg-stone-100 text-stone-700 shadow-2xs'
                    }`}
                  >
                    <Copy size={12} />
                    <span>Copy Google Script</span>
                  </button>
                </div>
              </div>

              {/* Option 3: Quick Add Creator Form */}
              <form
                onSubmit={handleQuickAddCreator}
                className={`p-3.5 rounded-xl border space-y-3 ${
                  isDark ? 'border-zinc-800 bg-zinc-900/40' : 'border-stone-200 bg-stone-50'
                }`}
              >
                <strong className={`text-xs flex items-center gap-1.5 font-bold ${isDark ? 'text-zinc-100' : 'text-stone-900'}`}>
                  <Plus size={14} className="text-emerald-500" /> Quick Add Creator
                </strong>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Creator Name *"
                    value={quickCreator.name}
                    onChange={(e) => setQuickCreator((p) => ({ ...p, name: e.target.value }))}
                    className={`px-2.5 py-1.5 rounded border text-xs outline-hidden ${
                      isDark
                        ? 'border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500'
                        : 'border-stone-300 bg-white text-stone-900 placeholder:text-stone-400'
                    }`}
                  />
                  <input
                    type="text"
                    required
                    placeholder="Instagram Profile URL / Handle *"
                    value={quickCreator.instaId}
                    onChange={(e) => setQuickCreator((p) => ({ ...p, instaId: e.target.value }))}
                    className={`px-2.5 py-1.5 rounded border text-xs outline-hidden ${
                      isDark
                        ? 'border-zinc-700 bg-zinc-900 text-sky-400 placeholder:text-zinc-500'
                        : 'border-stone-300 bg-white text-sky-700 font-medium placeholder:text-stone-400'
                    }`}
                  />
                  <input
                    type="text"
                    placeholder="Brand (e.g. Willow & Root)"
                    value={quickCreator.brand}
                    onChange={(e) => setQuickCreator((p) => ({ ...p, brand: e.target.value }))}
                    className={`px-2.5 py-1.5 rounded border text-xs outline-hidden ${
                      isDark
                        ? 'border-zinc-700 bg-zinc-900 text-pink-400 placeholder:text-zinc-500'
                        : 'border-stone-300 bg-white text-pink-700 font-medium placeholder:text-stone-400'
                    }`}
                  />
                  <input
                    type="text"
                    placeholder="Followers (e.g. 150K)"
                    value={quickCreator.followers}
                    onChange={(e) => setQuickCreator((p) => ({ ...p, followers: e.target.value }))}
                    className={`px-2.5 py-1.5 rounded border text-xs outline-hidden ${
                      isDark
                        ? 'border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500'
                        : 'border-stone-300 bg-white text-stone-900 placeholder:text-stone-400'
                    }`}
                  />
                  <select
                    value={quickCreator.reel}
                    onChange={(e) => setQuickCreator((p) => ({ ...p, reel: e.target.value }))}
                    className={`px-2.5 py-1.5 rounded border text-xs outline-hidden ${
                      isDark
                        ? 'border-zinc-700 bg-zinc-900 text-emerald-400'
                        : 'border-stone-300 bg-white text-emerald-700 font-medium'
                    }`}
                  >
                    <option value="">Select Reel Rate Range</option>
                    {COMMERCIAL_RANGES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                    <option value="Barter">Barter (No Commercials)</option>
                  </select>
                  <select
                    value={quickCreator.story}
                    onChange={(e) => setQuickCreator((p) => ({ ...p, story: e.target.value }))}
                    className={`px-2.5 py-1.5 rounded border text-xs outline-hidden ${
                      isDark
                        ? 'border-zinc-700 bg-zinc-900 text-emerald-400'
                        : 'border-stone-300 bg-white text-emerald-700 font-medium'
                    }`}
                  >
                    <option value="">Select Story Rate Range</option>
                    {COMMERCIAL_RANGES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                    <option value="Barter">Barter (No Commercials)</option>
                  </select>
                </div>
                <div className="text-right">
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs"
                  >
                    Insert Creator
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: IMPORT MODAL */}
      {/* ========================================================================= */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className={`max-w-lg w-full rounded-2xl border p-5 shadow-2xl ${
              isDark ? 'bg-[#141720] border-zinc-800 text-zinc-100' : 'bg-white border-stone-200 text-stone-900'
            }`}
          >
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-zinc-800' : 'border-stone-200'}`}>
              <div className="flex items-center gap-2">
                <Upload size={16} className="text-pink-500" />
                <h3 className="text-sm font-bold">Import Influencers CSV</h3>
              </div>
              <button
                onClick={() => setImportOpen(false)}
                className={isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-stone-400 hover:text-stone-600'}
              >
                <X size={15} />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                  Import Destination
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setImportTargetTab('master')}
                    className={`py-2 px-3 rounded-lg border text-left transition-colors ${
                      importTargetTab === 'master'
                        ? isDark
                          ? 'border-pink-500 bg-pink-500/10 text-pink-400 font-bold'
                          : 'border-pink-500 bg-pink-50 text-pink-700 font-bold'
                        : isDark
                        ? 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800/50'
                        : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    Master Sheet (Auto-sorts into Brand tabs)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportTargetTab('current')}
                    className={`py-2 px-3 rounded-lg border text-left transition-colors ${
                      importTargetTab === 'current'
                        ? isDark
                          ? 'border-pink-500 bg-pink-500/10 text-pink-400 font-bold'
                          : 'border-pink-500 bg-pink-50 text-pink-700 font-bold'
                        : isDark
                        ? 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800/50'
                        : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    Current Sheet ({currentTab.name})
                  </button>
                </div>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                  Select File (.csv)
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={handleImportFile}
                  className={`w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-pink-600 file:text-white hover:file:bg-pink-500 cursor-pointer ${
                    isDark ? 'text-zinc-400' : 'text-stone-600'
                  }`}
                />
              </div>

              {importRowsPreview.length > 0 && (
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                    Preview ({importRowsPreview.length} creators detected)
                  </label>
                  <div
                    className={`max-h-40 overflow-y-auto border rounded-lg p-2 font-mono text-[11px] space-y-1 ${
                      isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-stone-200 bg-stone-50'
                    }`}
                  >
                    {importRowsPreview.slice(0, 5).map((row, idx) => (
                      <div
                        key={idx}
                        className={`flex justify-between border-b pb-1 ${
                          isDark ? 'border-zinc-800/60' : 'border-stone-200'
                        }`}
                      >
                        <span className={`font-semibold ${isDark ? 'text-zinc-100' : 'text-stone-900'}`}>
                          {row.name || 'Unnamed'}
                        </span>
                        <span className={isDark ? 'text-sky-400' : 'text-sky-700 font-medium'}>
                          {row.instaId || '-'}
                        </span>
                        <span className={isDark ? 'text-pink-400' : 'text-pink-700 font-medium'}>
                          {row.brand || 'General'}
                        </span>
                        <span className={isDark ? 'text-emerald-400' : 'text-emerald-700 font-medium'}>
                          {row.reel || '-'}
                        </span>
                      </div>
                    ))}
                    {importRowsPreview.length > 5 && (
                      <div className={`pt-1 text-center ${isDark ? 'text-zinc-500' : 'text-stone-500'}`}>
                        + {importRowsPreview.length - 5} more creators ready to import
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className={`flex items-center justify-end gap-2 pt-3 border-t ${isDark ? 'border-zinc-800' : 'border-stone-200'}`}>
              <button
                onClick={() => setImportOpen(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isDark
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleApplyImport}
                disabled={importRowsPreview.length === 0}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 disabled:opacity-50"
              >
                Apply Import ({importRowsPreview.length} rows)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: NEW BRAND SHEET MODAL */}
      {/* ========================================================================= */}
      {addBrandOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setAddBrandOpen(false)}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`max-w-sm w-full rounded-2xl border p-5 shadow-2xl ${
              isDark ? 'bg-[#141720] border-zinc-800 text-zinc-100' : 'bg-white border-stone-200 text-stone-900'
            }`}
          >
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-zinc-800' : 'border-stone-200'}`}>
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-pink-500" />
                <h3 className="text-sm font-bold">Create Brand Sheet</h3>
              </div>
              <button
                type="button"
                onClick={() => setAddBrandOpen(false)}
                className={isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-stone-400 hover:text-stone-600'}
              >
                <X size={15} />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <p className={`text-[11px] leading-relaxed ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                Create a separated tab for this brand. Influencers added to this brand sheet will automatically sync with the Master Influencer sheet.
              </p>
              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                  Brand / Client Name
                </label>
                <input
                  ref={brandInputRef}
                  type="text"
                  placeholder="e.g. Willow & Root, Zara, Nike"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateBrandSheet(newBrandName);
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setAddBrandOpen(false);
                    }
                  }}
                  autoFocus
                  className={`w-full px-3 py-2 rounded-lg border text-xs font-medium outline-hidden transition-colors ${
                    isDark
                      ? 'border-zinc-700 bg-zinc-900 text-zinc-100 focus:border-pink-500 placeholder:text-zinc-500'
                      : 'border-stone-300 bg-white text-stone-900 focus:border-pink-500 placeholder:text-stone-400'
                  }`}
                />
              </div>
            </div>

            <div className={`flex items-center justify-end gap-2 pt-3 border-t ${isDark ? 'border-zinc-800' : 'border-stone-200'}`}>
              <button
                type="button"
                onClick={() => setAddBrandOpen(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isDark
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCreateBrandSheet(newBrandName)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 cursor-pointer"
              >
                Create Brand Tab
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. NUMERIC RANGE FILTERS MODAL */}
      {rangeFilterOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-lg rounded-2xl p-5 shadow-2xl border max-h-[90vh] overflow-y-auto ${
              isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-stone-200 text-stone-900'
            }`}
          >
            {/* Modal Header */}
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-zinc-800' : 'border-stone-200'}`}>
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isDark ? 'bg-pink-500/20 text-pink-400' : 'bg-pink-100 text-pink-700'}`}>
                  <SlidersHorizontal size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    Numeric Range Filters
                    {activeFilterCount > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-pink-500 text-white">
                        {activeFilterCount} Active
                      </span>
                    )}
                  </h3>
                  <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>
                    Filter creators by pricing, follower reach, and age
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRangeFilterOpen(false)}
                className={`p-1 rounded-md transition-colors ${
                  isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'
                }`}
              >
                <X size={16} />
              </button>
            </div>

            {/* Results Preview Banner */}
            <div className={`my-3 p-2.5 rounded-xl border flex items-center justify-between text-xs ${
              isDark ? 'bg-zinc-800/60 border-zinc-700/60' : 'bg-stone-50 border-stone-200'
            }`}>
              <div className="flex items-center gap-2">
                <Filter size={13} className={isDark ? 'text-pink-400' : 'text-pink-600'} />
                <span className="font-medium">
                  Matches in {currentTab.name}: <strong className={isDark ? 'text-pink-400' : 'text-pink-600'}>{filteredRowCount}</strong> creators
                </span>
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setRangeFilters(initialRangeFilters)}
                  className={`text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                    isDark ? 'text-zinc-400 hover:text-pink-400' : 'text-stone-600 hover:text-pink-600'
                  }`}
                >
                  <RotateCcw size={11} />
                  Reset all
                </button>
              )}
            </div>

            {/* Filter Controls Grid */}
            <div className="space-y-4 py-1 text-xs">
              {/* 1. Reel Commercial */}
              <div className={`p-3 rounded-xl border ${isDark ? 'bg-zinc-800/30 border-zinc-800' : 'bg-stone-50/70 border-stone-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold flex items-center gap-1.5">
                    <span>🎬 Reel Commercial</span>
                    <span className={`text-[10px] font-normal ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>(₹ Currency)</span>
                  </label>
                  {(rangeFilters.reelMin || rangeFilters.reelMax) && (
                    <button
                      onClick={() => setRangeFilters((f) => ({ ...f, reelMin: '', reelMax: '' }))}
                      className="text-[10px] text-pink-500 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className={`block text-[10px] font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>Min (₹)</label>
                    <input
                      type="text"
                      placeholder="e.g. 10000 or 10k"
                      value={rangeFilters.reelMin}
                      onChange={(e) => setRangeFilters((f) => ({ ...f, reelMin: e.target.value }))}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-hidden ${
                        isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-pink-500' : 'bg-white border-stone-300 text-stone-900 focus:border-pink-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>Max (₹)</label>
                    <input
                      type="text"
                      placeholder="e.g. 50000 or 50k"
                      value={rangeFilters.reelMax}
                      onChange={(e) => setRangeFilters((f) => ({ ...f, reelMax: e.target.value }))}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-hidden ${
                        isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-pink-500' : 'bg-white border-stone-300 text-stone-900 focus:border-pink-500'
                      }`}
                    />
                  </div>
                </div>
                {/* Presets */}
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: '< ₹15K', min: '', max: '15000' },
                    { label: '₹15K - ₹40K', min: '15000', max: '40000' },
                    { label: '₹40K - ₹80K', min: '40000', max: '80000' },
                    { label: '₹80K+', min: '80000', max: '' },
                  ].map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setRangeFilters((f) => ({ ...f, reelMin: p.min, reelMax: p.max }))}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                        rangeFilters.reelMin === p.min && rangeFilters.reelMax === p.max
                          ? 'bg-pink-600 border-pink-600 text-white font-bold'
                          : isDark
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Story Commercial */}
              <div className={`p-3 rounded-xl border ${isDark ? 'bg-zinc-800/30 border-zinc-800' : 'bg-stone-50/70 border-stone-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold flex items-center gap-1.5">
                    <span>📸 Story Commercial</span>
                    <span className={`text-[10px] font-normal ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>(₹ Currency)</span>
                  </label>
                  {(rangeFilters.storyMin || rangeFilters.storyMax) && (
                    <button
                      onClick={() => setRangeFilters((f) => ({ ...f, storyMin: '', storyMax: '' }))}
                      className="text-[10px] text-pink-500 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className={`block text-[10px] font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>Min (₹)</label>
                    <input
                      type="text"
                      placeholder="e.g. 5000 or 5k"
                      value={rangeFilters.storyMin}
                      onChange={(e) => setRangeFilters((f) => ({ ...f, storyMin: e.target.value }))}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-hidden ${
                        isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-pink-500' : 'bg-white border-stone-300 text-stone-900 focus:border-pink-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>Max (₹)</label>
                    <input
                      type="text"
                      placeholder="e.g. 25000 or 25k"
                      value={rangeFilters.storyMax}
                      onChange={(e) => setRangeFilters((f) => ({ ...f, storyMax: e.target.value }))}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-hidden ${
                        isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-pink-500' : 'bg-white border-stone-300 text-stone-900 focus:border-pink-500'
                      }`}
                    />
                  </div>
                </div>
                {/* Presets */}
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: '< ₹5K', min: '', max: '5000' },
                    { label: '₹5K - ₹15K', min: '5000', max: '15000' },
                    { label: '₹15K - ₹35K', min: '15000', max: '35000' },
                    { label: '₹35K+', min: '35000', max: '' },
                  ].map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setRangeFilters((f) => ({ ...f, storyMin: p.min, storyMax: p.max }))}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                        rangeFilters.storyMin === p.min && rangeFilters.storyMax === p.max
                          ? 'bg-pink-600 border-pink-600 text-white font-bold'
                          : isDark
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Followers Reach */}
              <div className={`p-3 rounded-xl border ${isDark ? 'bg-zinc-800/30 border-zinc-800' : 'bg-stone-50/70 border-stone-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold flex items-center gap-1.5">
                    <span>👥 Followers Count</span>
                    <span className={`text-[10px] font-normal ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>(Supports 50k, 1M, commas)</span>
                  </label>
                  {(rangeFilters.followersMin || rangeFilters.followersMax) && (
                    <button
                      onClick={() => setRangeFilters((f) => ({ ...f, followersMin: '', followersMax: '' }))}
                      className="text-[10px] text-pink-500 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className={`block text-[10px] font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>Min Followers</label>
                    <input
                      type="text"
                      placeholder="e.g. 50k or 50000"
                      value={rangeFilters.followersMin}
                      onChange={(e) => setRangeFilters((f) => ({ ...f, followersMin: e.target.value }))}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-hidden ${
                        isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-pink-500' : 'bg-white border-stone-300 text-stone-900 focus:border-pink-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>Max Followers</label>
                    <input
                      type="text"
                      placeholder="e.g. 500k or 1M"
                      value={rangeFilters.followersMax}
                      onChange={(e) => setRangeFilters((f) => ({ ...f, followersMax: e.target.value }))}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-hidden ${
                        isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-pink-500' : 'bg-white border-stone-300 text-stone-900 focus:border-pink-500'
                      }`}
                    />
                  </div>
                </div>
                {/* Presets */}
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: 'Nano (<10K)', min: '', max: '10000' },
                    { label: 'Micro (10K - 100K)', min: '10000', max: '100000' },
                    { label: 'Mid-Tier (100K - 500K)', min: '100000', max: '500000' },
                    { label: 'Macro (500K - 1M)', min: '500000', max: '1000000' },
                    { label: 'Mega (1M+)', min: '1000000', max: '' },
                  ].map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setRangeFilters((f) => ({ ...f, followersMin: p.min, followersMax: p.max }))}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                        rangeFilters.followersMin === p.min && rangeFilters.followersMax === p.max
                          ? 'bg-pink-600 border-pink-600 text-white font-bold'
                          : isDark
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Creator Age */}
              <div className={`p-3 rounded-xl border ${isDark ? 'bg-zinc-800/30 border-zinc-800' : 'bg-stone-50/70 border-stone-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold flex items-center gap-1.5">
                    <span>🎂 Creator Age</span>
                    <span className={`text-[10px] font-normal ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>(Years)</span>
                  </label>
                  {(rangeFilters.ageMin || rangeFilters.ageMax) && (
                    <button
                      onClick={() => setRangeFilters((f) => ({ ...f, ageMin: '', ageMax: '' }))}
                      className="text-[10px] text-pink-500 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className={`block text-[10px] font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>Min Age</label>
                    <input
                      type="number"
                      placeholder="e.g. 18"
                      value={rangeFilters.ageMin}
                      onChange={(e) => setRangeFilters((f) => ({ ...f, ageMin: e.target.value }))}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-hidden ${
                        isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-pink-500' : 'bg-white border-stone-300 text-stone-900 focus:border-pink-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>Max Age</label>
                    <input
                      type="number"
                      placeholder="e.g. 35"
                      value={rangeFilters.ageMax}
                      onChange={(e) => setRangeFilters((f) => ({ ...f, ageMax: e.target.value }))}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-hidden ${
                        isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-pink-500' : 'bg-white border-stone-300 text-stone-900 focus:border-pink-500'
                      }`}
                    />
                  </div>
                </div>
                {/* Presets */}
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: 'Gen-Z (18-24)', min: '18', max: '24' },
                    { label: 'Millennial (25-34)', min: '25', max: '34' },
                    { label: '35+', min: '35', max: '' },
                  ].map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setRangeFilters((f) => ({ ...f, ageMin: p.min, ageMax: p.max }))}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                        rangeFilters.ageMin === p.min && rangeFilters.ageMax === p.max
                          ? 'bg-pink-600 border-pink-600 text-white font-bold'
                          : isDark
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className={`flex items-center justify-between pt-3 border-t mt-3 ${isDark ? 'border-zinc-800' : 'border-stone-200'}`}>
              <button
                onClick={() => setRangeFilters(initialRangeFilters)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Reset All
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRangeFilterOpen(false)}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 shadow-xs"
                >
                  Apply Filters ({filteredRowCount} Results)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. ADD COLUMN MODAL */}
      {addColumnOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setAddColumnOpen(false)}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-2xl p-5 shadow-2xl border ${
              isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-stone-200 text-stone-900'
            }`}
          >
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-zinc-800' : 'border-stone-200'}`}>
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isDark ? 'bg-pink-500/20 text-pink-400' : 'bg-pink-100 text-pink-700'}`}>
                  <Plus size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Add Custom Column</h3>
                  <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>
                    Adds a new column across Master and all Brand sheets
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddColumnOpen(false)}
                className={isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-stone-400 hover:text-stone-600'}
              >
                <X size={15} />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                  Column Header Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Engagement Rate %, Agency Margin, Manager"
                  value={newColLabel}
                  onChange={(e) => setNewColLabel(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') handleAddColumn(newColLabel, newColWidth);
                    if (e.key === 'Escape') setAddColumnOpen(false);
                  }}
                  autoFocus
                  className={`w-full px-3 py-2 rounded-lg border text-xs font-medium outline-hidden ${
                    isDark
                      ? 'border-zinc-700 bg-zinc-900 text-zinc-100 focus:border-pink-500 placeholder:text-zinc-500'
                      : 'border-stone-300 bg-white text-stone-900 focus:border-pink-500 placeholder:text-stone-400'
                  }`}
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                  Column Width (pixels)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={60}
                    max={400}
                    step={10}
                    value={newColWidth}
                    onChange={(e) => setNewColWidth(Number(e.target.value) || 140)}
                    className={`w-28 px-3 py-2 rounded-lg border text-xs font-medium outline-hidden ${
                      isDark ? 'border-zinc-700 bg-zinc-900 text-zinc-100' : 'border-stone-300 bg-white text-stone-900'
                    }`}
                  />
                  <div className="flex items-center gap-1">
                    {[100, 140, 180, 220].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setNewColWidth(w)}
                        className={`text-[10px] px-2 py-1 rounded border ${
                          newColWidth === w
                            ? 'bg-pink-600 text-white border-pink-600 font-bold'
                            : isDark
                            ? 'bg-zinc-800 border-zinc-700 text-zinc-300'
                            : 'bg-stone-100 border-stone-200 text-stone-700'
                        }`}
                      >
                        {w}px
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`p-2.5 rounded-lg border text-[11px] ${
                isDark ? 'bg-zinc-800/40 border-zinc-700/60 text-zinc-300' : 'bg-pink-50/60 border-pink-100 text-pink-900'
              }`}>
                Next column letter will be allocated automatically (Col {colLetter(columns.length)}). You can resize headers anytime by dragging the column borders.
              </div>
            </div>

            <div className={`flex items-center justify-end gap-2 pt-3 border-t ${isDark ? 'border-zinc-800' : 'border-stone-200'}`}>
              <button
                onClick={() => setAddColumnOpen(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isDark
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddColumn(newColLabel, newColWidth)}
                disabled={!newColLabel.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                Add Column
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. REMOVE COLUMN MODAL */}
      {removeColumnOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-2xl p-5 shadow-2xl border ${
              isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-stone-200 text-stone-900'
            }`}
          >
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-zinc-800' : 'border-stone-200'}`}>
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-700'}`}>
                  <Trash2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Remove Column</h3>
                  <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>
                    Select which column to remove from the sheet
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRemoveColumnOpen(false)}
                className={isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-stone-400 hover:text-stone-600'}
              >
                <X size={15} />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                  Select Column to Delete
                </label>
                <select
                  value={colToDelete || (columns[columns.length - 1]?.col ?? '')}
                  onChange={(e) => setColToDelete(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-xs font-medium outline-hidden ${
                    isDark ? 'border-zinc-700 bg-zinc-900 text-zinc-100 focus:border-rose-500' : 'border-stone-300 bg-white text-stone-900 focus:border-rose-500'
                  }`}
                >
                  {columns.map((c) => (
                    <option key={c.col} value={c.col}>
                      Col {c.col}: {c.label} ({c.key})
                    </option>
                  ))}
                </select>
              </div>

              <div className={`p-3 rounded-lg border text-[11px] space-y-1 ${
                isDark ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <p className="font-bold flex items-center gap-1">
                  <ShieldAlert size={12} />
                  Warning: Irreversible Action
                </p>
                <p>
                  Removing this column will erase all data stored in this column across Master and every Brand tab.
                </p>
              </div>
            </div>

            <div className={`flex items-center justify-end gap-2 pt-3 border-t ${isDark ? 'border-zinc-800' : 'border-stone-200'}`}>
              <button
                onClick={() => setRemoveColumnOpen(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isDark
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveColumn(colToDelete || columns[columns.length - 1]?.col)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-xs"
              >
                Remove Column
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. DELETE BRAND SHEET MODAL */}
      {deleteSheetOpen && sheetToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-2xl p-5 shadow-2xl border ${
              isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-stone-200 text-stone-900'
            }`}
          >
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-zinc-800' : 'border-stone-200'}`}>
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-700'}`}>
                  <Trash2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Delete Brand Sheet</h3>
                  <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>
                    Remove "{sheetToDelete.name}" tab from workspace
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setDeleteSheetOpen(false);
                  setSheetToDelete(null);
                }}
                className={isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-stone-400 hover:text-stone-600'}
              >
                <X size={15} />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <p className={`leading-relaxed ${isDark ? 'text-zinc-300' : 'text-stone-700'}`}>
                Are you sure you want to delete the spreadsheet tab for <strong className="text-rose-500">"{sheetToDelete.name}"</strong>?
              </p>

              <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                isDark ? 'bg-zinc-800/40 border-zinc-700/60 hover:bg-zinc-800/70' : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
              }`}>
                <input
                  type="checkbox"
                  checked={clearBrandFromMaster}
                  onChange={(e) => setClearBrandFromMaster(e.target.checked)}
                  className="mt-0.5 rounded text-pink-600 focus:ring-pink-500"
                />
                <div>
                  <span className="font-semibold block">Clear brand assignment in Master Sheet</span>
                  <span className={`text-[11px] block mt-0.5 ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>
                    Creators tagged with "{sheetToDelete.name}" will remain in the Master Sheet, but their brand tag will be cleared so this sheet won't be automatically regenerated.
                  </span>
                </div>
              </label>

              <div className={`p-2.5 rounded-lg border text-[11px] ${
                isDark ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                The Master Influencers sheet and all other brand tabs will remain completely unaffected.
              </div>
            </div>

            <div className={`flex items-center justify-end gap-2 pt-3 border-t ${isDark ? 'border-zinc-800' : 'border-stone-200'}`}>
              <button
                onClick={() => {
                  setDeleteSheetOpen(false);
                  setSheetToDelete(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isDark
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSheet(sheetToDelete.id, clearBrandFromMaster)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-xs"
              >
                Delete Sheet Tab
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
