#!/usr/bin/env bun
/**
 * Test script for markdown-to-terminal with code syntax highlighting
 * Run with: bun src/tests/markdown-highlight-test.ts
 */

import { markdownToTerminal } from "../utils/markdown-to-terminal.js";

// Example markdown with code blocks
const sampleMarkdown = `
# Sample Code

Here's a **JavaScript** function example:

\`\`\`javascript
function calculateTotal(items) {
  // Calculate the sum of all items
  return items
    .map(item => item.price * item.quantity)
    .reduce((total, itemTotal) => total + itemTotal, 0);
}

// Example usage
const cart = [
  { name: "Product 1", price: 10, quantity: 2 },
  { name: "Product 2", price: 15, quantity: 1 }
];
console.log(calculateTotal(cart)); // 35
\`\`\`

And a *Python* snippet:

\`\`\`python
def calculate_total(items):
    # Calculate the sum of all items
    return sum(item['price'] * item['quantity'] for item in items)

# Example usage
cart = [
    {"name": "Product 1", "price": 10, "quantity": 2},
    {"name": "Product 2", "price": 15, "quantity": 1}
]
print(calculate_total(cart))  # 35
\`\`\`

Also a TypeScript interface:

\`\`\`typescript
interface CartItem {
  name: string;
  price: number;
  quantity: number;
}

function calculateTotal(items: CartItem[]): number {
  return items.reduce((total, item) => total + (item.price * item.quantity), 0);
}
\`\`\`

With inline code like \`const x = 5;\` mixed in.
`;

// Display the highlighted markdown
console.log(markdownToTerminal(sampleMarkdown));