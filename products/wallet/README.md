# Wallet 端到端测试

本目录维护 YeYing Wallet 浏览器扩展的 Playwright 端到端测试、场景规格和辅助 fixture。测试覆盖扩展 popup、MV3 service worker、注入 Provider、签名审批窗口、云端托管和跨设备恢复。

## 运行

从 tester 仓库根目录执行，`WALLET_EXTENSION_PATH` 指向 Wallet 源码目录：

```bash
WALLET_EXTENSION_PATH=/path/to/wallet npx playwright test --project=wallet
```

先枚举用例：

```bash
WALLET_EXTENSION_PATH=/path/to/wallet npx playwright test --project=wallet --list
```

Wallet 使用真实 Chromium 扩展上下文，因此必须使用 headed Chromium；项目会串行运行，避免多个 MV3 service worker 和持久化 profile 互相干扰。真实链广播、已部署 DApp 和外部服务联调依赖对应环境配置；其余 UI 和协议场景默认使用本地 DApp 或受控服务 stub。

## 场景规格

- [钱包登录验收](./LOGIN_ACCEPTANCE.md)：账户连接、SIWE、Wallet Identity、Passkey、UCAN 的交互与安全边界。
- [云端密钥托管验收](./CUSTODY_ACCEPTANCE.md)：加密托管、同步、恢复、错误处理、数据完整性与隐私边界。
- [完整用例目录](../../docs/test-cases/wallet.md)：按功能和用例编号列出目前自动化覆盖及仍需真实服务联调的项目。

协议定义以 Wallet 仓库 `docs/protocols/` 为准；本目录的验收规格说明测试触发、步骤和期望结果。

## 自动化覆盖

| 范围                 | 主要测试文件                                                                                                                     | 覆盖内容                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 创建、导入和身份恢复 | `tests/popup-create*.spec.ts`、`tests/popup-import*.spec.ts`                                                                     | 创建 HD 钱包、多链账户导入、备份往返、错误口令和篡改文件拒绝。                                                |
| 账户、安全和网络     | `tests/popup-accounts.spec.ts`、`tests/popup-security.spec.ts`、`tests/popup-lock-unlock.spec.ts`、`tests/popup-network.spec.ts` | 账户增删改、秘密展示、改密、锁定、错误密码、重启恢复和网络切换。                                              |
| DApp Provider 和审批 | `tests/dapp-*.spec.ts`、`tests/popup-signature.spec.ts`                                                                          | Provider 发现、账户权限、拒绝、并发请求、链切换、交易、SIWE/ReCap 和结构化签名审批。                          |
| 云端托管与恢复       | `tests/custody-*.spec.ts`                                                                                                        | 配置、开启门槛、关闭回滚、恢复授权、密文篡改、结构/地址校验、多链账户恢复、Wallet Identity 跨设备恢复及登录。 |
| 多链交易             | `tests/popup-send-*.spec.ts`、`tests/popup-token*.spec.ts`                                                                       | EVM、Tron、Bitcoin、Solana 的费用、构造、签名和广播路径；部分真实链场景需要网络或测试网环境。                 |

当前端到端套件按 `--list` 枚举为 94 个测试、56 个 spec 文件。用例数会随覆盖变化，以 Playwright 实际枚举结果为准。Stub 测试证明 Wallet 客户端流程和请求边界，不代表真实 Node、Passkey、托管服务、RPC 或生产密钥安全联调通过；相关依赖未配置时应记录为未执行或环境阻塞，不能报告为通过。
