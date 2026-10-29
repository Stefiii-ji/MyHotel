export function errorHandler(error, _request, response, next) {
  if (response.headersSent) {
    next(error);
    return;
  }

  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : Number.isInteger(error.status) && error.status >= 400 && error.status < 500
      ? error.status
      : 500;

  if (statusCode >= 500) {
    console.error({
      name: error?.name ?? 'Error',
      statusCode,
    });
  }

  response.status(statusCode).json({
    status: 'error',
    message: getPublicErrorMessage(error, statusCode),
  });
}

function getPublicErrorMessage(error, statusCode) {
  if (statusCode < 500 && error?.exposeToClient === true) return error.message;
  if (statusCode === 400) return 'Invalid request';
  if (statusCode === 401) return 'Authentication is required';
  if (statusCode === 403) return 'Request is not authorized';
  if (statusCode === 404) return 'Resource not found';
  if (statusCode === 409) return 'Request conflicts with the current state';
  if (statusCode === 413) return 'Request body is too large';
  if (statusCode === 415) return 'Unsupported content type';
  if (statusCode === 429) return 'Too many requests. Please try again later.';
  if (statusCode === 502) return 'OpenStreetMap mirrors failed; no import was completed.';
  if (statusCode === 503) return 'Service temporarily unavailable';
  if (statusCode === 504) return 'OpenStreetMap mirrors timed out; no import was completed.';
  return statusCode >= 500
    ? 'An unexpected server error occurred'
    : 'Request could not be completed';
}
