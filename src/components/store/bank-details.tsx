"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";

export type BankInfo = {
  bankName: string;
  bankAccountHolder: string;
  bankAccount: string;
  bankClabe: string;
  bankCard: string;
  bankNote: string;
};

export function hasBankInfo(b: BankInfo) {
  return Boolean(b.bankAccount || b.bankClabe || b.bankCard);
}

/** "1234567890123456" → "1234 5678 9012 3456" para leerlo fácil; al copiar se copian solo los dígitos. */
function groupDigits(value: string) {
  return value.replace(/\s/g, "").replace(/(.{4})(?=.)/g, "$1 ");
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const digits = value.replace(/[\s-]/g, "");
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-sky-100">
      <div className="min-w-0">
        <p className="text-xs text-stone-500">{label}</p>
        <p className="font-mono text-base font-bold tracking-wide break-all text-stone-900">{groupDigits(value)}</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(digits);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // portapapeles no disponible: el cliente puede seleccionar el texto
          }
        }}
        className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700"
      >
        {copied ? t.bank.copied : t.bank.copy}
      </button>
    </div>
  );
}

/** Datos bancarios del negocio para pagar por transferencia. */
export function BankDetails({ bank, total, orderId }: { bank: BankInfo; total?: string; orderId?: number }) {
  const { t } = useI18n();

  if (!hasBankInfo(bank)) {
    return <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">{t.bank.missing}</p>;
  }

  return (
    <div className="space-y-2 rounded-xl bg-sky-50 p-4 text-sm ring-1 ring-sky-200">
      <p className="font-extrabold text-sky-950">🏦 {t.bank.title}</p>
      {total && <p className="text-sky-900">{t.bank.amount(total)}</p>}
      {(bank.bankName || bank.bankAccountHolder) && (
        <p className="text-stone-700">
          {bank.bankName && (
            <>
              <span className="font-semibold">{t.bank.bank}:</span> {bank.bankName}
            </>
          )}
          {bank.bankName && bank.bankAccountHolder && " · "}
          {bank.bankAccountHolder && (
            <>
              <span className="font-semibold">{t.bank.holder}:</span> {bank.bankAccountHolder}
            </>
          )}
        </p>
      )}
      {bank.bankAccount && <CopyRow label={t.bank.account} value={bank.bankAccount} />}
      {bank.bankClabe && <CopyRow label={t.bank.clabe} value={bank.bankClabe} />}
      {bank.bankCard && <CopyRow label={t.bank.card} value={bank.bankCard} />}
      <p className="font-semibold text-sky-900">{orderId ? t.bank.reference(orderId) : t.bank.referenceLater}</p>
      {bank.bankNote && <p className="text-stone-600">{bank.bankNote}</p>}
    </div>
  );
}
