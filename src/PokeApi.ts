import { Effect, Context, type ParseResult, Schema, Layer } from "effect";
import { FetchError, JsonError } from "./errors.ts";
import { Pokemon } from "./schema.ts";
import { PokemonCollection } from "./PokemonCollection.ts";
import { BuildPokeApiUrl } from "./BuildPokeApiUrl.ts";

const make = Effect.gen(function* () {
  const pokemonCollection = yield* PokemonCollection;
  const buildPokeApiUrl = yield* BuildPokeApiUrl;

  return {
    getPokemon: Effect.gen(function* () {
      const requestUrl = buildPokeApiUrl({
        name: pokemonCollection[0],
      });

      const response = yield* Effect.tryPromise({
        try: () => fetch(requestUrl),
        catch: () => new FetchError({ customMessage: "Failed to fetch pokemon, promise failed" }),
      });

      if (!response.ok) {
        return yield* new FetchError({ customMessage: "Failed to fetch pokemon, response not ok" });
      }

      const json = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: (): JsonError => new JsonError({ customMessage: "Failed to parse pokemon" }),
      });

      return yield* Schema.decodeUnknown(Pokemon)(json);
    }),
  };
});


export class PokeApi extends Context.Tag("PokeApi")<
  PokeApi,
  Effect.Effect.Success<typeof make>
>() {
  static readonly Live = Layer.effect(this, make).pipe(
    Layer.provide(Layer.mergeAll(
      PokemonCollection.Live,
      BuildPokeApiUrl.Live,
    ))
  );

  static readonly Mock = Layer.succeed(
    this,
    PokeApi.of({
      getPokemon: Effect.succeed({
        id: 1,
        height: 10,
        weight: 10,
        name: "my-name",
        order: 1,
      }),
    })
  );
}
