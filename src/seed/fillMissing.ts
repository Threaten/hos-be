/** Fill empty content and extend short arrays without replacing editor changes. */
export function fillMissing(existing: unknown, defaults: unknown): unknown {
  if (existing === undefined || existing === null || existing === "")
    return defaults;
  if (Array.isArray(defaults)) {
    const result = Array.isArray(existing) ? [...existing] : [];
    const signature = (value: unknown) => {
      return JSON.stringify(value, (key, item) =>
        key === "id" ? undefined : item,
      );
    };
    const known = new Set(result.map(signature));
    for (const item of defaults) {
      if (result.length >= defaults.length) break;
      if (!known.has(signature(item))) {
        result.push(item);
        known.add(signature(item));
      }
    }
    return result;
  }
  if (
    typeof defaults === "object" &&
    defaults !== null &&
    typeof existing === "object" &&
    !Array.isArray(existing)
  ) {
    return Object.fromEntries(
      Object.entries(defaults).map(([key, value]) => [
        key,
        fillMissing((existing as Record<string, unknown>)[key], value),
      ]),
    );
  }
  return existing;
}
