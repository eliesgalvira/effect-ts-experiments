import {
  Console,
  Effect,
  Layer,
  ManagedRuntime,
  type ParseResult,
} from "effect";
import { PokeApi } from "./PokeApi.ts";
import { FetchError, JsonError } from "./errors.ts";

const MainLayer = Layer.mergeAll(PokeApi.Default);

const PokemonRuntime = ManagedRuntime.make(MainLayer);

const program = Effect.gen(function* () {
  const pokeApi = yield* PokeApi;
  return yield* pokeApi.getPokemon;
});

const main = program.pipe(
  Effect.catchTags({
    FetchError: (error: FetchError) =>
      Effect.succeed<string>(error.customMessage),
    JsonError: (error: JsonError) =>
      Effect.succeed<string>(error.customMessage),
    ParseError: (error: ParseResult.ParseError) =>
      Effect.succeed<string>(error.message),
  }),
  Effect.tap(Console.log)
);

PokemonRuntime.runPromise(main);
