import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { NewsFeed } from '../components/NewsFeed';

describe('NewsFeed Component', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('renders loading state initially', () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() => 
      new Promise(() => {}) // pending promise
    );
    
    render(<NewsFeed />);
    expect(screen.getByText('Loading market intelligence...')).toBeInTheDocument();
  });

  it('renders news items after fetch', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => [
        {
          title: "Bitcoin hits new ATH",
          source: "CoinTelegraph",
          published_at: 1672531200,
          url: "https://example.com"
        }
      ]
    });

    render(<NewsFeed />);

    await waitFor(() => {
      // Ensure the dynamic host logic falls back to localhost in JSDOM
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/news/latest?limit=15');
      expect(screen.getByText('Bitcoin hits new ATH')).toBeInTheDocument();
      expect(screen.getByText('CoinTelegraph')).toBeInTheDocument();
    });
  });
});
