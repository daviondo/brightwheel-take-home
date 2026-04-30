import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { PolicyEditor } from "@/components/policy-editor";

export default async function EditPolicyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createServiceClient();

  const { data: policy } = await db
    .from("policies")
    .select("id, category, title, content, source, status")
    .eq("id", id)
    .single();

  if (!policy) notFound();

  return <PolicyEditor policy={policy} />;
}
