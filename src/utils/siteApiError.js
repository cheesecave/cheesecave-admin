import { parseApiError } from "../shared/api-error.js";

// Keep the existing Site settings contract, including local validation errors.
export function getSiteApiErrorMessage(error, fallback) {
  return parseApiError(error, fallback, {
    preferRequestMessage: true,
    includeThrownError: true,
  });
}
