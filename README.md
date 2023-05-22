# TypeScript 运行时类型检查

**关键字**: `技术方案`,`JavaScript`,`运行时类型校验`

### 摘要

TypeScript Web 前端

运行时类型检查，JavaScript

1. 运行时的类型校验
1. 与 TypeScript 集成
1. 推荐使用 zod[^1]

### 对比

常用类型库对比

| 库       | Version | Github Star | 开始日期 | TypeScript |
| -------- | ------- | ----------- | -------- | ---------- |
| zod      |         |             |          | 4.5+       |
| io-ts    |         |             |          |            |
| joi[^]   |         |             |          |            |
| yup      |         |             |          |            |
| RunTypes |         |             |          |            |
| ow       |         |             |          |            |

benchmark 对比[^2]

###

### 网络

### 与 TypeScript 集成

编译时类型检查 TypeScript 与 运行时类型检查结合，达到如虎添翼的效果。

三种集成方法

| 集成方法 | 集成难度 | 可选检查与不检查 |
| -------- | -------- | ---------------- |
| 直接调用 | 低       | 不可选           |
| 装饰器   | 中       | 不可选           |
| 幽灵类型 | 中       | 可选             |

下面分别展示三种 TypeScript 集成的方法，三种方法使用相同的数据源和数据模型

```typescript
import { z } from "zod";
const schema = z.object({ name: z.string(), age: z.number() });
const RawData = `{"name": "zoro", "age": 21}`;
```

##### 直接调用方式

```typescript
const unknown: unknown = JSON.parse(RawData);
const data = schema.parse(unknown);
```

##### 装饰器方式

```typescript
function typeValidate(target: any){

}

@typeValidate(schema)
function parse(s: string) {
  return JSON.parse(s);
}

const data = parse(RawData)
```

##### 幽灵类型方式

```typescript
function parse(raw: string): unknown;
function parse<R>(raw: string, schema: any): R;
function parse<R>(raw: string, schema?: any) {
  const data = JSON.parse(raw);
  return schema ? schema.parse(data) : data;
}
type SchemaType = z.infer<typeof schema>;
const untypedData: unknown = parse(RawData);
const typedData: SchemaType = parse(RawData, schema);
```

### 雷池社区

Zod 在雷池社区版[^7] 中的应用


---

王德龙

[^8]: https://blog.logrocket.com/methods-for-typescript-runtime-type-checking/

[^1]: https://zod.dev/
[^2]: https://joi.dev/api/?v=17.9.1
[^3]: https://joi.dev/api/?v=17.9.1
[^4]: https://moltar.github.io/typescript-runtime-type-benchmarks/
[^9]: https://kataskeue.com/gdp.pdf
[^7]: https://github.com/chaitin/safeline