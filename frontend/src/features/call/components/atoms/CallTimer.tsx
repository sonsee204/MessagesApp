import React, { useState, useEffect } from "react";
import { cn } from "../../../../lib/utils";

interface CallTimerProps {
  /** Cờ trạng thái cuộc gọi đang diễn ra (true để bắt đầu đếm thời gian, false để reset) */
  active: boolean;
  /** Lớp CSS bổ sung nếu cần tùy biến giao diện */
  className?: string;
}

/**
 * Hàm hỗ trợ định dạng số giây sang chuỗi hiển thị mm:ss hoặc hh:mm:ss
 */
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (num: number) => num.toString().padStart(2, "0");

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Component hiển thị thời lượng cuộc gọi (CallTimer - Atom)
 * - Tự động đếm giây khi cuộc gọi chuyển sang trạng thái active
 * - Reset về 00:00 khi cuộc gọi kết thúc hoặc chưa bắt đầu
 * - Hỗ trợ trợ năng với aria-live="polite"
 */
export const CallTimer: React.FC<CallTimerProps> = ({ active, className }) => {
  const [seconds, setSeconds] = useState<number>(0);

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }

    const intervalId = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [active]);

  return (
    <span
      role="timer"
      aria-live="polite"
      className={cn(
        "font-mono font-bold text-sm tracking-wider tabular-nums select-none",
        className
      )}
    >
      {formatDuration(seconds)}
    </span>
  );
};
