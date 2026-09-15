import React from "react";
import { MessageSquare, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "../../../components/ui/Button";

interface WelcomeScreenProps {
  onStartNewChat: () => void;
}

/**
 * Màn hình chào mừng khi chưa chọn cuộc trò chuyện nào (Cột 2 rỗng).
 * Tách khỏi ChatLayout để giảm độ dài hàm và tách biệt UI tĩnh (rule no-giant-component).
 */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStartNewChat }) => (
  <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-uupm-page select-none">
    <div className="w-16 h-16 rounded-xs bg-uupm-accent border-2 border-uupm-line shadow-uupm-2 flex items-center justify-center mb-4">
      <MessageSquare className="w-8 h-8 text-uupm-ink" />
    </div>

    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xs bg-uupm-accent-soft border-2 border-uupm-line shadow-uupm-active text-xs font-black uppercase text-uupm-accent-text mb-2">
      <Sparkles className="w-3.5 h-3.5" />
      <span>Discord-Style Workspace</span>
    </div>

    <h2 className="text-xl md:text-2xl font-black text-uupm-ink tracking-tight">
      Chào mừng bạn đến với AppMessaging!
    </h2>
    <p className="text-xs md:text-sm font-semibold text-uupm-ink-muted mt-2 max-w-sm">
      Chọn một người bạn từ danh sách bên trái hoặc nhấn nút bên dưới để bắt đầu gửi tin nhắn bảo mật thời gian thực.
    </p>

    <Button
      type="button"
      variant="primary"
      size="md"
      onClick={onStartNewChat}
      className="mt-6"
    >
      Bắt Đầu Cuộc Trò Chuyện Mới
    </Button>

    <div className="mt-8 flex items-center gap-2 text-uupm-ink-muted text-xs font-bold">
      <ShieldCheck className="w-4 h-4 text-uupm-accent" />
      <span>Bảo mật kết nối Socket.IO & Access Token trong RAM</span>
    </div>
  </div>
);
