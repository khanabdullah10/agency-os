'use client';
import Link from 'next/link';
import { ArrowUpRight, Loader2, Inbox, AlertCircle, ChevronRight, ExternalLink, Camera, UploadCloud, X, Check, Palette } from 'lucide-react';
import { label, initials, statusTone } from '@/lib/utils';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { useState, type ReactNode } from 'react';

export function Badge({ status, children }: { status?: string; children?: ReactNode }) {
  return (
    <span className={'badge ' + statusTone(status)}>
      <span className="status-dot" />
      {children || label(status)}
    </span>
  );
}

export function Avatar({
  name,
  color,
  size = 'normal',
  src,
}: {
  name: string;
  color?: string;
  size?: string;
  src?: string | null;
}) {
  const brandColor = color || '#0284c7';
  const [imgFailed, setImgFailed] = useState(false);

  if (src && !imgFailed) {
    return (
      <span className={'avatar ' + size}>
        <img
          src={src}
          alt={name}
          onError={() => setImgFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={'avatar ' + size}
      style={{
        background: brandColor + '22',
        color: brandColor,
        borderColor: brandColor + '44',
      }}
    >
      {initials(name)}
    </span>
  );
}

export function ClientMark({
  name,
  color,
  size = 'normal',
  src,
}: {
  name: string;
  color?: string;
  size?: string;
  src?: string | null;
}) {
  const brandColor = color || '#0284c7';
  const [imgFailed, setImgFailed] = useState(false);

  if (src && !imgFailed) {
    return (
      <span className={'client-mark ' + size}>
        <img
          src={src}
          alt={name}
          onError={() => setImgFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={'client-mark ' + size}
      style={{
        background: brandColor + '18',
        color: brandColor,
        borderColor: brandColor + '35',
      }}
    >
      {initials(name)}
    </span>
  );
}

export function Loading() {
  return (
    <div className="loading" role="status">
      <Loader2 size={20} className="spin" />
      <span>Loading your workspace…</span>
    </div>
  );
}

export function Empty({
  title = 'Nothing here yet',
  body = 'New work will appear here as your workflow moves forward.',
  action,
}: {
  title?: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={22} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={19} />
      <div>
        <strong>We couldn’t load this view</strong>
        <p>{message}</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="heading-actions">{actions}</div>
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  href,
  children,
  className = '',
  action,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={'panel ' + className}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {href ? (
          <Link className="text-link" href={href}>
            View all <ArrowUpRight size={14} />
          </Link>
        ) : (
          action
        )}
      </div>
      {children}
    </section>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={wide ? 'wide' : ''}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description || 'Keep every detail connected to your workflow.'}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function Field({
  label: labelText,
  children,
  hint,
  className = '',
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={'field ' + className}>
      <span>{labelText}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="text-link" href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ExternalLink size={13} />
    </a>
  );
}

export function FormFooter({
  pending,
  onCancel,
  submit = 'Save changes',
}: {
  pending: boolean;
  onCancel?: () => void;
  submit?: string;
}) {
  return (
    <div className="form-footer">
      {onCancel && (
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      )}
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 size={15} className="spin" />}
        {pending ? 'Saving…' : submit}
        <ChevronRight size={15} />
      </Button>
    </div>
  );
}

export function ImageUploadField({
  label: labelText = 'Profile photo',
  value,
  onChange,
  name = 'User',
  shape = 'circle',
  hint = 'PNG, JPG or WebP (max 5MB)',
}: {
  label?: string;
  value?: string | null;
  onChange: (val: string | null) => void;
  name?: string;
  shape?: 'circle' | 'square';
  hint?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, WebP)');
      return;
    }
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 512;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          onChange(dataUrl);
        } else {
          onChange(event.target?.result as string);
        }
        setLoading(false);
      };
      img.onerror = () => {
        onChange(event.target?.result as string);
        setLoading(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="field full-width">
      <span>{labelText}</span>
      <div className="flex items-center gap-4 p-3 rounded-xl border border-border/50 bg-secondary/20">
        <div className="relative shrink-0">
          {shape === 'circle' ? (
            <Avatar name={name} src={value} size="large" />
          ) : (
            <ClientMark name={name} src={value} size="large" />
          )}
          <label className="absolute -bottom-1 -right-1 p-1 bg-primary text-primary-foreground rounded-full cursor-pointer shadow hover:opacity-90 transition">
            <Camera size={13} />
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={handleFile}
              disabled={loading}
            />
          </label>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground cursor-pointer shadow-sm hover:opacity-90 transition">
              <UploadCloud size={14} />
              {loading ? 'Processing…' : value ? 'Change photo' : 'Upload photo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                onChange={handleFile}
                disabled={loading}
              />
            </label>
            {value && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 border border-destructive/20 transition"
              >
                <X size={13} /> Remove
              </button>
            )}
          </div>
          <small className="text-muted-foreground block text-[11px] leading-tight">
            {hint}
          </small>
        </div>
      </div>
    </div>
  );
}

const PRESET_CLIENT_COLORS = [
  { name: 'Sky Blue', hex: '#0284c7' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Sage Green', hex: '#7d936d' },
  { name: 'Terracotta', hex: '#b58372' },
  { name: 'Slate', hex: '#64748b' },
];

export function ColorPickerField({
  label = 'Client brand color',
  value,
  onChange,
  hint = 'Theme color for client badges, calendar items, and workspace cards',
}: {
  label?: string;
  value: string;
  onChange: (hex: string) => void;
  hint?: string;
}) {
  const currentColor = value || '#0284c7';

  return (
    <div className="field color-picker-field">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11.5px] font-semibold text-foreground">{label}</label>
        {hint && <small className="text-[11px] text-muted-foreground font-normal">{hint}</small>}
      </div>

      <div className="color-picker-box">
        {/* Swatches palette */}
        <div className="color-swatches-grid">
          {PRESET_CLIENT_COLORS.map((preset) => {
            const isSelected = currentColor.toLowerCase() === preset.hex.toLowerCase();
            return (
              <button
                type="button"
                key={preset.hex}
                onClick={() => onChange(preset.hex)}
                className={`color-swatch-circle ${isSelected ? 'selected' : ''}`}
                style={{ backgroundColor: preset.hex }}
                title={`${preset.name} (${preset.hex})`}
              >
                {isSelected && <Check size={12} strokeWidth={3} className="text-white drop-shadow-md" />}
              </button>
            );
          })}
        </div>

        {/* Custom picker row */}
        <div className="color-custom-row">
          <label className="color-native-btn" style={{ backgroundColor: currentColor }} title="Choose custom color">
            <Palette size={14} className="text-white drop-shadow pointer-events-none" />
            <input
              type="color"
              value={currentColor}
              onChange={(e) => onChange(e.target.value)}
              className="sr-only"
            />
          </label>

          <div className="color-hex-box">
            <span className="color-hex-hash">#</span>
            <input
              type="text"
              value={currentColor.replace(/^#/, '')}
              onChange={(e) => {
                const clean = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                onChange('#' + clean);
              }}
              placeholder="0284c7"
              className="color-hex-text"
              maxLength={6}
            />
          </div>

          <div
            className="color-badge-preview"
            style={{
              backgroundColor: `${currentColor}1a`,
              color: currentColor,
              borderColor: `${currentColor}40`,
            }}
          >
            <span className="color-badge-dot" style={{ backgroundColor: currentColor }} />
            <span>Badge Preview</span>
          </div>
        </div>
      </div>
    </div>
  );
}

