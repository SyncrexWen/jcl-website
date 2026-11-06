# Cloudflare 部署说明（演示）

站点是纯静态产物（`dist/`），免费方案足够。

## 方式 A：直接上传（最快，无需 Git）
1. 本地 `cd site && npm install && npm run build`
2. Cloudflare 控制台 → Workers & Pages → 创建 → Pages → **Upload assets**，拖入 `dist` 文件夹，部署。
3. 更新数据后重新 build 并再次上传。

## 方式 B：Git 自动构建
推送 `site/` 到 GitHub，在 Cloudflare 连接仓库：
- Build command：`npm run build`
- Output directory：`dist`
- 环境变量：`NODE_VERSION=22`
每次提交自动发布（免费版约 500 次构建/月）。

## 注意
- Cloudflare 新项目会引导至 Workers 静态资源，产物同样兼容。
- 中国大陆访问 `*.pages.dev` / `workers.dev` 可能不稳定，**展示前请用校园网/手机流量实测**；正式版可绑定自有域名。
- 演示站带“模拟数据”横幅，真实数据上线前在 `Base.astro` 去掉。
