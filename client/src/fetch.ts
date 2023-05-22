import zod from "zod";

export { Request, Get, Post, Put, Delete };

const Config = {
  base: "",
};

type PluginType = {
  name: string;
  fn: (value: any) => any;
};

const Plugins: Array<PluginType> = [
  {
    name: "5xx",
    fn(res: Response) {
      if (res.status >= 500) {
        alert("5xx");
        throw Error(res.statusText);
      }
      return res;
    },
  },
  {
    name: "json parse",
    fn(res: Response) {
      return res.json();
    },
  },
];

type SearchParams = Record<string, string | number | null | undefined>;

interface FetchOptions {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | string;
  params?: SearchParams | null;
  data?: any;
  processors?: Array<string>;
  excludeProcessors?: Array<string>;
}

function isNull(x: any): x is null {
  return x === null;
}

function isUndefined(x: any): x is undefined {
  return typeof x == "undefined";
}

function isString(x: any): x is string {
  return typeof x == "string";
}

async function Fetch(props: FetchOptions, init?: RequestInit) {
  const { url, method, params, data, processors, excludeProcessors } = props;

  const sp = new URLSearchParams();
  for (const k in params) {
    const v = params[k];
    if (isNull(v)) continue;
    if (isUndefined(v)) continue;
    if (Array.isArray(v) && v.length == 0) continue;
    sp.append(k, v.toString());
  }

  let uri = url + sp.toString();

  let Base = Config.base;
  if (Base.endsWith("/")) Base = Base.slice(0, Base.length);

  const slash =
    url.startsWith("/") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
      ? ""
      : "/";
  uri = Base + slash + uri;

  let r = await fetch(uri, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : null,
    ...init,
  });

  for (const plugin of Plugins) {
    if (processors && !processors.includes(plugin.name)) continue;
    if (excludeProcessors && excludeProcessors.includes(plugin.name)) continue;
    r = await plugin.fn(r);
  }
  return r;
}

function Request(props: FetchOptions, init?: RequestInit): Promise<any>;
function Request<
  T extends zod.ZodRawShape,
  U extends zod.UnknownKeysParam,
  C extends zod.ZodTypeAny,
  O
>(
  schema: zod.ZodObject<T, U, C, O>,
  props: FetchOptions,
  init?: RequestInit
): Promise<O>;
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

function Get(url: string, params?: SearchParams): Promise<any>;
function Get<
  T extends zod.ZodRawShape,
  U extends zod.UnknownKeysParam,
  C extends zod.ZodTypeAny,
  O
>(
  schema: zod.ZodObject<T, U, C, O>
): (url: string, params?: SearchParams) => Promise<O>;
function Get<T extends zod.ZodRawShape>(
  pathOrSchema: string | zod.ZodObject<T>,
  params?: SearchParams
) {
  if (isString(pathOrSchema)) {
    return Fetch({ method: "GET", url: pathOrSchema, params });
  } else {
    return function (url: string, params: SearchParams = {}) {
      return Fetch({ method: "GET", url, params }).then(pathOrSchema.parse);
    };
  }
}

// 发送带 data 的方法
function fetchWithData(method: string) {
  function WithData(url: string, data?: object): Promise<any>;
  function WithData<R extends zod.ZodRawShape>(
    schema: zod.ZodObject<R>
  ): (url: string, data?: object) => Promise<R>;
  function WithData<R extends zod.ZodRawShape>(
    pathOrSchema: string | zod.ZodObject<R>,
    data?: object
  ) {
    if (isString(pathOrSchema)) {
      return Fetch({ method, url: pathOrSchema, data });
    } else {
      return function (url: string, data?: object) {
        return Fetch({ method, url, data }).then(pathOrSchema.parse);
      };
    }
  }

  return WithData;
}

const Post = fetchWithData("POST");
const Put = fetchWithData("PUT");
const Delete = fetchWithData("DELETE");
