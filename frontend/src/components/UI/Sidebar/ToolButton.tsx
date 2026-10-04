import React from 'react'

interface ToolButtonProps {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  onDragStart?: (e: React.DragEvent) => void
  draggable?: boolean
}

export const ToolButton: React.FC<ToolButtonProps> = ({ 
  icon, 
  label, 
  onClick, 
  onDragStart, 
  draggable 
}) => {
  return (
    <button 
      type="button"
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100 transition-colors w-full min-h-[84px] cursor-grab active:cursor-grabbing text-center select-none"
    >
      <div className="mb-2 pointer-events-none text-slate-600">
        {icon}
      </div>
      <span className="text-[12px] text-slate-700 leading-snug pointer-events-none">
        {label}
      </span>
    </button>
  )
}
