import { Console, Schema, Effect } from "effect";
import { ExpectedLiteralError, CouldNotFindLiteralError } from "./errors.ts";

export function typedString() {
  return <const Schemas extends readonly Schema.Schema<any, any, never>[]>(
      strings: TemplateStringsArray,
      ...schemas: Schemas
    ) =>
    (input: string) =>
      Effect.gen(function* () {
        let pos = 0;
        const results: unknown[] = [];

        for (let i = 0; i < strings.length; i++) {
          const literal = strings[i]!;

          if (!input.startsWith(literal, pos)) {
            return yield* Effect.fail(
              new ExpectedLiteralError({
                message: `Expected "${literal}" at position ${pos}`,
              })
            );
          }
          pos += literal.length;

          if (i < schemas.length) {
            const nextLiteral = strings[i + 1]!;
            const nextPos = nextLiteral
              ? input.indexOf(nextLiteral, pos)
              : input.length;

            if (nextPos === -1) {
              return yield* Effect.fail(
                new CouldNotFindLiteralError({
                  message: `Could not find "${nextLiteral}" after position ${pos}`,
                })
              );
            }

            const raw = input.slice(pos, nextPos);
            const decoded = yield* Schema.decodeUnknown(schemas[i]!)(raw);
            results.push(decoded);
            pos = nextPos;
          }
        }

        return results;
      });
}

const matcher = typedString()`example/${Schema.NumberFromString}what&${Schema.NumberFromString}`;

const program = Effect.gen(function* () {
  const result = yield* matcher("example/34what&3");
  return result;
});

const main = program.pipe(
  Effect.catchTags({
    ExpectedLiteralError: (error: ExpectedLiteralError) =>
      Effect.succeed(error.message),
    CouldNotFindLiteralError: (error: CouldNotFindLiteralError) =>
      Effect.succeed(error.message),
  }),
  Effect.tap(Console.log)
);

Effect.runPromise(main);
