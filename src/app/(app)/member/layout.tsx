import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider className="theme-creator h-svh overflow-hidden">
      <AppSidebar role="MEMBER" />
      <SidebarInset className="min-h-0 overflow-hidden">
        <AppTopbar role="MEMBER" />
        <ScrollArea className="min-h-0 flex-1">
          <main className="@container/main flex flex-col gap-6 p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  );
}
