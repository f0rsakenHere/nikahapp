/* Shown the moment the tab is tapped, while the page is built.
 *
 * The chrome is the real chrome — same sidebar, same tab bar — so only
 * the content area changes, and nothing moves when the answer lands.
 */
import { AppShell } from "../frame";
import { RowsSkeleton } from "@/components/app/skeleton";

export default function Loading() {
  return (
    <AppShell active="messages" title="Messages" width="wide">
      <RowsSkeleton count={5} />
    </AppShell>
  );
}
