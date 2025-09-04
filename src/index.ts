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

/// Effect<unknown, never>
const main = fetchRequest.pipe(
    Effect.filterOrFail(
        (response) => response.ok,
        () => new FetchError({ customMessage: "There was an error fetching the data" })
    ),
    Effect.flatMap(jsonResponse),
    Effect.catchTags({
        FetchError: () => Effect.succeed<string>("Fetch Error"),
        JsonError: () => Effect.succeed<string>("Json Error"),
    }),
    Effect.tap(Console.log)
);

Effect.runPromise(main);
