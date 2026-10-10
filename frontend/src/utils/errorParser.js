/**
 * Centralized error parsing utility for handling different error response formats
 * from the backend API.
 * 
 * Backend error formats:
 * 1. Simple string: { "detail": "Error message" }
 * 2. Validation errors (array): { "detail": [{ "loc": ["body", "field"], "msg": "Error", "type": "..." }] }
 * 3. HTTPException with custom structure
 */

/**
 * Extract user-friendly error message from axios error response
 * 
 * @param {Error} error - Axios error object
 * @param {string} fallback - Default message if parsing fails
 * @returns {string} - Formatted error message
 */
export function parseErrorMessage(error, fallback = "An unexpected error occurred.") {
  // No response (network error, timeout, etc.)
  if (!error.response) {
    if (error.code === "ECONNABORTED") return "Request timeout. Please try again.";
    if (error.code === "ERR_NETWORK") return "Network error. Check your connection.";
    return "Unable to connect to server.";
  }

  const { status, data } = error.response;

  // No error data
  if (!data) {
    if (status === 401) return "Unauthorized. Please log in again.";
    if (status === 403) return "You don't have permission to perform this action.";
    if (status === 404) return "Resource not found.";
    if (status === 500) return "Server error. Please try again later.";
    return fallback;
  }

  // Extract detail field (most common)
  const detail = data.detail;

  if (!detail) {
    // Fallback to other common error fields
    return data.message || data.error || fallback;
  }

  // String detail (simple error message)
  if (typeof detail === "string") {
    return detail;
  }

  // Array detail (validation errors from FastAPI/Pydantic)
  if (Array.isArray(detail)) {
    return parseValidationErrors(detail);
  }

  // Object detail (structured error)
  if (typeof detail === "object") {
    return detail.message || JSON.stringify(detail);
  }

  return fallback;
}

/**
 * Parse FastAPI/Pydantic validation errors into human-readable format
 * 
 * @param {Array} errors - Array of validation error objects
 * @returns {string} - Formatted validation error message
 */
function parseValidationErrors(errors) {
  if (!Array.isArray(errors) || errors.length === 0) {
    return "Validation error occurred.";
  }

  // Single validation error - extract field and message
  if (errors.length === 1) {
    const err = errors[0];
    const field = extractFieldName(err.loc);
    const msg = err.msg || "Invalid value";
    return field ? `${field}: ${msg}` : msg;
  }

  // Multiple validation errors - format as list
  const messages = errors.map((err) => {
    const field = extractFieldName(err.loc);
    const msg = err.msg || "Invalid value";
    return field ? `• ${field}: ${msg}` : `• ${msg}`;
  });

  return `Validation errors:\n${messages.join("\n")}`;
}

/**
 * Extract readable field name from error location array
 * 
 * @param {Array} loc - Location array (e.g., ["body", "email"])
 * @returns {string} - Formatted field name
 */
function extractFieldName(loc) {
  if (!Array.isArray(loc) || loc.length === 0) return "";
  
  // Skip "body" prefix and return the actual field name
  const fieldPath = loc.filter((part) => part !== "body");
  
  if (fieldPath.length === 0) return "";
  
  // Convert snake_case to Title Case
  return fieldPath
    .map((part) => 
      String(part)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    )
    .join(" → ");
}

/**
 * Check if error is a specific HTTP status code
 * 
 * @param {Error} error - Axios error object
 * @param {number} statusCode - HTTP status code to check
 * @returns {boolean}
 */
export function isErrorStatus(error, statusCode) {
  return error.response?.status === statusCode;
}

/**
 * Check if error is a validation error (422)
 * 
 * @param {Error} error - Axios error object
 * @returns {boolean}
 */
export function isValidationError(error) {
  return isErrorStatus(error, 422);
}

/**
 * Check if error is an authentication error (401)
 * 
 * @param {Error} error - Axios error object
 * @returns {boolean}
 */
export function isAuthError(error) {
  return isErrorStatus(error, 401);
}

/**
 * Check if error is a permission error (403)
 * 
 * @param {Error} error - Axios error object
 * @returns {boolean}
 */
export function isPermissionError(error) {
  return isErrorStatus(error, 403);
}

/**
 * Check if error is a not found error (404)
 * 
 * @param {Error} error - Axios error object
 * @returns {boolean}
 */
export function isNotFoundError(error) {
  return isErrorStatus(error, 404);
}

/**
 * Get all validation error fields (useful for highlighting form fields)
 * 
 * @param {Error} error - Axios error object
 * @returns {string[]} - Array of field names with errors
 */
export function getValidationErrorFields(error) {
  if (!isValidationError(error)) return [];
  
  const detail = error.response?.data?.detail;
  if (!Array.isArray(detail)) return [];
  
  return detail
    .map((err) => extractFieldName(err.loc))
    .filter(Boolean);
}
