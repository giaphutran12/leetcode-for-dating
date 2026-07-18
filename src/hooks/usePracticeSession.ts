// The three-turn practice session state machine. This hook owns the attempt
// lifecycle: accepting user responses, driving the persona engine, and handing
// the finished transcript to the judge. It is deliberately UI-agnostic — no
// draft text, no styling — so the UI task can build on this signature verbatim.
//
// Determinism and safety come from two guards:
//  1. A synchronous `busy` flag: a double-click while a reply is pending records
//     exactly one response.
//  2. Every async resolution is tagged with the attempt id it started under and
//     dropped if the attempt has since been reset — a stale persona reply or
//     judge result can never mutate a new attempt.

import { useCallback, useReducer, useRef } from "react";
import type {
  Attempt,
  JudgeApiResponse,
  JudgeRequest,
  JudgeResult,
  PersonaReply,
  PersonaState,
  PracticeMessage,
  Scenario,
} from "../domain/types";
import type { ConversationEngine } from "../engine/conversationEngine";
import { deterministicEngine } from "../engine/conversationEngine";
import { httpJudge } from "../engine/judgeEngine";

const MAX_RESPONSE_LENGTH = 420;

export type JudgeFn = (req: JudgeRequest) => Promise<JudgeApiResponse>;

export interface UsePracticeSessionOptions {
  scenario: Scenario;
  engine?: ConversationEngine;
  judge?: JudgeFn;
}

export interface JudgeErrorState {
  retryable: boolean;
  code: string;
  message: string;
}

export type EarlyExit = { reason: "boundary" | "user_exit" | "persona_exit" };

export interface UsePracticeSessionResult {
  attempt: Attempt;
  messages: PracticeMessage[];
  status: Attempt["status"];
  userTurn: 0 | 1 | 2 | 3;
  personaThinking: boolean;
  judging: boolean;
  result: JudgeResult | null;
  judgeError: JudgeErrorState | null;
  endedEarly: EarlyExit | null;
  submitResponse(body: string): boolean;
  reset(): void;
  retryJudgment(): void;
}

interface SessionState {
  attempt: Attempt;
  personaState: PersonaState;
  personaThinking: boolean;
  judging: boolean;
  result: JudgeResult | null;
  judgeError: JudgeErrorState | null;
  endedEarly: EarlyExit | null;
  // Synchronous re-entry lock; not surfaced to consumers.
  busy: boolean;
}

function now(): string {
  return new Date().toISOString();
}

function createSession(scenario: Scenario): SessionState {
  const id = crypto.randomUUID();
  const messages: PracticeMessage[] = [];
  if (scenario.opening.kind === "persona_message") {
    messages.push({
      id: `${id}-t0-her`,
      speaker: "her",
      body: scenario.opening.body,
      turn: 0,
      createdAt: now(),
    });
  }
  return {
    attempt: {
      id,
      scenarioId: scenario.id,
      messages,
      userTurn: 0,
      status: "active",
      startedAt: now(),
    },
    personaState: scenario.persona.initialState,
    personaThinking: false,
    judging: false,
    result: null,
    judgeError: null,
    endedEarly: null,
    busy: false,
  };
}

const EARLY_REASONS: ReadonlySet<PersonaReply["terminalReason"]> = new Set([
  "boundary",
  "user_exit",
  "persona_exit",
]);

export function usePracticeSession(
  options: UsePracticeSessionOptions,
): UsePracticeSessionResult {
  // Options can change identity across renders; a ref keeps the stable callbacks
  // reading the latest scenario/engine/judge without re-creating handlers.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // All mutable session state lives in a ref so async resolutions can read the
  // current attempt id synchronously and reject stale updates. A reducer bump
  // drives React re-renders. Lazily initialized so createSession runs once, not
  // on every render (its result was discarded on all renders after the first).
  const stateRef = useRef<SessionState | null>(null);
  if (stateRef.current === null) {
    stateRef.current = createSession(options.scenario);
  }
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  const commit = useCallback(
    (next: SessionState) => {
      stateRef.current = next;
      forceRender();
    },
    [forceRender],
  );

  const buildResponses = useCallback(
    (attempt: Attempt): JudgeRequest["responses"] =>
      attempt.messages
        .filter((message) => message.speaker === "you")
        .map((message) => ({ turn: message.turn as 1 | 2 | 3, body: message.body })),
    [],
  );

  const startJudging = useCallback(
    (attemptId: string) => {
      const judge = optionsRef.current.judge ?? defaultJudge;
      const current = stateRef.current!;
      if (current.attempt.id !== attemptId) return;

      const request: JudgeRequest = {
        schemaVersion: "1.0",
        attemptId,
        scenarioId: current.attempt.scenarioId,
        responses: buildResponses(current.attempt),
      };

      commit({
        ...current,
        judging: true,
        judgeError: null,
        result: null,
        attempt: { ...current.attempt, status: "awaiting_judgment" },
      });

      judge(request)
        .then((response) => {
          const state = stateRef.current!;
          if (state.attempt.id !== attemptId) return;
          if (response.ok) {
            commit({
              ...state,
              judging: false,
              result: response.result,
              judgeError: null,
              attempt: {
                ...state.attempt,
                status: "complete",
                result: response.result,
                completedAt: now(),
              },
            });
          } else {
            commit({
              ...state,
              judging: false,
              result: null,
              judgeError: {
                retryable: response.retryable,
                code: response.code,
                message: response.message,
              },
              attempt: { ...state.attempt, status: "error" },
            });
          }
        })
        .catch(() => {
          const state = stateRef.current!;
          if (state.attempt.id !== attemptId) return;
          commit({
            ...state,
            judging: false,
            result: null,
            judgeError: {
              retryable: true,
              code: "judge_unavailable",
              message: "The judge could not be reached. Retry judgment.",
            },
            attempt: { ...state.attempt, status: "error" },
          });
        });
    },
    [buildResponses, commit],
  );

  const applyPersonaReply = useCallback(
    (attemptId: string, turn: 1 | 2 | 3, reply: PersonaReply) => {
      const state = stateRef.current!;
      // Stale reply from a reset attempt — drop it.
      if (state.attempt.id !== attemptId) return;

      const herMessage: PracticeMessage = {
        id: `${attemptId}-t${turn}-her`,
        speaker: "her",
        body: reply.reply,
        turn,
        createdAt: now(),
      };

      const isTerminal = reply.terminalReason !== null;
      const earlyExit = EARLY_REASONS.has(reply.terminalReason)
        ? ({ reason: reply.terminalReason } as EarlyExit)
        : null;

      const next: SessionState = {
        ...state,
        personaState: reply.state,
        personaThinking: false,
        busy: false,
        endedEarly: earlyExit ?? state.endedEarly,
        attempt: {
          ...state.attempt,
          messages: [...state.attempt.messages, herMessage],
          status: isTerminal ? "awaiting_judgment" : "active",
        },
      };
      commit(next);

      if (isTerminal) startJudging(attemptId);
    },
    [commit, startJudging],
  );

  const submitResponse = useCallback((body: string): boolean => {
    const state = stateRef.current!;
    const trimmed = body.trim();

    // Validation and state guards — none advance the turn.
    if (trimmed.length === 0) return false;
    if (body.length > MAX_RESPONSE_LENGTH) return false;
    if (state.attempt.status !== "active") return false;
    if (state.busy) return false;

    const turn = (state.attempt.userTurn + 1) as 1 | 2 | 3;
    const attemptId = state.attempt.id;
    const userMessage: PracticeMessage = {
      id: `${attemptId}-t${turn}-you`,
      speaker: "you",
      body: trimmed,
      turn,
      createdAt: now(),
    };

    const pending: Attempt = {
      ...state.attempt,
      messages: [...state.attempt.messages, userMessage],
      userTurn: turn,
      status: "awaiting_reply",
    };
    // Lock re-entry and record the single response synchronously.
    commit({
      ...state,
      attempt: pending,
      personaThinking: true,
      busy: true,
    });

    const engine = optionsRef.current.engine ?? deterministicEngine;
    const scenario = optionsRef.current.scenario;
    const personaState = state.personaState;

    engine
      .reply({ scenario, attempt: pending, personaState })
      .then((reply) => applyPersonaReply(attemptId, turn, reply))
      .catch(() => {
        // Persona engine failure: fall back to the scenario's authored reply for
        // this turn and current engagement so the conversation stays usable.
        const fallback: PersonaReply = {
          reply: scenario.fallback.repliesByTurn[turn][personaState.engagement],
          state: { ...personaState, terminal: turn === 3 },
          interestChange: "same",
          terminalReason: turn === 3 ? "completed" : null,
        };
        applyPersonaReply(attemptId, turn, fallback);
      });

    return true;
    // applyPersonaReply/commit are stable; refs supply the latest values.
  }, [applyPersonaReply, commit]);

  const reset = useCallback(() => {
    // A fresh attempt id orphans any in-flight persona reply or judge result.
    commit(createSession(optionsRef.current.scenario));
  }, [commit]);

  const retryJudgment = useCallback(() => {
    const state = stateRef.current!;
    // Only re-judge from a judge-error state; a completed attempt cannot be
    // re-judged, and re-sending uses the same immutable responses + attempt id.
    if (state.attempt.status !== "error") return;
    if (state.judging) return;
    startJudging(state.attempt.id);
  }, [startJudging]);

  const state = stateRef.current!;
  return {
    attempt: state.attempt,
    messages: state.attempt.messages,
    status: state.attempt.status,
    userTurn: state.attempt.userTurn,
    personaThinking: state.personaThinking,
    judging: state.judging,
    result: state.result,
    judgeError: state.judgeError,
    endedEarly: state.endedEarly,
    submitResponse,
    reset,
    retryJudgment,
  };
}

// Default judge: POST the request to the server LLM judge via the shared client.
// Injected in tests so no fetch mocking is needed. A thrown/failed fetch surfaces
// as a retryable error inside httpJudge.
const defaultJudge: JudgeFn = httpJudge;
