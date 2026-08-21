import { api } from "@/lib/api/client";
import type { UploadedFile } from "@/features/attachments";
import type {
  ImportRow,
  SpendCard,
  SpendHelper,
  SpendMe,
  SpendSettings,
  SpendTransaction,
  SpendTransactionsResponse,
} from "../types";

type Enveloped<T> = { data: T };

export async function getMe(): Promise<SpendMe> {
  return (await api.get<Enveloped<SpendMe>>("/spend/me")).data;
}

export async function listTransactions(): Promise<SpendTransactionsResponse> {
  return (await api.get<Enveloped<SpendTransactionsResponse>>("/spend/transactions")).data;
}

export async function updateTransaction(
  id: string,
  patch: { category?: string; remarks?: string; tags?: string },
): Promise<SpendTransaction> {
  return (await api.patch<Enveloped<SpendTransaction>>(`/spend/transactions/${id}`, patch)).data;
}

export async function attachInvoice(id: string, file: UploadedFile): Promise<SpendTransaction> {
  return (await api.post<Enveloped<SpendTransaction>>(`/spend/transactions/${id}/invoice`, file))
    .data;
}

export async function importTransactions(
  rows: ImportRow[],
): Promise<{ imported: number; autoCategorized: number }> {
  return (
    await api.post<Enveloped<{ imported: number; autoCategorized: number }>>(
      "/spend/transactions/import",
      { rows },
    )
  ).data;
}

export async function listCards(): Promise<SpendCard[]> {
  return (await api.get<Enveloped<SpendCard[]>>("/spend/cards")).data;
}

export async function createCard(input: {
  holderId: string;
  number: string;
  label: string;
  remindersOn: boolean;
}): Promise<SpendCard> {
  return (await api.post<Enveloped<SpendCard>>("/spend/cards", input)).data;
}

export async function updateCard(
  id: string,
  patch: { holderId?: string; number?: string; label?: string; remindersOn?: boolean },
): Promise<SpendCard> {
  return (await api.patch<Enveloped<SpendCard>>(`/spend/cards/${id}`, patch)).data;
}

export async function deleteCard(id: string): Promise<void> {
  await api.delete(`/spend/cards/${id}`);
}

export async function addHelper(email: string): Promise<SpendHelper[]> {
  const rows = (await api.post<Enveloped<{ helperId: string; helperName: string; helperEmail: string }[]>>(
    "/spend/helpers",
    { email },
  )).data;
  return rows.map((r) => ({ id: r.helperId, name: r.helperName, email: r.helperEmail }));
}

export async function removeHelper(helperId: string): Promise<SpendHelper[]> {
  const rows = (await api.delete<Enveloped<{ helperId: string; helperName: string; helperEmail: string }[]>>(
    `/spend/helpers/${helperId}`,
  )).data;
  return rows.map((r) => ({ id: r.helperId, name: r.helperName, email: r.helperEmail }));
}

export async function getSettings(): Promise<SpendSettings> {
  return (await api.get<Enveloped<SpendSettings>>("/spend/settings")).data;
}

export async function saveSettings(input: SpendSettings): Promise<SpendSettings> {
  return (await api.put<Enveloped<SpendSettings>>("/spend/settings", input)).data;
}

export async function sendReminders(userIds: string[] = []): Promise<{ sent: string[] }> {
  return (await api.post<Enveloped<{ sent: string[] }>>("/spend/reminders/send", { userIds })).data;
}

export async function reminderInfo(): Promise<{ lastRun: { at: string; sent: number } | null; weeklyOn: boolean }> {
  return (
    await api.get<Enveloped<{ lastRun: { at: string; sent: number } | null; weeklyOn: boolean }>>(
      "/spend/reminders",
    )
  ).data;
}

export async function setReviewed(id: string, on: boolean): Promise<SpendTransaction> {
  return (await api.post<Enveloped<SpendTransaction>>(`/spend/transactions/${id}/review`, { on }))
    .data;
}

export async function setWeeklyReminders(on: boolean): Promise<{ on: boolean }> {
  return (await api.put<Enveloped<{ on: boolean }>>("/spend/reminders/weekly", { on })).data;
}

export interface PresenceUser {
  id: string;
  name: string;
  email: string;
}

export async function presencePing(): Promise<{ users: PresenceUser[] }> {
  return (await api.post<Enveloped<{ users: PresenceUser[] }>>("/spend/presence", {})).data;
}

export interface LoginActivityRow {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  isActive: boolean;
  lastLogin: string | null;
  online: boolean;
}

export async function loginActivity(): Promise<LoginActivityRow[]> {
  return (await api.get<Enveloped<LoginActivityRow[]>>("/spend/logins")).data;
}
