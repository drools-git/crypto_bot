/**
 * Global API Configuration
 * Forced to 127.0.0.1 for maximum stability on Windows.
 */

export const BACKEND_PORT = 8001;

export const getBaseUrl = () => {
  // Always use 127.0.0.1 to avoid IPv6/localhost resolution issues in Chrome/Turbopack
  return `http://127.0.0.1:${BACKEND_PORT}/api/v1`;
};
