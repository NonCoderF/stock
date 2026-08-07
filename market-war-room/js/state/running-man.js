import { state } from "./app-state.js";

const STORAGE_RUNNING_MAN = "market-war-room:running-man";

export function createRunningManRunId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return [
    Date.now().toString(16),
    Math.random().toString(16).slice(2),
    Math.random().toString(16).slice(2)
  ].join("-");
}

export function startRunningManSession() {
  state.runningMan = {
    runId: createRunningManRunId(),
    observationNo: 0,
    active: true,
    lastPersistence: null,
    startedAt: new Date().toISOString()
  };

  persistRunningManClientState();
}

export function nextRunningManObservation() {
  if (!state.runningMan.active) {
    startRunningManSession();
  }

  const current = state.runningMan.observationNo;
  state.runningMan.observationNo = current + 1;

  persistRunningManClientState();

  return {
    runId: state.runningMan.runId,
    observationNo: current
  };
}

export function persistRunningManClientState() {
  try {
    sessionStorage.setItem(
      STORAGE_RUNNING_MAN,
      JSON.stringify(state.runningMan)
    );
  } catch (error) {
    console.warn("Unable to persist Running Man client state.", error);
  }
}

export function restoreRunningManClientState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_RUNNING_MAN);

    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);

    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.runId === "string"
    ) {
      state.runningMan = {
        runId: parsed.runId,
        observationNo: Number.isInteger(parsed.observationNo)
          ? parsed.observationNo
          : 0,
        active: parsed.active === true,
        lastPersistence: parsed.lastPersistence || null,
        startedAt: parsed.startedAt || null
      };
    }
  } catch (error) {
    console.warn("Unable to restore Running Man state.", error);
  }
}

export function shortRunId(runId) {
  if (!runId) {
    return "\u2014";
  }

  return String(runId).slice(0, 8);
}

export function getPersistencePresentation(persistence) {
  switch (persistence?.status) {
    case "SAVED":
      return {
        label: "SAVED",
        tone: "saved"
      };

    case "ERROR":
      return {
        label: "SAVE ERROR",
        tone: "error"
      };

    case "SKIPPED":
      return {
        label: "NOT PERSISTED",
        tone: "skipped"
      };

    default:
      return {
        label: "\u2014",
        tone: "idle"
      };
  }
}

export function renderRunningManStatus(persistence) {
  const root = document.querySelector("#running-man-status");

  if (!root) {
    return;
  }

  const presentation = getPersistencePresentation(persistence);
  const runElement = document.querySelector("#running-man-run");
  const observationElement = document.querySelector("#running-man-observation");
  const persistenceElement = document.querySelector("#running-man-persistence");
  const savedAtElement = document.querySelector("#running-man-saved-at");
  const warningElement = document.querySelector("#running-man-warning");

  if (runElement) {
    runElement.textContent = shortRunId(
      persistence?.runId || state.runningMan.runId
    );
  }

  if (observationElement) {
    observationElement.textContent = state.runningMan.runId
      ? String(
          persistence?.observationNo ??
            Math.max(0, state.runningMan.observationNo - 1)
        )
      : "\u2014";
  }

  if (persistenceElement) {
    persistenceElement.textContent = presentation.label;
    persistenceElement.dataset.tone = presentation.tone;
  }

  if (savedAtElement) {
    savedAtElement.textContent = persistence?.persistedAt
      ? new Date(persistence.persistedAt).toLocaleTimeString()
      : "\u2014";
  }

  if (warningElement) {
    warningElement.hidden = persistence?.status !== "ERROR";
  }
}
