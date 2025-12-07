package scheduler

import "time"

// Task represents a scheduled job.
type Task struct {
	Name     string
	Interval time.Duration
	Run      func()
}

// Runner is a lightweight scheduler placeholder.
type Runner struct {
	tasks []Task
}

func NewRunner(tasks ...Task) *Runner {
	return &Runner{tasks: tasks}
}

// Start runs all tasks asynchronously.
func (r *Runner) Start() {
	for _, t := range r.tasks {
		task := t
		go func() {
			ticker := time.NewTicker(task.Interval)
			defer ticker.Stop()
			for range ticker.C {
				task.Run()
			}
		}()
	}
}
