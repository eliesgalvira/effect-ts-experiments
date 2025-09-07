import { Console, Effect, Layer, type ParseResult } from "effect";
import { PokeApi } from "./PokeApi.ts";
import { FetchError, JsonError } from "./errors.ts";

const MainLayer = Layer.mergeAll(PokeApi.Default);

const program = Effect.gen(function* () {
    const pokeApi = yield* PokeApi;
    return yield* pokeApi.getPokemon;
});

const runnable = program.pipe(Effect.provide(MainLayer));

const main = runnable.pipe(
    Effect.catchTags({
        FetchError: (error: FetchError) => Effect.succeed<string>(error.customMessage),
        JsonError: (error: JsonError) => Effect.succeed<string>(error.customMessage),
        ParseError: (error: ParseResult.ParseError) => Effect.succeed<string>(error.message),
    }),
    Effect.tap(Console.log)
);

Effect.runPromise(main);
