import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Shown in the sticky header. */
  title?: React.ReactNode;
  /** Small line above the title. */
  eyebrow?: React.ReactNode;
  /** Optional artwork across the top (e.g. a game cover). */
  banner?: React.ReactNode;
  /** Sticky footer, usually the main action. */
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const WIDTH = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };

/**
 * The one popup used across the app. Rendered into <body> through a portal, so no parent
 * transform/filter can trap it: it always opens where the player is looking.
 * Phone: a bottom sheet (easy to reach with a thumb). Larger screens: a centered dialog.
 */
const Sheet: React.FC<SheetProps> = ({ open, onClose, title, eyebrow, banner, footer, size = 'md', children }) => {
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6" role="presentation">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`relative w-full ${WIDTH[size]} max-h-[92dvh] flex flex-col bg-zinc-900 border border-white/10 sm:border-white/[0.08] rounded-t-3xl sm:rounded-3xl shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.8)] overflow-hidden sheet-up sm:animate-in sm:zoom-in-95 focus:outline-none`}
      >
        {/* Grab handle (phone) */}
        <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/25 z-20" />

        <div className="overflow-y-auto overscroll-contain flex-1">
          {banner && <div className="relative">{banner}</div>}
          {(title || eyebrow) && (
            <div className={`sticky top-0 z-10 flex items-start justify-between gap-3 px-5 pt-5 pb-3 ${banner ? 'bg-zinc-900' : 'bg-zinc-900/95 backdrop-blur'}`}>
              <div className="min-w-0">
                {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 mb-0.5">{eyebrow}</div>}
                {title && <h2 className="text-xl font-extrabold text-white leading-tight break-words">{title}</h2>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 w-9 h-9 -mr-1 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
          {!title && !eyebrow && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <div className="px-5 pb-5">{children}</div>
        </div>

        {footer && (
          <div className="shrink-0 border-t border-white/[0.06] bg-zinc-900 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Sheet;
