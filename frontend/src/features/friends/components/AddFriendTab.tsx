import React, { useState } from "react";
import { UserPlus, Search, Loader2, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { useFriendStore } from "../stores/friend.store";
import { userService } from "../../users/services/user.service";
import { User } from "../../../types/auth.types";
import { Button } from "../../../components/ui/Button";

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

/**
 * Màn hình Thêm Bạn bè theo phong cách Discord
 */
export const AddFriendTab: React.FC = () => {
  const { sendFriendRequest } = useFriendStore();

  const [inputVal, setInputVal] = useState("");
  const [noteVal, setNoteVal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<User[] | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  /**
   * Xử lý gửi lời mời kết bạn theo ID hoặc tìm kiếm theo username
   */
  const handleAddFriend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = inputVal.trim();
    if (!query) return;

    setIsLoading(true);
    setFeedback(null);
    setSearchResults(null);

    try {
      // 1. Nếu là MongoDB ObjectId (24 hex), gửi thẳng tới ID đó
      if (OBJECT_ID_REGEX.test(query)) {
        await sendFriendRequest(query, noteVal.trim() || undefined);
        setFeedback({
          type: "success",
          message: `Đã gửi lời mời kết bạn tới ID ${query} thành công!`,
        });
        setInputVal("");
        setNoteVal("");
        return;
      }

      // 2. Nếu là username hoặc tên, tìm kiếm người dùng tương ứng
      const cleanQuery = query.startsWith("@") ? query.slice(1) : query;
      const users = await userService.searchUsers(cleanQuery);

      if (users.length === 0) {
        setFeedback({
          type: "error",
          message: `Không tìm thấy người dùng nào khớp với "${query}". Vui lòng kiểm tra lại chính tả hoặc ID.`,
        });
        return;
      }

      // Nếu chỉ có đúng 1 kết quả khớp chính xác username, gửi ngay
      const exactMatch = users.find(
        (u) => u.username.toLowerCase() === cleanQuery.toLowerCase()
      );

      if (exactMatch) {
        await sendFriendRequest(exactMatch.id, noteVal.trim() || undefined);
        setFeedback({
          type: "success",
          message: `Đã gửi lời mời kết bạn tới @${exactMatch.username} (${exactMatch.displayName}) thành công!`,
        });
        setInputVal("");
        setNoteVal("");
      } else {
        // Hiển thị danh sách kết quả tìm được để người dùng chọn
        setSearchResults(users);
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Không thể gửi lời mời kết bạn. Vui lòng thử lại.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Gửi lời mời tới một người dùng cụ thể từ danh sách kết quả tìm kiếm
   */
  const handleSendToUser = async (user: User) => {
    setIsLoading(true);
    try {
      await sendFriendRequest(user.id, noteVal.trim() || undefined);
      setFeedback({
        type: "success",
        message: `Đã gửi lời mời kết bạn tới @${user.username} thành công!`,
      });
      setSearchResults((prev) => prev?.filter((u) => u.id !== user.id) || null);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Không thể gửi lời mời kết bạn.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      {/* Tiêu đề và hướng dẫn */}
      <div className="border-b border-uupm-line/20 pb-5">
        <h2 className="text-base font-black uppercase tracking-wider text-uupm-ink flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-uupm-accent" />
          <span>Thêm Bạn Bè</span>
        </h2>
        <p className="text-xs text-uupm-ink-muted mt-1 font-medium">
          Bạn có thể thêm bạn bè bằng Tên người dùng (username) hoặc ID tài khoản.
        </p>
      </div>

      {/* Form nhập liệu gửi lời mời */}
      <form onSubmit={handleAddFriend} className="mt-5 space-y-4">
        <div>
          <label htmlFor="friend-input" className="block text-xs font-black uppercase tracking-wider text-uupm-ink mb-2">
            Tên người dùng hoặc ID
          </label>
          <div className="relative flex items-center bg-uupm-page border-2 border-uupm-line rounded-xs focus-within:border-uupm-accent transition-colors shadow-uupm-active p-2">
            <Search className="w-4 h-4 text-uupm-ink-muted ml-1 shrink-0" />
            <input
              id="friend-input"
              type="text"
              value={inputVal}
              onChange={(e) => {
                setInputVal(e.target.value);
                if (feedback) setFeedback(null);
              }}
              placeholder="Nhập username (ví dụ: alex hoặc @alex) hoặc ID..."
              className="w-full bg-transparent outline-none text-sm text-uupm-ink font-bold placeholder:text-uupm-ink-muted px-2.5"
              autoComplete="off"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isLoading || !inputVal.trim()}
              className="shrink-0 text-xs font-black"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Gửi lời mời"
              )}
            </Button>
          </div>
        </div>

        {/* Lời nhắn tùy chọn kèm lời mời */}
        <div>
          <label htmlFor="note-input" className="block text-xs font-black uppercase tracking-wider text-uupm-ink-muted mb-1.5">
            Lời nhắn kèm theo (Tùy chọn)
          </label>
          <input
            id="note-input"
            type="text"
            value={noteVal}
            onChange={(e) => setNoteVal(e.target.value)}
            placeholder="Chào bạn, mình kết bạn nhé!"
            maxLength={200}
            className="w-full bg-uupm-page border-2 border-uupm-line rounded-xs text-xs text-uupm-ink font-medium p-2.5 outline-none focus:border-uupm-accent shadow-uupm-active placeholder:text-uupm-ink-muted"
          />
        </div>
      </form>

      {/* Thông báo kết quả trực tiếp */}
      {feedback && (
        <div
          className={`mt-4 p-3 rounded-xs border-2 flex items-start gap-2.5 text-xs font-bold ${
            feedback.type === "success"
              ? "bg-uupm-accent/10 border-uupm-accent text-uupm-accent-text"
              : "bg-uupm-danger/10 border-uupm-danger text-uupm-danger-text"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-uupm-accent mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-uupm-danger-text mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Danh sách kết quả tìm kiếm nếu có nhiều người dùng khớp */}
      {searchResults && searchResults.length > 0 && (
        <div className="mt-6 border-2 border-uupm-line rounded-xs bg-uupm-surface p-4 shadow-uupm-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-uupm-ink mb-3">
            Người dùng tìm thấy ({searchResults.length})
          </h3>
          <div className="space-y-2">
            {searchResults.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-2.5 rounded-xs border border-uupm-line/20 hover:bg-uupm-surface-hover transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 w-9 h-9 rounded-full border-2 border-uupm-line overflow-hidden bg-uupm-page flex items-center justify-center font-black text-uupm-ink">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={`Avatar của ${user.displayName}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{(user.displayName || user.username).slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-uupm-ink truncate">
                      {user.displayName}
                    </p>
                    <p className="text-[11px] text-uupm-ink-muted font-bold truncate">
                      @{user.username}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => handleSendToUser(user)}
                  disabled={isLoading}
                  className="text-xs font-black shrink-0 px-3 py-1 min-h-[34px]"
                  leftIcon={<Send className="w-3 h-3" />}
                >
                  Kết bạn
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
