// Augment扩展配置文件
// 请根据你的实际情况修改以下配置

(() => {
  "use strict";

  // 配置对象
  const CONFIG = {
    // Gmail配置
    gmail: {
      // 你的Gmail邮箱地址（不包含+号后缀）
      baseEmail: "zkaugment@gmail.com",
      // 随机后缀长度
      suffixLength: 6,
    },

    // 云函数配置
    cloudFunction: {
      // 腾讯云函数URL - 用于获取Gmail验证码
      url: "https://1374020289-cggtuxv2ih.ap-guangzhou.tencentscf.com/get_code",
      // 请求超时时间（毫秒）
      timeout: 8000,
    },

    // 临时邮箱配置
    tempEmail: {
      // Mail.tm API地址
      apiUrl: "https://api.mail.tm",
      // 用户名前缀
      usernamePrefix: "augment",
      // 密码前缀
      passwordPrefix: "@!Pass",
      // 请求超时时间（毫秒）
      timeout: 6000,
    },

    // 验证码配置
    verificationCode: {
      // 验证码长度范围
      minLength: 4,
      maxLength: 8,
      // 验证码数值范围
      minValue: 1000,
      maxValue: 99999999,
    },

    // 自动化配置
    automation: {
      // 邮箱生成倒计时（秒）
      emailGenerationCountdown: 5,
      // 验证码获取等待时间（秒）
      codeWaitTime: 5,
      // 各种操作的延迟时间（毫秒）
      delays: {
        afterEmailInput: 500,
        afterCodeInput: 500,
        betweenClicks: 200,
        formSubmission: 1000,
      },
    },

    // 页面元素选择器
    selectors: {
      // 邮箱输入框
      emailInput: 'input[name="username"]',
      // 验证码输入框
      codeInput: 'input[name="code"], input[id="code"]',
      // 提交按钮
      submitButton: 'button[type="submit"][name="action"]',
      // 继续按钮的备用选择器
      continueButton: 'button[type="submit"]',
    },

    // 调试配置
    debug: {
      // 是否启用调试模式
      enabled: false,
      // 是否显示详细日志
      verbose: false,
    },
  };

  // 配置验证函数
  const validateConfig = () => {
    const errors = [];

    // 验证Gmail配置
    if (!CONFIG.gmail.baseEmail || !CONFIG.gmail.baseEmail.includes("@")) {
      errors.push("Gmail邮箱地址配置无效");
    }

    // 验证云函数配置
    if (
      !CONFIG.cloudFunction.url ||
      !CONFIG.cloudFunction.url.startsWith("http")
    ) {
      errors.push("云函数URL配置无效");
    }

    // 验证临时邮箱配置
    if (
      !CONFIG.tempEmail.apiUrl ||
      !CONFIG.tempEmail.apiUrl.startsWith("http")
    ) {
      errors.push("临时邮箱API地址配置无效");
    }

    if (errors.length > 0) {
      console.error("配置验证失败:", errors);
      return false;
    }

    return true;
  };

  // 获取配置的便捷方法
  const getConfig = (path) => {
    const keys = path.split(".");
    let value = CONFIG;

    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  };

  // 生成Gmail别名邮箱
  const generateGmailAlias = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let randomSuffix = "";

    // 使用配置中的后缀长度
    const suffixLength = CONFIG.gmail.suffixLength || 5;

    for (let i = 0; i < suffixLength; i++) {
      randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const [localPart, domain] = CONFIG.gmail.baseEmail.split("@");
    return `${localPart}+${randomSuffix}@${domain}`;
  };

  // 导出到全局
  window.AugmentConfig = {
    CONFIG,
    validateConfig,
    getConfig,
    generateGmailAlias,
  };

  // 自动验证配置
  if (CONFIG.debug.enabled) {
    console.log("Augment配置已加载:", CONFIG);
    validateConfig();
  }
})();
