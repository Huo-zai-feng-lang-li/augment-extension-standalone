// 验证码获取模块
(() => {
  "use strict";

  // 工具函数
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (err) {
      if (err && err.name === "AbortError") {
        throw new Error(`请求超时(${timeoutMs}ms): ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(id);
    }
  };

  // 验证码提取函数 - 使用配置文件中的验证码规则
  const extractVerificationCode = (text, subject = "") => {
    if (!text) return null;

    // 获取配置中的验证码规则
    let minLength = 4,
      maxLength = 8,
      minValue = 1000,
      maxValue = 99999999;

    if (window.AugmentConfig && window.AugmentConfig.CONFIG.verificationCode) {
      const config = window.AugmentConfig.CONFIG.verificationCode;
      minLength = config.minLength || 4;
      maxLength = config.maxLength || 8;
      minValue = config.minValue || 1000;
      maxValue = config.maxValue || 99999999;
    }

    const patterns = [
      // 中文验证码模式 - 使用配置的长度范围
      new RegExp(`验证码[：:\\s]*(\\d{${minLength},${maxLength}})`, "i"),
      new RegExp(`验证码为[：:\\s]*(\\d{${minLength},${maxLength}})`, "i"),
      new RegExp(`您的验证码是[：:\\s]*(\\d{${minLength},${maxLength}})`, "i"),
      // 英文验证码模式 - 使用配置的长度范围
      new RegExp(
        `verification code[：:\\s]*(\\d{${minLength},${maxLength}})`,
        "i"
      ),
      new RegExp(`your code is[：:\\s]*(\\d{${minLength},${maxLength}})`, "i"),
      new RegExp(`code[：:\\s]*(\\d{${minLength},${maxLength}})`, "i"),
      new RegExp(`otp[：:\\s]*(\\d{${minLength},${maxLength}})`, "i"),
      // 通用数字模式 - 按优先级排序
      /\b(\d{6})\b/g,
      /\b(\d{4})\b/g,
      /\b(\d{5})\b/g,
      /\b(\d{8})\b/g,
    ];

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const matches = text.match(pattern);
      if (matches) {
        let code;
        if (pattern.global) {
          // 对于全局匹配，选择最可能的验证码 - 使用配置的数值范围
          const candidates = matches.filter((match) => {
            const num = parseInt(match);
            return num >= minValue && num <= maxValue; // 使用配置中的验证码范围
          });
          code =
            candidates[candidates.length - 1] || matches[matches.length - 1];
        } else {
          code = matches[1] || matches[0];
        }

        if (code) {
          return code;
        }
      }
    }

    return null;
  };

  // 临时邮箱验证码获取
  const fetchVerificationCodeFromTempEmail = async (email, token, timeout) => {
    if (!email || !token) {
      throw new Error("请先生成邮箱地址");
    }

    // 使用配置文件中的设置
    if (!window.AugmentConfig) {
      throw new Error("配置文件未加载，请确保config.js已正确引入");
    }

    const config = window.AugmentConfig.CONFIG;
    const actualTimeout = timeout || config.tempEmail.timeout;
    const apiUrl = config.tempEmail.apiUrl;

    try {
      // 添加超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), actualTimeout);

      const response = await fetch(`${apiUrl}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("邮箱授权已过期");
        }
        throw new Error(`获取邮件失败: HTTP ${response.status}`);
      }

      const emailsData = await response.json();
      const emails = emailsData["hydra:member"] || [];

      if (emails.length === 0) {
        throw new Error("暂无新邮件");
      }

      // 按时间排序，最新的在前
      emails.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // 查找最新的邮件并提取验证码
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];

        try {
          // 为邮件详情请求添加超时控制
          const detailController = new AbortController();
          const detailTimeoutId = setTimeout(
            () => detailController.abort(),
            3000
          );

          const emailDetailResponse = await fetch(
            `${apiUrl}/messages/${email.id}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              signal: detailController.signal,
            }
          );

          clearTimeout(detailTimeoutId);

          if (!emailDetailResponse.ok) {
            continue;
          }

          const emailDetail = await emailDetailResponse.json();
          const emailContent = emailDetail.text || emailDetail.html || "";
          const subject = emailDetail.subject || "";

          // 检查是否是验证码邮件
          const isVerificationEmail =
            emailContent.toLowerCase().includes("verification") ||
            emailContent.toLowerCase().includes("verify") ||
            emailContent.toLowerCase().includes("code") ||
            emailContent.toLowerCase().includes("otp") ||
            subject.toLowerCase().includes("verification") ||
            subject.toLowerCase().includes("verify") ||
            subject.toLowerCase().includes("code") ||
            subject.toLowerCase().includes("otp") ||
            /\d{4,8}/.test(emailContent);

          if (isVerificationEmail) {
            const code = extractVerificationCode(emailContent, subject);
            if (code) {
              return code;
            }
          }
        } catch (detailError) {
          continue; // 跳过错误的邮件
        }
      }

      throw new Error("未找到验证码");
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("获取验证码超时");
      } else {
        throw new Error(`获取验证码失败: ${error.message}`);
      }
    }
  };

  // Gmail验证码获取
  const fetchVerificationCodeFromGmail = async (timeout) => {
    // 使用配置文件中的设置
    if (!window.AugmentConfig) {
      throw new Error("配置文件未加载，请确保config.js已正确引入");
    }

    const config = window.AugmentConfig.CONFIG;
    const actualTimeout = timeout || config.cloudFunction.timeout;

    const response = await fetchWithTimeout(
      config.cloudFunction.url,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
      actualTimeout
    );

    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`);
    }

    const data = await response.json();
    if (data.code) {
      return data.code;
    } else {
      throw new Error("返回数据格式错误");
    }
  };

  // 导出到全局
  window.AugmentVerificationCode = {
    fetchVerificationCodeFromTempEmail,
    fetchVerificationCodeFromGmail,
    extractVerificationCode,
  };
})();
