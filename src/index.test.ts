import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "../test/node.ts";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
