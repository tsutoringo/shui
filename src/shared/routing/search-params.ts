type SearchValue = string | string[];

/**
 * Keep top-level search parameters URLSearchParams-compatible.
 *
 * OAuth redirects can contain repeated, signed parameters. Treating those
 * values as JSON arrays changes the signed query and makes it unverifiable.
 */
export function parseRouterSearch(searchString: string): Record<string, SearchValue> {
  const search: Record<string, SearchValue> = Object.create(null);

  for (const [key, value] of new URLSearchParams(searchString)) {
    const current = search[key];
    if (current === undefined) {
      search[key] = value;
    } else if (Array.isArray(current)) {
      current.push(value);
    } else {
      search[key] = [current, value];
    }
  }

  return search;
}

export function stringifyRouterSearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(search)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      for (const item of value) params.append(key, stringifySearchValue(item));
    } else {
      params.set(key, stringifySearchValue(value));
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

function stringifySearchValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return String(value);
}
