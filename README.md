# TypeScript 与运行时类型检查实践

**关键字**: `技术方案`, `TypeScript`, `Runtime 类型安全`

### 摘要

TypeScript 的出现大大提高了 JavaScript 项目在编译期的类型安全，基于 `JavaScript with syntax for types.` 的设计原则。实际上 TypeScript 仅在编译期间生效，编译期间完全移除了类型相关的内容，编译结果是纯粹的 JavaScript。一旦编译完成，TypeScript 就无法为程序提供任何的类型保护，既不会检查非法输入，也不会校验 API 结果。因此在若想保证运行时的类型正确就需要额外的方法。本文基于雷池社区[^1]的项目实践，总结了如何利用 zod[^2] + TypeScript 的组合，来同时实现编译时与运行时的类型安全校验能力。

### 项目背景

雷池社区项目是基于雷池引擎打造的免费版 WAF（Web Application Firewall）。作为网络安全类产品，稳定性是项目质量 重要指标，本文记录了部分 web 前端在工程和工具方面进行的尝试。

首先，分析可以从哪几个方面来提升 Web 前端的工程质量：

- [x] 强类型编码，即使用 TypeScript 作为开发语言来实现编译期间的强类型检查，雷池社区项目也采用了这种主流方式；
- [x] 运行时类型校验，程序运行过程中检查动态数据是否符合程序要求，主要用于检查数据正确性，减少未捕获的运行时异常；
- [ ] 单元测试，单个组件测试，仅测试独立方法的正确性，但无法验证最终用户使用结果；
- [ ] E2E 测试，整体测试，模拟终端用户的使用，测试效果最好，对测试环境要求也最高。

分析后选择从 **运行时校验** 入手。运行时校验的内容就是运行时遇到的变量或多样性，这种多样性主要来自 3 个方面：

- [x] 运行环境校验，包括浏览器版本、操作系统、少数硬件能力或限制；
- [ ] 用户输入校验，用户输入表单、交互操作或控制；
- [x] API 接口数据校验，从服务器中获取到的不同的用户数据。

首先是运行环境校验（或浏览器兼容性）通过提示包括浏览器版本过低[^3]等问题，来提前规避可能出现的兼容性问题。然后是用户输入校验，因为雷池社区版并没有太多用户输入内容，因此在用户输入校验和接口数据校验两者之间，选择接口数据校验作为运行时类型安全的切入点。接口数据校验指的是，web 端对通过 API 接口获取到的数据进行格式和类型的校验，来保证得到的是预期的正确数据。举例来说，配置自定义规则时，通过 `GET /Rules` 接口获取数据详情，然后 web 端将规则数据匹配进一个复杂表单，如果接口数据格式不正确，那么则会出现 `Uncached Exception`，产生未捕获的运行时异常。结果轻则页面毫无变化，重则显示白屏无法操作。如果能够将数据产生的错误提前发现，并进行提示，虽然不能自动纠错，但可以快速定位问题，这样也实实在在的减少异常问题定位的工作量。

### 运行时类型校验的原理

运行时类型校验针对的是运行过程中的数据的类型检查，因为在编译阶段已经通过 TypeScript 对代码逻辑进行了类型检查，所以运行只要校验运行环境中的数据类型。校验的原理是 "断言"，下面通过例子来说明运行时的类型判断方法：

**目标**：判断数据是一个 int32 整数，否则抛出异常。

```js
// 为了模拟运行时，这里采用了 JavaScript 而非 TS
// 这里仅做原理介绍，实际项目中有不同的实现
function int32(x) {
  if (
    x &&
    !isNaN(x) &&
    typeof x == "number" &&
    x % 1 == 0 &&
    x > -2147483648 &&
    x < 2147483647
  ) {
    return x;
  }
  throw Error(`${x} is not a int32 number`);
}

let t = 123;
try {
  const x = int32(n);
  // TODO: 确认数据在合法范围内，可以继续用于业务当中
} catch (e) {
  // TODO: 处理异常
}
```

因为项目是采用 TypeScript 编写的，因此运行时类型检查方法也要同时支持 TypeScript，根据这两条要求对来筛选对比可用工具：

1. type guard[^4]
1. 运行时的类型校验

**备注**：

即使采用了 TypeScript ，也不能完全保证编译期间的类型安全。在 TypeScript 中存在一个特殊的类型 `any`，其含义与 golang 中 `interface{}` 或 Java 中的 `Any` 类似，表示变量能够匹配为“任意类型”。这里不展开讨论，可以将它理解为，不方便直接表述类型，但是确定的、非常有把握的符合类型要求的数据格式。

##### 选择工具库

开源社区中支持类型检查的库有多种，并且从不同的角度出发，制定了解决方案，下面列出了 star 比较高的几种。

| 工具  | 官网                            | Version | Github Star |
| ----- | ------------------------------- | ------- | ----------- |
| zod   | https://zod.dev/                | 3.21    | 22.8k       |
| yup   | https://github.com/jquense/yup/ | 1.2     | 20.5k       |
| joi   | https://joi.dev/                | 17.9    | 20k         |
| io-ts | https://gcanti.github.io/io-ts/ | 2.2     | 6.3k        |

虽然在 web 前端项目中性能并不重要，这里还是附带了一个喜闻乐见的性能对比 benchmark [^5]。

对于如何选择工具库，并没有固定标准，可能取决于开发者对“味道”的选择，雷池社区项目最终选择了 **Zod**。这里需要补充一点个人看法，不推荐使用 io-ts ，虽然它的名气较大，但风格太严谨，文档也不友好，编写很麻烦，如果不习惯 FP 的编码风格，那么不推荐使用 io-ts。

### 如何与 TypeScript 集成

在雷池社区的项目的方案调研中，一共设计了 3 种集成方式进行对比筛选

| 集成方法 | 集成难度 | 强制运行时类型检查 |
| -------- | -------- | ------------------ |
| 直接调用 | 低       | 强制               |
| 装饰器   | 中       | 强制               |
| 多态函数 | 中       | 可选               |

为了说明集成方法，使用下面同一份的数据源和数据模型定义，来分别展示三种集成的方法。

```ts
// 引用 zod 库
import { z } from "zod";
// 定义 schema，是一个 json 对象
const schema = z.object({
  name: z.string(),
  age: z.number(),
});
// 原始数据，通过 JSON.parse 解析为 JSON 对象
const RawData = `{"name": "zoro", "age": 21}`;
```

##### 直接调用方式

定义好 schema 之后，在需要进行校验的地方，执行一次校验动作。

- 优点：用法简单，便于推广，很容解释使用原理。
- 缺点：引入额外的与业务逻辑无关的代码，需要开发者单独添加，容易遗漏，不好维护。

```ts
const unknown: unknown = JSON.parse(RawData);
const data = schema.parse(unknown);
```

##### 装饰器方式

使用 TypeScript 5.0 版本中的新特性，给 parse 方法添加装饰方法来实现 schema 的解析。

- 优点：使用标准的设计模式，通过改造统一入口的 `parse` 转换方法。
- 缺点：TypeScript 对装饰器还处于实验性支持阶段，并且仅支持 class 方法的装饰器方法[^6]。

```ts
function validate(schema: z.ZodObject<any>) {
  return function (target: any, propertyKey: string) {
    const origin = target[propertyKey];
    target[propertyKey] = async function () {
      const r = await origin();
      return schema.parse(r);
    };
  };
}

class API {
  @validate(schema)
  async getUserDetail() {
    return new Promise((r) => r(JSON.parse(RawData)));
  }
}

const data = await new API().getUserDetail();
```

##### 多态函数方式

这种方式的设计灵感来自一种函数式编程的类型校验方式[^7]，通过在多态参数，实现方法的不同执行过程，接收了 schema 参数的方法，会使用 schema 对返回结果进行校验，如果没有 schema 参数，则不校验。

- 优点：在不影响原有业务逻辑的前提下，可以进行运行时类型校验，也可以选择不校验。
- 缺点：代码实现较为复杂，需要通过 TypeScript 的泛型来实现返回值类型自动匹配。

```ts
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

在集成方式的选择上，本着 **Developer First** 的思路，最终选择选择了第三种：多态函数方式。

### 雷池社区如何使用

雷池社区的项目实践中，基于现有代码进行改造，主要分为三步

1. 新建 API 请求基础方法，支持多态函数方式校验接口数据类型；
1. 为不同的接口返回值定义类型；
1. 逐步替换原有 API 调用方法，并根据具体情况在调用接口时选择是否进行类型校验。

下面进行逐步的详细解析。

##### 重构 API 请求方法

在创建新的 API 请求的基础方法时，没有采用项目中原有的 axios 库，转而使用内置的 fetch 方法[^8][^9]，这样更容易操作网络请求的底层参数。具体方式是新建 `fetch.ts` 文件，编写 `Fetch` 方法。这是发起网络请求的基础方法，一般不会直接在业务代码中使用，需要再次抽象为层级更高的方法。

```ts
// Fetch 方法的声明
type SearchParams = Record<string, string | number | null | undefined> | null;

interface FetchOptions {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | string;
  params?: SearchParams | null;
  data?: any;
}

function Fetch(props: FetchOptions, init?: RequestInit): Promise<Response>;
```

有了基础的 Ajax 方法后，根据 API 接口的标准格式再次进行封装。雷池社区的后端接口采用了 RESTful 的风格，这是最常见的接口风格。RESTful 的接口根据 HTTP Method 不同，有两种参数传递方式：url 参数或 body 参数。不同的传递方法需要配置不同参数，虽然尝试使用同一个方法实现不同的参数传递，但效果不佳，要么难以实现，要么使用不便。因此针对这两种参数传递方式，包装了 2 个新方法：

1. `fetchWithParams`，用在传递 url 参数的方法中。
1. `fetchWithData`，用在传递 body 参数的方法中。

在实现类型校验的同时，最关键的功能是：**自动的接口返回值的 TS 类型**。这是编译器类型检查和运行时类型检查能够结合的关键步骤。以 `fetchWithParams` 方法为例：

```ts
/* 
自动识别接口返回值的实现，需要利用 zod 库的泛型，
虽然看起来参数比较多，关键泛型是 “O”，指代返回类型 Output
*/
function fetchWithParams(method: string) {
  function withParams(
    url: string,
    params?: SearchParams,
    init?: RequestInit
  ): Promise<any>;
  function withParams<
    T extends zod.ZodRawShape,
    U extends zod.UnknownKeysParam,
    C extends zod.ZodTypeAny,
    O
  >(
    schema: zod.ZodObject<T, U, C, O>
  ): (url: string, params?: SearchParams, init?: RequestInit) => Promise<O>;
  function withParams<T extends zod.ZodRawShape>(
    pathOrSchema: string | zod.ZodObject<T>,
    params?: SearchParams,
    init?: RequestInit
  ) {
    if (isString(pathOrSchema)) {
      return Fetch({ method, url: pathOrSchema, params }, init);
    } else {
      return function (
        url: string,
        params: SearchParams = {},
        init?: RequestInit
      ) {
        return Fetch({ method, url, params }, init).then(pathOrSchema.parse);
      };
    }
  }
  return withParams;
}
```

`fetchWithData` 方法类似，只是调用 Fetch 方法的参数不同，这里不再赘述。到这一步虽然已经实现了返回值类型的自动识别，但业务代码用起来还不够方便，因此根据 RESTful 接口的 method 不同，再进行一次接口包装。

```ts
const Get = fetchWithParams("GET");
const Post = fetchWithData("POST");
const Put = fetchWithData("PUT");
const Delete = fetchWithData("DELETE");
// 根据具体接口要求，可以增加其他方法
```

到这里我们就实现了 4 种主要的接口调用方法。同时处理个别特殊情况（文件上传、非标准返回结构等），还单独定义了一个 `Request` 方法，可以灵活配置全部参数

```ts
function Request(props: FetchOptions, init?: RequestInit): Promise<any>;
function Request<
  T extends zod.ZodRawShape,
  U extends zod.UnknownKeysParam,
  C extends zod.ZodTypeAny,
  O
>(
  schema: zod.ZodObject<T, U, C, O>
): (props: FetchOptions, init?: RequestInit) => Promise<O>;
function Request<T extends zod.ZodRawShape>(
  propsOrSchema: FetchOptions | zod.ZodObject<T>,
  init?: RequestInit
) {
  if (propsOrSchema.constructor.name == "Object") {
    return Fetch(propsOrSchema as FetchOptions, init);
  } else {
    return function (props: FetchOptions, init?: RequestInit) {
      return Fetch(props, init).then((propsOrSchema as zod.ZodObject<T>).parse);
    };
  }
}
```

最后，export 可用方法，支持运行时类型校验的 API 就完成了。

```ts
export { Request, Get, Post, Put, Delete };
```

##### 定义 schema 类型

有了支持类型检查的接口以后，还要为每个接口定义自己的 `schema` 模型。这一步定义是必不可少的，虽然从服务的全栈结构来看，服务端已经定义过了接口类型，而前端再定义一次是重复工作量。但实际上 API 接口作为客户端与服务端的分界线，它的解耦能力既实现了服务的独立，也导致了类型的丢失。

> 当然也有前后端使用同一套类型定义的设计方案，但不同方案都有自己的使用场景。本文只讨论前端独立完成运行时类型校验的场景。并且，前后端共享类型方案只能解决接口调用层面的类型一致，而本文讨论的目标是前端的整个生命周期的运行时类型校验：包含 API 调用、用户输入、运行环境这三方面的数据。

下面是接口调用的例子

```ts
import { Get, Post, Put, Delete } from "./fetch";
import z from "zod";

export { getIPGroupList, createIPGroup };

function getIPGroupList() {
  // 定义 schema，规定返回类型的
  const schema = z.object({
    total: z.number(),
    data: z.array(
      z.object({
        id: z.number(),
        comment: z.string(),
        ips: z.array(z.string()),
      })
    ),
  });
  // 返回值校验的用法是：先用 schema 作为参数调用一次 Get 方法
  return Get(schema)("IPGroup");
}

async function createIPGroup(data: { comment: string; ips: string[] }) {
  // 不需要校验返回值时，可以直接调用方法
  await Post("IPGroup", data);
}
```

首先定义 `schema`，如何定义 schema 的细节可以参考 zod 文档[^2]。可以确定的是 Zod 定义的 `schema` 对数据格式的控制粒度比 TypeScript 更细致，更灵活，足够满足各种业务需求。

> **注意**： 例子中的 `schema` 的根类型只能定义为 `z.object` 类型，这是因为 `fetchWithParams` 方法中 schema 参数被定义为 `zod.ZodObject<T, U, C, O>` 类型。这是与具体业务深度绑定的，在不同项目中需要注意修改为对应的根类型，但为了使用方便，推荐使用 ZodObject 作为根类型。

##### 异常处理

对于接口数据格式异常的处理，是新接口与老接口最大的区别。当 API 返回非预期数据格式时，如果不进行校验，直接使用。那么会产生不确定行为，大部分是数据展示异常，少部分会导致 "未捕获异常"。<i style="color: red"> Uncaught SyntaxError: xxx</i>。

未捕获异常造成的影响不能准确估计，就像你无法准确估计哪里会出 bug。而且无法提前处理，或者反过来说，因为没能提前处理，所以才叫做 "未捕获异常"。采用运行时类型校验后，当 API 返回非预期数据格式时，会在 API 层直接抛出异常，并且会描述具体哪个字段的数据不符合 `schema` 约束。这时的业务逻辑尚未接收到数据，虽然此时的异常依然无法纠正，但是可以给出准确提示：xxx 接口数据异常。

### 总结

运行时类型校验可以有效保障 JavaScript 项目在运行过程的稳定性，并在运行数据异常时及时抛出异常并说明原因。使用对 TypeScript 友好的运行时类型检测库，可以同时得编译和运行这两个阶段的类型检查功能。如果需要在复杂客户端环境的情况下，保障前端项目运行时得到稳定，那么推荐在项目中使用类型检查库，并且要根据项目特点，来选择具体的集成方式。在雷池社区项目的调研当中，总结的三种方法各有利弊，如果想要集成简单，可以选择第一种方法“直接调用”，如果是功能固定，可以选择第二种方法“装饰器”，比较灵活的是第三种“多态函数”，请开发者们理性选择。

---

王德龙

[^1]: https://github.com/chaitin/safeline
[^2]: https://zod.dev/
[^3]: https://browser-update.org/zh/
[^4]: https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates
[^5]: https://moltar.github.io/typescript-runtime-type-benchmarks/
[^6]: https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/#decorators
[^7]: https://kataskeue.com/gdp.pdf
[^8]: https://developer.mozilla.org/zh-CN/docs/Web/API/Fetch_API/Using_Fetch
[^9]: https://caniuse.com/?search=fetch

<!-- [^10]: https://blog.logrocket.com/methods-for-typescript-runtime-type-checking/-->
