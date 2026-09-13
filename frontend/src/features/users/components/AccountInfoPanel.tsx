import React from "react";
import { AtSign, Mail, Shield, CalendarDays, Lock } from "lucide-react";
import { User } from "../../../types/auth.types";

interface AccountInfoPanelProps {
  // Hồ sơ hiện tại lấy từ Auth Store; component chỉ đọc, không gọi API
  currentUser: User;
}

/**
 * Phân mục "Tài khoản" trong popup cài đặt người dùng.
 * Chỉ hiển thị các thông tin định danh mà backend KHÔNG cho phép sửa
 * (tên đăng nhập, email, vai trò, ngày tham gia) — tương tự cách Discord
 * tách "My Account" khỏi "Profile". Vì thuần trình bày nên không có
 * trạng thái loading/error; dữ liệu đã có sẵn trong Auth Store.
 */
export const AccountInfoPanel: React.FC<AccountInfoPanelProps> = ({ currentUser }) => {
  // createdAt là trường tùy chọn: chỉ hiển thị khi có giá trị VÀ parse được,
  // tránh render ra chuỗi "Invalid Date" khi backend không trả về ngày hợp lệ.
  const joinedAt = currentUser.createdAt ? new Date(currentUser.createdAt) : null;
  const joinedAtLabel =
    joinedAt && !Number.isNaN(joinedAt.getTime()) ? joinedAt.toLocaleDateString("vi-VN") : null;

  // Danh sách dòng thông tin. `locked` = có ổ khoá, người dùng không thể tự đổi.
  // Vai trò và ngày tham gia luôn có giá trị dự phòng nên không cần lọc bỏ.
  const rows: { icon: React.ReactNode; label: string; value: string; locked: boolean }[] = [
    {
      icon: <AtSign className="w-4 h-4" />,
      label: "Tên đăng nhập",
      value: `@${currentUser.username}`,
      locked: true,
    },
    {
      icon: <Mail className="w-4 h-4" />,
      label: "Địa chỉ Email",
      value: currentUser.email,
      locked: true,
    },
    {
      icon: <Shield className="w-4 h-4" />,
      label: "Vai trò",
      value: currentUser.role === "ADMIN" ? "Quản trị viên" : "Thành viên",
      locked: false,
    },
  ];

  // Chỉ thêm dòng ngày tham gia khi thực sự có dữ liệu hợp lệ
  if (joinedAtLabel) {
    rows.push({
      icon: <CalendarDays className="w-4 h-4" />,
      label: "Tham gia từ",
      value: joinedAtLabel,
      locked: false,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-black uppercase tracking-wide text-uupm-ink">Thông tin tài khoản</h4>
        <p className="mt-1 text-xs font-semibold text-uupm-ink-muted leading-relaxed">
          Thông tin định danh của tài khoản. Những mục có ổ khoá không thể thay đổi.
        </p>
      </div>

      {/* Danh sách mô tả dạng <dl>: mỗi dòng là một cặp nhãn - giá trị */}
      <dl className="bg-uupm-page border-2 border-uupm-line rounded-xs shadow-uupm-active divide-y-2 divide-uupm-line">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3 p-3">
            <div className="w-8 h-8 rounded-xs bg-uupm-accent-soft border-2 border-uupm-line flex items-center justify-center shrink-0 text-uupm-ink">
              {row.icon}
            </div>
            <div className="min-w-0 flex-1">
              <dt className="text-[11px] font-black uppercase tracking-wide text-uupm-ink-muted">
                {row.label}
              </dt>
              {/* break-all để email dài không đẩy vỡ bố cục trên màn hình hẹp */}
              <dd className="text-sm font-black text-uupm-ink break-all">{row.value}</dd>
            </div>
            {row.locked && (
              <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-uupm-ink-muted">
                <Lock className="w-3.5 h-3.5" />
                <span>Cố định</span>
              </span>
            )}
          </div>
        ))}
      </dl>

      <p className="text-[11px] font-semibold text-uupm-ink-muted leading-relaxed">
        Muốn đổi tên hiển thị, ảnh đại diện hay tiểu sử? Chuyển sang phân mục &quot;Hồ sơ của tôi&quot;.
      </p>
    </div>
  );
};
