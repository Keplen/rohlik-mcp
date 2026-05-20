import { z } from "zod";
import { RohlikAPI } from "../rohlik-api.js";
import { getCurrency } from "../locale.js";

export function createOrderDetailTool(createRohlikAPI: () => RohlikAPI) {
  return {
    name: "get_order_detail",
    definition: {
      title: "Get Order Detail",
      description: "Returns full order as JSON: {id, date, status, delivery_type, delivery_slot{from,to}, total_czk, delivery_czk, currency, items_count, items[{id, name, quantity, unit, textual_amount, paid_czk, unit_price_czk}]}. paid_czk is what was actually charged (after any discounts at time of order). WARNING: sum(items[*].paid_czk) may be LESS than total_czk by 10-30 Kč — Rohlik bag/packaging fees are not in the items array. Do not use item sum as order total.",
      inputSchema: {
        orderId: z.string().describe("The order ID to fetch details for")
      }
    },
    handler: async (args: { orderId: string }) => {
      const { orderId } = args;

      try {
        const api = createRohlikAPI();
        const orderDetail = await api.getOrderDetail(orderId);

        if (!orderDetail) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Order with ID ${orderId} not found.`
              }
            ]
          };
        }

        const order = orderDetail;
        const items = (order.items || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          quantity: p.amount ?? 1,
          unit: p.unit || null,
          textual_amount: p.textualAmount || null,
          paid_czk: p.priceComposition?.total?.amount ?? null,
          unit_price_czk: p.priceComposition?.unit?.amount ?? null,
        }));

        const result = {
          id: String(order.id || orderId),
          date: order.orderTime || null,
          status: order.state || null,
          delivery_type: order.deliveryType || null,
          delivery_slot: order.deliverySlot
            ? { from: order.deliverySlot.since, to: order.deliverySlot.till }
            : null,
          total_czk: order.priceComposition?.total?.amount ?? null,
          delivery_czk: order.priceComposition?.delivery?.amount ?? 0,
          currency: getCurrency(),
          items_count: items.length,
          items,
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
  };
}
