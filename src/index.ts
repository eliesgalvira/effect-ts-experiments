import { Effect } from "effect";

/// Effect<Response, UnknownException>
const fetchRequest = Effect.tryPromise(
    () => fetch("https://pokeapi.co/api/v2/pokemon/garchomp/")
);
  
/// Effect<unknown, UnknownException>
const jsonResponse = (response: Response) => Effect.tryPromise(
() => response.json()
);

/// Effect<unknown, UnknownException>
const main = Effect.flatMap(fetchRequest, jsonResponse);

Effect.runPromise(main);
