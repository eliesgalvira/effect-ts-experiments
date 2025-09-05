import { Console, Effect } from "effect";
import { PokeApi, PokeApiLive } from "./PokeApi.ts";

const program = Effect.gen(function* () {
    const pokeApi = yield* PokeApi;
    return yield* pokeApi.getPokemon;
});

const runnable = program.pipe(Effect.provideService(PokeApi, PokeApiLive));

const main = runnable.pipe(
    Effect.catchTags({
        FetchError: (error) => Effect.succeed<string>(error.customMessage),
        JsonError: (error) => Effect.succeed<string>(error.customMessage),
        ParseError: (error) => Effect.succeed<string>(error.message),
    }),
    Effect.tap(Console.log)
);

Effect.runPromise(main);
