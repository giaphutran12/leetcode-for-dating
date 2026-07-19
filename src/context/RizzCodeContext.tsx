import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { createProfile, defaultProfile, type OnboardingAnswers } from "../domain/onboarding";
import {
  applyJudgment,
  defaultMilestones,
  defaultProgress,
} from "../domain/progression";
import type {
  Attempt,
  JudgeResult,
  MilestoneId,
  Milestones,
  Progress,
  UserProfile,
} from "../domain/types";
import { getScenario } from "../data/scenarios";
import {
  clearProgressRecords,
  loadAllRecords,
  STORAGE_KEYS,
  type PersistedRecords,
  writeAllRecords,
  writeRecord,
} from "../storage/stores";
import {
  loadAccountRecords,
  mergeAccountRecords,
  saveAccountRecords,
} from "../storage/accountSync";
import { getSupabaseBrowserClient } from "../lib/auth";

type JudgmentReceipt = {
  xpDelta: number;
  isPersonalBest: boolean;
  unlockedAchievements: string[];
};

interface RizzCodeState {
  profile: UserProfile;
  progress: Progress;
  attempts: Attempt[];
  milestones: Milestones;
  storageWarning?: string;
  completeOnboarding: (answers: OnboardingAnswers) => UserProfile;
  skipOnboarding: () => UserProfile;
  saveAttempt: (attempt: Attempt) => void;
  recordJudgment: (attempt: Attempt, result: JudgeResult) => JudgmentReceipt;
  toggleMilestone: (milestone: MilestoneId) => void;
  resetProgress: () => void;
  dismissWarning: () => void;
}

const RizzCodeContext = createContext<RizzCodeState | null>(null);

export function RizzCodeProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const client = getSupabaseBrowserClient();
  const initial = useRef<ReturnType<typeof loadAllRecords> | null>(null);
  if (initial.current === null) initial.current = loadAllRecords();

  const [profile, setProfile] = useState(initial.current.profile);
  const [progress, setProgressState] = useState(initial.current.progress);
  const progressRef = useRef(initial.current.progress);
  const [attempts, setAttempts] = useState(initial.current.attempts);
  const [milestones, setMilestones] = useState(initial.current.milestones);
  const [storageWarning, setStorageWarning] = useState(initial.current.warning);
  const recordsRef = useRef<PersistedRecords>({
    profile: initial.current.profile,
    progress: initial.current.progress,
    attempts: initial.current.attempts,
    milestones: initial.current.milestones,
  });
  const [syncedUserId, setSyncedUserId] = useState<string | null>(null);

  useEffect(() => {
    recordsRef.current = { profile, progress, attempts, milestones };
  }, [attempts, milestones, profile, progress]);

  useEffect(() => {
    const userId = auth.user?.id;
    if (!client || !userId) {
      setSyncedUserId(null);
      return;
    }

    let active = true;
    const syncGuestStateIntoAccount = async () => {
      try {
        const remote = await loadAccountRecords(client, userId);
        const merged = mergeAccountRecords(recordsRef.current, remote);
        await saveAccountRecords(client, userId, merged);
        if (!active) return;
        recordsRef.current = merged;
        setProfile(merged.profile);
        progressRef.current = merged.progress;
        setProgressState(merged.progress);
        setAttempts(merged.attempts);
        setMilestones(merged.milestones);
        setStorageWarning(
          (current) => writeAllRecords(merged) ?? current,
        );
        setSyncedUserId(userId);
      } catch {
        if (!active) return;
        setStorageWarning(
          "Your progress is safe on this device, but account sync is temporarily unavailable.",
        );
      }
    };

    void syncGuestStateIntoAccount();
    return () => {
      active = false;
    };
  }, [auth.user?.id, client]);

  useEffect(() => {
    const userId = auth.user?.id;
    if (!client || !userId || syncedUserId !== userId) return;
    const timeout = window.setTimeout(() => {
      void saveAccountRecords(client, userId, recordsRef.current).catch(() => {
        setStorageWarning(
          "Your progress is safe on this device, but account sync is temporarily unavailable.",
        );
      });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [
    attempts,
    auth.user?.id,
    client,
    milestones,
    profile,
    progress,
    syncedUserId,
  ]);

  const setProgress = useCallback((next: Progress) => {
    progressRef.current = next;
    setProgressState(next);
    setStorageWarning((current) => writeRecord(STORAGE_KEYS.progress, next) ?? current);
  }, []);

  const persistProfile = useCallback((next: UserProfile) => {
    setProfile(next);
    setStorageWarning((current) => writeRecord(STORAGE_KEYS.profile, next) ?? current);
    return next;
  }, []);

  const completeOnboarding = useCallback(
    (answers: OnboardingAnswers) => persistProfile(createProfile(answers)),
    [persistProfile],
  );

  const skipOnboarding = useCallback(
    () => persistProfile(createProfile()),
    [persistProfile],
  );

  const saveAttempt = useCallback((attempt: Attempt) => {
    setAttempts((current) => {
      const withoutCurrent = current.filter((item) => item.id !== attempt.id);
      const next = [...withoutCurrent, attempt].slice(-100);
      setStorageWarning(
        (warning) => writeRecord(STORAGE_KEYS.attempts, next) ?? warning,
      );
      return next;
    });
  }, []);

  const recordJudgment = useCallback(
    (attempt: Attempt, result: JudgeResult): JudgmentReceipt => {
      const scenario = getScenario(attempt.scenarioId);
      if (!scenario) {
        return {
          xpDelta: 0,
          isPersonalBest: false,
          unlockedAchievements: [],
        };
      }
      const receipt = applyJudgment({
        progress: progressRef.current,
        attempt,
        scenario,
        result,
      });
      setProgress(receipt.progress);
      return {
        xpDelta: receipt.xpDelta,
        isPersonalBest: receipt.isPersonalBest,
        unlockedAchievements: receipt.unlockedAchievements,
      };
    },
    [setProgress],
  );

  const toggleMilestone = useCallback((milestone: MilestoneId) => {
    setMilestones((current) => {
      const earned = current.earned.includes(milestone)
        ? current.earned.filter((item) => item !== milestone)
        : [...current.earned, milestone];
      const next: Milestones = { version: 1, earned };
      setStorageWarning(
        (warning) => writeRecord(STORAGE_KEYS.milestones, next) ?? warning,
      );
      return next;
    });
  }, []);

  const resetProgress = useCallback(() => {
    const warning = clearProgressRecords();
    setProfile(defaultProfile);
    setProgressState(defaultProgress);
    progressRef.current = defaultProgress;
    setAttempts([]);
    setMilestones(defaultMilestones);
    setStorageWarning(warning);
  }, []);

  return (
    <RizzCodeContext.Provider
      value={{
        profile,
        progress,
        attempts,
        milestones,
        storageWarning,
        completeOnboarding,
        skipOnboarding,
        saveAttempt,
        recordJudgment,
        toggleMilestone,
        resetProgress,
        dismissWarning: () => setStorageWarning(undefined),
      }}
    >
      {children}
    </RizzCodeContext.Provider>
  );
}

export function useRizzCode() {
  const value = useContext(RizzCodeContext);
  if (!value) {
    throw new Error("useRizzCode must be used inside RizzCodeProvider.");
  }
  return value;
}
