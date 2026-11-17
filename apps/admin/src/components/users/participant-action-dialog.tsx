"use client";

import { useQueryClient } from "@tanstack/react-query";

import { ReasonDialog } from "@/components/ui/reason-dialog";
import { blockParticipant, disqualifyParticipant, unblockParticipant } from "@/lib/api";
import type {
  ParticipantAction,
  ParticipantActionRequest,
  ParticipantListItem,
} from "@/lib/types";

import { fullName } from "./users-table";

interface ActionConfig {
  title: string;
  confirmLabel: string;
  variant: "primary" | "danger";
  describe: (name: string) => React.ReactNode;
  successMessage: (name: string) => string;
  run: (id: string, request: ParticipantActionRequest) => Promise<ParticipantListItem>;
}

const ACTIONS: Record<ParticipantAction, ActionConfig> = {
  block: {
    title: "Ishtirokchini bloklash",
    confirmLabel: "Bloklash",
    variant: "danger",
    describe: (name) => (
      <>
        <strong className="font-medium text-slate-900">{name}</strong> ilovaga kira olmaydi va
        reytingdan chiqariladi. Keyinroq blokdan chiqarish mumkin.
      </>
    ),
    successMessage: (name) => `${name} bloklandi.`,
    run: blockParticipant,
  },
  unblock: {
    title: "Blokdan chiqarish",
    confirmLabel: "Blokdan chiqarish",
    variant: "primary",
    describe: (name) => (
      <>
        <strong className="font-medium text-slate-900">{name}</strong> yana ilovadan foydalana
        oladi. Reeli qabul qilingan bo&apos;lsa, reytingga qaytadi.
      </>
    ),
    successMessage: (name) => `${name} blokdan chiqarildi.`,
    run: unblockParticipant,
  },
  disqualify: {
    title: "Diskvalifikatsiya qilish",
    confirmLabel: "Diskvalifikatsiya qilish",
    variant: "danger",
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
    run: disqualifyParticipant,
  },
};

interface ParticipantActionDialogProps {
  participant: ParticipantListItem;
  action: ParticipantAction;
  onClose: () => void;
  onDone: (message: string) => void;
}

export function ParticipantActionDialog({
  participant,
  action,
  onClose,
  onDone,
}: ParticipantActionDialogProps) {
  const queryClient = useQueryClient();
  const config = ACTIONS[action];
  const name = fullName(participant);

  return (
    <ReasonDialog
      title={config.title}
      description={config.describe(name)}
      confirmLabel={config.confirmLabel}
      variant={config.variant}
      placeholder="Masalan: Reel uchun pullik reklama yoqilgan, skrinshot bilan tasdiqlandi"
      onConfirm={async (reason) => {
        await config.run(participant.id, { reason });
        // Holat ro'yxat, reyting, target ro'yxati va dashboardga ta'sir qiladi.
        await Promise.all(
          ["participants", "target-cases", "daily-rating", "dashboard"].map((key) =>
            queryClient.invalidateQueries({ queryKey: [key] }),
          ),
        );
      }}
      onClose={onClose}
      onDone={() => onDone(config.successMessage(name))}
    />
  );
}
