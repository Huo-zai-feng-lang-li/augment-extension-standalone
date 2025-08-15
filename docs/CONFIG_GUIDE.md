# Augment扩展配置指南

## 配置文件说明

所有敏感信息和个人配置都集中在 `config.js` 文件中，你只需要修改这一个文件即可完成所有配置。

## 必须修改的配置项

### 1. Gmail邮箱配置
```javascript
gmail: {
  // 替换为你的Gmail邮箱地址（不包含+号后缀）
  baseEmail: "your-email@gmail.com",  // ← 必须修改
  suffixLength: 5  // 随机后缀长度，一般不需要修改
}
```

### 2. 云函数配置
```javascript
cloudFunction: {
  // 替换为你的腾讯云函数URL
  url: "https://your-cloud-function-url.com/get_code",  // ← 必须修改
  timeout: 8000  // 请求超时时间，一般不需要修改
}
```

## 可选配置项

### 3. 临时邮箱配置
```javascript
tempEmail: {
  apiUrl: "https://api.mail.tm",  // 一般不需要修改
  usernamePrefix: "augment",      // 可以修改为你喜欢的前缀
  passwordPrefix: "@!Pass",       // 可以修改为你喜欢的前缀
  timeout: 6000                   // 请求超时时间
}
```

### 4. 自动化时间配置
```javascript
automation: {
  emailGenerationCountdown: 5,  // 邮箱生成倒计时（秒）
  codeWaitTime: 5,             // 验证码获取等待时间（秒）
  delays: {
    afterEmailInput: 500,      // 邮箱输入后延迟（毫秒）
    afterCodeInput: 500,       // 验证码输入后延迟（毫秒）
    betweenClicks: 200,        // 点击间隔（毫秒）
    formSubmission: 1000       // 表单提交延迟（毫秒）
  }
}
```

### 5. 页面元素选择器
```javascript
selectors: {
  emailInput: 'input[name="username"]',                    // 邮箱输入框
  codeInput: 'input[name="code"], input[id="code"]',      // 验证码输入框
  submitButton: 'button[type="submit"][name="action"]',    // 提交按钮
  continueButton: 'button[type="submit"]'                  // 继续按钮备用选择器
}
```

### 6. 调试配置
```javascript
debug: {
  enabled: false,   // 设置为true启用调试模式
  verbose: false    // 设置为true显示详细日志
}
```

## 配置步骤

1. **打开config.js文件**
2. **修改Gmail邮箱地址**：将 `your-email@gmail.com` 替换为你的实际Gmail地址
3. **修改云函数URL**：将 `https://your-cloud-function-url.com/get_code` 替换为你的实际云函数地址
4. **保存文件**
5. **重新加载扩展**（在Chrome扩展管理页面点击刷新按钮）

## 配置验证

配置完成后，你可以：

1. 在浏览器控制台中输入 `window.AugmentConfig.validateConfig()` 来验证配置是否正确
2. 启用调试模式（设置 `debug.enabled: true`）来查看详细的运行日志

## 注意事项

- 修改配置后需要重新加载Chrome扩展才能生效
- Gmail邮箱必须是真实有效的邮箱地址
- 云函数URL必须是完整的HTTPS地址
- 如果使用自定义云函数，确保返回格式为 `{"code": "验证码"}`

## 安全提醒

- 不要将包含真实邮箱和云函数URL的config.js文件分享给他人
- 在公开代码仓库中，建议创建config.example.js作为模板，真实的config.js加入.gitignore
