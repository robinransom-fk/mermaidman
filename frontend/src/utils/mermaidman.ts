type PlainObject = Record<string, unknown>;

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseLooseSpatial = (body: string): PlainObject => {
  const xMatch = body.match(/\bx\s*:\s*(-?\d+)/i);
  const yMatch = body.match(/\by\s*:\s*(-?\d+)/i);
  const result: PlainObject = {};
  if (xMatch) result.x = Number.parseInt(xMatch[1], 10);
  if (yMatch) result.y = Number.parseInt(yMatch[1], 10);
  return result;
};

const parseDirectiveBody = (body: string | undefined): PlainObject => {
  if (!body) return {};
  try {
    const parsed = JSON.parse(body);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return parseLooseSpatial(body);
  }
};

const mergeObjects = (base: PlainObject, patch: PlainObject): PlainObject => {
  const merged: PlainObject = { ...base };
  Object.entries(patch).forEach(([key, value]) => {
    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = { ...(merged[key] as PlainObject), ...value };
      return;
    }
    merged[key] = value;
  });
  return merged;
};

export const upsertNodeDirective = (
  input: string,
  nodeId: string,
  patch: PlainObject
): string => {
  const escapedId = escapeRegExp(nodeId);
  const directiveRegex = new RegExp(
    `^%%\\s*@node:\\s*${escapedId}\\s*(\\{.*\\})\\s*$`,
    "m"
  );
  const match = input.match(directiveRegex);
  const existingBody = match?.[1];
  const mergedBody = mergeObjects(parseDirectiveBody(existingBody), patch);
  const replacement = `%% @node: ${nodeId} ${JSON.stringify(mergedBody)}`;

  if (match) {
    return input.replace(directiveRegex, replacement);
  }

  const trimmed = input.trimEnd();
  const suffix = trimmed.length > 0 ? "\n" : "";
  return `${trimmed}${suffix}${replacement}\n`;
};
