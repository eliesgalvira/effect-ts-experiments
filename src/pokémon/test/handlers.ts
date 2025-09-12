import { HttpResponse, http } from "msw";
import type { Pokemon } from "../src/schema.ts";

const mockPokemon: Pokemon = {
  id: 1,
  height: 10,
  weight: 10,
  order: 1,
  name: "myname",
};

export const handlers = [
  // 👇 Intercept requests for any pokemon (using wildcard `*`)
  http.get("http://localhost:3000/api/v2/pokemon/*", () => {
    return HttpResponse.json(mockPokemon);
  }),
];
