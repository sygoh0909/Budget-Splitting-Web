"use client";

import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel, danger = true, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} labelledBy="confirm-title">
      <div className="p-6">
        <h2 id="confirm-title" className="text-[15px] font-semibold text-white">
          {title}
        </h2>
        <p className="mt-2 text-[13px] text-muted">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary !py-2" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition hover:brightness-125 ${
              danger ? "bg-danger/10 text-danger" : "bg-accent/15 text-accent"
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
