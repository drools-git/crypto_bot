/**
 * Debug utility to send logs to the server terminal (Bash).
 */
export const serverLog = async (message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info') => {
  try {
    // Fire and forget - don't let logging slow down the app
    fetch('/api/debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, level })
    }).catch(() => {}); // Ignore logging errors
  } catch (e) {}
  
  // Also log to browser console for redundancy
  console.log(`%c << ${message} >> `, `font-weight: bold; color: ${level === 'error' ? 'red' : 'inherit'}`);
};
