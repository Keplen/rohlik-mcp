import { z } from "zod";

const GLUTEN_LABEL = 'Obiloviny obsahující lepek';

export function createProductDetailTool() {
  return {
    name: "get_product_detail",
    definition: {
      title: "Get Product Detail",
      description: "Returns full product detail as JSON: {id, name, brand, countries[], badges[], gf_ok (false=contains gluten, true=GF confirmed, null=no data), gf_note, allergens_contained[], allergens_possibly[], ingredients[], nutritional_per_100{energy_kj, energy_kcal, fat_g, saturated_fat_g, carbs_g, sugars_g, protein_g, salt_g, fiber_g}}. nutritional_per_100 is null when Rohlik has no data (common for fresh produce). Slower than check_allergens — use check_allergens when you only need GF status.",
      inputSchema: {
        product_id: z.number().describe("The product ID to get details for")
      }
    },
    handler: async (args: { product_id: number }) => {
      const { product_id } = args;
      try {
        const apiResp = await fetch(`https://www.rohlik.cz/api/v1/products/${product_id}`, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
        });
        if (!apiResp.ok) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: `Product not found (HTTP ${apiResp.status})`, id: product_id }) }],
            isError: true
          };
        }
        const productData: any = await apiResp.json();
        const slug = productData.slug || String(product_id);
        const name = productData.name || String(product_id);
        const brand = productData.brand || null;
        const badges = Array.isArray(productData.badges) ? productData.badges.map((b: any) => b.type).filter(Boolean) : [];
        const countries = Array.isArray(productData.countries) ? productData.countries.map((c: any) => c.code).filter(Boolean) : [];

        const pageResp = await fetch(`https://www.rohlik.cz/${product_id}-${slug}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'cs-CZ,cs;q=0.9'
          }
        });
        const html = await pageResp.text();

        // Nutritional values
        let nutritional_per_100: Record<string, number | null> | null = null;
        const nvMatch = html.match(/"nutritionalValues":\[(\{"productId":\d+,"portion":".*?","values":\{.*?\}\})\]/);
        if (nvMatch) {
          try {
            const nv = JSON.parse('[' + nvMatch[1] + ']')[0];
            const v = nv.values;
            nutritional_per_100 = {
              energy_kj: v.energyKJ?.amount ?? null,
              energy_kcal: v.energyKCal?.amount ?? null,
              fat_g: v.fats?.amount ?? null,
              saturated_fat_g: v.saturatedFats?.amount ?? null,
              carbs_g: v.carbohydrates?.amount ?? null,
              sugars_g: v.sugars?.amount ?? null,
              protein_g: v.protein?.amount ?? null,
              salt_g: v.salt?.amount ?? null,
              fiber_g: v.fiber?.amount ?? null,
            };
          } catch (_) {}
        }

        // Ingredients
        let ingredients: string[] = [];
        const ingMatch = html.match(/"ingredients":\[(\{.*?\}(?:,\{.*?\})*)\]/s);
        if (ingMatch) {
          try {
            ingredients = JSON.parse('[' + ingMatch[1] + ']').map((i: any) => i.title).filter(Boolean);
          } catch (_) {
            ingredients = [...ingMatch[1].matchAll(/"title":"([^"]+)"/g)].map(m => m[1]);
          }
        }

        // Allergens
        let allergens_contained: string[] = [];
        let allergens_possibly: string[] = [];
        const allergenMatch = html.match(/"allergens":\{"contained":\[(.*?)\],"possiblyContained":\[(.*?)\]\}/);
        if (allergenMatch) {
          const parseList = (s: string) => s ? s.split(',').map(x => x.replace(/"/g, '').trim()).filter(Boolean) : [];
          allergens_contained = parseList(allergenMatch[1]);
          allergens_possibly = parseList(allergenMatch[2]);
        }

        const hasGluten = allergens_contained.includes(GLUTEN_LABEL);
        const mayHaveGluten = allergens_possibly.includes(GLUTEN_LABEL);
        const noData = allergens_contained.length === 0 && allergens_possibly.length === 0;

        let gf_ok: boolean | null;
        let gf_note: string;
        if (hasGluten) {
          gf_ok = false;
          gf_note = "CONTAINS_GLUTEN";
        } else if (mayHaveGluten) {
          gf_ok = false;
          gf_note = "MAY_CONTAIN_GLUTEN";
        } else if (noData) {
          gf_ok = null;
          const nameClaimsGF = /bezlepkov|bez lepku|gluten.?free/i.test(name);
          gf_note = nameClaimsGF ? "PROBABLY_GF_BY_NAME" : "NO_ALLERGEN_DATA";
        } else {
          gf_ok = true;
          gf_note = "GF_CONFIRMED";
        }

        const result = {
          id: product_id,
          name,
          brand,
          countries,
          badges,
          gf_ok,
          gf_note,
          allergens_contained,
          allergens_possibly,
          ingredients,
          nutritional_per_100,
        };

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
          isError: true
        };
      }
    }
  };
}
