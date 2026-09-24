"use client";

import { useState } from "react";
import { QrCode } from "lucide-react";
import type { PaymentMethod } from "@/lib/types";
import { paymentMethodIcon } from "@/lib/constants";
import { money } from "@/lib/util";
import { Modal } from "./ui/Modal";
import { Spinner } from "./ui/Spinner";

interface PaymentQrModalProps {
  payeeName: string;
  amount: number;
  currency: string;
  /** undefined while loading, [] once loaded with none found */
  methods: PaymentMethod[] | undefined;
  onClose: () => void;
}

/** Shown when a debtor taps the pay icon next to a debt: pick a method (if >1), then view its QR. */
export function PaymentQrModal({ payeeName, amount, currency, methods, onClose }: PaymentQrModalProps) {
  const [selected, setSelected] = useState<PaymentMethod | null>(null);
  // a single method skips straight to the QR — no need to pick from a list of one
  const shown = selected ?? (methods?.length === 1 ? methods[0] : null);

  return (
    <Modal open onClose={onClose} labelledBy="pay-title">
      {!methods ? (
        <div className="flex items-center justify-center p-10">
          <Spinner size={26} />
        </div>
      ) : shown ? (
        <div className="p-6 text-center">
          <h2 id="pay-title" className="flex items-center justify-center gap-2 text-[15px] font-bold">
            {(() => { const Icon = paymentMethodIcon(shown.type); return <Icon size={16} className="text-accent" />; })()}
            {shown.label}
          </h2>
          <p className="mt-1 text-xs text-muted">
            Pay {payeeName} {money(currency, amount)}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown.qrImage} alt={`${shown.label} QR code for ${payeeName}`} className="mx-auto mt-4 h-56 w-56 rounded-2xl bg-white object-contain p-2" />
          {shown.note && <p className="mt-3 text-sm text-muted">{shown.note}</p>}
          <div className="mt-6 flex gap-2">
            {methods.length > 1 && (
              <button onClick={() => setSelected(null)} className="btn-secondary flex-1 !py-2.5">
                Back
              </button>
            )}
            <button onClick={onClose} className="btn-primary flex-1 !py-2.5">
              Done
            </button>
          </div>
        </div>
      ) : methods.length === 0 ? (
        <div className="p-6 text-center">
          <QrCode size={40} className="mx-auto text-dim" />
          <h2 id="pay-title" className="mt-3 text-[15px] font-bold">
            No payment method yet
          </h2>
          <p className="mt-1.5 text-[13px] text-muted">{payeeName} hasn&apos;t added a bank or e-wallet QR code to their profile.</p>
          <button onClick={onClose} className="btn-secondary mt-6 w-full !py-2.5">
            Close
          </button>
        </div>
      ) : (
        <div className="p-6">
          <h2 id="pay-title" className="text-[15px] font-bold">
            Pay {payeeName}
          </h2>
          <p className="mt-1 text-xs text-muted">{money(currency, amount)} · choose how to pay</p>
          <div className="mt-4 space-y-2">
            {methods.map((m) => {
              const Icon = paymentMethodIcon(m.type);
              return (
                <button
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className="flex w-full items-center gap-3 rounded-xl bg-card2 px-4 py-3 text-left text-[13px] transition hover:brightness-125"
                >
                  <Icon size={16} className="text-accent" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
