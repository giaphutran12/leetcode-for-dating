// The private milestones record (plan: "Persistence" — key
// `rizzcode.v1.milestones`; "Private real-world milestones"). These are
// self-reported real-world wins. They live in their own store, produce private
// badges only, and add ZERO public XP — deliberately decoupled from progress.

import type { Milestone } from "../domain/types";
import { RecordStore, type StorageBackend } from "./storageArea";
import { parseMilestones } from "./validate";

export const MILESTONES_KEY = "rizzcode.v1.milestones";

export function createMilestoneStore(
  backend: StorageBackend,
): RecordStore<Milestone[]> {
  return new RecordStore(backend, MILESTONES_KEY, parseMilestones, () => []);
}
