import { z } from "zod";
import { RohlikAPI } from "../rohlik-api.js";

export function createSearchProductsTool(createRohlikAPI: () => RohlikAPI) {
  return {
    name: "search_products",
    definition: {
      title: "Search Products",
      description: "Search Rohlik.cz catalog by name. Returns JSON: {count, products[{id, name, brand, price_czk, original_price_czk, savings_czk, discount_percent, discount_type, is_on_sale, amount}]}. Use price_czk for budget calculations. Check is_on_sale + savings_czk to prefer discounted items. Use id with add_to_cart.",
      inputSchema: {
        product_name: z.string().min(1, "Product name cannot be empty").describe("The name or search term for the product"),
        limit: z.number().min(1).max(50).default(10).describe("Maximum number of products to return (1-50, default: 10)"),
        favourite_only: z.boolean().default(false).describe("Whether to return only favourite products (default: false)")
      }
    },
    handler: async (args: { product_name: string; limit?: number; favourite_only?: boolean }) => {
      const { product_name, limit = 10, favourite_only = false } = args;
      try {
        const api = createRohlikAPI();
        const results = await api.searchProducts(product_name, limit, favourite_only);
        const products = results.map((p: any) => {
          const isOnSale = !!p.salePrice;
          const priceCzk = isOnSale ? parseFloat(p.salePrice) : parseFloat(p.price);
          const originalPriceCzk = isOnSale ? parseFloat(p.originalPrice) : null;
          return {
            id: p.id,
            name: p.name,
            brand: p.brand || null,
            price_czk: priceCzk || null,
            original_price_czk: originalPriceCzk,
            savings_czk: originalPriceCzk ? parseFloat((originalPriceCzk - priceCzk).toFixed(2)) : null,
            discount_percent: isOnSale ? p.discountPercentage : null,
            discount_type: isOnSale ? (p.saleType || null) : null,
            is_on_sale: isOnSale,
            amount: p.amount || null,
          };
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ count: products.length, products }, null, 2)
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
