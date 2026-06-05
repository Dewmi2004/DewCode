import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SectionProps {
  title: string;
  description: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SectionProps> = ({
  title,
  description,
  collapsed,
  onToggle,
  children,
}) => (
  <section className="theme-soft rounded-lg border">
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
    >
      <span>
        <span className="block font-display text-base font-bold tracking-normal theme-text">{title}</span>
        <span className="mt-1 block text-sm theme-muted">{description}</span>
      </span>
      {collapsed ? <ChevronRight size={18} className="theme-muted" /> : <ChevronDown size={18} className="theme-muted" />}
    </button>
    {!collapsed && <div className="space-y-5 border-t px-5 py-5 theme-panel">{children}</div>}
  </section>
);

export const Field: React.FC<{
  label: string;
  description?: string;
  children: React.ReactNode;
}> = ({ label, description, children }) => (
  <label className="grid gap-2">
    <span className="text-sm font-semibold theme-text">{label}</span>
    {description && <span className="text-xs leading-5 theme-muted">{description}</span>}
    {children}
  </label>
);

export const Toggle: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <div className="flex items-center justify-between gap-4">
    <div>
      <p className="text-sm font-semibold theme-text">{label}</p>
      {description && <p className="mt-1 text-xs leading-5 theme-muted">{description}</p>}
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative h-6 w-11 shrink-0 rounded-full transition"
      style={{ background: checked ? 'var(--accent)' : 'var(--border-strong)' }}
      aria-pressed={checked}
    >
      <span
        className="absolute top-1 h-4 w-4 rounded-full bg-white transition"
        style={{ left: checked ? '1.5rem' : '0.25rem' }}
      />
    </button>
  </div>
);

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`theme-input w-full rounded-md px-3 py-2 text-sm outline-none ${props.className ?? ''}`}
  />
);

export const SelectInput: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select
    {...props}
    className={`theme-input w-full rounded-md px-3 py-2 text-sm outline-none ${props.className ?? ''}`}
  />
);

export const SaveButton: React.FC<{
  saving?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
}> = ({ saving, children, onClick, type = 'button' }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={saving}
    className="theme-button inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-bold transition disabled:opacity-60"
  >
    {saving ? 'Saving...' : children}
  </button>
);
