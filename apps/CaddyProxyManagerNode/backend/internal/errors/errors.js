class AppError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}

export const Errors = {
    DatabaseUnavailable: new AppError('database-unavailable', 'DATABASE_UNAVAILABLE'),
    DuplicateEmailUser: new AppError('email-already-exists', 'DUPLICATE_EMAIL'),
    InvalidLogin: new AppError('invalid-login-credentials', 'INVALID_LOGIN'),
    UserDisabled: new AppError('user-disabled', 'USER_DISABLED'),
    SystemUserReadonly: new AppError('cannot-save-system-users', 'SYSTEM_USER_READONLY'),
    ValidationFailed: new AppError('request-failed-validation', 'VALIDATION_FAILED'),
    CurrentPasswordInvalid: new AppError('current-password-invalid', 'INVALID_CURRENT_PASSWORD'),
    CABundleDoesNotExist: new AppError('ca-bundle-does-not-exist', 'CA_BUNDLE_NOT_FOUND'),
};

export { AppError }; 