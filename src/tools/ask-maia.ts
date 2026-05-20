import fetch from 'node-fetch';
import { z } from "zod";
import { RohlikAPI } from "../rohlik-api.js";

const BASE_URL = process.env.ROHLIK_BASE_URL || 'https://www.rohlik.cz';

export function createAskMaiaTool(createRohlikAPI: () => RohlikAPI) {
  return {
    name: "ask_maia",
    definition: {
      title: "Ask Maia (Rohlik AI Assistant)",
      description: "Send a message to Maia, Rohlik's built-in AI assistant. Returns JSON: {response (text), product_groups[{title, product_ids[]}], recipes[{id, name}]}. product_groups with product_ids are only populated when Maia explicitly adds products to cart — for recipe suggestions, product_groups=[] and use recipes[*].id with search_products to find actual products. WARNING: Maia product selections can hallucinate wrong items (confirmed: added pork to chicken recipe). Always verify via get_product_detail or check_allergens. TIP: Include all constraints upfront (dietary, skip basics like salt/oil) to avoid follow-up questions and extra round-trips.",
      inputSchema: {
        message: z.string().min(1).max(500).describe("Message to Maia. Be complete to avoid back-and-forth, e.g. 'Navrhni 3 bezlepkové večeře na příští týden. Vynechej základy jako sůl, pepř, olej. Žádné otázky, rovnou odpověz.'")
      }
    },
    handler: async (args: { message: string }) => {
      const { message } = args;
      const api = createRohlikAPI();

      try {
        await api.login();

        // SSE stream endpoint — GET with message as query param
        const streamUrl = `${BASE_URL}/api/v1/stream/assistant/messages?message=${encodeURIComponent(message)}`;

        const streamResp = await fetch(streamUrl, {
          headers: {
            'Accept': '*/*',
            'Accept-Language': 'cs-CZ,cs;q=0.9',
            'Cookie': api.sessionCookies,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Referer': BASE_URL,
            'x-origin': 'WEB',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
          }
        });

        if (!streamResp.ok) {
          throw new Error(`Maia stream failed: HTTP ${streamResp.status}`);
        }

        // Wait for SSE to finish (server closes connection when done)
        await streamResp.text();

        // Do NOT update sessionCookies from SSE response — it may only contain partial
        // cookie headers and would overwrite the full login session, breaking the next call.

        // Fetch structured response — ANSWER + BELT messages
        const messagesData: any = await api.makeRequest('/api/v2/assistant/messages?page=0&size=5');
        const messages: any[] = messagesData.messages || [];

        const answer = messages.find((m: any) => m.type === 'ANSWER');
        const belt = messages.find((m: any) => m.type === 'BELT' || m.type === 'RECIPES_BELT');

        const result = {
          response: answer?.message || '',
          product_groups: (belt?.productGroups || []).map((g: any) => ({
            title: g.title,
            product_ids: g.productIds || []
          })),
          recipes: (belt?.recipes || answer?.recipes || []).map((r: any) => ({
            id: r.id,
            name: r.name
          })),
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }]
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
