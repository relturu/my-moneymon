// Module-level dev test state — persists across renders / screen navigations.
// Used to coordinate the "Test Fairy Material Functionality" flow.

export type DevTestState = {
  active: boolean;
  claimed: boolean;              // true once user collects from mailbox
  inventoryPendingCleanup: boolean; // true after fairy-log cleanup; triggers inventory cleanup on inventory unfocus
  visitId: string | null;
  fairyId: string | null;
  materialId: string | null;
  startedAt: string | null;     // ISO — collection rows discovered after this are test-created
};

const state: DevTestState = {
  active: false,
  claimed: false,
  inventoryPendingCleanup: false,
  visitId: null,
  fairyId: null,
  materialId: null,
  startedAt: null,
};

export function getDevTest(): DevTestState {
  return state;
}

export function setDevTest(s: Partial<DevTestState>): void {
  Object.assign(state, s);
}

export function clearDevTest(): void {
  Object.assign(state, {
    active: false,
    claimed: false,
    inventoryPendingCleanup: false,
    visitId: null,
    fairyId: null,
    materialId: null,
    startedAt: null,
  });
}
