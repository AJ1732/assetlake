import { DOCUMENT_TYPES, type ImageFitMode } from "../constants.ts";

// Fixed ids so reruns are idempotent. No "." in any id: dotted ids are private paths and would be
// invisible to tokenless reads of the public dataset (sanity.io/docs/content-lake/ids).
export const SEED_IDS = {
  application: "assetlake-application-campus-demo",
  policy: "assetlake-policy-public-profile-images",
  presets: {
    "avatar-sm": "assetlake-preset-avatar-sm",
    avatar: "assetlake-preset-avatar",
    card: "assetlake-preset-card",
    hero: "assetlake-preset-hero",
  },
} as const;

type PresetSlug = keyof typeof SEED_IDS.presets;

type PresetSpec = {
  name: string;
  width: number;
  height: number;
  fit: ImageFitMode;
  quality: number;
};

const PRESET_SPECS: Record<PresetSlug, PresetSpec> = {
  "avatar-sm": {
    name: "Avatar small",
    width: 96,
    height: 96,
    fit: "crop",
    quality: 80,
  },
  avatar: { name: "Avatar", width: 256, height: 256, fit: "crop", quality: 82 },
  card: { name: "Card", width: 640, height: 360, fit: "crop", quality: 80 },
  hero: { name: "Hero", width: 1600, height: 900, fit: "max", quality: 82 },
};

export type SeedDocument = { _id: string; _type: string } & Record<
  string,
  unknown
>;

const slug = (current: string) => ({ _type: "slug", current });
const reference = (id: string) => ({ _type: "reference", _ref: id });

export function seedDocuments(): SeedDocument[] {
  const presetSlugs = Object.keys(PRESET_SPECS) as PresetSlug[];

  const presets = presetSlugs.map((presetSlug) => ({
    _id: SEED_IDS.presets[presetSlug],
    _type: DOCUMENT_TYPES.preset,
    slug: slug(presetSlug),
    autoFormat: true,
    ...PRESET_SPECS[presetSlug],
  }));

  const policy = {
    _id: SEED_IDS.policy,
    _type: DOCUMENT_TYPES.policy,
    name: "Public Profile Images",
    slug: slug("public-profile-images"),
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxFileSizeBytes: 5 * 1024 * 1024,
    requiresReview: false,
  };

  const application = {
    _id: SEED_IDS.application,
    _type: DOCUMENT_TYPES.application,
    name: "Campus Demo",
    slug: slug("campus-demo"),
    environment: "demo",
    defaultPolicy: reference(SEED_IDS.policy),
    presets: presetSlugs.map((presetSlug) => ({
      _key: presetSlug,
      ...reference(SEED_IDS.presets[presetSlug]),
    })),
  };

  return [policy, ...presets, application];
}
