import { DOCUMENT_TYPES } from "../constants";
import { planPolicies, type SetupPlan } from "../setup/setup-plan";

// The only place setup document shapes live. init, the demo seed and the live evals all write
// these, so the README, the CLI and the code cannot drift apart.

export type SetupDocument = { _id: string; _type: string } & Record<
  string,
  unknown
>;

const slug = (current: string) => ({ _type: "slug", current });
const reference = (id: string) => ({ _type: "reference", _ref: id });

export function toSetupDocuments(plan: SetupPlan): SetupDocument[] {
  const policies = planPolicies(plan).map(
    ({ id, slug: policySlug, ...fields }) => ({
      _id: id,
      _type: DOCUMENT_TYPES.policy,
      slug: slug(policySlug),
      ...fields,
    }),
  );

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
    defaultPolicy: reference(plan.policy.id),
    presets: plan.presets.map((preset) => ({
      _key: preset.slug,
      ...reference(preset.id),
    })),
  };

  return [...policies, ...presets, application];
}
