import { redirect } from "next/navigation";

// Bare `/sim` has no ticker — send the user back to the landing page to pick one.
export default function SimIndexPage() {
  redirect("/");
}
