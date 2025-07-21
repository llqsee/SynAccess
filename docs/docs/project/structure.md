# Project Structure

Overview of the MAVIS codebase organization.

## Directory Structure

```
.
├── backend/                 # FastAPI backend
│   ├── main.py             # Main application
│   ├── services/           # Business logic
│   ├── routes/             # API endpoints
│   └── utils/              # Utility functions
├── frontend/               # React frontend
│   ├── src/                # Source code
│   │   ├── components/     # React components
│   │   ├── services/       # API communication
│   │   └── utils/          # Frontend utilities
│   └── public/             # Static files
├── docs/                   # Documentation
│   ├── mkdocs.yml          # MkDocs configuration
│   └── ...                 # Documentation pages
└── environment.yml         # Conda environment
```

## Key Files

- **environment.yml**: Python dependencies
- **package.json**: Node.js dependencies
- **docker-compose.yml**: Container configuration
- **README.md**: Project overview

*This page is under construction. More detailed content will be added soon.*