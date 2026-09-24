"use client";

import { useRef, useState } from "react";
import { Plus, QrCode, Trash2, X } from "lucide-react";
import type { PaymentMethod, PaymentMethodType } from "@/lib/types";
import { paymentMethodPresets, paymentMethodIcon } from "@/lib/constants";
import { imageToQrDataUrl } from "@/lib/qrImage";
import { generateUuid } from "@/lib/util";
import { savePaymentMethods } from "@/lib/db";
import { Modal } from "./ui/Modal";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { Spinner } from "./ui/Spinner";
import { useToast } from "./ui/Toast";

/** Add-method flow: pick a type, upload the QR, optionally label/note it. */
function AddMethodDialog({
  existing, onClose, onAdd,
}: { existing: PaymentMethod[]; onClose: () => void; onAdd: (m: PaymentMethod) => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<PaymentMethodType | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const preset = paymentMethodPresets.find((p) => p.type === picked);
  const available = paymentMethodPresets.filter((p) => p.type === "other" || !existing.some((m) => m.type === p.type));

  async function handleFile(file: File) {
    setBusy(true);
    try {
      setImage(await imageToQrDataUrl(file));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't read that image.", "error");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!picked || !image) return;
    onAdd({ id: generateUuid(), type: picked, label: label.trim() || preset?.label || "Payment", qrImage: image, note: note.trim() || null });
  }

  return (
    <Modal open onClose={onClose} labelledBy="add-method-title">
      {!picked ? (
        <div className="p-6">
          <h2 id="add-method-title" className="text-[15px] font-bold">
            Add payment method
          </h2>
          <p className="mt-1 text-xs text-muted">Others will see this option when they owe you money.</p>
          <div className="mt-4 space-y-2">
            {available.map((p) => (
              <button
                key={p.type}
                onClick={() => { setPicked(p.type); setLabel(p.type === "other" ? "" : p.label); }}
                className="flex w-full items-center gap-3 rounded-xl bg-card2 px-4 py-3 text-left text-[13px] transition hover:brightness-125"
              >
                <p.icon size={16} className="text-accent" />
                {p.label}
              </button>
            ))}
            {available.length === 1 && available[0].type === "other" && (
              <p className="text-xs text-dim">You've already added every preset — pick &quot;Other&quot; to add another.</p>
            )}
          </div>
        </div>
      ) : !preset ? null : (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-card2 px-6 pb-4 pt-5">
            <h2 className="flex items-center gap-2 text-[15px] font-bold">
              <preset.icon size={16} className="text-accent" /> {preset.label}
            </h2>
            <button onClick={onClose} aria-label="Close" className="text-[#666] transition hover:text-white">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-hidden
                tabIndex={-1}
                data-testid="qr-input"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) handleFile(f);
                }}
              />
              {image ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mx-auto block overflow-hidden rounded-2xl ring-1 ring-line"
                  aria-label="Replace QR code image"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt="QR code preview" className="h-52 w-52 bg-white object-contain" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="flex h-52 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-muted transition hover:border-accent/50 hover:text-accent"
                >
                  {busy ? <Spinner size={22} /> : <QrCode size={28} />}
                  <span className="text-xs">Upload QR code screenshot</span>
                </button>
              )}
            </div>

            {picked === "other" && (
              <div>
                <label htmlFor="pm-label" className="label">
                  Label
                </label>
                <input id="pm-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Venmo, WeChat Pay" className="field mt-1.5" />
              </div>
            )}
            <div>
              <label htmlFor="pm-note" className="label">
                Note (optional)
              </label>
              <input id="pm-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. account number or phone number" className="field mt-1.5 !text-sm" />
            </div>
          </div>

          <div className="flex gap-3 px-6 pb-6 pt-2">
            <button onClick={() => setPicked(null)} className="btn-secondary flex-1 !py-3">
              Back
            </button>
            <button onClick={save} disabled={!image} className="btn-primary flex-1 !py-3">
              Add
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function PaymentMethodsSection({ uid, methods, onChange }: { uid: string; methods: PaymentMethod[]; onChange: (m: PaymentMethod[]) => void }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState<PaymentMethod | null>(null);
  const [toRemove, setToRemove] = useState<PaymentMethod | null>(null);
  const [saving, setSaving] = useState(false);

  async function persist(next: PaymentMethod[]) {
    onChange(next); // optimistic — reflected immediately in the balances/pay flow too
    setSaving(true);
    try {
      await savePaymentMethods(uid, next);
    } catch (err) {
      console.error(err);
      toast("Couldn't save your payment methods.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="text-xs text-muted">
        Upload a QR code (bank transfer, e-wallet, etc.). When someone owes you money in a book, they&apos;ll see these options in Balances.
      </p>

      <div className="mt-4 space-y-2">
        {methods.map((m) => {
          const Icon = paymentMethodIcon(m.type);
          return (
            <div key={m.id} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
              <button onClick={() => setPreview(m)} aria-label={`Preview ${m.label} QR code`} className="shrink-0 overflow-hidden rounded-lg ring-1 ring-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.qrImage} alt="" className="h-11 w-11 bg-white object-contain" />
              </button>
              <button onClick={() => setPreview(m)} className="min-w-0 flex-1 text-left">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  <Icon size={13} className="shrink-0 text-accent" /> {m.label}
                </p>
                {m.note && <p className="truncate text-[11px] text-muted">{m.note}</p>}
              </button>
              <button onClick={() => setToRemove(m)} aria-label={`Remove ${m.label}`} className="p-1.5 text-dim transition hover:text-danger">
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <button onClick={() => setAdding(true)} disabled={saving} className="btn-primary mt-3 w-full !py-3 !text-sm">
        <Plus size={15} /> Add payment method
      </button>

      {adding && (
        <AddMethodDialog
          existing={methods}
          onClose={() => setAdding(false)}
          onAdd={(m) => {
            setAdding(false);
            persist([...methods, m]);
          }}
        />
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} labelledBy="pm-preview-title">
        {preview && (
          <div className="p-6 text-center">
            <h2 id="pm-preview-title" className="flex items-center justify-center gap-2 text-[15px] font-bold">
              {(() => { const Icon = paymentMethodIcon(preview.type); return <Icon size={16} className="text-accent" />; })()}
              {preview.label}
            </h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.qrImage} alt={`${preview.label} QR code`} className="mx-auto mt-4 h-56 w-56 rounded-2xl bg-white object-contain p-2" />
            {preview.note && <p className="mt-3 text-sm text-muted">{preview.note}</p>}
            <button onClick={() => setPreview(null)} className="btn-secondary mt-6 w-full !py-2.5">
              Close
            </button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toRemove}
        title={`Remove ${toRemove?.label ?? ""}?`}
        message="People you owe (or who owe you) won't see this option anymore."
        confirmLabel="Remove"
        onCancel={() => setToRemove(null)}
        onConfirm={() => {
          const next = methods.filter((m) => m.id !== toRemove!.id);
          setToRemove(null);
          persist(next);
        }}
      />
    </div>
  );
}
