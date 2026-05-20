import { RohlikAPI } from "../rohlik-api.js";

export function createDeliverySlotsTool(createRohlikAPI: () => RohlikAPI) {
  return {
    name: "get_delivery_slots",
    definition: {
      title: "Get Delivery Slots",
      description: "Returns available delivery time slots as raw JSON from Rohlik API. Includes availabilityDays, restrictionMessageSummary (explains why slots are blocked, e.g. perishables in cart). null slots = no windows available.",
      inputSchema: {}
    },
    handler: async () => {
      try {
        const api = createRohlikAPI();
        const data = await api.getDeliverySlots();
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
