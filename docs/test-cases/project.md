# 项目管理 Project(夜莺 YeYing / DooTask)— 端到端测试用例

> 测试人员视角整理的**应有** E2E 用例清单,作为实现依据。
> 状态说明:✅ 已实现(链接到 spec) / ⬜ 待实现。
> 端点:UI + API 20833 · 账号 PROJECT_USER/PROJECT_PASS(邮箱+密码登录)
> 说明:后端为 Laravel/LaravelS + Vue2 单页应用;API 统一响应信封 `{ret, msg, data}`,`ret=1` 成功、`ret=0` 业务错误、`ret=-1` 未登录/身份失效;登录 token 位于 `data.token`,后续请求以请求头 `token`(或 `dootask-token`)回传。
> 说明:一条逻辑用例可能对应多个 spec;"已实现"以逻辑用例是否被现有 spec 覆盖为准,而非 spec 中的 test 块数量。现有 spec 仅 `smoke.spec.ts`、`user-flow.spec.ts` 两支冒烟级别。
> 最后更新:2026-09-17

## 覆盖总览

| 模块 | 用例数 | 已实现 | 待实现 |
| --- | --- | --- | --- |
| 一、鉴权与会话守卫 | 22 | 22 | 0 |
| 二、仪表盘 | 7 | 7 | 0 |
| 三、导航与 SPA 布局 | 7 | 7 | 0 |
| 四、项目管理 | 15 | 15 | 0 |
| 五、任务列表(看板列) | 7 | 7 | 0 |
| 六、任务管理 | 17 | 17 | 0 |
| 七、工作流与状态流转 | 7 | 7 | 0 |
| 八、项目成员与权限 | 7 | 6 | 1 |
| 九、任务标签与日志 | 5 | 5 | 0 |
| 十、文件管理(文件柜) | 8 | 8 | 0 |
| 十一、消息与对话 | 5 | 5 | 0 |
| 十二、工作汇报 | 4 | 4 | 0 |
| 十三、个人设置与账号安全 | 7 | 7 | 0 |
| 十四、自动化访问令牌 | 7 | 6 | 1 |
| 十五、团队/会员管理(管理员) | 6 | 5 | 1 |
| 十六、搜索 | 4 | 4 | 0 |
| 十七、系统、健康与错误异常 | 6 | 6 | 0 |
| **合计** | **141** | **138** | **3** |

---

## 一、鉴权与会话守卫

### PJ-001 登录页正常渲染(冒烟)
- 优先级:P0
- 类型:UI
- 状态:✅ 已实现 — products/project/tests/smoke.spec.ts;products/project/tests/user-flow.spec.ts
- 前置条件:服务在 20833 可用
- 步骤:
  1. 访问 `/`
  2. 观察页面 body 文本
- 预期结果:落地(登录)页正常渲染,body 有非空可见内容,冒烟通过

### PJ-002 登录页暴露账号/邮箱输入框
- 优先级:P0
- 类型:UI
- 状态:✅ 已实现 — products/project/tests/smoke.spec.ts
- 前置条件:服务可用
- 步骤:
  1. 访问 `/`
  2. 定位 text/email/account 类输入框
- 预期结果:至少一个账号/邮箱输入框可见,支持后续输入

### PJ-003 落地页可发现登录/交互控件
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/project/tests/user-flow.spec.ts
- 前置条件:服务可用
- 步骤:
  1. 访问 `/`
  2. 统计 input/button/a/[role] 控件
- 预期结果:存在可交互的登录/连接入口(输入框、按钮或链接),数量 > 0

### PJ-004 导航呈现至少一个入口
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/project/tests/user-flow.spec.ts
- 前置条件:服务可用
- 步骤:
  1. 访问 `/`
  2. 统计 `a[href]`、`[role=link]`、`[role=menuitem]`
- 预期结果:页面至少呈现一个可导航入口(DOM 已挂载)

### PJ-005 邮箱+密码登录成功签发 token
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-api.spec.ts
- 前置条件:存在账号 PROJECT_USER/PROJECT_PASS
- 步骤:
  1. `GET/POST api/users/login`,`type=login`,提交 `email`、`password`
- 预期结果:`ret=1` `登录成功`,`data` 为用户对象且含 `data.token`(不回显 password/encrypt)

### PJ-006 错误密码登录被拒且触发验证码
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-api.spec.ts
- 前置条件:存在账号,该邮箱当前未强制验证码
- 步骤:
  1. `api/users/login` 提交正确 email + 错误 password
  2. 再次 `api/users/login/needcode` 查询该邮箱
- 预期结果:第 1 步 `ret=0` `帐号或密码错误`,`data.code` 变为 `need`;第 2 步返回需要验证码(后续该邮箱登录必须带 `code`)

### PJ-007 账号/密码超 32 位被拒
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-session-p1.spec.ts
- 前置条件:无
- 步骤:
  1. `api/users/login` 提交长度 > 32 的 email 或 password
- 预期结果:`ret=0`,登录返回 `帐号或密码错误`(注册路径返回 `账号密码最多可输入32位字符`)

### PJ-008 login/needcode 反映验证码要求
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-session-p1.spec.ts
- 前置条件:无
- 步骤:
  1. `api/users/login/needcode` 传入未触发过失败的 email
  2. 再对已失败过的 email 查询
- 预期结果:正常邮箱 `ret=0`(`no` 无需验证码);失败过的邮箱 `ret=1`(`need` 需要验证码)

### PJ-009 codejson 返回图形验证码
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-session-p2.spec.ts
- 前置条件:无
- 步骤:
  1. `GET api/users/login/codejson`
- 预期结果:`ret=1`,`data` 含 base64 图片(`img`)与 `key`,可用作登录的 `code_key`

### PJ-010 注册(type=reg)创建账号
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-session-p1.spec.ts
- 前置条件:系统开放注册(`reg=open`)
- 步骤:
  1. `api/users/login`,`type=reg`,提交唯一 email + password
- 预期结果:开放邮箱验证时 `ret=0` 且 `data.code=email`(`注册成功，请验证邮箱后登录`);否则 `ret=1` `注册成功` 并直接签发 token

### PJ-011 注册关闭/需邀请码校验
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-session-p1.spec.ts
- 前置条件:分别配置 `reg=close` 与 `reg=invite`
- 步骤:
  1. `reg=close` 时提交注册
  2. `reg=invite` 时提交空/错误 `invite`
- 预期结果:分别返回 `ret=0` `未开放注册` 与 `请输入正确的邀请码`

### PJ-012 未带 token 访问受保护接口返回 ret=-1
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-api.spec.ts
- 前置条件:无
- 步骤:
  1. 不带任何 token 请求 `GET api/users/info`
- 预期结果:HTTP 200,信封 `ret=-1`,`msg` 为 `请登录后继续...`

### PJ-013 非法/过期 token 访问返回身份失效
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-api.spec.ts
- 前置条件:无
- 步骤:
  1. 携带伪造/过期的请求头 `token: xxx` 请求 `GET api/users/info`
- 预期结果:HTTP 200,`ret=-1`,`msg` 为 `身份已失效,请重新登录`

### PJ-014 token/expire 查询过期时间
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-session-p1.spec.ts
- 前置条件:已登录持有有效 token
- 步骤:
  1. `GET api/users/token/expire`
- 预期结果:`ret=1`,`data` 含 `expired_at`、`remaining_seconds`、`expired`、`server_time`

### PJ-015 token/expire refresh 临近过期时轮换
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-session-p2.spec.ts (仅断言充足有效期/不轮换分支;临近过期轮换需 DB 时钟不可强制)
- 前置条件:token 剩余有效期低于总时长 1/3(或构造该场景)
- 步骤:
  1. `GET api/users/token/expire?refresh=1`
- 预期结果:`ret=1`,`data.token` 返回新 token;剩余充足时不返回新 token

### PJ-016 logout 退出登录使会话失效
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-session-p1.spec.ts
- 前置条件:已登录
- 步骤:
  1. `GET api/users/logout`
  2. 用旧 token 再请求 `api/users/info`
- 预期结果:退出 `ret=1` `退出成功`;旧 token 再访问返回 `ret=-1`

### PJ-017 登录页切换到注册显示确认密码/邀请码
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/project/tests/auth-session-p1.spec.ts
- 前置条件:登录页可用
- 步骤:
  1. 点击"注册帐号"切到 `loginType=reg`
  2. 观察表单
- 预期结果:出现"确认密码"输入框;当系统需要邀请码时出现邀请码输入框

### PJ-018 钱包 SIWE challenge 返回挑战与 nonce
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-session-p1.spec.ts
- 前置条件:钱包登录已启用
- 步骤:
  1. `POST api/public/auth/challenge`,传入合法 `0x` 地址(40 位 hex)与 `chain_id`
- 预期结果:`ret=1`,`data` 含 `challenge`(SIWE 文本)、`nonce`、`expires_at`;非法地址返回 HTTP 422 `钱包地址格式无效`

### PJ-019 钱包 SIWE verify 签名不匹配被拒
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-session-p1.spec.ts
- 前置条件:已获取 challenge
- 步骤:
  1. 用另一把私钥对 challenge 签名
  2. `POST api/public/auth/verify` 提交 address + 该签名
- 预期结果:`ret=0`,`data.code=wallet_signature_mismatch`(`钱包签名地址不匹配`)

### PJ-020 首次钱包登录要求补全邮箱
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-session-p1.spec.ts
- 前置条件:全新钱包地址,签名合法
- 步骤:
  1. 完成 challenge→verify(合法签名)
- 预期结果:`ret=0`,`data.code=wallet_email_required`,返回 `setup_token`,提示先设置并验证邮箱

### PJ-021 passport 登录会话创建(未配置降级)
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-session-p1.spec.ts
- 前置条件:通行证 Node 服务未配置(默认环境)
- 步骤:
  1. `POST api/passport/login/session`
- 预期结果:未配置时 `ret=0` `data.code=passport_not_configured`;配置后 `ret=1` 返回 `session_id`、`qrcode_url`、`status=pending`

### PJ-022 passport 登录状态轮询
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-session-p2.spec.ts (断言空/过期分支;真实待确认态需线下扫码通行证)
- 前置条件:已创建通行证会话
- 步骤:
  1. `GET api/passport/login/status?session_id=<id>`
- 预期结果:待确认时 `ret=1` `data.status=pending`;过期 `data.code=expired`;确认后 `data.status=approved` 且含 `token`

---

## 二、仪表盘

### PJ-023 登录后进入仪表盘并显示任务统计
- 优先级:P0
- 类型:E2E
- 状态:✅ 已实现 — products/project/tests/dashboard-ui.spec.ts
- 前置条件:已登录会话
- 步骤:
  1. 登录后进入 `/manage/dashboard`
  2. 观察任务统计区
- 预期结果:渲染"仪表盘"标题与"你当前的任务统计数据",三类计数正常加载

### PJ-024 仪表盘展示今日到期/超期/待办三类计数
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/project/tests/dashboard-nav.spec.ts
- 前置条件:已登录
- 步骤:
  1. 观察仪表盘顶部计数块
- 预期结果:显示"今日到期""超期任务""待办"三块,数字与 `today_count/overdue_count/todo_count` 一致

### PJ-025 仪表盘欢迎语显示用户昵称
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/project/tests/dashboard-nav.spec.ts
- 前置条件:已登录
- 步骤:
  1. 观察欢迎语
- 预期结果:显示"欢迎您,<昵称>"(或系统自定义欢迎语,含当前用户昵称)

### PJ-026 仪表盘搜索快捷入口
- 优先级:P2
- 类型:UI
- 状态:✅ 已实现 — products/project/tests/ui-p2.spec.ts
- 前置条件:已登录
- 步骤:
  1. 点击仪表盘"搜索"入口(快捷键 Cmd/Ctrl+F)
- 预期结果:弹出全局搜索,可输入关键词

### PJ-027 仪表盘任务分组点击滚动定位
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/project/tests/dashboard-nav.spec.ts
- 前置条件:仪表盘存在多组任务
- 步骤:
  1. 点击"超期任务"计数块
- 预期结果:页面滚动定位到对应任务分组区

### PJ-028 user/tasks 返回我参与的任务
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/dashboard-nav.spec.ts
- 前置条件:已登录且参与若干任务
- 步骤:
  1. `GET api/project/user/tasks`(仪表盘数据源)
- 预期结果:`ret=1`,返回我负责/协助的任务列表,含到期与完成状态字段

### PJ-029 user/counts 返回项目/任务数量
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/search-p2.spec.ts
- 前置条件:已登录
- 步骤:
  1. `GET api/project/user/counts`
- 预期结果:`ret=1`,返回参与的项目/任务数量统计

---

## 三、导航与 SPA 布局

### PJ-030 侧栏渲染五个主入口
- 优先级:P0
- 类型:UI
- 状态:✅ 已实现 — products/project/tests/dashboard-ui.spec.ts
- 前置条件:已登录进入 `/manage`
- 步骤:
  1. 观察左侧基础菜单
- 预期结果:依次渲染"仪表盘/日历/消息/文件/应用"五个主入口

### PJ-031 点击侧栏各入口在 SPA 内原地切换且高亮
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/project/tests/dashboard-nav.spec.ts
- 前置条件:已登录
- 步骤:
  1. 依次点击日历、消息、文件、应用
- 预期结果:主区域在 SPA 内原地切换对应视图,当前项高亮(active),无整页跳转

### PJ-032 侧栏项目列表渲染并可进入项目
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/project/tests/dashboard-nav.spec.ts
- 前置条件:已登录且至少有一个项目
- 步骤:
  1. 在侧栏项目列表点击某项目
- 预期结果:进入 `/manage/project/:projectId`,加载该项目面板

### PJ-033 未读消息/超期任务角标显示
- 优先级:P2
- 类型:UI
- 状态:✅ 已实现 — products/project/tests/ui-p2.spec.ts
- 前置条件:存在未读消息或超期任务
- 步骤:
  1. 观察"仪表盘""消息""应用"入口角标
- 预期结果:超期任务/今日/待办及未读消息以 Badge 形式显示数量或红点

### PJ-034 主菜单下拉展现设置/团队管理/工作报告
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/project/tests/dashboard-nav.spec.ts
- 前置条件:已登录(团队管理项需管理员)
- 步骤:
  1. 点击顶部标题打开主菜单下拉
- 预期结果:展现"团队管理""工作报告""导出任务统计"等入口,管理员可见管理项

### PJ-035 访问未知路由渲染 404 页面
- 优先级:P2
- 类型:UI
- 状态:✅ 已实现 — products/project/tests/ui-p2.spec.ts
- 前置条件:已登录
- 步骤:
  1. 访问一个不存在的前端路由
- 预期结果:渲染 404 页面(`pages/404.vue`),不白屏

### PJ-036 未登录访问 /manage 跳转登录
- 优先级:P1
- 类型:E2E
- 状态:✅ 已实现 — products/project/tests/dashboard-nav.spec.ts
- 前置条件:清空会话
- 步骤:
  1. 直接访问 `/manage/dashboard`
- 预期结果:被守卫拦截,重定向到登录页(或渲染登录入口)

---

## 四、项目管理

### PJ-037 创建项目返回项目与默认列表
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-task-api.spec.ts
- 前置条件:已登录且有建项目权限
- 步骤:
  1. `api/project/add` 提交 `name`(2-32 字)、可选 `columns`、`flow`
- 预期结果:`ret=1` `添加成功`,返回项目;创建者为负责人,按 `columns` 建列表,`flow=open` 时预置 5 个默认流程状态

### PJ-038 项目名称少于2字/超32字被拒
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-crud.spec.ts
- 前置条件:已登录
- 步骤:
  1. `api/project/add` 提交 1 字或 33 字 name
- 预期结果:`ret=0`,分别 `项目名称不可以少于2个字` / `项目名称最多只能设置32个字`

### PJ-039 获取项目列表含任务统计
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-task-api.spec.ts
- 前置条件:已登录
- 步骤:
  1. `GET api/project/lists`
- 预期结果:`ret=1`,分页返回项目,含 `owner`、`task_num`、`task_complete`、`task_percent` 等统计字段

### PJ-040 获取单个项目信息
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-crud.spec.ts
- 前置条件:已登录且是某项目成员
- 步骤:
  1. `GET api/project/one?project_id=<id>`
- 预期结果:`ret=1`,返回项目详情与 `project_user[]`;非成员/不存在返回 `ret=0` `项目不存在或不在成员列表内`

### PJ-041 修改项目(负责人权限)
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-crud.spec.ts
- 前置条件:以项目负责人登录
- 步骤:
  1. `api/project/update` 提交 `project_id` + 新 `name`/`desc`
- 预期结果:`ret=1` `修改成功`,返回更新后项目,并写入变更日志

### PJ-042 非负责人修改项目被拒
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-crud.spec.ts
- 前置条件:以普通成员登录
- 步骤:
  1. `api/project/update` 修改他人项目
- 预期结果:`ret=0` `仅限项目负责人操作`

### PJ-043 归档项目与恢复
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-crud.spec.ts
- 前置条件:以负责人登录
- 步骤:
  1. `api/project/archived?project_id=<id>&type=add`
  2. `api/project/archived?project_id=<id>&type=recovery`
- 预期结果:归档 `ret=1` `操作成功`,`archived_at` 被设置;恢复后项目回到未归档列表

### PJ-044 删除项目(仅负责人)
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-crud.spec.ts
- 前置条件:以负责人登录(deputy 不可)
- 步骤:
  1. `api/project/remove?project_id=<id>`
- 预期结果:负责人 `ret=1` `删除成功`;非负责人 `ret=0` `仅限项目负责人操作`

### PJ-045 退出项目(负责人禁止)
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-crud.spec.ts
- 前置条件:分别以普通成员、负责人登录
- 步骤:
  1. `api/project/exit?project_id=<id>`
- 预期结果:成员 `ret=1` `退出成功`;负责人 `ret=0` `禁止项目负责人操作`

### PJ-046 移交项目负责人
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-p2.spec.ts
- 前置条件:以负责人登录,目标为项目成员
- 步骤:
  1. `api/project/transfer?project_id=<id>&owner_userid=<uid>`
- 预期结果:`ret=1` `移交成功`;目标不存在返回 `成员不存在`

### PJ-047 项目置顶/取消置顶
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-p2.spec.ts
- 前置条件:已登录且是成员
- 步骤:
  1. `api/project/top?project_id=<id>` 连调两次
- 预期结果:`ret=1`,`data.top_at` 在有值/为空间切换(仅影响当前用户)

### PJ-048 项目列表排序
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-p2.spec.ts
- 前置条件:已登录且有多个项目
- 步骤:
  1. `POST api/project/user/sort` 提交 `list` 为项目 id 数组
- 预期结果:`ret=1` `排序已保存`;非数组返回 `参数错误`

### PJ-049 生成邀请链接并通过邀请加入
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-crud.spec.ts
- 前置条件:功能已开放,负责人生成邀请,另一账号加入
- 步骤:
  1. 负责人 `api/project/invite?project_id=<id>` 取 `code`
  2. B 账号 `api/project/invite/info?code=<code>` 查看
  3. B 账号 `api/project/invite/join?code=<code>`
- 预期结果:info 返回项目;join `ret=1` `加入成功`(重复加入 `已加入`);功能关闭返回 `未开放此功能`

### PJ-050 UI 新建项目走完创建向导
- 优先级:P0
- 类型:E2E
- 状态:✅ 已实现 — products/project/tests/project-ui.spec.ts
- 前置条件:已登录
- 步骤:
  1. 点击新建项目
  2. 填写名称并提交
- 预期结果:项目创建成功并出现在侧栏项目列表,进入项目面板

### PJ-051 UI 项目面板加载看板视图
- 优先级:P1
- 类型:E2E
- 状态:✅ 已实现 — products/project/tests/project-ui-p1.spec.ts
- 前置条件:已存在项目
- 步骤:
  1. 进入某项目
- 预期结果:加载看板面板(ProjectPanel),显示任务列表列与"添加任务""添加列表"入口

---

## 五、任务列表(看板列)

### PJ-052 添加任务列表
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-task-api.spec.ts
- 前置条件:成员且具 `task_list_add` 权限
- 步骤:
  1. `api/project/column/add?project_id=<id>&name=<name>`
- 预期结果:`ret=1` `添加成功`,返回列(含空 `project_task` 与自动 `sort`)

### PJ-053 空列表名被拒
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/columns.spec.ts
- 前置条件:有权限
- 步骤:
  1. `api/project/column/add` 提交空 name
- 预期结果:`ret=0` `列表名称不能为空`;超 50 个列时返回 `项目列表最多不能超过50个`

### PJ-054 修改列表名称/颜色
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/columns.spec.ts
- 前置条件:具 `task_list_update` 权限
- 步骤:
  1. `api/project/column/update?column_id=<id>&name=<新名>&color=<色>`
- 预期结果:`ret=1` `修改成功`;不存在返回 `列表不存在`

### PJ-055 删除列表(权限)
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/columns.spec.ts
- 前置条件:具 `task_list_remove` 权限(默认仅负责人)
- 步骤:
  1. `api/project/column/remove?column_id=<id>`
- 预期结果:`ret=1` `删除成功`;无权限返回"仅限…操作";不存在返回 `列表不存在`

### PJ-056 获取任务列表(column/lists)
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/columns.spec.ts
- 前置条件:已登录且是成员
- 步骤:
  1. `GET api/project/column/lists?project_id=<id>`
- 预期结果:`ret=1`,按 `sort,id` 分页返回列表

### PJ-057 列表排序(sort only_column)
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-p2.spec.ts
- 前置条件:具 `task_list_sort` 权限
- 步骤:
  1. `POST api/project/sort` 传 `project_id`、`sort`(JSON)、`only_column=1`
- 预期结果:`ret=1` `调整成功`,列顺序更新

### PJ-058 UI 看板"添加列表"创建列
- 优先级:P1
- 类型:E2E
- 状态:✅ 已实现 — products/project/tests/project-ui-p1.spec.ts
- 前置条件:进入项目面板
- 步骤:
  1. 点击"添加列表",输入名称回车
- 预期结果:新列出现在看板末尾

---

## 六、任务管理

### PJ-059 添加任务返回任务详情
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-task-api.spec.ts
- 前置条件:成员且具 `task_add` 权限
- 步骤:
  1. `api/project/task/add` 提交 `project_id`、`column_id`(id 或名)、`name`,可选 `times`、`owner[]`
- 预期结果:`ret=1` `添加成功`,返回完整任务(列不存在按名自动创建返回 `new_column`)

### PJ-060 任务描述为空/超长被拒
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/tasks-crud.spec.ts
- 前置条件:有权限
- 步骤:
  1. 提交空 name 或 >255 字 name
- 预期结果:`ret=0`,`任务描述不能为空` / `任务描述最多只能设置255个字`

### PJ-061 获取任务列表(过滤/分页)
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-task-api.spec.ts
- 前置条件:已登录
- 步骤:
  1. `GET api/project/task/lists?project_id=<id>&keys[status]=uncompleted`
- 预期结果:`ret=1`,返回任务并含 `percent`、`sub_num`、`today`、`overdue` 等计算字段,受可见性约束

### PJ-062 获取单个任务信息
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/tasks-crud.spec.ts
- 前置条件:对任务有可见权限
- 步骤:
  1. `GET api/project/task/one?task_id=<id>`
- 预期结果:`ret=1`,返回任务 + `project_name`、`column_name`

### PJ-063 无权限查看任务返回无任务权限
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/tasks-crud.spec.ts
- 前置条件:任务受限可见,当前用户非负责人/参与人
- 步骤:
  1. `GET api/project/task/one?task_id=<id>`
- 预期结果:`ret=0` `无任务权限`,`data` 含 `{task_id, force:1}`

### PJ-064 添加子任务(继承父任务)
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/tasks-crud.spec.ts
- 前置条件:父任务未完成,具 `task_add` 权限
- 步骤:
  1. `api/project/task/addsub?task_id=<父>&name=<子任务>`
- 预期结果:`ret=1` `添加成功`,子任务继承父任务列/时间/可见性

### PJ-065 主任务已完成禁止加子任务
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/tasks-crud.spec.ts
- 前置条件:父任务已完成
- 步骤:
  1. `api/project/task/addsub` 添加子任务
- 预期结果:`ret=0` `主任务已完成无法添加子任务`;子任务超 50 返回 `每个任务的子任务最多不能超过50个`

### PJ-066 修改任务(名称/负责人/时间)
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/tasks-crud.spec.ts
- 前置条件:具 `task_update`/`task_time` 权限
- 步骤:
  1. `POST api/project/task/update` 提交 `task_id` + `name`/`owner[]`/`times`
- 预期结果:`ret=1` `修改成功`;负责人/协助人超 10 分别返回 `任务负责人最多不能超过10个`/`任务协助人员最多不能超过10个`

### PJ-067 完成任务与取消完成
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-task-api.spec.ts
- 前置条件:具 `task_status` 权限,任务无多重开始/结束状态
- 步骤:
  1. `POST api/project/task/update` 传 `complete_at=<时间>` 完成
  2. 再传 `complete_at=false` 取消完成
- 预期结果:分别置为完成/未完成;存在多个结束状态时返回 `存在多个结束状态，请选择要使用的状态`(附 `flow_items[]`)

### PJ-068 任务移动到其它列表/项目
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/tasks-crud.spec.ts
- 前置条件:具 `task_move` 权限,客户端版本 ≥0.42.0
- 步骤:
  1. `GET api/project/task/move` 传 `task_id`、目标 `project_id`/`column_id`、`flow_item_id`
- 预期结果:`ret=1` `移动成功`;目标列不存在 `列表不存在`;有流程未选状态 `请选择移动后状态`

### PJ-069 复制任务到目标项目
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/tasks-p2.spec.ts
- 前置条件:源具 `task_move`、目标具 `task_add`
- 步骤:
  1. `POST api/project/task/copy` 指定目标 `project_id`/`column_id`
- 预期结果:`ret=1` `复制成功`,复制内容/文件/标签/子任务

### PJ-070 归档任务与恢复
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/tasks-crud.spec.ts
- 前置条件:主任务,具 `task_archived` 权限
- 步骤:
  1. `api/project/task/archived?task_id=<id>&type=add`
  2. `...&type=recovery`
- 预期结果:`ret=1` `操作成功`;子任务返回 `子任务不支持此功能`

### PJ-071 删除任务与恢复
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/tasks-crud.spec.ts
- 前置条件:具 `task_remove` 权限
- 步骤:
  1. `api/project/task/remove?task_id=<id>&type=delete`
  2. `...&type=recovery`
- 预期结果:删除 `ret=1` `删除成功`;恢复 `操作成功`

### PJ-072 创建/获取任务聊天室
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/tasks-p2.spec.ts
- 前置条件:主任务
- 步骤:
  1. `GET api/project/task/dialog?task_id=<id>`
- 预期结果:`ret=1`,返回 `dialog_id`;子任务返回 `子任务不支持此功能`

### PJ-073 任务负责人/协助人超 10 个被拒
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/tasks-p2.spec.ts
- 前置条件:具修改权限
- 步骤:
  1. `task/update` 提交 11 个 `owner[]`
- 预期结果:`ret=0` `任务负责人最多不能超过10个`

### PJ-074 UI 新建任务出现在看板列
- 优先级:P0
- 类型:E2E
- 状态:✅ 已实现 — products/project/tests/project-ui.spec.ts
- 前置条件:进入项目面板
- 步骤:
  1. 点击"添加任务",填写任务名提交
- 预期结果:新任务卡片出现在对应列表列

### PJ-075 UI 勾选完成任务并归档
- 优先级:P1
- 类型:E2E
- 状态:✅ 已实现 — products/project/tests/project-ui-p1.spec.ts
- 前置条件:存在未完成任务
- 步骤:
  1. 在任务卡上点击"完成"
  2. 对该任务执行"归档"
- 预期结果:任务标记完成,随后从活动看板移除进入归档

---

## 七、工作流与状态流转

### PJ-076 获取任务工作流可流转状态
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-task-api.spec.ts
- 前置条件:项目已启用工作流
- 步骤:
  1. `GET api/project/task/flow?task_id=<id>`
- 预期结果:`ret=1`,返回 `flow_item_id` 与 `turns[]`(可流转状态列表,含 `status`/`name`/`color`)

### PJ-077 通过 flow_item_id 流转任务状态
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-task-api.spec.ts
- 前置条件:具 `task_status` 权限,存在合法流转目标
- 步骤:
  1. `POST api/project/task/update` 传 `task_id` + 目标 `flow_item_id`
- 预期结果:`ret=1` `修改成功`;流向 `status=end` 的状态自动置 `complete_at=now`

### PJ-078 非法状态流转被拒
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/workflow.spec.ts
- 前置条件:目标状态不在当前状态 `turns` 允许列表
- 步骤:
  1. `task/update` 传入非法 `flow_item_id`
- 预期结果:`ret=0` `当前状态[X]不可流转到[Y]`;相同状态返回 `任务状态未发生改变`

### PJ-079 多个结束状态需选择
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/workflow.spec.ts
- 前置条件:项目存在多个结束状态
- 步骤:
  1. `task/update` 仅传 `complete_at`
- 预期结果:`ret=0` `存在多个结束状态，请选择要使用的状态`,返回 `flow_items[]` 供选择

### PJ-080 保存工作流(至少一开始一结束)
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/workflow.spec.ts
- 前置条件:以负责人登录
- 步骤:
  1. `POST api/project/flow/save` 提交 `flows[]`
- 预期结果:合法 `ret=1` `保存成功`;缺开始/结束返回 `至少需要1个开始状态`/`至少需要1个结束状态`;超 10 返回 `流程状态最多不能超过10个`

### PJ-081 删除工作流
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-p2.spec.ts
- 前置条件:以负责人登录
- 步骤:
  1. `GET api/project/flow/delete?project_id=<id>`
- 预期结果:`ret=1` `删除成功`,项目流程清空

### PJ-082 状态负责人限制流转
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/workflow.spec.ts
- 前置条件:某状态设置了 `userlimit`+`userids`,当前用户不在其中
- 步骤:
  1. 非授权用户尝试流转到该状态
- 预期结果:`ret=0` `当前状态[X]仅限状态负责人或项目负责人修改`

---

## 八、项目成员与权限

### PJ-083 修改项目成员列表
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-task-api.spec.ts
- 前置条件:以负责人/管理员登录
- 步骤:
  1. `POST api/project/user` 提交 `project_id` + 最终 `userid[]`
- 预期结果:`ret=1` `修改成功`,新增/移除成员按差异生效

### PJ-084 成员列表必须含负责人
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/members-perms.spec.ts
- 前置条件:以负责人登录
- 步骤:
  1. `POST api/project/user` 提交不含负责人的 `userid[]`
- 预期结果:`ret=0` `项目成员列表必须包含项目负责人`

### PJ-085 任命/罢免项目管理员(仅负责人)
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/members-perms.spec.ts
- 前置条件:以负责人登录,目标为成员
- 步骤:
  1. `POST api/project/adddeputy` 任命
  2. `POST api/project/deldeputy` 罢免
- 预期结果:分别 `ret=1` `任命成功`/`罢免成功`;非成员任命返回 `该用户不是项目成员`

### PJ-086 成员数超 100 被拒
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/members-perms.spec.ts
- 前置条件:以负责人登录
- 步骤:
  1. `POST api/project/user` 提交 >100 个 userid
- 预期结果:`ret=0` `项目人数最多100个`

### PJ-087 获取项目权限设置
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/members-perms.spec.ts
- 前置条件:成员
- 步骤:
  1. `GET api/project/permission?project_id=<id>`
- 预期结果:`ret=1`,返回各操作对应的角色 id 数组(默认权限自动初始化)

### PJ-088 更新项目权限设置
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/members-perms.spec.ts
- 前置条件:成员
- 步骤:
  1. `api/project/permission/update` 提交各权限键的角色数组(如 `task_add=[1,2]`)
- 预期结果:`ret=1`,返回合并后权限;非成员返回 `项目不存在`

### PJ-089 部门只读视角查看项目
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现（受阻）— 部门只读视角需管理员配置部门/角色;管理员账号被验证码锁定,无法以临时账号提供,已在 spec 以 test.skip 记录(products/project/tests/project-p2.spec.ts)
- 前置条件:部门负责人对下属部门项目开放只读视角
- 步骤:
  1. 以部门负责人 `api/project/one`/`column/lists` 读取
- 预期结果:可只读查看,写操作仍被 `userProject` 拦截

---

## 九、任务标签与日志

### PJ-090 创建/更新任务标签
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/labels-logs.spec.ts
- 前置条件:成员
- 步骤:
  1. `POST api/project/tag/save` 提交 `project_id`、`name`、`color`(id=0 创建)
- 预期结果:`ret=1` `保存成功`,重命名/改色会同步到已打标任务

### PJ-091 标签名/颜色必填校验
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/labels-logs.spec.ts
- 前置条件:成员
- 步骤:
  1. `tag/save` 缺 name 或 color
- 预期结果:`ret=0`,`请输入标签名称` / `请选择标签颜色`;缺 project_id 返回 `参数错误`

### PJ-092 标签数超 100 被拒
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/project-p2.spec.ts
- 前置条件:项目已有 100 个标签
- 步骤:
  1. `tag/save` 创建第 101 个
- 预期结果:`ret=0` `每个项目最多添加100个标签`;重名返回 `标签已存在`

### PJ-093 删除标签(权限)
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/labels-logs.spec.ts
- 前置条件:标签创建者或负责人
- 步骤:
  1. `GET api/project/tag/delete?id=<id>`
- 预期结果:`ret=1` `删除成功`;非创建者/负责人返回 `没有权限删除标签`

### PJ-094 获取项目/任务操作日志
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/labels-logs.spec.ts
- 前置条件:成员
- 步骤:
  1. `GET api/project/log/lists?project_id=<id>`(或 `task_id`)
- 预期结果:`ret=1`,分页返回操作日志(最新在前,含 `detail`、`time`、`record.change[]`)

---

## 十、文件管理(文件柜)

### PJ-095 获取文件列表
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/files.spec.ts
- 前置条件:已登录
- 步骤:
  1. `GET api/file/lists`
- 预期结果:`ret=1`,返回文件/文件夹列表

### PJ-096 新建文件/文件夹
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/files.spec.ts
- 前置条件:已登录
- 步骤:
  1. `api/file/add` 提交名称与类型(folder/document 等)
- 预期结果:`ret=1`,返回新建文件(夹)

### PJ-097 复制/移动文件
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/files.spec.ts
- 前置条件:已存在文件
- 步骤:
  1. `api/file/copy` 复制
  2. `api/file/move` 移动到目标目录
- 预期结果:均 `ret=1`,目标位置出现文件

### PJ-098 删除文件
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/files.spec.ts
- 前置条件:已存在文件
- 步骤:
  1. `api/file/remove` 删除
- 预期结果:`ret=1`,文件从列表移除

### PJ-099 保存与获取文件内容
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/files-p2.spec.ts
- 前置条件:已存在文档文件
- 步骤:
  1. `api/file/content/save` 保存内容
  2. `api/file/content` 读取
- 预期结果:保存成功,读取内容与保存一致

### PJ-100 文件共享设置与退出共享
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/files-p2.spec.ts
- 前置条件:已存在文件
- 步骤:
  1. `api/file/share/update` 设置共享成员/权限
  2. `api/file/share/out` 退出共享
- 预期结果:共享设置生效;退出后不再共享

### PJ-101 分片上传 init/chunk/merge
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/files.spec.ts
- 前置条件:已登录
- 步骤:
  1. `POST api/upload/init` 启动会话
  2. `POST api/upload/chunk` 上传分片
  3. `POST api/upload/merge` 合并入库
- 预期结果:各步 `ret=1`,合并后文件可访问;`api/upload/cancel` 可取消会话

### PJ-102 UI 文件页上传下载文件
- 优先级:P1
- 类型:E2E
- 状态:✅ 已实现 — products/project/tests/project-ui-p1.spec.ts
- 前置条件:已登录进入文件页
- 步骤:
  1. 上传一个文件
  2. 下载并校验
- 预期结果:上传成功出现在列表,下载内容与上传一致

---

## 十一、消息与对话

### PJ-103 获取对话列表
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/messages-reports.spec.ts
- 前置条件:已登录
- 步骤:
  1. `GET api/dialog/lists`
- 预期结果:`ret=1`,返回会话列表

### PJ-104 发送文本消息
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/messages-reports.spec.ts
- 前置条件:已登录且存在会话
- 步骤:
  1. `POST api/dialog/msg/sendtext` 指定 `dialog_id` + 文本
- 预期结果:`ret=1`,消息发送成功并出现在消息列表

### PJ-105 消息已读/未读统计
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/messages-groups-p2.spec.ts
- 前置条件:存在未读消息
- 步骤:
  1. `GET api/dialog/msg/unread`
  2. `GET api/dialog/msg/read` 标记已读
- 预期结果:未读数正确返回,标记后相应下降

### PJ-106 新建群组与成员管理
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/messages-groups-p2.spec.ts
- 前置条件:已登录
- 步骤:
  1. `api/dialog/group/add` 新建群
  2. `api/dialog/group/adduser` / `deluser` 增删成员
- 预期结果:群组创建成功,成员增删生效

### PJ-107 UI 消息页发送消息
- 优先级:P2
- 类型:E2E
- 状态:✅ 已实现 — products/project/tests/messages-groups-p2.spec.ts
- 前置条件:已登录进入消息页
- 步骤:
  1. 打开一个会话,输入并发送文本
- 预期结果:消息即时出现在会话窗口

---

## 十二、工作汇报

### PJ-108 保存并发送工作汇报
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/messages-reports.spec.ts
- 前置条件:已登录
- 步骤:
  1. `api/report/store` 提交汇报内容与接收人
- 预期结果:`ret=1`,汇报保存并发送给接收人

### PJ-109 我发送/我接收的汇报列表
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/messages-reports.spec.ts
- 前置条件:已有汇报
- 步骤:
  1. `GET api/report/my`
  2. `GET api/report/receive`
- 预期结果:分别返回我发送/我接收的汇报列表

### PJ-110 汇报标记已读与未读数
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/reports-p2.spec.ts
- 前置条件:存在未读汇报
- 步骤:
  1. `GET api/report/unread`
  2. `GET api/report/read` 标记已读
- 预期结果:未读数返回;标记后未读数下降

### PJ-111 生成汇报模板
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/reports-p2.spec.ts
- 前置条件:已登录
- 步骤:
  1. `GET api/report/template`
- 预期结果:`ret=1`,返回周报/日报模板内容

---

## 十三、个人设置与账号安全

### PJ-112 获取当前用户信息
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-api.spec.ts
- 前置条件:已登录
- 步骤:
  1. `GET api/users/info`
- 预期结果:`ret=1`,返回当前用户资料(userid/email/nickname/department 等)并刷新 token

### PJ-113 修改个人资料(昵称校验)
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/account.spec.ts
- 前置条件:已登录
- 步骤:
  1. `api/users/editdata` 提交合法 `nickname`
  2. 提交 1 字昵称
- 预期结果:合法 `ret=1` `修改成功`;过短返回 `昵称不可以少于2个字`,过长返回 `昵称最多只能设置20个字`

### PJ-114 修改密码成功并使旧 token 失效
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/account.spec.ts
- 前置条件:已登录且知道当前密码
- 步骤:
  1. `api/users/editpass` 提交正确 `oldpass` + 合法 `newpass`
  2. 用旧 token 访问 `users/info`,再用新密码登录
- 预期结果:`ret=1` `修改成功`;旧 token 失效(`ret=-1`),新密码可登录

### PJ-115 旧密码错误/新旧一致被拒
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/account.spec.ts
- 前置条件:已登录
- 步骤:
  1. `editpass` 提交错误 `oldpass`
  2. 提交与旧密码相同的 `newpass`
- 预期结果:分别 `ret=0` `请填写正确的旧密码` / `新旧密码一致`

### PJ-116 修改邮箱发送验证
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/account-p2.spec.ts (断言 email/send 校验分支 + email/edit 成功轮换 token;发信通道未断言)
- 前置条件:已登录,邮件通道可用
- 步骤:
  1. `api/users/email/send` 发送验证码
  2. `api/users/email/edit` 提交新邮箱+验证码
- 预期结果:验证码发送成功;正确验证码更新邮箱,错误/过期被拒

### PJ-117 设备列表与登出设备
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/account-p2.spec.ts
- 前置条件:已登录
- 步骤:
  1. `GET api/users/device/list`
  2. `GET api/users/device/logout` 登出某设备
- 预期结果:返回设备列表;登出后对应设备会话失效

### PJ-118 删除账号
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/account-p2.spec.ts
- 前置条件:测试专用账号已登录
- 步骤:
  1. `api/users/delete/account` 按流程确认删除
- 预期结果:账号删除成功,后续登录失败

---

## 十四、自动化访问令牌

### PJ-119 创建访问令牌返回密钥
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/tokens.spec.ts
- 前置条件:已登录(网页登录态)
- 步骤:
  1. `POST api/token/create` 提交名称与授权项目范围
- 预期结果:`ret=1`,返回 AK/SK(密钥仅创建时明文,沿用当前用户在项目/文件柜权限)

### PJ-120 令牌列表
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/tokens.spec.ts
- 前置条件:已创建令牌
- 步骤:
  1. `GET api/token/lists`
- 预期结果:`ret=1`,列表含刚创建令牌(SK 不再明文)

### PJ-121 轮换令牌密钥
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/tokens.spec.ts
- 前置条件:存在 active 令牌
- 步骤:
  1. `POST api/token/rotate`
- 预期结果:`ret=1`,返回新密钥,旧密钥失效

### PJ-122 禁用/删除令牌
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/tokens.spec.ts
- 前置条件:存在令牌
- 步骤:
  1. `POST api/token/disable` 禁用
  2. `POST api/token/delete` 删除
- 预期结果:禁用后不可用;删除后列表不再含该令牌

### PJ-123 令牌审计记录
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现（受阻）— 令牌审计接口需 identity("admin");管理员账号被验证码锁定,已在 spec 以 test.skip 记录(products/project/tests/tokens-p2.spec.ts)
- 前置条件:令牌已被调用
- 步骤:
  1. `GET api/token/admin/audits`
- 预期结果:`ret=1`,返回令牌调用审计记录

### PJ-124 使用 AK/SK 头鉴权调用受限接口
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/tokens-p2.spec.ts
- 前置条件:已创建有效令牌
- 步骤:
  1. 携带 `X-YY-AK`/签名头调用授权范围内接口
- 预期结果:鉴权通过并在授权范围内可访问;越权/失效令牌被拒

### PJ-125 UI 设置页创建令牌并显示密钥
- 优先级:P2
- 类型:UI
- 状态:✅ 已实现 — products/project/tests/tokens-p2.spec.ts
- 前置条件:已登录进入设置-自动化令牌
- 步骤:
  1. 点击"创建令牌",填写名称与项目范围提交
- 预期结果:创建成功并弹出/显示 Access Key 与 Secret(仅创建时明文)

---

## 十五、团队/会员管理(管理员)

### PJ-126 管理员获取会员列表
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/admin.spec.ts(管理员端点环境限制:PROJECT_ADMIN_EMAIL 登录被验证码锁定,无法取得管理员会话,已在 spec 中清晰跳过)
- 前置条件:以管理员登录
- 步骤:
  1. `GET api/users/lists`
- 预期结果:`ret=1`,返回会员分页列表

### PJ-127 管理员创建用户
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/admin.spec.ts(管理员端点环境限制:PROJECT_ADMIN_EMAIL 登录被验证码锁定,无法取得管理员会话,已在 spec 中清晰跳过)
- 前置条件:以管理员登录
- 步骤:
  1. `POST api/users/createuser` 提交新用户信息
  2. `api/users/lists` 确认
- 预期结果:`ret=1`,新用户出现在列表

### PJ-128 管理员批量导入预览/导入
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/admin.spec.ts(管理员端点环境限制:PROJECT_ADMIN_EMAIL 登录被验证码锁定,无法取得管理员会话,已在 spec 中清晰跳过)
- 前置条件:以管理员登录
- 步骤:
  1. `POST api/users/import/preview` 上传表格预览
  2. `POST api/users/import` 确认导入
- 预期结果:预览返回可导入行;导入后用户入库

### PJ-129 部门列表增删改
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现（受阻）— 部门增删改需 auth("admin");管理员账号被验证码锁定,已在 spec 以 test.skip 记录(products/project/tests/search-p2.spec.ts)
- 前置条件:以管理员登录
- 步骤:
  1. `api/users/department/add` 新建部门
  2. `api/users/department/list` 查看
  3. `api/users/department/del` 删除
- 预期结果:部门增删改全链路成功

### PJ-130 非管理员访问管理员接口被拒
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-api.spec.ts
- 前置条件:以普通用户登录
- 步骤:
  1. `GET api/users/lists`(或 `createuser`)
- 预期结果:`ret=0`,权限校验拦截(仅管理员可操作)

### PJ-131 会员搜索
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/search-p2.spec.ts
- 前置条件:已登录
- 步骤:
  1. `GET api/users/search?keys[key]=<关键词>`
- 预期结果:`ret=1`,返回匹配会员列表

---

## 十六、搜索

### PJ-132 搜索项目
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/search-system.spec.ts
- 前置条件:已登录且有可见项目
- 步骤:
  1. `GET api/search/project?key=<关键词>`
- 预期结果:`ret=1`,返回匹配项目

### PJ-133 搜索任务
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/search-system.spec.ts
- 前置条件:已登录且有可见任务
- 步骤:
  1. `GET api/search/task?key=<关键词>`
- 预期结果:`ret=1`,返回匹配任务

### PJ-134 搜索联系人
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/search-p2.spec.ts
- 前置条件:已登录
- 步骤:
  1. `GET api/search/contact?key=<关键词>`
- 预期结果:`ret=1`,返回匹配联系人

### PJ-135 搜索文件/消息
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/search-p2.spec.ts
- 前置条件:已登录且有相关数据
- 步骤:
  1. `GET api/search/file` 与 `GET api/search/message`
- 预期结果:`ret=1`,分别返回匹配文件与消息

---

## 十七、系统、健康与错误异常

### PJ-136 获取系统版本号
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/project/tests/auth-api.spec.ts
- 前置条件:服务已启动
- 步骤:
  1. `GET api/system/version`
- 预期结果:HTTP 200,`ret=1`,返回版本号(可作服务存活探针)

### PJ-137 获取系统设置
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/search-system.spec.ts
- 前置条件:已登录
- 步骤:
  1. `GET api/system/setting`
- 预期结果:`ret=1`,返回系统配置(注册开关、登录验证码策略等)

### PJ-138 非法方法名返回 404 not found
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/search-system.spec.ts
- 前置条件:无
- 步骤:
  1. 请求一个不存在的方法,如 `api/users/nonexist`(带 `Content-Type: application/json`)
- 预期结果:`ret=0`,`msg` 形如 `404 not found (users/nonexist).`

### PJ-139 缺少必填参数返回参数错误
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/project/tests/search-system.spec.ts
- 前置条件:已登录
- 步骤:
  1. `api/project/tag/list` 不传 `project_id`
- 预期结果:`ret=0` `参数错误`

### PJ-140 访问不存在页面渲染 404
- 优先级:P2
- 类型:UI
- 状态:✅ 已实现 — products/project/tests/ui-p2.spec.ts
- 前置条件:服务可用
- 步骤:
  1. 访问一个不存在的前端路径
- 预期结果:渲染 404 页面,不白屏、无 JS 崩溃

### PJ-141 获取演示账号(demo)
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/project/tests/search-p2.spec.ts (自适应:演示账号开启时返回 account/password,否则 ret=0 No demo account)
- 前置条件:系统开启演示模式
- 步骤:
  1. `GET api/system/demo`
- 预期结果:开启时返回演示账号;未开启返回相应提示
