import { inspect } from "node:util";

export type SerializableData = null | boolean | number | string | SerializableData[] | { readonly [key: string]: SerializableData };

export interface ValueSnapshot {
  readonly summary: string;
  readonly data: SerializableData;
}

export interface SerializedError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly summary: string;
}

export interface TupleSnapshot {
  readonly items: readonly ValueSnapshot[];
  readonly summary: string;
}

export function captureValue(value: unknown): ValueSnapshot {
  return {
    summary: inspect(value, {
      breakLength: Infinity,
      depth: 12,
      maxArrayLength: 50,
      maxStringLength: 200,
      sorted: true
    }),
    data: toSerializableData(value, new WeakMap<object, string>(), "$")
  };
}

export function captureArgs(values: readonly unknown[]): TupleSnapshot {
  const items = values.map((value) => captureValue(value));
  return {
    items,
    summary: `[${items.map((item) => item.summary).join(", ")}]`
  };
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return error.stack === undefined
      ? {
          name: error.name,
          message: error.message,
          summary: `${error.name}: ${error.message}`
        }
      : {
          name: error.name,
          message: error.message,
          stack: error.stack,
          summary: `${error.name}: ${error.message}`
        };
  }

  return {
    name: "NonErrorThrow",
    message: inspect(error, { breakLength: Infinity, depth: 5, sorted: true }),
    summary: `NonErrorThrow: ${inspect(error, { breakLength: Infinity, depth: 3, sorted: true })}`
  };
}

function toSerializableData(
  value: unknown,
  seen: WeakMap<object, string>,
  path: string
): SerializableData {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return value;
    }

    return {
      __type: "number",
      value: String(value)
    };
  }

  if (typeof value === "bigint") {
    return {
      __type: "bigint",
      value: value.toString()
    };
  }

  if (typeof value === "undefined") {
    return {
      __type: "undefined"
    };
  }

  if (typeof value === "symbol") {
    return {
      __type: "symbol",
      value: String(value)
    };
  }

  if (typeof value === "function") {
    return {
      __type: "function",
      name: value.name || "(anonymous)"
    };
  }

  if (value instanceof Date) {
    return {
      __type: "date",
      value: value.toISOString()
    };
  }

  if (value instanceof RegExp) {
    return {
      __type: "regexp",
      source: value.source,
      flags: value.flags
    };
  }

  if (value instanceof Error) {
    return {
      __type: "error",
      name: value.name,
      message: value.message,
      stack: value.stack ?? null
    };
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return {
        __type: "circular",
        path: seen.get(value) ?? "$"
      };
    }

    seen.set(value, path);

    if (Array.isArray(value)) {
      return value.map((entry, index) => toSerializableData(entry, seen, `${path}[${index}]`));
    }

    if (value instanceof Set) {
      return {
        __type: "set",
        values: Array.from(value, (entry, index) => toSerializableData(entry, seen, `${path}.set[${index}]`))
      };
    }

    if (value instanceof Map) {
      return {
        __type: "map",
        entries: Array.from(value.entries(), ([key, entry], index) => [
          toSerializableData(key, seen, `${path}.mapKey[${index}]`),
          toSerializableData(entry, seen, `${path}.mapValue[${index}]`)
        ])
      };
    }

    const output: Record<string, SerializableData> = {};
    for (const key of Object.keys(value).sort()) {
      output[key] = toSerializableData((value as Record<string, unknown>)[key], seen, `${path}.${key}`);
    }
    return output;
  }

  return inspect(value, { breakLength: Infinity, depth: 3, sorted: true });
}
