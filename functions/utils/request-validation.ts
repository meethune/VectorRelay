// Request Validation Middleware
// Provides reusable request validators for common API patterns

/**
 * Standard pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string>;
}

/**
 * Validate and parse pagination parameters from URL
 *
 * @param url - Request URL
 * @param options - Pagination constraints
 * @returns Validated pagination params or error
 *
 * @example
 * const result = validatePagination(url, { maxLimit: 100 });
 * if (!result.valid) {
 *   return Response.json({ error: result.error }, { status: 400 });
 * }
 * const { page, limit, offset } = result.data!;
 */
export function validatePagination(
  url: URL,
  options: {
    defaultPage?: number;
    defaultLimit?: number;
    maxLimit?: number;
    maxPage?: number;
  } = {}
): ValidationResult<PaginationParams> {
  const {
    defaultPage = 1,
    defaultLimit = 20,
    maxLimit = 100,
    maxPage = 1000,
  } = options;

  const errors: Record<string, string> = {};

  // Validate page parameter
  const pageParam = url.searchParams.get('page');
  let page = defaultPage;

  if (pageParam !== null) {
    const parsedPage = parseInt(pageParam, 10);
    if (isNaN(parsedPage) || parsedPage < 1) {
      errors.page = 'Page must be a positive integer';
    } else if (parsedPage > maxPage) {
      errors.page = `Page must be ${maxPage} or less`;
    } else {
      page = parsedPage;
    }
  }

  // Validate limit parameter
  const limitParam = url.searchParams.get('limit');
  let limit = defaultLimit;

  if (limitParam !== null) {
    const parsedLimit = parseInt(limitParam, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      errors.limit = 'Limit must be a positive integer';
    } else if (parsedLimit > maxLimit) {
      errors.limit = `Limit must be ${maxLimit} or less`;
    } else {
      limit = parsedLimit;
    }
  }

  // Return errors if validation failed
  if (Object.keys(errors).length > 0) {
    const errorMessage = Object.entries(errors)
      .map(([field, msg]) => `${field}: ${msg}`)
      .join(', ');

    return {
      valid: false,
      error: errorMessage,
      errors,
    };
  }

  // Calculate offset
  const offset = (page - 1) * limit;

  return {
    valid: true,
    data: { page, limit, offset },
  };
}

/**
 * Validate sort parameters
 *
 * @param url - Request URL
 * @param allowedFields - Allowed fields for sorting
 * @param defaultField - Default sort field
 * @param defaultOrder - Default sort order
 * @returns Validated sort params or error
 *
 * @example
 * const result = validateSort(url, ['published_at', 'severity', 'title']);
 * if (!result.valid) {
 *   return Response.json({ error: result.error }, { status: 400 });
 * }
 * const { field, order } = result.data!;
 */
export function validateSort(
  url: URL,
  allowedFields: string[],
  defaultField: string = 'published_at',
  defaultOrder: 'asc' | 'desc' = 'desc'
): ValidationResult<{ field: string; order: 'asc' | 'desc' }> {
  const sortParam = url.searchParams.get('sort');
  const orderParam = url.searchParams.get('order');

  let field = defaultField;
  let order: 'asc' | 'desc' = defaultOrder;

  const errors: Record<string, string> = {};

  // Validate sort field
  if (sortParam !== null) {
    if (!allowedFields.includes(sortParam)) {
      errors.sort = `Sort field must be one of: ${allowedFields.join(', ')}`;
    } else {
      field = sortParam;
    }
  }

  // Validate sort order
  if (orderParam !== null) {
    const normalizedOrder = orderParam.toLowerCase();
    if (normalizedOrder !== 'asc' && normalizedOrder !== 'desc') {
      errors.order = 'Order must be "asc" or "desc"';
    } else {
      order = normalizedOrder as 'asc' | 'desc';
    }
  }

  if (Object.keys(errors).length > 0) {
    const errorMessage = Object.entries(errors)
      .map(([field, msg]) => `${field}: ${msg}`)
      .join(', ');

    return {
      valid: false,
      error: errorMessage,
      errors,
    };
  }

  return {
    valid: true,
    data: { field, order },
  };
}

/**
 * Validate date range parameters
 *
 * @param url - Request URL
 * @returns Validated date range or error
 *
 * @example
 * const result = validateDateRange(url);
 * if (!result.valid) {
 *   return Response.json({ error: result.error }, { status: 400 });
 * }
 * const { from, to } = result.data!;
 */
export function validateDateRange(
  url: URL
): ValidationResult<{ from?: Date; to?: Date }> {
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');

  const errors: Record<string, string> = {};
  let from: Date | undefined;
  let to: Date | undefined;

  // Validate 'from' date
  if (fromParam !== null) {
    const parsedFrom = new Date(fromParam);
    if (isNaN(parsedFrom.getTime())) {
      errors.from = 'Invalid date format for "from" parameter';
    } else {
      from = parsedFrom;
    }
  }

  // Validate 'to' date
  if (toParam !== null) {
    const parsedTo = new Date(toParam);
    if (isNaN(parsedTo.getTime())) {
      errors.to = 'Invalid date format for "to" parameter';
    } else {
      to = parsedTo;
    }
  }

  // Validate date range logic
  if (from && to && from > to) {
    errors.range = '"from" date must be before "to" date';
  }

  if (Object.keys(errors).length > 0) {
    const errorMessage = Object.entries(errors)
      .map(([field, msg]) => `${field}: ${msg}`)
      .join(', ');

    return {
      valid: false,
      error: errorMessage,
      errors,
    };
  }

  return {
    valid: true,
    data: { from, to },
  };
}

/**
 * Validate boolean query parameter
 *
 * @param url - Request URL
 * @param paramName - Parameter name
 * @param defaultValue - Default value if parameter not present
 * @returns Boolean value
 *
 * @example
 * const includeArchived = validateBoolean(url, 'archived', false);
 */
export function validateBoolean(
  url: URL,
  paramName: string,
  defaultValue: boolean = false
): boolean {
  const param = url.searchParams.get(paramName);

  if (param === null) {
    return defaultValue;
  }

  const normalized = param.toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

/**
 * Validate array query parameter (comma-separated values)
 *
 * @param url - Request URL
 * @param paramName - Parameter name
 * @param allowedValues - Allowed values (optional)
 * @param maxItems - Maximum number of items
 * @returns Validated array or error
 *
 * @example
 * const result = validateArrayParam(url, 'categories', THREAT_CATEGORIES, 10);
 * if (!result.valid) {
 *   return Response.json({ error: result.error }, { status: 400 });
 * }
 * const categories = result.data!;
 */
export function validateArrayParam(
  url: URL,
  paramName: string,
  allowedValues?: readonly string[],
  maxItems: number = 10
): ValidationResult<string[]> {
  const param = url.searchParams.get(paramName);

  if (param === null || param.trim() === '') {
    return {
      valid: true,
      data: [],
    };
  }

  // Split and clean
  const items = param
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);

  // Check max items
  if (items.length > maxItems) {
    return {
      valid: false,
      error: `${paramName} cannot contain more than ${maxItems} items`,
    };
  }

  // Validate against allowed values if provided
  if (allowedValues) {
    const allowedSet = new Set(allowedValues);
    const invalidItems = items.filter(item => !allowedSet.has(item));

    if (invalidItems.length > 0) {
      return {
        valid: false,
        error: `Invalid ${paramName}: ${invalidItems.join(', ')}. Allowed: ${[...allowedValues].join(', ')}`,
      };
    }
  }

  return {
    valid: true,
    data: items,
  };
}

/**
 * Validate request body size
 *
 * @param request - Request object
 * @param maxSizeBytes - Maximum allowed size in bytes
 * @returns Validation result
 *
 * @example
 * const result = await validateBodySize(request, 1024 * 100); // 100KB max
 * if (!result.valid) {
 *   return Response.json({ error: result.error }, { status: 413 });
 * }
 */
export async function validateBodySize(
  request: Request,
  maxSizeBytes: number = 1024 * 1024 // 1MB default
): Promise<ValidationResult<void>> {
  const contentLength = request.headers.get('Content-Length');

  if (contentLength !== null) {
    const size = parseInt(contentLength, 10);
    if (size > maxSizeBytes) {
      return {
        valid: false,
        error: `Request body too large. Maximum size: ${Math.floor(maxSizeBytes / 1024)}KB`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate JSON request body
 *
 * @param request - Request object
 * @param requiredFields - Required fields in the JSON body
 * @param maxSizeBytes - Maximum body size
 * @returns Parsed JSON or error
 *
 * @example
 * const result = await validateJSONBody(request, ['title', 'content']);
 * if (!result.valid) {
 *   return Response.json({ error: result.error }, { status: 400 });
 * }
 * const body = result.data!;
 */
export async function validateJSONBody<T = Record<string, unknown>>(
  request: Request,
  requiredFields: string[] = [],
  maxSizeBytes: number = 1024 * 1024
): Promise<ValidationResult<T>> {
  // Validate body size first
  const sizeCheck = await validateBodySize(request, maxSizeBytes);
  if (!sizeCheck.valid) {
    return {
      valid: false,
      error: sizeCheck.error,
    };
  }

  // Validate Content-Type
  const contentType = request.headers.get('Content-Type');
  if (!contentType || !contentType.includes('application/json')) {
    return {
      valid: false,
      error: 'Content-Type must be application/json',
    };
  }

  // Parse JSON
  let body: any;
  try {
    body = await request.json();
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid JSON in request body',
    };
  }

  // Validate required fields
  const errors: Record<string, string> = {};
  for (const field of requiredFields) {
    if (!(field in body) || body[field] === undefined || body[field] === null) {
      errors[field] = `Field "${field}" is required`;
    }
  }

  if (Object.keys(errors).length > 0) {
    const errorMessage = Object.entries(errors)
      .map(([_field, msg]) => msg)
      .join(', ');

    return {
      valid: false,
      error: errorMessage,
      errors,
    };
  }

  return {
    valid: true,
    data: body as T,
  };
}

/**
 * Validate URL parameter (path parameter)
 *
 * @param value - Parameter value
 * @param paramName - Parameter name (for error messages)
 * @param pattern - Optional regex pattern to match
 * @param minLength - Minimum length
 * @param maxLength - Maximum length
 * @returns Validated value or error
 *
 * @example
 * const result = validatePathParam(id, 'id', /^[a-z0-9]+$/i, 8, 20);
 * if (!result.valid) {
 *   return Response.json({ error: result.error }, { status: 400 });
 * }
 */
export function validatePathParam(
  value: string | undefined,
  paramName: string,
  pattern?: RegExp,
  minLength: number = 1,
  maxLength: number = 100
): ValidationResult<string> {
  if (!value) {
    return {
      valid: false,
      error: `${paramName} is required`,
    };
  }

  if (value.length < minLength) {
    return {
      valid: false,
      error: `${paramName} must be at least ${minLength} characters`,
    };
  }

  if (value.length > maxLength) {
    return {
      valid: false,
      error: `${paramName} must be at most ${maxLength} characters`,
    };
  }

  if (pattern && !pattern.test(value)) {
    return {
      valid: false,
      error: `${paramName} has invalid format`,
    };
  }

  return {
    valid: true,
    data: value,
  };
}

/**
 * Validate common request headers
 *
 * @param request - Request object
 * @param options - Validation options
 * @returns Validation result
 */
export function validateHeaders(
  request: Request,
  options: {
    requireContentType?: boolean;
    requireAuthorization?: boolean;
    allowedContentTypes?: string[];
  } = {}
): ValidationResult<void> {
  const { requireContentType, requireAuthorization, allowedContentTypes } = options;
  const errors: Record<string, string> = {};

  // Validate Content-Type if required
  if (requireContentType) {
    const contentType = request.headers.get('Content-Type');
    if (!contentType) {
      errors.contentType = 'Content-Type header is required';
    } else if (allowedContentTypes && !allowedContentTypes.some(ct => contentType.includes(ct))) {
      errors.contentType = `Content-Type must be one of: ${allowedContentTypes.join(', ')}`;
    }
  }

  // Validate Authorization if required
  if (requireAuthorization) {
    const auth = request.headers.get('Authorization');
    if (!auth) {
      errors.authorization = 'Authorization header is required';
    }
  }

  if (Object.keys(errors).length > 0) {
    const errorMessage = Object.entries(errors)
      .map(([_field, msg]) => msg)
      .join(', ');

    return {
      valid: false,
      error: errorMessage,
      errors,
    };
  }

  return { valid: true };
}
