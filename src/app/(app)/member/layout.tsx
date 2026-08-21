import { Suspense } from "react";
import { SpendShell } from "@/components/spendmate/shell";

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <SpendShell>{children}</SpendShell>
    </Suspense>
  );
}
