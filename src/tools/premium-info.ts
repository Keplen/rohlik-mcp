import { RohlikAPI } from "../rohlik-api.js";

export function createPremiumInfoTool(createRohlikAPI: () => RohlikAPI) {
  return {
    name: "get_premium_info",
    definition: {
      title: "Get Premium Info",
      description: "Returns Xtra/Premium subscription info as raw JSON: prices (MONTHLY_PREMIUM, YEARLY_PREMIUM), stats (savedTotal.full in CZK), savings breakdown (DISCOUNT+DELIVERY), advantages list, premiumLimits. stats.savedTotal.full = total CZK saved this period.",
      inputSchema: {}
    },
    handler: async () => {
      try {
        const api = createRohlikAPI();
        const data = await api.getPremiumInfo();
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
