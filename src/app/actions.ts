"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function setDemoParent(parentId: string | null) {
  const cookieStore = await cookies();
  if (parentId) {
    cookieStore.set("demo_parent_id", parentId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });
  } else {
    cookieStore.delete("demo_parent_id");
  }
  revalidatePath("/", "layout");
}

export async function setDemoOperator(operatorId: string | null) {
  const cookieStore = await cookies();
  if (operatorId) {
    cookieStore.set("demo_operator_id", operatorId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });
  } else {
    cookieStore.delete("demo_operator_id");
  }
  revalidatePath("/", "layout");
}
