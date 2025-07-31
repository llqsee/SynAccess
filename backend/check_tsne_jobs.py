import sqlite3

conn = sqlite3.connect('mavis_dev.db')
cursor = conn.cursor()

# Check recent t-SNE jobs
cursor.execute('SELECT job_id, method, status, has_model FROM jobs WHERE method = "tsne" ORDER BY created_at DESC LIMIT 5')
tsne_jobs = cursor.fetchall()

print("Recent t-SNE jobs:")
for job in tsne_jobs:
    print(f"Job: {job[0]}, Method: {job[1]}, Status: {job[2]}, Has Model: {job[3]}")

# Check recent UMAP jobs
cursor.execute('SELECT job_id, method, status, has_model FROM jobs WHERE method = "umap" ORDER BY created_at DESC LIMIT 5')
umap_jobs = cursor.fetchall()

print("\nRecent UMAP jobs:")
for job in umap_jobs:
    print(f"Job: {job[0]}, Method: {job[1]}, Status: {job[2]}, Has Model: {job[3]}")

conn.close() 