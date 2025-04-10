"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [wsStatus, setWsStatus] = useState("disconnected");

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000/api/ws");

    ws.onopen = () => {
      console.log("WebSocket connected");
      setWsStatus("connected");

      // 测试加入房间
      ws.send(
        JSON.stringify({
          type: "join",
          roomId: "test-room",
          userId: "test-user",
        })
      );
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setWsStatus("disconnected");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setWsStatus("error");
    };

    ws.onmessage = (event) => {
      console.log("Received message:", event.data);
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">WebSocket Test</h1>
        <div className="mb-4">
          Status:{" "}
          <span
            className={
              wsStatus === "connected" ? "text-green-500" : "text-red-500"
            }
          >
            {wsStatus}
          </span>
        </div>
      </div>
    </main>
  );
}
