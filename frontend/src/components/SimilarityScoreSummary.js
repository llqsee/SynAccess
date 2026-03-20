import React from 'react';
import { Box, Typography } from '@mui/material';

const formatScore = value => (Number.isFinite(value) ? value.toFixed(1) : 'N/A');

const SimilarityScoreSummary = ({ summary }) => {
  const resolvedSummary = summary || {};

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 1, borderBottom: '0.1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2">Similarity Score Summary</Typography>
      </Box>

      <Box sx={{ p: 1, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
        <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'rgba(248, 250, 252, 0.7)' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Overall Similarity Score
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {formatScore(resolvedSummary.overallScore)}
          </Typography>
        </Box>

        <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'rgba(248, 250, 252, 0.7)' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Multi-variable Score
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {formatScore(resolvedSummary.multiVariableScore)}
          </Typography>
        </Box>

        <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'rgba(248, 250, 252, 0.7)' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Anomaly Burden Score
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {formatScore(resolvedSummary.anomalyScore)}
          </Typography>
        </Box>

        <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'rgba(248, 250, 252, 0.7)' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Bivariate Score
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {formatScore(resolvedSummary.bivariateScore)}
          </Typography>
        </Box>

        <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'rgba(248, 250, 252, 0.7)' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Structural Validity Score
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {formatScore(resolvedSummary.structuralScore)}
          </Typography>
          {/* <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Missing: {resolvedSummary.structuralChecks?.missingColumns || 0} | Extra: {resolvedSummary.structuralChecks?.extraColumns || 0}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Shared: {resolvedSummary.structuralChecks?.sharedColumns || 0} | Type mismatch: {resolvedSummary.structuralChecks?.typeMismatches || 0}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Invalid categories: {resolvedSummary.structuralChecks?.invalidCategoryValues || 0}/{resolvedSummary.structuralChecks?.checkedCategoricalValues || 0}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Out-of-range numeric: {resolvedSummary.structuralChecks?.outOfRangeValues || 0}/{resolvedSummary.structuralChecks?.checkedNumericValues || 0}
          </Typography> */}
        </Box>

        <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'rgba(248, 250, 252, 0.7)' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Univariate Similarity Score
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {formatScore(resolvedSummary.univariateScore)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default SimilarityScoreSummary;
