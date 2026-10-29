export function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.exposeToClient = statusCode < 500;
  return error;
}
