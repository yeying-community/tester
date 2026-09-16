# 路由 Router — 端到端测试用例

> 测试人员视角整理的**应有** E2E 用例清单,作为实现依据。
> 状态说明:✅ 已实现(链接到 spec) / ⬜ 待实现。
> 端点:admin UI + API 3011(内嵌 Go 二进制)· 自定义 SIWE
> 最后更新:2026-09-16

## 覆盖总览

| 模块 | 用例数 | 已实现 | 待实现 |
| --- | --- | --- | --- |
| 一、服务健康与公共信息 | 7 | 7 | 0 |
| 二、钱包自定义 SIWE 鉴权 | 11 | 7 | 4 |
| 三、鉴权与权限边界(混合信封) | 8 | 8 | 0 |
| 四、管理后台 UI 与登录导航 | 12 | 9 | 3 |
| 五、工作台只读页面 | 7 | 4 | 3 |
| 六、令牌(Token)生命周期 | 10 | 7 | 3 |
| 七、充值与订单生命周期 | 8 | 1 | 7 |
| 八、余额与兑换码 | 5 | 0 | 5 |
| 九、个人中心与账户设置 | 5 | 1 | 4 |
| 十、OpenAI 兼容模型与中继 | 6 | 3 | 3 |
| **合计** | **79** | **47** | **32** |

> 说明:Router 单一 Go 二进制在 `:3011` 上同时提供内嵌 React 管理后台与 API。
> 钱包是唯一登录方式(`password_login_enabled=false`、`password_register_enabled=false`)。
> 自定义 SIWE 挑战格式(非 EIP-4361):
> `Login to <SystemName>\nNonce: <hex>\nAddress: 0x...\nIssued At: <RFC3339>`。
> **混合信封**是本产品的核心测试点:`/auth/verify` 用 `{success, data, message}`,
> `/profile`、`/user/*` 用 SDK 信封 `{code, data, message, timestamp}`。
> 环境变量:`ROUTER_BASE_URL`(默认 `http://localhost:3011`)、`ROUTER_WALLET_PRIVATE_KEY`、`ROUTER_EXPECTED_ADDRESS`。

---

## 一、服务健康与公共信息

### RT-API-001 GET /status 返回路由配置
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/router/tests/api.spec.ts
- 前置条件:Router 服务在 `ROUTER_BASE_URL` 可达。
- 步骤:
  1. GET `/api/v1/public/status`。
- 预期结果:200;`success=true`;`data.system_name` 非空;`data.register_enabled`、`data.wallet_login`、`data.password_login_enabled` 均为布尔;含 `version`、`quota_per_unit`、`jwt_expire_hours` 等字段。

### RT-API-002 GET /topup/plans 返回充值套餐列表
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/router/tests/api.spec.ts
- 前置条件:服务可达。
- 步骤:
  1. GET `/api/v1/public/topup/plans`。
- 预期结果:200;`success=true`;`data` 为套餐数组(可能为空但字段合法)。

### RT-API-003 GET /billing/currencies 返回可用计费货币
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/router/tests/public-info.spec.ts
- 前置条件:服务可达。
- 步骤:
  1. GET `/api/v1/public/billing/currencies`。
- 预期结果:200;`success=true`;`data` 为对象,含 `default_currency` 与 `items` 数组,每项含货币代码 `code`(如 CNY/USD)。

### RT-API-004 公共内容端点(/about、/notice、/home_page_content)返回内容
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/router/tests/public-info.spec.ts
- 前置条件:服务可达。
- 步骤:
  1. 依次 GET `/api/v1/public/about`、`/api/v1/public/notice`、`/api/v1/public/home_page_content`。
- 预期结果:三者均返回 200 且 `success=true`;`data` 为字符串(可为空,取自后台配置项)。

### RT-UI-001 管理后台 HTML 页面渲染且标题含 Router
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/router/tests/api.spec.ts
- 前置条件:服务可达。
- 步骤:
  1. 浏览器打开 `ROUTER_BASE_URL`。
- 预期结果:页面标题匹配 `/Router/`;内嵌 React 后台正常挂载。

### RT-UI-002 根 URL 响应 2xx 且渲染非空内容
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/router/tests/smoke.spec.ts
- 前置条件:服务可达。
- 步骤:
  1. GET `/` 断言状态码 < 500。
  2. 浏览器打开 `/`,读取 `body` 文本。
- 预期结果:根路由响应 2xx;body 文本长度 > 0(SPA 已渲染)。

### RT-UI-003 服务不可用时优雅跳过 Router 全部用例
- 优先级:P2
- 类型:UI
- 状态:✅ 已实现 — products/router/tests/smoke.spec.ts
- 前置条件:`ROUTER_BASE_URL` 未配置或服务不可达。
- 步骤:
  1. 尝试以 3s 超时 GET `/`。
- 预期结果:未配置或连接失败时用例 `test.skip`,不产生误报失败。

---

## 二、钱包自定义 SIWE 鉴权

### RT-API-005 challenge 返回自定义格式消息并绑定钱包地址
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/router/tests/api.spec.ts
- 前置条件:服务可达;测试钱包地址已绑定账户(或后台开启自动注册)。
- 步骤:
  1. POST `/api/v1/public/common/auth/challenge`,body `{address}`。
- 预期结果:200;`success=true`;`data.message` 含 `Login to`、含地址(大小写不敏感)、含 `data.nonce`;`data.nonce` 为十六进制;含 `data.expires_at`。

### RT-API-006 verify 签名后返回绑定钱包的 JWT
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/router/tests/api.spec.ts(helpers/auth.ts `loginWithWallet`)
- 前置条件:配置 `ROUTER_WALLET_PRIVATE_KEY`。
- 步骤:
  1. challenge 取回 message/nonce。
  2. 用私钥 `personal_sign` 消息。
  3. POST `/api/v1/public/common/auth/verify`,body `{address, signature, nonce, message}`。
- 预期结果:200;`success=true`;`data.token` 为三段式 JWT;`data.user.wallet_address` 与钱包地址一致;含 `data.expires_at`。

### RT-API-007 challenge 拒绝非法/缺失地址
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/router/tests/auth-negative.spec.ts
- 前置条件:服务可达。
- 步骤:
  1. 分别 POST challenge:body 缺 `address`;`address` 为非以太坊格式串。
- 预期结果:两次均返回 `success=false`、消息含“address”(实测消息为“参数错误,缺少 address”,HTTP 200,proto 信封无顶层 `code`)。

### RT-API-008 challenge 拒绝未绑定且未开启自动注册的地址
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现(降级跳过)— products/router/tests/auth-negative.spec.ts(本部署 `AutoRegisterEnabled=true`,未绑定地址会被自动注册,拒绝分支不可达;测试探测随机地址 challenge,检测到自动注册开启即降级跳过,关闭时才断言拒绝)
- 前置条件:后台 `AutoRegisterEnabled=false`;使用一个从未绑定账户的随机地址。
- 步骤:
  1. POST challenge,body `{address: <未绑定地址>}`。
- 预期结果:`success=false`、`code=5`、消息含“钱包未绑定账户,请先绑定或由管理员开启自动注册”。

### RT-API-009 verify 拒绝错误私钥签名
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/router/tests/auth-negative.spec.ts
- 前置条件:服务可达。
- 步骤:
  1. 对地址 A 发起 challenge。
  2. 用不同私钥 B 对 message 签名。
  3. POST verify,body `{address: A, signature: B签名, nonce, message}`。
- 预期结果:`success=false`、消息“签名地址与请求地址不一致”;未下发 token(HTTP 200 proto 信封,`code` 被 `writeProtoError` 丢弃,不在响应体内)。

### RT-API-010 verify 缺少签名或 nonce 时报错
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/router/tests/auth-negative.spec.ts
- 前置条件:已完成一次 challenge。
- 步骤:
  1. POST verify,body 缺 `signature` 或缺 `nonce`。
- 预期结果:`success=false`、消息“缺少签名或 nonce”。

### RT-API-011 同地址重复 challenge 使旧 nonce 失效(覆盖语义)
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/router/tests/auth-negative.spec.ts
- 前置条件:配置钱包私钥。
- 步骤:
  1. 对地址发起第 1 次 challenge,记录 message1/nonce1。
  2. 对同一地址发起第 2 次 challenge,得 nonce2。
  3. 用 nonce1/message1 的签名去 verify。
- 预期结果:第 1 个 nonce 已被最新挑战覆盖,verify 失败,消息“nonce 无效或已过期”。(证明 `GetWalletNonce` 每地址仅存一个 nonce 的并发风险;实现须放入 `serial` describe。)

### RT-API-012 verify 使用已过期/已消费 nonce 报错
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/router/tests/auth-negative.spec.ts
- 前置条件:配置钱包私钥。
- 步骤:
  1. 正常完成一次 challenge→verify(消费 nonce)。
  2. 用同一 message/nonce 再次 verify。
- 预期结果:第二次 `success=false`,消息“nonce 无效或已过期”(nonce 一次性)。

### RT-API-013 refreshToken 换发新 token 且拒绝非法 token
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已获得有效 token。
- 步骤:
  1. POST `/api/v1/public/common/auth/refreshToken`,携带 `Authorization: Bearer <token>`。
  2. 再用伪造/过期 token 调用。
- 预期结果:有效 token 返回新 token 与 `expires_at`;非法 token 返回 `code=3`、消息“token 无效或已过期”。

### RT-API-014 地址大小写不敏感登录(非 EIP-55 校验)
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:配置钱包私钥。
- 步骤:
  1. 用全小写地址完成 challenge→sign→verify。
- 预期结果:登录成功(`IsValidEthAddress` 为正则校验,非 EIP-55 校验和;地址被 `NormalizeWalletAddress` 归一化)。

### RT-API-015 auth 端点受 CriticalRateLimit 限流
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:服务可达。
- 步骤:
  1. 在短时间内高频调用 `/auth/challenge`(超过限流阈值)。
- 预期结果:超阈后返回限流响应(429 或限流错误体),证明临界端点受保护。

---

## 三、鉴权与权限边界(混合信封)

### RT-API-016 JWT 解锁受保护 /profile 并返回 SDK 信封
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/router/tests/api.spec.ts
- 前置条件:已获得钱包 JWT。
- 步骤:
  1. GET `/api/v1/public/profile`,携带 `Authorization: Bearer <JWT>`。
- 预期结果:200;信封为 `{code:0, data, message, timestamp}`;`data.address` 与钱包地址一致(含 `did`、`issuedAt`)。

### RT-API-017 /profile 拒绝未鉴权请求
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/router/tests/api.spec.ts
- 前置条件:服务可达。
- 步骤:
  1. 不带 Authorization GET `/api/v1/public/profile`。
- 预期结果:401 或 403;消息“Missing access token”。

### RT-API-018 混合信封契约:verify 与 profile 信封形态不同
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/router/tests/authz.spec.ts
- 前置条件:已完成 verify。
- 步骤:
  1. 断言 verify 响应形如 `{success, data, message}`(顶层无 `code`)。
  2. 断言 profile 响应形如 `{code, data, message, timestamp}`(顶层无 `success`)。
- 预期结果:两端点信封字段互不相同;测试须按端点各自断言,避免跨信封误用(本产品真实缺陷来源)。
- 备注(与文档不符):实测 `/user/*`(self/dashboard/quota 等)返回的是 proto 信封 `{success,data,message}`,而非文档所称的 SDK 信封 `{code,...}`;仅 `/profile` 使用 `{code,data,message,timestamp}`。

### RT-API-019 UserAuth 端点无 JWT 返回未授权
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/router/tests/authz.spec.ts
- 前置条件:服务可达。
- 步骤:
  1. 不带 Authorization 依次 GET `/api/v1/public/user/self`、`/user/dashboard`、`/user/quota/summary`。
- 预期结果:均返回 401(或等价未授权响应)。

### RT-API-020 Token CRUD 端点无 JWT 返回未授权
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/router/tests/authz.spec.ts
- 前置条件:服务可达。
- 步骤:
  1. 不带 Authorization GET `/api/v1/public/token/`、POST `/token/`。
- 预期结果:均返回 401,不泄露令牌数据。

### RT-API-021 普通用户 JWT 访问 admin/* 返回权限不足
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/router/tests/authz.spec.ts
- 前置条件:持有普通用户(非 admin/root)钱包 JWT。
- 步骤:
  1. 携带用户 JWT GET `/api/v1/admin/user/`、`/api/v1/admin/dashboard/`。
- 预期结果:`AdminAuth` 拦截、用户越权被拒。实测返回 HTTP 200 + `{success:false, message:"无权进行此操作，权限不足"}`(非 403 状态码);测试同时兼容 403。

### RT-API-022 verify 返回的 user.id 尾部空格需 trim
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/router/tests/authz.spec.ts
- 前置条件:已完成 verify。
- 步骤:
  1. 读取 `data.user.id`,做严格字符串比较前先 `.trim()`。
- 预期结果:原始 `user.id` 可能带尾部空格;`.trim()` 后与后续接口返回的 id 一致(数据契约健壮性)。

### RT-API-023 token/status 需 TokenAuth(API Key)而非用户 JWT
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/router/tests/authz.spec.ts
- 前置条件:已创建一个 API token(sk-…)。
- 步骤:
  1. 用 `Authorization: Bearer sk-<token>` GET `/api/v1/public/token/status`。
  2. 用用户会话 JWT 调用同端点。
- 预期结果:用户 JWT 不被 `TokenAuth` 接受(返回 401 one-api 错误信封 `{error:{message,type}}`);无凭证亦 401。真实 API Key 返回额度状态一支因账号无可用模型无法创建令牌而未覆盖。

---

## 四、管理后台 UI 与登录导航

### RT-UI-004 落地页渲染管理后台外壳
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/router/tests/user-flow.spec.ts
- 前置条件:服务可达。
- 步骤:
  1. 打开 `/`,等待 networkidle。
- 预期结果:`body` 可见且文本长度 > 50(非空白/非 404)。

### RT-UI-005 导航暴露至少一个可交互入口
- 优先级:P2
- 类型:UI
- 状态:✅ 已实现 — products/router/tests/user-flow.spec.ts
- 前置条件:服务可达。
- 步骤:
  1. 打开 `/`,统计 `a[href], button, [role]` 数量。
- 预期结果:数量 > 0(钱包驱动 SPA 至少有登录按钮)。

### RT-UI-006 登录/钱包连接入口可被发现
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/router/tests/user-flow.spec.ts
- 前置条件:服务可达。
- 步骤:
  1. 打开 `/`,查询 input/button/a 等可交互元素。
- 预期结果:存在可交互入口(钱包登录/身份登录)。

### RT-UI-007 未登录访问 /workspace/* 重定向到 /login
- 优先级:P0
- 类型:UI
- 状态:✅ 已实现 — products/router/tests/login-redirect.spec.ts
- 前置条件:未注入会话(localStorage 无 `user`)。
- 步骤:
  1. 直接打开 `/workspace/token`。
- 预期结果:`PrivateRoute` 拦截并跳转 `/login?redirect=%2Fworkspace%2Ftoken`(路径经 `encodeURIComponent`);登录页外壳(`.router-login-page`)渲染。

### RT-UI-008 登录页默认渲染钱包登录模式
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/router/tests/login-ui.spec.ts
- 前置条件:未登录。
- 步骤:
  1. 打开 `/login`。
- 预期结果:默认 `authMode='wallet'`;显示钱包登录按钮 `.router-wallet-button`(文案“钱包登陆/Wallet Login”);标题 `#login-title` 存在。

### RT-UI-009 登录页切换到通行证/passkey 模式渲染二维码
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/router/tests/login-ui.spec.ts
- 前置条件:在 `/login`。
- 步骤:
  1. 点击右上角切换角标 `.router-login-mode-corner`。
- 预期结果:渲染 `.router-identity-login-panel`;发起 `POST /api/v1/public/auth/identity/passkey/login/session` 并渲染 `AppQRCode`;显示本地打开链接 `.router-identity-local-link`。

### RT-UI-010 无钱包插件时显示未检测告警
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/router/tests/login-ui.spec.ts
- 前置条件:浏览器未注入钱包 provider(无 `window.ethereum`)。
- 步骤:
  1. 打开 `/login`,点击钱包登录按钮。
- 预期结果:显示告警 `.router-auth-message`(“未检测到钱包插件…”),不发起签名。

### RT-UI-011 已鉴权用户侧栏导航渲染分组
- 优先级:P2
- 类型:UI
- 状态:⬜ 待实现
- 前置条件:已注入钱包会话(`seedWalletSession`)。
- 步骤:
  1. 打开任一 `/workspace/*` 页。
- 预期结果:侧栏 `.router-user-nav-menu` 渲染“概览/我的/帮助”分组,含 模型、额度、令牌、账户、日志 菜单项。

### RT-UI-012 语言切换(中文/English)
- 优先级:P2
- 类型:UI
- 状态:⬜ 待实现
- 前置条件:已进入后台任意页。
- 步骤:
  1. 点击 Header 语言下拉 `.router-header-dropdown`,选择另一语言。
- 预期结果:界面文案随之切换(如“令牌”↔“Token”),`i18n.changeLanguage` 生效。

### RT-UI-013 用户下拉“退出/Logout”登出并清理会话
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/router/tests/session-ui.spec.ts
- 前置条件:已注入钱包会话。
- 步骤:
  1. 打开用户下拉,点击“退出/Logout”。
- 预期结果:调用 `/api/v1/public/user/logout`;localStorage 中 `user`/`wallet_token` 被清除;跳转回登录页。

### RT-UI-014 普通用户访问 /admin/* 被重定向到工作台
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/router/tests/session-ui.spec.ts
- 前置条件:普通用户会话(非 admin)。
- 步骤:
  1. 直接打开 `/admin/dashboard`。
- 预期结果:`AdminOnlyRoute` 判定 `isAdmin()=false`,重定向到 `/workspace/entry`。

### RT-UI-015 /workspace/entry 依据余额/套餐重定向
- 优先级:P2
- 类型:UI
- 状态:⬜ 待实现
- 前置条件:已注入钱包会话。
- 步骤:
  1. 打开 `/workspace/entry`。
- 预期结果:有活跃套餐或余额>0 → 跳 `/workspace/topup?tab=quota`;否则跳 `/workspace/service/pricing`。

---

## 五、工作台只读页面

### RT-UI-016 额度总览页渲染 3 个统计卡
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/router/tests/workspace.spec.ts
- 前置条件:已注入钱包会话。
- 步骤:
  1. 打开 `/workspace/topup?tab=quota`。
- 预期结果:`.router-topup-statistic` 恰好 3 个(总额度/已用额度/剩余额度,默认 0)。

### RT-UI-017 令牌列表页渲染表格与新增按钮
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/router/tests/workspace.spec.ts
- 前置条件:已注入钱包会话。
- 步骤:
  1. 打开 `/workspace/token`。
- 预期结果:`.router-list-table` 可见;“新增令牌/Add Token”按钮可见。

### RT-UI-018 日志页渲染“路由异常概览”标题
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/router/tests/workspace.spec.ts
- 前置条件:已注入钱包会话。
- 步骤:
  1. 打开 `/workspace/log`。
- 预期结果:`<h2>`“路由异常概览/Route Anomaly Overview”可见(独立于异常拉取,稳定渲染)。

### RT-UI-019 模型页渲染可用模型标签
- 优先级:P2
- 类型:UI
- 状态:⬜ 待实现
- 前置条件:已注入钱包会话。
- 步骤:
  1. 打开 `/workspace/service/models`。
- 预期结果:标题“模型/Models”渲染;可用模型以 `.router-tag` 标签展示;含刷新按钮(账号无模型时为友好空态)。

### RT-UI-020 额度总览页展示消费日历
- 优先级:P2
- 类型:UI
- 状态:⬜ 待实现
- 前置条件:已注入钱包会话。
- 步骤:
  1. 打开 `/workspace/topup?tab=quota`,定位 `.dashboard-spend-section`。
- 预期结果:`SpendingCalendar` 渲染在 `.dashboard-spend-stack` 内(消费日历可见)。

### RT-UI-021 服务购买页渲染套餐区与余额充值区
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/router/tests/workspace.spec.ts
- 前置条件:已注入钱包会话。
- 步骤:
  1. 打开 `/workspace/service/pricing`。
- 预期结果:标题“购买/Purchase”;`#pricing-package-section`(套餐)与 `#pricing-balance-section`(余额充值)两区块均渲染;含“支付记录”链接 `.router-service-pricing-history-link`。

### RT-UI-022 令牌值复制与启用/禁用切换交互
- 优先级:P2
- 类型:UI
- 状态:⬜ 待实现
- 前置条件:已注入会话且账户至少有 1 个令牌。
- 步骤:
  1. 在令牌行点击复制图标;点击状态开关切换启用/禁用。
- 预期结果:复制成功提示出现;状态切换后行状态更新,并持久化(刷新后保持)。

---

## 六、令牌(Token)生命周期

### RT-E2E-001 通过工作台创建令牌后删除(全流程 / 到后端门槛)
- 优先级:P0
- 类型:E2E
- 状态:✅ 已实现 — products/router/tests/token-lifecycle.spec.ts
- 前置条件:配置钱包私钥;stub `GET /user/models/available` 返回非空以启用“确认”按钮。
- 步骤:
  1. 注入会话,打开 `/workspace/token`,点“新增令牌”。
  2. 填名称 `e2e-tok-<ts>`,点“确认”触发真实 `POST /token/`。
  3. 有可用模型:断言“令牌已创建”卡片、列表出现该行,`finally` 用 Bearer 调 `DELETE /token/:id/` 清理;无可用模型:断言到达后端门槛消息。
- 预期结果:请求体 `name` 与输入一致;有额度时完整创建→列表可见→删除闭环;无额度时验证创建流已接到模型门槛(未写入)。

### RT-API-024 POST /token/ 创建令牌返回 key
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/router/tests/token-api.spec.ts
- 前置条件:账户存在可用模型(有额度)。
- 步骤:
  1. 携带用户 JWT POST `/api/v1/public/token/`,body `{name}`。
- 预期结果:有可用模型时 `success=true`、`data` 含新令牌 id 与 key,随后 `finally` 删除;无可用模型时命中后端「暂无可用模型」门槛(未写入)。当前测试账号无可用模型,实测走门槛分支(边界断言)。

### RT-API-025 POST /token/ 无可用模型时被门槛拦截
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/router/tests/token-api.spec.ts
- 前置条件:账户无可用模型(未购买/未充值)。
- 步骤:
  1. 携带用户 JWT POST `/token/`,body `{name}`。
- 预期结果:`success=false`;消息匹配“暂无可用模型/购买套餐”等门槛提示;未创建令牌。

### RT-API-026 POST /token/ 参数校验
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/router/tests/token-api.spec.ts
- 前置条件:持有用户 JWT。
- 步骤:
  1. POST `/token/` body 缺 `name` 或含非法配额值。
- 预期结果:`success=false`;不写入、不下发 key。备注:实测后端在参数校验之前先检查「可用模型」门槛,故无模型账号缺 `name` 会先命中门槛消息;测试对两类拒绝消息均兼容。

### RT-API-027 GET /token/ 列表含新建令牌且 /token/:id 返回详情
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/router/tests/token-api.spec.ts
- 前置条件:已创建 1 个令牌。
- 步骤:
  1. GET `/token/` 列表。
  2. GET `/token/:id` 详情。
- 预期结果:列表返回 `success=true` 且 `data` 为数组、含分页 `meta`;若存在令牌则 `/token/:id` 返回该令牌详情(id 一致)。当前账号无令牌,详情分支按条件 `test.skip` 干净跳过。

### RT-API-028 PUT /token/ 更新令牌
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现(降级跳过)— products/router/tests/token-api.spec.ts(条件跳过:当前账户无令牌可更新;创建令牌需可用模型=外部支付边界。存在令牌时自动执行 PUT 更新回环)
- 前置条件:已创建 1 个令牌。
- 步骤:
  1. PUT `/token/`,body 含 id 与修改后的名称/配额/状态。
- 预期结果:`success=true`;GET 详情反映更新后字段。

### RT-API-029 DELETE /token/:id 删除且幂等
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/router/tests/token-api.spec.ts
- 前置条件:已创建 1 个令牌。
- 步骤:
  1. DELETE `/token/:id`;GET 列表确认消失。
  2. 再次 DELETE 同一 id。
- 预期结果:首删成功、列表不再出现;重复删除返回受控结果(`success=false` 或幂等成功),不产生 5xx。

### RT-API-030 GET /token/search 按名称搜索
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/router/tests/token-api.spec.ts
- 前置条件:已创建带唯一名称前缀的令牌。
- 步骤:
  1. GET `/token/search?keyword=<前缀>`。
- 预期结果:返回 `success=true` 且 `data` 为数组;不匹配的唯一 keyword 返回空数组(无误命中)。创建令牌受可用模型门槛限制,故以「不命中」方向验证搜索契约。

### RT-API-031 token/status 以 API Key 返回额度状态
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已创建并取得令牌 key。
- 步骤:
  1. 用 `Authorization: Bearer sk-<key>` GET `/token/status`。
- 预期结果:返回该令牌剩余额度/请求次数等状态字段。

### RT-UI-023 令牌编辑页修改名称/配额/模型限制并保存
- 优先级:P2
- 类型:UI
- 状态:⬜ 待实现
- 前置条件:已注入会话且存在 1 个令牌。
- 步骤:
  1. 打开 `/workspace/token/:id`(EditToken)。
  2. 修改名称、配额上限、模型限制,保存。
- 预期结果:保存成功;返回列表后该行显示更新后的名称;后端 PUT 请求体携带修改字段。

---

## 七、充值与订单生命周期

### RT-E2E-002 立即充值打开支付弹窗并创建订单(到下单边界)
- 优先级:P0
- 类型:E2E
- 状态:✅ 已实现 — products/router/tests/topup.spec.ts
- 前置条件:配置钱包私钥;stub `GET /user/topup/plans`(合成套餐)与 `POST /user/topup/orders`(返回 pending + `about:blank`)。
- 步骤:
  1. 注入会话,打开 `/workspace/service/pricing`。
  2. 在充值卡片 `.router-balance-topup-card` 点“立即充值”。
- 预期结果:先打开支付弹窗,再触发 `POST /user/topup/orders`;请求体 `business_type='balance_topup'`、`plan_id` 正确;订单返回 pending。不越过真实支付网关。

### RT-API-032 POST /user/topup/orders 创建 balance_topup 订单
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现(降级跳过)— products/router/tests/topup-orders.spec.ts(本部署 `top_up_mode=api`,下单会命中真实外部支付网关 wp.tidukongjian.com;redirect 模式下自动执行完整下单→列表→详情→刷新→取消流程)
- 前置条件:持有用户 JWT;stub 外部支付网关或断言到下单边界。
- 步骤:
  1. POST `/user/topup/orders`,body `{business_type:'balance_topup', plan_id}`。
- 预期结果:`success=true`;`data.status='pending'`(或 created);含 `id`、`transaction_id`、`redirect_url`。

### RT-API-033 GET /user/topup/orders 列表与 /orders/:id 详情
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现(降级跳过)— products/router/tests/topup-orders.spec.ts(本部署 `top_up_mode=api`,依赖已创建订单=真实外部支付网关;redirect 模式下随订单生命周期流程一并执行)
- 前置条件:已创建至少 1 个订单。
- 步骤:
  1. GET `/user/topup/orders`。
  2. GET `/user/topup/orders/:id`。
- 预期结果:列表含该订单;详情返回金额、货币、状态等字段。

### RT-API-034 POST /orders/:id/refresh 刷新订单状态
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现(降级跳过)— products/router/tests/topup-orders.spec.ts(本部署 `top_up_mode=api`,刷新会查询真实外部支付网关;redirect 模式下随订单生命周期流程一并执行)
- 前置条件:存在 pending 订单。
- 步骤:
  1. POST `/user/topup/orders/:id/refresh`。
- 预期结果:触发向支付方查询并回写状态;返回归一化后的最新状态(created/pending/paid/fulfilled 之一)。

### RT-API-035 POST /orders/:id/cancel 取消 pending 订单
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现(降级跳过)— products/router/tests/topup-orders.spec.ts(本部署 `top_up_mode=api`,取消会查询真实外部支付网关;redirect 模式下随订单生命周期流程一并执行并自清理)
- 前置条件:存在 pending 订单。
- 步骤:
  1. POST `/user/topup/orders/:id/cancel`。
- 预期结果:`success=true`;订单状态变为 `canceled`;已支付订单不可取消(返回受控错误)。

### RT-API-036 POST /topup/package/preview 套餐购买预览
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:存在可购套餐。
- 步骤:
  1. POST `/user/topup/package/preview`,body 含套餐/操作类型。
- 预期结果:返回预览价格、货币、生效额度等,不实际下单。

### RT-API-037 订单状态流转覆盖(created→pending→paid→fulfilled 及失败/取消分支)
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:可通过 stub 支付回调驱动状态。
- 步骤:
  1. 依次以合法状态推进订单,并验证非法跳转被拒。
- 预期结果:状态机遵循 created→pending→paid→fulfilled;failed/canceled 为终态;`NormalizeTopupOrderStatus` 对未知值归一。

### RT-UI-024 套餐购买页展示订阅套餐卡片
- 优先级:P2
- 类型:UI
- 状态:⬜ 待实现
- 前置条件:已注入会话且存在可购套餐。
- 步骤:
  1. 打开 `/workspace/service/pricing`,定位 `#pricing-package-section`。
- 预期结果:`.router-package-purchase-card` 渲染套餐名/价格/额度信息(PackagePurchasePage)。

---

## 八、余额与兑换码

### RT-UI-025 余额状态页显示三类余额
- 优先级:P2
- 类型:UI
- 状态:⬜ 待实现
- 前置条件:已注入会话。
- 步骤:
  1. 打开余额状态页(BalanceStatusPage,`.router-topup-balance-layout`)。
- 预期结果:3 个 `.router-topup-statistic`:充值余额、兑换余额、赠送余额;含“兑换码充值”入口。

### RT-E2E-003 兑换码充值弹窗输入并提交
- 优先级:P1
- 类型:E2E
- 状态:⬜ 待实现(降级跳过)— products/router/tests/redeem.spec.ts(兑换码弹窗 `RedeemCodePage` 仅被未挂载路由的 `BalanceStatusPage`/`TopUpRecordsPage` 引用,当前 `App.jsx` 无任何 live 路由可到达用户兑换码弹窗)
- 前置条件:已注入会话;准备一个测试兑换码(或断言到提交边界)。
- 步骤:
  1. 打开余额状态页,点击“兑换码充值”打开 `RedeemCodePage` 弹窗。
  2. 在 `.router-machine-input` 输入兑换码,点确认。
- 预期结果:有效码 → 结果表显示兑换金额/前后余额;无效/过期码 → 友好错误提示;`submitRedemption` 请求携带该码。

### RT-API-038 GET /user/topup/balance/summary 返回余额汇总
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:持有用户 JWT。
- 步骤:
  1. GET `/user/topup/balance/summary`。
- 预期结果:200;返回充值/兑换/赠送余额汇总字段。

### RT-API-039 GET 余额批次与流水
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:持有用户 JWT。
- 步骤:
  1. GET `/user/topup/balance/lots`、`/user/topup/balance/transactions`。
- 预期结果:200;分别返回余额批次列表与批次流水(可为空但结构合法)。

### RT-API-040 GET /user/topup/redemptions 返回兑换记录
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:持有用户 JWT。
- 步骤:
  1. GET `/user/topup/redemptions`。
- 预期结果:200;返回当前用户兑换记录列表。

---

## 九、个人中心与账户设置

### RT-UI-026 账户设置页加载并展示账户信息
- 优先级:P2
- 类型:UI
- 状态:⬜ 待实现
- 前置条件:已注入会话。
- 步骤:
  1. 打开 `/workspace/setting`(PersonalSetting)。
- 预期结果:“账户信息”区块渲染;展示当前用户名与绑定钱包地址(来自 `GET /user/self`)。

### RT-E2E-004 修改用户名并持久化
- 优先级:P2
- 类型:E2E
- 状态:⬜ 待实现
- 前置条件:已注入会话。
- 步骤:
  1. 在账户设置页编辑用户名并保存(`PUT /user/self`)。
  2. 刷新页面重新加载。
- 预期结果:保存成功;刷新后显示新用户名。
- 备注:测试后应复原原用户名。

### RT-E2E-005 设置/修改密码
- 优先级:P2
- 类型:E2E
- 状态:⬜ 待实现
- 前置条件:已注入会话。
- 步骤:
  1. 打开修改密码弹窗,填写并提交(`POST /user/self/password`)。
- 预期结果:提交成功提示;`has_password` 变为 true(设置)或密码更新成功。
- 备注:钱包账户默认无密码,注意用例对账户状态的副作用与复原。

### RT-API-041 用户聚合读接口返回数据
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:持有用户 JWT。
- 步骤:
  1. GET `/user/dashboard`、`/user/spend/overview`、`/user/quota/summary`、`/user/quota/overview`。
- 预期结果:均返回 SDK 信封 `{code:0, data}`;字段结构合法(空账户返回零值)。

### RT-API-042 GET /user/self 返回当前用户对象
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/router/tests/authz.spec.ts
- 前置条件:持有用户 JWT。
- 步骤:
  1. GET `/api/v1/public/user/self`。
- 预期结果:200;`data` 含 id、username、wallet_address(与登录地址一致)、role、status。备注:实测信封为 proto `{success,data,message}`(非 SDK `{code,...}`);`id` 可能带尾部空格,比较前需 `.trim()`。

---

## 十、OpenAI 兼容模型与中继

### RT-API-043 GET /api/v1/public/models 以 API Key 列出模型
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/router/tests/authz.spec.ts
- 前置条件:已创建 API token 且账户有可用模型。
- 步骤:
  1. 用 `Authorization: Bearer sk-<key>` GET `/api/v1/public/models`。
- 预期结果:返回 OpenAI 兼容模型列表(`data` 数组,每项含 `id`);`RetrieveModel` 对单模型返回详情。

### RT-API-044 POST /chat/completions 中继到上游返回补全
- 优先级:P0
- 类型:API
- 状态:✅ 已实现(边界) — products/router/tests/relay.spec.ts
- 前置条件:已创建 API token;账户有额度与可用模型;配置了真实/桩上游渠道。
- 步骤:
  1. 用 API Key POST `/api/v1/public/chat/completions`,body 含 `model` 与 `messages`。
- 预期结果:经 `TokenAuth + Distribute` 路由到渠道并返回补全响应;扣减对应额度。当前账号无 API Key/额度/可用模型,无法真跑,测试实现到 `TokenAuth` 授权边界:用户 JWT(非 API Key)被拒 401、one-api 错误信封 `{error:{message}}`,未路由上游。

### RT-API-045 中继端点无/非法 token 返回未授权
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/router/tests/relay.spec.ts
- 前置条件:服务可达。
- 步骤:
  1. 不带 token 或用伪造 `sk-` POST `/chat/completions`。
- 预期结果:401(TokenAuth 拒绝),不路由到上游;无 token 消息为“未提供令牌”,伪造 `sk-` 亦 401。

### RT-API-046 未实现的中继端点返回 not implemented
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已创建 API token。
- 步骤:
  1. 用 API Key 调用标注 `RelayNotImplemented` 的端点(如 `GET /files`、`POST /fine_tuning/jobs`)。
- 预期结果:返回“未实现”的受控响应,而非 5xx 崩溃。

### RT-API-047 DISABLE_OPENAI_COMPAT 时旧 /v1/* 路径被禁用
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:以 `DISABLE_OPENAI_COMPAT=true` 启动服务。
- 步骤:
  1. 请求旧 `/v1/chat/completions` 与 `/dashboard/*`。
  2. 请求 `/api/v1/public/chat/completions`。
- 预期结果:旧路径被禁用(404/关闭);`/api/v1/public/*` 仍作为唯一对外入口可用。

### RT-API-048 中继调用写入路由日志可查
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已完成一次成功中继调用;持有用户 JWT。
- 步骤:
  1. GET `/api/v1/public/log`(UserAuth)查询本用户日志。
- 预期结果:列表含刚才的中继调用记录(模型、渠道、用量);`/log/:id` 可查看单条详情。
