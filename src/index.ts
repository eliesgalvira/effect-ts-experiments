import { Console, Effect, Data, Schema, Config } from "effect";

const config = Config.string("BASE_URL")

class Pokemon extends Schema.Class<Pokemon>("Pokemon")({
    id: Schema.Number,
    order: Schema.Number,
    name: Schema.String,
    height: Schema.Number,
    weight: Schema.Number,
}) {};

class FetchError extends Data.TaggedError("FetchError")<{ customMessage: string }> {};

class JsonError extends Data.TaggedError("JsonError")<{ customMessage: string }> {};

const getPokemon = Effect.gen(function* () {
    const baseUrl = yield* config;

    const response = yield* Effect.tryPromise({
        try: () => fetch(`${baseUrl}/api/v2/pokemon/garchomp/`),
        catch: () => new FetchError({ customMessage: "There was an error fetching the data" })
    });

    if (!response.ok) {
        return yield* new FetchError({ customMessage: "There was an error fetching the data" });
    }

    const json = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: () => new JsonError({ customMessage: "There was an error parsing the data" })
    });

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
