import { z } from "zod";
import { RohlikAPI } from "../rohlik-api.js";

export function createDiscountedItemsTool(createRohlikAPI: () => RohlikAPI) {
  return {
    name: "get_discounted_items",
    definition: {
      title: "Get Discounted Items",
      description: "Returns discounted products as JSON: {sale_type, category_id, page, count, products[{id, name, brand, price_czk, original_price_czk, savings_czk, discount_percent, discount_label, unit_price_czk, unit, amount, sale_valid_till, is_available, currency}]}. discount_label contains human description (e.g. '-25 % dnešní doručení', '-20 % od 2 ks'). sale_valid_till is ISO 8601 expiry. Quantity discounts (od N ks) have null original_price_czk — check discount_label. Call with list_categories=true to get category IDs for filtering. Use 'sales' + 'premium-sales' for full overview.",
      inputSchema: {
        sale_type: z.enum(["sales", "week-sales", "multipack", "bundles", "premium-sales", "favorite-sales", "last-minute"]).default("sales").describe("Type of sale/discount section. 'sales' = all deals (default), 'week-sales' = weekly deals (Akce týdne), 'multipack' = buy more pay less (Kup víc zaplať míň), 'bundles' = product bundles (Produktové balíčky), 'premium-sales' = exclusive deals for paid Xtra subscribers only (Exkluzivně pro Xtra), 'favorite-sales' = popular deals (Oblíbené v akci), 'last-minute' = Zachraň a ušetři (short expiry products). Recommended: use 'sales' and 'premium-sales' for best overview."),
        category_id: z.number().optional().describe("Food category ID to filter by. Use list_categories=true first to see available categories and their IDs. If omitted, returns discounted items across all categories."),
        limit: z.number().min(1).max(50).default(14).describe("Maximum number of products to return (1-50, default: 14)"),
        page: z.number().min(0).default(0).describe("Page number for pagination (0-based, default: 0)"),
        sort: z.enum(["recommended", "price-asc", "price-desc", "unit-price-asc"]).default("recommended").describe("Sort order (default: recommended)"),
        list_categories: z.boolean().default(false).describe("If true, returns the list of available sales categories instead of products")
      }
    },
    handler: async (args: { sale_type?: string; category_id?: number; limit?: number; page?: number; sort?: string; list_categories?: boolean }) => {
      const { sale_type = "sales", category_id, limit = 14, page = 0, sort = "recommended", list_categories = false } = args;
      try {
        const api = createRohlikAPI();

        if (list_categories) {
          const categories = await api.getSalesCategories();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ count: categories.length, categories }, null, 2)
            }]
          };
        }

        const raw = await api.getDiscountedProducts(sale_type, category_id ?? null, page, limit, sort);
        const products = raw.map((p: any) => {
          const priceBadge = p.badges?.find((b: any) => b.position === 'PRICE');
          const salePriceCzk = p.prices?.salePrice ?? null;
          const originalPriceCzk = p.prices?.originalPrice ?? null;
          const savingsCzk = salePriceCzk !== null && originalPriceCzk !== null
            ? parseFloat((originalPriceCzk - salePriceCzk).toFixed(2))
            : null;
          // Parse discount percent — match number immediately before %
          const discountSource = p.prices?.saleText || priceBadge?.text || '';
          const discountMatch = discountSource.match(/-?(\d+)\s*%/);
          const discountPct = discountMatch ? parseInt(discountMatch[1], 10) : null;
          return {
            id: p.productId,
            name: p.name,
            brand: p.brand || null,
            price_czk: salePriceCzk ?? originalPriceCzk,
            original_price_czk: salePriceCzk ? originalPriceCzk : null,
            savings_czk: savingsCzk,
            discount_percent: discountPct,
            discount_label: priceBadge?.text || null,
            unit_price_czk: p.prices?.unitPrice ?? null,
            unit: p.unit || null,
            amount: p.textualAmount || null,
            sale_valid_till: p.prices?.saleValidTill || null,
            is_available: p.stock?.availabilityStatus === 'AVAILABLE',
            currency: p.prices?.currency || 'CZK',
          };
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              sale_type,
              category_id: category_id ?? null,
              page,
              count: products.length,
              products,
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
