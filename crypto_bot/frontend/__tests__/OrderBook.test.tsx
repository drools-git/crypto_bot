import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { OrderBook } from '../components/OrderBook';

describe('OrderBook Component', () => {
  let wsInstance: any;

  beforeEach(() => {
    // Intercept WebSocket creation to trigger messages
    const OriginalWebSocket = global.WebSocket;
    global.WebSocket = class extends OriginalWebSocket {
      constructor(url: string) {
        super(url);
        wsInstance = this;
      }
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders initial state correctly', () => {
    render(<OrderBook symbol="BTC/USDT" />);
    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Spread: ---')).toBeInTheDocument();
  });

  it('updates state when websocket receives data', async () => {
    render(<OrderBook symbol="BTC/USDT" />);
    
    act(() => {
      if (wsInstance && wsInstance.onmessage) {
        wsInstance.onmessage({
          data: JSON.stringify({
            bids: [["50000.00", "1.5000"]],
            asks: [["50010.00", "0.5000"]]
          })
        });
      }
    });

    // Check if the mock data rendered
    expect(screen.getByText('50000.00')).toBeInTheDocument();
    expect(screen.getByText('1.5000')).toBeInTheDocument();
    expect(screen.getAllByText('50010.00').length).toBeGreaterThan(0);
    expect(screen.getByText('0.5000')).toBeInTheDocument();
    
    // Check spread
    expect(screen.getByText('Spread: 10.00')).toBeInTheDocument();
  });
});
