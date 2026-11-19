"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { IosIcon } from "@/components/ui/ios-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { getContestSettings } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";

import { RulesEditor } from "./rules-editor";
import { SettingsForm } from "./settings-form";

const NOTICE_TIMEOUT_MS = 5000;

export function SettingsView() {
  const { data, error, isPending, isError, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: getContestSettings,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [saved]);

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

  return (
    <div className="max-w-5xl space-y-4">
      <div role="status" aria-live="polite">
        {saved && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            Sozlamalar saqlandi.
          </div>
        )}
      </div>
      {/* Saqlangandan keyin forma yangi qiymatlardan qayta boshlanadi. */}
      <SettingsForm
        key={data.settings.updatedAt ?? "initial"}
        data={data}
        onSaved={() => setSaved(true)}
      />
      <RulesEditor />
    </div>
  );
}
