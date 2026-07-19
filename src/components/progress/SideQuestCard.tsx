// Side Quest card (plan: "Side Quests"). At most one, suggested only when the
// plan matched a genuine interest. RizzCode never teaches the subject — it hands
// you a starter action and a copyable prompt, states the boundary, and gets out
// of the way. Shared by the onboarding starting line and the progress view so
// the handoff reads identically in both places.

import { useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";
import type { SideQuest } from "../../domain/types";

interface SideQuestCardProps {
  quest: SideQuest;
}

type CopyState = "idle" | "copied" | "failed";

export function SideQuestCard({ quest }: SideQuestCardProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  async function copyPrompt() {
    // Graceful fallback: if the Clipboard API is missing or blocked, tell the
    // user to copy the (already visible) prompt by hand instead of failing loud.
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(quest.handoffPrompt);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <section className="taste-sidequest" aria-labelledby="sidequest-title">
      <p className="taste-sidequest__eyebrow">Optional side quest</p>
      <h3 id="sidequest-title">{quest.title}</h3>
      <p className="taste-sidequest__why">{quest.whyItFits}</p>

      <div className="taste-sidequest__action">
        <span>Start here</span>
        <p>{quest.starterAction}</p>
      </div>

      <div className="taste-sidequest__handoff">
        <div className="taste-sidequest__handoff-head">
          <span>Paste this into ChatGPT or a search</span>
          <button
            type="button"
            className="taste-sidequest__copy"
            onClick={copyPrompt}
          >
            {copyState === "copied" ? (
              <>
                <Check size={15} weight="bold" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy size={15} weight="bold" aria-hidden="true" />
                Copy prompt
              </>
            )}
          </button>
        </div>
        <blockquote>{quest.handoffPrompt}</blockquote>
        {copyState === "failed" ? (
          <p className="taste-sidequest__copyfail" role="status">
            Couldn’t copy for you — select the prompt above and copy it yourself.
          </p>
        ) : null}
      </div>

      <p className="taste-sidequest__boundary">
        Heads up: RizzCode doesn’t teach this — that’s the whole point of the
        handoff. Go learn it out there, then come back and rep the conversation.
      </p>
    </section>
  );
}
