import { Console, Effect, Data } from "effect";

class FetchError extends Data.TaggedError("FetchError")<
    {
        customMessage: string;
    }
> {}

class JsonError extends Data.TaggedError("JsonError")<
    {
        customMessage: string;
    }
> {}

/// Effect<Response, FetchError>
const fetchRequest = Effect.tryPromise({
    try: () => fetch("https://pokeapi.co/api/v2/pokemon/gargomp/"),
    catch: () => new FetchError({ customMessage: "There was an error fetching the data" })
});
  
/// Effect<unknown, JsonError>
const jsonResponse = (response: Response) => Effect.tryPromise({
    try: () => response.json(),
    catch: () => new JsonError({ customMessage: "There was an error parsing the data" })
});

/// Effect<unknown, JsonError | FetchError>
const program = Effect.gen(function* () {
    const response = yield* fetchRequest;
    if (!response.ok) {
        return yield* new FetchError({ customMessage: "There was an error fetching the data" });
    }

    return yield* jsonResponse(response);
});

/// Effect<unknown, never>
const main = program.pipe(
    Effect.catchTags({
        FetchError: (error) => Effect.succeed<string>(error.customMessage),
        JsonError: (error) => Effect.succeed<string>(error.customMessage),
    }),
    Effect.tap(Console.log)
);

Effect.runPromise(main);
