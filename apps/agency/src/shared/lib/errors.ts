export function getErrorMessage(error: unknown, fallback = "The API request failed. Check the backend service and try again.") {
  return error instanceof Error && error.message ? error.message : fallback;
}
