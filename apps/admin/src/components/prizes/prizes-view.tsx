"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, CheckCircle2, Gift, Info, Plus } from "lucide-react";

import { IosIcon } from "@/components/ui/ios-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { deletePrize, getPrizes, movePrize } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatNumber } from "@/lib/format";
import { PRIZE_KINDS } from "@/lib/prize-rules";
import type { Prize, PrizeKind, PrizeMoveDirection } from "@/lib/types";

import { PrizeCard } from "./prize-card";
import { PrizeFormDialog } from "./prize-form-dialog";

const NOTICE_TIMEOUT_MS = 5000;

const SECTION_TITLES: Record<PrizeKind, string> = {
  MAIN: "Asosiy sovrinlar",
  MONTHLY: "Oylik sovrinlar",
};

const SECTION_HINTS: Record<PrizeKind, string> = {
  MAIN: "Aksiya yakunida umumiy tasdiqlangan ko'rishlar bo'yicha beriladi.",
  MONTHLY: "Har oylik bosqich yakunida beriladi.",
};

type DialogState =
  | { type: "create" }
  | { type: "edit"; prize: Prize }
  | { type: "delete"; prize: Prize }
  | null;

/** Aksiya sovg'alari: rasm, nom, soni va ko'rishlar sharti. Ilova va botda shu tartibda chiqadi. */
export function PrizesView() {
  const queryClient = useQueryClient();
  const { data, error, isPending, isError, refetch } = useQuery({
    queryKey: ["prizes"],
    queryFn: getPrizes,
  });
  const [dialog, setDialog] = useState<DialogState>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const moveMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: PrizeMoveDirection }) =>
      movePrize(id, { direction }),
    onSuccess: async (prizes) => {
      queryClient.setQueryData(["prizes"], prizes);
      await queryClient.invalidateQueries({ queryKey: ["audit-log"] });
    },
  });

  if (isPending) {
    return (
      <Card className="flex justify-center py-16">
        <Spinner />
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="flex flex-col items-center gap-3 px-4 py-12 text-center">
        <IosIcon icon={AlertTriangle} tint="orange" size={48} />
        <p className="text-sm text-slate-600">{errorMessage(error)}</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Qayta urinish
        </Button>
      </Card>
    );
  }

  const totalItems = data.reduce((sum, prize) => sum + prize.quantity, 0);
  const sections = PRIZE_KINDS.map((kind) => ({
    kind,
    prizes: data.filter((prize) => prize.kind === kind),
  })).filter((section) => section.prizes.length > 0);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Sovg&apos;alar ro&apos;yxati</CardTitle>
            <p className="mt-0.5 text-sm text-slate-500">
              {data.length > 0
                ? `Jami: ${formatNumber(data.length)} xil sovg'a, ${formatNumber(totalItems)} dona (oylik sovrinlar bir oy uchun).`
                : "Hali sovg'a qo'shilmagan."}
            </p>
          </div>
          <Button size="sm" onClick={() => setDialog({ type: "create" })} className="self-start sm:self-auto">
            <Plus className="size-4" aria-hidden />
            Sovg&apos;a qo&apos;shish
          </Button>
        </CardHeader>

        <CardContent className="space-y-5">
          <p className="flex items-start gap-2 text-xs text-slate-500">
            <IosIcon icon={Info} tint="blue" size={20} />
            <span>
              Sovg&apos;alar ilovadagi va Telegram botdagi &quot;Sovg&apos;alar&quot; bo&apos;limida shu
              tartibda ko&apos;rsatiladi. Tartibni sovg&apos;a menyusidagi &quot;Yuqoriga / Pastga
              surish&quot; bilan o&apos;zgartiring.
            </span>
          </p>

          {(notice || moveMutation.isError) && (
            <div className="space-y-2">
              <div role="status" aria-live="polite">
                {notice && (
                  <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                    <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                    {notice}
                  </div>
                )}
              </div>
              {moveMutation.isError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {errorMessage(moveMutation.error)}
                </div>
              )}
            </div>
          )}

          {sections.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-12 text-center">
              <IosIcon icon={Gift} tint="gray" size={48} />
              <p className="text-sm text-slate-500">
                Birinchi sovg&apos;ani qo&apos;shing: rasmini yuklang, nomini va sonini yozing.
              </p>
              <Button size="sm" onClick={() => setDialog({ type: "create" })}>
                <Plus className="size-4" aria-hidden />
                Sovg&apos;a qo&apos;shish
              </Button>
            </div>
          ) : (
            sections.map(({ kind, prizes }, sectionIndex) => (
              <section
                key={kind}
                aria-labelledby={`prizes-${kind}`}
                className={sectionIndex > 0 ? "space-y-3 border-t border-slate-200 pt-5" : "space-y-3"}
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <h3 id={`prizes-${kind}`} className="text-sm font-semibold text-slate-900">
                    {SECTION_TITLES[kind]}{" "}
                    <span className="font-normal text-slate-500">({prizes.length})</span>
                  </h3>
                  <p className="text-xs text-slate-500">{SECTION_HINTS[kind]}</p>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))] gap-3">
                  {prizes.map((prize, index) => (
                    <PrizeCard
                      key={prize.id}
                      prize={prize}
                      isFirst={index === 0}
                      isLast={index === prizes.length - 1}
                      busy={moveMutation.isPending}
                      onEdit={() => setDialog({ type: "edit", prize })}
                      onDelete={() => setDialog({ type: "delete", prize })}
                      onMove={(direction) => moveMutation.mutate({ id: prize.id, direction })}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </CardContent>
      </Card>

      {(dialog?.type === "create" || dialog?.type === "edit") && (
        <PrizeFormDialog
          prize={dialog.type === "edit" ? dialog.prize : undefined}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            setNotice(
              dialog.type === "edit"
                ? `"${saved.title}" saqlandi.`
                : `"${saved.title}" sovg'alar ro'yxatiga qo'shildi.`,
            );
            setDialog(null);
          }}
        />
      )}

      {dialog?.type === "delete" && (
        <ConfirmDialog
          title="Sovg'ani o'chirish"
          description={
            <>
              <strong>{dialog.prize.title}</strong> ro&apos;yxatdan o&apos;chiriladi va ilova hamda
              botda ko&apos;rinmay qoladi.
            </>
          }
          confirmLabel="O'chirish"
          variant="danger"
          onConfirm={() => deletePrize(dialog.prize.id)}
          onClose={() => setDialog(null)}
          onDone={async () => {
            const title = dialog.prize.title;
            setDialog(null);
            setNotice(`"${title}" o'chirildi.`);
            await Promise.all(
              ["prizes", "audit-log"].map((key) =>
                queryClient.invalidateQueries({ queryKey: [key] }),
              ),
            );
          }}
        />
      )}
    </>
  );
}
