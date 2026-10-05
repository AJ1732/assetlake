import type { SanityProject } from "@assetlake/sanity-schema/project";

// One instance per project/dataset. A plain module singleton would keep serving the client of
// whichever target asked first.
export function memoizeByTarget<T>(
  create: (target: SanityProject) => T,
): (target: SanityProject) => T {
  const instances = new Map<string, T>();
  return (target) => {
    const key = `${target.projectId}/${target.dataset}`;
    let instance = instances.get(key);
    if (instance === undefined) {
      instance = create(target);
      instances.set(key, instance);
    }
    return instance;
  };
}
