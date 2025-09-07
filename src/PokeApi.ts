import { Effect, Context, type ParseResult, Schema, Layer } from "effect";
import type { ConfigError } from "effect/ConfigError";
import { FetchError, JsonError } from "./errors.ts";
import { Pokemon } from "./schema.ts";
import { PokemonCollection } from "./PokemonCollection.ts";
import { BuildPokeApiUrl } from "./BuildPokeApiUrl.ts";

interface PokeApiImpl {
  readonly getPokemon: Effect.Effect<
    Pokemon,
    FetchError | JsonError | ParseResult.ParseError | ConfigError,
    BuildPokeApiUrl | PokemonCollection
  >;
}

const make = { 
  getPokemon: Effect.gen(function* () {
    const pokemonCollection = yield* PokemonCollection; // 👈 Create dependency
    const buildPokeApiUrl = yield* BuildPokeApiUrl; // 👈 Create dependency

    // 👇 `buildPokeApiUrl` is the function from `BuildPokeApiUrl`
    const requestUrl = buildPokeApiUrl({
      /// 👇 `pokemonCollection` is a `NonEmpty` list of `string`
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


export class PokeApi extends Context.Tag("PokeApi")<PokeApi, typeof make>() {
  static readonly Live = Layer.succeed(this, make);
}
