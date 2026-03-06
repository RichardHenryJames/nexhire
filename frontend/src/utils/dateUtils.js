/**
 * Date utility functions - timezone-safe date handling.
 * 
 * IMPORTANT: Never use `new Date(dateString).toISOString().split('T')[0]` to extract
 * a YYYY-MM-DD date string. toISOString() converts to UTC, which shifts the date
 * by -1 day for users in positive UTC offset timezones (e.g., IST +5:30).
 * 
 * Use these helpers instead.
 */

/**
 * Safely extracts a YYYY-MM-DD string from a Date object using LOCAL timezone.
 * Use this instead of `date.toISOString().split('T')[0]`.
 * 
 * @param {Date} date - A JavaScript Date object
 * @returns {string} Date in YYYY-MM-DD format (local timezone)
 */
export function formatLocalDate(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Safely converts a date value (string, Date, ISO timestamp) to a YYYY-MM-DD string
 * without any UTC timezone shift.
 * 
 * Use this instead of `new Date(value).toISOString().split('T')[0]`.
 * 
 * @param {string|Date|null|undefined} value - Date value from API or state
 * @returns {string} Date in YYYY-MM-DD format, or '' if invalid/empty
 */
export function toDateString(value) {
  if (!value) return '';

  // Already a clean YYYY-MM-DD string — return as-is
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // If it's an ISO string like "2025-05-26T00:00:00.000Z" or "2025-05-26T18:30:00Z",
  // extract the date part directly from the string to avoid UTC conversion
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.substring(0, 10);
  }

  // Date object — use local timezone
  if (value instanceof Date) {
    return formatLocalDate(value);
  }

  // Fallback: try to parse, but use substring for strings
  if (typeof value === 'string') {
    return value.substring(0, 10);
  }

  return '';
}

/**
 * Parses a YYYY-MM-DD string as a LOCAL Date (not UTC).
 * Use this instead of `new Date('YYYY-MM-DD')` which parses as UTC midnight.
 * 
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {Date|null} Local Date object, or null if invalid
 */
export function parseLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Returns today's date as a YYYY-MM-DD string in local timezone.
 * Use this instead of `new Date().toISOString().split('T')[0]`.
 * 
 * @returns {string} Today's date in YYYY-MM-DD format
 */
export function todayString() {
  return formatLocalDate(new Date());
}
