import { Effect, Context, type ParseResult, Schema, Config } from "effect";
import type { ConfigError } from "effect/ConfigError";
import { FetchError, JsonError } from "./errors.ts";
import { Pokemon } from "./schema.ts";

export interface PokeApi {
  readonly getPokemon: Effect.Effect<
    Pokemon,
    FetchError | JsonError | ParseResult.ParseError | ConfigError
  >;
}

export const PokeApi = Context.GenericTag<PokeApi>("PokeApi");

export const PokeApiLive = PokeApi.of({
    getPokemon: Effect.gen(function* () {
        const baseUrl = yield* Config.string("BASE_URL");

        const response = yield* Effect.tryPromise({
            try: () => fetch(`${baseUrl}/api/v2/pokemon/garchomp`),
            catch: () => new FetchError({ customMessage: "Failed to fetch pokemon, promise failed" }),
        });

        if (!response.ok) {
            return yield* new FetchError({ customMessage: "Failed to fetch pokemon, response not ok" });
        }

        const json = yield* Effect.tryPromise({
            try: () => response.json(),
            catch: (): JsonError => new JsonError({ customMessage: "Failed to parse pokemon" }),
        });

        return yield* Schema.decodeUnknown(Pokemon)(json)
    }),
});
