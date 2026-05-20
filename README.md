# <img src="https://www.rohlik.cz/favicon/cz/favicon.ico" alt="Rohlik" width="30" height="30"> Rohlik MCP Server

**Přidej Rohlik.cz do svého LLM asistenta.**

> [!WARNING]
> Tento MCP server využívá reverse-engineerované Rohlik API. Je určen pouze pro osobní použití.

> [!NOTE]
> Fork od [@tomaspavlin/rohlik-mcp](https://github.com/tomaspavlin/rohlik-mcp). Hlavní vylepšení: všechny tools vrací strukturovaný JSON, přidány nové tools (Maia AI asistentka, batch allergen check, detail produktu), sdílená session (jeden login místo N), správný cookie merge.

## Podporované služby

- 🇨🇿 **[Rohlik.cz](https://www.rohlik.cz)** — Česká republika

## Instalace

```bash
# Klonování a build
git clone https://github.com/Keplen/rohlik-mcp.git
cd rohlik-mcp
npm install
npm run build
```

## Konfigurace (Claude Code)

V `.mcp.json` nebo `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rohlik": {
      "command": "node",
      "args": ["/cesta/k/rohlik-mcp/dist/index.js"],
      "env": {
        "ROHLIK_USERNAME": "vas-email@example.com",
        "ROHLIK_PASSWORD": "vase-heslo"
      }
    }
  }
}
```

Nebo instalace z GitHubu:

```bash
npm install -g github:Keplen/rohlik-mcp
```

## Tools

### Vyhledávání a produkty
- `search_products` — Hledání produktů podle názvu. Vrací JSON s cenou, slevou, `is_on_sale`, `savings_czk`.
- `get_product_detail` — Detailní info o produktu: složení, alergeny, nutriční hodnoty, `gf_ok` (true/false/null). Pomalejší než `check_allergens`.
- `check_allergens` — Batch allergen check pro až 20 ID najednou. `gf_ok=false` = obsahuje lepek, `gf_ok=null` = žádná data, `gf_ok=true` = bezlepkové.

### Košík
- `add_to_cart` — Přidá produkty do košíku.
- `get_cart_content` — Aktuální košík jako JSON: `total_czk`, `total_savings_czk`, per-item `line_total_czk`, `is_on_sale`, `line_savings_czk`. `can_order=false` = blokováno (perishables, chybí slot).
- `remove_from_cart` — Odebere položku z košíku.
- `clear_cart` — Vymaže celý košík.

### Slevy a inspirace
- `get_discounted_items` — Aktuální slevy jako JSON: `price_czk`, `original_price_czk`, `savings_czk`, `discount_percent`, `discount_label`, `sale_valid_till`, `is_available`. Filtrovat podle `sale_type` (sales, week-sales, last-minute…) a kategorie.
- `get_meal_suggestions` — Produkty z minulých objednávek filtrované podle typu jídla (breakfast/lunch/dinner/snack/baking/drinks/healthy). Vrací `avg_price_czk` a `frequency`.
- `get_frequent_items` — Nejčastěji kupované produkty z order history. Vrací `avg_price_czk`, `frequency`, `last_ordered`.

### Maia (Rohlik AI asistentka)
- `ask_maia` — Pošle zprávu Maie a vrátí JSON: `response` (text), `recipes[{id,name}]`, `product_groups[{title,product_ids[]}]`. `product_groups` je neprázdný jen když Maia aktivně přidává do košíku. ⚠️ Maia může halucinovat produkty — vždy ověř přes `check_allergens` nebo `get_product_detail`.

### Objednávky a doručení
- `get_order_history` — Historie doručených objednávek jako JSON: `{count, orders[{id, date, total_czk, items_count, items_total_quantity}]}`. Pro detailní rozpis produktů použij `get_order_detail` s `id`.
- `get_order_detail` — Detailní přehled objednávky se všemi produkty: `paid_czk`, `unit_price_czk`.
- `get_upcoming_orders` — Naplánované budoucí objednávky.
- `get_delivery_info` — Aktuální doručovací informace.
- `get_delivery_slots` — Dostupné časové okno pro doručení. `restrictionMessageSummary` vysvětluje proč nejsou sloty (perishables v košíku apod.).

### Účet
- `get_account_data` — Kompletní snapshot účtu: košík, doručení, poslední objednávka, premium, oznámení, tašky.
- `get_shopping_list` — Nákupní seznam podle ID jako JSON: `{name, count, products[{id,name,quantity}]}`.
- `get_premium_info` — Stav Xtra/Premium předplatného a úspory.
- `get_announcements` — Aktuální oznámení jako JSON: `{announcements:[]}`.
- `get_reusable_bags_info` — Přehled zálohovaných tašek jako JSON: `{current, max, deposit{amount,currency}, feedbackOptions[]}`.
- `get_shopping_scenarios` — Textový průvodce co MCP umí a příklady promptů. Záměrně vrací text, ne JSON.

## Vývoj

```bash
npm run build    # kompilace TypeScript → JavaScript
npm start        # spuštění serveru
npm test         # unit testy
npm run inspect  # test přes MCP Inspector
```

## License

MIT License — viz [LICENSE](LICENSE).

Původní projekt: [tomaspavlin/rohlik-mcp](https://github.com/tomaspavlin/rohlik-mcp) (Tomas Pavlin).  
Reverse engineering Rohlik API: [dvejsada/HA-RohlikCZ](https://github.com/dvejsada/HA-RohlikCZ).
