import { parseApiError } from "../shared/api-error.js";

// Most admin actions previously used their action fallback for network errors.
// Opt in where an existing page instead prefers the request's own message.
export function getApiErrorMessage(
  error,
  fallback,
  { preferRequestMessage = false } = {},
) {
  return parseApiError(error, fallback, { preferRequestMessage });
}
