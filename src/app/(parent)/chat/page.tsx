import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentParent } from "@/lib/auth";
import { getAuthorizedChildIds } from "@/lib/authz";
import { ChatClient } from "@/components/chat-client";

export default async function ChatPage() {
  const parent = await getCurrentParent();
  let childNames: string[] = [];

  if (parent) {
    const db = createServiceClient();
    const childIds = await getAuthorizedChildIds(parent.id);
    if (childIds.length > 0) {
      const { data } = await db
        .from("children")
        .select("name")
        .in("id", childIds)
        .order("name");
      childNames = (data ?? []).map((c) => c.name);
    }
  }

  return <ChatClient parent={parent} childNames={childNames} />;
}
