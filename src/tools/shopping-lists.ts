import { z } from "zod";
import { RohlikAPI } from "../rohlik-api.js";

export function createShoppingListsTool(createRohlikAPI: () => RohlikAPI) {
  return {
    name: "get_shopping_list",
    definition: {
      title: "Get Shopping List",
      description: "Returns a shopping list by ID as JSON: {name, count, products[{id, name, quantity}]}.",
      inputSchema: {
        shopping_list_id: z.string().min(1, "Shopping list ID is required").describe("The ID of the shopping list to retrieve")
      }
    },
    handler: async ({ shopping_list_id }: { shopping_list_id: string }) => {
      try {
        const api = createRohlikAPI();
        const shoppingList = await api.getShoppingList(shopping_list_id);

        const result = {
          name: shoppingList.name,
          count: shoppingList.products?.length ?? 0,
          products: (shoppingList.products || []).map((product: any) => ({
            id: product.productId || product.id || null,
            name: product.name || product.productName || null,
            quantity: product.quantity || product.amount || null,
          }))
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2)
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
  };
}