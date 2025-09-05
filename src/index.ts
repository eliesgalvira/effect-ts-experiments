import { Console, Effect, Schema, Config } from "effect";
import { FetchError, JsonError } from "./errors.ts";
import { Pokemon } from "./schema.ts";

const config = Config.string("BASE_URL")

const getPokemon = Effect.gen(function* () {
    const baseUrl = yield* config;

    const response = yield* Effect.tryPromise({
        try: () => fetch(`${baseUrl}/api/v2/pokemon/garchomp/`),
        catch: () => new FetchError({ customMessage: "There was an error fetching the data, promise failed" })
    });

    if (!response.ok) {
        return yield* new FetchError({ customMessage: "There was an error fetching the data, response not ok" });
    }

    const json = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: () => new JsonError({ customMessage: "There was an error parsing the data" })
    });

    // Effect<Pokemon, ParseError>
    return yield* Schema.decodeUnknown(Pokemon)(json);
});

const main = getPokemon.pipe(
    Effect.catchTags({
        FetchError: (error) => Effect.succeed<string>(error.customMessage),
        JsonError: (error) => Effect.succeed<string>(error.customMessage),
        ParseError: (error) => Effect.succeed<string>(error.message),
    }),
    Effect.tap(Console.log)
);

Effect.runPromise(main);
