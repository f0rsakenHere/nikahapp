import { scholars } from "@/content/site";

/* A single quiet line between the dark hero and the cream body,
   naming the scholar the process was built with. */
export function Trust() {
  return (
    <section className="border-b border-line bg-shell px-6 py-6 lg:px-10">
      <p className="shell text-center text-sm text-body/70">
        Matchmaking procedure developed through full consultation with{" "}
        <span className="font-semibold text-ink/70">Mufti Faisal al-Mahmudi</span> of Darul Iftaa
        Canada.
      </p>
      <span className="sr-only">{scholars.quote}</span>
    </section>
  );
}
