import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User as UserIcon, Save, Trash2, Quote, MessageSquareQuote, ShieldAlert } from "lucide-react";
import { updateProfileSchema, UpdateProfileFormValues } from "../schemas/user.schema";
import { userService } from "../services/user.service";
import { useAuthStore } from "../../../stores/auth.store";
import { useImageUpload } from "../hooks/useImageUpload";
import { toast } from "../../../stores/toast.store";
import { formatApiError } from "../../../lib/error-formatter";
import { User } from "../../../types/auth.types";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { ProfileBanner } from "./ProfileBanner";
import { ImageUploadButton } from "./ImageUploadButton";

interface UserProfileFormProps {
  // Hồ sơ hiện tại đang nằm trong Auth Store; truyền xuống để đổ dữ liệu ban đầu cho form
  currentUser: User;
}

/**
 * Phân mục "Hồ sơ của tôi" trong popup cài đặt người dùng.
 * Chỉ chịu trách nhiệm render form và gọi service; sau khi lưu thành công sẽ đẩy
 * kết quả mới vào Auth Store để sidebar cập nhật avatar/tên ngay lập tức (không cần tải lại).
 */
export const UserProfileForm: React.FC<UserProfileFormProps> = ({ currentUser }) => {
  const setUser = useAuthStore((state) => state.setUser);
  const [serverError, setServerError] = useState<string | null>(null);

  // Hook tải ảnh đại diện: lo phần gọi API và đồng bộ store
  const { upload: uploadAvatar, isUploading: isUploadingAvatar } = useImageUpload("avatar");
  // Hook tải ảnh bìa
  const { upload: uploadBanner, isUploading: isUploadingBanner } = useImageUpload("banner");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    mode: "onTouched",
    defaultValues: {
      displayName: currentUser.displayName || "",
      // Backend trả về null khi chưa có avatar; form dùng chuỗi rỗng cho ô nhập liệu
      avatarUrl: currentUser.avatarUrl || "",
      bannerUrl: currentUser.bannerUrl || "",
      bio: currentUser.bio || "",
      statusMessage: currentUser.statusMessage || "",
    },
  });

  // Đồng bộ lại giá trị form khi currentUser thay đổi
  useEffect(() => {
    reset({
      displayName: currentUser.displayName || "",
      avatarUrl: currentUser.avatarUrl || "",
      bannerUrl: currentUser.bannerUrl || "",
      bio: currentUser.bio || "",
      statusMessage: currentUser.statusMessage || "",
    });
  }, [currentUser, reset]);

  // Theo dõi URL avatar để hiển thị ảnh xem trước theo thời gian thực
  const avatarUrlValue = watch("avatarUrl");
  const displayNameValue = watch("displayName");
  const statusMessageValue = watch("statusMessage") || "";
  const bioValue = watch("bio") || "";

  // Gửi thay đổi hồ sơ lên máy chủ
  const onSubmit = async (values: UpdateProfileFormValues) => {
    try {
      setServerError(null);

      const updated = await userService.updateProfile({
        displayName: values.displayName,
        // Chuỗi rỗng nghĩa là người dùng muốn xoá avatar -> gửi null đúng như backend mong đợi
        avatarUrl: values.avatarUrl === "" ? null : values.avatarUrl,
        // Ảnh bìa do nút "Xoá" hoặc lần upload gần nhất quyết định, không có ô nhập tay
        bannerUrl: values.bannerUrl === "" ? null : values.bannerUrl,
        bio: values.bio,
        statusMessage: values.statusMessage,
      });

      // Đồng bộ ngay vào store để mọi nơi dùng currentUser đều thấy dữ liệu mới
      setUser(updated);
      // Đánh dấu form đã sạch
      reset(values);
      toast.success("Đã lưu thay đổi hồ sơ của bạn.", "Cập nhật hồ sơ");
    } catch (error: unknown) {
      const message = formatApiError(error, "Không thể cập nhật hồ sơ. Vui lòng thử lại.");
      setServerError(message);
      toast.error(message, "Cập nhật thất bại");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left" noValidate>
      {/* Ảnh bìa lưu ngay khi tải lên, nhưng vẫn register ẩn để giữ nguyên giá trị
          khi người dùng bấm "Lưu thay đổi" (nếu không sẽ bị ghi đè thành undefined). */}
      <input type="hidden" {...register("bannerUrl")} />

      {/* Khối nhận diện: ảnh bìa + ảnh đại diện lớn + tên + dòng trạng thái */}
      <ProfileBanner
        currentUser={currentUser}
        isUploading={isUploadingBanner}
        onBannerSelected={async (file) => {
          // Ảnh bìa lưu ngay khi chọn (độc lập với việc sửa các trường chữ),
          // nhưng vẫn phải đồng bộ URL mới vào form để lần lưu sau không ghi đè.
          const updated = await uploadBanner(file);
          if (updated) setValue("bannerUrl", updated.bannerUrl || "", { shouldDirty: true, shouldValidate: true });
        }}
        onBannerCleared={() => setValue("bannerUrl", "", { shouldDirty: true, shouldValidate: true })}
      />

      {/* Hộp thông báo lỗi từ máy chủ */}
      {serverError && (
        <div
          role="alert"
          className="p-3 rounded-xs bg-uupm-danger/10 border-2 border-uupm-danger text-uupm-danger-text flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1"
        >
          <ShieldAlert className="w-4 h-4 shrink-0 text-uupm-danger-text mt-0.5" />
          <div className="text-xs font-bold leading-relaxed">{serverError}</div>
        </div>
      )}

      {/* Nhóm Danh tính: các trường người khác nhìn thấy khi trò chuyện */}
      <div className="space-y-4">
        <h4 className="text-sm font-black uppercase tracking-wide text-uupm-ink">Danh tính</h4>

        <Input
          label="Tên hiển thị"
          placeholder="vd: Nguyễn Văn An"
          helperText="Tên bạn bè nhìn thấy trong các cuộc trò chuyện"
          leftIcon={<UserIcon className="w-4 h-4" />}
          error={errors.displayName?.message}
          disabled={isSubmitting}
          required
          {...register("displayName")}
        />

        <div>
          <Input
            label="Dòng trạng thái"
            placeholder="vd: Đang tập trung làm việc"
            helperText="Tối đa 100 ký tự, để trống nếu không muốn hiển thị"
            leftIcon={<MessageSquareQuote className="w-4 h-4" />}
            error={errors.statusMessage?.message}
            disabled={isSubmitting}
            {...register("statusMessage")}
          />
          {statusMessageValue.length > 0 && (
            <p
              className={`mt-1.5 text-[11px] font-bold ${
                statusMessageValue.length > 100 ? "text-uupm-danger-text" : "text-uupm-ink-muted"
              }`}
            >
              {statusMessageValue.length}/100 ký tự
            </p>
          )}
        </div>

        {/* Ảnh đại diện: tải tệp thật lên máy chủ (đã có endpoint upload) */}
        <div className="w-full">
          <input type="hidden" {...register("avatarUrl")} />
          <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-uupm-ink">
            Ảnh đại diện
          </span>
          <div className="flex items-center gap-3 p-3 bg-uupm-page border-2 border-uupm-line rounded-xs shadow-uupm-active">
            <div className="w-10 h-10 rounded-xs bg-uupm-accent-soft border-2 border-uupm-line flex items-center justify-center shrink-0 overflow-hidden">
              {avatarUrlValue ? (
                <img src={avatarUrlValue} alt="Ảnh đại diện hiện tại" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-5 h-5 text-uupm-ink" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-uupm-ink">
                {avatarUrlValue ? "Đang dùng ảnh tùy chỉnh" : "Đang dùng ảnh mặc định"}
              </p>
              <p id="profile-avatar-helper" className="text-[11px] font-semibold text-uupm-ink-muted mt-0.5">
                JPG, PNG hoặc WEBP, tối đa 5MB
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <ImageUploadButton
                label="Đổi ảnh"
                ariaLabel="Tải lên ảnh đại diện mới"
                isUploading={isUploadingAvatar}
                disabled={isSubmitting}
                onFileSelected={async (file) => {
                  // Ảnh xem trước đọc từ watch("avatarUrl") — state của form, KHÔNG phải
                  // prop currentUser. Nên phải setValue để ảnh hiện ngay, đồng thời giữ
                  // đúng giá trị cho lần bấm "Lưu thay đổi" kế tiếp.
                  const updated = await uploadAvatar(file);
                  if (updated) setValue("avatarUrl", updated.avatarUrl || "", { shouldDirty: true, shouldValidate: true });
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                aria-describedby="profile-avatar-helper"
                disabled={isSubmitting || isUploadingAvatar || !avatarUrlValue}
                aria-disabled={isSubmitting || isUploadingAvatar || !avatarUrlValue}
                onClick={() => setValue("avatarUrl", "", { shouldDirty: true, shouldValidate: true })}
              >
                Xoá
              </Button>
            </div>
          </div>
          {errors.avatarUrl && (
            <p role="alert" className="mt-1.5 text-xs font-bold text-uupm-danger-text">
              {errors.avatarUrl.message}
            </p>
          )}
        </div>
      </div>

      {/* Nhóm Giới thiệu */}
      <div className="space-y-4">
        <h4 className="text-sm font-black uppercase tracking-wide text-uupm-ink">Giới thiệu</h4>

        <div className="w-full">
          <label
            htmlFor="profile-bio"
            className="mb-1.5 block text-xs font-black uppercase tracking-wide text-uupm-ink"
          >
            Tiểu sử
          </label>
          <div className="relative">
            <Quote className="w-4 h-4 text-uupm-ink-muted absolute left-3.5 top-3.5 pointer-events-none" />
            <textarea
              id="profile-bio"
              rows={3}
              placeholder="Giới thiệu ngắn về bạn..."
              aria-invalid={Boolean(errors.bio)}
              aria-describedby={errors.bio ? "profile-bio-error" : "profile-bio-helper"}
              disabled={isSubmitting}
              className="w-full pl-10 pr-4 py-2.5 text-sm font-semibold bg-uupm-surface text-uupm-ink placeholder:text-uupm-ink-muted rounded-xs border-2 border-uupm-line shadow-uupm-active focus:outline-none focus:shadow-uupm-2 resize-none disabled:opacity-60 disabled:cursor-not-allowed"
              {...register("bio")}
            />
          </div>
          {errors.bio ? (
            <p id="profile-bio-error" className="mt-1.5 text-xs font-bold text-uupm-danger-text">
              {errors.bio.message}
            </p>
          ) : (
            <p id="profile-bio-helper" className="mt-1.5 text-xs font-semibold text-uupm-ink-muted">
              Tối đa 200 ký tự
              {bioValue.length > 0 && (
                <span className={bioValue.length > 200 ? " text-uupm-danger-text" : ""}>
                  {" "}
                  — {bioValue.length}/200
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Hiển thị đếm ký tự cho Tên hiển thị (giới hạn 50 của backend) */}
      {displayNameValue.length > 0 && (
        <p className="text-[11px] font-bold text-uupm-ink-muted text-right">
          {displayNameValue.length}/50 ký tự
        </p>
      )}

      {/* Nút lưu thay đổi hồ sơ */}
      <Button
        type="submit"
        variant="primary"
        size="md"
        isLoading={isSubmitting}
        leftIcon={<Save className="w-4 h-4" />}
        disabled={isSubmitting}
        aria-disabled={isSubmitting}
        className="w-full"
      >
        Lưu thay đổi
      </Button>
    </form>
  );
};

