import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/lib/auth";
import { DemoBanner } from "@/components/demo-banner";
import { OperatorTabBar } from "@/components/operator-tab-bar";
import { CENTER } from "@/lib/center-config";
import { Toaster } from "sonner";

export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const db = createServiceClient();
  const [operator, { data: operators }] = await Promise.all([
    getCurrentOperator(),
    db.from("operators").select("id, name").order("name"),
  ]);

  const currentName = operator?.name ?? "Guest";
  const personas = (operators ?? []).map((o) => ({ id: o.id, name: o.name }));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DemoBanner currentName={currentName} personas={personas} mode="operator" />
      <header className="sticky top-0 border-b bg-white px-4 py-3 md:static md:border-b">
        <div className="mx-auto max-w-none">
          <h1 className="text-lg font-semibold text-foreground">{CENTER.name}</h1>
          <p className="text-xs text-muted-fg">Director Dashboard</p>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <OperatorTabBar />
        <main className="flex flex-1 flex-col pb-16 md:pb-0">{children}</main>
      </div>
      <Toaster position="bottom-center" richColors />
    </div>
  );
}
