"""Data compression service for efficient storage.

This service handles compressing and decompressing datasets to save
space and improve performance when storing large amounts of data.
"""
import json
import pickle
import gzip
import lz4.frame
import zstandard as zstd
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Tuple, Optional, Union
from io import BytesIO
import sys
from backend.utils.logging_config import get_logger

class CompressionService:
    """Handles data compression and decompression for storage."""
    
    def __init__(self):
        self.logger = get_logger("compression_service")
        
        # Compression algorithms and their characteristics
        self.algorithms = {
            "gzip": {
                "compress": self._compress_gzip,
                "decompress": self._decompress_gzip,
                "speed": "slow",
                "ratio": "high",
                "description": "Best compression ratio, slower"
            },
            "lz4": {
                "compress": self._compress_lz4,
                "decompress": self._decompress_lz4,
                "speed": "fast",
                "ratio": "medium",
                "description": "Fast compression, good for real-time use"
            },
            "zstd": {
                "compress": self._compress_zstd,
                "decompress": self._decompress_zstd,
                "speed": "balanced",
                "ratio": "high",
                "description": "Balanced speed and compression (recommended)"
            }
        }
    
    def compress_dataset(
        self, 
        real_data: List[List[Any]], 
        synthetic_data: List[List[Any]],
        real_headers: Optional[List[str]] = None,
        synthetic_headers: Optional[List[str]] = None,
        algorithm: str = "zstd",
        compression_level: int = 3,
        format_type: str = "parquet"
    ) -> Dict[str, Any]:
        """
        Compress datasets using specified algorithm and format.
        
        Args:
            real_data: Real dataset
            synthetic_data: Synthetic dataset
            real_headers: Column headers for real data
            synthetic_headers: Column headers for synthetic data
            algorithm: Compression algorithm (gzip, lz4, zstd)
            compression_level: Compression level (1-22 for zstd, 1-9 for gzip)
            format_type: Data format (parquet, pickle, json)
            
        Returns:
            dict: Compression results with metadata
        """
        try:
            # Prepare dataset package
            dataset_package = {
                "real_data": real_data,
                "synthetic_data": synthetic_data,
                "real_headers": real_headers or [],
                "synthetic_headers": synthetic_headers or [],
                "metadata": {
                    "real_shape": [len(real_data), len(real_data[0]) if real_data else 0],
                    "synthetic_shape": [len(synthetic_data), len(synthetic_data[0]) if synthetic_data else 0],
                    "compression_timestamp": pd.Timestamp.now().isoformat(),
                    "format_type": format_type,
                    "algorithm": algorithm,
                    "compression_level": compression_level
                }
            }
            
            # Convert to optimal format
            serialized_data = self._serialize_data(dataset_package, format_type)
            original_size = len(serialized_data)
            
            # Compress using selected algorithm
            if algorithm not in self.algorithms:
                raise ValueError(f"Unsupported compression algorithm: {algorithm}")
            
            compressed_data = self.algorithms[algorithm]["compress"](
                serialized_data, compression_level
            )
            compressed_size = len(compressed_data)
            
            # Calculate compression ratio
            compression_ratio = original_size / compressed_size if compressed_size > 0 else 1.0
            
            # Create data preview (first few rows)
            data_preview = self._create_data_preview(real_data, synthetic_data, real_headers, synthetic_headers)
            
            result = {
                "compressed_data": compressed_data,
                "original_size_mb": original_size / (1024 * 1024),
                "compressed_size_mb": compressed_size / (1024 * 1024),
                "compression_ratio": compression_ratio,
                "algorithm": algorithm,
                "compression_level": compression_level,
                "format_type": format_type,
                "data_preview": data_preview,
                "metadata": dataset_package["metadata"]
            }
            
            self.logger.info(
                f"Compressed dataset: {original_size/1024/1024:.2f}MB → {compressed_size/1024/1024:.2f}MB "
                f"(ratio: {compression_ratio:.2f}x) using {algorithm}"
            )
            
            return result
            
        except Exception as e:
            self.logger.error(f"Compression failed: {str(e)}")
            raise
    
    def decompress_dataset(
        self, 
        compressed_data: bytes, 
        algorithm: str = "zstd",
        format_type: str = "parquet"
    ) -> Dict[str, Any]:
        """
        Decompress dataset and return original data.
        
        Args:
            compressed_data: Compressed dataset bytes
            algorithm: Compression algorithm used
            format_type: Data format used
            
        Returns:
            dict: Decompressed dataset with metadata
        """
        try:
            # Decompress data
            if algorithm not in self.algorithms:
                raise ValueError(f"Unsupported compression algorithm: {algorithm}")
            
            decompressed_data = self.algorithms[algorithm]["decompress"](compressed_data)
            
            # Deserialize data
            dataset_package = self._deserialize_data(decompressed_data, format_type)
            
            result = {
                "real_data": dataset_package["real_data"],
                "synthetic_data": dataset_package["synthetic_data"],
                "real_headers": dataset_package["real_headers"],
                "synthetic_headers": dataset_package["synthetic_headers"],
                "metadata": dataset_package["metadata"]
            }
            
            self.logger.info(f"Successfully decompressed dataset using {algorithm}")
            return result
            
        except Exception as e:
            self.logger.error(f"Decompression failed: {str(e)}")
            raise
    
    def _serialize_data(self, dataset_package: Dict[str, Any], format_type: str) -> bytes:
        """Serialize dataset to specified format."""
        if format_type == "parquet":
            return self._serialize_parquet(dataset_package)
        elif format_type == "pickle":
            return pickle.dumps(dataset_package)
        elif format_type == "json":
            return json.dumps(dataset_package, default=str).encode('utf-8')
        else:
            raise ValueError(f"Unsupported format type: {format_type}")
    
    def _deserialize_data(self, data: bytes, format_type: str) -> Dict[str, Any]:
        """Deserialize dataset from specified format."""
        if format_type == "parquet":
            return self._deserialize_parquet(data)
        elif format_type == "pickle":
            return pickle.loads(data)
        elif format_type == "json":
            try:
                return json.loads(data.decode('utf-8'))
            except UnicodeDecodeError as e:
                self.logger.error(f"Failed to decode JSON data as UTF-8: {e}")
                raise ValueError(f"Invalid UTF-8 data in JSON format: {e}")
        else:
            raise ValueError(f"Unsupported format type: {format_type}")
    
    def _serialize_parquet(self, dataset_package: Dict[str, Any]) -> bytes:
        """Serialize to Parquet format (most efficient for numerical data)."""
        buffer = BytesIO()
        
        # Convert to DataFrames for efficient storage
        real_df = pd.DataFrame(
            dataset_package["real_data"], 
            columns=dataset_package["real_headers"] or [f"col_{i}" for i in range(len(dataset_package["real_data"][0]))]
        )
        synthetic_df = pd.DataFrame(
            dataset_package["synthetic_data"],
            columns=dataset_package["synthetic_headers"] or [f"col_{i}" for i in range(len(dataset_package["synthetic_data"][0]))]
        )
        
        # Create combined dataset with type indicator
        real_df['_dataset_type'] = 'real'
        synthetic_df['_dataset_type'] = 'synthetic'
        combined_df = pd.concat([real_df, synthetic_df], ignore_index=True)
        
        # Store as parquet with metadata
        combined_df.to_parquet(buffer, compression='snappy', index=False)
        
        # Add metadata as header
        metadata_bytes = json.dumps(dataset_package["metadata"]).encode('utf-8')
        metadata_length = len(metadata_bytes).to_bytes(4, byteorder='big')
        
        # Combine metadata length + metadata + parquet data
        result = metadata_length + metadata_bytes + buffer.getvalue()
        return result
    
    def _deserialize_parquet(self, data: bytes) -> Dict[str, Any]:
        """Deserialize from Parquet format."""
        # Extract metadata
        metadata_length = int.from_bytes(data[:4], byteorder='big')
        metadata_bytes = data[4:4+metadata_length]
        parquet_data = data[4+metadata_length:]
        
        try:
            metadata = json.loads(metadata_bytes.decode('utf-8'))
        except UnicodeDecodeError as e:
            self.logger.error(f"Failed to decode metadata as UTF-8: {e}")
            raise ValueError(f"Invalid UTF-8 data in metadata: {e}")
        
        # Read parquet data
        buffer = BytesIO(parquet_data)
        combined_df = pd.read_parquet(buffer)
        
        # Split back into real and synthetic
        real_df = combined_df[combined_df['_dataset_type'] == 'real'].drop('_dataset_type', axis=1)
        synthetic_df = combined_df[combined_df['_dataset_type'] == 'synthetic'].drop('_dataset_type', axis=1)
        
        return {
            "real_data": real_df.values.tolist(),
            "synthetic_data": synthetic_df.values.tolist(),
            "real_headers": real_df.columns.tolist(),
            "synthetic_headers": synthetic_df.columns.tolist(),
            "metadata": metadata
        }
    
    def _compress_gzip(self, data: bytes, level: int = 6) -> bytes:
        """Compress using gzip."""
        compressed = gzip.compress(data, compresslevel=level)
        # Ensure we return bytes, not a memory view
        return bytes(compressed) if not isinstance(compressed, bytes) else compressed
    
    def _decompress_gzip(self, data: bytes) -> bytes:
        """Decompress using gzip."""
        decompressed = gzip.decompress(data)
        return bytes(decompressed) if not isinstance(decompressed, bytes) else decompressed
    
    def _compress_lz4(self, data: bytes, level: int = 1) -> bytes:
        """Compress using LZ4."""
        compressed = lz4.frame.compress(data, compression_level=level)
        return bytes(compressed) if not isinstance(compressed, bytes) else compressed
    
    def _decompress_lz4(self, data: bytes) -> bytes:
        """Decompress using LZ4."""
        decompressed = lz4.frame.decompress(data)
        return bytes(decompressed) if not isinstance(decompressed, bytes) else decompressed
    
    def _compress_zstd(self, data: bytes, level: int = 3) -> bytes:
        """Compress using Zstandard."""
        cctx = zstd.ZstdCompressor(level=level)
        compressed = cctx.compress(data)
        # Ensure we return bytes, not a memory view (zstd can return memory views)
        return bytes(compressed) if not isinstance(compressed, bytes) else compressed
    
    def _decompress_zstd(self, data: bytes) -> bytes:
        """Decompress using Zstandard."""
        dctx = zstd.ZstdDecompressor()
        decompressed = dctx.decompress(data)
        return bytes(decompressed) if not isinstance(decompressed, bytes) else decompressed
    
    def _create_data_preview(
        self, 
        real_data: List[List[Any]], 
        synthetic_data: List[List[Any]],
        real_headers: Optional[List[str]] = None,
        synthetic_headers: Optional[List[str]] = None,
        preview_rows: int = 5
    ) -> Dict[str, Any]:
        """Create a preview of the first few rows for quick reference."""
        preview = {
            "real_preview": real_data[:preview_rows] if real_data else [],
            "synthetic_preview": synthetic_data[:preview_rows] if synthetic_data else [],
            "real_headers": real_headers or [],
            "synthetic_headers": synthetic_headers or [],
            "real_total_rows": len(real_data),
            "synthetic_total_rows": len(synthetic_data),
            "preview_rows": preview_rows
        }
        return preview
    
    def get_optimal_algorithm(self, data_size_mb: float, priority: str = "balanced") -> str:
        """
        Recommend optimal compression algorithm based on data size and priority.
        
        Args:
            data_size_mb: Dataset size in MB
            priority: 'speed', 'compression', or 'balanced'
            
        Returns:
            str: Recommended algorithm
        """
        if priority == "speed":
            return "lz4"
        elif priority == "compression":
            return "gzip" if data_size_mb < 100 else "zstd"
        else:  # balanced
            if data_size_mb < 10:
                return "gzip"  # Small datasets, prioritize compression
            elif data_size_mb < 100:
                return "zstd"  # Medium datasets, balanced approach
            else:
                return "lz4"   # Large datasets, prioritize speed
    
    def estimate_compression_ratio(
        self, 
        sample_data: List[List[Any]], 
        algorithm: str = "zstd"
    ) -> float:
        """
        Estimate compression ratio by compressing a small sample.
        
        Args:
            sample_data: Small sample of the dataset
            algorithm: Compression algorithm to test
            
        Returns:
            float: Estimated compression ratio
        """
        try:
            if len(sample_data) == 0:
                return 1.0
            
            # Use first 100 rows as sample
            sample = sample_data[:min(100, len(sample_data))]
            serialized = json.dumps(sample).encode('utf-8')
            compressed = self.algorithms[algorithm]["compress"](serialized)
            
            ratio = len(serialized) / len(compressed) if len(compressed) > 0 else 1.0
            return ratio
            
        except Exception:
            return 2.0  # Conservative estimate if sampling fails 