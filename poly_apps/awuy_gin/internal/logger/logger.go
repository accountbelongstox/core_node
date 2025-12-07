package logger

import (
	"log"
	"os"
)

// New returns a preconfigured standard logger.
func New() *log.Logger {
	return log.New(os.Stdout, "[awuy_gin] ", log.LstdFlags|log.Lshortfile)
}
