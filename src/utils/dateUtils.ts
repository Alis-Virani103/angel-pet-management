/**
 * Comprehensive Date Utilities for DD-MM-YYYY formatting and parsing.
 */

/**
 * Formats any date string, Date object, or timestamp into DD-MM-YYYY format.
 * Handles ISO strings ('2026-10-25', '2026-10-25T14:30:00.000Z'), DD/MM/YYYY, DD MM YYYY, timestamps, etc.
 * Never throws and never produces 'NaN-NaN-NaN'.
 */
export function formatDate(dateInput: string | Date | number | null | undefined): string {
  if (!dateInput && dateInput !== 0) return '';

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed) return '';

    // Already in DD-MM-YYYY format
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      return trimmed;
    }

    // DD/MM/YYYY or DD.MM.YYYY
    const slashMatch = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(trimmed);
    if (slashMatch) {
      const d = slashMatch[1].padStart(2, '0');
      const m = slashMatch[2].padStart(2, '0');
      const y = slashMatch[3];
      return `${d}-${m}-${y}`;
    }

    // DD MM YYYY (space separated)
    const spaceMatch = /^(\d{1,2})\s+(\d{1,2})\s+(\d{4})$/.exec(trimmed);
    if (spaceMatch) {
      const d = spaceMatch[1].padStart(2, '0');
      const m = spaceMatch[2].padStart(2, '0');
      const y = spaceMatch[3];
      return `${d}-${m}-${y}`;
    }

    // DDMMYYYY (8 digits)
    const eightDigitMatch = /^(\d{2})(\d{2})(\d{4})$/.exec(trimmed);
    if (eightDigitMatch) {
      return `${eightDigitMatch[1]}-${eightDigitMatch[2]}-${eightDigitMatch[3]}`;
    }

    // Starts with YYYY-MM-DD
    const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
    if (isoDateMatch) {
      const [, y, m, d] = isoDateMatch;
      return `${d}-${m}-${y}`;
    }

    // Fallback: parse using standard Date constructor
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      return `${day}-${month}-${year}`;
    }

    return trimmed;
  }

  if (dateInput instanceof Date) {
    if (!Number.isNaN(dateInput.getTime())) {
      const day = String(dateInput.getDate()).padStart(2, '0');
      const month = String(dateInput.getMonth() + 1).padStart(2, '0');
      const year = dateInput.getFullYear();
      return `${day}-${month}-${year}`;
    }
    return '';
  }

  if (typeof dateInput === 'number') {
    const parsed = new Date(dateInput);
    if (!Number.isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      return `${day}-${month}-${year}`;
    }
    return '';
  }

  return '';
}

/**
 * Parse production date from various formats
 * Supports: YYYY-MM-DD (ISO), DD-MM-YYYY, DD MM YYYY
 * Returns: YYYY-MM-DD format for Firebase storage
 */
export function parseProductionDate(value: string): string | null {
  if (!value || typeof value !== 'string') return null;

  // Handle YYYY-MM-DD format from date picker
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (isoMatch) {
    const [, yearText, monthText, dayText] = isoMatch;
    const day = Number(dayText);
    const month = Number(monthText);
    const year = Number(yearText);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      year < 1 ||
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      return null;
    }
    return `${yearText}-${monthText}-${dayText}`;
  }

  // Handle DD-MM-YYYY format
  const dashMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (dashMatch) {
    const [, dayText, monthText, yearText] = dashMatch;
    const day = Number(dayText);
    const month = Number(monthText);
    const year = Number(yearText);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      year < 1 ||
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      return null;
    }
    return `${yearText}-${monthText}-${dayText}`;
  }

  // Handle DD MM YYYY format (legacy support)
  const spaceMatch = /^(\d{2}) (\d{2}) (\d{4})$/.exec(value);
  if (spaceMatch) {
    const [, dayText, monthText, yearText] = spaceMatch;
    const day = Number(dayText);
    const month = Number(monthText);
    const year = Number(yearText);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      year < 1 ||
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      return null;
    }
    return `${yearText}-${monthText}-${dayText}`;
  }

  return null;
}

/**
 * Format ISO date (YYYY-MM-DD) to display format (DD-MM-YYYY)
 */
export function formatDateForDisplay(isoDate: string): string {
  if (!isoDate) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  return `${day}-${month}-${year}`;
}

/**
 * Format display date (DD-MM-YYYY) to ISO format (YYYY-MM-DD) for date input
 */
export function formatDateForInput(displayDate: string): string {
  if (!displayDate) return '';
  // Handle DD-MM-YYYY format
  const displayMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(displayDate);
  if (displayMatch) {
    const [, day, month, year] = displayMatch;
    return `${year}-${month}-${day}`;
  }
  // Handle DD MM YYYY format (legacy)
  const legacyMatch = /^(\d{2}) (\d{2}) (\d{4})$/.exec(displayDate);
  if (legacyMatch) {
    const [, day, month, year] = legacyMatch;
    return `${year}-${month}-${day}`;
  }
  // Already in YYYY-MM-DD format
  return displayDate;
}

/**
 * Check if a year is a leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Get the number of days in a month for a given year
 */
export function getDaysInMonth(year: number, month: number): number {
  const monthIndex = month - 1; // Convert to 0-based index
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return daysInMonth[monthIndex];
}

/**
 * Validate if a date is valid (handles leap years)
 */
export function isValidDate(day: number, month: number, year: number): boolean {
  if (year < 1 || year > 9999) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > getDaysInMonth(year, month)) return false;
  return true;
}

/**
 * Parses user-entered date string in DD-MM-YYYY, DD/MM/YYYY, DD MM YYYY, DDMMYYYY, or YYYY-MM-DD
 * into a canonical ISO date string (YYYY-MM-DD).
 * Validates day/month/year ranges and calendar validity (e.g. leap years, 28-31 days).
 * Returns null if invalid or incomplete.
 */
export function parseDateToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const str = value.trim();
  if (!str) return null;

  let day: number, month: number, year: number;

  // 1. DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, or DD MM YYYY
  const separatorMatch = /^(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{4})$/.exec(str);
  if (separatorMatch) {
    day = Number(separatorMatch[1]);
    month = Number(separatorMatch[2]);
    year = Number(separatorMatch[3]);
  } else {
    // 2. Continuous 8 digits: DDMMYYYY
    const digitsOnlyMatch = /^(\d{2})(\d{2})(\d{4})$/.exec(str);
    if (digitsOnlyMatch) {
      day = Number(digitsOnlyMatch[1]);
      month = Number(digitsOnlyMatch[2]);
      year = Number(digitsOnlyMatch[3]);
    } else {
      // 3. YYYY-MM-DD (ISO)
      const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str);
      if (isoMatch) {
        year = Number(isoMatch[1]);
        month = Number(isoMatch[2]);
        day = Number(isoMatch[3]);
      } else {
        return null;
      }
    }
  }

  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  // Validate day for the given month/year
  const testDate = new Date(Date.UTC(year, month - 1, day));
  if (
    testDate.getUTCFullYear() !== year ||
    testDate.getUTCMonth() !== month - 1 ||
    testDate.getUTCDate() !== day
  ) {
    return null;
  }

  const dayStr = String(day).padStart(2, '0');
  const monthStr = String(month).padStart(2, '0');
  const yearStr = String(year);
  return `${yearStr}-${monthStr}-${dayStr}`;
}

/**
 * Returns today's date formatted as canonical ISO (YYYY-MM-DD).
 */
export function getTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date formatted as DD-MM-YYYY.
 */
export function getTodayDisplay(): string {
  return formatDate(getTodayIso());
}

/**
 * Formats any date string, Date object, or timestamp into DDMMYYYY format (no separators).
 * Handles ISO strings ('2026-10-25', '2026-10-25T14:30:00.000Z'), DD/MM/YYYY, DD MM YYYY, timestamps, etc.
 * Ensures single-digit days and months are padded with leading zeros.
 * Example: 22/10/2026 becomes 22102026.
 */
export function formatDateDDMMYYYY(dateInput: string | Date | number | null | undefined): string {
  if (!dateInput && dateInput !== 0) return '';

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed) return '';

    // Already in DDMMYYYY format (8 digits)
    if (/^\d{8}$/.test(trimmed)) {
      return trimmed;
    }

    // DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
    const separatorMatch = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(trimmed);
    if (separatorMatch) {
      const d = separatorMatch[1].padStart(2, '0');
      const m = separatorMatch[2].padStart(2, '0');
      const y = separatorMatch[3];
      return `${d}${m}${y}`;
    }

    // DD MM YYYY (space separated)
    const spaceMatch = /^(\d{1,2})\s+(\d{1,2})\s+(\d{4})$/.exec(trimmed);
    if (spaceMatch) {
      const d = spaceMatch[1].padStart(2, '0');
      const m = spaceMatch[2].padStart(2, '0');
      const y = spaceMatch[3];
      return `${d}${m}${y}`;
    }

    // Starts with YYYY-MM-DD
    const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
    if (isoDateMatch) {
      const [, y, m, d] = isoDateMatch;
      return `${d}${m}${y}`;
    }

    // Fallback: parse using standard Date constructor
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      return `${day}${month}${year}`;
    }

    return trimmed;
  }

  if (dateInput instanceof Date) {
    if (!Number.isNaN(dateInput.getTime())) {
      const day = String(dateInput.getDate()).padStart(2, '0');
      const month = String(dateInput.getMonth() + 1).padStart(2, '0');
      const year = dateInput.getFullYear();
      return `${day}${month}${year}`;
    }
    return '';
  }

  if (typeof dateInput === 'number') {
    const parsed = new Date(dateInput);
    if (!Number.isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      return `${day}${month}${year}`;
    }
    return '';
  }

  return '';
}
