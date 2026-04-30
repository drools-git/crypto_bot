import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { TradeTape } from '../components/TradeTape';

describe('TradeTape Component', () => {
  let wsInstance: any;

  beforeEach(() => {
    const OriginalWebSocket = global.WebSocket;
    global.WebSocket = class extends OriginalWebSocket {
      constructor(url: string) {
        super(url);
        wsInstance = this;
      }
    } as any;
  });

  it('renders empty trade tape headers', () => {
    render(<TradeTape symbol="BTC/USDT" />);
    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
  });

  it('displays incoming trades', () => {
    render(<TradeTape symbol="BTC/USDT" />);
    
    act(() => {
      if (wsInstance && wsInstance.onmessage) {
        wsInstance.onmessage({
          data: JSON.stringify({
            t: 12345,
            p: "49000.50",
            q: "0.1000",
            m: true, // maker trade
            T: 1672531200000 // A timestamp
          })
        });
      }
    });

    expect(screen.getByText('49000.50')).toBeInTheDocument();
    expect(screen.getByText('0.1000')).toBeInTheDocument();
    
    // Check if it renders the maker trade correctly (color)
    const priceElement = screen.getByText('49000.50');
    expect(priceElement).toHaveClass('text-rose-500'); // Maker buy (market sell) -> red
  });
});
