import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentParent } from "@/lib/auth";
import { DemoBanner } from "@/components/demo-banner";
import { CENTER } from "@/lib/center-config";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const db = createServiceClient();
  const [parent, { data: parents }] = await Promise.all([
    getCurrentParent(),
    db.from("parents").select("id, name").order("name"),
  ]);

  const currentName = parent?.name ?? "Guest";
  const personas = (parents ?? []).map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DemoBanner currentName={currentName} personas={personas} mode="parent" />
      <header className="sticky top-0 border-b bg-white px-4 py-3">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-lg font-semibold text-foreground">{CENTER.name}</h1>
          <p className="text-xs text-muted-fg">AI Front Desk</p>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
