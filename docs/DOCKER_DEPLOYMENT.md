# Docker 部署

Docker 使用 `AUTH_MODE=local` 和独立 SQLite 账号体系，直接暴露根路径 `/`；fnOS `.fpk` 仍使用 Unix Socket 和 fnOS 网关账号，不共享 Docker 会话。

默认镜像名为 `timorm/fnos-app-schulte`，与代码仓库、Docker 容器/数据卷和 fnOS 应用标识保持一致。需要使用镜像代理或自定义镜像时，可通过 `DOCKERHUB_IMAGE` 覆盖。

```bash
docker compose pull
docker compose up -d
docker compose ps
```

默认访问 `http://服务器地址:3333/`，首次账号为 `admin/admin`，登录后应立即修改密码。数据和账号保存在 `schulte-data` 命名卷，或通过 `.env` 设置：

```dotenv
SCHULTE_VERSION=1.0.5
SCHULTE_PORT=3333
DATA_HOST_PATH=/mnt/nas/schulte-data
```

如果使用主机目录，先创建目录并确保容器用户可写：

```bash
mkdir -p /mnt/nas/schulte-data
docker run --rm -v /mnt/nas/schulte-data:/data alpine:3.22 chown -R 1000:1000 /data
```

## 账号管理

管理员可通过本地账号 API 管理账号。所有请求都需要登录 Cookie；下面示例使用 `curl` 保存会话：

```bash
curl -c cookies.txt -H 'content-type: application/json' \\
  -d '{"username":"admin","password":"admin"}' \\
  http://127.0.0.1:3333/api/auth/login

# 新增普通账号，初始密码为 admin
curl -b cookies.txt -H 'content-type: application/json' \\
  -d '{"username":"family"}' \\
  http://127.0.0.1:3333/api/auth/accounts

# 查看账号
curl -b cookies.txt http://127.0.0.1:3333/api/auth/accounts

# 将指定 uid 的账号重置为临时密码 admin
curl -b cookies.txt -H 'content-type: application/json' \\
  -d '{"uid":"local-xxxxxxxx"}' \\
  http://127.0.0.1:3333/api/auth/accounts/reset

# 当前账号修改密码
curl -b cookies.txt -X PUT -H 'content-type: application/json' \\
  -d '{"password":"至少8位的新密码"}' \\
  http://127.0.0.1:3333/api/auth/password
```

账号重置会撤销该账号已有会话，并标记为需要修改密码。登录 Docker 版本后，点击顶部本地用户名即可打开“账号安全”页面；管理员可在其中新增账号和重置普通账号密码。

管理员完全忘记密码时，先停止容器，再执行：

```bash
docker compose stop schulte
docker compose run --rm --no-deps schulte \\
  node scripts/reset-local-admin-password.mjs '至少8位的新密码'
docker compose start schulte
```

## 健康检查、日志与备份

```bash
curl http://127.0.0.1:3333/healthz
docker compose logs --tail=200 schulte
```

备份前停止服务，再归档 `schulte-data` 卷或 `DATA_HOST_PATH` 目录。备份包含账号凭据和训练成绩，应限制访问并加密保存。

升级时固定镜像版本：

```bash
SCHULTE_VERSION=<version> docker compose pull
SCHULTE_VERSION=<version> docker compose up -d
```

回滚前确认旧镜像兼容当前数据库结构；不兼容时应从升级前备份恢复到独立卷，不要直接覆盖生产数据。
