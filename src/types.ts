   export interface PantryItem {
     name: string;
     quantity: string;
     expiry?: string; // ISO date, YYYY-MM-DD
   }

   export interface Recipe {
     id: string;
     title: string;
     timeMinutes: number;
     diet: "vegan" | "vegetarian" | "any";
     ingredients: string[];
     steps: string[];
   }

   export interface ShoppingItem {
     item: string;
     quantity?: string;
   }

   export interface Timer {
     id: string;
     label: string;
     endsAt: number; // epoch ms
   }

   export interface ToolCallLog {
     id: string;
     name: string;
     input: unknown;
     output?: unknown;
     ok?: boolean;
     durationMs?: number;
     status: "running" | "done" | "error";
     at: number;
   }

   export interface ChatMessage {
     id: string;
     role: "user" | "assistant" | "system";
     text: string;
   }