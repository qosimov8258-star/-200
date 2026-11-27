"use client";

import { useQueryClient } from "@tanstack/react-query";

import { ReasonDialog } from "@/components/ui/reason-dialog";
import { resolveTargetCase } from "@/lib/api";
import type { TargetAction, TargetCaseListItem } from "@/lib/types";

interface ActionConfig {
  title: string;
  confirmLabel: string;
  variant: "primary" | "danger";
  placeholder: string;
  describe: (name: string) => React.ReactNode;
  successMessage: (name: string) => string;
}

const ACTIONS: Record<TargetAction, ActionConfig> = {
  warn: {
    title: "Ishtirokchini ogohlantirish",
    confirmLabel: "Ogohlantirish",
    variant: "primary",
    placeholder: "Masalan: videoga reklama yoqilgani aniqlandi, takrorlansa tanlovdan chetlatiladi",
    describe: (name) => (
      <>
        <strong className="font-medium text-slate-900">{name}</strong> «Ogohlantirilgan» holatiga
        o&apos;tadi va ilovada (hamda Telegramda) ogohlantirish oladi. Reytingda qoladi.
      </>
    ),
    successMessage: (name) => `${name} ogohlantirildi.`,
  },
  disqualify: {
    title: "Tanlovdan chetlatish",
    confirmLabel: "Tanlovdan chetlatish",
    variant: "danger",
    placeholder: "Masalan: skrinshotda «Reklama» belgisi aniq ko'rinadi",
    describe: (name) => (
      <>
        <strong className="font-medium text-slate-900">{name}</strong> tanlovdan chetlatiladi:
        reytingdan chiqariladi va g&apos;olib bo&apos;la olmaydi.{" "}
        <strong className="font-medium text-red-700">
          Bu qarorni panel orqali bekor qilib bo&apos;lmaydi.
        </strong>
      </>
    ),
    successMessage: (name) => `${name} tanlovdan chetlatildi.`,
  },
  dismiss: {
    title: "Bu xato signalmi?",
    confirmLabel: "Xato signal — yopish",
    variant: "primary",
    placeholder: "Masalan: ko'rishlar tabiiy o'sgan — video mashhur sahifada ulashilgan",
    describe: (name) => (
      <>
        Signal xato deb belgilanadi va{" "}
        <strong className="font-medium text-slate-900">{name}</strong> shu ro&apos;yxatdan olinadi.
        Ishtirokchiga hech narsa bo&apos;lmaydi: holati o&apos;zgarmaydi, xabar bormaydi.
      </>
    ),
    successMessage: (name) => `${name}: signal xato deb yopildi.`,
  },
};

interface TargetActionDialogProps {
  item: TargetCaseListItem;
  action: TargetAction;
  onClose: () => void;
  onDone: (message: string) => void;
}

export function TargetActionDialog({ item, action, onClose, onDone }: TargetActionDialogProps) {
  const queryClient = useQueryClient();
  const config = ACTIONS[action];
  const name = targetParticipantName(item) || "Ismsiz ishtirokchi";

  return (
    <ReasonDialog
      title={config.title}
      description={config.describe(name)}
      confirmLabel={config.confirmLabel}
      variant={config.variant}
      placeholder={config.placeholder}
      onConfirm={async (reason) => {
        await resolveTargetCase(item.id, { action, reason });
        // Qaror ishtirokchi holati, reyting va dashboardga ham ta'sir qiladi.
        await Promise.all(
          ["target-cases", "target-case", "participants", "daily-rating", "dashboard"].map((key) =>
            queryClient.invalidateQueries({ queryKey: [key] }),
          ),
        );
      }}
      onClose={onClose}
      onDone={() => onDone(config.successMessage(name))}
    />
  );
}

/** Ishtirokchi ismi: familiya endi so'ralmaydi (bo'sh bo'lishi mumkin) — ortiqcha bo'shliqsiz. */
export function targetParticipantName(item: TargetCaseListItem): string {
  return `${item.participant.firstName} ${item.participant.lastName}`.trim();
}

/** Target holati va ishtirokchi holatiga qarab mumkin bo'lgan amallar. */
export function availableTargetActions(item: TargetCaseListItem): TargetAction[] {
  if (item.status === "NEW") {
    return item.participant.status === "DISQUALIFIED"
      ? ["dismiss"]
      : ["warn", "disqualify", "dismiss"];
  }
  if (item.status === "WARNED") {
    return item.participant.status === "DISQUALIFIED" ? ["dismiss"] : ["disqualify", "dismiss"];
  }
  return [];
}

export const TARGET_ACTION_LABELS: Record<TargetAction, string> = {
  warn: "Ogohlantirish",
  disqualify: "Tanlovdan chetlatish",
  dismiss: "Xato signal — yopish",
};

/** Har bir qarorning oqibati — dalil oynasida tugma yonida bir qatorda. */
export const TARGET_ACTION_CONSEQUENCES: Record<TargetAction, string> = {
  warn: "Reytingda qoladi, ilovada va botda ogohlantirish oladi.",
  disqualify: "Reytingdan chiqadi, g'olib bo'la olmaydi. Qaytarib bo'lmaydi.",
  dismiss: "Ro'yxatdan olinadi, ishtirokchiga hech narsa bo'lmaydi.",
};
