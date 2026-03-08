declare module "@xenova/transformers" {
  export function pipeline(
    task: string,
    model: string,
    options?: Record<string, unknown>,
  ): Promise<
    (
      input: unknown,
      input2?: unknown,
      options?: Record<string, unknown>,
    ) => Promise<Array<{ label: string; score: number }>>
  >;
}
