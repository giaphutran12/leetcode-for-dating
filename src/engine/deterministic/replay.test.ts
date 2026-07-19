import { describe, expect, it } from "vitest";
import { scenarioById } from "../../data/scenarios";
import { replayTranscript } from "./replay";

const busStop = scenarioById("spark-bus-stop")!;
const keepThread = scenarioById("connection-keep-thread")!;

describe("replayTranscript", () => {
  it("is deterministic — identical inputs produce deep-equal output", () => {
    const responses = [
      { turn: 1 as const, body: "what are you reading?" },
      { turn: 2 as const, body: "nice, I love a slow burn" },
      { turn: 3 as const, body: "which bus are you catching?" },
    ];
    const a = replayTranscript(busStop, responses);
    const b = replayTranscript(busStop, responses);
    expect(a).toEqual(b);
  });

  it("includes the opening persona message when the scenario has one", () => {
    const result = replayTranscript(keepThread, [{ turn: 1, body: "my day was long too" }]);
    expect(result.messages[0].speaker).toBe("her");
    expect(result.messages[0].turn).toBe(0);
    expect(result.messages[0].body).toBe(keepThread.opening.kind === "persona_message" ? keepThread.opening.body : "");
  });

  it("omits an opening message for scene-only scenarios", () => {
    const result = replayTranscript(busStop, [{ turn: 1, body: "hi" }]);
    expect(result.messages[0].speaker).toBe("you");
  });

  it("alternates user response then persona reply", () => {
    const result = replayTranscript(busStop, [
      { turn: 1, body: "what are you reading?" },
      { turn: 2, body: "cool" },
    ]);
    const speakers = result.messages.map((m) => m.speaker);
    expect(speakers).toEqual(["you", "her", "you", "her"]);
    expect(result.personaReplies).toHaveLength(2);
  });

  it("ignores responses after an early termination", () => {
    // A boundary on turn 1 ends the exchange; later responses are dropped.
    const result = replayTranscript(busStop, [
      { turn: 1, body: "get in my car" },
      { turn: 2, body: "what are you reading?" },
      { turn: 3, body: "which bus?" },
    ]);
    expect(result.personaReplies).toHaveLength(1);
    expect(result.personaReplies[0].terminalReason).toBe("boundary");
    expect(result.finalState.terminal).toBe(true);
    // one user + one persona message only
    expect(result.messages).toHaveLength(2);
  });

  it("uses deterministic, attempt-agnostic message ids", () => {
    const result = replayTranscript(busStop, [{ turn: 1, body: "hi" }]);
    expect(result.messages[0].id).toBe("spark-bus-stop-t1-you");
    expect(result.messages[1].id).toBe("spark-bus-stop-t1-her");
  });

  it("carries persona state forward across turns", () => {
    const result = replayTranscript(busStop, [
      { turn: 1, body: "what are you reading?" },
      { turn: 2, body: "so anyway" },
    ]);
    // turn 1 positive lifts neutral -> warm, turn 2 low-interest drops warm -> neutral
    expect(result.personaReplies[0].state.engagement).toBe("warm");
    expect(result.personaReplies[1].state.engagement).toBe("neutral");
  });
});
