import zod from "zod";

const raw_data = `
{
    "name": "john",
    "age": 36,
    "surplus": false
} 
`;

const schema = zod.object({
  name: zod.string(),
  age: zod.number(),
});

function jsonParse() {
  return JSON.parse(raw_data);
}

function parseDirectly() {
  return schema.parse(jsonParse());
}

function parseByDecorator() {
  const proxy = new Proxy(jsonParse as () => typeof schema, {
    apply(target: () => typeof schema, ctx: any, args: Array<any>) {
      const r = Reflect.apply(target, ctx, args);
      return schema.parse(r);
    },
  });
  return proxy();
}

function parseByDepartedProof(): any;
function parseByDepartedProof<
  T extends zod.ZodRawShape,
  U extends zod.UnknownKeysParam,
  C extends zod.ZodTypeAny,
  O
>(schema: zod.ZodObject<T, U, C, O>): () => O;
function parseByDepartedProof<T extends zod.ZodRawShape>(
  schema?: zod.ZodObject<T>
) {
  if (schema) {
    return () => {
      const r = jsonParse();
      return schema.parse(r);
    };
  } else {
    return jsonParse();
  }
}

export { schema, parseDirectly, parseByDecorator, parseByDepartedProof };
