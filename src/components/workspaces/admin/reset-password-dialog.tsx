"use client";

/**
 * Admin "Reset password for <name>" dialog. Collects a new password + a confirm
 * field (min 8, must match) and hands the new password back to the caller, which
 * runs the `useResetUserPassword` mutation. The backend revokes the target's
 * existing sessions, so they must sign in again with the new password.
 */
import { useEffect, useState } from "react";
import type { UserAccount } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/components/shared/password-input";

interface ResetPasswordDialogProps {
  /** The user being reset; the dialog is open while this is non-null. */
  user: UserAccount | null;
  onOpenChange: (open: boolean) => void;
  /** Run the reset with the validated new password. */
  onSubmit: (newPassword: string) => Promise<void>;
  pending?: boolean;
}

export function ResetPasswordDialog({
  user,
  onOpenChange,
  onSubmit,
  pending = false,
}: ResetPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset the fields whenever the dialog opens for a (different) user.
  useEffect(() => {
    if (user) {
      setPassword("");
      setConfirm("");
      setError(null);
    }
  }, [user]);

  function validate(): string | null {
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirm) return "Passwords do not match.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    await onSubmit(password);
  }

  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {user?.name}</DialogTitle>
          <DialogDescription>
            Set a new password for this user. Their existing sessions will be
            signed out — they must sign in again with the new password.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="reset-password">New password</FieldLabel>
              <PasswordInput
                id="reset-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="reset-confirm">Confirm password</FieldLabel>
              <PasswordInput
                id="reset-confirm"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
