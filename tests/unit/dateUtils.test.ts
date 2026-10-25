import { describe, it, expect } from 'vitest';
import {
  parseProductionDate,
  formatDateForDisplay,
  formatDateForInput,
  isLeapYear,
  getDaysInMonth,
  isValidDate
} from '../../src/utils/dateUtils';

describe('Date Utils', () => {
  describe('parseProductionDate', () => {
    it('should parse YYYY-MM-DD format from date picker', () => {
      expect(parseProductionDate('2024-01-15')).toBe('2024-01-15');
      expect(parseProductionDate('2026-10-25')).toBe('2026-10-25');
    });

    it('should parse DD-MM-YYYY format', () => {
      expect(parseProductionDate('15-01-2024')).toBe('2024-01-15');
      expect(parseProductionDate('25-10-2026')).toBe('2026-10-25');
    });

    it('should parse DD MM YYYY format (legacy)', () => {
      expect(parseProductionDate('15 01 2024')).toBe('2024-01-15');
      expect(parseProductionDate('25 10 2026')).toBe('2026-10-25');
    });

    it('should reject invalid dates', () => {
      expect(parseProductionDate('2024-02-30')).toBeNull(); // Feb 30 doesn't exist
      expect(parseProductionDate('2024-13-01')).toBeNull(); // Month 13 doesn't exist
      expect(parseProductionDate('2024-00-01')).toBeNull(); // Month 0 doesn't exist
      expect(parseProductionDate('2024-01-00')).toBeNull(); // Day 0 doesn't exist
      expect(parseProductionDate('2024-01-32')).toBeNull(); // Day 32 doesn't exist
    });

    it('should handle leap years correctly', () => {
      // 2024 is a leap year, Feb 29 is valid
      expect(parseProductionDate('2024-02-29')).toBe('2024-02-29');
      expect(parseProductionDate('29-02-2024')).toBe('2024-02-29');

      // 2023 is not a leap year, Feb 29 is invalid
      expect(parseProductionDate('2023-02-29')).toBeNull();
      expect(parseProductionDate('29-02-2023')).toBeNull();

      // 2000 is a leap year (divisible by 400)
      expect(parseProductionDate('2000-02-29')).toBe('2000-02-29');

      // 1900 is not a leap year (divisible by 100 but not 400)
      expect(parseProductionDate('1900-02-29')).toBeNull();
    });

    it('should reject malformed dates', () => {
      expect(parseProductionDate('')).toBeNull();
      expect(parseProductionDate('invalid')).toBeNull();
      expect(parseProductionDate('2024/01/15')).toBeNull();
      expect(parseProductionDate('15/01/2024')).toBeNull();
      expect(parseProductionDate(null as any)).toBeNull();
      expect(parseProductionDate(undefined as any)).toBeNull();
    });

    it('should reject years before year 1', () => {
      expect(parseProductionDate('0000-01-01')).toBeNull();
      expect(parseProductionDate('01-01-0000')).toBeNull();
    });
  });

  describe('formatDateForDisplay', () => {
    it('should convert YYYY-MM-DD to DD-MM-YYYY', () => {
      expect(formatDateForDisplay('2024-01-15')).toBe('15-01-2024');
      expect(formatDateForDisplay('2026-10-25')).toBe('25-10-2026');
    });

    it('should handle empty strings', () => {
      expect(formatDateForDisplay('')).toBe('');
    });

    it('should return original if not in YYYY-MM-DD format', () => {
      expect(formatDateForDisplay('15-01-2024')).toBe('15-01-2024');
      expect(formatDateForDisplay('invalid')).toBe('invalid');
    });
  });

  describe('formatDateForInput', () => {
    it('should convert DD-MM-YYYY to YYYY-MM-DD', () => {
      expect(formatDateForInput('15-01-2024')).toBe('2024-01-15');
      expect(formatDateForInput('25-10-2026')).toBe('2026-10-25');
    });

    it('should convert DD MM YYYY to YYYY-MM-DD (legacy)', () => {
      expect(formatDateForInput('15 01 2024')).toBe('2024-01-15');
      expect(formatDateForInput('25 10 2026')).toBe('2026-10-25');
    });

    it('should handle empty strings', () => {
      expect(formatDateForInput('')).toBe('');
    });

    it('should return original if already in YYYY-MM-DD format', () => {
      expect(formatDateForInput('2024-01-15')).toBe('2024-01-15');
    });
  });

  describe('isLeapYear', () => {
    it('should identify leap years correctly', () => {
      expect(isLeapYear(2024)).toBe(true); // Divisible by 4
      expect(isLeapYear(2000)).toBe(true); // Divisible by 400
      expect(isLeapYear(1600)).toBe(true); // Divisible by 400
    });

    it('should identify non-leap years correctly', () => {
      expect(isLeapYear(2023)).toBe(false); // Not divisible by 4
      expect(isLeapYear(1900)).toBe(false); // Divisible by 100 but not 400
      expect(isLeapYear(2100)).toBe(false); // Divisible by 100 but not 400
    });
  });

  describe('getDaysInMonth', () => {
    it('should return correct days for each month in a non-leap year', () => {
      expect(getDaysInMonth(2023, 1)).toBe(31); // January
      expect(getDaysInMonth(2023, 2)).toBe(28); // February (non-leap)
      expect(getDaysInMonth(2023, 3)).toBe(31); // March
      expect(getDaysInMonth(2023, 4)).toBe(30); // April
      expect(getDaysInMonth(2023, 5)).toBe(31); // May
      expect(getDaysInMonth(2023, 6)).toBe(30); // June
      expect(getDaysInMonth(2023, 7)).toBe(31); // July
      expect(getDaysInMonth(2023, 8)).toBe(31); // August
      expect(getDaysInMonth(2023, 9)).toBe(30); // September
      expect(getDaysInMonth(2023, 10)).toBe(31); // October
      expect(getDaysInMonth(2023, 11)).toBe(30); // November
      expect(getDaysInMonth(2023, 12)).toBe(31); // December
    });

    it('should return 29 for February in leap years', () => {
      expect(getDaysInMonth(2024, 2)).toBe(29); // Leap year
      expect(getDaysInMonth(2000, 2)).toBe(29); // Leap year (divisible by 400)
    });

    it('should return 28 for February in non-leap years', () => {
      expect(getDaysInMonth(2023, 2)).toBe(28); // Non-leap year
      expect(getDaysInMonth(1900, 2)).toBe(28); // Non-leap year (divisible by 100 but not 400)
    });
  });

  describe('isValidDate', () => {
    it('should validate correct dates', () => {
      expect(isValidDate(15, 1, 2024)).toBe(true);
      expect(isValidDate(29, 2, 2024)).toBe(true); // Leap year
      expect(isValidDate(31, 12, 2023)).toBe(true);
    });

    it('should reject invalid days', () => {
      expect(isValidDate(32, 1, 2024)).toBe(false); // Day 32
      expect(isValidDate(0, 1, 2024)).toBe(false); // Day 0
      expect(isValidDate(30, 2, 2024)).toBe(false); // Feb 30
      expect(isValidDate(29, 2, 2023)).toBe(false); // Feb 29 in non-leap year
    });

    it('should reject invalid months', () => {
      expect(isValidDate(15, 0, 2024)).toBe(false); // Month 0
      expect(isValidDate(15, 13, 2024)).toBe(false); // Month 13
    });

    it('should reject invalid years', () => {
      expect(isValidDate(15, 1, 0)).toBe(false); // Year 0
      expect(isValidDate(15, 1, -1)).toBe(false); // Negative year
      expect(isValidDate(15, 1, 10000)).toBe(false); // Year > 9999
    });

    it('should handle leap year edge cases', () => {
      expect(isValidDate(29, 2, 2000)).toBe(true); // Leap year (divisible by 400)
      expect(isValidDate(29, 2, 1900)).toBe(false); // Not leap year (divisible by 100 but not 400)
    });
  });

  describe('Integration: Full workflow', () => {
    it('should handle round-trip conversion', () => {
      const original = '2024-01-15';
      const display = formatDateForDisplay(original);
      const backToInput = formatDateForInput(display);
      const parsed = parseProductionDate(backToInput);
      expect(parsed).toBe(original);
    });

    it('should handle round-trip from DD-MM-YYYY', () => {
      const original = '15-01-2024';
      const inputFormat = formatDateForInput(original);
      const displayFormat = formatDateForDisplay(inputFormat);
      const parsed = parseProductionDate(displayFormat);
      expect(parsed).toBe('2024-01-15');
    });

    it('should validate leap year dates correctly', () => {
      const leapYearDate = '2024-02-29';
      const parsed = parseProductionDate(leapYearDate);
      expect(parsed).toBe(leapYearDate);

      const nonLeapYearDate = '2023-02-29';
      const parsedInvalid = parseProductionDate(nonLeapYearDate);
      expect(parsedInvalid).toBeNull();
    });
  });
});
