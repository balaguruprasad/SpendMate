import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/constants";

/**
 * The root path is just an entry point — send people to the login / persona
 * picker. (In normal flow `proxy.ts` already redirects `/` to `/login` before
 * this renders; this is the server-side fallback.)
 */
export default function Home() {
  redirect(ROUTES.login);
}
