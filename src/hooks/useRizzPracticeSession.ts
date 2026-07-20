import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { requestJudgment as callJudge } from "../api/judgeClient";
import {
  preparePersonaReply,
  requestPersonaReply,
} from "../api/personaClient";
import { useRizzCode } from "../context/RizzCodeContext";
import {
  DRAFT_IDLE_PREPARE_MS,
  MAX_CONVERSATION_TURNS,
  MESSAGE_DELIVERED_DELAY_MS,
  MESSAGE_SEEN_DELAY_MS,
  MIN_CONVERSATION_TURNS,
  MIN_PREPARE_TYPING_MS,
  MAX_RESPONSE_LENGTH,
} from "../domain/constants";
import type {
  Attempt,
  ConversationTurn,
  JudgeResult,
  PersonaReply,
  Scenario,
} from "../domain/types";
import {
  appendPersonaAction,
  beginTurn,
  createAttempt,
  finalizePersonaTurn,
  updateUserMessageDelivery,
  userResponses,
  validateResponse,
} from "../engine/conversationEngine";
import { localDateKey } from "../domain/activity";

type JudgmentReceipt = {
  xpDelta: number;
  isPersonalBest: boolean;
  unlockedAchievements: string[];
};

type PendingTurn = {
  turn: ConversationTurn;
  body: string;
};

const wait = (delayMs: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));

export function useRizzPracticeSession(scenario: Scenario) {
  const { recordJudgment, saveAttempt } = useRizzCode();
  const [attempt, setAttempt] = useState<Attempt>(() =>
    createAttempt(scenario),
  );
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<string>();
  const [draftPreparing, setDraftPreparing] = useState(false);
  const [receipt, setReceipt] = useState<JudgmentReceipt>();
  const busyRef = useRef(false);
  const operationRef = useRef(0);
  const attemptRef = useRef(attempt);
  const pendingTurnRef = useRef<PendingTurn | undefined>(undefined);
  const draftAbortRef = useRef<AbortController | undefined>(undefined);
  const sessionTokenRef = useRef<string | undefined>(undefined);

  const commitAttempt = useCallback((next: Attempt) => {
    attemptRef.current = next;
    setAttempt(next);
  }, []);

  useEffect(() => {
    attemptRef.current = attempt;
    saveAttempt(attempt);
  }, [attempt, saveAttempt]);

  useEffect(() => {
    draftAbortRef.current?.abort();
    setDraftPreparing(false);

    const trimmed = input.trim();
    const current = attemptRef.current;
    if (
      scenario.mode !== "messaging" ||
      current.status !== "active" ||
      !trimmed ||
      trimmed.length > MAX_RESPONSE_LENGTH ||
      current.userTurn >= MAX_CONVERSATION_TURNS
    ) {
      return;
    }

    const controller = new AbortController();
    draftAbortRef.current = controller;
    const attemptId = current.id;
    const turn = (current.userTurn + 1) as ConversationTurn;
    const timer = window.setTimeout(async () => {
      setDraftPreparing(true);
      const startedAt = performance.now();
      await preparePersonaReply(
        {
          schemaVersion: "1.0",
          attemptId,
          scenarioId: scenario.id,
          turn,
          body: trimmed,
          sessionToken: sessionTokenRef.current,
        },
        controller.signal,
      );
      const remaining = Math.max(
        0,
        MIN_PREPARE_TYPING_MS - (performance.now() - startedAt),
      );
      await wait(remaining);
      if (
        !controller.signal.aborted &&
        attemptRef.current.id === attemptId &&
        attemptRef.current.status === "active"
      ) {
        setDraftPreparing(false);
      }
    }, DRAFT_IDLE_PREPARE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [attempt.id, attempt.status, input, scenario.id, scenario.mode]);

  const finishJudgment = useCallback(
    async (pendingAttempt: Attempt, operation: number) => {
      const judgingAttempt: Attempt = {
        ...pendingAttempt,
        status: "awaiting_judgment",
        error: undefined,
      };
      commitAttempt(judgingAttempt);
      const apiResult = await callJudge({
        schemaVersion: "1.0",
        attemptId: pendingAttempt.id,
        scenarioId: scenario.id,
        responses: userResponses(pendingAttempt),
        sessionToken: sessionTokenRef.current,
      });

      if (
        operationRef.current !== operation ||
        attemptRef.current.id !== pendingAttempt.id
      ) {
        busyRef.current = false;
        return;
      }

      if (!apiResult.ok) {
        commitAttempt({
          ...judgingAttempt,
          status: "error",
          error: {
            code: apiResult.code,
            message: apiResult.message,
            retryable: apiResult.retryable,
          },
        });
        busyRef.current = false;
        return;
      }

      const completedAt = new Date();
      const judgmentReceipt = recordJudgment(
        pendingAttempt,
        apiResult.result,
        completedAt,
      );
      const complete: Attempt = {
        ...judgingAttempt,
        status: "complete",
        result: apiResult.result,
        xpAwarded: judgmentReceipt.xpDelta,
        isPersonalBest: judgmentReceipt.isPersonalBest,
        completedAt: completedAt.toISOString(),
        completedLocalDate: localDateKey(completedAt),
      };
      setReceipt(judgmentReceipt);
      commitAttempt(complete);
      busyRef.current = false;
    },
    [commitAttempt, recordJudgment, scenario.id],
  );

  const revealReply = useCallback(
    async (
      withUser: Attempt,
      reply: PersonaReply,
      operation: number,
    ): Promise<Attempt | undefined> => {
      let visual = withUser;
      for (const [index, action] of reply.actions.entries()) {
        await wait(action.delayMs);
        if (
          operationRef.current !== operation ||
          attemptRef.current.id !== withUser.id
        ) {
          busyRef.current = false;
          return undefined;
        }
        visual = appendPersonaAction(
          visual,
          action,
          index + 1,
        );
        commitAttempt(visual);
      }
      const next = finalizePersonaTurn(visual, reply);
      commitAttempt(next);
      return next;
    },
    [commitAttempt],
  );

  const requestReaction = useCallback(
    async (
      withUser: Attempt,
      pending: PendingTurn,
      operation: number,
    ) => {
      const apiResult = await requestPersonaReply({
        schemaVersion: "1.0",
        attemptId: withUser.id,
        scenarioId: scenario.id,
        turn: pending.turn,
        body: pending.body,
        sessionToken: sessionTokenRef.current,
      });
      let conversationAttempt = withUser;

      if (
        operationRef.current !== operation ||
        attemptRef.current.id !== withUser.id
      ) {
        busyRef.current = false;
        return;
      }

      if (!apiResult.ok) {
        commitAttempt({
          ...conversationAttempt,
          status: "error",
          error: {
            code: apiResult.code,
            message: apiResult.message,
            retryable: apiResult.retryable,
          },
        });
        busyRef.current = false;
        return;
      }
      sessionTokenRef.current = apiResult.sessionToken;

      if (scenario.mode === "messaging") {
        await wait(MESSAGE_DELIVERED_DELAY_MS);
        if (
          operationRef.current !== operation ||
          attemptRef.current.id !== withUser.id
        ) {
          busyRef.current = false;
          return;
        }
        conversationAttempt = updateUserMessageDelivery(
          conversationAttempt,
          pending.turn,
          "delivered",
        );
        commitAttempt(conversationAttempt);

        await wait(MESSAGE_SEEN_DELAY_MS);
        if (
          operationRef.current !== operation ||
          attemptRef.current.id !== withUser.id
        ) {
          busyRef.current = false;
          return;
        }
        conversationAttempt = updateUserMessageDelivery(
          conversationAttempt,
          pending.turn,
          "seen",
        );
        commitAttempt(conversationAttempt);
      }

      const next = await revealReply(
        conversationAttempt,
        apiResult.reply,
        operation,
      );
      if (!next) return;
      pendingTurnRef.current = undefined;

      if (next.status === "awaiting_judgment") {
        await finishJudgment(next, operation);
      } else {
        busyRef.current = false;
      }
    },
    [
      commitAttempt,
      finishJudgment,
      revealReply,
      scenario.id,
      scenario.mode,
    ],
  );

  const submit = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      const current = attemptRef.current;
      const validation = validateResponse(input);
      if (busyRef.current || current.status !== "active") return;
      if (!validation.ok && validation.reason === "empty") {
        setInputError("Give the moment one real line before sending.");
        return;
      }
      if (!validation.ok) {
        setInputError(`Keep it under ${MAX_RESPONSE_LENGTH} characters.`);
        return;
      }

      const withUser = beginTurn(current, validation.body);
      if (withUser === current || withUser.userTurn === 0) return;

      busyRef.current = true;
      draftAbortRef.current?.abort();
      setDraftPreparing(false);
      const operation = ++operationRef.current;
      const pending: PendingTurn = {
        turn: withUser.userTurn,
        body: validation.body,
      };
      pendingTurnRef.current = pending;
      setInput("");
      setInputError(undefined);
      commitAttempt(withUser);
      await requestReaction(withUser, pending, operation);
    },
    [commitAttempt, input, requestReaction],
  );

  const retryPersona = useCallback(async () => {
    const current = attemptRef.current;
    const pending = pendingTurnRef.current;
    if (
      busyRef.current ||
      current.status !== "error" ||
      current.error?.code !== "persona_unavailable" ||
      current.error.retryable === false ||
      !pending
    ) {
      return;
    }
    busyRef.current = true;
    const operation = ++operationRef.current;
    const withUser: Attempt = {
      ...current,
      status: "awaiting_reply",
      error: undefined,
    };
    commitAttempt(withUser);
    await requestReaction(withUser, pending, operation);
  }, [commitAttempt, requestReaction]);

  const endConversation = useCallback(async () => {
    const current = attemptRef.current;
    if (
      busyRef.current ||
      current.status !== "active" ||
      current.userTurn < MIN_CONVERSATION_TURNS
    ) {
      return;
    }
    busyRef.current = true;
    const operation = ++operationRef.current;
    await finishJudgment(current, operation);
  }, [finishJudgment]);

  const retryJudgment = useCallback(async () => {
    const current = attemptRef.current;
    if (
      busyRef.current ||
      current.status !== "error" ||
      current.error?.code.startsWith("persona_") ||
      current.error?.retryable === false
    ) {
      return;
    }
    busyRef.current = true;
    const operation = ++operationRef.current;
    await finishJudgment(current, operation);
  }, [finishJudgment]);

  const reset = useCallback(() => {
    operationRef.current += 1;
    busyRef.current = false;
    draftAbortRef.current?.abort();
    pendingTurnRef.current = undefined;
    sessionTokenRef.current = undefined;
    const next = createAttempt(scenario);
    commitAttempt(next);
    setInput("");
    setInputError(undefined);
    setReceipt(undefined);
  }, [commitAttempt, scenario]);

  return {
    attempt,
    input,
    inputError,
    receipt,
    setInput,
    submit,
    retryPersona,
    retryJudgment,
    endConversation,
    reset,
    canEnd:
      attempt.status === "active" &&
      attempt.userTurn >= MIN_CONVERSATION_TURNS,
    isBusy:
      attempt.status === "awaiting_reply" ||
      attempt.status === "awaiting_judgment",
    isPersonaTyping:
      draftPreparing ||
      (attempt.status === "awaiting_reply" &&
        (scenario.mode === "in_person" ||
          [...attempt.messages]
            .reverse()
            .find((message) => message.speaker === "you")?.deliveryStatus ===
            "seen")),
  };
}

export function completedJudgment(attempt: Attempt): JudgeResult | undefined {
  return attempt.status === "complete" ? attempt.result : undefined;
}
