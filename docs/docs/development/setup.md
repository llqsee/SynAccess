# Development Setup

Guide for setting up the MAVIS development environment.

## Prerequisites

- **Python 3.10+**: Core runtime
- **Node.js 16+**: Frontend development
- **Git**: Version control
- **Conda**: Environment management

## Backend Setup

```bash
# Create environment
conda env create -f environment.yml
conda activate mavis

# Install dependencies
cd backend
pip install -r requirements.txt

# Run development server
python main.py
```

## Frontend Setup

```bash
# Install dependencies
cd frontend
npm install

# Run development server
npm start
```

> Windows PowerShell note: do not chain with `&&`. Run each command separately (e.g., `cd frontend` then `npm start`).

*This page is under construction. More detailed content will be added soon.*