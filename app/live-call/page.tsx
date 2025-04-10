"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import dynamic from "next/dynamic";

// 使用 dynamic import 来禁用 SSR
const VideoCallComponent = dynamic(() => Promise.resolve(VideoCall), {
  ssr: false,
});

export default function LiveCall() {
  return <VideoCallComponent />;
}

function VideoCall() {
  // 状态管理
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [roomId, setRoomId] = useState("");
  const [remoteStreams, setRemoteStreams] = useState<{
    [key: string]: MediaStream;
  }>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // 引用
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<{ [key: string]: RTCPeerConnection }>({});

  // 确保在客户端执行
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 初始化媒体设备
  useEffect(() => {
    if (!isClient) return;

    const setupMedia = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    };

    setupMedia();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isClient]);

  // 创建 RTCPeerConnection
  const createPeerConnection = (userId: string) => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // 添加本地流到连接
    if (stream) {
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });
    }

    // 处理远程流
    peerConnection.ontrack = (event) => {
      setRemoteStreams((prev) => ({
        ...prev,
        [userId]: event.streams[0],
      }));
    };

    // 处理 ICE 候选
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        wsRef.current?.send(
          JSON.stringify({
            type: "candidate",
            candidate: event.candidate,
            target: userId,
          })
        );
      }
    };

    return peerConnection;
  };

  // 加入房间
  const joinRoom = () => {
    if (!roomId || !isClient) return;

    // 使用相对路径连接到 WebSocket
    const ws = new WebSocket(`ws://${window.location.host}/api/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "join",
          roomId,
        })
      );
      setIsConnected(true);
    };

    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case "user-joined":
          const peerConnection = createPeerConnection(message.userId);
          peerConnectionsRef.current[message.userId] = peerConnection;

          // 创建并发送 offer
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          ws.send(
            JSON.stringify({
              type: "offer",
              offer,
              target: message.userId,
            })
          );
          break;

        case "offer":
          const peerConnection2 = createPeerConnection(message.userId);
          peerConnectionsRef.current[message.userId] = peerConnection2;

          await peerConnection2.setRemoteDescription(
            new RTCSessionDescription(message.offer)
          );
          const answer = await peerConnection2.createAnswer();
          await peerConnection2.setLocalDescription(answer);
          ws.send(
            JSON.stringify({
              type: "answer",
              answer,
              target: message.userId,
            })
          );
          break;

        case "answer":
          const pc = peerConnectionsRef.current[message.userId];
          if (pc) {
            await pc.setRemoteDescription(
              new RTCSessionDescription(message.answer)
            );
          }
          break;

        case "candidate":
          const pc2 = peerConnectionsRef.current[message.userId];
          if (pc2) {
            await pc2.addIceCandidate(new RTCIceCandidate(message.candidate));
          }
          break;
      }
    };
  };

  // 切换摄像头状态
  const toggleCamera = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  // 切换麦克风状态
  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  if (!isClient) {
    return null; // 在服务器端渲染时不显示任何内容
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      {!isConnected ? (
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4">加入视频通话</h2>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="roomId">房间号</Label>
              <Input
                id="roomId"
                value={roomId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setRoomId(e.target.value)
                }
                placeholder="输入房间号"
              />
            </div>
            <Button className="w-full" onClick={joinRoom}>
              加入房间
            </Button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 本地视频 */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="relative aspect-video bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex justify-center gap-4 p-4 bg-gray-50">
                <Button
                  variant={isCameraOn ? "default" : "destructive"}
                  size="icon"
                  onClick={toggleCamera}
                >
                  {isCameraOn ? (
                    <Video className="h-5 w-5" />
                  ) : (
                    <VideoOff className="h-5 w-5" />
                  )}
                </Button>
                <Button
                  variant={isMicOn ? "default" : "destructive"}
                  size="icon"
                  onClick={toggleMic}
                >
                  {isMicOn ? (
                    <Mic className="h-5 w-5" />
                  ) : (
                    <MicOff className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>

            {/* 远程视频列表 */}
            {Object.entries(remoteStreams).map(([userId, remoteStream]) => (
              <div
                key={userId}
                className="bg-white rounded-lg shadow-lg overflow-hidden"
              >
                <div className="relative aspect-video bg-black">
                  <video
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                    ref={(video) => {
                      if (video) video.srcObject = remoteStream;
                    }}
                  />
                </div>
                <div className="p-4 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>用户 {userId}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
