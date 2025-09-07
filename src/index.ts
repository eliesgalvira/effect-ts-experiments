import { Console, Effect, Layer } from "effect";
import { PokeApi } from "./PokeApi.ts";

const MainLayer = Layer.mergeAll(PokeApi.Live);

const program = Effect.gen(function* () {
    const pokeApi = yield* PokeApi;
    return yield* pokeApi.getPokemon;
});

const runnable = program.pipe(Effect.provide(MainLayer));

const main = runnable.pipe(
    Effect.catchTags({
        FetchError: (error) => Effect.succeed<string>(error.customMessage),
        JsonError: (error) => Effect.succeed<string>(error.customMessage),
        ParseError: (error) => Effect.succeed<string>(error.message),
    }),
    Effect.tap(Console.log)
);

Effect.runPromise(main);
