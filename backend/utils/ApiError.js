/** An error whose message is safe to show to the client. */
class ApiError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.isApiError = true;
  }
}
module.exports = ApiError;
