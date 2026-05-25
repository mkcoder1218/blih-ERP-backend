export function pick<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  keys.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(obj, k)) (out as any)[k] = obj[k];
  });
  return out;
}

