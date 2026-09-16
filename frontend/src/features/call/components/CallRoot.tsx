import React from "react";
import { CallProvider } from "../hooks/CallProvider";

export interface CallRootProps {
  /** Các thành phần con được bọc bởi CallProvider */
  children: React.ReactNode;
}

/**
 * Thành phần gốc khởi tạo hệ thống cuộc gọi (CallRoot)
 * - Tách khối logic mount CallProvider khỏi App.tsx để đáp ứng Size-Gate
 * - Chuyển tiếp children vào CallProvider để duy trì trạng thái cuộc gọi toàn cục
 */
export const CallRoot: React.FC<CallRootProps> = ({ children }) => {
  return <CallProvider>{children}</CallProvider>;
};
