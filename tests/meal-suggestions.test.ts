/**
 * Unit tests for meal-suggestions data transformation logic
 *
 * Tests the algorithm that:
 * - Maps meal types to relevant categories
 * - Filters products by category relevance
 * - Sorts by frequency or quantity
 * - Returns personalized suggestions
 */

import { describe, it, expect, vi } from 'vitest';
import { createMealSuggestionsTool } from '../src/tools/meal-suggestions.js';
import {
  createMockOrder,
  createMockOrderDetail,
  createBreakfastProducts,
  createLunchProducts,
  createSnackProducts,
  createMockProduct
} from './helpers.js';

describe('meal-suggestions: data transformation', () => {

  /**
   * Test category filtering logic
   */
  describe('category filtering', () => {
    it('should filter products by breakfast categories', async () => {
      const breakfastProducts = createBreakfastProducts();
      const lunchProducts = createLunchProducts();

      const orders = [createMockOrder('order1')];
      const orderDetails = [
        createMockOrderDetail('order1', [...breakfastProducts, ...lunchProducts])
      ];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockResolvedValue(orderDetails[0])
      };

      const tool = createMealSuggestionsTool(() => mockAPI as any);
      const result = await tool.handler({ meal_type: 'breakfast' });

      const data = JSON.parse(result.content[0].text);
      const names = data.items.map((i: any) => i.name);

      // Should include breakfast items
      expect(names.some((n: string) => n.toLowerCase().includes('mléko'))).toBe(true);
      expect(names.some((n: string) => n.toLowerCase().includes('rohlík'))).toBe(true);
      expect(names.some((n: string) => n.toLowerCase().includes('máslo'))).toBe(true);

      // Should NOT include lunch items
      expect(names.some((n: string) => n.includes('Kuřecí'))).toBe(false);
      expect(names.some((n: string) => n.includes('fusilli'))).toBe(false);
    });

    it('should filter products by lunch categories', async () => {
      const breakfastProducts = createBreakfastProducts();
      const lunchProducts = createLunchProducts();

      const orders = [createMockOrder('order1')];
      const orderDetails = [
        createMockOrderDetail('order1', [...breakfastProducts, ...lunchProducts])
      ];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockResolvedValue(orderDetails[0])
      };

      const tool = createMealSuggestionsTool(() => mockAPI as any);
      const result = await tool.handler({ meal_type: 'lunch' });

      const data = JSON.parse(result.content[0].text);
      const names = data.items.map((i: any) => i.name);

      // Should include lunch items
      expect(names.some((n: string) => n.includes('Kuřecí'))).toBe(true);
      expect(names.some((n: string) => n.includes('fusilli'))).toBe(true);

      // Should NOT include breakfast items
      expect(names.some((n: string) => n.toLowerCase().includes('rohlík'))).toBe(false);
    });

    it('should filter products by snack categories', async () => {
      const snackProducts = createSnackProducts();
      const lunchProducts = createLunchProducts();

      const orders = [createMockOrder('order1')];
      const orderDetails = [
        createMockOrderDetail('order1', [...snackProducts, ...lunchProducts])
      ];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockResolvedValue(orderDetails[0])
      };

      const tool = createMealSuggestionsTool(() => mockAPI as any);
      const result = await tool.handler({ meal_type: 'snack' });

      const data = JSON.parse(result.content[0].text);
      const names = data.items.map((i: any) => i.name);

      // Should include snack items
      expect(names.some((n: string) => n.toLowerCase().includes('čokoláda'))).toBe(true);
      expect(names.some((n: string) => n.includes('Banány'))).toBe(true);

      // Should NOT include lunch items
      expect(names.some((n: string) => n.includes('Kuřecí'))).toBe(false);
    });

    it('should handle case-insensitive category matching', async () => {
      const product = createMockProduct({
        productId: '1001',
        productName: 'Test Milk',
        categories: [{ id: 10, name: 'MLÉKO A MLÉČNÉ NÁPOJE', level: 1 }]
      });

      const orders = [createMockOrder('order1')];
      const orderDetails = [createMockOrderDetail('order1', [product])];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockResolvedValue(orderDetails[0])
      };

      const tool = createMealSuggestionsTool(() => mockAPI as any);
      const result = await tool.handler({ meal_type: 'breakfast' });

      const data = JSON.parse(result.content[0].text);
      const names = data.items.map((i: any) => i.name);
      expect(names).toContain('Test Milk');
    });
  });

  /**
   * Test sorting logic
   */
  describe('sorting logic', () => {
    it('should sort by frequency when prefer_frequent is true', async () => {
      const milk = createMockProduct({
        productId: '1001',
        productName: 'Milk',
        categories: [{ id: 10, name: 'Mléko a mléčné nápoje', level: 1 }]
      });

      const bread = createMockProduct({
        productId: '1002',
        productName: 'Bread',
        categories: [{ id: 11, name: 'Pekárna', level: 1 }]
      });

      const orders = [
        createMockOrder('order1'),
        createMockOrder('order2'),
        createMockOrder('order3')
      ];

      const orderDetails = [
        createMockOrderDetail('order1', [milk, bread]),
        createMockOrderDetail('order2', [milk, bread]),
        createMockOrderDetail('order3', [milk]) // Milk appears 3 times, bread 2 times
      ];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockImplementation((orderId: string) => {
          return Promise.resolve(orderDetails.find(od => od.id === orderId));
        })
      };

      const tool = createMealSuggestionsTool(() => mockAPI as any);
      const result = await tool.handler({
        meal_type: 'breakfast',
        prefer_frequent: true
      });

      const data = JSON.parse(result.content[0].text);

      // Milk should be included and appear 3 times (ordered in 3 orders)
      const milkItem = data.items.find((i: any) => i.name === 'Milk');
      expect(milkItem).toBeDefined();
      expect(milkItem.frequency).toBe(3);
    });

    it('should sort by quantity when prefer_frequent is false', async () => {
      const milk = createMockProduct({
        productId: '1001',
        productName: 'Milk',
        quantity: 1,
        categories: [{ id: 10, name: 'Mléko a mléčné nápoje', level: 1 }]
      });

      const bread = createMockProduct({
        productId: '1002',
        productName: 'Bread',
        quantity: 5,
        categories: [{ id: 11, name: 'Pekárna', level: 1 }]
      });

      const orders = [createMockOrder('order1')];
      const orderDetails = [createMockOrderDetail('order1', [milk, bread])];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockResolvedValue(orderDetails[0])
      };

      const tool = createMealSuggestionsTool(() => mockAPI as any);
      const result = await tool.handler({
        meal_type: 'breakfast',
        prefer_frequent: false
      });

      const data = JSON.parse(result.content[0].text);

      // Bread should be first (higher total quantity: 5 vs 1)
      expect(data.items[0].name).toBe('Bread');
    });
  });

  /**
   * Test items_count parameter
   */
  describe('items count limiting', () => {
    it('should limit results to items_count parameter', async () => {
      const products = Array.from({ length: 20 }, (_, i) =>
        createMockProduct({
          productId: `${i}`,
          productName: `Breakfast Product ${i}`,
          categories: [{ id: 10, name: 'Pekárna', level: 1 }]
        })
      );

      const orders = [createMockOrder('order1')];
      const orderDetails = [createMockOrderDetail('order1', products)];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockResolvedValue(orderDetails[0])
      };

      const tool = createMealSuggestionsTool(() => mockAPI as any);
      const result = await tool.handler({
        meal_type: 'breakfast',
        items_count: 5
      });

      const data = JSON.parse(result.content[0].text);

      // Should have exactly 5 items
      expect(data.count).toBe(5);
      expect(data.items.length).toBe(5);
    });
  });

  /**
   * Test all meal types
   */
  describe('meal type support', () => {
    const mealTypes: Array<'breakfast' | 'lunch' | 'dinner' | 'snack' | 'baking' | 'drinks' | 'healthy'> = [
      'breakfast', 'lunch', 'dinner', 'snack', 'baking', 'drinks', 'healthy'
    ];

    mealTypes.forEach(mealType => {
      it(`should support meal type: ${mealType}`, async () => {
        // Use breakfast products as they match multiple meal types
        const products = createBreakfastProducts();

        const orders = [createMockOrder('order1')];
        const orderDetails = [createMockOrderDetail('order1', products)];

        const mockAPI = {
          getOrderHistory: vi.fn().mockResolvedValue(orders),
          getOrderDetail: vi.fn().mockResolvedValue(orderDetails[0])
        };

        const tool = createMealSuggestionsTool(() => mockAPI as any);
        const result = await tool.handler({ meal_type: mealType });

        expect(result.content[0].type).toBe('text');
        const text = result.content[0].text;
        // Should mention the meal type somewhere in output (uppercase in header or lowercase in text)
        expect(text.toLowerCase()).toContain(mealType.toLowerCase());
      });
    });
  });

  /**
   * Test edge cases
   */
  describe('edge cases', () => {
    it('should handle empty order history', async () => {
      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue([]),
        getOrderDetail: vi.fn()
      };

      const tool = createMealSuggestionsTool(() => mockAPI as any);
      const result = await tool.handler({ meal_type: 'breakfast' });

      expect(result.content[0].text).toContain('No order history found');
    });

    it('should handle no matching products for meal type', async () => {
      const lunchProduct = createMockProduct({
        productId: '1001',
        productName: 'Lunch Item',
        categories: [{ id: 20, name: 'Maso a drůbež', level: 1 }]
      });

      const orders = [createMockOrder('order1')];
      const orderDetails = [createMockOrderDetail('order1', [lunchProduct])];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockResolvedValue(orderDetails[0])
      };

      const tool = createMealSuggestionsTool(() => mockAPI as any);
      const result = await tool.handler({ meal_type: 'breakfast' });

      // Handler returns JSON error object when no items match
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toBe('No items found');
      expect(data.meal_type).toBe('breakfast');
    });

    it('should handle products without categories', async () => {
      const product = createMockProduct({
        productId: '1001',
        productName: 'Product Without Category',
        categories: []
      });

      const orders = [createMockOrder('order1')];
      const orderDetails = [createMockOrderDetail('order1', [product])];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockResolvedValue(orderDetails[0])
      };

      const tool = createMealSuggestionsTool(() => mockAPI as any);
      const result = await tool.handler({ meal_type: 'breakfast' });

      // Should complete without crashing
      expect(result.content[0].type).toBe('text');
    });

    it('should handle orders that fail to load', async () => {
      const orders = [
        createMockOrder('order1'),
        createMockOrder('order2')
      ];

      const orderDetails = [
        createMockOrderDetail('order1', createBreakfastProducts())
      ];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockImplementation((orderId: string) => {
          if (orderId === 'order2') return Promise.reject(new Error('API Error'));
          return Promise.resolve(orderDetails[0]);
        })
      };

      const tool = createMealSuggestionsTool(() => mockAPI as any);
      const result = await tool.handler({ meal_type: 'breakfast' });

      // Should complete successfully with order1 data
      expect(result.content[0].type).toBe('text');
      expect(result.isError).toBeFalsy();
    });
  });

  /**
   * Test output formatting
   */
  describe('output formatting', () => {
    it('should include meal_type and count in JSON output', async () => {
      const products = createBreakfastProducts();
      const orders = [createMockOrder('order1')];
      const orderDetails = [createMockOrderDetail('order1', products)];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockResolvedValue(orderDetails[0])
      };

      const tool = createMealSuggestionsTool(() => mockAPI as any);
      const result = await tool.handler({ meal_type: 'breakfast' });

      const data = JSON.parse(result.content[0].text);
      expect(data.meal_type).toBe('breakfast');
      expect(typeof data.count).toBe('number');
      expect(data.analyzed_orders).toBeGreaterThan(0);
    });

    it('should return valid JSON for each meal type', async () => {
      const products = createBreakfastProducts();

      const orders = [createMockOrder('order1')];
      const orderDetails = [createMockOrderDetail('order1', products)];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockResolvedValue(orderDetails[0])
      };

      const tool = createMealSuggestionsTool(() => mockAPI as any);

      const breakfastResult = await tool.handler({ meal_type: 'breakfast' });
      const breakfastData = JSON.parse(breakfastResult.content[0].text);
      expect(breakfastData.meal_type).toBe('breakfast');

      const snackResult = await tool.handler({ meal_type: 'snack' });
      // Snack categories don't overlap with breakfast products — error JSON expected
      expect(snackResult.content[0].type).toBe('text');
    });

    it('should include numeric product IDs in items', async () => {
      const products = createBreakfastProducts();
      const orders = [createMockOrder('order1')];
      const orderDetails = [createMockOrderDetail('order1', products)];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockResolvedValue(orderDetails[0])
      };

      const tool = createMealSuggestionsTool(() => mockAPI as any);
      const result = await tool.handler({ meal_type: 'breakfast' });

      const data = JSON.parse(result.content[0].text);
      expect(data.items.length).toBeGreaterThan(0);
      // Each item must have a numeric id
      data.items.forEach((item: any) => {
        expect(typeof item.id).toBe('number');
        expect(item.id).toBeGreaterThan(0);
      });
    });
  });
});
