import { RohlikAPI } from "../rohlik-api.js";

export function createAccountDataTool(createRohlikAPI: () => RohlikAPI) {
  return {
    name: "get_account_data",
    definition: {
      title: "Get Account Data",
      description: "Returns comprehensive account snapshot as raw JSON: cart (total_price, total_items, can_make_order, products), delivery, next_delivery_slot, next_order, last_order, premium_profile, announcements, bags, timeslot. Use individual tools for structured/parsed versions of each section.",
      inputSchema: {}
    },
    handler: async () => {
      try {
        const api = createRohlikAPI();
        const data = await api.getAccountData();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
          isError: true
        };
      }
    }
  };
}
