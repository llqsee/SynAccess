import requests
import base64

# Test downloading a UMAP model
job_id = "ca46af51-b14e-40a9-8be0-d0d21db0c0f9"  # This was a UMAP job with has_model=1

try:
    # Download the model
    response = requests.get(f"http://localhost:8000/api/v1/jobs/{job_id}/model/download")
    
    if response.status_code == 200:
        print(f"Download successful for job {job_id}")
        print(f"Content-Type: {response.headers.get('Content-Type')}")
        print(f"Content-Disposition: {response.headers.get('Content-Disposition')}")
        print(f"Data size: {len(response.content)} bytes")
        
        # Save the file
        filename = f"test_model_{job_id}.bin"
        with open(filename, 'wb') as f:
            f.write(response.content)
        print(f"Saved to {filename}")
        
        # Try to decode as base64 and check if it's valid
        try:
            decoded = base64.b64decode(response.content)
            print(f"Base64 decoded size: {len(decoded)} bytes")
            
            # Try to load with pickle
            import pickle
            try:
                model = pickle.loads(decoded)
                print(f"Successfully loaded with pickle. Model type: {type(model).__name__}")
            except Exception as e:
                print(f"Failed to load with pickle: {e}")
                
                # Try with joblib
                import joblib
                try:
                    model = joblib.loads(decoded)
                    print(f"Successfully loaded with joblib. Model type: {type(model).__name__}")
                except Exception as e:
                    print(f"Failed to load with joblib: {e}")
                    
        except Exception as e:
            print(f"Failed to decode base64: {e}")
            
    else:
        print(f"Download failed: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"Error: {e}") 