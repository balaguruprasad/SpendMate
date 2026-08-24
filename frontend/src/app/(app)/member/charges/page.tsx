import { ChargesView } from "@/components/workspaces/shared/charges-view";

export const metadata = { title: "My Charges" };

export default function MemberChargesPage() {
  return <ChargesView isAdmin={false} />;
}
