"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Film,
  HardDrive,
  RefreshCw,
  Trash2,
  Upload,
  VideoOff,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IosIcon } from "@/components/ui/ios-icon";
import { Spinner } from "@/components/ui/spinner";
import { deleteRulesVideo, getRulesVideo, rulesVideoUrl, uploadRulesVideo } from "@/lib/api";
import { ApiError, errorMessage } from "@/lib/api-error";
import { formatDateTime, formatFileSize } from "@/lib/format";
import { VIDEO_MIME_LABELS } from "@/lib/labels";
import { rulesVideoFileError } from "@/lib/rules-video";
import { RULES_VIDEO_LIMITS, type RulesVideo } from "@/lib/types";

/** Qoidalar muharriridagi telefon ko'rinishi ham shu kalit bilan o'qiydi. */
export const RULES_VIDEO_QUERY_KEY = ["rules-video"] as const;

/** Fayl tanlash oynasi: avval qo'llab-quvvatlanadigan turlar, keyin istalgan video (tur tekshiriladi). */
const ACCEPT = "video/mp4,video/quicktime,video/webm,video/*";
const NOTICE_TIMEOUT_MS = 5000;
const MAX_SIZE_LABEL = formatFileSize(RULES_VIDEO_LIMITS.maxBytes);

type Notice = "uploaded" | "replaced" | "deleted";

const NOTICE_TEXT: Record<Notice, string> = {
  uploaded: "Video yuklandi — ishtirokchilar uni ilovadagi Qoidalar bo'limida ko'radi.",
  replaced: "Video almashtirildi — ishtirokchilar endi yangisini ko'radi.",
  deleted: "Video o'chirildi — ilovada endi faqat qoidalar matni ko'rinadi.",
};

interface UploadRequest {
  file: File;
  /** Oldin video bor edi — xabar "almashtirildi" bo'ladi. */
  replacing: boolean;
}

function uploadErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    // nginx 413 ni HTML sahifa bilan qaytarishi mumkin — har qanday 413 "juda katta" degani.
    if (error.status === 413) {
      return `Video juda katta. Ko'pi bilan ${MAX_SIZE_LABEL} yuklash mumkin.`;
    }
    if (error.status === 422) {
      return "Faylni video sifatida o'qib bo'lmadi: u MP4, MOV yoki WebM emas yoki buzilgan. Boshqa video tanlang.";
    }
  }
  return errorMessage(error);
}

/**
 * Sozlamalar → Qoida videosi (Mini App'dagi Qoidalar bo'limida eng tepada).
 * Yuklash, almashtirish (eskisi o'chiriladi) va o'chirish; yuklash jarayoni foizda ko'rsatiladi.
 */
export function RulesVideoCard() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: video, error, isPending, isError, refetch } = useQuery({
    queryKey: RULES_VIDEO_QUERY_KEY,
    queryFn: getRulesVideo,
  });
  const [progress, setProgress] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const upload = useMutation({
    mutationFn: ({ file }: UploadRequest) => uploadRulesVideo(file, setProgress),
    onSuccess: async (uploaded, { replacing }) => {
      queryClient.setQueryData(RULES_VIDEO_QUERY_KEY, uploaded);
      setNotice(replacing ? "replaced" : "uploaded");
      await queryClient.invalidateQueries({ queryKey: ["audit-log"] });
    },
  });
  const uploading = upload.isPending;

  function pickFile() {
    inputRef.current?.click();
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Shu faylni qayta tanlash ham `change` bersin.
    event.target.value = "";
    if (!file || uploading) return;

    setNotice(null);
    upload.reset();
    const problem = rulesVideoFileError(file);
    setFileError(problem);
    if (problem) return;

    setProgress(0);
    upload.mutate({ file, replacing: Boolean(video) });
  }

  const errorText = fileError ?? (upload.isError ? uploadErrorText(upload.error) : null);
  const percent = Math.round(progress * 100);
  const uploadingFile = upload.variables?.file;

  let body: React.ReactNode;
  if (isPending) {
    body = (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  } else if (isError) {
    body = (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <IosIcon icon={AlertTriangle} tint="orange" size={40} />
        <p className="text-sm text-slate-600">{errorMessage(error)}</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Qayta urinish
        </Button>
      </div>
    );
  } else if (video) {
    body = (
      <div className="grid gap-4 sm:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        {/* Har yuklashda `id` yangi — oldingi videoning xato holati qolmasin. */}
        <VideoPreview key={video.id} video={video} onRetry={() => refetch()} />
        <div className="flex min-w-0 flex-col gap-4">
          <dl className="space-y-1.5 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <dt>
                <HardDrive className="size-4 text-slate-400" aria-hidden />
                <span className="sr-only">Hajmi</span>
              </dt>
              <dd className="tabular-nums">
                {formatFileSize(video.sizeBytes)} · {VIDEO_MIME_LABELS[video.mime] ?? video.mime}
              </dd>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <dt className="flex items-center gap-2">
                <Clock className="size-4 text-slate-400" aria-hidden />
                Yuklangan:
              </dt>
              <dd className="min-w-0">
                <time dateTime={video.updatedAt} className="tabular-nums">
                  {formatDateTime(video.updatedAt)}
                </time>{" "}
                · {video.updatedBy}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2 sm:mt-auto">
            <Button variant="secondary" onClick={pickFile} loading={uploading}>
              {!uploading && <RefreshCw className="size-4" aria-hidden />}
              Almashtirish
            </Button>
            <Button
              variant="secondary"
              onClick={() => setConfirmingDelete(true)}
              disabled={uploading}
              className="text-red-600 hover:border-red-200 hover:bg-red-50"
            >
              <Trash2 className="size-4" aria-hidden />
              O&apos;chirish
            </Button>
          </div>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center">
        <IosIcon icon={Film} tint="gray" size={40} />
        <p className="max-w-md text-sm text-slate-600">
          Video hali yuklanmagan — ilovada faqat qoidalar matni ko&apos;rinadi.
        </p>
        <Button onClick={pickFile} loading={uploading}>
          {!uploading && <Upload className="size-4" aria-hidden />}
          Video yuklash
        </Button>
      </div>
    );
  }

  return (
    // Sarlavha ("Qoida videosi") — Sozlamalar sahifasidagi bo'lim sarlavhasida.
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <p className="flex min-w-0 flex-1 items-start gap-2 text-sm text-slate-600">
            <IosIcon icon={Film} tint="purple" size={22} />
            <span>
              Ilovadagi Qoidalar bo&apos;limida eng tepada, qoidalar matnidan oldin ko&apos;rinadi.
              MP4, MOV yoki WebM, ko&apos;pi bilan {MAX_SIZE_LABEL}. Yangisi yuklansa, eskisi
              o&apos;chiriladi.
            </span>
          </p>
          {!isPending && !isError && (
            <Badge tone={video ? "success" : "neutral"}>{video ? "Ilovada ko'rinadi" : "Yuklanmagan"}</Badge>
          )}
        </div>

        {body}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          tabIndex={-1}
          onChange={handleFile}
        />

        {uploading && (
          <div className="space-y-2 rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-ink">
                {progress < 1 ? "Yuklanmoqda…" : "Saqlanmoqda…"}
                {uploadingFile && (
                  <span className="text-slate-500">
                    {" "}
                    {uploadingFile.name} · {formatFileSize(uploadingFile.size)}
                  </span>
                )}
              </span>
              <span className="font-medium text-brand-700 tabular-nums">{percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Video yuklanmoqda"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-2 overflow-hidden rounded-full bg-brand-100"
            >
              <div
                className="h-full rounded-full bg-brand-500 transition-[width] duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        {errorText && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{errorText}</span>
          </div>
        )}

        <div role="status" aria-live="polite">
          {notice && (
            <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              {NOTICE_TEXT[notice]}
            </div>
          )}
        </div>
      </CardContent>

      {confirmingDelete && (
        <ConfirmDialog
          title="Qoida videosi o'chirilsinmi?"
          description="Video ilovadagi Qoidalar bo'limidan darhol yo'qoladi. Keyin yangisini yuklash mumkin."
          confirmLabel="O'chirish"
          variant="danger"
          onConfirm={deleteRulesVideo}
          onClose={() => setConfirmingDelete(false)}
          onDone={async () => {
            setConfirmingDelete(false);
            queryClient.setQueryData(RULES_VIDEO_QUERY_KEY, null);
            upload.reset();
            setFileError(null);
            setNotice("deleted");
            await queryClient.invalidateQueries({ queryKey: ["audit-log"] });
          }}
        />
      )}
    </Card>
  );
}

/** Videoni ko'rish: boshqaruvlar bilan, faqat metadata oldindan yuklanadi. */
function VideoPreview({ video, onRetry }: { video: RulesVideo; onRetry: () => void }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex min-h-44 items-center justify-center overflow-hidden rounded-xl bg-slate-900">
      {failed ? (
        <div className="flex flex-col items-center gap-3 px-6 py-8 text-center text-sm text-white/70">
          <VideoOff className="size-6" aria-hidden />
          <span>
            Videoni ko&apos;rsatib bo&apos;lmadi: u almashtirilgan bo&apos;lishi yoki brauzer bu formatni
            ochmasligi mumkin.
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setFailed(false);
              onRetry();
            }}
          >
            Qayta urinish
          </Button>
        </div>
      ) : (
        <video
          src={rulesVideoUrl(video.id)}
          controls
          preload="metadata"
          playsInline
          onError={() => setFailed(true)}
          aria-label="Qoida videosi"
          className="max-h-[420px] w-full object-contain"
        />
      )}
    </div>
  );
}
