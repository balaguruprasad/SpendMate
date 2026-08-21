"use client";

/** TanStack Query hooks for SpendMate. Mutations invalidate the coarse
 * `spend.all` key — one edit touches rows, summary and context alike. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { queryKeys } from "@/lib/api/query-keys";
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
