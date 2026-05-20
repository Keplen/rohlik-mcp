import { z } from "zod";

const GLUTEN_LABEL = 'Obiloviny obsahující lepek';

async function fetchAllergens(product_id: number): Promise<any> {
  const apiResp = await fetch(`https://www.rohlik.cz/api/v1/products/${product_id}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
  });
  if (!apiResp.ok) {
    return { id: product_id, error: `Product not found (HTTP ${apiResp.status})`, gf_ok: null, no_allergen_data: true };
  }
  const productData: any = await apiResp.json();
  if (!productData || !productData.id) {
    return { id: product_id, error: 'Product not found', gf_ok: null, no_allergen_data: true };
  }
  const slug = productData.slug || String(product_id);
  const name = productData.name || String(product_id);

  const pageResp = await fetch(`https://www.rohlik.cz/${product_id}-${slug}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'cs-CZ,cs;q=0.9'
    }
  });
  const html = await pageResp.text();

  let allergens: { contained: string[]; possiblyContained: string[] } = { contained: [], possiblyContained: [] };
  const m = html.match(/"allergens":\{"contained":\[(.*?)\],"possiblyContained":\[(.*?)\]\}/);
  if (m) {
    const parseList = (s: string) => s ? s.split(',').map(x => x.replace(/"/g, '').trim()).filter(Boolean) : [];
    allergens.contained = parseList(m[1]);
    allergens.possiblyContained = parseList(m[2]);
  }

  const hasGluten = allergens.contained.includes(GLUTEN_LABEL);
  const noData = allergens.contained.length === 0 && allergens.possiblyContained.length === 0;
  // no_allergen_data=true means Rohlik has no label data — we cannot confirm safety
  // gf_ok=null means UNKNOWN (not safe to assume GF), gf_ok=false means confirmed contains gluten
  const gfOk = noData ? null : !hasGluten;

  return {
    id: product_id,
    name,
    gf_ok: gfOk,
    no_allergen_data: noData,
    allergens_contained: allergens.contained,
    allergens_possibly: allergens.possiblyContained,
  };
}

export function createCheckAllergensTool() {
  return {
    name: "check_allergens",
    definition: {
      title: "Check Allergens",
      description: "Batch allergen check for up to 20 product IDs. Returns JSON array: [{id, name, gf_ok, no_allergen_data, allergens_contained[], allergens_possibly[]}]. gf_ok semantics: false=confirmed contains gluten, true=confirmed GF safe, null=unknown (no allergen data or product not found). CRITICAL: always check no_allergen_data — if true, gf_ok=null means Rohlik has no label data, NOT that the product is safe. Raw produce (vegetables, fruit) typically has no_allergen_data=true. Non-existent IDs return {error: 'Product not found', gf_ok: null} without crashing the batch.",
      inputSchema: {
        ids: z.array(z.number()).min(1).max(20).describe("List of product IDs to check (max 20)")
      }
    },
    handler: async (args: { ids: number[] }) => {
      const { ids } = args;
      try {
        const results = await Promise.all(
          ids.map((id: number) => fetchAllergens(id).catch((err: any) => ({
            id,
            error: err instanceof Error ? err.message : String(err),
            gf_ok: null,
            no_allergen_data: true
          })))
        );
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(results)
          }]
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
