const globalEnv = globalThis as typeof globalThis & {
  Deno?: { env: { get(name: string): string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

export const getEnvVar = (name: string): string | undefined => {
  const denoValue = globalEnv.Deno?.env?.get?.(name);
  if (denoValue && denoValue.length > 0) {
    return denoValue;
  }

  const nodeValue = globalEnv.process?.env?.[name];
  return nodeValue && nodeValue.length > 0 ? nodeValue : undefined;
};
