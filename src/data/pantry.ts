   import { daysFromNow } from "../lib/dates";
   import type { PantryItem } from "../types";

   // A function (not a constant) so expiry dates are relative to "today" on load.
   export const seedPantry = (): PantryItem[] => [
     { name: "spinach", quantity: "1 bunch", expiry: daysFromNow(1) },
     { name: "milk", quantity: "1 litre", expiry: daysFromNow(2) },
     { name: "chicken breast", quantity: "500 g", expiry: daysFromNow(2) },
     { name: "tomatoes", quantity: "4", expiry: daysFromNow(3) },
     { name: "bread", quantity: "1 loaf", expiry: daysFromNow(3) },
     { name: "yogurt", quantity: "400 g", expiry: daysFromNow(4) },
     { name: "bell pepper", quantity: "2", expiry: daysFromNow(5) },
     { name: "eggs", quantity: "6", expiry: daysFromNow(10) },
     { name: "potatoes", quantity: "1 kg", expiry: daysFromNow(14) },
     { name: "onions", quantity: "5", expiry: daysFromNow(21) },
     { name: "garlic", quantity: "1 bulb", expiry: daysFromNow(30) },
     { name: "butter", quantity: "200 g", expiry: daysFromNow(40) },
     { name: "olive oil", quantity: "500 ml", expiry: daysFromNow(200) },
     { name: "pasta", quantity: "500 g", expiry: daysFromNow(300) },
     { name: "rice", quantity: "2 kg", expiry: daysFromNow(365) },
   ];