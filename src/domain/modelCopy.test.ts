import { describe, expect, it } from "vitest";
import { CRITERIA } from "./constants";
import { cleanJudgeCopy, cleanModelCopy } from "./modelCopy";
import type { JudgeModelDraft } from "./types";

describe("model copy guard", () => {
  it("replaces em dashes and banned fantasy metaphors", () => {
    expect(
      cleanModelCopy("The goblins—plus one gremlin–cooked the vibe."),
    ).toBe("The mess - plus one mess - cooked the vibe.");
  });

  it("cleans generated coaching without changing exact evidence excerpts", () => {
    const excerpt = "I defeated the goblins—today";
    const draft: JudgeModelDraft = {
      safety: {
        severity: "cap",
        confidence: "high",
        codes: ["insult"],
        evidence: [
          {
            turn: 1,
            excerpt,
            reason: "The gremlin—language was insulting.",
          },
        ],
      },
      rubric: CRITERIA.map((id) => ({
        id,
        score: 1,
        evidence: {
          turn: 1,
          excerpt,
          reason: "That line—had gremlin energy.",
        },
        feedback: "The goblins—won this beat.",
      })),
      worked: ["You tried—good."],
      improve: ["Drop the Kremlin metaphor."],
      betterResponse: "That landed—what happened?",
      outcome: {
        code: "conversation_continues",
        label: "Conversation—continues",
        confidence: "medium",
        basis: [
          {
            turn: 1,
            excerpt,
            reason: "The goblins—kept talking.",
          },
        ],
      },
    };

    const cleaned = cleanJudgeCopy(draft);

    expect(cleaned.rubric[0]?.evidence.excerpt).toBe(excerpt);
    expect(cleaned.safety.evidence[0]?.excerpt).toBe(excerpt);
    expect(cleaned.safety.evidence[0]?.reason).toBe(
      "The mess - language was insulting.",
    );
    expect(cleaned.rubric[0]?.feedback).toBe(
      "The mess - won this beat.",
    );
    expect(cleaned.improve[0]).toBe("Drop the mess metaphor.");
    expect(cleaned.outcome.basis[0]?.excerpt).toBe(excerpt);
  });
});
