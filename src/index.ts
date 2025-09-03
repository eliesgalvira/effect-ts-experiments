import { Console, Effect } from "effect";

interface FetchError {
    readonly _tag: "FetchError";
}

interface JsonError {
    readonly _tag: "JsonError";
}

/// Effect<Response, FetchError>
const fetchRequest = Effect.tryPromise({
    try: () => fetch("https://pokeapi.co/api/v2/pokemon/gargomp/"),
    catch: (): FetchError => ({ _tag: "FetchError" })
});
  
/// Effect<unknown, JsonError>
const jsonResponse = (response: Response) => Effect.tryPromise({
    try: () => response.json(),
    catch: (): JsonError => ({ _tag: "JsonError" })
});

/// Effect<unknown, never>
const main = fetchRequest.pipe(
    Effect.flatMap(jsonResponse),
    Effect.catchTags({
        FetchError: () => Effect.succeed<string>("Fetch Error"),
        JsonError: () => Effect.succeed<string>("Json Error"),
    }),
    Effect.tap(Console.log)
);

Effect.runPromise(main);
