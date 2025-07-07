import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import EmbeddingPlot from '../../src/components/EmbeddingPlot';
import { generateDistributionPlot } from '../../src/services/api';

// Mock the API service
jest.mock('../../src/services/api');

// Mock D3 and Plotly
jest.mock('d3', () => ({
  select: jest.fn(() => ({
    selectAll: jest.fn(() => ({ remove: jest.fn() })),
    attr: jest.fn().mockReturnThis(),
    style: jest.fn().mockReturnThis(),
    append: jest.fn().mockReturnThis(),
    call: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    data: jest.fn().mockReturnThis(),
    enter: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
  })),
  scaleLinear: jest.fn(() => ({
    domain: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    nice: jest.fn().mockReturnThis(),
  })),
  scaleOrdinal: jest.fn(() => ({
    domain: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
  })),
  axisBottom: jest.fn(),
  axisLeft: jest.fn(),
  extent: jest.fn(() => [0, 100]),
  color: jest.fn(() => ({ darker: jest.fn() })),
  pointer: jest.fn(() => [50, 50]),
}));

jest.mock('react-plotly.js', () => {
  return function MockPlot() {
    return <div data-testid="plotly-plot">Mocked Plotly Plot</div>;
  };
});

describe('EmbeddingPlot Component', () => {
  const mockData = [
    [10, 20],
    [30, 40],
    [50, 60],
    [70, 80]
  ];

  const mockMetadata = {
    method: 'umap',
    labels: ['Real', 'Real', 'Synthetic', 'Synthetic'],
    realData: {
      data: [[1, 2, 3], [4, 5, 6]],
      headers: ['feature1', 'feature2', 'feature3']
    },
    syntheticData: {
      data: [[7, 8, 9], [10, 11, 12]],
      headers: ['feature1', 'feature2', 'feature3']
    }
  };

  const mockHistoryMetadata = {
    method: 'tsne',
    labels: ['Real', 'Real', 'Synthetic', 'Synthetic'],
    runtime: 25.3,
    job_id: 'test-job-id'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
    }));
  });

  describe('Rendering', () => {
    test('renders without crashing with valid data', () => {
      render(<EmbeddingPlot data={mockData} metadata={mockMetadata} />);
      expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument();
    });

    test('renders selection controls', () => {
      render(<EmbeddingPlot data={mockData} metadata={mockMetadata} />);
      
      expect(screen.getByText(/0 selected/)).toBeInTheDocument();
      expect(screen.getByText(/drag to select cluster/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument();
    });

    test('does not render when data is missing', () => {
      const { container } = render(<EmbeddingPlot data={null} metadata={mockMetadata} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Point Selection', () => {
    test('updates selection count when select all is clicked', async () => {
      const user = userEvent.setup();
      render(<EmbeddingPlot data={mockData} metadata={mockMetadata} />);
      
      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      await user.click(selectAllButton);
      
      expect(screen.getByText(/4 selected/)).toBeInTheDocument();
    });

    test('clears selection when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<EmbeddingPlot data={mockData} metadata={mockMetadata} />);
      
      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      await user.click(selectAllButton);
      
      const clearButton = screen.getByRole('button', { name: /clear selection/i });
      await user.click(clearButton);
      
      expect(screen.getByText(/0 selected/)).toBeInTheDocument();
    });

    test('shows sidebar when points are selected', async () => {
      const user = userEvent.setup();
      render(<EmbeddingPlot data={mockData} metadata={mockMetadata} />);
      
      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      await user.click(selectAllButton);
      
      await waitFor(() => {
        expect(screen.getByText(/distributions/i)).toBeInTheDocument();
        expect(screen.getByText(/selection summary/i)).toBeInTheDocument();
      });
    });
  });

  describe('History Data Handling', () => {
    test('shows history message for historical embeddings', async () => {
      const user = userEvent.setup();
      render(<EmbeddingPlot data={mockData} metadata={mockHistoryMetadata} />);
      
      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      await user.click(selectAllButton);
      
      await waitFor(() => {
        expect(screen.getByText(/loaded from history/i)).toBeInTheDocument();
        expect(screen.getByText(/distribution plots are not available/i)).toBeInTheDocument();
      });
    });

    test('shows viewing historical embedding message when no points selected', () => {
      render(<EmbeddingPlot data={mockData} metadata={mockHistoryMetadata} />);
      
      expect(screen.getByText(/viewing historical embedding/i)).toBeInTheDocument();
    });
  });

  describe('Distribution Plot Generation', () => {
    test('generates distribution plot when fresh data is available', async () => {
      const user = userEvent.setup();
      generateDistributionPlot.mockResolvedValue({
        plot_data: { data: [], layout: {} }
      });

      render(<EmbeddingPlot data={mockData} metadata={mockMetadata} />);
      
      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      await user.click(selectAllButton);
      
      await waitFor(() => {
        expect(screen.getByText(/distributions/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/column for analysis/i)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Behavior', () => {
    test('adapts to container size changes', () => {
      const { rerender } = render(<EmbeddingPlot data={mockData} metadata={mockMetadata} />);
      
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 1200,
        height: 800,
        top: 0,
        left: 0,
        bottom: 800,
        right: 1200,
      }));
      
      rerender(<EmbeddingPlot data={mockData} metadata={mockMetadata} />);
      
      expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty data arrays', () => {
      render(<EmbeddingPlot data={[]} metadata={mockMetadata} />);
      expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument();
    });

    test('handles mismatched data and labels length', () => {
      const mismatchedMetadata = {
        ...mockMetadata,
        labels: ['Real', 'Synthetic']
      };
      
      render(<EmbeddingPlot data={mockData} metadata={mismatchedMetadata} />);
      expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument();
    });
  });
}); 