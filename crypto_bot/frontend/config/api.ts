/**
 * Global API Configuration
 * Centralizes backend connection details.
 */

// On Windows local development, using 127.0.0.1 is more stable than 'localhost'
// to avoid IPv6 (::1) resolution conflicts.
export const BACKEND_PORT = 8001;

export const getBackendHost = () => {
  if (typeof window === 'undefined') return '127.0.0.1';
  const hostname = window.location.hostname;
  return (hostname === 'localhost' || hostname === '::1') ? '127.0.0.1' : hostname;
};

export const getBaseUrl = () => {
  return `http://${getBackendHost()}:${BACKEND_PORT}/api/v1`;
};
