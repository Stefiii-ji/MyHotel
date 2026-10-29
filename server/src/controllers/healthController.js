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

export function createReadinessHandler({ isDatabaseReady }) {
  return function getReadiness(_request, response) {
    const databaseReady = isDatabaseReady();
    response.status(databaseReady ? 200 : 503).json({
      status: databaseReady ? 'ready' : 'unavailable',
      database: databaseReady ? 'ready' : 'unavailable',
    });
  };
}
