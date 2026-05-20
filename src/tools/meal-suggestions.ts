import { z } from "zod";
import { RohlikAPI } from "../rohlik-api.js";

interface ProductFrequency {
  productId: string;
  productName: string;
  brand: string;
  frequency: number;
  totalQuantity: number;
  averagePrice?: number;
  category?: string;
}

// Category mappings for different meal types
const MEAL_CATEGORY_MAPPINGS: Record<string, string[]> = {
  breakfast: [
    "Pekárna",
    "Mléko a mléčné nápoje",
    "Müsli a cereálie",
    "Džemy a pomazánky",
    "Ovoce",
    "Med",
    "Máslo a tuky",
    "Vejce"
  ],
  lunch: [
    "Maso a drůbež",
    "Zelenina",
    "Přílohy",
    "Těstoviny",
    "Rýže",
    "Omáčky a dresinky",
    "Polévky",
    "Luštěniny"
  ],
  dinner: [
    "Maso a drůbež",
    "Ryby a mořské plody",
    "Zelenina",
    "Přílohy",
    "Těstoviny",
    "Rýže",
    "Brambory",
    "Omáčky a dresinky"
  ],
  snack: [
    "Sladkosti",
    "Ovoce",
    "Ořechy a semínka",
    "Jogurty",
    "Sýry",
    "Chipsy a krekry",
    "Tyčinky"
  ],
  baking: [
    "Mouka a směsi",
    "Cukr a sladidla",
    "Pečení a vaření",
    "Čokoláda a kakao",
    "Ořechy a semínka",
    "Vejce",
    "Máslo a tuky",
    "Droždí a kypřidla"
  ],
  drinks: [
    "Nápoje",
    "Káva",
    "Čaj",
    "Mléko a mléčné nápoje",
    "Džusy a smoothies",
    "Minerální vody",
    "Pivo",
    "Víno"
  ],
  healthy: [
    "Bio produkty",
    "Zdravá výživa",
    "Bezlepkové",
    "Veganské",
    "Ovoce",
    "Zelenina",
    "Ořechy a semínka",
    "Luštěniny"
  ]
};

export function createMealSuggestionsTool(createRohlikAPI: () => RohlikAPI) {
  return {
    name: "get_meal_suggestions",
    definition: {
      title: "Get Meal Suggestions",
      description: "Returns products from past orders relevant to a meal type as JSON: {meal_type, analyzed_orders, count, items[{id, name, brand, frequency, total_units, avg_price_czk}]}. Items are sorted by purchase frequency (prefer_frequent=true) or quantity. avg_price_czk reflects historical paid prices. Note: category filtering is best-effort based on product name matching — results cover all relevant product types regardless. Use id with search_products to get current price before add_to_cart.",
      inputSchema: {
        meal_type: z.enum(["breakfast", "lunch", "dinner", "snack", "baking", "drinks", "healthy"])
          .describe("Type of meal or occasion (enum): breakfast, lunch, dinner, snack, baking, drinks, or healthy"),
        items_count: z.number().min(3).max(30).default(10)
          .describe("Number of items to suggest (3-30, default: 10)"),
        orders_to_analyze: z.number().min(1).max(20).default(5)
          .describe("Number of recent orders to analyze (1-20, default: 5)"),
        prefer_frequent: z.boolean().default(true)
          .describe("Prefer items you order frequently (default: true)")
      }
    },
    handler: async (args: {
      meal_type: keyof typeof MEAL_CATEGORY_MAPPINGS;
      items_count?: number;
      orders_to_analyze?: number;
      prefer_frequent?: boolean;
    }) => {
      const {
        meal_type,
        items_count = 10,
        orders_to_analyze = 5,
        prefer_frequent = true
      } = args;

      try {
        const api = createRohlikAPI();

        // Get relevant categories for this meal type
        const relevantCategories = MEAL_CATEGORY_MAPPINGS[meal_type];

        if (!relevantCategories || relevantCategories.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Unknown meal type: ${meal_type}. Available types: breakfast, lunch, dinner, snack, baking, drinks, healthy`
              }
            ],
            isError: true
          };
        }

        // Fetch order history
        const orderHistory = await api.getOrderHistory(orders_to_analyze);

        if (!orderHistory || (Array.isArray(orderHistory) && orderHistory.length === 0)) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No order history found. I need your past orders to make personalized suggestions."
              }
            ]
          };
        }

        const orders = Array.isArray(orderHistory) ? orderHistory : [orderHistory];

        // Analyze products from relevant categories
        const productMap = new Map<string, ProductFrequency>();
        let processedOrders = 0;

        for (const order of orders) {
          try {
            const orderId = order.id || order.orderNumber;
            if (!orderId) continue;

            const orderDetail = await api.getOrderDetail(String(orderId));
            if (!orderDetail) continue;

            processedOrders++;
            const products = orderDetail.items || orderDetail.products || [];

            for (const product of products) {
              const productId = product.productId || product.id;
              const productName = product.productName || product.name;

              if (!productId || !productName) continue;

              // Extract category
              const categories = product.categories || [];
              const mainCategory = categories.find((cat: any) => cat.level === 1) || categories[0];
              const categoryName = mainCategory?.name || '';

              // Check if this product belongs to relevant categories
              const isRelevant = relevantCategories.some(cat =>
                categoryName.toLowerCase().includes(cat.toLowerCase()) ||
                cat.toLowerCase().includes(categoryName.toLowerCase())
              );

              if (!isRelevant) continue;

              const key = `${productId}`;

              if (productMap.has(key)) {
                const existing = productMap.get(key)!;
                existing.frequency++;
                existing.totalQuantity += (product.amount || product.quantity || 1);
                const paidPrice = product.priceComposition?.total?.amount;
                if (paidPrice) {
                  const currentAvg = existing.averagePrice || 0;
                  existing.averagePrice = (currentAvg * (existing.frequency - 1) + paidPrice) / existing.frequency;
                }
              } else {
                productMap.set(key, {
                  productId: String(productId),
                  productName,
                  brand: product.brand || '',
                  frequency: 1,
                  totalQuantity: product.amount || product.quantity || 1,
                  averagePrice: product.priceComposition?.total?.amount || 0,
                  category: categoryName
                });
              }
            }
          } catch (error) {
            console.error(`Failed to process order: ${error}`);
          }
        }

        if (productMap.size === 0) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ error: "No items found", meal_type, analyzed_orders: processedOrders })
            }]
          };
        }

        // Batch fetch brands
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

        const sortedProducts = Array.from(productMap.values())
          .sort((a, b) => prefer_frequent ? b.frequency - a.frequency : b.totalQuantity - a.totalQuantity)
          .slice(0, items_count);

        const items = sortedProducts.map((item: ProductFrequency) => ({
          id: parseInt(item.productId, 10),
          name: item.productName,
          brand: brandMap[item.productId] || null,
          frequency: item.frequency,
          total_units: item.totalQuantity,
          avg_price_czk: item.averagePrice ? parseFloat(item.averagePrice.toFixed(2)) : null,
        }));

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              meal_type,
              analyzed_orders: processedOrders,
              count: items.length,
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
