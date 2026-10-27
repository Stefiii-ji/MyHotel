export function errorHandler(error, _request, response, next) {
  if (response.headersSent) {
    next(error);
    return;
  }

  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;

  if (statusCode >= 500) {
    console.error(error);
  }

  response.status(statusCode).json({
    status: 'error',
    message: statusCode >= 500 ? 'An unexpected server error occurred' : error.message,
  });
}
