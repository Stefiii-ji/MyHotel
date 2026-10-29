export function createHealthHandler({ isDatabaseReady }) {
  return function getHealth(_request, response) {
    response.status(200).json({
      status: 'ok',
      database: isDatabaseReady() ? 'ready' : 'unavailable',
      message: 'StaySwipe API is running',
      timestamp: new Date().toISOString(),
    });
  };
}
