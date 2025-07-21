# Dimensionality Reduction

MAVIS provides advanced dimensionality reduction techniques for visualizing high-dimensional synthetic data.

## UMAP (Uniform Manifold Approximation and Projection)

UMAP is the primary dimensionality reduction method used in MAVIS:

- **Preserves both local and global structure**
- **Configurable parameters** for different analysis needs
- **Fast computation** for large datasets

### Key Parameters

- **n_neighbors**: Number of neighboring points (2-200, default: 15)
- **min_dist**: Minimum distance between points (0.0-0.99, default: 0.1)
- **n_components**: Target dimensionality (2 or 3, default: 2)

## t-SNE (t-Distributed Stochastic Neighbor Embedding)

t-SNE is available as an alternative method:

- **Excellent for preserving local clusters**
- **Complementary to UMAP** for comprehensive analysis
- **Good for detailed local structure** examination

*This page is under construction. More detailed content will be added soon.* 