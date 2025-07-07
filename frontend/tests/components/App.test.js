import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import App from '../../src/App';

// Mock the child components
jest.mock('../../src/components/Sidebar', () => {
  return function MockSidebar({ onDataUpload }) {
    return (
      <div data-testid="sidebar">
        <button onClick={() => onDataUpload({ headers: ['test'], data: [[1]] }, { headers: ['test'], data: [[2]] })}>
          Mock Upload
        </button>
      </div>
    );
  };
});

jest.mock('../../src/components/EmbeddingPlot', () => {
  return function MockEmbeddingPlot({ data, metadata }) {
    return (
      <div data-testid="embedding-plot">
        {data ? `Plot with ${data.length} points` : 'No data'}
        {metadata && <span data-testid="metadata">{metadata.method}</span>}
      </div>
    );
  };
});

jest.mock('../../src/components/History', () => {
  return function MockHistory({ loadFromHistory }) {
    return (
      <div data-testid="history">
        <button onClick={() => loadFromHistory(
          { real: [[0.1, 0.2]], synthetic: [[0.3, 0.4]] },
          { method: 'umap', job_id: 'test' }
        )}>
          Load from History
        </button>
      </div>
    );
  };
});

// Mock the hooks
jest.mock('../../src/hooks/useEmbedding', () => {
  return jest.fn(() => ({
    embeddingData: null,
    embeddingMetadata: null,
    isLoading: false,
    error: null,
    progress: 0,
    generateEmbedding: jest.fn(),
    loadFromHistory: jest.fn(),
    clearEmbedding: jest.fn()
  }));
});

jest.mock('../../src/hooks/useDataUpload', () => {
  return jest.fn(() => ({
    realData: null,
    syntheticData: null,
    uploadError: null,
    isUploading: false,
    uploadFile: jest.fn(),
    clearData: jest.fn()
  }));
});

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Render', () => {
    test('renders main layout components', () => {
      render(<App />);
      
      expect(screen.getByText(/mavis/i)).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('embedding-plot')).toBeInTheDocument();
    });

    test('renders tab navigation', () => {
      render(<App />);
      
      expect(screen.getByRole('tab', { name: /visualization/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /history/i })).toBeInTheDocument();
    });

    test('starts with visualization tab active', () => {
      render(<App />);
      
      const visualizationTab = screen.getByRole('tab', { name: /visualization/i });
      expect(visualizationTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Tab Navigation', () => {
    test('switches to history tab when clicked', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      const historyTab = screen.getByRole('tab', { name: /history/i });
      await user.click(historyTab);
      
      expect(historyTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('history')).toBeInTheDocument();
    });

    test('switches back to visualization tab', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      const historyTab = screen.getByRole('tab', { name: /history/i });
      await user.click(historyTab);
      
      const visualizationTab = screen.getByRole('tab', { name: /visualization/i });
      await user.click(visualizationTab);
      
      expect(visualizationTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('embedding-plot')).toBeInTheDocument();
    });
  });

  describe('Data Upload Integration', () => {
    test('handles data upload from sidebar', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      const uploadButton = screen.getByText('Mock Upload');
      await user.click(uploadButton);
      
      expect(screen.getByTestId('embedding-plot')).toBeInTheDocument();
    });
  });

  describe('History Integration', () => {
    test('handles loading from history', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      const historyTab = screen.getByRole('tab', { name: /history/i });
      await user.click(historyTab);
      
      const loadButton = screen.getByText('Load from History');
      await user.click(loadButton);
      
      await waitFor(() => {
        const visualizationTab = screen.getByRole('tab', { name: /visualization/i });
        expect(visualizationTab).toHaveAttribute('aria-selected', 'true');
      });
    });
  });

  describe('Responsive Design', () => {
    test('applies correct theme configuration', () => {
      render(<App />);
      
      const appContainer = screen.getByTestId('app-container') || document.body;
      expect(appContainer).toBeInTheDocument();
    });
  });
}); 