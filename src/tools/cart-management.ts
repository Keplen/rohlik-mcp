import { z } from "zod";
import { RohlikAPI } from "../rohlik-api.js";
import { getCurrency } from "../locale.js";

export function createCartManagementTools(createRohlikAPI: () => RohlikAPI) {
  return {
    addToCart: {
      name: "add_to_cart",
      definition: {
        title: "Add to Cart",
        description: "Add products to the shopping cart",
        inputSchema: {
          products: z.array(z.object({
            product_id: z.number().describe("The ID of the product to add"),
            quantity: z.number().min(1).describe("Quantity of the product to add")
          })).min(1, "At least one product is required").describe("Array of products to add to cart")
        }
      },
      handler: async ({ products }: {
        products: Array<{ product_id: number; quantity: number }>;
      }) => {
        try {
          const api = createRohlikAPI();
          const addedProducts = await api.addToCart(products);
          const successCount = addedProducts.length;
          const totalRequested = products.length;

          const output = `Successfully added ${successCount}/${totalRequested} products to cart.\n` +
            (addedProducts.length > 0 ? `Added product IDs: ${addedProducts.join(', ')}` : 'No products were added.');

          return {
            content: [
              {
                type: "text" as const,
                text: output
              }
            ]
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
    },

    getCartContent: {
      name: "get_cart_content",
      definition: {
        title: "Get Cart Content",
        description: "Returns current cart as JSON: {total_czk, can_order, items_count, total_savings_czk, products[{id, name, quantity, unit_price_czk, line_total_czk, is_on_sale, discount_percent, original_unit_price_czk, line_savings_czk, category}]}. total_czk is the final amount after all discounts. total_savings_czk shows combined discount value. can_order=false means delivery is blocked (e.g. perishables, no slot). WARNING: Some Rohlik discounts are conditional (quantity-based '-20% od 2 ks', or checkout-applied) — a product may appear discounted in get_discounted_items but show full price in cart (is_on_sale=false). Always trust cart unit_price_czk as the actual charge.",
        inputSchema: {}
      },
      handler: async () => {
        try {
          const api = createRohlikAPI();
          const cartContent = await api.getCartContent();

          if (cartContent.total_items === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Your cart is empty."
                }
              ]
            };
          }

          const products = (cartContent.products as any[]).map((p: any) => {
            const isOnSale = p.sale_percents > 0;
            const unitPriceCzk = p.price || 0;
            const originalUnitPriceCzk = isOnSale ? parseFloat((p.original_unit_price * p.volume).toFixed(2)) : null;
            const lineTotalCzk = parseFloat((unitPriceCzk * p.quantity).toFixed(2));
            const lineSavingsCzk = isOnSale && originalUnitPriceCzk
              ? parseFloat(((originalUnitPriceCzk - unitPriceCzk) * p.quantity).toFixed(2))
              : null;
            return {
              id: p.id,
              cart_item_id: p.cart_item_id,
              name: p.name,
              brand: p.brand || null,
              quantity: p.quantity,
              unit: p.unit || null,
              unit_price_czk: unitPriceCzk,
              line_total_czk: lineTotalCzk,
              is_on_sale: isOnSale,
              discount_percent: isOnSale ? p.sale_percents : null,
              original_unit_price_czk: originalUnitPriceCzk,
              line_savings_czk: lineSavingsCzk,
              category: p.category_name || null,
            };
          });

          const totalSavingsCzk = products.reduce((s: number, p: any) => s + (p.line_savings_czk || 0), 0);
          const result = {
            total_czk: cartContent.total_price,
            currency: getCurrency(),
            can_order: cartContent.can_make_order,
            items_count: cartContent.total_items,
            total_savings_czk: parseFloat(totalSavingsCzk.toFixed(2)),
            products,
          };

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2)
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
    },

    clearCart: {
      name: "clear_cart",
      definition: {
        title: "Clear Cart",
        description: "Remove all items from the shopping cart at once",
        inputSchema: {}
      },
      handler: async () => {
        try {
          const api = createRohlikAPI();
          const success = await api.clearCart();
          return {
            content: [{
              type: "text" as const,
              text: success ? "Cart cleared successfully." : "Failed to clear cart."
            }]
          };
        } catch (error) {
          return {
            content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
            isError: true
          };
        }
      }
    },

    removeFromCart: {
      name: "remove_from_cart",
      definition: {
        title: "Remove from Cart",
        description: "Remove an item from the shopping cart",
        inputSchema: {
          order_field_id: z.string().min(1, "Order field ID is required").describe("The order field ID of the item to remove (cart_item_id from cart content)")
        }
      },
      handler: async ({ order_field_id }: { order_field_id: string }) => {
        try {
          const api = createRohlikAPI();
          const success = await api.removeFromCart(order_field_id);
          const output = success
            ? `Successfully removed item with ID ${order_field_id} from cart.`
            : `Failed to remove item with ID ${order_field_id} from cart.`;
          return {
            content: [
              {
                type: "text" as const,
                text: output
              }
            ]
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
    }
  };
}
