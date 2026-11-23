"use client";

import { useQueryClient } from "@tanstack/react-query";

import { ReasonDialog } from "@/components/ui/reason-dialog";
import { removeStory } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import type { AdminStoryItem, AdminStoryListResponse } from "@/lib/types";

interface StoryRemoveDialogProps {
  story: AdminStoryItem;
  onClose: () => void;
  onDone: (message: string) => void;
}

/** Istoriyani sabab bilan o'chirish (sabab 5–500 belgi, audit logga `story.remove` bo'lib yoziladi). */
export function StoryRemoveDialog({ story, onClose, onDone }: StoryRemoveDialogProps) {
  const queryClient = useQueryClient();
  const name = story.participant.fullName;

  return (
    <ReasonDialog
      title="Istoriyani o'chirish"
      description={
        <>
          <strong className="font-medium text-slate-900">{name}</strong> istoriyasi Mini App va
          saytdan darhol olib tashlanadi. Buni qaytarib bo&apos;lmaydi.
        </>
      }
      confirmLabel="O'chirish"
      variant="danger"
      placeholder="Masalan: videoda nomaqbul so'zlar bor"
      onConfirm={async (reason) => {
        try {
          await removeStory(story.id, reason);
        } catch (error) {
          // Muddati tugagan yoki boshqa xodim o'chirgan — ro'yxat ham yangilansin.
          if (error instanceof ApiError && error.status === 404) {
            void queryClient.invalidateQueries({ queryKey: ["stories"] });
          }
          throw error;
        }
        // Karta qayta so'rovni kutmasdan darhol yo'qoladi; ro'yxat va audit log fonda yangilanadi.
        queryClient.setQueriesData<AdminStoryListResponse>({ queryKey: ["stories"] }, (old) =>
          old
            ? {
                ...old,
                items: old.items.filter((item) => item.id !== story.id),
                total: Math.max(0, old.total - 1),
              }
            : old,
        );
        void queryClient.invalidateQueries({ queryKey: ["stories"] });
        void queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      }}
      onClose={onClose}
      onDone={() => onDone(`${name} istoriyasi o'chirildi.`)}
    />
  );
}
