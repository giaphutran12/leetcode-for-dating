// Scenario flow container (plan: "Required product views" 4-6, one route, three
// phases: intro → practice → result). Owns the practice session and the
// exactly-once result recording. An unknown or locked scenario id redirects back
// to the curriculum with a warm message rather than 404-ing.

import { useLayoutEffect, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { scenarioById } from "../../data/scenarios";
import type { ApplyJudgeResultOutcome } from "../../domain/progression";
import {
  nextRecommendedScenarioId,
  unlockedScenarioIds,
} from "../../domain/progression";
import type { Scenario } from "../../domain/types";
import type { ConversationEngine } from "../../engine/conversationEngine";
import {
  usePracticeSession,
  type JudgeFn,
} from "../../hooks/usePracticeSession";
import { useProgress, type UseProgressResult } from "../../hooks/useProgress";
import { ResultView } from "../results/ResultView";
import { PracticeView } from "./PracticeView";
import { ScenarioIntro } from "./ScenarioIntro";

interface ScenarioSessionProps {
  scenario: Scenario;
  progress: UseProgressResult;
  // Injectable engine/judge for tests; production uses the hook defaults.
  engine?: ConversationEngine;
  judge?: JudgeFn;
}

interface RecordedResult {
  attemptId: string;
  outcome: ApplyJudgeResultOutcome;
}

export function ScenarioSession({
  scenario,
  progress,
  engine,
  judge,
}: ScenarioSessionProps) {
  const session = usePracticeSession({ scenario, engine, judge });
  const [started, setStarted] = useState(false);

  // Exactly-once guard: a completed attempt records progress + the transcript
  // one time only. A re-render, a judge retry after an error, or React strict
  // double-invoke can never double-award, because the attempt id is tracked in a
  // ref that survives every re-render. A fresh attempt (Run it back) has a new
  // id, so it records on its own.
  const recordedIdsRef = useRef<Set<string>>(new Set());
  const [recorded, setRecorded] = useState<RecordedResult | null>(null);

  // useLayoutEffect (not useEffect): the recording runs and flips `recorded`
  // before the browser paints, so PracticeView never flashes composer-less for
  // one frame between the judge completing and ResultView mounting.
  useLayoutEffect(() => {
    const result = session.result;
    if (result === null) return;
    if (recordedIdsRef.current.has(result.attemptId)) return;
    recordedIdsRef.current.add(result.attemptId);
    const outcome = progress.recordResult(scenario, result);
    progress.recordAttempt(session.attempt);
    setRecorded({ attemptId: result.attemptId, outcome });
  }, [session.result, session.attempt, scenario, progress]);

  if (!started) {
    return (
      <ScenarioIntro scenario={scenario} onBegin={() => setStarted(true)} />
    );
  }

  // Once a result exists, we are done with the composer. Gate the render on it
  // so a completed-but-not-yet-recorded frame renders nothing rather than a
  // composer-less PracticeView; the layout effect above records synchronously.
  if (session.result !== null) {
    if (recorded !== null && recorded.attemptId === session.result.attemptId) {
      const nextId = nextRecommendedScenarioId(progress.progress, progress.plan);
      return (
        <ResultView
          scenario={scenario}
          result={session.result}
          outcome={recorded.outcome}
          level={progress.progress.level}
          nextScenarioId={nextId}
          persistent={progress.persistent}
          onRunItBack={session.reset}
        />
      );
    }
    return null;
  }

  return <PracticeView scenario={scenario} session={session} />;
}

export function ScenarioFlow() {
  const { scenarioId } = useParams();
  const progress = useProgress();
  const scenario = scenarioId ? scenarioById(scenarioId) : undefined;

  if (!scenario) {
    return (
      <Navigate
        to="/practice"
        replace
        state={{
          notice:
            "We couldn’t find that scenario — here’s the full lineup instead.",
        }}
      />
    );
  }

  const unlocked = new Set(unlockedScenarioIds(progress.progress));
  if (!unlocked.has(scenario.id)) {
    return (
      <Navigate
        to="/practice"
        replace
        state={{
          notice: `“${scenario.title}” is still locked — clear the one before it first.`,
        }}
      />
    );
  }

  return (
    <ScenarioSession key={scenario.id} scenario={scenario} progress={progress} />
  );
}
