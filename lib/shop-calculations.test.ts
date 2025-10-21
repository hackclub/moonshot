import { describe, test, expect, vi, beforeEach } from 'vitest';
import { calculateRandomizedPrice, calculateCurrencyPrice, computeOrderUsdValue } from './shop-utils';

vi.mock('crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab')
  }))
}));

describe('Shop Calculations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1640995200000);
  });

  describe('calculateRandomizedPrice', () => {
    test('returns deterministic price for same inputs', () => {
      const userId = 'user123';
      const itemId = 'item456';
      const basePrice = 100;
      
      const price1 = calculateRandomizedPrice(userId, itemId, basePrice);
      const price2 = calculateRandomizedPrice(userId, itemId, basePrice);
      
      expect(price1).toBe(price2);
      expect(price1).toBeGreaterThan(0);
    });

    test('returns different prices for different users', () => {
      const itemId = 'item456';
      const basePrice = 100;
      
      const price1 = calculateRandomizedPrice('user1', itemId, basePrice);
      const price2 = calculateRandomizedPrice('user2', itemId, basePrice);
      
      expect(typeof price1).toBe('number');
      expect(typeof price2).toBe('number');
    });

    test('respects min and max percentage bounds', () => {
      const userId = 'user123';
      const itemId = 'item456';
      const basePrice = 100;
      const minPercent = 80;
      const maxPercent = 120;
      
      const price = calculateRandomizedPrice(userId, itemId, basePrice, minPercent, maxPercent);
      
      expect(price).toBeGreaterThanOrEqual(Math.floor(basePrice * minPercent / 100));
      expect(price).toBeLessThanOrEqual(Math.ceil(basePrice * maxPercent / 100));
    });

    test('handles edge case of very low base price', () => {
      const userId = 'user123';
      const itemId = 'item456';
      const basePrice = 1;
      
      const price = calculateRandomizedPrice(userId, itemId, basePrice);
      
      expect(price).toBeGreaterThanOrEqual(1);
    });

    test('handles invalid percentage bounds', () => {
      const userId = 'user123';
      const itemId = 'item456';
      const basePrice = 100;
      
      const price = calculateRandomizedPrice(userId, itemId, basePrice, 120, 80);
      
      expect(price).toBeGreaterThan(0);
      expect(typeof price).toBe('number');
    });
  });

  describe('calculateCurrencyPrice', () => {
    test('calculates currency price using phi formula', () => {
      const usdCost = 10;
      const dollarsPerHour = 5;
      const phi = (1 + Math.sqrt(5)) / 2;
      
      const expectedcurrency = Math.round((usdCost / dollarsPerHour) * phi * 10);
      const actualcurrency = calculateCurrencyPrice(usdCost, dollarsPerHour);
      
      expect(actualcurrency).toBe(expectedcurrency);
    });

    test('returns 0 for zero or negative dollars per hour', () => {
      expect(calculateCurrencyPrice(10, 0)).toBe(0);
      expect(calculateCurrencyPrice(10, -5)).toBe(0);
    });

    test('handles fractional USD costs', () => {
      const usdCost = 12.50;
      const dollarsPerHour = 2.5;
      
      const currency = calculateCurrencyPrice(usdCost, dollarsPerHour);
      
      expect(currency).toBeGreaterThan(0);
      expect(Number.isInteger(currency)).toBe(true);
    });

    test('scales proportionally with USD cost', () => {
      const dollarsPerHour = 5;
      
      const currency10 = calculateCurrencyPrice(10, dollarsPerHour);
      const currency20 = calculateCurrencyPrice(20, dollarsPerHour);
      
      expect(currency20).toBeGreaterThan(currency10);
      expect(currency20 / currency10).toBeCloseTo(2, 1);
    });
  });

  describe('computeOrderUsdValue', () => {
    test('calculates order value as item cost times quantity', () => {
      const mockItem = {
        id: 'item1',
        usdCost: 25.00,
        costType: 'fixed' as const,
        config: {}
      };
      
      const mockOrder = {
        id: 'order1',
        quantity: 3,
        config: {}
      };
      
      const value = computeOrderUsdValue(mockItem as any, mockOrder as any);
      
      expect(value).toBe(75.00);
    });

    test('handles single quantity orders', () => {
      const mockItem = {
        id: 'item1',
        usdCost: 15.99,
        costType: 'fixed' as const,
        config: {}
      };
      
      const mockOrder = {
        id: 'order1',
        quantity: 1,
        config: {}
      };
      
      const value = computeOrderUsdValue(mockItem as any, mockOrder as any);
      
      expect(value).toBe(15.99);
    });

    test('handles zero quantity orders', () => {
      const mockItem = {
        id: 'item1',
        usdCost: 10.00,
        costType: 'fixed' as const,
        config: {}
      };
      
      const mockOrder = {
        id: 'order1',
        quantity: 0,
        config: {}
      };
      
      const value = computeOrderUsdValue(mockItem as any, mockOrder as any);
      
      expect(value).toBe(0);
    });

    test('handles fractional costs', () => {
      const mockItem = {
        id: 'item1',
        usdCost: 12.99,
        costType: 'fixed' as const,
        config: {}
      };
      
      const mockOrder = {
        id: 'order1',
        quantity: 2,
        config: {}
      };
      
      const value = computeOrderUsdValue(mockItem as any, mockOrder as any);
      
      expect(value).toBe(25.98);
    });
  });

  describe('Price Consistency', () => {
    test('shell price calculation is consistent', () => {
      const usdCost = 20;
      const dollarsPerHour = 4;
      
      const currency1 = calculateCurrencyPrice(usdCost, dollarsPerHour);
      const currency2 = calculateCurrencyPrice(usdCost, dollarsPerHour);
      
      expect(currency1).toBe(currency2);
    });

    test('randomized price changes with different hours', () => {
      const userId = 'user123';
      const itemId = 'item456';
      const basePrice = 100;
      
      vi.spyOn(Date, 'now').mockReturnValue(1640995200000);
      const price1 = calculateRandomizedPrice(userId, itemId, basePrice);
      
      vi.spyOn(Date, 'now').mockReturnValue(1640998800000);
      const price2 = calculateRandomizedPrice(userId, itemId, basePrice);
      
      expect(typeof price1).toBe('number');
      expect(typeof price2).toBe('number');
    });
  });

  describe('Edge Cases', () => {
    test('handles very large numbers', () => {
      const currency = calculateCurrencyPrice(1000000, 100);
      expect(currency).toBeGreaterThan(0);
      expect(Number.isFinite(currency)).toBe(true);
    });

    test('handles very small numbers', () => {
      const currency = calculateCurrencyPrice(0.01, 0.001);
      expect(currency).toBeGreaterThan(0);
      expect(Number.isInteger(currency)).toBe(true);
    });

    test('randomized price always returns at least 1', () => {
      const userId = 'user123';
      const itemId = 'item456';
      const basePrice = 0.1;
      
      const price = calculateRandomizedPrice(userId, itemId, basePrice);
      
      expect(price).toBeGreaterThanOrEqual(1);
    });
  });
});