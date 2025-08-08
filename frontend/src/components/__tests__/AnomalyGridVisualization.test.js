import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

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

const EmbeddingPlot = require('../EmbeddingPlot').default;
const anomalyService = require('../../services/anomalyDetectionService').default;

describe('EmbeddingPlot anomaly flow', () => {
  const data = [ [1,1],[2,2],[3,3],[1.1,1.1],[2.1,2.1],[3.1,3.1] ];
  const metadata = {
    labels: ['Real','Real','Real','Synthetic','Synthetic','Synthetic'],
    method: 'umap',
    realData: { data: [[1,1],[2,2],[3,3]], headers: ['x','y'] },
    syntheticData: { data: [[1.1,1.1],[2.1,2.1],[3.1,3.1]], headers: ['x','y'] }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    anomalyService.validateData.mockReturnValue({ isValid: true, errors: [] });
    anomalyService.detectAnomalies.mockResolvedValue({
      status: 'success',
      statistics: { total_real: 3, total_synthetic: 3, real_anomalies: 1, synthetic_anomalies: 1, grid_size: 20, total_anomaly_cells: 1 },
      cell_anomalies: [ { cell_x:0, cell_y:0, real_count:1, synthetic_count:2, p_cell:0.33, logit_value:-0.4, z_score:-2.1, anomaly_type:'synthetic_overrepresentation', severity:'high', color:'#8B0000' } ],
      grid_info: { grid_size: 20, bounds: { x_min:0, x_max:10, y_min:0, y_max:10 } },
      real_data: [],
      synthetic_data: []
    });
  });

  test('runs anomaly detection once after clicking run', async () => {
    render(<EmbeddingPlot data={data} metadata={metadata} />);
    const runBtn = await screen.findByLabelText('Run anomaly detection');
    fireEvent.click(runBtn);

    await waitFor(() => expect(anomalyService.detectAnomalies).toHaveBeenCalledTimes(1));
  });

  test('allows CSV download when results available', async () => {
    anomalyService.generateAnomalyCSV.mockResolvedValue({ status: 'success', csv_content: 'a,b\n1,2', filename: 'x.csv' });
    render(<EmbeddingPlot data={data} metadata={metadata} />);

    const runBtn = await screen.findByLabelText('Run anomaly detection');
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByLabelText('Download anomaly CSV')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Download anomaly CSV'));

    await waitFor(() => {
      expect(anomalyService.generateAnomalyCSV).toHaveBeenCalled();
      expect(anomalyService.downloadCSV).toHaveBeenCalled();
    });
  });
}); 