import { z } from "zod";

export function createProductDetailTool() {
  return {
    name: "get_product_detail",
    definition: {
      title: "Get Product Detail",
      description: "Get detailed product info: ingredients, allergens, nutritional values and gluten-free status from Rohlik.cz product page",
      inputSchema: {
        product_id: z.number().describe("The product ID to get details for")
      }
    },
    handler: async (args: { product_id: number }) => {
      const { product_id } = args;
      try {
        // Get slug from API
        const apiResp = await fetch(`https://www.rohlik.cz/api/v1/products/${product_id}`, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
        });
        const productData: any = await apiResp.json();
        const slug = productData.slug || String(product_id);
        const name = productData.name || String(product_id);
        const brand = productData.brand || null;
        const badges = Array.isArray(productData.badges) ? productData.badges.map((b: any) => b.type).filter(Boolean) : [];
        const countries = Array.isArray(productData.countries) ? productData.countries.map((c: any) => c.code).filter(Boolean) : [];

        // Fetch full product page (SSR HTML contains embedded JSON with nutrition/ingredients)
        const pageResp = await fetch(`https://www.rohlik.cz/${product_id}-${slug}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'cs-CZ,cs;q=0.9'
          }
        });
        const html = await pageResp.text();

        // Extract nutritional values
        let nutritionalValues: any = null;
        const nvMatch = html.match(/"nutritionalValues":\[(\{"productId":\d+,"portion":".*?","values":\{.*?\}\})\]/);
        if (nvMatch) {
          try { nutritionalValues = JSON.parse('[' + nvMatch[1] + ']')[0]; } catch (_) {}
        }

        // Extract ingredients list — scan all "title" values inside the ingredients array
        let ingredients: string[] = [];
        const ingBlockMatch = html.match(/"ingredients":\[(\{.*?\}(?:,\{.*?\})*)\]/s);
        if (ingBlockMatch) {
          try {
            const parsed = JSON.parse('[' + ingBlockMatch[1] + ']');
            ingredients = parsed.map((i: any) => i.title).filter(Boolean);
          } catch (_) {
            // fallback: extract titles via regex
            const titles = [...ingBlockMatch[1].matchAll(/"title":"([^"]+)"/g)];
            ingredients = titles.map(m => m[1]);
          }
        }

        // Allergens: extract from embedded JSON — authoritative, based on EU reg. 1169/2011
        let allergens: { contained: string[]; possiblyContained: string[] } = { contained: [], possiblyContained: [] };
        const allergenMatch = html.match(/"allergens":\{"contained":\[(.*?)\],"possiblyContained":\[(.*?)\]\}/);
        if (allergenMatch) {
          try {
            const parseList = (s: string) => s ? s.split(',').map(x => x.replace(/"/g, '').trim()).filter(Boolean) : [];
            allergens.contained = parseList(allergenMatch[1]);
            allergens.possiblyContained = parseList(allergenMatch[2]);
          } catch (_) {}
        }

        const GLUTEN_LABEL = 'Obiloviny obsahující lepek';
        const hasGluten = allergens.contained.includes(GLUTEN_LABEL);
        const mayHaveGluten = allergens.possiblyContained.includes(GLUTEN_LABEL);

        let gfStatus: string;
        if (hasGluten)          gfStatus = '❌ OBSAHUJE LEPEK (výrobce deklaruje)';
        else if (mayHaveGluten) gfStatus = '⚠️ MůŽE OBSAHOVAT LEPEK (stopy, výrobce deklaruje)';
        else if (allergens.contained.length === 0 && allergens.possiblyContained.length === 0) {
          const nameClaimsGF = /bezlepkov|bez lepku|gluten.?free/i.test(name);
          gfStatus = nameClaimsGF
            ? '\U0001f7e1 PRAVDĚPODOBNĚ BEZ LEPKU (název produktu deklaruje "bezlepkový", ale Rohlik nemá formální alergení záznam)'
            : '❓ BEZ DAT — Rohlik neuvádí alergeny, zkontroluj etiketu';
        } else gfStatus = '✅ BEZ LEPKU (výrobce nedeklaruje v alergenech)';

        // Build output
        let output = `=== ${name} (ID: ${product_id}) ===\n`;
        output += `Lepek: ${gfStatus}\n`;
        if (allergens.contained.length > 0)
          output += `Alergeny v produktu: ${allergens.contained.join(', ')}\n`;
        if (allergens.possiblyContained.length > 0)
          output += `Možné stopy: ${allergens.possiblyContained.join(', ')}\n`;
        output += '\n';

        // Origin & badges (deterministic data from /api/v1/products/{id})
        output += `VÝROBCE/PůVOD:\n`;
        output += `  Brand: ${brand ?? '(anonymní — null)'}\n`;
        output += `  Země: ${countries.length > 0 ? countries.join(', ') : '(neznámá)'}\n`;
        output += `  Badges: ${badges.length > 0 ? badges.join(', ') : '(žádné)'}\n`;
        if (badges.includes('farmer-product')) output += `  ✅ Od českého farmáře\n`;
        if (badges.includes('best-buy')) output += `  ⚠️ Best-buy (komoditní strategie — obvykle anonymní)\n`;
        output += '\n';

        if (ingredients.length > 0) {
          output += `SLOŽENÍ:\n${ingredients.map((i: string) => `  • ${i}`).join('\n')}\n\n`;
        } else {
          output += `SLOŽENÍ: Nepodařilo se načíst\n\n`;
        }

        if (nutritionalValues) {
          const v = nutritionalValues.values;
          output += `NUTRIČNÍ HODNOTY (na ${nutritionalValues.portion}):\n`;
          if (v.energyKJ?.amount != null)      output += `  Energie:    ${v.energyKJ.amount} kJ / ${v.energyKCal?.amount} kcal\n`;
          if (v.fats?.amount != null)          output += `  Tuky:       ${v.fats.amount} g  (nasycené: ${v.saturatedFats?.amount ?? '?'} g)\n`;
          if (v.carbohydrates?.amount != null) output += `  Sacharidy:  ${v.carbohydrates.amount} g  (cukry: ${v.sugars?.amount ?? '?'} g)\n`;
          if (v.protein?.amount != null)       output += `  Bílkoviny:  ${v.protein.amount} g\n`;
          if (v.salt?.amount != null)          output += `  Sůl:        ${v.salt.amount} g\n`;
          if (v.fiber?.amount != null)         output += `  Vláknina:   ${v.fiber.amount} g\n`;
        } else {
          output += `NUTRIČNÍ HODNOTY: Nepodařilo se načíst\n`;
        }

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
          isError: true
        };
      }
    }
  };
}
