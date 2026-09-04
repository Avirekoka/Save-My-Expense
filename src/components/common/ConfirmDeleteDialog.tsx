import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useScrollLock } from '../../hooks/useScrollLock';

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  itemName?: string;
  itemDetails?: string;
  confirmButtonText?: string;
  dangerLevel?: 'danger' | 'warning';
}

export const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  itemDetails,
  confirmButtonText = 'Yes, Delete',
}) => {
  useScrollLock(isOpen);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[#262626] bg-[#141414] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-400 hover:bg-[#262626] hover:text-white transition cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Warning Icon & Heading */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 id="confirm-delete-dialog-title" className="text-base font-bold text-white">
              {title}
            </h3>
            <p className="text-xs text-gray-400">
              {description}
            </p>
          </div>
        </div>

        {/* Item Details Box */}
        {(itemName || itemDetails) && (
          <div className="rounded-xl border border-[#262626] bg-[#0c0c0c] p-3.5 mb-5 space-y-1">
            {itemName && (
              <div className="text-xs font-bold text-white truncate">
                {itemName}
              </div>
            )}
            {itemDetails && (
              <div className="text-[11px] text-gray-400 font-mono">
                {itemDetails}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400 mb-6">
          This action cannot be undone and will immediately remove this entry from your financial tracking and active calculations.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#2e2e2e] bg-[#1c1c1c] px-4 py-2.5 text-xs font-semibold text-gray-300 hover:bg-[#262626] hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4.5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-rose-500 transition cursor-pointer"
          >
            <Trash2 size={14} />
            <span>{confirmButtonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
