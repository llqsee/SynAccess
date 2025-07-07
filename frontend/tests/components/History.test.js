import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import History from '../../src/components/History';
import * as api from '../../src/services/api';

// Mock the API module
jest.mock('../../src/services/api');

// Mock Material-UI components that might have issues in test environment
jest.mock('@mui/material/Pagination', () => {
  return function MockPagination({ page, count, onChange }) {
    return (
      <div data-testid="pagination">
        <button onClick={() => onChange(null, Math.max(1, page - 1))}>Previous</button>
        <span>Page {page} of {count}</span>
        <button onClick={() => onChange(null, Math.min(count, page + 1))}>Next</button>
      </div>
    );
  };
});

describe('History Component', () => {
  const mockJobs = [
    {
      id: 1,
      method: 'umap',
      status: 'completed',
      created_at: '2024-01-01T10:00:00Z',
      completed_at: '2024-01-01T10:05:00Z',
      runtime: 300,
      is_favorite: false,
      tags: ['tag1', 'tag2']
    },
    {
      id: 2,
      method: 'tsne',
      status: 'running',
      created_at: '2024-01-01T11:00:00Z',
      completed_at: null,
      runtime: null,
      is_favorite: true,
      tags: []
    }
  ];

  const mockStats = {
    total_jobs: 3,
    completed_jobs: 1,
    running_jobs: 1,
    failed_jobs: 1,
    avg_runtime: 210,
    methods: {
      umap: 2,
      tsne: 1
    }
  };

  const mockLoadFromHistory = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    api.getJobHistory.mockResolvedValue({
      jobs: mockJobs,
      total: 2,
      page: 1,
      per_page: 10
    });
    api.getJobStats.mockResolvedValue(mockStats);
    api.deleteJob.mockResolvedValue({});
    api.toggleJobFavorite.mockResolvedValue({});
    api.loadJobEmbeddings.mockResolvedValue({
      embeddings: { real: [], synthetic: [] },
      metadata: { method: 'umap' }
    });
  });

  describe('Initial Render', () => {
    test('renders loading state initially', () => {
      render(<History loadFromHistory={mockLoadFromHistory} />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    test('renders job history after loading', async () => {
      render(<History loadFromHistory={mockLoadFromHistory} />);
      
      await waitFor(() => {
        expect(screen.getByText('umap')).toBeInTheDocument();
        expect(screen.getByText('tsne')).toBeInTheDocument();
      });
    });

    test('renders statistics after loading', async () => {
      render(<History loadFromHistory={mockLoadFromHistory} />);
      
      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });
  });

  describe('Job Actions', () => {
    test('loads job embeddings when play button is clicked', async () => {
      const user = userEvent.setup();
      render(<History loadFromHistory={mockLoadFromHistory} />);
      
      await waitFor(() => {
        expect(screen.getByText('umap')).toBeInTheDocument();
      });
      
      const playButtons = screen.getAllByRole('button', { name: /load/i });
      await user.click(playButtons[0]);
      
      await waitFor(() => {
        expect(api.loadJobEmbeddings).toHaveBeenCalledWith(1);
        expect(mockLoadFromHistory).toHaveBeenCalled();
      });
    });

    test('toggles favorite status when star button is clicked', async () => {
      const user = userEvent.setup();
      render(<History loadFromHistory={mockLoadFromHistory} />);
      
      await waitFor(() => {
        expect(screen.getByText('umap')).toBeInTheDocument();
      });
      
      const favoriteButtons = screen.getAllByRole('button', { name: /favorite/i });
      await user.click(favoriteButtons[0]);
      
      await waitFor(() => {
        expect(api.toggleJobFavorite).toHaveBeenCalledWith(1);
      });
    });

    test('deletes job when delete button is clicked', async () => {
      const user = userEvent.setup();
      render(<History loadFromHistory={mockLoadFromHistory} />);
      
      await waitFor(() => {
        expect(screen.getByText('umap')).toBeInTheDocument();
      });
      
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);
      
      await waitFor(() => {
        expect(api.deleteJob).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('Filtering and Search', () => {
    test('filters jobs by status', async () => {
      const user = userEvent.setup();
      render(<History loadFromHistory={mockLoadFromHistory} />);
      
      await waitFor(() => {
        expect(screen.getByText('umap')).toBeInTheDocument();
      });
      
      const statusFilter = screen.getByLabelText(/status/i);
      await user.click(statusFilter);
      
      const completedOption = screen.getByText('Completed');
      await user.click(completedOption);
      
      await waitFor(() => {
        expect(api.getJobHistory).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'completed' })
        );
      });
    });
  });

  describe('Error Handling', () => {
    test('handles API errors gracefully', async () => {
      api.getJobHistory.mockRejectedValue(new Error('API Error'));
      
      render(<History loadFromHistory={mockLoadFromHistory} />);
      
      await waitFor(() => {
        expect(screen.getByText(/error loading job history/i)).toBeInTheDocument();
      });
    });
  });
}); 