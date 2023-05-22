import {
  schema,
  parseDirectly,
  parseByDecorator,
  parseByDepartedProof,
} from "./json";

import { Get, Post } from "./fetch";

function g(id: string) {
  return document.getElementById(id);
}

function onClick(id: string, fn: () => void) {
  const el = document.getElementById(id);
  el?.addEventListener("click", fn);
}

onClick("parse_1", () => {
  g("parse_1_result")!.innerHTML = JSON.stringify(parseDirectly());
});

onClick("parse_2", () => {
  g("parse_2_result")!.innerHTML = JSON.stringify(parseByDecorator());
});

onClick("parse_3", () => {
  g("parse_3_result")!.innerHTML = JSON.stringify(
    parseByDepartedProof(schema)()
  );
});

onClick("parse_4", () => {
  g("parse_3_result")!.innerHTML = JSON.stringify(parseByDepartedProof());
});

onClick("ajax_1", async () => {
  const data = await Get("http://localhost:8000/data");
  g("ajax_1_result")!.innerHTML = JSON.stringify(data);
});

onClick("ajax_2", async () => {
  const data = await Get(schema)("http://localhost:8000/data");
  g("ajax_2_result")!.innerHTML = JSON.stringify(data);
});

onClick("ajax_3", async () => {
  const data = await Post("http://localhost:8000/post");
  g("ajax_3_result")!.innerHTML = JSON.stringify(data);
});

onClick("ajax_4", async () => {
  try {
    await Post(schema)("http://localhost:8000/post");
  } catch (e) {
    g("ajax_4_result")!.innerHTML = JSON.stringify(e, null, 2);
  }
});

onClick("ajax_500", async () => {
  const data = await Post(schema)("http://localhost:8000/500");
  g("ajax_500_result")!.innerHTML = JSON.stringify(data);
});
