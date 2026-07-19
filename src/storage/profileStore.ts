// The profile record (plan: "Persistence" — key `rizzcode.v1.profile`). The
// default is an empty, onboarding-incomplete profile so a first-time visitor
// gets a usable product with no stored data.

import type { UserProfile } from "../domain/types";
import { RecordStore, type StorageBackend } from "./storageArea";
import { parseProfile } from "./validate";

export const PROFILE_KEY = "rizzcode.v1.profile";

export function defaultProfile(): UserProfile {
  return {
    version: 1,
    displayName: "",
    goals: [],
    typeDescription: "",
    desiredRelationship: "",
    struggles: [],
    onboardingComplete: false,
  };
}

export function createProfileStore(
  backend: StorageBackend,
): RecordStore<UserProfile> {
  return new RecordStore(backend, PROFILE_KEY, parseProfile, defaultProfile);
}
