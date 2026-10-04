// The demo story reads small to large; presets added later in the console append alphabetically.
export const MATRIX_PRESET_ORDER = [
  "avatar-sm",
  "avatar",
  "card",
  "hero",
] as const;

export function orderPresets<T extends { slug: string }>(
  presets: readonly T[],
): T[] {
  const rank = (slug: string) => {
    const index = (MATRIX_PRESET_ORDER as readonly string[]).indexOf(slug);
    return index === -1 ? MATRIX_PRESET_ORDER.length : index;
  };
  return [...presets].sort(
    (left, right) =>
      rank(left.slug) - rank(right.slug) || left.slug.localeCompare(right.slug),
  );
}
