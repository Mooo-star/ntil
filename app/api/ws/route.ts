import { WebSocketServer, WebSocket } from 'ws';
import { NextResponse } from 'next/server';
import { IncomingMessage } from 'http';

// 存储房间和用户信息
const rooms: { [key: string]: Set<WebSocket> } = {};

// 确保 WebSocket 服务器只初始化一次
if (!global.wss) {
  const wss = new WebSocketServer({ noServer: true });
  global.wss = wss;

  wss.on('connection', (ws: WebSocket) => {
    let currentRoom: string | null = null;

    ws.on('message', (message) => {
      try {
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
                    userId: data.userId || 'unknown'
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
                if (client !== ws) {
                  client.send(JSON.stringify(data));
                }
              });
            }
            break;
        }
      } catch (error) {
        console.error('Error processing message:', error);
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

export async function GET(req: Request) {
  if (!global.wss) {
    return new NextResponse('WebSocket server not initialized', { status: 500 });
  }

  // 将 Request 转换为 IncomingMessage
  const incomingMessage = req as unknown as IncomingMessage;

  return new Promise<NextResponse>((resolve) => {
    global.wss!.handleUpgrade(
      incomingMessage,
      incomingMessage.socket,
      Buffer.alloc(0),
      (ws) => {
        global.wss!.emit('connection', ws);
        resolve(new NextResponse());
      }
    );
  });
}

// 扩展全局类型
declare global {
  var wss: WebSocketServer | undefined;
} 