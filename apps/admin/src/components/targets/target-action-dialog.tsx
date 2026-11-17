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
    placeholder: "Masalan: Reel uchun reklama yoqilgani aniqlandi, takrorlansa diskvalifikatsiya",
    describe: (name) => (
      <>
        <strong className="font-medium text-slate-900">{name}</strong> &quot;Ogohlantirilgan&quot;
        holatiga o&apos;tadi va ilovada (hamda Telegramda) ogohlantirish oladi. Reytingda qoladi.
      </>
    ),
    successMessage: (name) => `${name} ogohlantirildi.`,
  },
  disqualify: {
    title: "Target uchun diskvalifikatsiya",
    confirmLabel: "Diskvalifikatsiya qilish",
    variant: "danger",
    placeholder: "Masalan: Reklama Instagram API va skrinshot bilan tasdiqlandi",
    describe: (name) => (
      <>
        <strong className="font-medium text-slate-900">{name}</strong> tanlovdan chetlatiladi:
        reytingdan chiqariladi va g&apos;olib bo&apos;la olmaydi.{" "}
        <strong className="font-medium text-red-700">
          Bu qarorni panel orqali bekor qilib bo&apos;lmaydi.
        </strong>
      </>
    ),
    successMessage: (name) => `${name} diskvalifikatsiya qilindi.`,
  },
  dismiss: {
    title: "Ro'yxatdan chiqarish",
    confirmLabel: "Ro'yxatdan chiqarish",
    variant: "primary",
    placeholder: "Masalan: O'sish organik — Reel mashhur sahifada ulashilgan",
    describe: (name) => (
      <>
        Signal yolg&apos;on deb topiladi:{" "}
        <strong className="font-medium text-slate-900">{name}</strong> &quot;Target
        yoqqanlar&quot; ro&apos;yxatidan chiqariladi. Ishtirokchining holati o&apos;zgarmaydi.
      </>
    ),
    successMessage: (name) => `${name} ro'yxatdan chiqarildi.`,
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
  const name = `${item.participant.firstName} ${item.participant.lastName}`;

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
  disqualify: "Diskvalifikatsiya qilish",
  dismiss: "Ro'yxatdan chiqarish",
};
