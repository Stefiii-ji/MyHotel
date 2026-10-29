export function getApiErrorMessage(error, fallback) {
  const message = error?.response?.data?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}
