const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(express.json())

let pairs = {} // { pairId: { creator, joiner, expire } }

function generatePairId() {
  return Math.random().toString(36).substring(2, 8)
}

function createPair(socket, deviceName) {
  const id = generatePairId()
  pairs[id] = {
    creator: { id: socket.id, name: deviceName },
    joiner: null,
    expire: Date.now() + 60000 // 60秒
  }

  setTimeout(() => {
    if (pairs[id] && !pairs[id].joiner) {
      delete pairs[id]
    }
  }, 60000)

  return id
}

io.on("connection", (socket) => {
  let deviceName = ""

  socket.on("set_name", (name) => {
    deviceName = name
  })

  socket.on("create_pair", () => {
    const id = createPair(socket, deviceName)
    socket.emit("pair_created", id)
  })

  socket.on("join_pair", (id) => {
    const pair = pairs[id]

    if (!pair) {
      socket.emit("error_msg", "無効または期限切れ")
      return
    }

    pair.joiner = { id: socket.id, name: deviceName }

    io.to(pair.creator.id).emit("pair_connected", pair.joiner.name)
    socket.emit("pair_connected", pair.creator.name)
  })

  socket.on("send_notification", (msg) => {
    for (const id in pairs) {
      const pair = pairs[id]

      if (pair.creator?.id === socket.id && pair.joiner) {
        io.to(pair.joiner.id).emit("notify", {
          from: pair.creator.name,
          msg
        })
      }

      if (pair.joiner?.id === socket.id && pair.creator) {
        io.to(pair.creator.id).emit("notify", {
          from: pair.joiner.name,
          msg
        })
      }
    }
  })
})

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>通知アプリ</title>
<style>
body { font-family: sans-serif; text-align:center; }
.box { margin-top:50px; }
input, button { padding:10px; margin:5px; }
.hidden { display:none; }
</style>
</head>
<body>

<div id="nameUI" class="box">
  <h2>デバイス名を入力</h2>
  <input id="nameInput" placeholder="例: iPhone">
  <button onclick="setName()">開始</button>
</div>

<div id="pairUI" class="box hidden">
  <h2>ペア接続</h2>
  <button onclick="createPair()">ペアID生成</button>
  <p id="pairId"></p>
  <input id="joinId" placeholder="ペアID入力">
  <button onclick="joinPair()">接続</button>
</div>

<div id="mainUI" class="box hidden">
  <h2 id="target"></h2>
  <input id="msg" placeholder="通知内容">
  <button onclick="sendNotify()">送信</button>
  <br><br>
  <button onclick="location.reload()">新しいデバイス追加</button>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io()

let myName = ""

function setName() {
  myName = document.getElementById("nameInput").value
  if (!myName) return
  socket.emit("set_name", myName)

  document.getElementById("nameUI").classList.add("hidden")
  document.getElementById("pairUI").classList.remove("hidden")
}

function createPair() {
  socket.emit("create_pair")
}

socket.on("pair_created", (id) => {
  document.getElementById("pairId").innerText = "ペアID: " + id + "（60秒有効）"
})

function joinPair() {
  const id = document.getElementById("joinId").value
  socket.emit("join_pair", id)
}

socket.on("pair_connected", (otherName) => {
  document.getElementById("pairUI").classList.add("hidden")
  document.getElementById("mainUI").classList.remove("hidden")
  document.getElementById("target").innerText = otherName + " のデバイスに通知を送信"
})

function sendNotify() {
  const msg = document.getElementById("msg").value
  socket.emit("send_notification", msg)
}

socket.on("notify", ({ from, msg }) => {
  if (Notification.permission === "granted") {
    new Notification(from + " から通知", { body: msg })
  }
})

if (Notification.permission !== "granted") {
  Notification.requestPermission()
}
</script>

</body>
</html>
`)
})

server.listen(3000, () => console.log("http://localhost:3000"))
