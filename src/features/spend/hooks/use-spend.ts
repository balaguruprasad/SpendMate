"use client";

/** TanStack Query hooks for SpendMate. Mutations invalidate the coarse
 * `spend.all` key — one edit touches rows, summary and context alike. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/http-error";
import type { UploadedFile } from "@/features/attachments";
import * as service from "../services/spend.service";
import type { ImportRow, SpendSettings } from "../types";

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function useInvalidateSpend() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.spend.all });
}

export function useSpendMe() {
  return useQuery({ queryKey: queryKeys.spend.me(), queryFn: service.getMe });
}

export function useSpendTransactions() {
  return useQuery({
    queryKey: queryKeys.spend.transactions(),
    queryFn: service.listTransactions,
  });
}

export function useUpdateTransaction() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { category?: string; remarks?: string; tags?: string };
    }) => service.updateTransaction(id, patch),
    onSuccess: () => {
      void invalidate();
      toast.success("Charge updated.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not update the charge.")),
  });
}

export function useAttachInvoice() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: UploadedFile }) =>
      service.attachInvoice(id, file),
    onSuccess: () => {
      void invalidate();
      toast.success("Invoice attached — charge marked Submitted.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not attach the invoice.")),
  });
}

export function useImportTransactions() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (rows: ImportRow[]) => service.importTransactions(rows),
    onSuccess: (r) => {
      void invalidate();
      toast.success(
        `Imported ${r.imported} row(s)` +
          (r.autoCategorized ? ` — ${r.autoCategorized} auto-categorized` : "") +
          ".",
      );
    },
    onError: (error) => toast.error(errorMessage(error, "Import failed.")),
  });
}

export function useSpendCards() {
  return useQuery({ queryKey: queryKeys.spend.cards(), queryFn: service.listCards });
}

export function useCreateCard() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: service.createCard,
    onSuccess: () => {
      void invalidate();
      toast.success("Card added.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not add the card.")),
  });
}

export function useUpdateCard() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { holderId?: string; number?: string; label?: string; remindersOn?: boolean };
    }) => service.updateCard(id, patch),
    onSuccess: () => {
      void invalidate();
      toast.success("Card updated.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not update the card.")),
  });
}

export function useDeleteCard() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (id: string) => service.deleteCard(id),
    onSuccess: () => {
      void invalidate();
      toast.success("Card removed.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not remove the card.")),
  });
}

export function useAddHelper() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (email: string) => service.addHelper(email),
    onSuccess: () => {
      void invalidate();
      toast.success("Helper added — they can now see and complete your charges.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not add the helper.")),
  });
}

export function useRemoveHelper() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (helperId: string) => service.removeHelper(helperId),
    onSuccess: () => {
      void invalidate();
      toast.success("Helper removed.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not remove the helper.")),
  });
}

export function useSpendSettings() {
  return useQuery({ queryKey: queryKeys.spend.settings(), queryFn: service.getSettings });
}

export function useSaveSettings() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (input: SpendSettings) => service.saveSettings(input),
    onSuccess: () => {
      void invalidate();
      toast.success("Settings saved.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not save settings.")),
  });
}

export function useReminderInfo() {
  return useQuery({ queryKey: queryKeys.spend.reminders(), queryFn: service.reminderInfo });
}

export function useSendReminders() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (userIds: string[] = []) => service.sendReminders(userIds),
    onSuccess: (r) => {
      void invalidate();
      toast.success(
        r.sent.length
          ? `Reminders sent to ${r.sent.length} cardholder(s).`
          : "Nobody has pending charges — no reminders needed.",
      );
    },
    onError: (error) => toast.error(errorMessage(error, "Could not send reminders.")),
  });
}

/** The G-Sheet-style avatar bar: ping every 25s; drop off after ~75s. */
export function usePresence() {
  return useQuery({
    queryKey: queryKeys.spend.presence(),
    queryFn: service.presencePing,
    refetchInterval: 25_000,
    refetchIntervalInBackground: false,
  });
}

export function useLoginActivity() {
  return useQuery({
    queryKey: queryKeys.spend.logins(),
    queryFn: service.loginActivity,
    refetchInterval: 30_000,
  });
}

export function useSetReviewed() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => service.setReviewed(id, on),
    onSuccess: (_r, { on }) => {
      void invalidate();
      toast.success(on ? "Marked reviewed — accounting done." : "Review cleared.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not update the review flag.")),
  });
}

export function useSetWeeklyReminders() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (on: boolean) => service.setWeeklyReminders(on),
    onSuccess: (r) => {
      void invalidate();
      toast.success(r.on ? "Weekly auto-reminder is ON (Mondays ~9:00)." : "Weekly auto-reminder turned off.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not change the schedule.")),
  });
}

/** Open an invoice in a new tab WITH auth: fetch as blob via the API client's
 * bearer token, then show the object URL (a bare link has no Authorization
 * header and gets a 401). The tab must be opened synchronously inside the
 * click gesture — window.open after an await gets popup-blocked — so we open
 * a blank tab first and navigate it once the blob arrives. */
export async function openInvoice(invoiceUrl: string): Promise<void> {
  if (!invoiceUrl.startsWith("/api")) {
    window.open(invoiceUrl, "_blank", "noopener");
    return;
  }
  const win = window.open("", "_blank");
  try {
    const blob = await api.getBlob(invoiceUrl.replace(/^\/api\/v1/, ""));
    const url = URL.createObjectURL(blob);
    if (win) win.location.href = url;
    else window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    win?.close();
    toast.error(error instanceof Error ? error.message : "Could not open the invoice.");
  }
}
