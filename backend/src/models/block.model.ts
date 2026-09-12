import { Schema, model, Document, Types, Model } from "mongoose";

/**
 * Interface biểu diễn tài liệu Chặn người dùng trong MongoDB
 * - blockerId: Người thực hiện hành vi chặn
 * - blockedId: Người bị chặn
 */
export interface IBlock extends Document {
  blockerId: Types.ObjectId;
  blockedId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BlockSchema = new Schema<IBlock>(
  {
    blockerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    blockedId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      validate: {
        validator: function (this: IBlock, val: Types.ObjectId) {
          return !this.blockerId || this.blockerId.toString() !== val.toString();
        },
        message: "Không thể tự chặn chính mình",
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = (ret._id as { toString(): string }).toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Ngăn chặn tạo trùng lặp bản ghi chặn giữa blockerId và blockedId
BlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
// Index phục vụ kiểm tra hai chiều: blockedId có bị chặn bởi blockerId hoặc ngược lại
BlockSchema.index({ blockedId: 1, blockerId: 1 });

export const BlockModel: Model<IBlock> = model<IBlock>("Block", BlockSchema);
