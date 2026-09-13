import { Router, Request, Response, NextFunction } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "../docs/openapi";

/**
 * Định tuyến phục vụ tài liệu API (Swagger UI)
 * Base Path: /api/docs
 */
const router = Router();

// Endpoint trả về đặc tả OpenAPI dạng JSON thô (dùng để sinh SDK hoặc import vào Postman/Insomnia)
router.get("/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});

// Giao diện Swagger UI tương tác, cho phép gọi thử API trực tiếp trên trình duyệt.
// Bỏ qua kiểm tra CSP của Helmet cho riêng tuyến đường này vì Swagger UI cần chèn inline script/style.
router.use(
  "/",
  (_req: Request, res: Response, next: NextFunction) => {
    res.removeHeader("Content-Security-Policy");
    next();
  },
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: "appmessaging API Docs",
    swaggerOptions: {
      // Giữ nguyên Access Token đã nhập khi tải lại trang
      persistAuthorization: true,
      // Sắp xếp endpoint theo nhóm tag khai báo trong tài liệu
      tagsSorter: "alpha",
    },
  })
);

export const docsRoutes = router;
