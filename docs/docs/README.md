# MAVIS Documentation

This directory contains the documentation for MAVIS (Scalable Visualization and Explainability of Synthetic Datasets) built with MkDocs and the Material theme.

## 🚀 Quick Start

### View the Documentation

1. **Update your conda environment** (if you haven't already):
   ```bash
   conda env update -f environment.yml
   ```

2. **Start the documentation server**:
   ```bash
   cd docs
   python -m mkdocs serve
   ```

2. **Open your browser** and navigate to http://127.0.0.1:8000

### Build the Documentation

To build the static site for deployment:

```bash
cd docs
python -m mkdocs build
```

The built site will be in the `site/` directory.

### Deploy to GitHub Pages

To deploy the documentation to GitHub Pages:

```bash
cd docs
python -m mkdocs gh-deploy
```

## 📁 Documentation Structure

The documentation is organized into the following sections:

### Getting Started
- **Overview**: Introduction to MAVIS and its capabilities
- **Installation**: Step-by-step setup instructions
- **Quick Start**: Tutorial for first-time users

### Features
- **Data Upload**: How to upload and process datasets
- **Dimensionality Reduction**: UMAP and t-SNE configuration
- **Interactive Visualizations**: Using the visualization tools
- **Statistical Analysis**: Distribution comparisons and tests
- **Data Validation**: Quality assessment framework
- **Performance Monitoring**: System metrics and analytics
- **Job Management**: Background processing and history

### User Guide
- **Upload Data**: Detailed data upload instructions
- **Configure Parameters**: Parameter tuning guide
- **Generate Embeddings**: Embedding generation workflow
- **Explore Results**: Visualization exploration
- **Validate Data Quality**: Quality assessment process
- **Monitor Performance**: Performance tracking
- **Manage Jobs**: Job history and management
- **Export Results**: Exporting and sharing results

### Technical Documentation
- **Architecture**: System architecture overview
- **API Reference**: Backend API documentation
- **UMAP Configuration**: Detailed UMAP parameter guide
- **Data Validation**: Technical validation details
- **Performance Monitoring**: Technical monitoring details

### Development
- **Setup**: Development environment setup
- **Testing**: Testing procedures and guidelines
- **Deployment**: Production deployment guide
- **Contributing**: How to contribute to the project

### Project
- **Project Structure**: Codebase organization
- **License**: Project licensing information
- **Acknowledgments**: Credits and acknowledgments

## 🛠️ Customization

### Adding New Pages

1. **Create a new Markdown file** in the appropriate directory
2. **Add the page to navigation** in `mkdocs.yml`
3. **Use MkDocs features** like admonitions, code blocks, and tables

### Styling

- **Custom CSS**: Edit `stylesheets/extra.css`
- **Custom JavaScript**: Edit `javascripts/mathjax.js`
- **Theme configuration**: Modify the `theme` section in `mkdocs.yml`

### Extensions

The documentation uses several MkDocs extensions:

- **Material theme**: Professional documentation theme
- **Search**: Full-text search functionality
- **Git revision dates**: Automatic date tracking
- **Code highlighting**: Syntax highlighting for code blocks
- **Admonitions**: Callout boxes for tips, warnings, etc.
- **MathJax**: Mathematical equation rendering

## 📝 Writing Guidelines

### Markdown Features

Use these MkDocs Material features:

```markdown
!!! tip "Tips"
    Use tips for helpful information.

!!! warning "Warnings"
    Use warnings for important notices.

!!! example "Examples"
    Use examples for code demonstrations.

!!! note "Notes"
    Use notes for additional information.
```

### Code Blocks

```markdown
```python
def example_function():
    return "Hello, MAVIS!"
```
```

### Tables

```markdown
| Feature | Description |
|---------|-------------|
| UMAP | Dimensionality reduction |
| t-SNE | Alternative reduction method |
```

### Links

```markdown
[Installation Guide](getting-started/installation.md)
[API Reference](../technical/api-reference.md)
```

## 🔧 Configuration

The main configuration file is `mkdocs.yml`. Key sections:

- **Site information**: Name, description, author
- **Theme**: Material theme with custom palette
- **Navigation**: Page structure and organization
- **Plugins**: Search, git dates, minification
- **Extensions**: Markdown extensions and features

## 🚀 Deployment

### Local Development

```bash
python -m mkdocs serve
```

### Production Build

```bash
python -m mkdocs build
```

### GitHub Pages Deployment

```bash
python -m mkdocs gh-deploy
```

## 🔧 Troubleshooting

### Common Issues

**"No module named 'material'"**:
```bash
pip install mkdocs-material-extensions
```

**"The 'git-revision-date-localized' plugin is not installed"**:
```bash
pip install mkdocs-git-revision-date-localized-plugin
```

**"The 'minify' plugin is not installed"**:
```bash
pip install mkdocs-minify-plugin
```

**"Config file 'mkdocs.yml' does not exist"**:
Make sure you're in the `docs/` directory when running mkdocs commands.

**"Access is denied" on Windows**:
Use `python -m mkdocs serve` instead of `mkdocs serve`.

### Manual Setup

If the automatic setup doesn't work, install dependencies manually:

```bash
pip install mkdocs mkdocs-material mkdocs-material-extensions mkdocs-git-revision-date-localized-plugin mkdocs-minify-plugin
```

## 📚 Resources

- [MkDocs Documentation](https://www.mkdocs.org/)
- [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/)
- [Markdown Guide](https://www.markdownguide.org/)

## 🤝 Contributing

To contribute to the documentation:

1. **Edit Markdown files** in the appropriate directories
2. **Test locally** with `python -m mkdocs serve`
3. **Submit a pull request** with your changes
4. **Follow the writing guidelines** above

## 📄 License

This documentation is part of the MAVIS project and follows the same license as the main project.
