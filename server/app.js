const http = require("node:http");

// Create a local server to receive data from
const server = http.createServer();

const Headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

// Listen to the request event
server.on("request", (req, res) => {
  if (req.method == "OPTIONS") {
    res.writeHead(200, Headers);
    res.end();
    return;
  }
  let data = {};

  if (req.url == "/data") {
    data = {
      name: "john",
      age: 36,
      surplus: false,
    };
    res.writeHead(200, Headers);
    res.end(JSON.stringify(data));
  }

  if (req.url == "/post") {
    res.writeHead(200, Headers);
    res.end(JSON.stringify({ name: "nobody" }));
  }

  if (req.url == "/500") {
    res.writeHead(500, Headers);
    res.end();
    return;
  }
});

server.listen(8000, () => {
  console.log("Server Started at http://127.0.0.1:8000");
});
