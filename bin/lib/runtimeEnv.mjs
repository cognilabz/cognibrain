export const RUNTIME_FORBIDDEN_LLM_ENV_KEYS = ["MEMORY_OPENAI_API_KEY", "OPENAI_API_KEY"];

export function sanitizedRuntimeEnv(env = process.env) {
  const sanitized = { ...env };
  for (const key of RUNTIME_FORBIDDEN_LLM_ENV_KEYS) delete sanitized[key];
  return sanitized;
}
