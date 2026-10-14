import { useState } from "react";
import { Check, Mic } from "lucide-react";
import { parseSpokenTicket, spokenSummary, type SpokenFields } from "@/lib/speech-intake";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";

type Listener = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function listen(lang: string) {
  const host = window as Window & {
    SpeechRecognition?: new () => Listener;
    webkitSpeechRecognition?: new () => Listener;
  };
  const Ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.continuous = false;
  return recognition;
}

export function SpokenIntake({
  onApply,
  defaultOpen = false,
}: {
  onApply: (fields: SpokenFields) => void;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [lang, setLang] = useState<"fr-FR" | "en-GB">("fr-FR");
  const [hearing, setHearing] = useState(false);
  const [heard, setHeard] = useState("");
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");

  function apply(transcript: string) {
    const fields = parseSpokenTicket(transcript);
    setHeard(transcript);
    if (!fields.truckNumber && !fields.declaredMt && !fields.supplierName) {
      setNote("No plate, weight, or supplier in that line. Try the example.");
      return;
    }
    onApply(fields);
    setNote(spokenSummary(fields));
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-4 transition-all">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-lg transition-colors",
              isOpen ? "bg-primary text-primary-fg" : "bg-primary-soft text-primary",
            )}
          >
            <Mic className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink sm:text-base">
              Want to use voice intake?
            </h2>
            <p className="text-xs text-muted">
              Speak in French or English to auto-populate the waybill, or continue typing manually below.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <span className="text-xs font-medium text-muted">
            {isOpen ? "Voice active" : "Voice off"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isOpen}
            aria-label="Toggle voice intake"
            onClick={() => setIsOpen((prev) => !prev)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              isOpen ? "bg-primary" : "bg-line",
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                isOpen ? "translate-x-5" : "translate-x-0",
              )}
            />
          </button>
          {isOpen ? (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="ml-1 text-xs font-semibold text-muted underline transition-colors hover:text-ink"
            >
              Hide voice
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-fg shadow-xs transition-opacity hover:opacity-90"
            >
              Yes, use voice
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-xl text-ink">Speak the ticket</p>
              <p className="text-xs text-muted">
                Say the plate, the tonnes, the supplier, and the origin. The waybill form fills automatically below.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className={
                  lang === "fr-FR"
                    ? "h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-fg"
                    : "h-9 rounded-md border border-line bg-surface px-3 text-xs font-semibold text-ink"
                }
                onClick={() => setLang("fr-FR")}
              >
                Français
              </button>
              <button
                type="button"
                className={
                  lang === "en-GB"
                    ? "h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-fg"
                    : "h-9 rounded-md border border-line bg-surface px-3 text-xs font-semibold text-ink"
                }
                onClick={() => setLang("en-GB")}
              >
                English
              </button>
            </div>
          </div>

          <div className="rounded-md bg-bg p-3 text-xs text-muted">
            <span className="font-semibold text-ink">Example sentence: </span>
            {lang === "fr-FR"
              ? "camion TG 8086 BH, cinquante tonnes, fournisseur Hajia Fadila, origine Togo."
              : "truck TG 8086 BH, fifty tonnes, supplier Hajia Fadila, origin Togo."}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={hearing}
              onClick={() => {
                const recognition = listen(lang);
                if (!recognition) {
                  setNote("This browser has no speech recognition engine. Type the spoken line below.");
                  return;
                }
                setHearing(true);
                setNote("");
                recognition.onresult = (event) => {
                  apply(event.results[0]?.[0]?.transcript ?? "");
                };
                recognition.onerror = () => setNote("Microphone did not catch that. Please try again or type the line.");
                recognition.onend = () => setHearing(false);
                try {
                  recognition.start();
                } catch {
                  setHearing(false);
                  setNote("The microphone is already in use.");
                }
              }}
              className="gap-2"
            >
              <Mic className={cn("size-4", hearing && "animate-pulse text-accent")} />
              {hearing ? "Listening… speak now" : "Start speaking"}
            </Button>
          </div>

          {heard ? (
            <p className="rounded-md border border-line bg-bg p-2.5 text-xs text-ink">
              <span className="font-semibold">Transcribed:</span> {heard}
            </p>
          ) : null}

          {note ? (
            <div className="flex items-center gap-2 rounded-md bg-primary-soft p-3 text-xs font-semibold text-primary">
              <Check className="size-4 shrink-0" />
              <span>{note}</span>
            </div>
          ) : null}

          <div className="border-t border-line/60 pt-3">
            <label className="block text-xs font-medium text-muted">
              Or type / paste the line
              <textarea
                className="mt-1 min-h-16 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder={
                  lang === "fr-FR"
                    ? "camion TG 8086 BH, cinquante tonnes…"
                    : "truck TG 8086 BH, fifty tonnes…"
                }
              />
            </label>
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant="quiet"
                disabled={!typed.trim()}
                onClick={() => apply(typed)}
                className="h-9 px-3 text-xs"
              >
                Fill the form
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}