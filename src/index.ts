import { Console, Effect, Data, Schema } from "effect";

class Pokemon extends Schema.Class<Pokemon>("Pokemon")({
    id: Schema.Number,
    order: Schema.Number,
    name: Schema.String,
    height: Schema.Number,
    weight: Schema.Number,
}) {};
class FetchError extends Data.TaggedError("FetchError")<{ customMessage: string }> {};

class JsonError extends Data.TaggedError("JsonError")<{ customMessage: string }> {};

/// Effect<Response, FetchError>
const fetchRequest = Effect.tryPromise({
    try: () => fetch("https://pokeapi.co/api/v2/pokemon/garchomp/"),
    catch: () => new FetchError({ customMessage: "There was an error fetching the data" })
});
  
/// Effect<unknown, JsonError>
const jsonResponse = (response: Response) => Effect.tryPromise({
    try: () => response.json(),
    catch: () => new JsonError({ customMessage: "There was an error parsing the data" })
});

/// Effect<unknown, ParseError>
const decodePokemon = Schema.decodeUnknown(Pokemon);

/// Effect<unknown, JsonError | FetchError | ParseError>
const program = Effect.gen(function* () {
    const response = yield* fetchRequest;
    if (!response.ok) {
        return yield* new FetchError({ customMessage: "There was an error fetching the data" });
    }

    const json = yield* jsonResponse(response);
    return yield* decodePokemon(json);
});

/// Effect<unknown, never>
const main = program.pipe(
    Effect.catchTags({
        FetchError: (error) => Effect.succeed<string>(error.customMessage),
        JsonError: (error) => Effect.succeed<string>(error.customMessage),
        ParseError: (error) => Effect.succeed<string>(error.message),
    }),
    Effect.tap(Console.log)
);

Effect.runPromise(main);
