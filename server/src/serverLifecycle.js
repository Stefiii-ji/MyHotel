export function startDatabaseConnection({
  connect,
  onConnected,
  onError,
  initialRetryMs = 5000,
  maximumRetryMs = 30000,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let stopping = false;
  let retryTimer = null;
  let retryDelayMs = initialRetryMs;
  let connectionAttempt = null;

  async function attemptConnection() {
    if (stopping) return;
    connectionAttempt = Promise.resolve().then(connect);
    try {
      await connectionAttempt;
      if (!stopping) onConnected();
    } catch (error) {
      onError(error);
      if (!stopping) {
        retryTimer = setTimer(() => {
          retryTimer = null;
          retryDelayMs = Math.min(retryDelayMs * 2, maximumRetryMs);
          void attemptConnection();
        }, retryDelayMs);
        retryTimer.unref?.();
      }
    } finally {
      connectionAttempt = null;
    }
  }

  void attemptConnection();

  return {
    async stop() {
      stopping = true;
      if (retryTimer) {
        clearTimer(retryTimer);
        retryTimer = null;
      }
      if (connectionAttempt) await connectionAttempt.catch(() => {});
    },
  };
}

export function registerGracefulShutdown({
  server,
  disconnect,
  logger = console,
  signalSource = process,
  timeoutMs = 10000,
}) {
  let shutdownPromise = null;

  function shutdown(signal) {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = new Promise((resolve) => {
      logger.info(`Received ${signal}; shutting down StaySwipe.`);
      const forceCloseTimer = setTimeout(() => server.closeAllConnections(), timeoutMs);
      forceCloseTimer.unref?.();

      server.close(async (serverError) => {
        clearTimeout(forceCloseTimer);
        if (serverError) {
          logger.error({ event: 'http_server_shutdown_failed', name: serverError.name });
          process.exitCode = 1;
        }
        try {
          await disconnect();
        } catch (error) {
          logger.error({ event: 'database_shutdown_failed', name: error?.name ?? 'Error' });
          process.exitCode = 1;
        }
        resolve();
      });
    });
    return shutdownPromise;
  }

  const onSigint = () => { void shutdown('SIGINT'); };
  const onSigterm = () => { void shutdown('SIGTERM'); };
  signalSource.once('SIGINT', onSigint);
  signalSource.once('SIGTERM', onSigterm);

  return {
    shutdown,
    removeSignalHandlers() {
      signalSource.removeListener('SIGINT', onSigint);
      signalSource.removeListener('SIGTERM', onSigterm);
    },
  };
}
