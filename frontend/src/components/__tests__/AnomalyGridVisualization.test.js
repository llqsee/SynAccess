import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmbeddingPlot from '../EmbeddingPlot';

// Ensure ResizeObserver is mocked for this suite
beforeEach(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Mock the anomaly detection service with default export
jest.mock('../../services/anomalyDetectionService', () => ({
  __esModule: true,
  default: {
    detectAnomalies: jest.fn(),
    generateAnomalyCSV: jest.fn(),
    downloadCSV: jest.fn(),
    validateData: jest.fn().mockReturnValue({ isValid: true, errors: [] })
  }
}));

// Mock container size for SVG rendering
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: function () {
      return { width: 800, height: 600, top: 0, left: 0, bottom: 600, right: 800 };
    }
  });
});

describe('EmbeddingPlot Component', () => {
  const data = [ [1,1],[2,2],[3,3],[1.1,1.1],[2.1,2.1],[3.1,3.1] ];
  const metadata = {
    labels: ['Real','Real','Real','Synthetic','Synthetic','Synthetic'],
    method: 'umap',
    realData: { data: [[1,1],[2,2],[3,3]], headers: ['x','y'] },
    syntheticData: { data: [[1.1,1.1],[2.1,2.1],[3.1,3.1]], headers: ['x','y'] }
  };

  test('renders without crashing', () => {
    render(<EmbeddingPlot data={data} metadata={metadata} />);
    // Just check that the component renders without errors
    expect(document.querySelector('.embedding-plot')).toBeInTheDocument();
  });

  test('displays data points count', () => {
    render(<EmbeddingPlot data={data} metadata={metadata} />);
    // Check for the "6 points" text that we can see in the rendered output
    expect(screen.getByText('6 points')).toBeInTheDocument();
  });
}); 