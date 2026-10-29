const developmentApiBaseUrl = 'http://localhost:5000/api';

export function resolveApiBaseUrl(configuredUrl, isDevelopment) {
  const candidate = typeof configuredUrl === 'string' ? configuredUrl.trim() : '';
  if (!candidate) {
    if (isDevelopment) return developmentApiBaseUrl;
    throw new Error('VITE_API_BASE_URL must be configured for production builds.');
  }

  if (isDevelopment) return candidate;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('VITE_API_BASE_URL must be an absolute HTTPS URL in production.');
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const isLoopback =
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    /^127\./.test(hostname);

  if (url.username || url.password) {
    throw new Error('VITE_API_BASE_URL must not contain credentials.');
  }

  if (url.protocol !== 'https:' || isLoopback) {
    throw new Error('VITE_API_BASE_URL must use a public HTTPS URL in production.');
  }

  return candidate;
}
