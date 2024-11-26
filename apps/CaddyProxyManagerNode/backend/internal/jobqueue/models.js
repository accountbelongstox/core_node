export class Job {
    constructor(type, data = {}) {
        this.id = crypto.randomUUID();
        this.type = type;
        this.data = data;
        this.createdAt = new Date();
        this.status = 'pending';
    }

    setStatus(status) {
        this.status = status;
        this.updatedAt = new Date();
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            data: this.data,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

export const JobTypes = {
    RELOAD_CADDY: 'RELOAD_CADDY',
    UPDATE_CONFIG: 'UPDATE_CONFIG'
};

export const JobStatus = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed'
}; 