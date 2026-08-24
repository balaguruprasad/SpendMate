"use client";

/**
 * Cards — who owns which company card. Statement rows are matched to a
 * cardholder by number (exact or last-4); changing cards re-matches every
 * transaction automatically. Reminders can be muted per card.
 */
import { useState } from "react";
import { CreditCard, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { useUsers } from "@/features/users";
import {
  useCreateCard,
  useDeleteCard,
  useSpendCards,
  useUpdateCard,
  type SpendCard,
} from "@/features/spend";

export function CardsView() {
  const { data: cards, isLoading } = useSpendCards();
  const usersQuery = useUsers({ activeOnly: true });
  const users = usersQuery.data ?? [];
  const create = useCreateCard();
  const update = useUpdateCard();
  const remove = useDeleteCard();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SpendCard | null>(null);
  const [holderId, setHolderId] = useState("");
  const [number, setNumber] = useState("");
  const [label, setLabel] = useState("");
  const [remindersOn, setRemindersOn] = useState(true);
  const [deleting, setDeleting] = useState<SpendCard | null>(null);

  function openCreate() {
    setEditing(null);
    setHolderId("");
    setNumber("");
    setLabel("");
    setRemindersOn(true);
    setDialogOpen(true);
  }

  function openEdit(card: SpendCard) {
    setEditing(card);
    setHolderId(card.holderId);
    setNumber(card.number);
    setLabel(card.label);
    setRemindersOn(card.remindersOn);
    setDialogOpen(true);
  }

  function save() {
    const done = () => setDialogOpen(false);
    if (editing) {
      update.mutate(
        { id: editing.id, patch: { holderId, number, label, remindersOn } },
        { onSuccess: done },
      );
    } else {
      create.mutate({ holderId, number, label, remindersOn }, { onSuccess: done });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administration"
        title="Cards"
        description="Company cards and their holders. Statement rows match by full number or last 4 digits — changes here re-link existing charges automatically."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Add card
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : (cards ?? []).length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No cards yet"
          description="Add each company card and its holder so imported charges land with the right person."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Cardholder</TableHead>
                <TableHead>Card number</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Reminders</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(cards ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <span className="font-medium">{c.holderName}</span>
                    <span className="block text-xs text-muted-foreground">{c.holderEmail}</span>
                  </TableCell>
                  <TableCell className="font-mono">
                    {c.number.length > 4 ? `•••• ${c.number.slice(-4)}` : `•••• ${c.number}`}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.label || "—"}</TableCell>
                  <TableCell>
                    <StatusBadge
                      label={c.remindersOn ? "On" : "Muted"}
                      tone={c.remindersOn ? "success" : "muted"}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Edit card"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Delete card"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(c)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit card" : "Add card"}</DialogTitle>
            <DialogDescription>
              The number can be the full card number or just the last 4 digits — statement rows
              match either way.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Cardholder</Label>
              <Select value={holderId} onValueChange={setHolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick the user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} — {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="card-number">Card number / last 4</Label>
                <Input
                  id="card-number"
                  value={number}
                  placeholder="4315"
                  onChange={(e) => setNumber(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="card-label">Label (optional)</Label>
                <Input
                  id="card-label"
                  value={label}
                  placeholder="Corporate Visa"
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <Switch checked={remindersOn} onCheckedChange={setRemindersOn} />
              Send this cardholder pending-charge reminders
            </label>
          </div>
          <DialogFooter>
            <Button
              disabled={!holderId || number.replace(/\D/g, "").length < 2}
              loading={create.isPending || update.isPending}
              onClick={save}
            >
              {editing ? "Save changes" : "Add card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove this card?"
        description="Its charges stay but show as Unassigned until another card matches them."
        confirmLabel="Remove card"
        destructive
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
