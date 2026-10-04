// Schema files import helpers from @sanity/types, which `sanity` re-exports unchanged. Importing
// `sanity` loads the whole Studio bundle and pushes the gate lane past its 2s budget.
import type { NumberRule } from "@sanity/types";

export const positiveInteger = (rule: NumberRule) => rule.integer().positive();
