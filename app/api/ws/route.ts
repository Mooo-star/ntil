import { WebSocketServer } from 'ws';
import { NextResponse } from 'next/server';

// 存储房间和用户信息
const rooms: { [key: string]: Set<WebSocket> } = {};

export async function GET(req: Request) {
  if (!global.wss) {
    const wss = new WebSocketServer({ noServer: true });
    global.wss = wss;

    wss.on('connection', (ws) => {
      let currentRoom: string | null = null;

      ws.on('message', (message) => {
        const data = JSON.parse(message.toString());

        switch (data.type) {
          case 'join':
            currentRoom = data.roomId;
            if (currentRoom) {
              if (!rooms[currentRoom]) {
                rooms[currentRoom] = new Set();
              }
              rooms[currentRoom].add(ws);

              // 通知房间内的其他用户
              rooms[currentRoom].forEach((client) => {
                if (client !== ws) {
                  client.send(JSON.stringify({
                    type: 'user-joined',
                    userId: ws.url
                  }));
                }
              });
            }
            break;

          case 'offer':
          case 'answer':
          case 'candidate':
            // 转发信令消息给目标用户
            if (currentRoom && rooms[currentRoom]) {
              rooms[currentRoom].forEach((client) => {
                if (client.url === data.target) {
                  client.send(JSON.stringify(data));
                }
              });
            }
            break;
        }
      });

      ws.on('close', () => {
        if (currentRoom && rooms[currentRoom]) {
          rooms[currentRoom].delete(ws);
          if (rooms[currentRoom].size === 0) {
            delete rooms[currentRoom];
          }
        }
      });
    });
  }

  const { socket: ws, response } = await global.wss.handleUpgrade(req);
  global.wss.emit('connection', ws);

  return response;
}

// 扩展全局类型
declare global {
  var wss: WebSocketServer | undefined;
} 