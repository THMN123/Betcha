import React from 'react';
import { CheckCircle2, AlertCircle, Info, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const Toast: React.FC = () => {
  const { toast } = useApp();

  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-indigo-400 shrink-0" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />,
    error: <XCircle className="w-5 h-5 text-rose-400 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-500/40 bg-zinc-900/95 text-emerald-100 shadow-emerald-950/50',
    info: 'border-indigo-500/40 bg-zinc-900/95 text-indigo-100 shadow-indigo-950/50',
    warning: 'border-amber-500/40 bg-zinc-900/95 text-amber-100 shadow-amber-950/50',
    error: 'border-rose-500/40 bg-zinc-900/95 text-rose-100 shadow-rose-950/50',
  };

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-md pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-top-4">
      <div className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-xl ${borders[toast.type]}`}>
        {icons[toast.type]}
        <p className="text-xs sm:text-sm font-medium leading-snug">{toast.message}</p>
      </div>
    </div>
  );
};

export default Toast;
