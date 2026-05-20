import { RohlikAPI } from "../rohlik-api.js";

export function createReusableBagsTool(createRohlikAPI: () => RohlikAPI) {
  return {
    name: "get_reusable_bags_info",
    definition: {
      title: "Get Reusable Bags Info",
      description: "Returns reusable bag status as JSON: {current, max, progress, deposit{amount,currency}, editable, feedbackOptions[{type,message,notable}]}. current = bags currently with you, max = deposit limit.",
      inputSchema: {}
    },
    handler: async () => {
      try {
        const api = createRohlikAPI();
        const data = await api.getReusableBagsInfo();
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
