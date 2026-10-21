   import type { Recipe } from "../types";

   export const recipes: Recipe[] = [
     {
       id: "garlic-tomato-pasta", title: "Garlic Tomato Pasta", timeMinutes: 20, diet: "vegetarian",
       ingredients: ["pasta", "tomatoes", "garlic", "olive oil", "parmesan"],
       steps: [
         "Boil the pasta in salted water until al dente.",
         "Saute sliced garlic in olive oil for one minute.",
         "Add chopped tomatoes and simmer for ten minutes.",
         "Toss with the pasta and top with parmesan.",
       ],
     },
     {
       id: "egg-bhurji", title: "Egg Bhurji", timeMinutes: 15, diet: "vegetarian",
       ingredients: ["eggs", "onions", "tomatoes", "butter"],
       steps: [
         "Melt butter and cook chopped onions until soft.",
         "Add chopped tomatoes and cook until mushy.",
         "Pour in beaten eggs and scramble until just set.",
       ],
     },
     {
       id: "spinach-omelette", title: "Spinach Omelette", timeMinutes: 10, diet: "vegetarian",
       ingredients: ["eggs", "spinach", "butter", "parmesan"],
       steps: [
         "Wilt the spinach in butter for a minute.",
         "Pour in beaten eggs and cook on medium heat.",
         "Sprinkle parmesan, fold, and serve.",
       ],
     },
     {
       id: "veg-pulao", title: "Veg Pulao", timeMinutes: 30, diet: "vegan",
       ingredients: ["rice", "onions", "bell pepper", "garlic", "olive oil"],
       steps: [
         "Rinse the rice and soak for ten minutes.",
         "Fry onions, garlic and bell pepper in olive oil.",
         "Add rice and twice the water, cover, and cook until fluffy.",
       ],
     },
     {
       id: "chicken-stir-fry", title: "Chicken Stir-Fry", timeMinutes: 25, diet: "any",
       ingredients: ["chicken breast", "bell pepper", "onions", "garlic", "olive oil"],
       steps: [
         "Slice the chicken into thin strips.",
         "Sear the chicken in hot olive oil until golden.",
         "Add onions, garlic and bell pepper and stir-fry for five minutes.",
       ],
     },
     {
       id: "aloo-fry", title: "Aloo Fry", timeMinutes: 25, diet: "vegan",
       ingredients: ["potatoes", "onions", "garlic", "olive oil"],
       steps: [
         "Dice the potatoes into small cubes.",
         "Fry them in olive oil until crisp at the edges.",
         "Add onions and garlic and cook until golden.",
       ],
     },
     {
       id: "tomato-soup", title: "Tomato Soup", timeMinutes: 30, diet: "vegetarian",
       ingredients: ["tomatoes", "onions", "garlic", "butter", "milk"],
       steps: [
         "Cook onions and garlic in butter until soft.",
         "Add chopped tomatoes and simmer for fifteen minutes.",
         "Blend smooth, stir in a splash of milk, and season.",
       ],
     },
     {
       id: "cheesy-garlic-toast", title: "Cheesy Garlic Toast", timeMinutes: 10, diet: "vegetarian",
       ingredients: ["bread", "butter", "garlic", "parmesan"],
       steps: [
         "Mix softened butter with minced garlic.",
         "Spread on bread and sprinkle with parmesan.",
         "Toast until golden and bubbling.",
       ],
     },
     {
       id: "spinach-rice-bowl", title: "Spinach Rice Bowl", timeMinutes: 25, diet: "vegan",
       ingredients: ["rice", "spinach", "garlic", "olive oil"],
       steps: [
         "Cook the rice until fluffy.",
         "Saute garlic in olive oil, then wilt the spinach.",
         "Mix everything together and season.",
       ],
     },
     {
       id: "creamy-chicken-pasta", title: "Creamy Chicken Pasta", timeMinutes: 30, diet: "any",
       ingredients: ["pasta", "chicken breast", "milk", "garlic", "parmesan"],
       steps: [
         "Boil the pasta until al dente.",
         "Cook diced chicken with garlic until done.",
         "Add milk and parmesan, simmer until creamy, and toss with pasta.",
       ],
     },
     {
       id: "french-toast", title: "French Toast", timeMinutes: 15, diet: "vegetarian",
       ingredients: ["bread", "eggs", "milk", "butter"],
       steps: [
         "Whisk eggs with a splash of milk.",
         "Dip the bread slices in the mixture.",
         "Fry in butter until golden on both sides.",
       ],
     },
     {
       id: "mashed-potatoes", title: "Garlic Mashed Potatoes", timeMinutes: 25, diet: "vegetarian",
       ingredients: ["potatoes", "butter", "milk", "garlic"],
       steps: [
         "Boil peeled potatoes with garlic until tender.",
         "Drain and mash with butter.",
         "Stir in warm milk until smooth.",
       ],
     },
   ];