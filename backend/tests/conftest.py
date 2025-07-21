import pytest
import tempfile
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database.models import Base
from database.connection import get_db
from main import app

# Test database
TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    TEST_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="session")
def test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client(test_db):
    return TestClient(app)

@pytest.fixture
def sample_data():
    return {
        "real_data": {
            "headers": ["feature1", "feature2", "feature3"],
            "data": [
                [1.0, 2.0, 3.0],
                [4.0, 5.0, 6.0],
                [7.0, 8.0, 9.0]
            ]
        },
        "synthetic_data": {
            "headers": ["feature1", "feature2", "feature3"],
            "data": [
                [1.1, 2.1, 3.1],
                [4.1, 5.1, 6.1],
                [7.1, 8.1, 9.1]
            ]
        }
    }

@pytest.fixture
def mock_embedding_result():
    return {
        "real_embeddings": [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]],
        "synthetic_embeddings": [[0.7, 0.8], [0.9, 1.0], [1.1, 1.2]],
        "metadata": {
            "method": "umap",
            "runtime": 15.5,
            "parameters": {"n_neighbors": 15, "min_dist": 0.1}
        }
    }

@pytest.fixture
def mock_distribution_plot():
    return {
        "plot_data": {
            "data": [
                {
                    "x": [1, 2, 3, 4, 5],
                    "y": [2, 4, 3, 5, 1],
                    "type": "histogram",
                    "name": "Real Data"
                },
                {
                    "x": [1.1, 2.1, 3.1, 4.1, 5.1],
                    "y": [1, 3, 4, 2, 5],
                    "type": "histogram",
                    "name": "Synthetic Data"
                }
            ],
            "layout": {
                "title": "Distribution Comparison",
                "xaxis": {"title": "Value"},
                "yaxis": {"title": "Frequency"}
            }
        }
    }

@pytest.fixture
def temp_file():
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as f:
        f.write("col1,col2,col3\n1,2,3\n4,5,6\n")
        temp_path = f.name
    
    yield temp_path
    
    if os.path.exists(temp_path):
        os.unlink(temp_path) 