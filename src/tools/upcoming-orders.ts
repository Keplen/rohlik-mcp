import { RohlikAPI } from "../rohlik-api.js";

export function createUpcomingOrdersTool(createRohlikAPI: () => RohlikAPI) {
  return {
    name: "get_upcoming_orders",
    definition: {
      title: "Get Upcoming Orders",
      description: "Returns scheduled upcoming orders as JSON: {count, orders[{id, date, total_czk, items_count}]} or {count: 0, orders: []} when none scheduled.",
      inputSchema: {}
    },
    handler: async () => {
      try {
        const api = createRohlikAPI();
        const data = await api.getUpcomingOrders();
        const raw = Array.isArray(data) ? data : (data ? [data] : []);
        const orders = raw.map((o: any) => ({
          id: String(o.id || o.orderNumber || ''),
          date: o.orderTime || o.deliveryDate || o.scheduledAt || null,
          total_czk: o.priceComposition?.total?.amount ?? o.totalPrice ?? null,
          items_count: o.itemsCount ?? o.itemCount ?? null,
        }));
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ count: orders.length, orders }, null, 2) }]
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
