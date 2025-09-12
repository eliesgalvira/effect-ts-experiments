import { Effect } from "effect";
import { PokeApiUrl } from "./PokeApiUrl.ts";


export class BuildPokeApiUrl extends Effect.Service<BuildPokeApiUrl>()(
  "BuildPokeApiUrl",
  {
    effect: Effect.gen(function* () {
      const pokeApiUrl = yield* PokeApiUrl; // 👈 Create dependency
      return ({ name }: { name: string }) => `${pokeApiUrl}/${name}`;
    }),
    dependencies: [PokeApiUrl.Live],
  }
) {}
