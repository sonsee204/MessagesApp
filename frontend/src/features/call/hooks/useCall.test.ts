import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCall } from "./useCall";
import * as socketModule from "@/lib/socket";

/**
 * Lớp giả lập một luồng MediaTrack (Micro hoặc Camera)
 */
class MockMediaStreamTrack {
  kind: string;
  enabled = true;
  stop = vi.fn();

  constructor(kind: "audio" | "video") {
    this.kind = kind;
  }
}

/**
 * Lớp giả lập MediaStream cung cấp các audio/video tracks
 */
class MockMediaStream {
  tracks: MockMediaStreamTrack[] = [];

  constructor(hasAudio = true, hasVideo = false) {
    if (hasAudio) {
      this.tracks.push(new MockMediaStreamTrack("audio"));
    }
    if (hasVideo) {
      this.tracks.push(new MockMediaStreamTrack("video"));
    }
  }

  getTracks(): MockMediaStreamTrack[] {
    return this.tracks;
  }

  getAudioTracks(): MockMediaStreamTrack[] {
    return this.tracks.filter((t) => t.kind === "audio");
  }

  getVideoTracks(): MockMediaStreamTrack[] {
    return this.tracks.filter((t) => t.kind === "video");
  }

  addTrack(track: MockMediaStreamTrack): void {
    this.tracks.push(track);
  }
}

/**
 * Lớp giả lập RTCSessionDescription
 */
class MockRTCSessionDescription {
  type: RTCSdpType;
  sdp: string;

  constructor(descriptionInitDict: RTCSessionDescriptionInit) {
    this.type = descriptionInitDict.type;
    this.sdp = descriptionInitDict.sdp ?? "";
  }
}

/**
 * Lớp giả lập RTCIceCandidate
 */
class MockRTCIceCandidate {
  candidate: string;

  constructor(candidateInitDict?: RTCIceCandidateInit) {
    this.candidate = candidateInitDict?.candidate ?? "";
  }

  toJSON(): { candidate: string } {
    return { candidate: this.candidate };
  }
}

/**
 * Lớp giả lập RTCPeerConnection phục vụ kiểm thử đơn vị
 */
class MockRTCPeerConnection {
  iceConnectionState: RTCIceConnectionState = "new";
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  onicecandidate: ((ev: RTCPeerConnectionIceEvent) => void) | null = null;
  ontrack: ((ev: RTCTrackEvent) => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;

  addTrack = vi.fn((track: MediaStreamTrack, ...streams: MediaStream[]) => ({
    track,
    streams,
  }));
  createOffer = vi.fn(async () => ({ type: "offer" as const, sdp: "mock-offer-sdp" }));
  createAnswer = vi.fn(async () => ({ type: "answer" as const, sdp: "mock-answer-sdp" }));
  setLocalDescription = vi.fn(async (desc: RTCSessionDescriptionInit) => {
    this.localDescription = desc;
  });
  setRemoteDescription = vi.fn(async (desc: RTCSessionDescriptionInit) => {
    this.remoteDescription = desc;
  });
  addIceCandidate = vi.fn(async () => {});
  close = vi.fn();
}

/**
 * Bộ tạo đối tượng Socket giả lập có lưu trữ danh sách event listeners
 */
function createMockSocket() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  return {
    emit: vi.fn(),
    on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    }),
    off: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((cb) => cb !== callback);
      }
    }),
    // Hàm trigger phục vụ kiểm thử: bắn sự kiện từ Socket Server về Client
    trigger(event: string, payload?: unknown) {
      if (listeners[event]) {
        listeners[event].forEach((cb) => cb(payload));
      }
    },
  };
}

describe("useCall Hook - WebRTC & Socket.IO Signaling", () => {
  let mockSocket: ReturnType<typeof createMockSocket>;
  let createdStreams: MockMediaStream[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    createdStreams = [];

    // Cài đặt WebRTC globals trong môi trường jsdom
    (global as unknown as { RTCPeerConnection: typeof MockRTCPeerConnection }).RTCPeerConnection =
      MockRTCPeerConnection;
    (global as unknown as { RTCSessionDescription: typeof MockRTCSessionDescription }).RTCSessionDescription =
      MockRTCSessionDescription;
    (global as unknown as { RTCIceCandidate: typeof MockRTCIceCandidate }).RTCIceCandidate =
      MockRTCIceCandidate;
    (global as unknown as { MediaStream: typeof MockMediaStream }).MediaStream = MockMediaStream;

    // Giả lập navigator.mediaDevices.getUserMedia
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn(async ({ audio, video }: { audio?: boolean; video?: boolean }) => {
          const stream = new MockMediaStream(Boolean(audio), Boolean(video));
          createdStreams.push(stream);
          return stream;
        }),
      },
      configurable: true,
      writable: true,
    });

    // Giả lập getSocket trả về mockSocket
    mockSocket = createMockSocket();
    vi.spyOn(socketModule, "getSocket").mockReturnValue(
      mockSocket as unknown as ReturnType<typeof socketModule.getSocket>
    );
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("1. Người gọi (Caller) initiateCall -> cập nhật trạng thái dialing và phát call:initiate", async () => {
    const { result } = renderHook(() => useCall());

    await act(async () => {
      await result.current.initiateCall("user-target-123", "audio");
    });

    expect(result.current.state.status).toBe("dialing");
    expect(result.current.state.calleeId).toBe("user-target-123");
    expect(result.current.state.type).toBe("audio");
    expect(result.current.state.localStream).toBeDefined();
    expect(mockSocket.emit).toHaveBeenCalledWith("call:initiate", {
      calleeId: "user-target-123",
      type: "audio",
    });
  });

  it("2. Ring timeout 30s phía Caller -> tự động hủy cuộc gọi, phát call:cancel và đổi status thành missed", async () => {
    const { result } = renderHook(() => useCall());

    await act(async () => {
      await result.current.initiateCall("user-target-456", "audio");
    });

    expect(result.current.state.status).toBe("dialing");

    // Tua nhanh đồng hồ 30 giây để kích hoạt timeout đổ chuông
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    expect(mockSocket.emit).toHaveBeenCalledWith("call:cancel", { callId: "" });
    expect(result.current.state.status).toBe("missed");
    expect(result.current.state.localStream).toBeNull();
  });

  it("3. Caller nhận call:accepted -> chuyển status sang connecting và gửi SDP offer", async () => {
    const { result } = renderHook(() => useCall());

    await act(async () => {
      await result.current.initiateCall("user-callee-789", "video");
    });

    // Server phản hồi call:accepted
    await act(async () => {
      mockSocket.trigger("call:accepted", { callId: "call-xyz-100" });
    });

    expect(result.current.state.status).toBe("connecting");
    expect(result.current.state.callId).toBe("call-xyz-100");
    expect(mockSocket.emit).toHaveBeenCalledWith("call:offer", {
      callId: "call-xyz-100",
      sdp: { type: "offer", sdp: "mock-offer-sdp" },
    });
  });

  it("4. Nhận call:ended -> giải phóng và dừng toàn bộ media tracks", async () => {
    const { result } = renderHook(() => useCall());

    await act(async () => {
      await result.current.initiateCall("user-callee-999", "audio");
    });

    const activeTrack = createdStreams[0]?.getTracks()[0];
    expect(activeTrack).toBeDefined();

    // Server báo cuộc gọi kết thúc
    await act(async () => {
      mockSocket.trigger("call:ended", { callId: "call-xyz-100" });
    });

    expect(result.current.state.status).toBe("ended");
    expect(result.current.state.localStream).toBeNull();
    expect(activeTrack?.stop).toHaveBeenCalled();
  });

  it("5. Người nhận (Callee) nhận call:incoming -> chuyển sang trạng thái ringing", async () => {
    const { result } = renderHook(() => useCall());

    await act(async () => {
      mockSocket.trigger("call:incoming", {
        callId: "incoming-call-555",
        callerId: "user-caller-111",
        callerName: "Nguyễn Văn A",
        type: "video",
      });
    });

    expect(result.current.state.status).toBe("ringing");
    expect(result.current.state.callId).toBe("incoming-call-555");
    expect(result.current.state.callerId).toBe("user-caller-111");
    expect(result.current.state.callerName).toBe("Nguyễn Văn A");
    expect(result.current.state.type).toBe("video");
  });
});
