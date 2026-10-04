import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useEditorStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success'
        const isError = toast.type === 'error'

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all animate-in slide-in-from-bottom-5 fade-in duration-200 ${
              isSuccess
                ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900'
                : isError
                ? 'bg-red-50/95 border-red-200 text-red-900'
                : 'bg-white/95 border-slate-200 text-slate-800'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {isSuccess && <CheckCircle2 size={18} className="text-emerald-600" />}
              {isError && <AlertCircle size={18} className="text-red-600" />}
              {!isSuccess && !isError && <Info size={18} className="text-blue-600" />}
            </div>

            <div className="flex-1 text-xs">
              <div className="font-bold leading-tight">{toast.title}</div>
              {toast.message && (
                <div className="mt-0.5 text-[11px] opacity-80 leading-normal">
                  {toast.message}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-black/5 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
