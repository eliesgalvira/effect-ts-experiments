import { Console, Schema, Effect } from "effect";
import {
  ExpectedLiteralError,
  CouldNotFindLiteralError,
  DecodeError,
} from "./errors.ts";

type StringSchema = Schema.Schema<any, string, never>;
type InferA<X> = X extends Schema.Schema<infer A, any, any> ? A : never;
type OutTuple<S extends readonly Schema.Schema<any, any, any>[]> = {
  readonly [K in keyof S]: InferA<S[K]>;
};

export function typedString() {
  return <const Schemas extends readonly StringSchema[]>(
      strings: TemplateStringsArray,
      ...schemas: Schemas
    ) =>
    (input: string) =>
      Effect.succeed({ schemas, strings, input }).pipe(
        Effect.filterOrFail(
          ({ schemas, strings }) => schemas.length === strings.length - 1,
          () =>
            new CouldNotFindLiteralError({
              message: `Template placeholders mismatch: got ${schemas.length} schemas for ${strings.length} literals`,
            })
        ),
        Effect.flatMap(({ schemas, strings, input }) => {
          const segments = schemas.map((schema, i) => ({
            literal: strings[i]!,
            schema,
            nextLiteral: strings[i + 1]!,
            index: i,
          }));

          return Effect.reduce(
            segments,
            { pos: 0, results: [] as unknown[] },
            (state, seg) =>
              Effect.succeed(state).pipe(
                Effect.filterOrFail(
                  (s) => input.startsWith(seg.literal, s.pos),
                  () =>
                    new ExpectedLiteralError({
                      message: `Expected "${seg.literal}" at position ${state.pos}`,
                    })
                ),
                Effect.map((s) => ({ ...s, pos: s.pos + seg.literal.length })),
                Effect.flatMap((s) => {
                  const nextPos = seg.nextLiteral
                    ? input.indexOf(seg.nextLiteral, s.pos)
                    : input.length;
                  return nextPos === -1
                    ? Effect.fail(
                        new CouldNotFindLiteralError({
                          message: `Could not find "${seg.nextLiteral}" after position ${s.pos}`,
                        })
                      )
                    : Effect.succeed({ ...s, nextPos });
                }),
                Effect.flatMap((s) => {
                  const raw = input.slice(s.pos, s.nextPos);
                  return Schema.decodeUnknown(seg.schema)(raw).pipe(
                    Effect.catchTags({
                      ParseError: (cause) =>
                        Effect.fail(
                          new DecodeError({
                            index: seg.index,
                            raw,
                            cause,
                            message: `Failed to decode placeholder #${seg.index}`,
                          })
                        ),
                    }),
                    Effect.map((decoded) => ({
                      pos: s.nextPos,
                      results: [...s.results, decoded],
                    }))
                  );
                })
              )
          );
        }),
        Effect.flatMap((state) => {
          const finalLiteral = strings[strings.length - 1]!;
          return Effect.succeed(state).pipe(
            Effect.filterOrFail(
              (s) => input.startsWith(finalLiteral, s.pos),
              () =>
                new ExpectedLiteralError({
                  message: `Expected final "${finalLiteral}" at position ${state.pos}`,
                })
            ),
            Effect.map((s) => ({ ...s, pos: s.pos + finalLiteral.length })),
            Effect.filterOrFail(
              (s) => s.pos === input.length,
              (s) =>
                new ExpectedLiteralError({
                  message: `Unexpected trailing content ${JSON.stringify(
                    input.slice(s.pos)
                  )} at position ${s.pos}`,
                })
            ),
            Effect.map((s) => s.results as Readonly<OutTuple<Schemas>>)
          );
        })
      );
}

const matcher = typedString()`example/${Schema.NumberFromString}what&${Schema.NumberFromString}/end`;

const program = Effect.gen(function* () {
  const result = yield* matcher("example/4what&3/end");
  return result;
});

const main = program.pipe(
  Effect.catchTags({
    ExpectedLiteralError: (error: ExpectedLiteralError) =>
      Effect.succeed(error.message),
    CouldNotFindLiteralError: (error: CouldNotFindLiteralError) =>
      Effect.succeed(error.message),
    DecodeError: (error: DecodeError) =>
      Effect.succeed({ message: error.message, cause: error.cause }),
  }),
  Effect.tap(Console.log)
);

Effect.runPromise(main);
