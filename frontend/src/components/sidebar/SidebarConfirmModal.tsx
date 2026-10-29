import React from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface SidebarConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const SidebarConfirmModal: React.FC<SidebarConfirmModalProps> = ({
  title,
  message,
  confirmLabel,
  cancelLabel,
  isBusy = false,
  onConfirm,
  onCancel,
}) => (
  <div
    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300"
    onClick={() => !isBusy && onCancel()}
  >
    <div
      className="bg-white rounded-lg p-6 shadow-xl w-full max-w-sm transform transition-all duration-300 scale-100"
      onClick={e => e.stopPropagation()}
    >
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-4">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isBusy}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#C6A75D] disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isBusy}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-wait flex items-center"
        >
          {isBusy && <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />}
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);
