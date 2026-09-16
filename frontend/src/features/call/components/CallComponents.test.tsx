import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CallTimer } from "./atoms/CallTimer";
import { CallControls } from "./molecules/CallControls";
import { IncomingCallModal } from "./molecules/IncomingCallModal";

describe("Task 6: Bộ UI cuộc gọi theo Atomic Design", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe("1. CallTimer (Atom)", () => {
    it("Hiển thị 00:00 ban đầu và tự động đếm giây khi active = true", () => {
      const { rerender } = render(<CallTimer active={false} />);
      expect(screen.getByRole("timer").textContent).toBe("00:00");

      rerender(<CallTimer active={true} />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByRole("timer").textContent).toBe("00:05");

      act(() => {
        vi.advanceTimersByTime(65000);
      });
      expect(screen.getByRole("timer").textContent).toBe("01:10");

      rerender(<CallTimer active={false} />);
      expect(screen.getByRole("timer").textContent).toBe("00:00");
    });
  });

  describe("2. CallControls (Molecule)", () => {
    it("Kích hoạt đúng các hàm callback khi tương tác nút Mic, Camera, End", () => {
      const onToggleAudio = vi.fn();
      const onToggleVideo = vi.fn();
      const onEnd = vi.fn();

      render(
        <CallControls
          type="video"
          micOn={true}
          camOn={true}
          onToggleAudio={onToggleAudio}
          onToggleVideo={onToggleVideo}
          onEnd={onEnd}
        />
      );

      const micBtn = screen.getByLabelText("Tắt micro");
      fireEvent.click(micBtn);
      expect(onToggleAudio).toHaveBeenCalledTimes(1);

      const camBtn = screen.getByLabelText("Tắt camera");
      fireEvent.click(camBtn);
      expect(onToggleVideo).toHaveBeenCalledTimes(1);

      const endBtn = screen.getByLabelText("Kết thúc cuộc gọi");
      fireEvent.click(endBtn);
      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it("Ẩn nút camera khi loại cuộc gọi là audio", () => {
      render(
        <CallControls
          type="audio"
          micOn={true}
          camOn={false}
          onToggleAudio={vi.fn()}
          onToggleVideo={vi.fn()}
          onEnd={vi.fn()}
        />
      );

      expect(screen.queryByLabelText("Tắt camera")).toBeNull();
      expect(screen.queryByLabelText("Bật camera")).toBeNull();
    });
  });

  describe("3. IncomingCallModal (Molecule)", () => {
    beforeEach(() => {
      // Giả lập HTMLDialogElement.prototype.showModal và close trong môi trường jsdom
      HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
        this.open = true;
      });
      HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
        this.open = false;
      });
    });

    it("Hiển thị đúng tên người gọi và gọi onAccept khi bấm nút Trả lời", () => {
      const onAccept = vi.fn();
      const onDecline = vi.fn();

      render(
        <IncomingCallModal
          peerName="Nguyễn Văn A"
          callType="video"
          onAccept={onAccept}
          onDecline={onDecline}
        />
      );

      expect(screen.getByText("Nguyễn Văn A")).toBeDefined();
      expect(screen.getByText("Cuộc gọi video đến...")).toBeDefined();

      const acceptBtn = screen.getByLabelText("Chấp nhận cuộc gọi");
      fireEvent.click(acceptBtn);
      expect(onAccept).toHaveBeenCalledTimes(1);
    });

    it("Gọi onDecline khi bấm nút Từ chối", () => {
      const onAccept = vi.fn();
      const onDecline = vi.fn();

      render(
        <IncomingCallModal
          peerName="Trần Thị B"
          callType="audio"
          onAccept={onAccept}
          onDecline={onDecline}
        />
      );

      const declineBtn = screen.getByLabelText("Từ chối cuộc gọi");
      fireEvent.click(declineBtn);
      expect(onDecline).toHaveBeenCalledTimes(1);
    });

    it("Hỗ trợ phím tắt Enter để chấp nhận cuộc gọi", () => {
      const onAccept = vi.fn();
      const onDecline = vi.fn();

      render(
        <IncomingCallModal
          peerName="Lê Văn C"
          callType="audio"
          onAccept={onAccept}
          onDecline={onDecline}
        />
      );

      const dialog = screen.getByRole("alertdialog");
      fireEvent.keyDown(dialog, { key: "Enter" });
      expect(onAccept).toHaveBeenCalledTimes(1);
    });
  });
});
