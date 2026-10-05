import { DOCUMENT_TYPES } from "../constants";
import type { SetupPlan } from "../setup/setup-plan";

// The only place setup document shapes live. init, the demo seed and the live evals all write
// these, so the README, the CLI and the code cannot drift apart.

export type SetupDocument = { _id: string; _type: string } & Record<
  string,
  unknown
>;

const slug = (current: string) => ({ _type: "slug", current });
const reference = (id: string) => ({ _type: "reference", _ref: id });

export function toSetupDocuments(plan: SetupPlan): SetupDocument[] {
  const { id: policyId, slug: policySlug, ...policyFields } = plan.policy;
  const policy = {
    _id: policyId,
    _type: DOCUMENT_TYPES.policy,
    slug: slug(policySlug),
    ...policyFields,
  };

  const presets = plan.presets.map(({ id, slug: presetSlug, ...fields }) => ({
    _id: id,
    _type: DOCUMENT_TYPES.preset,
    slug: slug(presetSlug),
    ...fields,
  }));

  const application = {
    _id: plan.application.id,
    _type: DOCUMENT_TYPES.application,
    name: plan.application.name,
    slug: slug(plan.application.slug),
    environment: plan.application.environment,
    defaultPolicy: reference(policyId),
    presets: plan.presets.map((preset) => ({
      _key: preset.slug,
      ...reference(preset.id),
    })),
  };

  return [policy, ...presets, application];
}
