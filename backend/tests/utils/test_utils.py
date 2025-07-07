import pytest
import pandas as pd
from utils.data_preprocessing import (
    clean_data,
    handle_missing_values,
    encode_categorical_data,
    scale_numerical_data
)
from utils.validation import (
    validate_file_type,
    validate_data_structure,
    validate_embedding_parameters
)

class TestDataPreprocessing:
    def test_clean_data_success(self):
        """Test successful data cleaning"""
        data = pd.DataFrame({
            'numeric': [1.0, 2.0, None, 4.0],
            'categorical': ['A', 'B', 'A', None],
            'mixed': [1, 'text', 3, 4]
        })
        
        cleaned = clean_data(data)
        
        assert isinstance(cleaned, pd.DataFrame)
        assert cleaned.shape[0] <= data.shape[0]  # May remove rows

    def test_handle_missing_values(self):
        """Test missing value handling"""
        data = pd.DataFrame({
            'numeric': [1.0, 2.0, None, 4.0],
            'categorical': ['A', 'B', None, 'B']
        })
        
        result = handle_missing_values(data)
        
        assert not result.isnull().any().any()

    def test_encode_categorical_data(self):
        """Test categorical data encoding"""
        data = pd.DataFrame({
            'category': ['A', 'B', 'C', 'A'],
            'numeric': [1, 2, 3, 4]
        })
        
        encoded = encode_categorical_data(data)
        
        # Should have more columns after encoding
        assert encoded.shape[1] >= data.shape[1]

    def test_scale_numerical_data(self):
        """Test numerical data scaling"""
        data = pd.DataFrame({
            'feature1': [1, 100, 1000],
            'feature2': [0.1, 0.5, 0.9]
        })
        
        scaled = scale_numerical_data(data)
        
        # Values should be scaled
        assert scaled['feature1'].std() < data['feature1'].std()

class TestValidation:
    def test_validate_file_type_csv(self):
        """Test CSV file type validation"""
        assert validate_file_type("data.csv") is True
        assert validate_file_type("DATA.CSV") is True

    def test_validate_file_type_excel(self):
        """Test Excel file type validation"""
        assert validate_file_type("data.xlsx") is True
        assert validate_file_type("data.xls") is True

    def test_validate_file_type_json(self):
        """Test JSON file type validation"""
        assert validate_file_type("data.json") is True

    def test_validate_file_type_invalid(self):
        """Test invalid file type validation"""
        assert validate_file_type("data.txt") is False
        assert validate_file_type("data.pdf") is False
        assert validate_file_type("data") is False

    def test_validate_data_structure_valid(self):
        """Test valid data structure validation"""
        data = {
            "headers": ["feature1", "feature2"],
            "data": [[1, 2], [3, 4]]
        }
        
        assert validate_data_structure(data) is True

    def test_validate_data_structure_missing_headers(self):
        """Test data structure validation with missing headers"""
        data = {
            "data": [[1, 2], [3, 4]]
        }
        
        assert validate_data_structure(data) is False

    def test_validate_data_structure_empty_headers(self):
        """Test data structure validation with empty headers"""
        data = {
            "headers": [],
            "data": [[1, 2]]
        }
        
        assert validate_data_structure(data) is False

    def test_validate_embedding_parameters_umap(self):
        """Test UMAP parameter validation"""
        params = {
            "method": "umap",
            "n_neighbors": 15,
            "min_dist": 0.1,
            "n_components": 2
        }
        
        assert validate_embedding_parameters(params) is True

    def test_validate_embedding_parameters_tsne(self):
        """Test t-SNE parameter validation"""
        params = {
            "method": "tsne",
            "perplexity": 30,
            "learning_rate": 200,
            "n_components": 2
        }
        
        assert validate_embedding_parameters(params) is True

    def test_validate_embedding_parameters_invalid_method(self):
        """Test parameter validation with invalid method"""
        params = {
            "method": "invalid",
            "n_neighbors": 15
        }
        
        assert validate_embedding_parameters(params) is False

    def test_validate_embedding_parameters_invalid_values(self):
        """Test parameter validation with invalid values"""
        params = {
            "method": "umap",
            "n_neighbors": -1,  # Invalid
            "min_dist": 2.0     # Invalid (should be < 1)
        }
        
        assert validate_embedding_parameters(params) is False 