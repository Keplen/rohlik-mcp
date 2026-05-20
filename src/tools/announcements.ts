import { RohlikAPI } from "../rohlik-api.js";

export function createAnnouncementsTool(createRohlikAPI: () => RohlikAPI) {
  return {
    name: "get_announcements",
    definition: {
      title: "Get Announcements",
      description: "Returns current Rohlik announcements as JSON: {announcements: [{title, message, date}]} or {announcements: []} when none active.",
      inputSchema: {}
    },
    handler: async () => {
      try {
        const api = createRohlikAPI();
        const data = await api.getAnnouncements();
        const announcements = Array.isArray(data) ? data : (data ? [data] : []);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ announcements }, null, 2) }]
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
