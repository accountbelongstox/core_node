package cachelayer

// Cache abstracts a key-value store.
type Cache interface {
	Set(key string, value interface{}) error
	Get(key string) (interface{}, bool)
}

// MemoryCache is a simple in-memory cache placeholder.
type MemoryCache struct {
	data map[string]interface{}
}

func NewMemoryCache() *MemoryCache {
	return &MemoryCache{data: make(map[string]interface{})}
}

func (m *MemoryCache) Set(key string, value interface{}) error {
	m.data[key] = value
	return nil
}

func (m *MemoryCache) Get(key string) (interface{}, bool) {
	v, ok := m.data[key]
	return v, ok
}
