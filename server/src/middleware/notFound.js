import { httpError } from '../utils/httpError.js';

export function notFound(request, response, next) {
  next(httpError(404, 'Route not found'));
}
