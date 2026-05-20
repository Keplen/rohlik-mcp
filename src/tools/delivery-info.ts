import { RohlikAPI } from "../rohlik-api.js";

export function createDeliveryInfoTool(createRohlikAPI: () => RohlikAPI) {
  return {
    name: "get_delivery_info",
    definition: {
      title: "Get Delivery Info",
      description: "Returns current delivery info as raw JSON from Rohlik API: deliveryType, firstDeliveryText, deliveryLocationText, earlierDelivery. Use get_delivery_slots for available time windows.",
      inputSchema: {}
    },
    handler: async () => {
      try {
        const api = createRohlikAPI();
        const data = await api.getDeliveryInfo();
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
