import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Loader2, X } from 'lucide-react';
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
  type Verdict,
} from '../../../src/shared/types';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 size={15} className="spin" /> : icon}
      {children}
    </button>
  );
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
  padded = true,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-header">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      <div className={padded ? 'card-body' : ''}>{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
  className = '',
}: {
  label: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">
        {label}
        {required && <i className="required">*</i>}
      </span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function ChipsInput({
  value,
  onChange,
  placeholder = '输入后按回车添加',
  tone = 'blue',
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  tone?: 'blue' | 'gray' | 'green';
}) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const parts = draft
      .split(/[,，、\n]/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length) {
      onChange([...new Set([...value, ...parts])]);
    }
    setDraft('');
  };

  return (
    <div className="chips-input">
      <div className="chips">
        {value.map((item) => (
          <span className={`chip chip-${tone}`} key={item}>
            {item}
            <button
              type="button"
              className="chip-remove"
              aria-label={`移除 ${item}`}
              onClick={() => onChange(value.filter((current) => current !== item))}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          className="chip-entry"
          value={draft}
          placeholder={value.length ? '' : placeholder}
          onChange={(event) => {
            const next = event.target.value;
            if (/[,，、]/.test(next)) {
              const segments = next.split(/[,，、]/);
              const partial = segments.pop() ?? '';
              const parts = segments.map((part) => part.trim()).filter(Boolean);
              if (parts.length) onChange([...new Set([...value, ...parts])]);
              setDraft(partial);
            } else {
              setDraft(next);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            } else if (event.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={commit}
        />
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = 'gray',
  className = '',
}: {
  children: ReactNode;
  tone?: 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet';
  className?: string;
}) {
  return <span className={`badge badge-${tone} ${className}`}>{children}</span>;
}

export function StatusPill({ status }: { status: ApplicationStatus }) {
  const tones: Record<ApplicationStatus, string> = {
    drafted: 'gray',
    submitted: 'blue',
    replied: 'violet',
    interview: 'green',
    rejected: 'red',
    offer: 'green',
    archived: 'gray',
  };
  return (
    <span className={`status-pill status-${status} badge badge-${tones[status]}`}>
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  );
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const tone =
    verdict === '推荐投递' ? 'green' : verdict === '可以尝试' ? 'blue' : verdict === '谨慎投递' ? 'amber' : 'red';
  return <Badge tone={tone as 'green' | 'blue' | 'amber' | 'red'}>{verdict}</Badge>;
}

export function ScoreRing({ score, size = 74 }: { score: number; size?: number }) {
  const color = score >= 80 ? '#12a150' : score >= 65 ? '#1f5eff' : score >= 45 ? '#d97706' : '#e5484d';
  return (
    <div
      className="score-ring"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${color} ${Math.max(0, Math.min(100, score)) * 3.6}deg, #edf0f6 0)`,
      }}
    >
      <div className="score-inner" style={{ fontSize: Math.max(12, Math.round(size * 0.25)) }}>
        <b style={{ color }}>{score}</b>
        {size >= 60 && <span>匹配</span>}
      </div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="switch-row">
      <span>
        <b>{label}</b>
        {description && <small>{description}</small>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`switch ${checked ? 'on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </label>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className="drawer-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="drawer" role="dialog" aria-modal="true">
        <header className="drawer-header">
          <div className="drawer-heading">
            <h2>{title}</h2>
            {subtitle && <div className="drawer-subtitle">{subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-footer">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function CopyButton({ text, label = '复制' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <Button
      variant="ghost"
      size="sm"
      icon={copied ? <Check size={14} /> : <Copy size={14} />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          timer.current = window.setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? '已复制' : label}
    </Button>
  );
}

export interface ToastState {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

export function Toast({ toast, onClose }: { toast: ToastState | null; onClose: () => void }) {
  const id = useId();
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onClose, 4200);
    return () => window.clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;
  return createPortal(
    <div key={`${id}-${toast.id}`} className={`toast toast-${toast.type}`} role="status">
      <span>{toast.message}</span>
      <button onClick={onClose} aria-label="关闭提示">
        <X size={14} />
      </button>
    </div>,
    document.body,
  );
}

export function Spinner({ label = '加载中…' }: { label?: string }) {
  return (
    <div className="page-loading">
      <Loader2 size={22} className="spin" />
      <span>{label}</span>
    </div>
  );
}

export function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDay(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}
