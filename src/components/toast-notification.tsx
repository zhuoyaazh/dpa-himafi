"use client";

import { useState } from "react";

type ToastType = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
};

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: ToastType = "info", duration = 4000) => {
    const id = `${Date.now()}-${Math.random()}`;
    const toast: Toast = { id, type, message, duration };

    setToasts((prev) => [...prev, toast]);

    if (duration) {
      const timeoutId = window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);

      return () => window.clearTimeout(timeoutId);
    }
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, addToast, removeToast };
}

export function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 space-y-2 sm:bottom-6 sm:right-6">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function Toast({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false);

  const bgColorClass = {
    success: "bg-green-50 border-green-200 text-green-900",
    error: "bg-red-50 border-red-200 text-red-900",
    info: "bg-blue-50 border-blue-200 text-blue-900",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-900",
  }[toast.type];

  const iconEmoji = {
    success: "✓",
    error: "✕",
    info: "ℹ",
    warning: "⚠",
  }[toast.type];

  const iconColorClass = {
    success: "text-green-600",
    error: "text-red-600",
    info: "text-blue-600",
    warning: "text-yellow-600",
  }[toast.type];

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 150);
  };

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg transition-all duration-150 ${bgColorClass} ${
        isExiting ? "translate-x-96 opacity-0" : "translate-x-0 opacity-100"
      }`}
    >
      <span className={`mt-0.5 text-lg font-bold ${iconColorClass}`}>{iconEmoji}</span>
      <div className="flex-1">
        <p className="text-sm font-medium">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={handleClose}
        className="ml-2 text-lg font-bold opacity-60 hover:opacity-100 transition"
      >
        ✕
      </button>
    </div>
  );
}
