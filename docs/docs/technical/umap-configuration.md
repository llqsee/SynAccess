# UMAP and openTSNE Configuration

> [!info]
> MAVIS supports advanced dimensionality reduction using both UMAP and openTSNE. For both algorithms, only **2 components** (`n_components=2`) are supported for visualization.

---

## UMAP Parameters (Supported in MAVIS)

| Parameter        | Default | Description |
|------------------|---------|-------------|
| n_neighbors      | 15      | Number of neighboring points used in local approximations |
| min_dist         | 0.1     | Minimum distance between points in low-dimensional space |
| n_components     | 2       | **Only 2D embeddings are supported in MAVIS** |
| metric           | euclidean | Distance metric for high-dimensional space |
| random_state     | 42      | Seed for reproducible results |

---

## openTSNE Parameters (Supported in MAVIS)

| Parameter        | Default | Description |
|------------------|---------|-------------|
| perplexity       | 30      | Effective number of neighbors. Typical range: 5–50. Lower values focus on local structure; higher values on global structure. |
| learning_rate    | 200     | Step size for optimization. Affects speed and stability of convergence. Too low or high can affect results. |

---

### Parameter Notes
- **perplexity**: Controls the balance between local and global aspects of the data. Default (30) is robust for most datasets.
- **learning_rate**: Affects the speed and stability of optimization. Default (200) is recommended; adjust only if you have experience with t-SNE optimization.

---

> [!info]
> For best results, use the default parameters unless you have specific requirements or prior experience with dimensionality reduction tuning. MAVIS ensures all embeddings are 2D for optimal visualization and comparison.