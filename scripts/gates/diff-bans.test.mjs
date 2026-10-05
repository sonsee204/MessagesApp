import { describe, it, expect } from "vitest";
import { inspectDiffLines } from "./diff-bans.mjs";

describe("inspectDiffLines", () => {
  it("phát hiện kiểu any mới thêm", () => {
    const diff = `+const data: any = JSON.parse(str);`;
    const issues = inspectDiffLines("src/app.ts", diff);
    expect(issues.length).toBe(1);
    expect(issues[0].rule).toBe("NO_ANY");
  });

  it("cho phép kiểu any nếu có comment bypass hợp lệ", () => {
    const diff = `+const data: any = JSON.parse(str); // allow-any: Dữ liệu bên thứ ba chưa có schema`;
    const issues = inspectDiffLines("src/app.ts", diff);
    expect(issues.length).toBe(0);
  });

  it("phát hiện @ts-ignore và @ts-nocheck", () => {
    const diff = `
+ // @ts-ignore
+ const a = 1;
+ //@ts-nocheck
`;
    const issues = inspectDiffLines("src/app.ts", diff);
    expect(issues.length).toBe(2);
    expect(issues[0].rule).toBe("NO_TS_IGNORE");
    expect(issues[1].rule).toBe("NO_TS_NOCHECK");
  });

  it("phát hiện console.log mới thêm", () => {
    const diff = `+console.log("debug data", obj);`;
    const issues = inspectDiffLines("src/service.ts", diff);
    expect(issues.length).toBe(1);
    expect(issues[0].rule).toBe("NO_CONSOLE_LOG");
  });

  it("bỏ qua dòng bị xóa (-) và file không phải TypeScript", () => {
    const diff = `-const x: any = 1;`;
    const issues = inspectDiffLines("src/app.ts", diff);
    expect(issues.length).toBe(0);

    const mdDiff = `+const x: any = 1;`;
    const mdIssues = inspectDiffLines("README.md", mdDiff);
    expect(mdIssues.length).toBe(0);
  });
});
