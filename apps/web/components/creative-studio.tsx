'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Sparkles,
  Wand2,
  Download,
  Copy,
  Layers,
  RefreshCw,
  Sliders,
  Image as ImageIcon,
  Check,
  Building2,
  Trash2,
  History,
  Columns,
  Paperclip,
  X,
  Undo2,
  UploadCloud,
  RotateCcw,
} from 'lucide-react';
import { api, useApp, useResource } from '@/lib/api';
import { Loading, Modal } from './shared';
import { toast } from 'sonner';

interface RevisionEntry {
  revisionNumber: number;
  instruction: string;
  presetTweak?: string | null;
  imageUrl: string;
  prompt: string;
  timestamp: string;
  authorName: string;
  referenceImage?: string | null;
}

interface CreativeAsset {
  id: string;
  agencyId: string;
  clientId?: string | null;
  userId: string;
  title: string;
  conceptType: string;
  prompt: string;
  enhancedPrompt?: string | null;
  imageUrl: string;
  aspectRatio: string;
  stylePreset: string;
  lighting?: string | null;
  revisions?: RevisionEntry[] | null;
  contentId?: number | null;
  referenceImage?: string | null;
  createdAt: string;
  client?: { id: string; name: string; color?: string; brand?: any } | null;
  user?: { id: string; name: string; avatarUrl?: string | null; avatarColor?: string } | null;
  content?: { id: number; title: string; status: string } | null;
}

const STYLE_PRESETS = [
  { id: 'Hyper-realistic Studio', label: 'Hyper-real Photo', icon: '📸', desc: 'Commercial studio lighting, ultra-sharp detail' },
  { id: 'Photorealistic 3D', label: 'Photorealistic 3D', icon: '💎', desc: 'Ray-traced Octane 3D render, subsurface scattering' },
  { id: 'Minimalist Studio', label: 'Minimalist Flat', icon: '🏛️', desc: 'Clean negative space, architectural elegance' },
  { id: 'Cyberpunk Neon', label: 'Neon Cyberpunk', icon: '⚡', desc: 'High-contrast neon glows, reflections, futuristic mood' },
  { id: 'Hand-drawn Sketch', label: 'Hand-drawn Sketch', icon: '✏️', desc: 'Detailed ink & pencil line art, textured paper' },
  { id: 'Corporate Flat Vector', label: 'Corporate Vector', icon: '📐', desc: 'Balanced geometry, clean brand vectors' },
  { id: 'Watercolor Art', label: 'Watercolor Art', icon: '🎨', desc: 'Translucent washes, soft paint bleeds, cotton paper' },
  { id: 'Retro Film 35mm', label: 'Retro 35mm Film', icon: '🎞️', desc: 'Authentic film grain, nostalgic Kodak tones' },
  { id: 'Luxury Dark Mode', label: 'Luxury Dark Mode', icon: '🖤', desc: 'Moody black textures, metallic accents, glowing rims' },
  { id: 'Editorial Fashion', label: 'Editorial Fashion', icon: '👗', desc: 'Vogue-style dynamic poses and avant-garde staging' },
  { id: '3D Claymorphism', label: '3D Claymorphism', icon: '🧸', desc: 'Tactile pastel 3D clay, smooth ambient occlusion' },
];

const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1 Square', sub: 'Instagram Feed / Ad', preview: 'w-6 h-6' },
  { id: '9:16', label: '9:16 Story', sub: 'Reels / TikTok', preview: 'w-4 h-7' },
  { id: '16:9', label: '16:9 Banner', sub: 'YouTube / Web', preview: 'w-7 h-4' },
  { id: '4:5', label: '4:5 Portrait', sub: 'FB / IG Portrait', preview: 'w-5 h-6' },
];

const LIGHTING_OPTIONS = [
  'Studio Softbox Diffused',
  'Dramatic Rim & Edge Light',
  'Golden Hour Sunlight',
  'Neon Ambient Cyber Glow',
  'Dark Moody Low-Key',
  'High-Key Crisp Commercial',
];

const QUICK_CHANGE_TWEAKS = [
  { label: '💡 Dramatic Rim Light', tweak: 'Add sharp dramatic rim lighting and darker contrast' },
  { label: '🎨 Brand Palette Match', tweak: 'Shift color grading and accents to strictly harmonize with brand palette' },
  { label: '🏛️ Minimalist Backdrop', tweak: 'Replace background with smooth architectural minimalist stone pedestal' },
  { label: '✨ Cinematic Depth', tweak: 'Add subtle cinematic bokeh and softer background depth of field' },
  { label: '🌃 Dark Cyberpunk Vibe', tweak: 'Transform environment into dark moody night with neon reflective surfaces' },
];

const SAMPLE_CONCEPTS = [
  'Luxury glass perfume bottle resting on black polished obsidian stone with subtle water mist and golden amber backlight',
  'Modern matte black wireless noise-canceling headphones floating in mid-air with vibrant sonic waves and neon rim accents',
  'Artisanal matcha green tea latte in ribbed ceramic cup on light marble cafe table with morning sunlight shadows',
  'Sleek metallic sports water bottle with fresh condensation droplets on textured gym floor, high energy cinematic studio light',
];

export function CreativeStudioView() {
  const { refresh } = useApp();

  // Queries
  const { data: clients } = useResource<any[]>('/clients');
  const { data: contentList } = useResource<any[]>('/content');
  const { data: fetchedAssets, loading: loadingAssets } = useResource<CreativeAsset[]>('/creative-studio/assets');
  const [localAssets, setLocalAssets] = useState<CreativeAsset[]>([]);

  useEffect(() => {
    if (fetchedAssets) {
      setLocalAssets(fetchedAssets);
    }
  }, [fetchedAssets]);

  const recentAssets = localAssets;

  // Generator State
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [conceptType] = useState('POST');
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState<string | null>(null);
  const [negativePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [stylePreset, setStylePreset] = useState('Hyper-realistic Studio');
  const [lighting, setLighting] = useState('Studio Softbox Diffused');

  // Reference Image Upload State (Concept Builder)
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceFileName, setReferenceFileName] = useState<string>('');
  const [referenceFileSize, setReferenceFileSize] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Viewing Asset
  const [activeAsset, setActiveAsset] = useState<CreativeAsset | null>(null);

  // Loading States
  const [generating, setGenerating] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [requestingChange, setRequestingChange] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Change Request / Revision state
  const [changeInstruction, setChangeInstruction] = useState('');
  const [selectedChangePreset, setSelectedChangePreset] = useState('');
  const [revisionReferenceImage, setRevisionReferenceImage] = useState<string | null>(null);
  const [revisionFileName, setRevisionFileName] = useState<string>('');
  const revisionFileInputRef = useRef<HTMLInputElement>(null);

  // Canvas View Mode: 'OUTPUT' | 'REFERENCE' | 'COMPARE_REVISION' | 'COMPARE_REFERENCE'
  const [canvasMode, setCanvasMode] = useState<'OUTPUT' | 'REFERENCE' | 'COMPARE_REVISION' | 'COMPARE_REFERENCE'>('OUTPUT');
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Modals
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [selectedContentId, setSelectedContentId] = useState<number | null>(null);
  const [attaching, setAttaching] = useState(false);

  // Mobile View Tab state
  const [mobileTab, setMobileTab] = useState<'BUILDER' | 'CANVAS' | 'REVISIONS'>('BUILDER');

  // Auto-select first asset if active is empty
  useEffect(() => {
    if (!activeAsset && recentAssets && recentAssets.length > 0) {
      setActiveAsset(recentAssets[0]);
    }
  }, [recentAssets, activeAsset]);

  // Selected client brand context
  const selectedClient = useMemo(() => {
    return clients?.find((c) => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  // Process reference image file
  const handleFileProcess = (file: File, isRevision = false) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, WEBP, SVG).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Image is too large. Please select a file under 15MB.');
      return;
    }

    const sizeStr = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (isRevision) {
        setRevisionReferenceImage(result);
        setRevisionFileName(file.name);
        toast.success(`Revision reference "${file.name}" attached!`);
      } else {
        setReferenceImage(result);
        setReferenceFileName(file.name);
        setReferenceFileSize(sizeStr);
        toast.success(`Reference asset "${file.name}" attached!`);
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  // Enable direct clipboard pasting of screenshots (Ctrl+V) anywhere in the studio
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // If user is pasting into an input or textarea that is not prompt, let standard text paste happen
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || (activeEl?.tagName === 'TEXTAREA' && activeEl.id !== 'prompt-textarea');
      
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            handleFileProcess(file);
            toast.success('Screenshot pasted from clipboard & attached as reference!');
            e.preventDefault();
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Prompt Enhancer (Magic Enhance) with Vision Grounding
  const handleEnhancePrompt = async () => {
    if (!prompt.trim() && !referenceImage) {
      toast.info('Please enter a basic concept or attach a reference image first.');
      return;
    }
    try {
      setEnhancing(true);
      const effectivePrompt = prompt.trim() || 'Describe the subject and scene from the reference image';
      const res: any = await api('/creative-studio/enhance-prompt', {
        method: 'POST',
        body: JSON.stringify({
          prompt: effectivePrompt,
          clientId: selectedClientId || undefined,
          conceptType,
          stylePreset,
          lighting,
          referenceImage: referenceImage || undefined,
        }),
      });
      if (res?.enhanced) {
        setOriginalPrompt(prompt); // Allow instant 1-click revert!
        setPrompt(res.enhanced);
        toast.success(
          referenceImage
            ? 'Prompt grounded with reference image details!'
            : 'Prompt enhanced! Subject faithfully preserved.'
        );
      }
    } catch (err: any) {
      toast.error('Could not enhance prompt', { description: err.message });
    } finally {
      setEnhancing(false);
    }
  };

  const handleRevertPrompt = () => {
    if (originalPrompt !== null) {
      setPrompt(originalPrompt);
      setOriginalPrompt(null);
      toast.info('Restored your original prompt.');
    }
  };

  // Generate Visual
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a creative concept prompt.');
      return;
    }
    try {
      setGenerating(true);
      toast.info(
        referenceImage
          ? 'Grounding reference image with Vision AI & synthesizing with FLUX.1...'
          : 'Synthesizing AI concept visual with FLUX.1 engine...',
        { duration: 6000 }
      );
      const assetTitle = title.trim() || prompt.slice(0, 40) + '...';

      const newAsset: any = await api('/creative-studio/generate', {
        method: 'POST',
        body: JSON.stringify({
          clientId: selectedClientId || undefined,
          title: assetTitle,
          conceptType,
          prompt,
          negativePrompt: negativePrompt || undefined,
          aspectRatio,
          stylePreset,
          lighting,
          referenceImage: referenceImage || undefined,
        }),
      });

      toast.success('Visual synthesized successfully!');
      setActiveAsset(newAsset);
      setCanvasMode('OUTPUT');
      setMobileTab('CANVAS');
      setLocalAssets((prev) => [newAsset, ...prev]);
      refresh();
    } catch (err: any) {
      toast.error('Generation failed', { description: err.message || 'Could not render visual.' });
    } finally {
      setGenerating(false);
    }
  };

  // Regenerate visual with new seed
  const handleRegenerate = async () => {
    if (!activeAsset) return;
    try {
      setRegenerating(true);
      toast.info('Regenerating creative visual with fresh seed...', { duration: 5000 });
      const updated: any = await api(`/creative-studio/assets/${activeAsset.id}/regenerate`, {
        method: 'POST',
      });
      setActiveAsset(updated);
      setLocalAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setMobileTab('CANVAS');
      toast.success('Visual regenerated successfully!');
      refresh();
    } catch (err: any) {
      toast.error('Regeneration failed', { description: err.message });
    } finally {
      setRegenerating(false);
    }
  };

  // Submit Change Request / Revision
  const handleRequestChange = async () => {
    if (!activeAsset) return;
    if (!changeInstruction.trim() && !selectedChangePreset) {
      toast.error('Please enter a change request or select a preset tweak.');
      return;
    }

    try {
      setRequestingChange(true);
      toast.info('Applying change request & generating new revision...', { duration: 5000 });

      const updated: any = await api('/creative-studio/request-change', {
        method: 'POST',
        body: JSON.stringify({
          assetId: activeAsset.id,
          instruction: changeInstruction.trim() || selectedChangePreset,
          presetTweak: selectedChangePreset || undefined,
          aspectRatio: activeAsset.aspectRatio,
          referenceImage: revisionReferenceImage || undefined,
        }),
      });

      toast.success(`Revision v${(updated.revisions?.length || 2)} generated successfully!`);
      setActiveAsset(updated);
      setChangeInstruction('');
      setSelectedChangePreset('');
      setRevisionReferenceImage(null);
      setRevisionFileName('');
      setCanvasMode('COMPARE_REVISION'); // Switch immediately to comparison slider!
      setSliderPos(50);
      setMobileTab('CANVAS');
      setLocalAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      refresh();
    } catch (err: any) {
      toast.error('Revision failed', { description: err.message });
    } finally {
      setRequestingChange(false);
    }
  };

  // Attach to Content item
  const handleAttachToContent = async () => {
    if (!activeAsset || !selectedContentId) return;
    try {
      setAttaching(true);
      const res: any = await api('/creative-studio/attach-to-content', {
        method: 'POST',
        body: JSON.stringify({
          assetId: activeAsset.id,
          contentId: selectedContentId,
          note: `Creative Studio: ${activeAsset.title}`,
        }),
      });
      toast.success('Attached to Content Deliverable!', { description: res.message });
      setAttachModalOpen(false);
      refresh();
    } catch (err: any) {
      toast.error('Attach failed', { description: err.message });
    } finally {
      setAttaching(false);
    }
  };

  // Copy Image Link
  const handleCopyLink = () => {
    if (!activeAsset?.imageUrl) return;
    navigator.clipboard.writeText(activeAsset.imageUrl);
    toast.success('Visual URL copied to clipboard!');
  };

  // Download High-Res
  const handleDownload = () => {
    if (!activeAsset?.imageUrl) return;
    try {
      const a = document.createElement('a');
      a.href = activeAsset.imageUrl;
      a.download = `${(activeAsset.title || 'creative').replace(/[^a-zA-Z0-9_-]/g, '_')}_${activeAsset.aspectRatio}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Downloading visual asset...');
    } catch (err: any) {
      toast.error('Download failed', { description: err.message });
    }
  };

  // Slider Drag Handler
  const handleSliderMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const offset = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (offset / rect.width) * 100));
    setSliderPos(pct);
  };

  // Previous revision for comparison
  const previousRevision = useMemo(() => {
    if (!activeAsset?.revisions || activeAsset.revisions.length < 2) return null;
    const revs = activeAsset.revisions;
    return revs[revs.length - 2];
  }, [activeAsset]);

  const currentRevisionNumber = activeAsset?.revisions?.length || 1;

  // Active asset reference image
  const activeReferenceImage = activeAsset?.referenceImage || activeAsset?.revisions?.[0]?.referenceImage || null;

  return (
    <div className="creative-studio-view max-w-[1700px] mx-auto px-2 sm:px-4 py-2 sm:py-3 space-y-3 sm:space-y-4 animate-fade-in overflow-x-hidden">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 dark:border-zinc-800 pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500" />
            </span>
            <Sparkles size={14} />
            <span>AI Creative Studio · Graphic Design Workstation</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-black tracking-tight text-stone-900 dark:text-zinc-100 mt-0.5">
            Concept & Visual Canvas
          </h1>
        </div>

        {/* Top Quick Actions */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
          <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-pink-500/10 text-pink-700 dark:text-pink-300 font-semibold border border-pink-500/20">
            Engine: FLUX.1 Commercial Pro
          </span>
          <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 font-medium">
            Total Concepts: <strong>{recentAssets?.length || 0}</strong>
          </span>
        </div>
      </div>

      {/* Mobile Segmented Switcher (Visible on mobile/tablet < lg screens) */}
      <div className="flex lg:hidden items-center p-1 rounded-2xl bg-stone-100 dark:bg-zinc-800/90 border border-stone-200/90 dark:border-zinc-700/80 text-xs font-bold shadow-2xs">
        <button
          type="button"
          onClick={() => setMobileTab('BUILDER')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all ${
            mobileTab === 'BUILDER'
              ? 'bg-white dark:bg-zinc-900 text-pink-600 dark:text-pink-400 shadow-xs'
              : 'text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200'
          }`}
        >
          <Wand2 size={13} />
          <span>Prompt Builder</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('CANVAS')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all ${
            mobileTab === 'CANVAS'
              ? 'bg-white dark:bg-zinc-900 text-pink-600 dark:text-pink-400 shadow-xs'
              : 'text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200'
          }`}
        >
          <ImageIcon size={13} />
          <span>Canvas</span>
          {activeAsset && <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" />}
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('REVISIONS')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all ${
            mobileTab === 'REVISIONS'
              ? 'bg-white dark:bg-zinc-900 text-pink-600 dark:text-pink-400 shadow-xs'
              : 'text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200'
          }`}
        >
          <Sliders size={13} />
          <span>Iterate ({currentRevisionNumber})</span>
        </button>
      </div>

      {/* 3-Column Studio Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
        {/* ======================================================== */}
        {/* COLUMN 1: CONCEPT & PROMPT BUILDER (Left Column - 4 cols) */}
        {/* ======================================================== */}
        <div className={`lg:col-span-4 space-y-4 ${mobileTab === 'BUILDER' ? 'block' : 'hidden lg:block'}`}>
          <div className="rounded-2xl border border-stone-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-3.5 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-stone-900 dark:text-zinc-100">
                <Wand2 size={16} className="text-pink-500" />
                <span>Concept Builder</span>
              </div>
              <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Step 1</span>
            </div>

            {/* Client Context Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 size={13} className="text-stone-400" />
                  Client & Brand Identity
                </span>
                {selectedClient?.color && (
                  <span
                    className="w-3.5 h-3.5 rounded-full ring-1 ring-white shadow-2xs"
                    style={{ backgroundColor: selectedClient.color }}
                    title={`Brand Color: ${selectedClient.color}`}
                  />
                )}
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full text-xs rounded-xl bg-stone-50 dark:bg-zinc-800/80 border border-stone-200 dark:border-zinc-700 px-3 py-2 text-stone-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-pink-500/30"
              >
                <option value="">Agency General / Internal Concept</option>
                {clients?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.industry || 'Brand'})
                  </option>
                ))}
              </select>

              {selectedClient && (
                <div className="p-2 rounded-lg bg-pink-500/5 border border-pink-500/15 text-[11px] text-stone-600 dark:text-zinc-400 space-y-0.5">
                  <div className="font-semibold text-pink-700 dark:text-pink-300">
                    {selectedClient.name} Brand Rules Active:
                  </div>
                  <div>Tone: {selectedClient.brand?.tone || 'Modern, Premium'}</div>
                  {selectedClient.color && (
                    <div className="flex items-center gap-1.5">
                      <span>Brand Color:</span>
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedClient.color }} />
                      <span className="font-mono text-[10px]">{selectedClient.color}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Concept Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Concept Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Protein Bar Product Launch Visual"
                className="w-full text-xs rounded-xl bg-stone-50 dark:bg-zinc-800/80 border border-stone-200 dark:border-zinc-700 px-3 py-2 text-stone-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-pink-500/30"
              />
            </div>

            {/* Reference Image / Asset Upload (New feature) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Paperclip size={13} className="text-pink-500" />
                  <span>Attach Reference Image (Product / Moodboard)</span>
                </label>
                {referenceImage && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Attached
                  </span>
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileProcess(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {!referenceImage ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-3.5 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center space-y-1.5 ${
                    isDragging
                      ? 'border-pink-500 bg-pink-500/10'
                      : 'border-stone-300 dark:border-zinc-700 hover:border-pink-400 dark:hover:border-pink-500/50 bg-stone-50/60 dark:bg-zinc-800/40'
                  }`}
                >
                  <UploadCloud size={20} className="mx-auto text-pink-500" />
                  <div className="text-xs font-semibold text-stone-800 dark:text-zinc-200">
                    Click to attach, drag & drop, or paste screenshot (Ctrl+V)
                  </div>
                  <div className="text-[10px] text-stone-400">
                    Supports screenshots, photos, products, and moodboards (PNG, JPG, WEBP)
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2.5 rounded-xl border border-pink-500/30 bg-pink-500/5 dark:bg-pink-950/20">
                    <img
                      src={referenceImage}
                      alt="Reference preview"
                      className="w-12 h-12 rounded-lg object-cover border border-stone-200 dark:border-zinc-700 shrink-0 shadow-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-stone-800 dark:text-zinc-200 truncate">
                        {referenceFileName || 'Reference Image'}
                      </div>
                      <div className="text-[10px] text-stone-400">{referenceFileSize} · Ready for synthesis</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-zinc-200 hover:bg-stone-200/60 dark:hover:bg-zinc-700 transition-colors"
                        title="Replace reference image"
                      >
                        <RotateCcw size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReferenceImage(null);
                          setReferenceFileName('');
                          setReferenceFileSize('');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-100/60 dark:hover:bg-rose-950/50 transition-colors"
                        title="Remove reference image"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Vision Grounding Status Badge */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                    <Sparkles size={12} className="text-emerald-500 shrink-0" />
                    <span>Vision Grounding Active: Subject identity, clothing & style will be matched</span>
                  </div>
                </div>
              )}
            </div>

            {/* Aspect Ratio Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">
                Aspect Ratio / Canvas Format
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ASPECT_RATIOS.map((ar) => (
                  <button
                    key={ar.id}
                    type="button"
                    onClick={() => setAspectRatio(ar.id)}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      aspectRatio === ar.id
                        ? 'border-pink-500 bg-pink-500/10 text-pink-950 dark:text-pink-200 ring-2 ring-pink-500/20'
                        : 'border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-800/40 text-stone-700 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <div className="w-6 h-6 flex items-center justify-center rounded bg-stone-200 dark:bg-zinc-700 shrink-0">
                      <div className={`rounded-xs bg-stone-600 dark:bg-zinc-300 ${ar.preview}`} />
                    </div>
                    <div>
                      <div className="font-bold text-xs">{ar.label}</div>
                      <div className="text-[10px] text-stone-400">{ar.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Style Preset Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">
                Visual Aesthetic Preset
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1.5 pr-2 rounded-xl border border-stone-200/80 dark:border-zinc-800 bg-stone-50/40 dark:bg-zinc-900/40 scrollbar-thin">
                {STYLE_PRESETS.map((sp) => {
                  const isSelected = stylePreset === sp.id;
                  return (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => setStylePreset(sp.id)}
                      className={`p-2 rounded-xl text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-2 border-pink-500 bg-pink-500/10 text-pink-900 dark:text-pink-200 font-bold shadow-xs'
                          : 'border border-stone-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-800/40 text-stone-700 dark:text-zinc-400 hover:border-pink-300 dark:hover:border-zinc-600 hover:bg-stone-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs truncate">
                        <span>{sp.icon}</span>
                        <span className="truncate">{sp.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lighting Style */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Lighting & Ambiance</label>
              <select
                value={lighting}
                onChange={(e) => setLighting(e.target.value)}
                className="w-full text-xs rounded-xl bg-stone-50 dark:bg-zinc-800/80 border border-stone-200 dark:border-zinc-700 px-3 py-2 text-stone-800 dark:text-zinc-200 focus:outline-none"
              >
                {LIGHTING_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            {/* Creative Prompt Textarea */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">
                  Concept Description / Prompt
                </label>
                <div className="flex items-center gap-2">
                  {originalPrompt && (
                    <button
                      type="button"
                      onClick={handleRevertPrompt}
                      className="flex items-center gap-1 text-[11px] font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                      title="Undo Magic Enhance"
                    >
                      <Undo2 size={12} />
                      <span>Revert</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleEnhancePrompt}
                    disabled={enhancing || (!prompt.trim() && !referenceImage)}
                    className="flex items-center gap-1 text-[11px] font-bold text-pink-600 dark:text-pink-400 hover:text-pink-700 disabled:opacity-40 transition-colors cursor-pointer"
                    title={
                      referenceImage
                        ? 'Inspect reference photo & ground prompt with exact character/product details'
                        : 'Enrich your prompt with photorealistic styling while keeping your subject 100% faithful'
                    }
                  >
                    <Sparkles size={12} className={enhancing ? 'animate-spin' : ''} />
                    <span>
                      {enhancing
                        ? (referenceImage ? 'Grounding...' : 'Enhancing...')
                        : (referenceImage ? 'Ground with Reference' : 'Magic Enhance')}
                    </span>
                  </button>
                </div>
              </div>

              <textarea
                id="prompt-textarea"
                rows={3}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  if (originalPrompt && e.target.value !== prompt) {
                    setOriginalPrompt(null);
                  }
                }}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (items) {
                    for (let i = 0; i < items.length; i++) {
                      if (items[i].type.startsWith('image/')) {
                        const file = items[i].getAsFile();
                        if (file) {
                          handleFileProcess(file);
                          toast.success('Screenshot pasted from clipboard & attached as reference!');
                          e.preventDefault();
                          return;
                        }
                      }
                    }
                  }
                }}
                placeholder={
                  referenceImage
                    ? 'e.g. Change the can color to pink make sure other then that nothing should be changed'
                    : 'Describe your visual concept... e.g. A man eating a fresh crisp apple in studio setting'
                }
                className="w-full text-xs rounded-xl bg-stone-50 dark:bg-zinc-800/80 border border-stone-200 dark:border-zinc-700 p-3 text-stone-800 dark:text-zinc-200 outline-none focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/30 leading-relaxed resize-none transition-all"
              />

              {/* Sample idea pill triggers */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Quick Concept Starters:</span>
                <div className="flex flex-wrap gap-1">
                  {SAMPLE_CONCEPTS.slice(0, 2).map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setPrompt(s);
                        setOriginalPrompt(null);
                      }}
                      className="text-[10px] text-stone-600 dark:text-zinc-400 bg-stone-100 dark:bg-zinc-800 hover:bg-pink-500/10 hover:text-pink-600 dark:hover:text-pink-400 px-2 py-0.5 rounded-lg truncate max-w-full text-left transition-colors cursor-pointer"
                    >
                      💡 {s.slice(0, 48)}...
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Primary Generate Button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className={`relative isolate overflow-hidden w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                prompt.trim()
                  ? 'text-white bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 hover:from-pink-500 hover:to-purple-500 active:scale-[0.98] border border-pink-400/60 border-t-pink-300/90 shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_10px_24px_-4px_rgba(219,39,119,0.4)] hover:shadow-[0_1px_0_rgba(255,255,255,0.5)_inset,0_12px_28px_-4px_rgba(219,39,119,0.55)] cursor-pointer'
                  : 'text-stone-400 dark:text-zinc-500 bg-stone-100 dark:bg-zinc-800/80 border border-stone-200 dark:border-zinc-700/80 border-t-stone-300 dark:border-t-zinc-600 shadow-none cursor-not-allowed opacity-70'
              }`}
            >
              {generating ? (
                <>
                  <RefreshCw size={16} className="animate-spin text-white" />
                  <span className="tracking-wide">Synthesizing Concept with FLUX.1...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} className={`transform transition-transform ${prompt.trim() ? 'text-white group-hover:rotate-12' : 'text-stone-400 dark:text-zinc-500'}`} />
                  <span className="tracking-wide font-extrabold">Generate Concept Visual</span>
                </>
              )}
            </button>

            {/* Mobile helper to jump directly to canvas */}
            <div className="block lg:hidden pt-1">
              <button
                type="button"
                onClick={() => setMobileTab('CANVAS')}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-stone-500 dark:text-zinc-400 hover:text-pink-600 transition-colors"
              >
                <span>View Visual Canvas →</span>
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 2: VISUAL CANVAS WORKSPACE (Center Column - 5 cols)*/}
        {/* ======================================================== */}
        <div className={`lg:col-span-5 space-y-4 ${mobileTab === 'CANVAS' ? 'block' : 'hidden lg:block'}`}>
          <div className="rounded-2xl border border-stone-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-3.5 sm:p-5 shadow-xs space-y-4">
            {/* Visual Canvas Header */}
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <ImageIcon size={16} className="text-pink-500 shrink-0" />
                <span className="font-bold text-sm text-stone-900 dark:text-zinc-100 truncate">
                  {activeAsset ? activeAsset.title : 'Creative Canvas'}
                </span>
                {activeAsset && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/15 text-pink-700 dark:text-pink-300 shrink-0">
                    v{currentRevisionNumber}
                  </span>
                )}
              </div>

              {/* View mode toggle tabs */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {activeAsset && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCanvasMode('OUTPUT')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        canvasMode === 'OUTPUT'
                          ? 'bg-pink-600 text-white shadow-2xs'
                          : 'bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 hover:bg-stone-200'
                      }`}
                    >
                      AI Visual
                    </button>

                    {activeReferenceImage && (
                      <>
                        <button
                          type="button"
                          onClick={() => setCanvasMode('REFERENCE')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                            canvasMode === 'REFERENCE'
                              ? 'bg-pink-600 text-white shadow-2xs'
                              : 'bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 hover:bg-stone-200'
                          }`}
                          title="View original uploaded reference image"
                        >
                          <Paperclip size={11} />
                          <span>Reference</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCanvasMode(canvasMode === 'COMPARE_REFERENCE' ? 'OUTPUT' : 'COMPARE_REFERENCE');
                            setSliderPos(50);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                            canvasMode === 'COMPARE_REFERENCE'
                              ? 'bg-pink-600 text-white shadow-2xs'
                              : 'bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 hover:bg-stone-200'
                          }`}
                          title="Compare Reference Photo vs AI Visual Output"
                        >
                          <Columns size={12} />
                          <span>Ref vs AI</span>
                        </button>
                      </>
                    )}

                    {previousRevision && (
                      <button
                        type="button"
                        onClick={() => {
                          setCanvasMode(canvasMode === 'COMPARE_REVISION' ? 'OUTPUT' : 'COMPARE_REVISION');
                          setSliderPos(50);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                          canvasMode === 'COMPARE_REVISION'
                            ? 'bg-pink-600 text-white shadow-2xs'
                            : 'bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 hover:bg-stone-200'
                        }`}
                        title="Compare Previous Revision vs Current Revision"
                      >
                        <Columns size={12} />
                        <span>v{previousRevision.revisionNumber} vs v{currentRevisionNumber}</span>
                      </button>
                    )}
                  </>
                )}

                {activeAsset && (
                  <span className="text-[11px] font-mono text-stone-400 px-2 py-0.5 bg-stone-100 dark:bg-zinc-800 rounded-md">
                    {activeAsset.aspectRatio}
                  </span>
                )}
              </div>
            </div>

            {/* Visual Canvas Display Area */}
            <div className="relative rounded-2xl overflow-hidden bg-stone-950 border border-stone-800/80 flex items-center justify-center min-h-[300px] sm:min-h-[460px] group">
              {generating ? (
                <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <div className="relative flex h-12 w-12 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-60" />
                    <div className="relative p-3 rounded-full bg-pink-600 text-white">
                      <Sparkles size={24} className="animate-spin" />
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white">Synthesizing Creative Visual...</div>
                    <div className="text-xs text-stone-400 mt-1 max-w-xs">
                      FLUX.1 applying {stylePreset} aesthetic, {lighting.toLowerCase()} and {aspectRatio} canvas framing
                    </div>
                  </div>
                </div>
              ) : activeAsset ? (
                canvasMode === 'COMPARE_REVISION' && previousRevision ? (
                  /* Interactive Split-Screen Comparison Slider (Revision vs Revision) */
                  <div
                    ref={sliderRef}
                    onMouseMove={handleSliderMove}
                    onTouchMove={handleSliderMove}
                    className="relative w-full h-[320px] sm:h-[460px] select-none cursor-ew-resize overflow-hidden touch-none"
                  >
                    {/* Current Revision */}
                    <img
                      src={activeAsset.imageUrl}
                      alt="Current revision"
                      className="absolute inset-0 w-full h-full object-contain"
                    />

                    {/* Previous Revision clipped */}
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ width: `${sliderPos}%` }}
                    >
                      <img
                        src={previousRevision.imageUrl}
                        alt="Previous revision"
                        className="absolute inset-0 w-full h-full object-contain max-w-none"
                        style={{ width: sliderRef.current?.clientWidth || '100%' }}
                      />
                    </div>

                    {/* Divider Line */}
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize flex items-center justify-center touch-none select-none"
                      style={{ left: `${sliderPos}%` }}
                    >
                      <div className="w-6 h-6 rounded-full bg-white shadow-md text-stone-900 flex items-center justify-center text-[10px] font-bold">
                        ↔
                      </div>
                    </div>

                    {/* Badges */}
                    <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded bg-black/75 text-white text-[10px] font-bold">
                      v{previousRevision.revisionNumber} (Before)
                    </span>
                    <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-pink-600 text-white text-[10px] font-bold">
                      v{currentRevisionNumber} (After)
                    </span>
                  </div>
                ) : canvasMode === 'COMPARE_REFERENCE' && activeReferenceImage ? (
                  /* Interactive Split-Screen Comparison Slider (Reference vs AI Output) */
                  <div
                    ref={sliderRef}
                    onMouseMove={handleSliderMove}
                    onTouchMove={handleSliderMove}
                    className="relative w-full h-[320px] sm:h-[460px] select-none cursor-ew-resize overflow-hidden touch-none"
                  >
                    {/* AI Output */}
                    <img
                      src={activeAsset.imageUrl}
                      alt="AI Visual"
                      className="absolute inset-0 w-full h-full object-contain"
                    />

                    {/* Reference Image clipped */}
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ width: `${sliderPos}%` }}
                    >
                      <img
                        src={activeReferenceImage}
                        alt="Reference Asset"
                        className="absolute inset-0 w-full h-full object-contain max-w-none"
                        style={{ width: sliderRef.current?.clientWidth || '100%' }}
                      />
                    </div>

                    {/* Divider Line */}
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize flex items-center justify-center touch-none select-none"
                      style={{ left: `${sliderPos}%` }}
                    >
                      <div className="w-6 h-6 rounded-full bg-white shadow-md text-stone-900 flex items-center justify-center text-[10px] font-bold">
                        ↔
                      </div>
                    </div>

                    {/* Badges */}
                    <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded bg-black/75 text-white text-[10px] font-bold">
                      Source Reference Asset
                    </span>
                    <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-pink-600 text-white text-[10px] font-bold">
                      FLUX.1 Synthesized Visual
                    </span>
                  </div>
                ) : canvasMode === 'REFERENCE' && activeReferenceImage ? (
                  /* Direct Reference Image View */
                  <div className="relative w-full h-full flex flex-col items-center justify-center p-3">
                    <img
                      src={activeReferenceImage}
                      alt="Reference Asset"
                      className="max-h-[320px] sm:max-h-[440px] w-full object-contain rounded-xl shadow-lg"
                    />
                    <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded bg-black/80 text-white text-[10px] font-bold flex items-center gap-1">
                      <Paperclip size={11} />
                      <span>Original Attached Reference Asset</span>
                    </span>
                  </div>
                ) : (
                  /* Standard Image Display */
                  <div className="relative w-full h-full flex items-center justify-center p-2">
                    <img
                      src={activeAsset.imageUrl}
                      alt={activeAsset.title}
                      className="max-h-[320px] sm:max-h-[460px] w-full object-contain rounded-xl shadow-lg transition-transform duration-300"
                    />

                    {/* Overlay Prompt preview on hover */}
                    <div className="absolute inset-x-2 bottom-2 p-3 rounded-xl bg-black/85 backdrop-blur-xs text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs space-y-1">
                      <div className="font-semibold text-pink-400 flex items-center justify-between">
                        <span>{activeAsset.stylePreset}</span>
                        <span>{activeAsset.aspectRatio}</span>
                      </div>
                      <p className="line-clamp-2 text-stone-300 text-[11px] leading-relaxed">
                        {activeAsset.enhancedPrompt || activeAsset.prompt}
                      </p>
                    </div>
                  </div>
                )
              ) : (
                <div className="text-center p-8 space-y-2 text-stone-400">
                  <Wand2 size={32} className="mx-auto text-stone-600" />
                  <div className="font-semibold text-sm">Visual Canvas is Ready</div>
                  <div className="text-xs text-stone-500 max-w-xs">
                    Configure your concept in the left panel and click Generate to see your commercial visual live.
                  </div>
                </div>
              )}
            </div>

            {/* Quick 1-Click Action Buttons Bar */}
            {activeAsset && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 dark:border-zinc-800">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-50 hover:bg-pink-100 dark:bg-pink-950/40 dark:hover:bg-pink-900/50 text-pink-700 dark:text-pink-300 text-xs font-semibold transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                    title="Regenerate this visual concept with a fresh seed"
                  >
                    <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />
                    <span>{regenerating ? 'Regenerating...' : 'Regenerate'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-800 dark:text-zinc-200 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                  >
                    <Download size={13} />
                    <span>Download Visual</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-800 dark:text-zinc-200 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                  >
                    <Copy size={13} />
                    <span>Copy URL</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setAttachModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <Layers size={13} />
                    <span>Attach to Content</span>
                  </button>
                </div>
              </div>
            )}

            {/* Mobile View Switcher underneath canvas */}
            <div className="flex lg:hidden items-center justify-between gap-2 pt-2 border-t border-stone-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setMobileTab('BUILDER')}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 text-xs font-semibold transition-colors text-center"
              >
                ← Edit Prompt
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('REVISIONS')}
                className="flex-1 py-2.5 rounded-xl bg-pink-50 hover:bg-pink-100 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 text-xs font-semibold transition-colors text-center"
              >
                Iterate & Refine →
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 3: CHANGE REQUESTS & REVISIONS (Right Column - 3 cols)*/}
        {/* ======================================================== */}
        <div className={`lg:col-span-3 space-y-4 ${mobileTab === 'REVISIONS' ? 'block' : 'hidden lg:block'}`}>
          {/* Change Request Card */}
          <div className="rounded-2xl border border-stone-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-3.5 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-stone-900 dark:text-zinc-100">
                <Sliders size={16} className="text-pink-500" />
                <span>Iterate & Refine</span>
              </div>
              <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                v{currentRevisionNumber + 1}
              </span>
            </div>

            <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed">
              Iterate seamlessly on the current visual. Apply quick tweaks or specify adjustments.
            </p>

            {/* Quick Preset One-Click Tweaks */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Quick Style Tweaks</label>
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto p-1.5 pr-2 rounded-xl border border-stone-200/80 dark:border-zinc-800 bg-stone-50/40 dark:bg-zinc-900/40 scrollbar-thin">
                {QUICK_CHANGE_TWEAKS.map((q, idx) => {
                  const isSelected = selectedChangePreset === q.tweak;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedChangePreset('');
                          if (changeInstruction === q.tweak) setChangeInstruction('');
                        } else {
                          setSelectedChangePreset(q.tweak);
                          setChangeInstruction((prev) => {
                            const trimmed = prev.trim();
                            if (!trimmed) return q.tweak;
                            if (trimmed.includes(q.tweak)) return trimmed;
                            return `${trimmed}, ${q.tweak}`;
                          });
                        }
                      }}
                      className={`text-xs p-2 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-2 border-pink-500 bg-pink-500/10 text-pink-900 dark:text-pink-200 font-bold shadow-xs'
                          : 'border border-stone-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-800/40 text-stone-700 dark:text-zinc-300 hover:border-pink-300 dark:hover:border-zinc-600 hover:bg-stone-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span>{q.label}</span>
                      {isSelected && <Check size={13} className="text-pink-600 dark:text-pink-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Change Instructions */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">
                Revision Request Notes
              </label>
              <textarea
                rows={3}
                value={changeInstruction}
                onChange={(e) => setChangeInstruction(e.target.value)}
                placeholder="e.g. Make lighting warmer, add brand green highlights, enhance rim reflection..."
                className="w-full text-xs rounded-xl bg-stone-50 dark:bg-zinc-800/80 border border-stone-200 dark:border-zinc-700 p-2.5 text-stone-800 dark:text-zinc-200 outline-none focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/30 resize-none leading-relaxed transition-all"
              />
            </div>

            {/* Optional Revision Reference Image */}
            <div className="space-y-1">
              <input
                type="file"
                ref={revisionFileInputRef}
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileProcess(e.target.files[0], true);
                  }
                }}
                className="hidden"
              />
              {!revisionReferenceImage ? (
                <button
                  type="button"
                  onClick={() => revisionFileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl border border-dashed border-stone-300 dark:border-zinc-700 text-stone-600 dark:text-zinc-400 hover:text-pink-600 hover:border-pink-400 text-xs transition-colors cursor-pointer"
                >
                  <Paperclip size={12} />
                  <span>Attach New Revision Reference (Optional)</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-xs">
                  <img
                    src={revisionReferenceImage}
                    alt="Revision Ref"
                    className="w-8 h-8 rounded object-cover"
                  />
                  <span className="truncate flex-1 text-[11px] font-medium text-stone-800 dark:text-zinc-200">
                    {revisionFileName}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRevisionReferenceImage(null);
                      setRevisionFileName('');
                    }}
                    className="p-1 rounded text-rose-500 hover:bg-rose-100"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* Generate Revision Button */}
            <button
              type="button"
              onClick={handleRequestChange}
              disabled={requestingChange || !activeAsset || (!changeInstruction.trim() && !selectedChangePreset)}
              className={`relative isolate overflow-hidden w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 ${
                activeAsset && (changeInstruction.trim() || selectedChangePreset)
                  ? 'text-white bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 active:scale-[0.98] border border-pink-400/60 border-t-pink-300/90 shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_8px_20px_-4px_rgba(219,39,119,0.35)] cursor-pointer'
                  : 'text-stone-400 dark:text-zinc-500 bg-stone-100 dark:bg-zinc-800/80 border border-stone-200 dark:border-zinc-700/80 border-t-stone-300 dark:border-t-zinc-600 shadow-none cursor-not-allowed opacity-70'
              }`}
            >
              {requestingChange ? (
                <>
                  <RefreshCw size={14} className="animate-spin text-white" />
                  <span>Generating Revision v{currentRevisionNumber + 1}...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={14} className={activeAsset && (changeInstruction.trim() || selectedChangePreset) ? 'text-white' : 'text-stone-400 dark:text-zinc-500'} />
                  <span>Generate Revision v{currentRevisionNumber + 1}</span>
                </>
              )}
            </button>

            {/* Revision Timeline */}
            {activeAsset?.revisions && activeAsset.revisions.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-stone-100 dark:border-zinc-800">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 dark:text-zinc-200">
                  <History size={13} className="text-stone-400" />
                  <span>Revision History ({activeAsset.revisions.length})</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {activeAsset.revisions.map((rev) => (
                    <div
                      key={rev.revisionNumber}
                      onClick={() => {
                        // Clicking a revision previews it directly
                        setActiveAsset({
                          ...activeAsset,
                          imageUrl: rev.imageUrl,
                          enhancedPrompt: rev.prompt,
                        });
                        setCanvasMode('OUTPUT');
                        setMobileTab('CANVAS');
                      }}
                      className="p-2 rounded-xl border border-stone-200/80 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-800/40 text-xs space-y-1 hover:border-pink-400 transition-colors cursor-pointer"
                      title="Click to preview this revision"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-pink-600 dark:text-pink-400 font-bold">v{rev.revisionNumber}</span>
                        <span className="text-[10px] text-stone-400 font-mono">
                          {new Date(rev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 dark:text-zinc-300 line-clamp-2">
                        {rev.instruction}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mobile helper to jump directly back to canvas */}
            <div className="block lg:hidden pt-2 border-t border-stone-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setMobileTab('CANVAS')}
                className="w-full py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 text-xs font-semibold transition-colors text-center"
              >
                ← Return to Visual Canvas
              </button>
            </div>
          </div>

          {/* Recent Studio Concepts Drawer */}
          <div className="rounded-2xl border border-stone-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-stone-900 dark:text-zinc-100">Recent Concepts</span>
              <span className="text-[10px] text-stone-400 font-semibold">{recentAssets?.length || 0} Assets</span>
            </div>

            <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto p-1 pr-1.5 scrollbar-thin">
              {loadingAssets ? (
                <div className="col-span-3 text-center py-6">
                  <Loading />
                </div>
              ) : recentAssets?.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setActiveAsset(a);
                    setCanvasMode('OUTPUT');
                    setMobileTab('CANVAS');
                  }}
                  className={`relative aspect-square rounded-xl overflow-hidden transition-all cursor-pointer group ${
                    activeAsset?.id === a.id
                      ? 'border-2 border-pink-500 shadow-xs'
                      : 'border border-stone-200 dark:border-zinc-800 hover:border-pink-400'
                  }`}
                >
                  <img
                    src={a.imageUrl}
                    alt={a.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/80 to-transparent text-[9px] text-white font-medium truncate">
                    {a.title}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: ATTACH VISUAL TO CONTENT POST */}
      <Modal
        open={attachModalOpen}
        onOpenChange={(v) => !v && setAttachModalOpen(false)}
        title="Attach Visual to Content Deliverable"
        description="Select a scheduled content deliverable to link this AI concept visual as its production artwork."
      >
        <div className="space-y-4 pt-2">
          {activeAsset && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-100 dark:bg-zinc-800 text-xs">
              <img src={activeAsset.imageUrl} alt={activeAsset.title} className="w-12 h-12 object-cover rounded-lg" />
              <div className="min-w-0">
                <div className="font-bold text-stone-900 dark:text-zinc-100 truncate">{activeAsset.title}</div>
                <div className="text-stone-400 text-[11px]">{activeAsset.stylePreset} · {activeAsset.aspectRatio}</div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">
              Select Scheduled Content Post
            </label>
            <select
              value={selectedContentId || ''}
              onChange={(e) => setSelectedContentId(Number(e.target.value) || null)}
              className="w-full text-xs rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 px-3 py-2 text-stone-800 dark:text-zinc-200 focus:outline-none"
            >
              <option value="">Choose a content post...</option>
              {contentList?.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.id} · {c.title} ({c.type} · {c.platform})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setAttachModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAttachToContent}
              disabled={attaching || !selectedContentId}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-colors"
            >
              {attaching ? 'Attaching...' : 'Confirm & Attach Visual'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
