# oce-portal

OpenContextEngine 用户门户（独立前端工程）：LinuxDo OAuth2 登录、查看/轮换个人
API key、查看用量统计。后端为同仓部署的 oce 服务（`/auth/*` 接口）。

## 开发

```bash
npm install
npm run dev        # http://localhost:5173，/auth 代理到本机 8986
```

## 构建与部署

```bash
npm run build      # 产物在 dist/
```

生产部署由 oce 服务端同源托管：`docker-compose.yml` 把本目录 `dist/` 以只读卷
挂入 app 容器（`/app/portal-dist`），服务端 `AUTH_PORTAL_DIST_DIR` 指向该目录后
自动挂载在 `/`。无需任何 CORS 配置。

后端开关与环境变量见 oce 仓库 README「多用户接入」一节。
