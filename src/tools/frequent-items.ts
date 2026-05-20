import { z } from "zod";
import { RohlikAPI } from "../rohlik-api.js";

interface ProductFrequency {
  productId: string;
  productName: string;
  brand: string;
  frequency: number;
  totalQuantity: number;
  lastOrderDate?: string;
  averagePrice?: number;
  category?: string;
  categoryId?: number;
}

export function createFrequentItemsTool(createRohlikAPI: () => RohlikAPI) {
  return {
    name: "get_frequent_items",
    definition: {
      title: "Get Frequent Items",
      description: "Analyzes past orders and returns frequently bought products as JSON: {analyzed_orders, total_distinct_products, items[{id, name, brand, frequency, total_units, avg_price_czk, last_ordered}]}. frequency = number of orders containing this product. avg_price_czk = average paid price across orders. last_ordered is ISO 8601. Use for smart re-order suggestions. brand may be null for unbranded products.",
      inputSchema: {
        orders_to_analyze: z.number().min(1).max(20).default(5).describe("Number of recent orders to analyze (1-20, default: 5)"),
        top_items: z.number().min(3).max(30).default(10).describe("Number of top items to return overall (3-30, default: 10)"),
        top_per_category: z.number().min(1).max(20).default(10).describe("Number of top items to show per category (1-20, default: 10)"),
        show_categories: z.boolean().default(true).describe("Whether to show per-category breakdown (default: true)")
      }
    },
    handler: async (args: { orders_to_analyze?: number; top_items?: number; top_per_category?: number; show_categories?: boolean }) => {
      const { orders_to_analyze = 5, top_items = 10, top_per_category = 10, show_categories = true } = args;

      try {
        const api = createRohlikAPI();

        // Step 1: Get order history
        const orderHistory = await api.getOrderHistory(orders_to_analyze);

        if (!orderHistory || (Array.isArray(orderHistory) && orderHistory.length === 0)) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No order history found. You need to have past orders to analyze frequent items."
              }
            ]
          };
        }

        const orders = Array.isArray(orderHistory) ? orderHistory : [orderHistory];

        // Step 2: Get detailed information for each order
        const productMap = new Map<string, ProductFrequency>();
        let processedOrders = 0;
        let totalProducts = 0;

        for (const order of orders) {
          try {
            const orderId = order.id || order.orderNumber;
            if (!orderId) continue;

            const orderDetail = await api.getOrderDetail(String(orderId));
            if (!orderDetail) continue;

            processedOrders++;
            const products = orderDetail.items || orderDetail.products || [];
            const orderDate = orderDetail.orderTime || orderDetail.deliveredAt || orderDetail.createdAt;

            for (const product of products) {
              const productId = product.productId || product.id;
              const productName = product.productName || product.name;

              if (!productId || !productName) continue;

              totalProducts++;
              const key = `${productId}`;

              // Extract category (use level 1 - mid-level category for grouping)
              const categories = product.categories || [];
              const mainCategory = categories.find((cat: any) => cat.level === 1) || categories[0];
              const categoryName = mainCategory?.name || 'Uncategorized';
              const categoryId = mainCategory?.id || 0;

              if (productMap.has(key)) {
                const existing = productMap.get(key)!;
                existing.frequency++;
                existing.totalQuantity += (product.quantity || 1);

                // Update average price (priceComposition.total.amount = actual paid price)
                const paidPrice = product.priceComposition?.total?.amount;
                if (paidPrice) {
                  const currentAvg = existing.averagePrice || 0;
                  existing.averagePrice = (currentAvg * (existing.frequency - 1) + paidPrice) / existing.frequency;
                }

                // Update last order date if newer
                if (orderDate && (!existing.lastOrderDate || orderDate > existing.lastOrderDate)) {
                  existing.lastOrderDate = orderDate;
                }
              } else {
                productMap.set(key, {
                  productId: String(productId),
                  productName,
                  brand: product.brand || '',
                  frequency: 1,
                  totalQuantity: product.quantity || product.amount || 1,
                  lastOrderDate: orderDate,
                  averagePrice: product.priceComposition?.total?.amount || 0,
                  category: categoryName,
                  categoryId: categoryId
                });
              }
            }
          } catch (error) {
            // Skip orders that fail to load
            console.error(`Failed to process order: ${error}`);
          }
        }

        // Step 3: Batch fetch brands for all collected product IDs
        const allIds = Array.from(productMap.keys());
        const brandMap: Record<string, string> = {};
        try {
          const batchSize = 20;
          for (let i = 0; i < allIds.length; i += batchSize) {
            const chunk = allIds.slice(i, i + batchSize);
            const params = chunk.map((id: string) => `products=${id}`).join('&');
            const brandData = await api.makeRequest(`/api/v1/products?${params}`);
            const items = brandData.products || (Array.isArray(brandData) ? brandData : []);
            for (const p of items) {
              if (p.id && p.brand) brandMap[String(p.id)] = p.brand;
            }
          }
        } catch (e) { /* brand fetch is best-effort */ }

        // Step 4: Sort by frequency and get top items
        const sortedProducts = Array.from(productMap.values())
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, top_items);

        if (sortedProducts.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ error: "No products found", analyzed_orders: processedOrders })
            }]
          };
        }

        const items = sortedProducts.map((item: ProductFrequency) => ({
          id: parseInt(item.productId, 10),
          name: item.productName,
          brand: brandMap[item.productId] || null,
          frequency: item.frequency,
          total_units: item.totalQuantity,
          avg_price_czk: item.averagePrice ? parseFloat(item.averagePrice.toFixed(2)) : null,
          last_ordered: item.lastOrderDate || null,
        }));

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              analyzed_orders: processedOrders,
              total_distinct_products: productMap.size,
              items,
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: error instanceof Error ? error.message : String(error)
            }
          ],
          isError: true
        };
      }
    }
  };
}
