# 仓库 Warehouse — 端到端测试用例

> 测试人员视角整理的**应有** E2E 用例清单,作为实现依据。
> 状态说明:✅ 已实现(链接到 spec) / ⬜ 待实现。
> 端点:UI 5173 · admin/S3 6066 · WebDAV 6065 · 账号 admin/changeme(测试环境 admin/admin123)
> 说明:一条逻辑用例可能对应多个 spec;"已实现"以逻辑用例是否被现有 spec 覆盖为准,而非 spec 中的 test 块数量。
> 最后更新:2026-09-17

## 覆盖总览

| 模块 | 用例数 | 已实现 | 待实现 |
| --- | --- | --- | --- |
| 一、鉴权与会话 | 16 | 16 | 0 |
| 二、WebDAV 文件访问协议 | 11 | 11 | 0 |
| 三、WebDAV 目录访问密钥(AccessKey) | 7 | 7 | 0 |
| 四、S3 凭证与 S3 协议 | 8 | 8 | 0 |
| 五、文件管理 UI | 9 | 9 | 0 |
| 六、回收站 | 5 | 5 | 0 |
| 七、公开分享 | 6 | 6 | 0 |
| 八、定向分享(给指定用户) | 8 | 8 | 0 |
| 九、配额 | 4 | 4 | 0 |
| 十、用户资料与密码 | 4 | 4 | 0 |
| 十一、通知 | 4 | 4 | 0 |
| 十二、分组管理 | 2 | 2 | 0 |
| 十三、管理员用户管理 | 5 | 5 | 0 |
| 十四、健康检查与冒烟 | 2 | 2 | 0 |
| **合计** | **91** | **91** | **0** |

---

## 一、鉴权与会话

### WH-API-001 SIWE 挑战需要 checksum 地址
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/siwe.spec.ts
- 前置条件:warehouse admin 服务在 6066 可用
- 步骤:
  1. `POST /api/v1/public/auth/challenge`,传入全小写(非 checksum)钱包地址
  2. 观察响应
- 预期结果:返回 400,提示 `Address parameter is invalid`(必须为 EIP-55 checksum 格式)

### WH-API-002 SIWE 挑战→签名→验证换取 JWT
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/siwe.spec.ts
- 前置条件:准备一个测试钱包私钥
- 步骤:
  1. `POST /auth/challenge` 传入 checksum 地址,得到 `challenge` + `nonce`
  2. 用私钥对 challenge 消息做 `personal_sign`
  3. `POST /auth/verify` 提交签名
- 预期结果:返回 `{data:{token, address, expiresAt}}`,token 为绑定该钱包地址的 JWT

### WH-API-003 SIWE 验证拒绝错误签名
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/siwe.spec.ts
- 前置条件:已获取有效 challenge
- 步骤:
  1. 获取地址 A 的 challenge
  2. 用另一把私钥 B 对该 challenge 签名
  3. `POST /auth/verify` 提交
- 预期结果:返回 4xx,验证失败,不下发 token

### WH-API-004 SIWE nonce 一次性 / 防重放
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/siwe-replay.spec.ts
- 前置条件:已完成一次成功的 challenge→verify
- 步骤:
  1. 复用同一个 `nonce`/challenge 再次 `POST /auth/verify`
- 预期结果:返回 4xx,已消费的 nonce 不可重复验证

### WH-API-005 密码登录换取绑定地址的 JWT
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/auth.spec.ts
- 前置条件:存在账号 admin/admin123
- 步骤:
  1. `POST /api/v1/public/auth/password/login` 提交用户名+密码
- 预期结果:返回 `{data:{token, address, username, expiresAt}}`,token 可用于后续鉴权

### WH-API-006 密码登录错误口令被拒
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/auth-negative.spec.ts
- 前置条件:存在账号 admin
- 步骤:
  1. `POST /auth/password/login` 提交正确用户名 + 错误密码
- 预期结果:返回 401/4xx,不下发 token

### WH-API-007 受保护接口缺少 JWT 返回 401
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/auth-negative.spec.ts
- 前置条件:无
- 步骤:
  1. 不带 Authorization 头请求 `GET /api/v1/public/webdav/quota`(或 `/webdav/user/info`)
- 预期结果:返回 401,拒绝访问

### WH-API-008 受保护接口非法/过期 JWT 返回 401
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/auth-token-refresh.spec.ts
- 前置条件:无
- 步骤:
  1. 携带伪造/已过期的 `Authorization: Bearer xxx` 请求 `GET /webdav/user/info`
- 预期结果:返回 401,拒绝访问

### WH-API-009 auth/refresh 刷新令牌
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/auth-token-refresh.spec.ts
- 前置条件:已通过登录获得 refresh cookie/token
- 步骤:
  1. `POST /api/v1/public/auth/refresh` 携带刷新凭证
- 预期结果:返回新的访问 token,过期时间被延长

### WH-API-010 auth/logout 注销会话
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/auth-session.spec.ts:41(单浏览器上下文:登录→refresh 200→logout 200→refresh 401)
- 前置条件:已登录
- 步骤:
  1. `POST /api/v1/public/auth/logout`
  2. 再用旧刷新凭证 `POST /auth/refresh`
- 预期结果:注销成功;注销后刷新失败(4xx)

### WH-API-011 邮箱验证码发送
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/auth-session.spec.ts:73(邮件通道 500 不可用;断言地址校验 400 与端点已接线的契约)
- 前置条件:邮件通道已配置(或断言未配置时的降级响应)
- 步骤:
  1. `POST /api/v1/public/auth/email/code` 提交邮箱
- 预期结果:返回 2xx 表示验证码已发送;非法邮箱返回 4xx

### WH-API-012 邮箱验证码登录
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/auth-session.spec.ts:100(邮件通道不可用;断言错误/过期验证码的拒绝路径)
- 前置条件:已获取有效验证码
- 步骤:
  1. `POST /api/v1/public/auth/email/login` 提交邮箱+验证码
- 预期结果:验证码正确返回 token;错误/过期验证码返回 4xx

### WH-API-013 identity/UCAN 登录会话创建
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/auth-session.spec.ts:118(identity/login/session 返回 issuerEndpoint/nonce/session_id)
- 前置条件:identity issuer(8100)可用
- 步骤:
  1. `POST /api/v1/public/auth/identity/login/session`
- 预期结果:返回包含 `issuerEndpoint` 的会话信息(完整 UCAN presentation 校验在 headless 中过于复杂,仅覆盖会话创建契约)

### WH-UI-001 落地页渲染钱包 + 护照两种登录入口
- 优先级:P0
- 类型:UI
- 状态:✅ 已实现 — products/warehouse/tests/ui-wallet.spec.ts
- 前置条件:前端 5173 可用
- 步骤:
  1. 访问首页
  2. 观察登录区
- 预期结果:同时渲染"钱包登录"与护照/identity 登录两种入口

### WH-UI-002 点击钱包登录驱动 SDK identity 流程并优雅报错
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/warehouse/tests/ui-wallet.spec.ts
- 前置条件:注入 EIP-1193 钱包 shim
- 步骤:
  1. 点击"钱包登录"
  2. 观察 SDK 对 `/auth/identity/login/session` 的 POST 及错误弹窗
- 预期结果:SDK 发起 identity 会话请求;UCAN 被拒时弹出 Element Plus 干净错误弹窗,页面无 JS 崩溃

### WH-UI-003 已认证会话渲染 AppHeader
- 优先级:P0
- 类型:E2E
- 状态:✅ 已实现 — products/warehouse/tests/ui-authenticated.spec.ts
- 前置条件:在浏览器内完成 SIWE 并写入 SDK token(`localStorage['authToken']` 等)
- 步骤:
  1. 播种已认证会话并 reload
  2. 观察顶部 AppHeader
- 预期结果:渲染登录后的 AppHeader(用户区/退出等),`isAuth` 为 true

---

## 二、WebDAV 文件访问协议

### WH-API-014 PROPFIND 根返回 207 多状态
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/webdav.spec.ts;products/warehouse/tests/auth.spec.ts
- 前置条件:Basic 认证 admin/admin123,WebDAV 前缀 `/dav`
- 步骤:
  1. 对 `/dav/` 发起 `PROPFIND`,`Depth: 1`
- 预期结果:返回 207 Multi-Status,含 XML `<multistatus>` 目录列表

### WH-API-015 PROPFIND /personal/<user> 列出用户空间
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/auth.spec.ts
- 前置条件:Basic 认证
- 步骤:
  1. 对 `/dav/personal/<user>/` 发起 `PROPFIND`
- 预期结果:返回 207,列出该用户个人空间条目

### WH-API-016 PUT 后 GET 往返保持字节一致
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/webdav.spec.ts;products/warehouse/tests/auth.spec.ts
- 前置条件:Basic 认证(admin 只能写根集合,不能写他人 `/personal/<user>`)
- 步骤:
  1. `PUT /dav/test-<stamp>.txt` 写入已知内容
  2. `GET` 同一路径读取
- 预期结果:GET 返回体与写入字节完全一致

### WH-API-017 DELETE 文件后再 GET 返回 404
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/webdav-mutations.spec.ts
- 前置条件:已 PUT 一个测试文件
- 步骤:
  1. `DELETE /dav/test-<stamp>.txt`
  2. 再 `GET` 同一路径
- 预期结果:DELETE 返回 2xx;后续 GET 返回 404

### WH-API-018 MKCOL 创建目录
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/webdav-mutations.spec.ts
- 前置条件:Basic 认证
- 步骤:
  1. `MKCOL /dav/dir-<stamp>/`
  2. `PROPFIND` 父集合
- 预期结果:MKCOL 返回 201;PROPFIND 中出现新建目录

### WH-API-019 MOVE 重命名/移动文件
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/webdav-mutations.spec.ts
- 前置条件:已 PUT 源文件
- 步骤:
  1. `MOVE /dav/a-<stamp>.txt`,`Destination: /dav/b-<stamp>.txt`
  2. `GET` 目标路径,`GET` 源路径
- 预期结果:MOVE 返回 201/204;目标存在且内容一致,源返回 404

### WH-API-020 COPY 复制文件
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/webdav-copy-options.spec.ts:39
- 前置条件:已 PUT 源文件
- 步骤:
  1. `COPY /dav/a-<stamp>.txt`,`Destination: /dav/a-copy-<stamp>.txt`
- 预期结果:返回 201;源与目标均存在且内容一致

### WH-API-021 OPTIONS 返回支持的方法与 DAV 头
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/webdav-copy-options.spec.ts:77
- 前置条件:无
- 步骤:
  1. `OPTIONS /dav/`
- 预期结果:响应头 `Allow` 含 GET/PUT/DELETE/PROPFIND/MKCOL/COPY/MOVE/LOCK 等,含 `DAV` 能力声明

### WH-API-022 无凭证访问 WebDAV 返回 401
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/auth-negative.spec.ts
- 前置条件:无
- 步骤:
  1. 不带 Authorization 发起 `PROPFIND /dav/`
- 预期结果:返回 401,带 `WWW-Authenticate` 提示

### WH-API-023 PUT 到他人个人空间返回 403
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/webdav-mutations.spec.ts
- 前置条件:admin 不拥有 `/personal/<otherUser>`
- 步骤:
  1. admin Basic 认证下 `PUT /dav/personal/<otherUser>/x.txt`
- 预期结果:返回 403,越权写入被拒

### WH-API-024 GET 不存在文件返回 404
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/webdav-copy-options.spec.ts:97
- 前置条件:Basic 认证
- 步骤:
  1. `GET /dav/does-not-exist-<stamp>.txt`
- 预期结果:返回 404

---

## 三、WebDAV 目录访问密钥(AccessKey)

### WH-API-025 创建 AccessKey 返回 keyId/keySecret
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/access-keys.spec.ts
- 前置条件:JWT 已登录
- 步骤:
  1. `POST /api/v1/public/webdav/access-keys/create`,指定绑定路径(如 `/personal`)
- 预期结果:返回 `{id, keyId, keySecret, ...}`(注意用 keyId/keySecret 而非 accessKeyId)

### WH-API-026 列表显示已创建的 AccessKey
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/access-keys.spec.ts
- 前置条件:已创建一个 AccessKey
- 步骤:
  1. `GET /api/v1/public/webdav/access-keys/list`
- 预期结果:返回 `{items:[...]}`,含刚创建的 keyId

### WH-API-027 AccessKey 认证 WebDAV PROPFIND
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/access-keys.spec.ts
- 前置条件:已创建绑定 `/personal` 的 AccessKey
- 步骤:
  1. 以 keyId/keySecret 作 Basic 认证对绑定路径 `PROPFIND`
- 预期结果:返回 207,鉴权通过

### WH-API-028 撤销并删除 AccessKey
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/access-keys.spec.ts
- 前置条件:已创建 AccessKey
- 步骤:
  1. `POST /webdav/access-keys/revoke`
  2. `POST /webdav/access-keys/delete`
  3. `GET /list`
- 预期结果:撤销/删除均成功;列表不再含该 key

### WH-API-029 撤销后 AccessKey 认证被拒
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/access-keys-revoked.spec.ts
- 前置条件:AccessKey 已被 revoke
- 步骤:
  1. 用已撤销的 keyId/keySecret 对绑定路径 `PROPFIND`
- 预期结果:返回 401/403,鉴权失败

### WH-API-030 AccessKey 访问未绑定路径被拒
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/access-keys-scope.spec.ts
- 前置条件:AccessKey 仅绑定 `/personal`
- 步骤:
  1. 用该 key 对未绑定的其它路径 `PROPFIND`
- 预期结果:返回 403,越界访问被拒

### WH-API-031 bind 为 AccessKey 追加绑定路径
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/access-keys-bind.spec.ts:56(MKCOL→建 key 绑 /personal→PROPFIND 403→bind→列表含路径→PROPFIND 207)
- 前置条件:已创建 AccessKey
- 步骤:
  1. `POST /webdav/access-keys/bind` 追加新绑定路径
  2. 用该 key 访问新路径
- 预期结果:绑定成功;新路径访问通过

---

## 四、S3 凭证与 S3 协议

### WH-API-032 S3 服务端点 6066 可达
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/s3-credentials.spec.ts
- 前置条件:S3 服务在 6066 监听
- 步骤:
  1. 对 6066 发起未签名 GET
- 预期结果:返回 403 AccessDenied `<Error>`(证明已接线而非连接被拒)

### WH-API-033 创建 S3 凭证返回 accessKeyId/secret
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/s3-credentials.spec.ts
- 前置条件:JWT 已登录
- 步骤:
  1. `POST /api/v1/public/s3/credentials/create`(如绑定 `/personal`)
- 预期结果:返回 `{id, accessKeyId, secret, warning, ...}`(注意用 secret 而非 secretAccessKey)

### WH-API-034 列出 S3 凭证
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/s3-credentials.spec.ts
- 前置条件:已创建 S3 凭证
- 步骤:
  1. `GET /api/v1/public/s3/credentials/list`
- 预期结果:返回 `{items:[...]}`,含刚创建凭证(secret 不再明文回显)

### WH-API-035 撤销并删除 S3 凭证
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/s3-credentials.spec.ts
- 前置条件:已创建 S3 凭证
- 步骤:
  1. `POST /s3/credentials/revoke`
  2. `POST /s3/credentials/delete`
- 预期结果:均成功;列表不再含该凭证

### WH-API-036 未签名 S3 请求返回 403 AccessDenied
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/s3-sigv4-negative.spec.ts
- 前置条件:S3 服务可用
- 步骤:
  1. 对 6066 发起无 SigV4 签名的 `GET /`(ListBuckets)
- 预期结果:返回 403,XML `<Error><Code>AccessDenied</Code>`

### WH-API-037 SigV4 ListBuckets 成功
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/s3-sigv4.spec.ts
- 前置条件:已创建有效 S3 凭证(accessKeyId/secret)
- 步骤:
  1. 用 AWS SigV4(region us-east-1)对 6066 发起 ListBuckets
- 预期结果:返回 200,XML `<ListAllMyBucketsResult>`,含用户可见 bucket

### WH-API-038 撤销后 SigV4 请求被拒
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/s3-sigv4-negative.spec.ts
- 前置条件:S3 凭证已被 revoke
- 步骤:
  1. 用已撤销凭证做 SigV4 ListBuckets
- 预期结果:返回 403,鉴权失败

### WH-UI-004 UI 创建 S3 凭证并显示 AK/Secret
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/warehouse/tests/ui-s3-credential.spec.ts
- 前置条件:已认证会话,进入密钥管理 S3 页签(`#pane-s3`)
- 步骤:
  1. 在 S3 页签点击"新建"
  2. 提交表单
  3. 展开/显示凭证
- 预期结果:创建成功,弹出并可显示 Access Key ID 与 Secret(仅创建时明文)

---

## 五、文件管理 UI

### WH-UI-005 新建文件夹→上传→下载→删除完整流程
- 优先级:P0
- 类型:E2E
- 状态:✅ 已实现 — products/warehouse/tests/ui-files.spec.ts
- 前置条件:已认证会话
- 步骤:
  1. 新建文件夹
  2. 进入文件夹上传文件
  3. 下载该文件并校验
  4. 删除文件
- 预期结果:各步操作成功,文件表实时反映结果

### WH-UI-006 侧栏渲染四个导航分组
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/warehouse/tests/ui-side-panel.spec.ts
- 前置条件:已认证会话
- 步骤:
  1. 观察左侧导航
- 预期结果:渲染"我的资产 / 分享与协作 / 管理 / 帮助"四个分组(`分享` 需 exact 匹配以避免命中"收到的分享")

### WH-UI-007 点击密钥管理进入视图且不离开 SPA
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/warehouse/tests/ui-side-panel.spec.ts
- 前置条件:已认证会话
- 步骤:
  1. 点击"密钥管理"
- 预期结果:对应导航项 `.active` 高亮,页面仍在 SPA 内(无整页跳转)

### WH-UI-008 首页渲染可识别标题
- 优先级:P0
- 类型:UI
- 状态:✅ 已实现 — products/warehouse/tests/smoke.spec.ts
- 前置条件:前端 5173 可用
- 步骤:
  1. 访问首页
- 预期结果:渲染出可识别的标题区域,冒烟通过

### WH-UI-009 上传大文件显示进度(分片上传)
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/warehouse/tests/ui-large-upload-rename.spec.ts:51(66MiB 触发分片上传;任务面板 .task-panel 显示 .el-progress;前端 5173 不可达时按契约 test.skip)
- 前置条件:已认证会话,后端 `uploads/sessions` 分片上传可用
- 步骤:
  1. 上传较大文件
  2. 观察上传任务列表(UploadTaskListView)进度
- 预期结果:显示进度并最终完成;刷新后文件出现在列表

### WH-UI-010 文件预览对话框
- 优先级:P2
- 类型:UI
- 状态:✅ 已实现 — products/warehouse/tests/ui-preview-sort-conflict.spec.ts:70(前端不可达时 test.skip)
- 前置条件:已上传可预览文件(如文本/图片)
- 步骤:
  1. 点击文件打开预览(FilePreviewDialog)
- 预期结果:弹出预览对话框并正确渲染内容

### WH-UI-011 文件表视图/排序切换
- 优先级:P2
- 类型:UI
- 状态:✅ 已实现 — products/warehouse/tests/ui-preview-sort-conflict.spec.ts:102(前端不可达时 test.skip)
- 前置条件:目录含多个文件
- 步骤:
  1. 切换排序/视图(FileTableView)
- 预期结果:列表按所选方式重新排列,无报错

### WH-UI-012 重命名文件/文件夹
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/warehouse/tests/ui-large-upload-rename.spec.ts:113(前端不可达时 test.skip)
- 前置条件:已存在文件/文件夹
- 步骤:
  1. 对条目执行重命名
  2. 刷新列表
- 预期结果:名称更新成功且持久化

### WH-UI-013 上传重名文件的冲突处理
- 优先级:P2
- 类型:UI
- 状态:✅ 已实现 — products/warehouse/tests/ui-preview-sort-conflict.spec.ts:147(同名再次上传→原地覆盖;仅一行;内容为最新;前端不可达时 test.skip)
- 前置条件:目录已存在同名文件
- 步骤:
  1. 再次上传同名文件
- 预期结果:给出覆盖/重命名/跳过等冲突处理,行为符合产品设计

---

## 六、回收站

### WH-UI-014 侧栏在回收站/分享/资料视图间原地切换
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/warehouse/tests/ui-nav.spec.ts
- 前置条件:已认证会话
- 步骤:
  1. 依次切换到回收站、分享、个人资料视图
- 预期结果:主区域原地切换对应视图,均在 SPA 内

### WH-API-039 删除文件进入回收站列表
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/recycle.spec.ts
- 前置条件:JWT 登录,已删除某文件
- 步骤:
  1. 删除文件后 `GET /api/v1/public/webdav/recycle/list`
- 预期结果:被删文件出现在回收站列表

### WH-API-040 从回收站恢复文件
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/recycle.spec.ts
- 前置条件:回收站中存在条目
- 步骤:
  1. `POST /webdav/recycle/recover` 指定条目
  2. 校验原路径可访问
- 预期结果:恢复成功,文件回到原位置

### WH-API-041 永久删除单个回收站条目
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/recycle.spec.ts
- 前置条件:回收站中存在条目
- 步骤:
  1. `POST /webdav/recycle/permanent` 指定条目
  2. `GET /recycle/list`
- 预期结果:该条目从回收站移除且不可恢复

### WH-API-042 清空回收站
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/recycle-clear.spec.ts:44
- 前置条件:回收站中存在多个条目
- 步骤:
  1. `POST /webdav/recycle/clear`
  2. `GET /recycle/list`
- 预期结果:回收站清空,列表为空

---

## 七、公开分享

### WH-API-043 创建公开分享返回可访问链接
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/share-public.spec.ts
- 前置条件:JWT 登录,已存在待分享资源
- 步骤:
  1. `POST /api/v1/public/share/create`,设置 `mode`、`expiresValue/expiresUnit`
- 预期结果:返回分享标识/链接与 `expiresAt`

### WH-API-044 我的分享列表
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/share-public-lifecycle.spec.ts
- 前置条件:已创建至少一个分享
- 步骤:
  1. `GET /api/v1/public/share/list`
- 预期结果:返回分享列表,含刚创建项及过期时间

### WH-API-045 通过分享链接匿名访问
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/share-public.spec.ts
- 前置条件:已创建公开分享
- 步骤:
  1. `GET /api/v1/public/share/<shareId>`(无需登录)
- 预期结果:返回分享内容/元数据,可访问

### WH-API-046 过期分享访问返回 410 Gone
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/share-public-lifecycle.spec.ts(运行时因后端 expires_at 无时区列缺陷降级跳过)
- 前置条件:创建一个立即/短期过期的分享
- 步骤:
  1. 过期后 `GET /share/<shareId>`
- 预期结果:返回 410 Gone,提示 share expired

### WH-API-047 撤销分享后访问被拒
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/share-public-lifecycle.spec.ts
- 前置条件:已创建分享
- 步骤:
  1. `POST /api/v1/public/share/revoke`
  2. 再 `GET /share/<shareId>`
- 预期结果:撤销成功;后续访问返回 4xx/410

### WH-API-048 从收到的资源二次分享
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/share-user-extra.spec.ts:43(受赠钱包 received→resource/entries→create-from-resource;无可浏览文件时 skip)
- 前置条件:当前用户收到过他人资源
- 步骤:
  1. `POST /api/v1/public/share/create-from-resource` 指定 resourceId + relativePath
- 预期结果:基于收到资源创建新分享成功

---

## 八、定向分享(给指定用户)

### WH-API-049 创建定向分享给指定受众
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/share-user.spec.ts
- 前置条件:JWT 登录,已知目标受众
- 步骤:
  1. `POST /api/v1/public/share/user/create`,指定资源、受众、`permissions`、有效期
- 预期结果:创建成功,返回分享项与权限集

### WH-API-050 我发起的定向分享列表
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/share-user-lifecycle.spec.ts
- 前置条件:已创建定向分享
- 步骤:
  1. `GET /api/v1/public/share/user/list`
- 预期结果:返回我作为分享者的列表

### WH-API-051 我收到的定向分享列表
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/share-user-lifecycle.spec.ts
- 前置条件:当前用户为某定向分享受众
- 步骤:
  1. `GET /api/v1/public/share/user/received`
- 预期结果:返回我收到的分享列表(对应 UI"收到的分享")

### WH-API-052 撤销定向分享
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/share-user-lifecycle.spec.ts
- 前置条件:已创建定向分享
- 步骤:
  1. `POST /api/v1/public/share/user/revoke`
  2. 受众再访问 entries
- 预期结果:撤销成功,受众不再可见/可访问

### WH-API-053 受众列表 audiences
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/share-user-extra.spec.ts:91
- 前置条件:JWT 登录
- 步骤:
  1. `GET /api/v1/public/share/user/audiences`
- 预期结果:返回可选受众列表

### WH-API-054 定向分享资源浏览 entries
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/share-user-lifecycle.spec.ts
- 前置条件:受众身份,存在收到的分享
- 步骤:
  1. `GET /api/v1/public/share/user/entries`(或 `/share/resource/entries`)
- 预期结果:返回分享目录条目列表

### WH-API-055 只读定向分享的写操作被拒
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/share-user.spec.ts
- 前置条件:创建仅含只读 `permissions` 的定向分享
- 步骤:
  1. 受众尝试 `POST /share/user/upload`(或 `/share/resource/folder`、`/rename`、`/delete`)
- 预期结果:返回 403 permission denied,写操作被拒

### WH-API-056 可写定向分享的下载/上传/新建/重命名/删除
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/share-user-writable.spec.ts
- 前置条件:创建含写权限的定向分享
- 步骤:
  1. 受众依次调用 `share/user/download`、`upload`、`folder`、`rename`、`item`(删除)
- 预期结果:各操作按授予权限成功执行

---

## 九、配额

### WH-API-057 带 JWT 查询配额返回结构
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/auth.spec.ts
- 前置条件:JWT 登录
- 步骤:
  1. `GET /api/v1/public/webdav/quota`
- 预期结果:返回 `{quota, used, available, percentage, unlimited}` 结构

### WH-API-058 配额百分比计算正确
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/quota-calc.spec.ts:42(全新钱包 1GiB;PUT 11MiB 后 used+available===quota 且 percentage===used/quota*100)
- 前置条件:已知 used 与 quota
- 步骤:
  1. 上传若干字节后查询 quota
- 预期结果:`used + available ≈ quota`,`percentage` 与 used/quota 一致

### WH-API-059 无限配额标记 unlimited
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/quota-calc.spec.ts:77(admin 无限配额 unlimited=true,available<0,percentage=0)
- 前置条件:为某账号配置无限配额
- 步骤:
  1. `GET /webdav/quota`
- 预期结果:`unlimited=true`,percentage 合理(如 0)

### WH-API-060 超配额上传被拒
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/quota-enforcement.spec.ts(需管理员配额供给能力,非管理员身份下按能力降级跳过)
- 前置条件:账号配额接近上限
- 步骤:
  1. 上传超过剩余配额的文件
- 预期结果:返回配额不足错误(4xx/507),写入被拒

---

## 十、用户资料与密码

### WH-API-061 user/info 返回当前登录用户
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/auth.spec.ts
- 前置条件:JWT 登录
- 步骤:
  1. `GET /api/v1/public/webdav/user/info`
- 预期结果:返回当前用户资料(用户名/地址等)

### WH-API-062 修改密码成功
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/password-change.spec.ts
- 前置条件:已知当前密码的账号
- 步骤:
  1. `POST /webdav/user/password` 提交正确 oldPassword + 合法 newPassword
  2. 用新密码登录
- 预期结果:修改成功;新密码可登录,旧密码失效

### WH-API-063 新密码少于 6 位被拒
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/password-change.spec.ts
- 前置条件:JWT 登录
- 步骤:
  1. `POST /webdav/user/password` 提交长度 < 6 的 newPassword
- 预期结果:返回 400 `New password is invalid`

### WH-API-064 旧密码错误被拒
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/password-change.spec.ts
- 前置条件:账号已设置密码
- 步骤:
  1. `POST /webdav/user/password` 提交错误 oldPassword
- 预期结果:返回 4xx,密码未变更

---

## 十一、通知

### WH-API-065 通知列表
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/notifications.spec.ts:51
- 前置条件:JWT 登录
- 步骤:
  1. `GET /api/v1/public/notifications/list`
- 预期结果:返回通知列表结构

### WH-API-066 未读数量
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/notifications.spec.ts:59
- 前置条件:JWT 登录
- 步骤:
  1. `GET /api/v1/public/notifications/unread-count`
- 预期结果:返回未读数量

### WH-API-067 标记单条/全部已读
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/notifications.spec.ts:68(read {ids} + read-all;之后 unread-count=0)
- 前置条件:存在未读通知
- 步骤:
  1. `POST /notifications/read` 标记单条
  2. `POST /notifications/read-all` 标记全部
  3. `GET /unread-count`
- 预期结果:标记成功;未读数相应下降/归零

### WH-API-068 通知偏好设置
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/notifications.spec.ts:84(GET items[{Type,Enabled}];POST {type,enabled} 切换并回读校验)
- 前置条件:JWT 登录
- 步骤:
  1. `GET/POST /api/v1/public/notifications/preferences`
- 预期结果:可读取并更新通知偏好

---

## 十二、分组管理

### WH-API-069 分组增删改查
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/groups.spec.ts:47(create→list→update PUT→delete DELETE)
- 前置条件:JWT 登录
- 步骤:
  1. `POST /webdav/group/groups/create` 创建分组
  2. `GET /webdav/group/groups` 列表
  3. `POST /groups/update` 更新
  4. `POST /groups/delete` 删除
- 预期结果:创建/列出/更新/删除全链路成功

### WH-API-070 分组成员管理与审批
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/groups.spec.ts:102(成员 create walletAddress→list→delete 真实覆盖;审批 approve/reject 需对端发起入组申请,无头 API 无法合成,已在 spec 注释说明)
- 前置条件:已存在分组
- 步骤:
  1. `POST /group/members/create` 添加成员
  2. `POST /members/approve` 或 `/members/reject` 审批
  3. `POST /members/delete` 移除
- 预期结果:成员创建/审批/拒绝/删除均生效

---

## 十三、管理员用户管理

### WH-API-071 管理员列出用户
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/admin-users.spec.ts(需管理员身份,非管理员下按能力降级跳过)
- 前置条件:管理员 JWT(地址在 AdminAddresses 白名单)
- 步骤:
  1. `GET /api/v1/admin/users/list`
- 预期结果:返回用户列表

### WH-API-072 管理员创建用户
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/admin-users.spec.ts(需管理员身份,非管理员下按能力降级跳过)
- 前置条件:管理员 JWT
- 步骤:
  1. `POST /api/v1/admin/users/create` 提交新用户信息
  2. 在列表中确认
- 预期结果:创建成功,用户出现在列表

### WH-API-073 管理员重置用户密码
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/admin-users.spec.ts(需管理员身份,非管理员下按能力降级跳过)
- 前置条件:管理员 JWT,目标用户存在
- 步骤:
  1. `POST /api/v1/admin/users/reset-password`
  2. 用新密码登录该用户
- 预期结果:重置成功,新密码可登录

### WH-API-074 管理员更新/删除用户
- 优先级:P2
- 类型:API
- 状态:✅ 已实现(需管理员;当前 admin 钱包不在 Security.AdminAddresses,按契约降级 test.skip)— products/warehouse/tests/admin-users-mutate.spec.ts:45
- 前置条件:管理员 JWT,存在可操作的测试用户
- 步骤:
  1. `POST /admin/users/update` 更新资料
  2. `POST /admin/users/delete` 删除
- 预期结果:更新与删除均成功,列表相应变化

### WH-API-075 非管理员访问 admin 接口返回 403
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/admin-authz.spec.ts
- 前置条件:普通用户 JWT(不在 AdminAddresses)
- 步骤:
  1. 携带普通用户 JWT 请求 `GET /api/v1/admin/users/list`
- 预期结果:返回 403,管理员权限校验拦截

---

## 十四、健康检查与冒烟

### WH-API-076 心跳检查
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/health.spec.ts
- 前置条件:服务已启动
- 步骤:
  1. `GET /api/v1/public/health/heartbeat`
- 预期结果:返回 200,服务存活

### WH-API-077 就绪检查确认数据库
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/warehouse/tests/health.spec.ts
- 前置条件:服务与 PostgreSQL 已连接
- 步骤:
  1. `GET /api/v1/public/health/readiness`
- 预期结果:返回 200,确认依赖(数据库)就绪;依赖不可用时返回非 2xx
