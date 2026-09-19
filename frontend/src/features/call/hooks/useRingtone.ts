/**
 * Hook phát nhạc chuông cuộc gọi bằng Web Audio API (không cần file mp3).
 *
 * Kích hoạt:
 *  - enable=true: tạo OscillatorNode phát chuông 2 giây mỗi 4 giây (chu kỳ ring-ring im)
 *  - enable=false: dừng phát và dọn dẹp AudioContext
 *
 * Trả về AudioContext (null nếu chưa khởi tạo) để caller có thể gọi resume()
 * trong event handler của user gesture (browser autoplay policy).
 */

import { useEffect, useRef, useState, useCallback } from "react";

export function useRingtone(enable: boolean): AudioContext | null {
  // Giữ AudioContext duy nhất xuyên suốt vòng đời hook (không tạo mới mỗi render)
  const ctxRef = useRef<AudioContext | null>(null);
  // Lưu interval id để clearInterval đúng khi cleanup
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Trả ra ngoài để caller gọi resume() trong user gesture
  const [ctx, setCtx] = useState<AudioContext | null>(null);

  /**
   * Phát một hồi chuông ngắn (~1.8s) bằng 2 OscillatorNode tần số khác nhau
   * mô phỏng nhạc chuông điện thoại tiêu chuẩn.
   */
  const playRing = useCallback(() => {
    const audioCtx = ctxRef.current;
    if (!audioCtx || audioCtx.state === "closed") return;

    // Resume nếu bị suspended (browser autoplay policy)
    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    // Tần số nốt nhạc chuông: 440Hz (A4) + 480Hz tạo hợp âm 2 tần số
    const frequencies = [440, 480];
    const gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);

    // Fade-in 0.05s → giữ 1.5s → fade-out 0.25s
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05);
    gainNode.gain.setValueAtTime(0.15, now + 1.5);
    gainNode.gain.linearRampToValueAtTime(0, now + 1.8);

    frequencies.forEach((freq) => {
      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 1.8);
    });
  }, []);

  useEffect(() => {
    if (!enable) {
      // Dừng chuông: xóa interval và đóng AudioContext
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (ctxRef.current && ctxRef.current.state !== "closed") {
        void ctxRef.current.close();
        ctxRef.current = null;
        setCtx(null);
      }
      return;
    }

    // Tạo AudioContext mới khi bắt đầu đổ chuông
    const audioCtx = new AudioContext();
    ctxRef.current = audioCtx;
    setCtx(audioCtx);

    // Phát hồi chuông đầu tiên ngay lập tức
    playRing();

    // Lặp lại mỗi 4 giây (2s ring + 2s im)
    intervalRef.current = setInterval(playRing, 4000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (audioCtx.state !== "closed") {
        void audioCtx.close();
      }
      ctxRef.current = null;
      setCtx(null);
    };
  }, [enable, playRing]);

  return ctx;
}
