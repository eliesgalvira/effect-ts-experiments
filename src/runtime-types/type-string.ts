import { Console, Schema, Effect } from "effect";
import { ExpectedLiteralError, CouldNotFindLiteralError } from "./errors.ts";

export function typedString() {
  return <const Schemas extends readonly Schema.Schema<any, any, never>[]>(
      strings: TemplateStringsArray,
      ...schemas: Schemas
    ) =>
    (input: string) =>
      Effect.gen(function* () {
        // Create pairs of (literal, schema) to process
        const segments = strings.slice(0, -1).map((literal, i) => ({
          literal,
          schema: schemas[i]!,
          nextLiteral: strings[i + 1]!,
        }));

        // Process segments using fold to maintain position state
        const finalState = yield* Effect.reduce(
          segments,
          { pos: 0, results: [] as unknown[] },
          (acc, segment) =>
            Effect.gen(function* () {
              // Check literal
              if (!input.startsWith(segment.literal, acc.pos)) {
                return yield* Effect.fail(
                  new ExpectedLiteralError({
                    message: `Expected "${segment.literal}" at position ${acc.pos}`,
                  })
                );
              }

              const afterLiteral = acc.pos + segment.literal.length;
              const nextPos = segment.nextLiteral
                ? input.indexOf(segment.nextLiteral, afterLiteral)
                : input.length;

              if (nextPos === -1) {
                return yield* Effect.fail(
                  new CouldNotFindLiteralError({
                    message: `Could not find "${segment.nextLiteral}" after position ${afterLiteral}`,
                  })
                );
              }

              const raw = input.slice(afterLiteral, nextPos);
              const decoded = yield* Schema.decodeUnknown(segment.schema)(raw);

              return {
                pos: nextPos,
                results: [...acc.results, decoded],
              };
            })
        );

        // Check final literal
        const finalLiteral = strings[strings.length - 1]!;
        if (!input.startsWith(finalLiteral, finalState.pos)) {
          return yield* Effect.fail(
            new ExpectedLiteralError({
              message: `Expected final "${finalLiteral}" at position ${finalState.pos}`,
            })
          );
        }

        return finalState.results;
      });
}

export function typedStringImperative() {
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
