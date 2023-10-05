const express = require('express')
const app = express()
const port = 3000

const http = require('http')
const server = http.createServer(app)

const { Server } = require('socket.io')
const io = new Server(server, { pingInterval: 2000, pingTimeOut: 5000 })

app.use(express.static('public'))

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html')
})

const backEndplayers = {}
const backEndProjectiles = {}
const RADIUS = 10
const PROJECTILE_RADIUS = 5
let projectileId = 0

io.on('connection', (socket) => {
  // either with send()

  io.emit('updatePlayers', backEndplayers)

  socket.on('shoot', ({ x, y, angle }) => {
    projectileId++

    const velocity = {
      x: Math.cos(angle) * 5,
      y: Math.sin(angle) * 5
    }

    backEndProjectiles[projectileId] = {
      x,
      y,
      velocity,
      playerId: socket.id
    }
  })

  socket.on('disconnect', (reason) => {
    console.log(reason)
    delete backEndplayers[socket.id]
    io.emit('updatePlayers', backEndplayers)
  })

  socket.on('initGame', ({ username, width, height }) => {
    backEndplayers[socket.id] = {
      x: 1024 * Math.random(),
      y: 576 * Math.random(),
      color: `hsl(${360 * Math.random()}, 100%, 50%)`,
      sequenceNumber: 0,
      score: 0,
      username
    }

    //'init Canvas'
    backEndplayers[socket.id].canvas = {
      width,
      height
    }

    backEndplayers[socket.id].radius = RADIUS
  })

  const SPEED = 5
  socket.on('keydown', ({ keycode, sequenceNumber }) => {
    const backEndplayer = backEndplayers[socket.id]

    if (!backEndplayers[socket.id]) return

    backEndplayers[socket.id].sequenceNumber = sequenceNumber
    switch (keycode) {
      case 'KeyW':
        backEndplayers[socket.id].y -= SPEED

        break
      case 'KeyA':
        backEndplayers[socket.id].x -= SPEED

        break
      case 'KeyS':
        backEndplayers[socket.id].y += SPEED

        break
      case 'KeyD':
        backEndplayers[socket.id].x += SPEED

        break
    }

    const playerSides = {
      left: backEndplayer.x - backEndplayer.radius,
      right: backEndplayer.x + backEndplayer.radius,
      top: backEndplayer.y - backEndplayer.radius,
      bottom: backEndplayer.y + backEndplayer.radius
    }

    if (playerSides.left < 0) backEndplayers[socket.id].x = backEndplayer.radius

    if (playerSides.right > 1024)
      backEndplayers[socket.id].x = 1024 - backEndplayer.radius

    if (playerSides.top < 0) backEndplayers[socket.id].y = backEndplayer.radius

    if (playerSides.bottom > 576)
      backEndplayers[socket.id].y = 576 - backEndplayer.radius
  })
})

// backend ticker
setInterval(() => {
  //update projectile positions
  for (const id in backEndProjectiles) {
    backEndProjectiles[id].x += backEndProjectiles[id].velocity.x
    backEndProjectiles[id].y += backEndProjectiles[id].velocity.y

    const PROJECTILE_RADIUS = 5
    if (
      backEndProjectiles[id].x - PROJECTILE_RADIUS >=
        backEndplayers[backEndProjectiles[id].playerId]?.canvas?.width ||
      backEndProjectiles[id].x - PROJECTILE_RADIUS <= 0 ||
      backEndProjectiles[id].y - PROJECTILE_RADIUS >=
        backEndplayers[backEndProjectiles[id].playerId]?.canvas?.height ||
      backEndProjectiles[id].y - PROJECTILE_RADIUS <= 0
    ) {
      delete backEndProjectiles[id]
      continue
    }

    for (const playerId in backEndplayers) {
      const backEndPlayer = backEndplayers[playerId]

      const DISTANCE = Math.hypot(
        backEndProjectiles[id].x - backEndPlayer.x,
        backEndProjectiles[id].y - backEndPlayer.y
      )

      //collision Detection
      if (
        DISTANCE < PROJECTILE_RADIUS + backEndPlayer.radius &&
        backEndProjectiles[id].playerId !== playerId
      ) {
        if (backEndplayers[backEndProjectiles[id].playerId])
          backEndplayers[backEndProjectiles[id].playerId].score++

        delete backEndProjectiles[id]
        delete backEndplayers[playerId]
        break
      }
    }
  }

  io.emit('updateProjectiles', backEndProjectiles)
  io.emit('updatePlayers', backEndplayers)
}, 15)

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
