export class LoginResponse {
    constructor(token, expires) {
        this.token = token;
        this.expires = expires;
    }
}

export class HostResponse {
    constructor(host) {
        this.id = host.id;
        this.domains = host.domains;
        this.matcher = host.matcher;
        this.upstreams = host.Upstreams?.map(u => ({
            id: u.id,
            backend: u.backend
        })) || [];
        this.createdAt = host.createdAt;
        this.updatedAt = host.updatedAt;
    }
}

export class UserResponse {
    constructor(user) {
        this.id = user.id;
        this.name = user.name;
        this.email = user.email;
        this.createdAt = user.createdAt;
        this.updatedAt = user.updatedAt;
    }

    static fromUser(user) {
        return new UserResponse(user);
    }

    static fromUsers(users) {
        return users.map(user => new UserResponse(user));
    }
}

export class SetupResponse {
    constructor(isSetup) {
        this.isSetup = isSetup;
    }
} 