import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Video,
  AlertTriangle,
  RotateCw,
  PhoneCall,
} from "lucide-react";
import { callService } from "../../services/call.service";
import { CallHistoryItem, CallType } from "../../types/call.types";
import { useAuthStore } from "../../../../stores/auth.store";
import { cn } from "../../../../lib/utils";

interface CallHistoryListProps {
  /** Hàm callback khi người dùng bấm nút gọi lại một đối tác */
  onCallPeer?: (peerId: string, type: CallType) => void;
  /** Lớp CSS tùy biến cho container */
  className?: string;
}

/**
 * Bộ định dạng thời gian chuẩn quốc tế được khởi tạo tĩnh ngoài hàm (js-hoist-intl)
 */
const callDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
});

/**
 * Định dạng thời gian sang chuỗi hiển thị Tiếng Việt
 */
function formatCallTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return callDateFormatter.format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Định dạng số giây sang phút:giây
 */
function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * Trích xuất ID và tên hiển thị từ đối tượng người dùng hoặc ID thô
 */
function extractUserInfo(
  userField: CallHistoryItem["callerId"]
): { id: string; name: string } {
  if (typeof userField === "string") {
    return { id: userField, name: "Người dùng" };
  }
  const id = userField._id || userField.id || "";
  const name = userField.displayName || userField.username || "Người dùng";
  return { id, name };
}

/**
 * Danh sách Lịch sử Cuộc gọi (CallHistoryList - Organism)
 * - Tích hợp React Query fetch REST GET /api/calls
 * - Đảm bảo đủ 4 trạng thái UI chuẩn frontend.md:
 *   1. Loading: Skeleton UI
 *   2. Empty: Icon + Thông báo + Nút kêu gọi hành động
 *   3. Error: Thông báo lỗi + Nút Thử lại (Retry)
 *   4. Success: Danh sách lịch sử cuộc gọi chi tiết
 */
export const CallHistoryList: React.FC<CallHistoryListProps> = ({
  onCallPeer,
  className,
}) => {
  const currentUserId = useAuthStore((state) => state.user?.id);

  const {
    data: calls,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["calls", "history"],
    queryFn: () => callService.getCallHistory({ page: 1, limit: 30 }),
    staleTime: 30000,
  });

  // 1. TRẠNG THÁI LOADING (Skeleton UI)
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Đang tải lịch sử cuộc gọi"
        className={cn("space-y-2.5 p-4", className)}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 bg-uupm-surface border-2 border-uupm-line rounded-xs animate-pulse"
          >
            <div className="w-10 h-10 rounded-xs bg-uupm-accent-soft shrink-0 border border-uupm-line" />
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="w-32 h-3.5 bg-uupm-ink/10 rounded-xs" />
              <div className="w-20 h-2.5 bg-uupm-ink-muted/15 rounded-xs" />
            </div>
            <div className="w-8 h-8 rounded-xs bg-uupm-ink/10 shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  // 2. TRẠNG THÁI ERROR (Lỗi tải dữ liệu)
  if (isError) {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col items-center justify-center p-8 text-center bg-uupm-surface border-2 border-uupm-line rounded-xs shadow-uupm-1 m-4",
          className
        )}
      >
        <div className="w-12 h-12 rounded-full bg-uupm-danger/10 text-uupm-danger-text flex items-center justify-center mb-3 border-2 border-uupm-danger">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-black text-uupm-ink mb-1">
          Không thể tải lịch sử cuộc gọi
        </h3>
        <p className="text-xs text-uupm-ink-soft mb-4 max-w-xs">
          {error instanceof Error ? error.message : "Đã xảy ra lỗi kết nối máy chủ"}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="px-4 py-2 min-h-[44px] rounded-xs bg-uupm-surface hover:bg-uupm-surface-hover border-2 border-uupm-line shadow-uupm-active flex items-center gap-2 text-xs font-black text-uupm-ink cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Thử lại</span>
        </button>
      </div>
    );
  }

  // 3. TRẠNG THÁI EMPTY (Chưa có cuộc gọi nào)
  if (!calls || calls.length === 0) {
    return (
      <div
        role="status"
        className={cn(
          "flex flex-col items-center justify-center p-8 text-center bg-uupm-surface border-2 border-uupm-line rounded-xs shadow-uupm-1 m-4",
          className
        )}
      >
        <div className="w-14 h-14 rounded-xs bg-uupm-accent-soft border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink mb-3">
          <PhoneCall className="w-7 h-7" />
        </div>
        <h3 className="text-sm font-black text-uupm-ink mb-1">
          Chưa có cuộc gọi nào
        </h3>
        <p className="text-xs font-semibold text-uupm-ink-muted mb-4 max-w-xs">
          Lịch sử các cuộc gọi thoại và video của bạn sẽ được lưu giữ tại đây.
        </p>
      </div>
    );
  }

  // 4. TRẠNG THÁI SUCCESS (Hiển thị danh sách cuộc gọi)
  return (
    <ul
      aria-label="Danh sách lịch sử cuộc gọi"
      className={cn("divide-y-2 divide-uupm-line p-2 list-none m-0", className)}
    >
      {calls.map((call) => {
        const caller = extractUserInfo(call.callerId);
        const callee = extractUserInfo(call.calleeId);
        const isOutgoing = caller.id === currentUserId;
        const partner = isOutgoing ? callee : caller;
        const isMissed = call.status === "missed";
        const isAnswered = call.status === "answered" || call.status === "ended";

        return (
          <li
            key={call._id}
            className="flex items-center justify-between gap-3 p-3 hover:bg-uupm-surface-hover transition-colors rounded-xs group"
          >
            {/* Khối Avatar & Chi tiết cuộc gọi */}
            <div className="flex items-center gap-3 min-w-0">
              {/* Icon biểu diễn hướng cuộc gọi và loại cuộc gọi */}
              <div
                className={cn(
                  "w-10 h-10 rounded-xs border-2 border-uupm-line shadow-uupm-active flex items-center justify-center shrink-0",
                  isMissed
                    ? "bg-uupm-danger/20 text-uupm-danger-text border-uupm-danger"
                    : "bg-uupm-surface text-uupm-ink"
                )}
              >
                {call.type === "video" ? (
                  <Video className="w-4 h-4" />
                ) : isMissed ? (
                  <PhoneMissed className="w-4 h-4" />
                ) : isOutgoing ? (
                  <PhoneOutgoing className="w-4 h-4 text-uupm-accent" />
                ) : (
                  <PhoneIncoming className="w-4 h-4 text-uupm-ink" />
                )}
              </div>

              {/* Tên đối tác và thông tin cuộc gọi */}
              <div className="min-w-0">
                <p className="text-xs font-black text-uupm-ink truncate">
                  {partner.name}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-uupm-ink-muted">
                  <span
                    className={cn(
                      isMissed && "text-uupm-danger-text font-black"
                    )}
                  >
                    {isMissed
                      ? isOutgoing
                        ? "Đối phương không trả lời"
                        : "Cuộc gọi nhỡ"
                      : isAnswered
                      ? `Thời lượng: ${formatDuration(call.durationSec)}`
                      : "Đã từ chối"}
                  </span>
                  <span>•</span>
                  <span>{formatCallTime(call.startedAt)}</span>
                </div>
              </div>
            </div>

            {/* Nút hành động gọi lại nhanh nếu đối tác có ID hợp lệ */}
            {onCallPeer && partner.id && partner.id !== currentUserId && (
              <button
                type="button"
                onClick={() => onCallPeer(partner.id, call.type)}
                aria-label={`Gọi lại cho ${partner.name}`}
                title={`Gọi lại cho ${partner.name}`}
                className="w-8 h-8 min-w-[32px] min-h-[32px] rounded-xs bg-uupm-surface hover:bg-uupm-accent hover:text-uupm-accent-text border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]"
              >
                {call.type === "video" ? (
                  <Video className="w-3.5 h-3.5" />
                ) : (
                  <Phone className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
};
