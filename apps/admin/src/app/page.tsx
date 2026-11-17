import { redirect } from "next/navigation";

/**
 * Bosh manzil panelga yo'naltiradi. Sessiya yo'q bo'lsa panel layout'i
 * login sahifasiga, Support roli bo'lsa — Support bo'limiga o'tkazadi.
 */
export default function HomePage() {
  redirect("/dashboard");
}
