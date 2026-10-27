export function getHealth(_request, response) {
  response.status(200).json({
    status: 'ok',
    message: 'StaySwipe API is running',
    timestamp: new Date().toISOString(),
  });
}
