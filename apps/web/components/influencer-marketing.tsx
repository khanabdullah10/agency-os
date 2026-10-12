'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  AlignLeft,
  AlignCenter,
  AlignRight,
  Search,
  Check,
  ChevronDown,
  X,
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
} from 'lucide-react';
import { api, useApp } from '@/lib/api';
import { useTheme } from './ThemeProvider';
import { toast } from 'sonner';

// Cell format interface
interface CellFormat {
  v?: string | number;
  f?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  bg?: string;
  align?: 'left' | 'center' | 'right';
  fontSize?: number;
}

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
}

interface WorkbookData {
  activeTab: string;
  tabs: SheetTab[];
  columns?: SheetColumn[];
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
  const [searchQuery, setSearchQuery] = useState('');

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

      // Add newly introduced brands that don't have a tab yet
      brandSet.forEach((bName) => {
        if (!existingBrandNames.has(bName.toLowerCase().trim())) {
          const rowsForThisBrand = masterRows.filter(
            (r) => (r['K'] || '').toLowerCase().trim() === bName.toLowerCase().trim()
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

  // Commit cell edit
  const commitEdit = (newVal: string) => {
    setIsEditing(false);
    const parsed = parseCellKey(selectedCell);
    if (!parsed) return;

    const oldCell = currentTab.data[selectedCell];
    const updatedCell: CellFormat = { ...oldCell, v: newVal };

    const newTab = {
      ...currentTab,
      data: {
        ...currentTab.data,
        [selectedCell]: updatedCell,
      },
    };

    let newWorkbook: WorkbookData;

    // If currently on Master Tab and Column K (Brand) is changed, trigger automatic brand tab sync!
    if (currentTab.id === masterTab.id) {
      const intermediateWb = {
        ...workbook,
        tabs: workbook.tabs.map((t) => (t.id === currentTab.id ? newTab : t)),
      };
      if (parsed.col === 'K') {
        newWorkbook = syncBrandSheets(intermediateWb);
      } else {
        newWorkbook = intermediateWb;
      }
    } else {
      // If currently on a Brand Tab:
      // Sync the changed cell back to the Master tab!
      const brandName = currentTab.name;
      const rowInBrand = parsed.row;
      const nameInBrand = parsed.col === 'A' ? newVal : currentTab.data[`A${rowInBrand}`]?.v;
      const instaInBrand = parsed.col === 'B' ? newVal : currentTab.data[`B${rowInBrand}`]?.v;

      const updatedMasterData = { ...masterTab.data };
      // Locate corresponding row in Master tab
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
        updatedMasterData[`${parsed.col}${foundMasterRow}`] = {
          ...updatedMasterData[`${parsed.col}${foundMasterRow}`],
          v: newVal,
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
  };

  // Add row in current tab (append to end)
  const handleAddRow = () => {
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

    const nextWb = {
      ...workbook,
      activeTab: newTabId,
      tabs: [...workbook.tabs, newTab],
    };

    pushState(nextWb);
    setAddBrandOpen(false);
    setNewBrandName('');
    toast.success(`Created separated sheet for ${trimmed}`);
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
      toast.error('Please enter Creator Name and Instagram Handle');
      return;
    }

    const payload = {
      name: quickCreator.name.trim(),
      instaId: quickCreator.instaId.trim().startsWith('@') ? quickCreator.instaId.trim() : `@${quickCreator.instaId.trim()}`,
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
      status: 'New Intake',
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
      className={`flex flex-col h-[calc(100dvh-78px)] sm:h-[calc(100vh-80px)] max-w-full overflow-hidden select-none ${
        isDark ? 'bg-[#0f1117] text-zinc-200' : 'bg-white text-stone-900'
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

      {/* 2. SINGLE HORIZONTAL SWIPEABLE TOOLBAR */}
      <div
        className={`px-2 py-1.5 border-b flex items-center gap-1.5 shrink-0 overflow-x-auto whitespace-nowrap scrollbar-none ${
          isDark ? 'bg-[#12141a] border-zinc-800' : 'bg-stone-100 border-stone-200'
        }`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <button
          onClick={handleUndo}
          disabled={historyIdx <= 0}
          title="Undo"
          className={`p-1.5 rounded disabled:opacity-30 shrink-0 transition-colors ${
            isDark ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-stone-200 text-stone-700'
          }`}
        >
          <Undo2 size={13} />
        </button>
        <button
          onClick={handleRedo}
          disabled={historyIdx >= history.length - 1}
          title="Redo"
          className={`p-1.5 rounded disabled:opacity-30 shrink-0 transition-colors ${
            isDark ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-stone-200 text-stone-700'
          }`}
        >
          <Redo2 size={13} />
        </button>

        <div className={`h-4 w-px mx-0.5 shrink-0 ${isDark ? 'bg-zinc-700/40' : 'bg-stone-300'}`} />

        {/* Brand Selector Pill */}
        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>Sheet Tab:</span>
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
        >
          <Plus size={11} />
          <span>New Brand Sheet</span>
        </button>

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
        className={`px-2 py-1 border-b flex items-center gap-2 shrink-0 ${
          isDark ? 'bg-[#14161f] border-zinc-800' : 'bg-white border-stone-200'
        }`}
      >
        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${isDark ? 'text-pink-400 bg-pink-500/10 border-pink-500/20' : 'text-pink-700 bg-pink-50 border-pink-200'}`}>
          {selectedCell}
        </span>
        <input
          type="text"
          value={isEditing ? editValue : String(currentTab.data[selectedCell]?.v || '')}
          onChange={(e) => {
            if (!isEditing) setIsEditing(true);
            setEditValue(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitEdit(editValue);
            }
          }}
          onFocus={() => {
            setIsEditing(true);
            setEditValue(String(currentTab.data[selectedCell]?.v || ''));
          }}
          placeholder="Enter creator detail, rate, or status"
          className={`grow min-w-0 bg-transparent outline-hidden text-xs ${isDark ? 'text-zinc-200 placeholder:text-zinc-500' : 'text-stone-900 placeholder:text-stone-400'}`}
        />
        {isEditing && (
          <button
            onClick={() => commitEdit(editValue)}
            className="flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-white shrink-0 hover:bg-emerald-500"
            title="Commit Edit"
          >
            <Check size={12} />
          </button>
        )}
      </div>

      {/* 4. SPREADSHEET GRID */}
      <div
        ref={gridContainerRef}
        className="grow overflow-auto relative select-none scrollbar-thin"
        style={{ scrollbarGutter: 'stable', WebkitOverflowScrolling: 'touch' }}
      >
        <table className="border-collapse table-fixed w-max text-xs">
          <thead>
            <tr className={`sticky top-0 z-20 ${isDark ? 'bg-[#181b24]' : 'bg-stone-100'}`}>
              {/* Corner Header Anchor */}
              <th
                className={`sticky top-0 left-0 z-30 w-10 h-8 border text-center font-normal select-none ${
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
                    onClick={() => setSelectedCell(`A${row}`)}
                    className={`sticky left-0 z-10 w-12 h-8 border text-center font-mono text-[11px] select-none group/row ${
                      isDark ? 'border-zinc-800 bg-[#161822] text-zinc-500' : 'border-stone-300 bg-stone-200 text-stone-500'
                    }`}
                  >
                    <div className="flex items-center justify-between px-1">
                      <span>{row}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRow(row);
                        }}
                        title={`Delete row ${row}`}
                        className="opacity-0 group-hover/row:opacity-100 p-0.5 rounded text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
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

                    const width = currentTab.colWidths[col] || field.defaultWidth;

                    return (
                      <td
                        key={col}
                        style={{ width, minWidth: width, maxWidth: width }}
                        onClick={() => {
                          if (selectedCell !== cellKey) {
                            if (isEditing) commitEdit(editValue);
                            setSelectedCell(cellKey);
                          } else if (!isEditing) {
                            setIsEditing(true);
                            setEditValue(String(cell?.v || ''));
                            setTimeout(() => cellInputRef.current?.focus(), 10);
                          }
                        }}
                        onDoubleClick={() => {
                          setIsEditing(true);
                          setEditValue(String(cell?.v || ''));
                          setTimeout(() => cellInputRef.current?.focus(), 10);
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
                        } ${cell?.align === 'center' ? 'text-center' : cell?.align === 'right' ? 'text-right' : 'text-left'}`}
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
                              col === 'B' ? (isDark ? 'text-sky-400 font-medium' : 'text-sky-700 font-semibold') : ''
                            } ${col === 'K' ? (isDark ? 'text-pink-400 font-bold' : 'text-pink-700 font-bold') : ''} ${
                              col === 'N'
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
                            {cell?.v !== undefined ? String(cell.v) : ''}
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
        className={`px-2 py-1.5 flex items-center justify-between border-t shrink-0 ${
          isDark ? 'bg-[#141720] border-zinc-800' : 'bg-stone-100 border-stone-300'
        }`}
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom, 0px))' }}
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
              <button
                key={tab.id}
                onClick={() => setWorkbook((p) => ({ ...p, activeTab: tab.id }))}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all shrink-0 border ${
                  isActive
                    ? isDark
                      ? 'bg-zinc-900 border-pink-500 text-pink-400 shadow-xs'
                      : 'bg-white border-pink-500 text-pink-700 shadow-xs font-bold'
                    : isDark
                    ? 'border-transparent text-zinc-400 hover:bg-zinc-800/60'
                    : 'border-transparent text-stone-600 hover:bg-stone-200'
                }`}
              >
                {isMaster ? <Sparkles size={12} className="text-pink-500" /> : <Building2 size={12} className={isDark ? 'text-zinc-400' : 'text-stone-500'} />}
                <span>{tab.name}</span>
              </button>
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
              {/* Option 1: Built-in Public Intake Form */}
              <div
                className={`p-3.5 rounded-xl border space-y-2 ${
                  isDark ? 'border-pink-500/30 bg-pink-500/5' : 'border-pink-200 bg-pink-50/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <strong className={`text-xs flex items-center gap-1.5 font-bold ${isDark ? 'text-pink-400' : 'text-pink-700'}`}>
                    <ExternalLink size={14} /> Agency OS Branded Creator Intake Link
                  </strong>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      isDark ? 'bg-pink-500/20 text-pink-300' : 'bg-pink-100 text-pink-700'
                    }`}
                  >
                    Zero Setup Required
                  </span>
                </div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                  Share this public onboarding link directly with creators via Instagram DM, WhatsApp, or Email. Submissions stream into the Master sheet and their selected brand sheet instantly.
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
                        toast.success('Public intake link copied to clipboard!');
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
                    placeholder="Instagram Handle (@) *"
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
                  <input
                    type="text"
                    placeholder="Reel Rate (e.g. ₹35,000)"
                    value={quickCreator.reel}
                    onChange={(e) => setQuickCreator((p) => ({ ...p, reel: e.target.value }))}
                    className={`px-2.5 py-1.5 rounded border text-xs outline-hidden ${
                      isDark
                        ? 'border-zinc-700 bg-zinc-900 text-emerald-400 placeholder:text-zinc-500'
                        : 'border-stone-300 bg-white text-emerald-700 font-medium placeholder:text-stone-400'
                    }`}
                  />
                  <input
                    type="text"
                    placeholder="Story Rate (e.g. ₹12,000)"
                    value={quickCreator.story}
                    onChange={(e) => setQuickCreator((p) => ({ ...p, story: e.target.value }))}
                    className={`px-2.5 py-1.5 rounded border text-xs outline-hidden ${
                      isDark
                        ? 'border-zinc-700 bg-zinc-900 text-emerald-400 placeholder:text-zinc-500'
                        : 'border-stone-300 bg-white text-emerald-700 font-medium placeholder:text-stone-400'
                    }`}
                  />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
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
                  type="text"
                  placeholder="e.g. Willow & Root, Zara, Nike"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateBrandSheet(newBrandName);
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
                onClick={() => handleCreateBrandSheet(newBrandName)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-pink-600 hover:bg-pink-500"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
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
                    if (e.key === 'Enter') handleAddColumn(newColLabel, newColWidth);
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
    </div>
  );
}
