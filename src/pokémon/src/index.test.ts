import { Effect, ConfigProvider, Layer, ManagedRuntime, Console } from "effect";
import type { ParseResult } from "effect";
import { PokeApi } from "./PokeApi.ts";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "../test/node.ts";
import { expect, it } from "vitest";
import { FetchError, JsonError } from "./errors.ts";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const TestConfigProvider = ConfigProvider.fromMap(
    new Map([["BASE_URL", "http://localhost:3000"]])
);

const ConfigProviderLayer = Layer.setConfigProvider(TestConfigProvider);
const MainLayer = PokeApi.Default.pipe(Layer.provide(ConfigProviderLayer));

const PokemonRuntimeTest = ManagedRuntime.make(MainLayer);

const program = Effect.gen(function* () {
const pokeApi = yield* PokeApi;
return yield* pokeApi.getPokemon;
});

const main = program.pipe(
    Effect.catchTags({
        FetchError: (error: FetchError) => Effect.succeed<string>(error.customMessage),
        JsonError: (error: JsonError) => Effect.succeed<string>(error.customMessage),
        ParseError: (error: ParseResult.ParseError) => Effect.succeed<string>(error.message),
    }),
    Effect.tap(Console.log)
);


it("returns a valid pokemon", async () => {
const response = await PokemonRuntimeTest.runPromise(main);
expect(response).toEqual({
    id: 1,
    height: 10,
    weight: 10,
    order: 1,
    name: "myname",
});
});
