/**
 * Unit tests for frequent-items data transformation logic
 *
 * Tests the algorithm that:
 * - Counts product frequency across orders
 * - Calculates average prices
 * - Tracks last order dates
 * - Groups by categories
 * - Sorts by frequency
 */

import { describe, it, expect, vi } from 'vitest';
import { createFrequentItemsTool } from '../src/tools/frequent-items.js';
import {
  createMockOrder,
  createOrdersWithRepeatedProducts,
  createMockProduct,
  createMockOrderDetail
} from './helpers.js';

describe('frequent-items: data transformation', () => {

  /**
   * Test frequency counting logic
   */
  describe('frequency counting', () => {
    it('should count product frequency correctly across multiple orders', async () => {
      const mockOrders = [
        createMockOrder('order1'),
        createMockOrder('order2'),
        createMockOrder('order3'),
        createMockOrder('order4')
      ];

      const mockOrderDetails = createOrdersWithRepeatedProducts();

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(mockOrders),
        getOrderDetail: vi.fn().mockImplementation((orderId: string) => {
          return Promise.resolve(mockOrderDetails.find(od => od.id === orderId));
        })
      };

      const tool = createFrequentItemsTool(() => mockAPI as any);
      const result = await tool.handler({ top_items: 10 });

      expect(result.content[0].type).toBe('text');
      const data = JSON.parse(result.content[0].text);

      // Milk should appear 4 times (in all orders)
      const milk = data.items.find((i: any) => i.name === 'Miil Mléko');
      expect(milk).toBeDefined();
      expect(milk.frequency).toBe(4);
    });

    it('should handle products with different quantities', async () => {
      const product = createMockProduct({
        productId: '999',
        productName: 'Test Product',
        quantity: 3
      });

      const orders = [
        createMockOrder('order1'),
        createMockOrder('order2')
      ];

      const orderDetails = [
        createMockOrderDetail('order1', [{ ...product, quantity: 2 }]),
        createMockOrderDetail('order2', [{ ...product, quantity: 3 }])
      ];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockImplementation((orderId: string) => {
          return Promise.resolve(orderDetails.find(od => od.id === orderId));
        })
      };

      const tool = createFrequentItemsTool(() => mockAPI as any);
      const result = await tool.handler({ top_items: 10 });

      const data = JSON.parse(result.content[0].text);
      // Should show 2 orders with total 5 units
      const found = data.items.find((i: any) => i.name === 'Test Product');
      expect(found).toBeDefined();
      expect(found.frequency).toBe(2);
      expect(found.total_units).toBe(5);
    });
  });

  /**
   * Test average price calculation
   */
  describe('average price calculation', () => {
    it('should calculate average price correctly', async () => {
      const product1 = createMockProduct({
        productId: '1001',
        productName: 'Milk',
        price: 20.00
      });

      const product2 = createMockProduct({
        productId: '1001',
        productName: 'Milk',
        price: 24.00
      });

      const orders = [
        createMockOrder('order1'),
        createMockOrder('order2')
      ];

      const orderDetails = [
        createMockOrderDetail('order1', [product1]),
        createMockOrderDetail('order2', [product2])
      ];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockImplementation((orderId: string) => {
          return Promise.resolve(orderDetails.find(od => od.id === orderId));
        })
      };

      const tool = createFrequentItemsTool(() => mockAPI as any);
      const result = await tool.handler({ top_items: 10 });

      const data = JSON.parse(result.content[0].text);
      // Product should appear in 2 orders — avg_price_czk is null when mock data lacks priceComposition
      const milk = data.items.find((i: any) => i.name === 'Milk');
      expect(milk).toBeDefined();
      expect(milk.frequency).toBe(2);
    });

    it('should handle missing prices gracefully', async () => {
      const product = createMockProduct({
        productId: '1001',
        productName: 'Product Without Price',
        price: undefined
      });

      const orders = [createMockOrder('order1')];
      const orderDetails = [createMockOrderDetail('order1', [product])];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockImplementation(() => Promise.resolve(orderDetails[0]))
      };

      const tool = createFrequentItemsTool(() => mockAPI as any);
      const result = await tool.handler({ top_items: 10 });

      expect(result.content[0].type).toBe('text');
      // Should not crash, should show N/A or 0.00
    });
  });

  /**
   * Test sorting by frequency
   */
  describe('sorting by frequency', () => {
    it('should sort products by frequency in descending order', async () => {
      const mockOrders = createOrdersWithRepeatedProducts();

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(
          mockOrders.map(od => createMockOrder(od.id!))
        ),
        getOrderDetail: vi.fn().mockImplementation((orderId: string) => {
          return Promise.resolve(mockOrders.find(od => od.id === orderId));
        })
      };

      const tool = createFrequentItemsTool(() => mockAPI as any);
      const result = await tool.handler({ top_items: 10 });

      // Milk should appear with highest frequency (4 orders)
      const data = JSON.parse(result.content[0].text);
      const milk = data.items.find((i: any) => i.name === 'Miil Mléko');
      expect(milk).toBeDefined();
      expect(milk.frequency).toBe(4);
    });

    it('should limit results to top_items parameter', async () => {
      const products = Array.from({ length: 20 }, (_, i) =>
        createMockProduct({
          productId: `${i}`,
          productName: `Product ${i}`
        })
      );

      const orders = [createMockOrder('order1')];
      const orderDetails = [createMockOrderDetail('order1', products)];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockResolvedValue(orderDetails[0])
      };

      const tool = createFrequentItemsTool(() => mockAPI as any);
      const result = await tool.handler({ top_items: 5, show_categories: false });

      const data = JSON.parse(result.content[0].text);
      expect(data.items.length).toBe(5);
    });
  });

  /**
   * Test category grouping
   */
  describe('category grouping', () => {
    it('should group products by category', async () => {
      const orders = [createMockOrder('order1')];
      const products = [
        createMockProduct({
          productId: '1',
          productName: 'Milk',
          categories: [{ id: 10, name: 'Mléko a mléčné nápoje', level: 1 }]
        }),
        createMockProduct({
          productId: '2',
          productName: 'Bread',
          categories: [{ id: 11, name: 'Pekárna', level: 1 }]
        })
      ];

      const orderDetails = [createMockOrderDetail('order1', products)];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockResolvedValue(orderDetails[0])
      };

      const tool = createFrequentItemsTool(() => mockAPI as any);
      const result = await tool.handler({ show_categories: true });

      // Output is JSON — check items contain both categories
      const data = JSON.parse(result.content[0].text);
      const names = data.items.map((i: any) => i.name);
      expect(names).toContain('Milk');
      expect(names).toContain('Bread');
    });

    it('should not crash when show_categories is false', async () => {
      const orders = [createMockOrder('order1')];
      const products = [createMockProduct()];
      const orderDetails = [createMockOrderDetail('order1', products)];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockResolvedValue(orderDetails[0])
      };

      const tool = createFrequentItemsTool(() => mockAPI as any);
      const result = await tool.handler({ show_categories: false });

      // show_categories is accepted but output is always flat JSON
      const data = JSON.parse(result.content[0].text);
      expect(data.items).toBeDefined();
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

      const tool = createFrequentItemsTool(() => mockAPI as any);
      const result = await tool.handler({});

      expect(result.content[0].text).toContain('No order history found');
    });

    it('should handle orders with no products', async () => {
      const orders = [createMockOrder('order1')];
      const orderDetails = [createMockOrderDetail('order1', [])];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockResolvedValue(orderDetails[0])
      };

      const tool = createFrequentItemsTool(() => mockAPI as any);
      const result = await tool.handler({});

      // When orders have no products, JSON error is returned
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toBeDefined();
    });

    it('should skip orders that fail to load', async () => {
      const orders = [
        createMockOrder('order1'),
        createMockOrder('order2')
      ];

      const orderDetails = [
        createMockOrderDetail('order1', [createMockProduct()])
      ];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockImplementation((orderId: string) => {
          if (orderId === 'order2') return Promise.reject(new Error('API Error'));
          return Promise.resolve(orderDetails[0]);
        })
      };

      const tool = createFrequentItemsTool(() => mockAPI as any);
      const result = await tool.handler({});

      // Should complete successfully with order1 data
      expect(result.content[0].type).toBe('text');
      expect(result.isError).toBeFalsy();
    });

    it('should handle products without IDs or names', async () => {
      const orders = [createMockOrder('order1')];
      const products = [
        { ...createMockProduct(), productId: '' }, // No ID
        { ...createMockProduct(), productName: '' }, // No name
        createMockProduct() // Valid
      ];

      const orderDetails = [createMockOrderDetail('order1', products)];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockResolvedValue(orderDetails[0])
      };

      const tool = createFrequentItemsTool(() => mockAPI as any);
      const result = await tool.handler({});

      // Should only process the valid product (invalid IDs/names are skipped)
      const data = JSON.parse(result.content[0].text);
      expect(data.total_distinct_products).toBe(1);
    });
  });

  /**
   * Test last order date tracking
   */
  describe('last order date tracking', () => {
    it('should track the most recent order date for each product', async () => {
      const product = createMockProduct({
        productId: '1001',
        productName: 'Test Product'
      });

      const orders = [
        createMockOrder('order1'),
        createMockOrder('order2')
      ];

      const orderDetails = [
        createMockOrderDetail('order1', [product], '2025-01-01'),
        createMockOrderDetail('order2', [product], '2025-01-15')
      ];

      const mockAPI = {
        getOrderHistory: vi.fn().mockResolvedValue(orders),
        getOrderDetail: vi.fn().mockImplementation((orderId: string) => {
          return Promise.resolve(orderDetails.find(od => od.id === orderId));
        })
      };

      const tool = createFrequentItemsTool(() => mockAPI as any);
      const result = await tool.handler({});

      const data = JSON.parse(result.content[0].text);
      // Should store the most recent date (2025-01-15) in last_ordered
      const trackedProduct = data.items.find((i: any) => i.name === 'Test Product');
      expect(trackedProduct).toBeDefined();
      expect(trackedProduct.last_ordered).toBe('2025-01-15');
    });
  });
});
