import { escape, display } from "./market-view.js";

export function renderError(root, error) {
  root.errorPanel.hidden = false;
  root.errorPanel.innerHTML = `<h2 class="error-title">Observation failed</h2><p>${escape(display(error.message))}</p><details><summary>Technical details</summary><pre>${escape(display(error.stack || error.details))}</pre></details>`;
}

export function clearError(root) {
  root.errorPanel.hidden = true;
  root.errorPanel.innerHTML = "";
}
