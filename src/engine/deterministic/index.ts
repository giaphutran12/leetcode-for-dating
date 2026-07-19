// Barrel for the canonical deterministic engine internals. The judge server
// (Task 4) and the client hook both draw the shared conversation core from here.

export { matchesAnySignal, tokenize } from "./matcher";
export { transition } from "./transition";
export type { TransitionInput } from "./transition";
export { replayTranscript } from "./replay";
export type { ReplayResult } from "./replay";
