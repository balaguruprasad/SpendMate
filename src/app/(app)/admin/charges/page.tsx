import { ChargesView } from "@/components/workspaces/shared/charges-view";

export const metadata = { title: "Charges" };

export default function AdminChargesPage() {
  return <ChargesView isAdmin />;
}
