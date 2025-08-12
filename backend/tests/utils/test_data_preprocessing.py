import pytest
import pandas as pd
import numpy as np
from backend.utils.data_preprocessing import preprocess_data

def test_preprocess_data_numeric_only():
    """Test preprocessing with only numeric data"""
    real_data = [
        [1.0, 2.0, 3.0],
        [4.0, 5.0, 6.0]
    ]
    
    synthetic_data = [
        [1.1, 2.1, 3.1],
        [4.1, 5.1, 6.1]
    ]
    
    real_processed, synth_processed = preprocess_data(real_data, synthetic_data)
    
    assert isinstance(real_processed, np.ndarray)
    assert isinstance(synth_processed, np.ndarray)
    assert real_processed.shape == (2, 3)
    assert synth_processed.shape == (2, 3)
    assert real_processed.dtype == np.float32
    assert synth_processed.dtype == np.float32

def test_preprocess_data_with_categorical():
    """Test preprocessing with categorical data"""
    real_data = [
        ['A', 1.0, 2.0],
        ['B', 3.0, 4.0],
        ['A', 5.0, 6.0]
    ]
    
    synthetic_data = [
        ['A', 1.1, 2.1],
        ['B', 3.1, 4.1],
        ['A', 5.1, 6.1]
    ]
    
    real_processed, synth_processed = preprocess_data(real_data, synthetic_data)
    
    assert isinstance(real_processed, np.ndarray)
    assert isinstance(synth_processed, np.ndarray)
    # Should have more columns due to one-hot encoding (A->0, B->1, plus 2 numeric)
    assert real_processed.shape[1] >= 3  # At least original columns
    assert synth_processed.shape[1] >= 3
    assert real_processed.dtype == np.float32
    assert synth_processed.dtype == np.float32

def test_preprocess_data_mixed_types():
    """Test preprocessing with mixed data types"""
    real_data = [
        ['category1', 1, 2.5],
        ['category2', 2, 3.5],
        ['category1', 3, 4.5]
    ]
    
    synthetic_data = [
        ['category1', 1, 2.6],
        ['category2', 2, 3.6],
        ['category1', 3, 4.6]
    ]
    
    real_processed, synth_processed = preprocess_data(real_data, synthetic_data)
    
    assert isinstance(real_processed, np.ndarray)
    assert isinstance(synth_processed, np.ndarray)
    assert real_processed.shape[0] == 3
    assert synth_processed.shape[0] == 3
    assert real_processed.dtype == np.float32
    assert synth_processed.dtype == np.float32

def test_preprocess_pandas_dataframe():
    """Test preprocessing with pandas DataFrames"""
    real_df = pd.DataFrame({
        'A': [1, 2, 3],
        'B': [4, 5, 6],
        'C': [7, 8, 9]
    })
    
    synthetic_df = pd.DataFrame({
        'A': [1.1, 2.1, 3.1],
        'B': [4.1, 5.1, 6.1],
        'C': [7.1, 8.1, 9.1]
    })
    
    real_processed, synth_processed = preprocess_data(real_df, synthetic_df)
    
    assert isinstance(real_processed, np.ndarray)
    assert isinstance(synth_processed, np.ndarray)
    assert real_processed.shape == (3, 3)
    assert synth_processed.shape == (3, 3)
    assert real_processed.dtype == np.float32
    assert synth_processed.dtype == np.float32

def test_preprocess_empty_data():
    """Test preprocessing with empty data"""
    real_processed, synth_processed = preprocess_data([], [])
    
    assert isinstance(real_processed, np.ndarray)
    assert isinstance(synth_processed, np.ndarray)
    assert real_processed.shape == (0, 0)
    assert synth_processed.shape == (0, 0)

def test_preprocess_invalid_data_type():
    """Test preprocessing with invalid data type"""
    with pytest.raises(ValueError):
        preprocess_data("invalid", "invalid")

def test_preprocess_categorical_only():
    """Test preprocessing with only categorical data"""
    real_data = [
        ['A', 'B', 'C'],
        ['B', 'A', 'C'],
        ['A', 'A', 'B']
    ]
    
    synthetic_data = [
        ['A', 'B', 'C'],
        ['B', 'A', 'C'],
        ['A', 'A', 'B']
    ]
    
    real_processed, synth_processed = preprocess_data(real_data, synthetic_data)
    
    assert isinstance(real_processed, np.ndarray)
    assert isinstance(synth_processed, np.ndarray)
    assert real_processed.shape[0] == 3
    assert synth_processed.shape[0] == 3
    assert real_processed.dtype == np.float32
    assert synth_processed.dtype == np.float32


def test_preprocess_data_with_transformer_reuse():
    """Test that transformer can be saved and reused for consistent preprocessing."""
    # Original data for training
    real_data = [[1.0, 'A'], [2.0, 'B'], [3.0, 'A']]
    synthetic_data = [[1.1, 'A'], [2.1, 'C'], [3.1, 'B']]
    
    # First preprocessing - get the transformer
    real_processed, synth_processed, transformer = preprocess_data(
        real_data, synthetic_data, return_transformer=True
    )
    
    # Verify we got a transformer for categorical data
    assert transformer is not None
    assert hasattr(transformer, 'transform')
    
    # New data for pretrained model (different values but same structure, only known categories)
    new_real_data = [[4.0, 'A'], [5.0, 'B'], [6.0, 'A']]
    new_synthetic_data = [[4.1, 'A'], [5.1, 'B'], [6.1, 'A']]
    
    # Second preprocessing - reuse the transformer (FAST PATH)
    new_real_processed, new_synth_processed = preprocess_data(
        new_real_data, new_synthetic_data, transformer=transformer
    )
    
    # Both should have the same shape (same number of features after encoding)
    assert real_processed.shape[1] == new_real_processed.shape[1]
    assert synth_processed.shape[1] == new_synth_processed.shape[1]
    
    # Verify correct data types
    assert new_real_processed.dtype == np.float32
    assert new_synth_processed.dtype == np.float32


def test_preprocess_data_numeric_only_no_transformer():
    """Test that no transformer is created for purely numeric data."""
    real_data = [[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]]
    synthetic_data = [[1.1, 2.1], [3.1, 4.1], [5.1, 6.1]]
    
    real_processed, synth_processed, transformer = preprocess_data(
        real_data, synthetic_data, return_transformer=True
    )
    
    # For purely numeric data, no transformer is needed
    assert transformer is None
    assert real_processed.shape == (3, 2)
    assert synth_processed.shape == (3, 2)


def test_preprocess_data_with_unknown_categories():
    """Test that unknown categories are handled gracefully with pretrained transformers."""
    # Original data for training
    real_data = [[1.0, 'A'], [2.0, 'B'], [3.0, 'A']]
    synthetic_data = [[1.1, 'A'], [2.1, 'B'], [3.1, 'A']]
    
    # First preprocessing - get the transformer
    real_processed, synth_processed, transformer = preprocess_data(
        real_data, synthetic_data, return_transformer=True
    )
    
    # New data with unknown category 'C' (not seen during training)
    new_real_data = [[4.0, 'A'], [5.0, 'C'], [6.0, 'B']]  # 'C' is unknown
    new_synthetic_data = [[4.1, 'A'], [5.1, 'C'], [6.1, 'B']]
    
    # This should work without raising an error due to handle_unknown='ignore'
    new_real_processed, new_synth_processed = preprocess_data(
        new_real_data, new_synthetic_data, transformer=transformer
    )
    
    # Should have same number of features (unknown categories are ignored)
    assert real_processed.shape[1] == new_real_processed.shape[1]
    assert synth_processed.shape[1] == new_synth_processed.shape[1]
    
    # Verify correct data types
    assert new_real_processed.dtype == np.float32
    assert new_synth_processed.dtype == np.float32 