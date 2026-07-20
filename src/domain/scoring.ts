import { CRITERIA, OUTCOME_LABELS } from "./constants";
import type {
  Attempt,
  ConversationTurn,
  Evidence,
  HardGate,
  JudgeModelDraft,
  JudgeResult,
  Scenario,
} from "./types";

type GateMatch = {
  code: string;
  severity: "cap" | "stop";
  turn: ConversationTurn;
  excerpt: string;
  reason: string;
};

const stopPatterns: Array<{
  code: string;
  pattern: RegExp;
  reason: string;
}> = [
  {
    code: "threat_or_coercion",
    pattern:
      /\b(you have no choice|better give me|i(?:'ll| will) (?:hurt|follow|make) you)\b/i,
    reason: "Threats and coercion end the practice immediately.",
  },
  {
    code: "explicit_sexual_pressure",
    pattern:
      /\b(send nudes|sleep with me|have sex with me|you owe me sex|(?:are |r )?(?:u|you) (?:dtf|down to (?:f(?:u|\*)?ck|fk|bang))|(?:i(?:'m| am)? )?(?:just |lowk )?(?:tryna|trying to|wanna|want to) (?:f(?:u|\*)?ck|fk|bang)|we (?:can |should |will )?(?:f(?:u|\*)?ck|fk|bang)|(?:then|after(?:ward)?) (?:we )?(?:f(?:u|\*)?ck|fk|bang))\b/i,
    reason: "Directed sexual pressure is a stop-level violation.",
  },
  {
    code: "private_information",
    pattern: /\b(i found your address|i know where you live|tracked your location)\b/i,
    reason: "Private information cannot be used to pressure or frighten someone.",
  },
  {
    code: "dehumanizing_abuse",
    pattern: /\b(worthless (?:woman|girl)|women are objects|subhuman)\b/i,
    reason: "Dehumanizing abuse is outside respectful practice.",
  },
];

const capPatterns: Array<{
  code: string;
  pattern: RegExp;
  reason: string;
}> = [
  {
    code: "insult_or_negging",
    pattern:
      /\b(not that pretty|you(?:'d| would) look better|for a girl|you are boring|you're boring)\b/i,
    reason: "Insults and negging replace connection with pressure.",
  },
  {
    code: "material_deception",
    pattern:
      /\b(i lied about|i(?:'m| am) pretending to be|fake job|fake name)\b/i,
    reason: "Material deception prevents honest mutual interest.",
  },
  {
    code: "fabricated_familiarity",
    pattern:
      /\b(i saw your private|i researched you|i already know everything about you)\b/i,
    reason: "The response claims familiarity the scenario never established.",
  },
  {
    code: "unsupported_private_fact",
    pattern:
      /\b(i saw your instagram|your home address|your private account)\b/i,
    reason: "The response uses facts that were not observable in the scenario.",
  },
];

function hasExplicitRefusalBefore(attempt: Attempt, turn: number): boolean {
  return attempt.messages.some(
    (message) =>
      message.speaker === "her" &&
      message.turn < turn &&
      /\b(no thanks|not interested|do not (?:think i )?feel|please stop|give me space|do not want|does not work for me|i(?:'m| am) not (?:banging|having sex)|talking first|keep(?:ing)? it respectful)\b/i.test(
        message.body,
      ),
  );
}

function hasLowInterestBefore(attempt: Attempt, turn: number): boolean {
  return attempt.messages.some(
    (message) =>
      message.speaker === "her" &&
      message.turn < turn &&
      /\b(tired|packed|not tonight|maybe another|play it by ear|short break|keeping .* quiet)\b/i.test(
        message.body,
      ),
  );
}

const solicitationPattern =
  /\b(give me (?:your )?(?:number|contact)|go out with me|another chance|meet me|date me|you will change your mind|you'll change your mind|(?:f(?:u|\*)?ck|fk|bang)|sex)\b/i;

function userMessages(attempt: Attempt) {
  return attempt.messages.filter(
    (message): message is typeof message & { turn: ConversationTurn } =>
      message.speaker === "you" && message.turn > 0,
  );
}

export function detectHardGates(attempt: Attempt): HardGate {
  const matches: GateMatch[] = [];

  for (const message of userMessages(attempt)) {
    for (const gate of stopPatterns) {
      if (gate.pattern.test(message.body)) {
        matches.push({
          code: gate.code,
          severity: "stop",
          turn: message.turn,
          excerpt: message.body,
          reason: gate.reason,
        });
      }
    }

    if (
      hasExplicitRefusalBefore(attempt, message.turn) &&
      solicitationPattern.test(message.body)
    ) {
      matches.push({
        code: "continued_after_refusal",
        severity: "stop",
        turn: message.turn,
        excerpt: message.body,
        reason: "The response continues soliciting after an explicit refusal.",
      });
    }

    for (const gate of capPatterns) {
      if (gate.pattern.test(message.body)) {
        matches.push({
          code: gate.code,
          severity: "cap",
          turn: message.turn,
          excerpt: message.body,
          reason: gate.reason,
        });
      }
    }

    if (
      hasLowInterestBefore(attempt, message.turn) &&
      /\b(give me your number|go out with me|meet me tonight)\b/i.test(
        message.body,
      )
    ) {
      matches.push({
        code: "demand_after_low_interest",
        severity: "cap",
        turn: message.turn,
        excerpt: message.body,
        reason: "The response pushes for escalation after clear low interest.",
      });
    }
  }

  const severity = matches.some((match) => match.severity === "stop")
    ? "stop"
    : matches.some((match) => match.severity === "cap")
      ? "cap"
      : "none";
  const relevant =
    severity === "none"
      ? []
      : matches.filter((match) => match.severity === severity);

  return {
    triggered: severity !== "none",
    severity,
    codes: [...new Set(relevant.map((match) => match.code))],
    maxScore: severity === "stop" ? 2 : severity === "cap" ? 4 : 10,
    evidence: relevant.map(
      ({ turn, excerpt, reason }): Evidence => ({ turn, excerpt, reason }),
    ),
  };
}

export function verdictForScore(score: number): JudgeResult["verdict"] {
  if (score <= 3) return "FUMBLED";
  if (score <= 7) return "COOKED";
  return "ATE";
}

function evidenceExists(attempt: Attempt, evidence: Evidence): boolean {
  return userMessages(attempt).some(
    (message) =>
      message.turn === evidence.turn &&
      evidence.excerpt.length > 0 &&
      message.body.includes(evidence.excerpt),
  );
}

function transcriptSupportsOutcome(
  scenario: Scenario,
  attempt: Attempt,
  draft: JudgeModelDraft,
): boolean {
  const code = draft.outcome.code;
  const userTurns = userMessages(attempt);
  const userText = userTurns.map((message) => message.body).join("\n");
  const acceptancePattern =
    /\b(yes|yeah|yep|sure|okay|ok|sounds good|let'?s|i(?:'m| am) (?:down|in)|send me yours|text me|here'?s mine)\b/i;
  const refusalPattern =
    /\b(no|nope|not interested|do not want|don'?t want|can'?t|cannot|rain check|not tonight|rather not|maybe another time)\b/i;
  const personaAcceptedAfter = (pattern: RegExp) => {
    const invitationTurn = [...userTurns]
      .reverse()
      .find((message) => pattern.test(message.body))?.turn;
    if (!invitationTurn) return false;
    const personaText = attempt.messages
      .filter(
        (message) =>
          message.speaker === "her" && message.turn >= invitationTurn,
      )
      .map((message) => message.body)
      .join("\n");
    return (
      acceptancePattern.test(personaText) &&
      !refusalPattern.test(personaText)
    );
  };
  const contactPattern = /\b(number|contact|swap|text you)\b/i;
  const datePattern =
    /\b(coffee|dinner|lunch|date|join me|want to|saturday|thursday)\b/i;

  if (code === "boundary_crossed") {
    return detectHardGates(attempt).triggered;
  }
  if (!scenario.supportedOutcomeCodes.includes(code)) return false;
  if (code === "contact_exchanged") {
    return (
      attempt.personaState.engagement === "warm" &&
      contactPattern.test(userText) &&
      personaAcceptedAfter(contactPattern)
    );
  }
  if (code === "date_invited") {
    return datePattern.test(userText);
  }
  if (code === "date_agreed") {
    return (
      attempt.personaState.engagement === "warm" &&
      datePattern.test(userText) &&
      personaAcceptedAfter(datePattern)
    );
  }
  if (code === "graceful_exit") {
    return scenario.fallback.exitSignals.some((signal) =>
      userText.toLowerCase().includes(signal.toLowerCase()),
    );
  }
  return true;
}

export function finalizeJudgeResult(input: {
  attemptId: string;
  scenario: Scenario;
  attempt: Attempt;
  draft: JudgeModelDraft;
}): JudgeResult {
  const { attemptId, scenario, attempt } = input;
  const hardGate = detectHardGates(attempt);
  const draft =
    hardGate.severity === "stop"
      ? {
          ...input.draft,
          outcome: {
            code: "boundary_crossed" as const,
            label: OUTCOME_LABELS.boundary_crossed,
            confidence: "high" as const,
            basis: hardGate.evidence,
          },
        }
      : input.draft;
  const ids = draft.rubric.map((item) => item.id);

  if (
    draft.rubric.length !== CRITERIA.length ||
    new Set(ids).size !== CRITERIA.length ||
    CRITERIA.some((id) => !ids.includes(id))
  ) {
    throw new Error("Judge output must contain five unique rubric criteria.");
  }

  for (const item of draft.rubric) {
    if (
      !Number.isInteger(item.score) ||
      item.score < 0 ||
      item.score > 2 ||
      !evidenceExists(attempt, item.evidence)
    ) {
      throw new Error("Judge rubric evidence or score is invalid.");
    }
  }

  if (
    draft.outcome.basis.length === 0 ||
    draft.outcome.basis.some((evidence) => !evidenceExists(attempt, evidence))
  ) {
    throw new Error("Judge outcome evidence is invalid.");
  }

  if (!transcriptSupportsOutcome(scenario, attempt, draft)) {
    throw new Error("Judge outcome is unsupported by the transcript.");
  }

  const rawScore = draft.rubric.reduce((sum, item) => sum + item.score, 0);
  const finalScore = Math.min(rawScore, hardGate.maxScore);

  return {
    schemaVersion: "1.0",
    attemptId,
    mode: "llm",
    hardGate,
    rubric: draft.rubric,
    rawScore,
    finalScore,
    verdict: verdictForScore(finalScore),
    worked: draft.worked,
    improve: draft.improve,
    betterResponse: draft.betterResponse,
    outcome: {
      ...draft.outcome,
      label: OUTCOME_LABELS[draft.outcome.code],
    },
  };
}
