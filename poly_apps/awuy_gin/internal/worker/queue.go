package worker

// Job represents an async task.
type Job struct {
	Name string
	Data map[string]interface{}
}

// Queue is a placeholder queue interface.
type Queue interface {
	Push(job Job) error
	Poll() (Job, bool)
}

// MemoryQueue is a simple in-memory queue implementation.
type MemoryQueue struct {
	items chan Job
}

func NewMemoryQueue(size int) *MemoryQueue {
	return &MemoryQueue{items: make(chan Job, size)}
}

func (q *MemoryQueue) Push(job Job) error {
	q.items <- job
	return nil
}

func (q *MemoryQueue) Poll() (Job, bool) {
	select {
	case job := <-q.items:
		return job, true
	default:
		return Job{}, false
	}
}
