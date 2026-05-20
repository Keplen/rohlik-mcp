import { z } from "zod";

export function createShoppingScenariosTool() {
  return {
    name: "get_shopping_scenarios",
    definition: {
      title: "Get Shopping Scenarios",
      description: "Shows example scenarios and use cases for the Rohlik MCP — helps understand what tools are available and what is possible",
      inputSchema: {}
    },
    handler: async () => {
      const output = `ROHLIK MCP — WHAT YOU CAN DO

SMART SHOPPING SCENARIOS:

1. MEAL-BASED SHOPPING
   "Add breakfast items I typically order"
   "Show me lunch suggestions for this week"
   "I need dinner ingredients - suggest what I usually buy"
   Tool: get_meal_suggestions

2. QUICK REORDERING
   "Show my 20 most frequently purchased items"
   "What do I buy most often?"
   "Add my top 10 frequent items to cart"
   Tool: get_frequent_items

3. SPECIFIC PRODUCT SEARCH
   "Find organic milk and add to cart"
   "Search for gluten-free bread"
   "Show me all chocolates on sale"
   Tools: search_products + add_to_cart

4. DEALS & DISCOUNTS
   "What's on sale today?"
   "Show premium subscriber deals"
   "Find last-minute discounts"
   Tool: get_discounted_items

5. ORDER MANAGEMENT
   "What's in my cart?"
   "Show my last 5 orders"
   "What did I order last week?"
   "Show details of order #1234567"
   Tools: get_cart_content, get_order_history, get_order_detail

6. DELIVERY PLANNING
   "When is my next delivery?"
   "What delivery slots are available tomorrow?"
   Tools: get_upcoming_orders, get_delivery_slots

7. ALLERGEN & NUTRITION CHECK
   "Is this product gluten-free?"
   "Check allergens for these 10 product IDs"
   "Show full nutrition info for product 123456"
   Tools: check_allergens (fast batch), get_product_detail (full info)

8. AI ASSISTANT
   "Suggest 3 gluten-free dinners for next week"
   "Help me plan my weekly shopping"
   Tool: ask_maia

AVAILABLE TOOLS (22):

Shopping:
   search_products         - Find products by name
   add_to_cart             - Add products to cart
   get_cart_content        - View current cart
   remove_from_cart        - Remove item from cart
   clear_cart              - Empty cart completely
   get_shopping_list       - View shopping lists

Smart Features:
   get_meal_suggestions    - Meal-based suggestions from order history
   get_frequent_items      - Most purchased items analysis
   get_shopping_scenarios  - This help

Orders:
   get_order_history       - Past delivered orders
   get_order_detail        - Full order with items
   get_upcoming_orders     - Scheduled upcoming orders

Delivery:
   get_delivery_info       - Current delivery info
   get_delivery_slots      - Available time slots

Deals:
   get_discounted_items    - Current sales and discounts

Product info:
   get_product_detail      - Ingredients, nutrition, allergens (full)
   check_allergens         - Batch GF/allergen check (fast, up to 20 IDs)

Account:
   get_account_data        - Full account snapshot
   get_premium_info        - Xtra subscription info
   get_announcements       - Current announcements
   get_reusable_bags_info  - Bag tracking

AI:
   ask_maia                - Rohlik's built-in AI assistant

MEAL TYPES (get_meal_suggestions):
   breakfast - Morning essentials (bread, milk, cereals, fruits)
   lunch     - Midday meal ingredients (meat, vegetables, pasta, rice)
   dinner    - Evening meal items (meat, fish, vegetables, sides)
   snack     - Quick bites (sweets, fruits, nuts, yogurt)
   baking    - Baking supplies (flour, sugar, chocolate, butter)
   drinks    - Beverages (coffee, tea, juices, water, alcohol)
   healthy   - Health-focused (bio, vegan, gluten-free, vegetables)`;

      return {
        content: [
          {
            type: "text" as const,
            text: output
          }
        ]
      };
    }
  };
}
