import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PHRASES, PHRASE_GROUPS, speakFrench, type PhraseGroup } from "@/lib/phrases";
import { control } from "@/components/ui";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/_app/voice")({ component: VoicePage });

function VoicePage() {
  const [group, setGroup] = useState<PhraseGroup | "all">("gate");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [speechOk, setSpeechOk] = useState(true);
  const [showEn, setShowEn] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeechOk(false);
      return;
    }
    const refresh = () => {
      const voices = window.speechSynthesis.getVoices();
      setSpeechOk(voices.length === 0 || voices.some((voice) => voice.lang.toLowerCase().startsWith("fr")) || voices.length > 0);
    };
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);

  const phrases = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return PHRASES.filter((phrase) => {
      if (group !== "all" && phrase.group !== group) return false;
      if (!needle) return true;
      return `${phrase.fr} ${phrase.en} ${phrase.phonetic}`.toLowerCase().includes(needle);
    });
  }, [group, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Voice</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowEn((value) => !value)}
          className="h-11 rounded-md border border-line bg-surface px-4 text-sm font-semibold"
        >
          {showEn ? "Hide English" : "Show English"}
        </button>
      </div>
      <p className="max-w-2xl text-muted">
        Common phrases and audio prompts for cross-border drivers. Play spoken French translations or read phonetic guides to assist scalehouse check-ins.
      </p>
      {!speechOk ? (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent">
          This tablet has no speech engine. Read the phonetic spelling aloud.
        </p>
      ) : null}
      <input
        className={control}
        placeholder="Search a phrase"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search phrases"
      />
      <div className="flex gap-2 overflow-x-auto pb-1">
        <GroupButton current={group} id="all" label="All" onClick={setGroup} />
        {PHRASE_GROUPS.map((item) => (
          <GroupButton key={item.id} current={group} id={item.id} label={item.label} onClick={setGroup} />
        ))}
      </div>
      <ul className="space-y-3">
        {phrases.map((phrase) => (
          <li key={phrase.id} className="rounded-lg border border-line bg-surface p-4">
            <p className="font-display text-2xl leading-snug">{phrase.fr}</p>
            {showEn ? <p className="mt-1 text-sm text-muted">{phrase.en}</p> : null}
            <p className="mt-2 text-sm text-primary">{phrase.phonetic}</p>
            <button
              type="button"
              className="mt-3 h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-fg"
              onClick={() => {
                if (active === phrase.id) {
                  window.speechSynthesis?.cancel();
                  setActive(null);
                  return;
                }
                const ok = speakFrench(phrase.fr);
                if (!ok) {
                  setSpeechOk(false);
                  return;
                }
                setActive(phrase.id);
                window.setTimeout(() => setActive((current) => (current === phrase.id ? null : current)), 8000);
              }}
            >
              {active === phrase.id ? "Stop" : "Play French"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GroupButton({
  current,
  id,
  label,
  onClick,
}: {
  current: PhraseGroup | "all";
  id: PhraseGroup | "all";
  label: string;
  onClick: (id: PhraseGroup | "all") => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={cn(
        "h-11 shrink-0 rounded-md px-4 text-sm font-semibold",
        current === id ? "bg-primary text-primary-fg" : "border border-line bg-surface text-ink",
      )}
    >
      {label}
    </button>
  );
}
