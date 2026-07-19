import { describe, expect, it } from "vitest";
import { scenarioById } from "../../data/scenarios";
import { replayTranscript } from "../../engine/deterministic/replay";
import { detectHardGates } from "./gates";

const busStop = scenarioById("spark-bus-stop")!;

function detect(responses: Array<{ turn: 1 | 2 | 3; body: string }>) {
  const replay = replayTranscript(busStop, responses);
  return detectHardGates(responses, replay);
}

describe("detectHardGates", () => {
  it("finds nothing for a clean exchange", () => {
    const finding = detect([{ turn: 1, body: "what are you reading?" }]);
    expect(finding.severity).toBe("none");
    expect(finding.codes).toEqual([]);
    expect(finding.evidence).toEqual([]);
  });

  it("flags a stop-level threat and cites the exact substring", () => {
    const finding = detect([{ turn: 1, body: "listen, or i'll hurt you, got it?" }]);
    expect(finding.severity).toBe("stop");
    expect(finding.codes).toContain("threat");
    expect(finding.evidence[0].excerpt.toLowerCase()).toContain("i'll hurt you");
    // Excerpt must be an exact substring of the original turn.
    expect("listen, or i'll hurt you, got it?").toContain(finding.evidence[0].excerpt);
  });

  it("does not fire on unrelated substrings (whole-word matching)", () => {
    // "retard" is a slur; "retarded growth" contains it but as its own word would
    // match — so use a genuinely unrelated word that merely embeds letters.
    const finding = detect([{ turn: 1, body: "the bus is unfashionably late again" }]);
    expect(finding.severity).toBe("none");
  });

  it("caps demanding contact only after the persona is low/closed, not while warm", () => {
    // A single friendly turn keeps engagement neutral+, so the demand does not gate.
    const warm = detect([{ turn: 1, body: "give me your number" }]);
    expect(warm.codes).not.toContain("demanding_contact");
  });
});
