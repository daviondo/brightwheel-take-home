import { redirect } from "next/navigation";

// Parent chat is the default experience.
export default function Home() {
  redirect("/chat");
}
