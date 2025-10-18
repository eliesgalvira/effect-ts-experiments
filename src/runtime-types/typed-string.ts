import { Console, Schema, Effect } from "effect";
import {
  ExpectedLiteralError,
  CouldNotFindLiteralError,
  DecodeError,
  DecodeErrors,
  MissingTemplateSliceError,
  SegmentTemplateError,
  TemplateAmbiguityError,
} from "./errors.ts";

/**
 * A Schema that decodes from a string input.
 *
 * @category Types
 */
type StringSchema = Schema.Schema<any, string, never>;

/**
 * Determines what part of a template segment is missing.
 *
 * @internal
 */
const getMissingSegmentPart = (
  literal: string | undefined,
  nextLiteral: string | undefined
): "literal" | "next" | "both" => {
  if (literal === undefined && nextLiteral === undefined) return "both";
  if (literal === undefined) return "literal";
  return "next";
};

/**
 * Internal representation of a template segment between two literals.
 * Each segment contains the leading literal, the schema to decode the dynamic part,
 * the next literal delimiter, and the segment index.
 *
 * @category Types
 */
interface TemplateSegment {
  readonly literal: string;
  readonly schema: StringSchema;
  readonly nextLiteral: string;
  readonly index: number;
}

/**
 * Creates a typed string matcher from a template literal with embedded schemas.
 *
 * **Details**
 *
 * This function enables runtime validation of strings against a template pattern
 * where placeholders are validated using Effect Schema. The template is defined
 * at compile-time using tagged template literals.
 *
 * The function performs validation in two phases:
 * 1. **Definition-time**: Validates the template structure (placeholder count, ambiguity)
 * 2. **Runtime**: Validates input strings against the template and decodes placeholders
 *
 * **Example**
 *
 * ```ts
 * import { Schema, Effect } from "effect"
 * import { typedString } from "./type-string"
 *
 * // Define a matcher for route patterns
 * const matcherEffect = typedString()`route/${Schema.NumberFromString}/end`
 *
 * const program = Effect.gen(function* () {
 *   const matcher = yield* matcherEffect
 *   const result = yield* matcher("route/42/end")
 *   return result // "route/42/end"
 * })
 * ```
 *
 * @returns A function that accepts a template literal with schemas and returns
 *          an Effect that produces a matcher function
 *
 * @category Constructors
 */
export function typedString() {
  return <const Schemas extends readonly StringSchema[]>(
      strings: TemplateStringsArray,
      ...schemas: Schemas
    ) => Effect.gen(function* () {
    // Definition-time checks
    if (schemas.length !== strings.length - 1) {
      return yield* Effect.fail(new CouldNotFindLiteralError({
        message: `Template placeholders mismatch: got ${schemas.length} schemas for ${strings.length} literals`,
      }));
    }

    // Build segments once and validate while building
    const segments: Array<TemplateSegment> = [];

    for (let i = 0; i < schemas.length; i++) {
      const literal = strings[i];
      const nextLiteral = strings[i + 1];
      if (literal === undefined || nextLiteral === undefined) {
        const missing = getMissingSegmentPart(literal, nextLiteral);
        return yield* Effect.fail(new SegmentTemplateError({ index: i, missing, message: `Segment ${i} is missing ${missing}` }));
      }
      if (i >= 1 && i < strings.length - 1 && strings[i] === "") {
        return yield* Effect.fail(new TemplateAmbiguityError({ index: i, message: `Ambiguous template: empty internal slice at index ${i}` }));
      }
      segments.push({
        literal,
        schema: schemas[i] as StringSchema,
        nextLiteral,
        index: i,
      });
    }

    return <CheckString extends string>(input: CheckString) =>
      Effect.gen(function* () {
        let currentPosition = 0;
        const decodeErrors: DecodeError[] = [];

        for (const segment of segments) {

          if (!input.startsWith(segment.literal, currentPosition)) {
            return yield* Effect.fail(
              new ExpectedLiteralError({
                message: `Expected "${segment.literal}" at position ${currentPosition}`,
              })
            );
          }
          currentPosition += segment.literal.length;
          const nextLiteralPosition = segment.nextLiteral
            ? input.indexOf(segment.nextLiteral, currentPosition)
            : input.length;
          if (nextLiteralPosition === -1) {
            return yield* Effect.fail(
              new CouldNotFindLiteralError({
                message: `Could not find "${segment.nextLiteral}" after position ${currentPosition}`,
              })
            );
          }

          const rawInputForPlaceholder = input.slice(currentPosition, nextLiteralPosition);
          yield* Schema.decodeUnknown(segment.schema)(rawInputForPlaceholder).pipe(
            Effect.catchTags({
              ParseError: (parseError) =>
                Effect.succeed(
                  decodeErrors.push(
                    new DecodeError({
                      index: segment.index,
                      raw: rawInputForPlaceholder,
                      cause: parseError,
                      message: `Failed to decode placeholder #${segment.index}`,
                    })
                  )
                )
            })
          );
          currentPosition = nextLiteralPosition;
        }

        const finalLiteral = strings[strings.length - 1];
        if (finalLiteral === undefined) {
          return yield* Effect.fail(
            new MissingTemplateSliceError({ index: strings.length - 1, which: "final", message: `Missing final literal` })
          );
        }
        if (!input.startsWith(finalLiteral, currentPosition)) {
          return yield* Effect.fail(
            new ExpectedLiteralError({
              message: `Expected final "${finalLiteral}" at position ${currentPosition}`,
            })
          );
        }
        currentPosition += finalLiteral.length;

        if (currentPosition !== input.length) {
          const trailingContent = input.slice(currentPosition);
          return yield* Effect.fail(
            new ExpectedLiteralError({
              message: `Unexpected trailing content ${JSON.stringify(trailingContent)} at position ${currentPosition}`,
            })
          );
        }

        if (decodeErrors.length > 0) {
          return yield* Effect.fail(
            new DecodeErrors({
              errors: decodeErrors,
              message: `${decodeErrors.length} placeholder(s) failed to decode`,
            })
          );
        }

        return input;
      });
  });
}

const typedStringCheckerEffect = typedString()`route/${Schema.NumberFromString}/end`;

const program = Effect.gen(function* () {
  const typedStringChecker = yield* typedStringCheckerEffect;
  const result = yield* typedStringChecker("route/3/end");
  return result;
});

const main = program.pipe(
  Effect.catchTags({
    ExpectedLiteralError: (error: ExpectedLiteralError) =>
      Effect.succeed(error.message),
    CouldNotFindLiteralError: (error: CouldNotFindLiteralError) =>
      Effect.succeed(error.message),
    DecodeErrors: (error: DecodeErrors) =>
      Effect.succeed({ message: error.message, errors: error.errors }),
    SegmentTemplateError: (error: SegmentTemplateError) =>
      Effect.succeed({ message: error.message, index: error.index, missing: error.missing }),
    TemplateAmbiguityError: (error: TemplateAmbiguityError) =>
      Effect.succeed({ message: error.message, index: error.index }),
    MissingTemplateSliceError: (error: MissingTemplateSliceError) =>
      Effect.succeed({ message: error.message, index: error.index, which: error.which }),
  } as const),
  Effect.tap(Console.log)
);

Effect.runPromise(main);
