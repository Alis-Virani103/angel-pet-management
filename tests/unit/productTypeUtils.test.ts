import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getCustomProductTypes,
  addCustomProductType,
  normalizeProductType,
  getAllProductTypes
} from '../../src/utils/productTypeUtils';

const STORAGE_KEY = 'angel_pet_custom_product_types';

describe('Product Type Utils', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    // Clean up after each test
    localStorage.removeItem(STORAGE_KEY);
  });

  describe('normalizeProductType', () => {
    it('should trim spaces and capitalize first letter', () => {
      expect(normalizeProductType('sprayers')).toBe('Sprayers');
      expect(normalizeProductType('SPRAYERS')).toBe('Sprayers');
      expect(normalizeProductType('  sprayers  ')).toBe('Sprayers');
      expect(normalizeProductType('Sprayers')).toBe('Sprayers');
    });

    it('should handle empty strings', () => {
      expect(normalizeProductType('')).toBe('');
      expect(normalizeProductType('   ')).toBe('');
    });

    it('should handle single word types', () => {
      expect(normalizeProductType('bottle')).toBe('Bottle');
      expect(normalizeProductType('cap')).toBe('Cap');
      expect(normalizeProductType('inner')).toBe('Inner');
    });

    it('should handle multi-word types', () => {
      expect(normalizeProductType('PET BOTTLES')).toBe('Pet bottles');
      expect(normalizeProductType('pet bottles')).toBe('Pet bottles');
      expect(normalizeProductType('  PET BOTTLES  ')).toBe('Pet bottles');
    });
  });

  describe('getCustomProductTypes', () => {
    it('should return empty array when no custom types exist', () => {
      const types = getCustomProductTypes();
      expect(types).toEqual([]);
      expect(Array.isArray(types)).toBe(true);
    });

    it('should return custom types from localStorage', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['Sprayers', 'Pumps']));
      const types = getCustomProductTypes();
      expect(types).toEqual(['Sprayers', 'Pumps']);
    });

    it('should handle corrupted localStorage data', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid json');
      const types = getCustomProductTypes();
      expect(types).toEqual([]);
    });

    it('should handle non-array data in localStorage', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'an array' }));
      const types = getCustomProductTypes();
      expect(types).toEqual([]);
    });
  });

  describe('addCustomProductType', () => {
    it('should add a new custom product type', () => {
      addCustomProductType('Sprayers');
      const types = getCustomProductTypes();
      expect(types).toContain('Sprayers');
    });

    it('should normalize the type before adding', () => {
      addCustomProductType('  sprayers  ');
      const types = getCustomProductTypes();
      expect(types).toContain('Sprayers');
      expect(types).not.toContain('sprayers');
      expect(types).not.toContain('  sprayers  ');
    });

    it('should not add duplicate types', () => {
      addCustomProductType('Sprayers');
      addCustomProductType('Sprayers');
      addCustomProductType('sprayers'); // Different case
      const types = getCustomProductTypes();
      expect(types.filter(t => t === 'Sprayers')).toHaveLength(1);
    });

    it('should not add standard types (bottle, cap, inner)', () => {
      addCustomProductType('bottle');
      addCustomProductType('cap');
      addCustomProductType('inner');
      const types = getCustomProductTypes();
      // Standard types should not be added to custom types list
      expect(types).toEqual([]);
    });

    it('should not add empty or invalid types', () => {
      addCustomProductType('');
      addCustomProductType('   ');
      addCustomProductType(null as any);
      addCustomProductType(undefined as any);
      const types = getCustomProductTypes();
      expect(types).toEqual([]);
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage.setItem to throw an error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = () => {
        throw new Error('Storage quota exceeded');
      };

      expect(() => addCustomProductType('Sprayers')).not.toThrow();

      // Restore original method
      localStorage.setItem = originalSetItem;
    });
  });

  describe('getAllProductTypes', () => {
    it('should include standard types even with no products', () => {
      const types = getAllProductTypes([]);
      expect(types).toContain('bottle');
      expect(types).toContain('cap');
      expect(types).toContain('inner');
    });

    it('should include custom types from localStorage', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['Sprayers', 'Pumps']));
      const types = getAllProductTypes([]);
      expect(types).toContain('Sprayers');
      expect(types).toContain('Pumps');
    });

    it('should include types from existing products', () => {
      const products = [
        { type: 'bottle' },
        { type: 'cap' },
        { type: 'custom_type' }
      ];
      const types = getAllProductTypes(products);
      expect(types).toContain('bottle');
      expect(types).toContain('cap');
      expect(types).toContain('custom_type');
    });

    it('should not include duplicate types', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['Sprayers']));
      const products = [
        { type: 'bottle' },
        { type: 'bottle' },
        { type: 'Sprayers' }
      ];
      const types = getAllProductTypes(products);
      const bottleCount = types.filter(t => t === 'bottle').length;
      const sprayerCount = types.filter(t => t === 'Sprayers').length;
      expect(bottleCount).toBe(1);
      expect(sprayerCount).toBe(1);
    });

    it('should return sorted types', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['Sprayers', 'Pumps']));
      const products = [
        { type: 'custom_type' },
        { type: 'bottle' }
      ];
      const types = getAllProductTypes(products);
      const sortedTypes = [...types].sort();
      expect(types).toEqual(sortedTypes);
    });

    it('should handle products without type field', () => {
      const products = [
        { type: 'bottle' },
        { name: 'product without type' },
        null,
        undefined
      ];
      const types = getAllProductTypes(products);
      expect(types).toContain('bottle');
      expect(types.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Integration: Full workflow', () => {
    it('should allow adding a new type and retrieving it', () => {
      // Add a new custom type
      addCustomProductType('sprayers');

      // Verify it's in localStorage
      const customTypes = getCustomProductTypes();
      expect(customTypes).toContain('Sprayers');

      // Verify it appears in all types
      const allTypes = getAllProductTypes([]);
      expect(allTypes).toContain('Sprayers');

      // Verify standard types are still present
      expect(allTypes).toContain('bottle');
      expect(allTypes).toContain('cap');
      expect(allTypes).toContain('inner');
    });

    it('should handle case-insensitive duplicate prevention', () => {
      addCustomProductType('sprayers');
      addCustomProductType('SPRAYERS');
      addCustomProductType('Sprayers');

      const types = getCustomProductTypes();
      expect(types.filter(t => t === 'Sprayers')).toHaveLength(1);
    });

    it('should handle multiple custom types', () => {
      addCustomProductType('sprayers');
      addCustomProductType('pumps');
      addCustomProductType('nozzles');

      const types = getCustomProductTypes();
      expect(types).toContain('Sprayers');
      expect(types).toContain('Pumps');
      expect(types).toContain('Nozzles');
      expect(types.length).toBe(3);
    });
  });
});
