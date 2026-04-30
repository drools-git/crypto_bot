import '@testing-library/jest-dom'

// Mock WebSocket
global.WebSocket = class {
  constructor(url) {
    this.url = url;
    this.onmessage = null;
    this.close = jest.fn();
    
    // Simulate connection
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 10);
  }
};

// Mock ResizeObserver
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock fetch
global.fetch = jest.fn();
