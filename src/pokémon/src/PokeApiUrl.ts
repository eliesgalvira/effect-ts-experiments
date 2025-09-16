import { Config, Context, Effect, Layer, Redacted } from "effect";

export class PokeApiUrl extends Context.Tag("PokeApiUrl")<
  PokeApiUrl,
  string
>() {
  static readonly Live = Layer.effect(
    this, 
    Effect.gen(function* () {
        const baseUrl = yield* Config.redacted("BASE_URL");
        return PokeApiUrl.of(`${Redacted.value(baseUrl)}/api/v2/pokemon`);
    })
  );
}
