"""
ZeroMQ-based task queue system for asynchronous embedding generation.
Allows multiple embedding jobs to run concurrently with queue management.
"""

import zmq
import json
import threading
import time
import uuid
from typing import Dict, Any, Optional, List
from enum import Enum
from dataclasses import dataclass, asdict
from datetime import datetime
import multiprocessing as mp
from concurrent.futures import ThreadPoolExecutor

from backend.utils.logging_config import get_logger

class JobStatus(Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class EmbeddingTask:
    task_id: str
    job_id: str
    real_data: List[List[Any]]
    synthetic_data: List[List[Any]]
    method: str
    params: Dict[str, Any]
    n_samples: Optional[int] = None
    real_headers: Optional[List[str]] = None
    synthetic_headers: Optional[List[str]] = None
    pretrained_model: Optional[Any] = None  # Pre-trained model object
    priority: int = 0  # Higher number = higher priority
    created_at: str = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow().isoformat()

@dataclass
class TaskProgress:
    task_id: str
    job_id: str
    status: JobStatus
    progress: float  # 0.0 to 1.0
    queue_position: Optional[int] = None
    estimated_time_remaining: Optional[float] = None
    error_message: Optional[str] = None
    worker_id: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

class TaskQueueManager:
    """Manages the ZeroMQ task queue for embedding generation."""
    
    def __init__(self, 
                 frontend_port: int = 5555,  # Port for receiving tasks from API
                 backend_port: int = 5556,   # Port for distributing to workers
                 status_port: int = 5557,    # Port for status updates
                 max_workers: int = None):
        
        self.logger = get_logger("task_queue")
        self.frontend_port = frontend_port
        self.backend_port = backend_port
        self.status_port = status_port
        self.max_workers = max_workers or max(1, mp.cpu_count() - 1)
        
        # ZeroMQ context and sockets
        self.context = zmq.Context()
        self.frontend = None  # ROUTER socket for API requests
        self.backend = None   # DEALER socket for workers
        self.status_pub = None  # PUB socket for status updates
        
        # Task management
        self.task_queue: List[EmbeddingTask] = []
        self.active_tasks: Dict[str, TaskProgress] = {}
        self.completed_tasks: Dict[str, TaskProgress] = {}
        self.queue_lock = threading.Lock()
        
        # Worker management
        self.workers: List[mp.Process] = []
        self.worker_status: Dict[str, str] = {}  # worker_id -> status
        
        # Control flags
        self.running = False
        self.broker_thread = None
        
    def start(self):
        """Start the task queue manager."""
        if self.running:
            self.logger.warning("Task queue manager is already running")
            return
            
        self.logger.info(f"Starting task queue manager with {self.max_workers} workers")
        
        try:
            # Initialize ZeroMQ sockets
            self.frontend = self.context.socket(zmq.ROUTER)
            self.frontend.bind(f"tcp://*:{self.frontend_port}")
            
            self.backend = self.context.socket(zmq.DEALER)
            self.backend.bind(f"tcp://*:{self.backend_port}")
            
            self.status_pub = self.context.socket(zmq.PUB)
            self.status_pub.bind(f"tcp://*:{self.status_port}")
            
            # Give sockets more time to bind properly (important on Windows)
            time.sleep(1.0)
            
            # Start broker thread
            self.running = True
            self.broker_thread = threading.Thread(target=self._broker_loop, daemon=True)
            self.broker_thread.start()
            
            # Wait longer for broker to be ready
            time.sleep(2.0)
            
            # Start worker processes
            self._start_workers()
            
            self.logger.info("Task queue manager started successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to start task queue: {e}")
            self.running = False
            raise
    
    def stop(self):
        """Stop the task queue manager and all workers."""
        self.logger.info("Stopping task queue manager...")
        
        self.running = False
        
        # Stop workers
        self._stop_workers()
        
        # Close sockets
        if self.frontend:
            self.frontend.close()
        if self.backend:
            self.backend.close()
        if self.status_pub:
            self.status_pub.close()
            
        # Wait for broker thread
        if self.broker_thread and self.broker_thread.is_alive():
            self.broker_thread.join(timeout=5)
            
        self.context.term()
        self.logger.info("Task queue manager stopped")
    
    def submit_task(self, task: EmbeddingTask) -> str:
        """Submit a new embedding task to the queue."""
        with self.queue_lock:
            # Add to queue (sorted by priority)
            self.task_queue.append(task)
            self.task_queue.sort(key=lambda t: t.priority, reverse=True)
            
            # Create progress tracking
            progress = TaskProgress(
                task_id=task.task_id,
                job_id=task.job_id,
                status=JobStatus.QUEUED,
                progress=0.0,
                queue_position=self._get_queue_position(task.task_id)
            )
            self.active_tasks[task.task_id] = progress
            
        # Publish status update
        self._publish_status_update(progress)
        
        self.logger.info(f"Task {task.task_id} submitted to queue (position: {progress.queue_position})")
        return task.task_id
    
    def get_task_status(self, task_id: str) -> Optional[TaskProgress]:
        """Get the status of a specific task."""
        # Check active tasks first
        if task_id in self.active_tasks:
            return self.active_tasks[task_id]
        
        # Check completed tasks
        if task_id in self.completed_tasks:
            return self.completed_tasks[task_id]
            
        return None
    
    def get_queue_status(self) -> Dict[str, Any]:
        """Get overall queue status."""
        with self.queue_lock:
            queued_count = len(self.task_queue)
            processing_count = len([t for t in self.active_tasks.values() 
                                  if t.status == JobStatus.PROCESSING])
            
        return {
            "queued_tasks": queued_count,
            "processing_tasks": processing_count,
            "active_workers": len([w for w in self.worker_status.values() if w == "busy"]),
            "total_workers": self.max_workers,
            "queue_items": [
                {
                    "task_id": task.task_id,
                    "job_id": task.job_id,
                    "method": task.method,
                    "priority": task.priority,
                    "created_at": task.created_at
                }
                for task in self.task_queue[:10]  # First 10 items
            ]
        }
    
    def cancel_task(self, task_id: str) -> bool:
        """Cancel a queued or processing task."""
        with self.queue_lock:
            # Remove from queue if queued
            for i, task in enumerate(self.task_queue):
                if task.task_id == task_id:
                    del self.task_queue[i]
                    
                    # Update status
                    if task_id in self.active_tasks:
                        progress = self.active_tasks[task_id]
                        progress.status = JobStatus.FAILED
                        progress.error_message = "Task cancelled by user"
                        progress.completed_at = datetime.utcnow().isoformat()
                        self.completed_tasks[task_id] = progress
                        del self.active_tasks[task_id]
                        
                        self._publish_status_update(progress)
                    
                    self.logger.info(f"Task {task_id} cancelled (was queued)")
                    return True
            
            # If processing, mark for cancellation (workers will check this)
            if task_id in self.active_tasks:
                progress = self.active_tasks[task_id]
                if progress.status == JobStatus.PROCESSING:
                    progress.status = JobStatus.FAILED
                    progress.error_message = "Task cancelled by user"
                    self._publish_status_update(progress)
                    self.logger.info(f"Task {task_id} marked for cancellation (was processing)")
                    return True
        
        return False
    
    def _broker_loop(self):
        """Main broker loop that handles messages from frontend and backend."""
        self.logger.info("Broker loop started")
        
        while self.running:
            try:
                # Check for frontend messages (API requests and worker ready requests)
                self._handle_frontend_message()
                
                # Check for backend messages (worker responses)
                self._handle_backend_message()
                

                
                # Small delay to prevent busy waiting
                time.sleep(0.01)
                
            except KeyboardInterrupt:
                self.logger.info("Broker loop interrupted")
                break
            except Exception as e:
                # Only log critical errors, not message decoding issues
                if "codec" not in str(e).lower() and "utf-8" not in str(e).lower():
                    self.logger.error(f"Critical error in broker loop: {e}")
                time.sleep(0.1)  # Brief pause before retrying
    
    def _handle_frontend_message(self):
        """Handle messages from both API and workers on the frontend."""
        # Receive message from frontend with timeout to prevent blocking
        try:
            identity, empty, message = self.frontend.recv_multipart(zmq.NOBLOCK)
        except zmq.Again:
            return  # No message available
        except Exception:
            return  # Silently ignore any other errors
        
        # Handle worker ready requests
        if message == b"ready":
            # This is a worker requesting work
            with self.queue_lock:
                if self.task_queue:
                    task = self.task_queue.pop(0)
                    
                    # Update status to processing
                    if task.task_id in self.active_tasks:
                        progress = self.active_tasks[task.task_id]
                        progress.status = JobStatus.PROCESSING
                        progress.started_at = datetime.utcnow().isoformat()
                        progress.queue_position = None
                        
                        # Send task to worker
                        # Create a serializable version of the task (excluding pretrained_model)
                        task_dict = asdict(task)
                        pretrained_model = task_dict.pop('pretrained_model', None)
                        
                        # Serialize the task data
                        task_data = json.dumps(task_dict).encode()
                        
                        # Send task data and pretrained model separately
                        if pretrained_model is not None:
                            # For pretrained models, we need to handle them differently
                            # since they can't be JSON serialized
                            import pickle
                            import base64
                            model_data = base64.b64encode(pickle.dumps(pretrained_model)).decode()
                            task_data_with_model = json.dumps({
                                'task_data': task_dict,
                                'pretrained_model_data': model_data
                            }).encode()
                            self.frontend.send_multipart([identity, b"", task_data_with_model])
                        else:
                            # Regular task without pretrained model
                            self.frontend.send_multipart([identity, b"", task_data])
                        
                        self._publish_status_update(progress)
                        
                        self.logger.info(f"Dispatched task {task.task_id} to worker {identity.decode()}")
                    else:
                        # Task was cancelled or removed
                        self.frontend.send_multipart([identity, b"", b"task_not_found"])
                else:
                    # No tasks available
                    self.frontend.send_multipart([identity, b"", b"no_tasks"])
            return
        
        # Handle ping from workers
        if message == b"ping":
            self.frontend.send_multipart([identity, b"", b"pong"])
            return
        
        # Handle other messages silently (API requests are handled through REST endpoints)
        # No need to try to decode or log these messages as they may contain binary data
    
    def _handle_backend_message(self):
        """Handle messages from worker processes."""
        try:
            # Handle both single messages and multipart messages
            try:
                empty, message = self.backend.recv_multipart(zmq.NOBLOCK)
            except zmq.Again:
                return  # No message available
            except ValueError:
                # Single message received instead of multipart
                try:
                    message = self.backend.recv(zmq.NOBLOCK)
                except zmq.Again:
                    return  # No message available
                except Exception:
                    return  # Silently ignore other errors
            
            # Safely decode message with proper error handling
            try:
                if isinstance(message, bytes):
                    message_str = message.decode('utf-8')
                    data = json.loads(message_str)
                else:
                    # Handle case where message is already a string
                    data = json.loads(str(message))
            except UnicodeDecodeError as e:
                self.logger.error(f"Failed to decode backend message as UTF-8: {e}")
                return
            except json.JSONDecodeError as e:
                self.logger.error(f"Failed to parse backend message as JSON: {e}")
                return
            
            message_type = data.get("type")
            task_id = data.get("task_id")
            
            if message_type == "progress" and task_id in self.active_tasks:
                # Update progress
                progress = self.active_tasks[task_id]
                progress.progress = data.get("progress", 0.0)
                progress.worker_id = data.get("worker_id")
                self._publish_status_update(progress)
                
            elif message_type == "completed" and task_id in self.active_tasks:
                # Task completed successfully
                progress = self.active_tasks[task_id]
                progress.status = JobStatus.COMPLETED
                progress.progress = 1.0
                progress.completed_at = datetime.utcnow().isoformat()
                
                # Move to completed tasks
                self.completed_tasks[task_id] = progress
                del self.active_tasks[task_id]
                
                self._publish_status_update(progress)
                
            elif message_type == "failed" and task_id in self.active_tasks:
                # Task failed
                progress = self.active_tasks[task_id]
                progress.status = JobStatus.FAILED
                progress.error_message = data.get("error_message")
                progress.completed_at = datetime.utcnow().isoformat()
                
                # Move to completed tasks
                self.completed_tasks[task_id] = progress
                del self.active_tasks[task_id]
                
                self._publish_status_update(progress)
                
        except Exception as e:
            self.logger.error(f"Error handling backend message: {e}")
    

    
    def _start_workers(self):
        """Start worker processes."""
        try:
            self.logger.info(f"Starting {self.max_workers} worker processes...")
            for i in range(self.max_workers):
                worker_id = f"worker_{i}"
                self.logger.info(f"Starting worker {worker_id}...")
                process = mp.Process(
                    target=embedding_worker,
                    args=(worker_id, self.frontend_port, self.status_port),
                    daemon=True
                )
                process.start()
                self.workers.append(process)
                self.worker_status[worker_id] = "idle"
                
                # Add longer delay between worker starts to reduce connection conflicts
                time.sleep(1.0)
                
            self.logger.info(f"Started {len(self.workers)} worker processes")
            
            # Check if workers are alive after a short delay
            time.sleep(2.0)
            alive_workers = [w for w in self.workers if w.is_alive()]
            self.logger.info(f"Workers still alive after startup: {len(alive_workers)}/{len(self.workers)}")
            
        except Exception as e:
            self.logger.error(f"Error starting workers: {e}")
            # Continue without workers - the system can still function
    
    def _stop_workers(self):
        """Stop all worker processes."""
        for worker in self.workers:
            if worker.is_alive():
                worker.terminate()
                worker.join(timeout=5)
                
        self.workers.clear()
        self.worker_status.clear()
    
    def _get_queue_position(self, task_id: str) -> int:
        """Get the position of a task in the queue."""
        for i, task in enumerate(self.task_queue):
            if task.task_id == task_id:
                return i + 1
        return -1
    
    def _update_queue_positions(self):
        """Update queue positions for all queued tasks."""
        with self.queue_lock:
            for i, task in enumerate(self.task_queue):
                if task.task_id in self.active_tasks:
                    self.active_tasks[task.task_id].queue_position = i + 1
    
    def _publish_status_update(self, progress: TaskProgress):
        """Publish status update to subscribers."""
        try:
            update_data = {
                "type": "status_update",
                "task_id": progress.task_id,
                "job_id": progress.job_id,
                "status": progress.status.value,
                "progress": progress.progress,
                "queue_position": progress.queue_position,
                "estimated_time_remaining": progress.estimated_time_remaining,
                "error_message": progress.error_message,
                "worker_id": progress.worker_id,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            message = json.dumps(update_data).encode()
            self.status_pub.send_multipart([b"status", message])
            
        except Exception as e:
            self.logger.error(f"Error publishing status update: {e}")

# Global instance
task_queue_manager = None

def get_task_queue_manager() -> TaskQueueManager:
    """Get the global task queue manager instance."""
    global task_queue_manager
    if task_queue_manager is None:
        task_queue_manager = TaskQueueManager()
    return task_queue_manager

def embedding_worker(worker_id: str, frontend_port: int, status_port: int):
    """Worker process for computing embeddings."""
    from .embedding import EmbeddingService
    from .job_service import JobService
    
    logger = get_logger(f"worker_{worker_id}")
    logger.info(f"Worker {worker_id} starting...")
    
    # Give main process more time to fully initialize sockets
    time.sleep(3.0 + (int(worker_id.split('_')[1]) * 0.2))  # Stagger worker starts more
    
    # Initialize ZeroMQ
    context = zmq.Context()
    
    max_retries = 5
    retry_delay = 3  # Increased from 2
    
    for attempt in range(max_retries):
        try:
            logger.info(f"Worker {worker_id} attempting to connect to frontend port {frontend_port} (attempt {attempt + 1})")
            # Socket to receive tasks (connect to frontend for work requests)
            receiver = context.socket(zmq.REQ)
            receiver.connect(f"tcp://localhost:{frontend_port}")
            
            # Set socket timeout to prevent indefinite blocking
            receiver.setsockopt(zmq.RCVTIMEO, 30000)  # 30 second timeout
            receiver.setsockopt(zmq.SNDTIMEO, 5000)   # 5 second send timeout
            receiver.setsockopt(zmq.LINGER, 1000)     # 1 second linger
            
            # Socket to send status updates
            status_sender = context.socket(zmq.PUB)
            status_sender.connect(f"tcp://localhost:{status_port}")
            status_sender.setsockopt(zmq.LINGER, 1000)
            
            # Test connection
            receiver.send(b"ping")
            response = receiver.recv()
            
            logger.info(f"Worker {worker_id} connected successfully")
            break
            
        except Exception as e:
            logger.warning(f"Worker {worker_id} connection attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))  # Exponential backoff
                try:
                    receiver.close()
                    status_sender.close()
                except:
                    pass
            else:
                logger.error(f"Worker {worker_id} failed to connect after {max_retries} attempts")
                context.term()
                return
    
    # Initialize embedding service
    embedding_service = EmbeddingService()
    
    try:
        consecutive_timeouts = 0
        max_consecutive_timeouts = 3
        
        while True:
            try:
                # Request work
                receiver.send(b"ready")
                
                # Wait for task with timeout
                message = receiver.recv()
                consecutive_timeouts = 0  # Reset timeout counter on successful receive
                
                # Check if we got task data directly or a status message
                if message == b"no_tasks":
                    # No work available, wait a bit
                    time.sleep(1)
                    continue
                elif message == b"ping":
                    # Ping response, continue
                    continue
                elif message in [b"task_not_found", b"internal_error"]:
                    # Error responses, wait and continue
                    time.sleep(2)
                    continue
                else:
                    # Assume this is task data
                    try:
                        task_data = json.loads(message.decode())
                        
                        # Handle new format with pretrained model data
                        if "pretrained_model_data" in task_data:
                            # This is a task with pretrained model
                            task_dict = task_data["task_data"]
                            pretrained_model_data = task_data["pretrained_model_data"]
                            
                            # Decode the pretrained model
                            import pickle
                            import base64
                            model_bytes = base64.b64decode(pretrained_model_data)
                            
                            # Check model format and use appropriate deserialization
                            model_format = task_dict.get("params", {}).get("model_format", "pickle")
                            if model_format == "joblib":
                                import joblib
                                pretrained_model = joblib.loads(model_bytes)
                            else:
                                pretrained_model = pickle.loads(model_bytes)
                            
                            # Add the model to the task dict
                            task_dict["pretrained_model"] = pretrained_model
                        else:
                            # Regular task without pretrained model
                            task_dict = task_data
                        
                        if "task_id" not in task_dict:
                            logger.warning(f"Worker {worker_id} received invalid task data")
                            continue
                            
                        task_id = task_dict["task_id"]
                        logger.info(f"Worker {worker_id} processing task {task_id}")
                        
                    except json.JSONDecodeError:
                        logger.warning(f"Worker {worker_id} received non-JSON message: {message}")
                        continue
                    except Exception as e:
                        logger.error(f"Worker {worker_id} error processing task data: {e}")
                        continue
                    
                    try:
                        # Update job status to running (not processing)
                        job_id = task_dict["job_id"]
                        JobService.update_job_async_info(
                            job_id=job_id,
                            status="running",
                            worker_id=worker_id,
                            started_at=datetime.utcnow()
                        )
                        
                        # Send progress update
                        _send_progress_update(status_sender, task_id, worker_id, 0.1, "starting")
                        
                        # Check if using pre-trained model
                        if task_dict.get("pretrained_model") is not None:
                            logger.info(f"Worker {worker_id} starting pre-trained model processing for task {task_id}")
                            # Use pre-trained model
                            embeddings, metadata = embedding_service.compute_embedding_with_pretrained_model(
                                real_data=task_dict["real_data"],
                                synthetic_data=task_dict["synthetic_data"],
                                pretrained_model=task_dict["pretrained_model"],
                                method=task_dict["method"],
                                real_headers=task_dict.get("real_headers"),
                                synthetic_headers=task_dict.get("synthetic_headers"),
                                fine_tune=task_dict.get("params", {}).get("fine_tune", False),
                                progress_callback=lambda p: _send_progress_update(
                                    status_sender, task_id, worker_id, 0.1 + (p * 0.8), "computing"
                                )
                            )
                            logger.info(f"Worker {worker_id} completed pre-trained model processing for task {task_id}")
                        else:
                            logger.info(f"Worker {worker_id} starting regular embedding processing for task {task_id}")
                            # Compute embedding with progress reporting
                            embeddings, metadata = embedding_service.compute_embedding(
                                real_data=task_dict["real_data"],
                                synthetic_data=task_dict["synthetic_data"],
                                method=task_dict["method"],
                                params=task_dict["params"],
                                n_samples=task_dict.get("n_samples"),
                                real_headers=task_dict.get("real_headers"),
                                synthetic_headers=task_dict.get("synthetic_headers"),
                                progress_callback=lambda p: _send_progress_update(
                                    status_sender, task_id, worker_id, 0.1 + (p * 0.8), "computing"
                                )
                            )
                            logger.info(f"Worker {worker_id} completed regular embedding processing for task {task_id}")
                        
                        # Save results to database (including model if available)
                        model = metadata.get("model")
                        
                        logger.info(f"Calling update_job_results for job {job_id}")
                        success = JobService.update_job_results(
                            job_id=job_id,
                            embedding_real=embeddings["real"],
                            embedding_synthetic=embeddings["synthetic"],
                            runtime_seconds=metadata["runtime"],
                            preprocessing_info=metadata,
                            real_processed_samples=metadata.get("real_samples"),
                            synthetic_processed_samples=metadata.get("synthetic_samples"),
                            model=model
                        )
                        if not success:
                            logger.error(f"Failed to update job results for {job_id}")
                            # Don't set status to completed if results failed to save
                            raise Exception(f"Failed to save job results for {job_id}")
                        else:
                            logger.info(f"Successfully updated job results for {job_id}")
                        
                        # Update job status only if results were saved successfully
                        JobService.update_job_async_info(
                            job_id=job_id,
                            status="completed",
                            progress=1.0
                        )
                        
                        # Send completion - user can now see results and interact
                        _send_progress_update(status_sender, task_id, worker_id, 1.0, "completed")
                        
                        # Start background compression - happens after user sees results
                        import threading
                        
                        # Capture variables for thread (fix scope issues)
                        captured_job_id = job_id
                        captured_real_data = task_dict["real_data"]
                        captured_synthetic_data = task_dict["synthetic_data"]
                        captured_real_headers = task_dict.get("real_headers")
                        captured_synthetic_headers = task_dict.get("synthetic_headers")
                        
                        def compress_in_background():
                            JobService.compress_and_store_data_async(
                                job_id=captured_job_id,
                                real_data=captured_real_data,
                                synthetic_data=captured_synthetic_data,
                                real_headers=captured_real_headers,
                                synthetic_headers=captured_synthetic_headers
                            )
                        
                        compression_thread = threading.Thread(target=compress_in_background, daemon=True)
                        compression_thread.start()
                        
                        logger.info(f"Job {job_id} completed, compression started in background")
                        
                        completion_msg = {
                            "type": "completed",
                            "task_id": task_id,
                            "job_id": job_id,
                            "worker_id": worker_id,
                            "runtime": metadata["runtime"]
                        }
                        
                        status_sender.send_multipart([
                            b"completion",
                            json.dumps(completion_msg).encode()
                        ])
                        
                        logger.info(f"Worker {worker_id} completed task {task_id} for job {job_id}")
                        
                    except Exception as e:
                        logger.error(f"Worker {worker_id} failed task {task_id}: {e}")
                        
                        # Update job status to failed
                        job_id = task_dict.get("job_id")
                        if job_id:
                            JobService.update_job_async_info(
                                job_id=job_id,
                                status="failed"
                            )
                            JobService.mark_job_failed(job_id, str(e))
                        
                        error_msg = {
                            "type": "failed",
                            "task_id": task_id,
                            "job_id": job_id,
                            "worker_id": worker_id,
                            "error_message": str(e)
                        }
                        
                        status_sender.send_multipart([
                            b"error",
                            json.dumps(error_msg).encode()
                        ])
                    
            except zmq.Again:  # Timeout occurred
                consecutive_timeouts += 1
                logger.warning(f"Worker {worker_id} timeout #{consecutive_timeouts} waiting for tasks")
                
                if consecutive_timeouts >= max_consecutive_timeouts:
                    logger.error(f"Worker {worker_id} exceeded max consecutive timeouts, restarting connection")
                    # Reconnect sockets
                    receiver.close()
                    receiver = context.socket(zmq.REQ)
                    receiver.connect(f"tcp://localhost:{frontend_port}")
                    receiver.setsockopt(zmq.RCVTIMEO, 30000)
                    receiver.setsockopt(zmq.SNDTIMEO, 5000)
                    receiver.setsockopt(zmq.LINGER, 1000)
                    consecutive_timeouts = 0
                
                # Brief pause before retrying
                time.sleep(2)
            except Exception as e:
                logger.error(f"Worker {worker_id} unexpected error: {e}")
                time.sleep(5)  # Wait before retrying
                
    except KeyboardInterrupt:
        logger.info(f"Worker {worker_id} shutting down...")
    except Exception as e:
        logger.error(f"Worker {worker_id} fatal error: {e}")
    finally:
        try:
            receiver.close()
            status_sender.close()
            context.term()
        except:
            pass
        logger.info(f"Worker {worker_id} terminated")

def _send_progress_update(status_sender, task_id: str, worker_id: str, progress: float, stage: str):
    """Send progress update from worker."""
    try:
        update = {
            "type": "progress",
            "task_id": task_id,
            "worker_id": worker_id,
            "progress": progress,
            "stage": stage,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        status_sender.send_multipart([
            b"progress",
            json.dumps(update).encode()
        ])
    except Exception:
        pass  # Don't let progress updates crash the worker 