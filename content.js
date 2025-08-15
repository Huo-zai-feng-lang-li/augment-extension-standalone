(() => {
  "use strict";

  // 全局变量
  let currentEmail = "";
  let currentToken = "";
  let statusPanel = null;
  let pageObserver = null;
  let countdownInterval = null;
  let retryCountdownInterval = null;

  // 监听来自popup的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "startAutoRegister") {
      // 开始自动注册流程
      startAutoRegistrationFromPopup();
      sendResponse({ success: true });
    }
  });

  // 从popup启动自动注册的函数
  const startAutoRegistrationFromPopup = () => {
    try {
      // 检查是否已经有自动化控制器
      if (window.automationController) {
        // 如果控制器处于空闲状态，启动它
        if (
          window.automationController.state === window.AUTOMATION_STATES.IDLE
        ) {
          window.automationController.start();
          log("🚀 从popup启动自动注册", "success");
        } else {
          log("⚠️ 自动化流程已在进行中", "warning");
        }
      } else {
        // 如果没有控制器，等待页面初始化完成后再启动
        setTimeout(() => {
          if (window.automationController) {
            window.automationController.start();
            log("🚀 延迟启动自动注册", "success");
          } else {
            log("❌ 自动化控制器未初始化", "error");
          }
        }, 1000);
      }
    } catch (error) {
      log(`❌ 启动自动注册失败: ${error.message}`, "error");
    }
  };

  // 安全的模块访问函数
  const getStorageModule = () => window.AugmentStorage;
  const getEmailModule = () => window.AugmentEmailGenerator;
  const getVerificationModule = () => window.AugmentVerificationCode;

  // 兼容性函数 - 直接使用模块或回退到错误
  const loadEmailDataFromStorage = () => {
    const module = getStorageModule();
    if (module) return module.loadEmailDataFromStorage();
    log("存储模块未加载", "error");
    return null;
  };

  const clearEmailDataFromStorage = () => {
    const module = getStorageModule();
    if (module) return module.clearEmailDataFromStorage();
    log("存储模块未加载", "error");
    return false;
  };

  const loadGmailAliasFromStorage = () => {
    const module = getStorageModule();
    if (module) return module.loadGmailAliasFromStorage();
    log("存储模块未加载", "error");
    return null;
  };

  const clearGmailAliasFromStorage = () => {
    const module = getStorageModule();
    if (module) return module.clearGmailAliasFromStorage();
    log("存储模块未加载", "error");
    return false;
  };

  const generateGmailAliasEmail = () => {
    const module = getEmailModule();
    if (module) return module.generateGmailAliasEmail();
    log("邮箱生成模块未加载", "error");
    return null;
  };

  // 工具函数 - 优化版
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 增强日志工具 - 支持调试模式
  const log = (message, type = "info") => {
    const prefix = type === "error" ? "❌" : type === "success" ? "✅" : "ℹ️";
    updateStatus(prefix, message, type);

    // 检查调试模式
    try {
      if (window.AugmentConfig && window.AugmentConfig.CONFIG.debug?.enabled) {
        const timestamp = new Date().toLocaleTimeString();
        const debugPrefix = `[Augment ${timestamp}] ${prefix}`;

        if (window.AugmentConfig.CONFIG.debug.verbose || type === "error") {
          console.log(`${debugPrefix} ${message}`);
        }
      }
    } catch (error) {
      // 忽略调试日志错误，避免影响主功能
    }
  };

  // 配置检查和获取函数
  const getConfigSafely = () => {
    if (!window.AugmentConfig) {
      throw new Error("❌ 配置文件未加载！请确保 config.js 文件存在并正确配置");
    }

    const config = window.AugmentConfig.CONFIG;

    // 验证必要配置
    if (!config.gmail?.baseEmail || !config.gmail.baseEmail.includes("@")) {
      throw new Error(
        "❌ Gmail邮箱配置无效！请在 config.js 中设置正确的 gmail.baseEmail"
      );
    }

    if (
      !config.cloudFunction?.url ||
      !config.cloudFunction.url.startsWith("http")
    ) {
      throw new Error(
        "❌ 云函数URL配置无效！请在 config.js 中设置正确的 cloudFunction.url"
      );
    }

    return config;
  };

  // DOM 选择器 - 完全使用配置文件中的选择器
  const $ = {
    email: () => {
      try {
        const config = getConfigSafely();
        return document.querySelector(config.selectors.emailInput);
      } catch (error) {
        log(error.message, "error");
        return null;
      }
    },

    code: () => {
      try {
        const config = getConfigSafely();
        return document.querySelector(config.selectors.codeInput);
      } catch (error) {
        log(error.message, "error");
        return null;
      }
    },

    submitBtn: () => {
      try {
        const config = getConfigSafely();
        let btn = document.querySelector(config.selectors.submitButton);

        if (!btn) {
          // 备选方案：查找继续按钮
          btn = document.querySelector(config.selectors.continueButton);
        }

        return btn;
      } catch (error) {
        log(error.message, "error");
        return null;
      }
    },
  };

  // 临时邮箱验证码获取 - 优化版（减少等待时间，提高性能）
  window.getVerificationCodeFromTempEmail = async (maxWaitTime = 15000) => {
    const startTime = Date.now();
    const checkInterval = 3000; // 减少到每3秒检查一次
    let retryCount = 0;
    const maxRetries = Math.floor(maxWaitTime / checkInterval);

    // 使用 for 循环防止无限循环
    for (let i = 0; i < maxRetries; i++) {
      // 检查超时
      if (Date.now() - startTime >= maxWaitTime) {
        break;
      }

      try {
        retryCount++;
        const code = await fetchVerificationCode();
        if (code) {
          return code;
        }
      } catch (error) {
        // 静默处理错误，减少日志输出
      }

      // 如果不是最后一次尝试，则等待
      if (i < maxRetries - 1) {
        // 使用简单的setTimeout，避免复杂的requestIdleCallback
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      }
    }

    throw new Error(`超时：经过 ${retryCount} 次尝试，未能获取到验证码`);
  };

  // 使用模块化的验证码获取函数
  const fetchVerificationCode = async () => {
    const module = getVerificationModule();
    if (!module) {
      log("验证码模块未加载", "error");
      return null;
    }

    try {
      return await module.fetchVerificationCodeFromTempEmail(
        currentEmail,
        currentToken
      );
    } catch (error) {
      log(`验证码获取失败: ${error.message}`, "error");
      return null;
    }
  };

  // 注：已移除 popup 消息监听，使用默认配置

  // 🎨 美化的状态面板
  const createStatusPanel = () => {
    if (statusPanel) return;

    statusPanel = document.createElement("div");
    statusPanel.id = "augment-auto-panel";
    statusPanel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 380px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      overflow: hidden;
      animation: slideInUp 0.3s ease-out;
    `;

    statusPanel.innerHTML = `
      <style>
        @keyframes slideInUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .pulse { animation: pulse 2s infinite; }
      </style>

      <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%); color: white; padding: 18px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden;">
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><defs><pattern id=\"grain\" width=\"100\" height=\"100\" patternUnits=\"userSpaceOnUse\"><circle cx=\"50\" cy=\"50\" r=\"1\" fill=\"white\" opacity=\"0.1\"/></pattern></defs><rect width=\"100\" height=\"100\" fill=\"url(%23grain)\"/></svg>彩色之外微信公众号</div>
        <div style="position: relative; display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 20px;">♻️</span>
          <span style="font-size: 16px; font-weight: 700;">Augment 智能注册</span>
        </div>
        <button onclick="this.closest('#augment-auto-panel').style.display='none'" style="position: relative; background: rgba(255,255,255,0.2); border: none; color: white; cursor: pointer; font-size: 18px; padding: 6px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s; backdrop-filter: blur(10px);" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
      </div>

      <div style="padding: 20px;">
        <div id="auto-status-display" style="margin: 0 0 16px 0; padding: 14px; border-radius: 12px; font-size: 14px; line-height: 1.5; display: flex; align-items: center; gap: 10px; background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%); color: #1e40af; border: 1px solid rgba(59, 130, 246, 0.2);">
          <span class="pulse">🤖</span>
          <span><strong>智能模式已启用</strong> - 自动检测并完成注册</span>
        </div>

        <div style="width: 100%; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; margin: 16px 0; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
          <div id="auto-progress-fill" style="height: 100%; background: linear-gradient(90deg, #4f46e5, #7c3aed, #ec4899); border-radius: 4px; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); width: 0%; position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); animation: shimmer 2s infinite;"></div>
          </div>
        </div>

        <div id="auto-email-display" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 16px; border-radius: 12px; font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; font-size: 13px; word-break: break-all; margin: 16px 0; border: 1px solid #e2e8f0; color: #475569; box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);">
          <div style="color: #64748b; font-size: 11px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">临时邮箱地址</div>
          <div style="color: #1e293b; font-weight: 500;">等待生成...</div>
        </div>

        <div style="margin-top: 20px; padding: 16px; background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%); border-radius: 12px; font-size: 13px; color: #166534; text-align: center; border: 1px solid rgba(34, 197, 94, 0.2);">
          <div style="font-size: 16px; margin-bottom: 8px;">✨</div>
          <div style="font-weight: 600; margin-bottom: 4px;">智能邮箱注册</div>
          <div style="opacity: 0.8; line-height: 1.4;">支持Gmail和临时邮箱双重方案</div>
        </div>



        <div id="email-service-selector" style="margin-top: 16px; padding: 12px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 10px; border: 1px solid #e2e8f0;">
          <div style="font-size: 12px; color: #64748b; margin-bottom: 8px; font-weight: 600;">📧 邮件服务选择</div>
          <div style="display: flex; gap: 8px;">
            <button id="gmail-service-btn" style="flex: 1; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.2s; background: white; color: #475569;">
              📧 Gmail
            </button>
            <button id="temp-email-service-btn" style="flex: 1; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.2s; background: white; color: #475569;">
              📮 临时邮箱
            </button>
          </div>
          <div id="current-service-display" style="margin-top: 8px; font-size: 11px; color: #64748b; text-align: center;">
            当前服务: 检测中...
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button id="stop-countdown-btn" style="flex: 1; padding: 12px 16px; border: none; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; display: none; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 16px rgba(239, 68, 68, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(239, 68, 68, 0.3)'">⏹ 停止倒计时</button>
          <button id="start-manual-btn" style="flex: 1; padding: 12px 16px; border: none; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s; background: linear-gradient(135deg, #10b981, #059669); color: white; display: none; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 16px rgba(16, 185, 129, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.3)'">🚀 立即开始</button>
          <button id="manual-get-code-btn" style="flex: 1; padding: 12px 16px; border: none; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; display: none; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 16px rgba(59, 130, 246, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.3)'">📧 获取验证码</button>
        </div>
      </div>

      <style>
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      </style>
    `;

    document.body.appendChild(statusPanel);

    // 绑定按钮事件
    document
      .getElementById("stop-countdown-btn")
      .addEventListener("click", () => {
        // 使用新的自动化控制器
        if (window.automationController) {
          window.automationController.stop();
        } else {
          stopCountdown();
        }
      });

    document
      .getElementById("start-manual-btn")
      .addEventListener("click", () => {
        // 使用新的自动化控制器
        if (window.automationController) {
          window.automationController.start();
        } else {
          log("❌ 自动化控制器未初始化", "error");
        }
      });

    document
      .getElementById("manual-get-code-btn")
      .addEventListener("click", async () => {
        // 使用新的自动化控制器获取验证码
        if (window.automationController) {
          try {
            // 确保控制器状态正确
            if (
              window.automationController.state ===
              window.AUTOMATION_STATES.IDLE
            ) {
              await window.automationController.restoreEmailData();
            }

            // 直接获取和填写验证码
            await window.automationController.fetchVerificationCode();
            await window.automationController.fillVerificationCode();
          } catch (error) {
            updateStatus("❌", `获取验证码失败: ${error.message}`, "error");

            // 回退到手动获取方法
            try {
              await manualGetVerificationCode();
            } catch (fallbackError) {
              updateStatus(
                "❌",
                `获取验证码失败: ${fallbackError.message}`,
                "error"
              );
            }
          }
        } else {
          await manualGetVerificationCode();
        }
      });

    // 绑定邮件服务选择器事件
    document
      .getElementById("gmail-service-btn")
      .addEventListener("click", () => {
        switchEmailService("gmail");
      });

    document
      .getElementById("temp-email-service-btn")
      .addEventListener("click", () => {
        switchEmailService("temp_email");
      });

    // 更新当前服务显示
    updateCurrentServiceDisplay();
  };

  // 邮件服务切换 - 支持在倒计时期间切换
  let currentEmailService = "gmail"; // 默认使用Gmail

  const switchEmailService = async (serviceType) => {
    // 检查是否在倒计时期间（允许切换）
    const isCountdownActive =
      window.automationController &&
      window.automationController.state ===
        window.AUTOMATION_STATES.EMAIL_COUNTDOWN;

    if (
      !isCountdownActive &&
      window.automationController &&
      window.automationController.state !== window.AUTOMATION_STATES.IDLE
    ) {
      log(`⚠️ 自动化流程进行中，无法切换邮件服务`, "warning");
      updateStatus("⚠️", "自动化进行中，无法切换服务", "warning");
      return;
    }

    currentEmailService = serviceType;

    updateStatus(
      "📧",
      `服务切换: ${serviceType === "gmail" ? "Gmail" : "临时邮箱"}`,
      "info"
    );

    // 清除之前的邮箱数据，确保生成新的对应类型邮箱
    if (serviceType === "gmail") {
      // 切换到Gmail时，清除临时邮箱数据
      clearEmailDataFromStorage();
    } else {
      // 切换到临时邮箱时，清除Gmail别名数据
      clearGmailAliasFromStorage();
    }

    // 清除当前控制器中的邮箱数据
    if (window.automationController) {
      window.automationController.currentEmail = null;
      window.automationController.currentToken = null;
      window.automationController.currentAccountId = null;
    }

    updateCurrentServiceDisplay();
  };

  // 更新当前服务显示
  const updateCurrentServiceDisplay = async () => {
    const currentServiceDisplay = document.getElementById(
      "current-service-display"
    );
    const gmailBtn = document.getElementById("gmail-service-btn");
    const tempEmailBtn = document.getElementById("temp-email-service-btn");

    if (!currentServiceDisplay || !gmailBtn || !tempEmailBtn) {
      return;
    }

    // 显示当前选择的服务
    const serviceName = currentEmailService === "gmail" ? "Gmail" : "临时邮箱";
    currentServiceDisplay.textContent = `当前服务: ${serviceName}`;

    // 更新按钮样式
    const activeStyle =
      "background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border-color: #2563eb;";
    const inactiveStyle =
      "background: white; color: #475569; border-color: #e2e8f0;";

    if (currentEmailService === "gmail") {
      gmailBtn.style.cssText =
        gmailBtn.style.cssText.replace(
          /background[^;]*;|color[^;]*;|border-color[^;]*;/g,
          ""
        ) + activeStyle;
      tempEmailBtn.style.cssText =
        tempEmailBtn.style.cssText.replace(
          /background[^;]*;|color[^;]*;|border-color[^;]*;/g,
          ""
        ) + inactiveStyle;
    } else {
      gmailBtn.style.cssText =
        gmailBtn.style.cssText.replace(
          /background[^;]*;|color[^;]*;|border-color[^;]*;/g,
          ""
        ) + inactiveStyle;
      tempEmailBtn.style.cssText =
        tempEmailBtn.style.cssText.replace(
          /background[^;]*;|color[^;]*;|border-color[^;]*;/g,
          ""
        ) + activeStyle;
    }
  };

  // 更新状态显示
  // 🎨 美化的状态更新
  const updateStatus = (icon, message, type = "info") => {
    const statusDisplay = document.getElementById("auto-status-display");
    if (statusDisplay) {
      const styles = {
        info: {
          bg: "linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)",
          color: "#1e40af",
          iconClass: "pulse",
        },
        success: {
          bg: "linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%)",
          color: "#166534",
          iconClass: "",
        },
        warning: {
          bg: "linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)",
          color: "#92400e",
          iconClass: "pulse",
        },
        error: {
          bg: "linear-gradient(135deg, #fee2e2 0%, #fef2f2 100%)",
          color: "#991b1b",
          iconClass: "pulse",
        },
      };

      const style = styles[type] || styles.info;
      statusDisplay.style.background = style.bg;
      statusDisplay.style.color = style.color;
      statusDisplay.innerHTML = `
        <span class="${style.iconClass}" style="font-size: 16px;">${icon}</span>
        <span style="font-weight: 600; margin-left: 8px;">${message}</span>
      `;
    }
  };

  // 🎨 美化的邮箱显示
  const updateEmailDisplay = (email) => {
    const emailDisplay = document.getElementById("auto-email-display");
    if (emailDisplay) {
      emailDisplay.innerHTML = `
        <div style="color: #64748b; font-size: 11px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
          <span>📧</span>
          <span>专属临时邮箱</span>
        </div>
        <div style="color: #1e293b; font-weight: 600; font-size: 14px; word-break: break-all; line-height: 1.4; padding: 8px 12px; background: rgba(255,255,255,0.8); border-radius: 8px; border: 1px solid #e2e8f0;">
          ${email}
        </div>
        <div style="color: #64748b; font-size: 10px; margin-top: 6px; text-align: center; opacity: 0.8;">
          ✨ 自动生成 • 安全可靠 • 即用即弃
        </div>
      `;
    }
  };

  // 更新进度条
  const updateProgress = (percentage) => {
    const progressFill = document.getElementById("auto-progress-fill");
    if (progressFill) {
      progressFill.style.width = `${percentage}%`;
    }
  };

  // 停止倒计时
  const stopCountdown = () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;

      updateStatus("⏹️", "倒计时已停止，可手动开始", "info");

      // 显示手动开始按钮，隐藏停止按钮
      const stopBtn = document.getElementById("stop-countdown-btn");
      const startBtn = document.getElementById("start-manual-btn");
      if (stopBtn) stopBtn.style.display = "none";
      if (startBtn) startBtn.style.display = "block";
    }
  };

  // 手动获取验证码功能 - 根据邮箱类型调用不同方法
  const manualGetVerificationCode = async () => {
    // 检查是否有邮箱数据
    const gmailAlias = loadGmailAliasFromStorage();
    const tempEmailData = loadEmailDataFromStorage();

    if (!gmailAlias && !tempEmailData) {
      updateStatus("❌", "请先生成邮箱地址", "error");
      return;
    }

    updateStatus("📧", "正在获取验证码...", "info");

    try {
      let code = null;

      if (gmailAlias) {
        // Gmail别名邮箱：调用云函数获取验证码
        updateStatus("📧", "正在从Gmail获取验证码...", "info");

        const verificationModule = getVerificationModule();
        if (!verificationModule) {
          updateStatus("❌", "验证码模块未加载", "error");
          return;
        }

        try {
          code = await verificationModule.fetchVerificationCodeFromGmail(10000);
          currentEmail = gmailAlias; // 更新当前邮箱
        } catch (error) {
          updateStatus("❌", `Gmail验证码获取失败: ${error.message}`, "error");
          return;
        }
      } else if (tempEmailData) {
        // 临时邮箱：使用生成的账号信息调用验证码接口
        updateStatus("📧", "正在从临时邮箱获取验证码...", "info");

        const verificationModule = getVerificationModule();
        if (!verificationModule) {
          updateStatus("❌", "验证码模块未加载", "error");
          return;
        }

        try {
          code = await verificationModule.fetchVerificationCodeFromTempEmail(
            tempEmailData.email,
            tempEmailData.token
          );
          currentEmail = tempEmailData.email; // 更新当前邮箱
          currentToken = tempEmailData.token; // 更新当前token
        } catch (error) {
          updateStatus(
            "❌",
            `临时邮箱验证码获取失败: ${error.message}`,
            "error"
          );
          return;
        }
      }

      if (code) {
        // 复制验证码到剪贴板
        try {
          await navigator.clipboard.writeText(code);

          updateStatus("📋", `验证码已复制到剪贴板: ${code}`, "success");

          // 显示提示信息
          setTimeout(() => {
            updateStatus(
              "💡",
              "验证码已在剪贴板中，可直接粘贴使用 (Ctrl+V)",
              "info"
            );
          }, 2000);
        } catch (error) {
          // 如果剪贴板API不可用，显示验证码让用户手动复制

          updateStatus("📋", `验证码: ${code} (请手动复制)`, "info");
        }
      } else {
        throw new Error("未获取到验证码");
      }
    } catch (error) {
      updateStatus("❌", `获取失败: ${error.message}`, "error");
    }
  };

  // 显示手动获取验证码按钮
  const showManualGetCodeButton = () => {
    const manualBtn = document.getElementById("manual-get-code-btn");
    const stopBtn = document.getElementById("stop-countdown-btn");
    const startBtn = document.getElementById("start-manual-btn");

    if (manualBtn) {
      manualBtn.style.display = "block";
      manualBtn.innerHTML = "📧 获取验证码";
    }
    if (stopBtn) stopBtn.style.display = "none";
    if (startBtn) startBtn.style.display = "none";
  };

  // 检测页面类型
  const detectPageType = () => {
    const hasEmailInput = !!$.email();
    const hasCodeInput = !!$.code();

    if (hasEmailInput) {
      return "email";
    } else if (hasCodeInput) {
      return "code";
    } else {
      return "unknown";
    }
  };

  // 简化版：无需初始化邮件管理器
  const initEmailManager = async () => {
    log("📧 简化版扩展：使用 Gmail + 临时邮箱方案", "info");
    return true;
  };

  // 重置所有状态标志
  const resetAllStates = () => {
    // 清除所有定时器
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (retryCountdownInterval) {
      clearInterval(retryCountdownInterval);
      retryCountdownInterval = null;
    }
  };

  // 简化的初始化函数 - 等待模块加载后初始化
  const init = async () => {
    const isTargetPage = window.location.href.includes("augmentcode.com");

    if (!isTargetPage) {
      return;
    }

    try {
      // 检查配置文件是否已加载
      try {
        getConfigSafely();
      } catch (configError) {
        log(configError.message, "error");
        updateStatus("❌", "配置文件错误，请检查 config.js", "error");
        return;
      }

      // 检查模块是否已加载
      if (
        !window.AugmentStorage ||
        !window.AugmentEmailGenerator ||
        !window.AugmentVerificationCode
      ) {
        log("插件模块未完全加载，等待模块加载...", "warning");
        // 延迟重试而不是抛出错误
        setTimeout(() => {
          if (window.location.href.includes("augmentcode.com")) {
            init();
          }
        }, 2000);
        return;
      }

      // 重置所有状态
      resetAllStates();

      // 初始化邮件管理器
      await initEmailManager();

      // 创建状态面板
      createStatusPanel();

      // 恢复邮箱状态到新控制器
      await restoreEmailStateToController();

      // 检测页面类型
      const pageType = detectPageType();

      // 启动新的自动化控制器
      setTimeout(() => {
        if (
          window.automationController &&
          window.automationController.state === window.AUTOMATION_STATES.IDLE
        ) {
          window.automationController.start();
        }
      }, 500);

      if (pageType === "unknown") {
        updateStatus("ℹ️", "等待检测到注册页面...", "info");
        observePageChangesSimple();
      }

      log("🎯 Augment 插件初始化完成", "success");
    } catch (error) {
      console.error("插件初始化失败:", error);
      updateStatus("❌", `插件初始化失败: ${error.message}`, "error");
    }
  };

  // 恢复邮箱状态到新控制器
  const restoreEmailStateToController = async () => {
    if (!window.automationController) return;

    const existingGmailAlias = loadGmailAliasFromStorage();
    const storedEmailData = loadEmailDataFromStorage();

    if (existingGmailAlias) {
      window.automationController.currentEmail = existingGmailAlias;
      log(`♻️ 控制器恢复Gmail别名邮箱: ${existingGmailAlias}`, "success");
      updateEmailDisplay(existingGmailAlias);
    } else if (storedEmailData) {
      window.automationController.currentEmail = storedEmailData.email;
      window.automationController.currentToken = storedEmailData.token;
      window.automationController.currentAccountId = storedEmailData.accountId;
      log(`♻️ 控制器恢复临时邮箱: ${storedEmailData.email}`, "success");
      updateEmailDisplay(storedEmailData.email);
    }
  };

  // 防抖函数
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // 简化的页面观察器 - 避免与新控制器冲突
  const observePageChangesSimple = () => {
    if (pageObserver) {
      pageObserver.disconnect();
    }

    // 防抖的页面检测函数
    const debouncedPageDetection = debounce((pageType) => {
      if (pageType !== "unknown") {
        log(`🔄 页面变化检测到: ${pageType}`, "info");
        // 让新控制器处理页面变化
        if (
          window.automationController &&
          window.automationController.state === window.AUTOMATION_STATES.IDLE
        ) {
          setTimeout(() => {
            window.automationController.start();
          }, 1000);
        }
      }
    }, 1000);

    pageObserver = new MutationObserver(() => {
      // 只做基本的页面变化检测，不触发自动化
      const pageType = detectPageType();
      debouncedPageDetection(pageType);
    });

    pageObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  // 清理函数
  const cleanup = () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (retryCountdownInterval) {
      clearInterval(retryCountdownInterval);
      retryCountdownInterval = null;
    }
    if (pageObserver) {
      pageObserver.disconnect();
      pageObserver = null;
    }
    log("🧹 扩展资源已清理", "info");
  };

  // 页面卸载时清理资源
  window.addEventListener("beforeunload", cleanup);
  window.addEventListener("unload", cleanup);

  // 页面加载完成后初始化
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init();
    });
  } else {
    setTimeout(() => {
      init();
    }, 1000);
  }

  // ===== 新的自动化控制器 =====

  // 自动化状态枚举
  window.AUTOMATION_STATES = {
    IDLE: "idle",
    EMAIL_COUNTDOWN: "email_countdown",
    EMAIL_GENERATION: "email_generation",
    EMAIL_FILLING: "email_filling",
    CODE_WAITING: "code_waiting",
    CODE_FETCHING: "code_fetching",
    CODE_FILLING: "code_filling",
    COMPLETED: "completed",
    ERROR: "error",
  };

  // 获取选择器配置 - 从配置文件中读取
  const getSelectors = () => {
    try {
      const config = getConfigSafely();
      return {
        EMAIL_INPUT: config.selectors.emailInput,
        EMAIL_SUBMIT: config.selectors.submitButton,
        CODE_INPUT: config.selectors.codeInput,
        CODE_SUBMIT: config.selectors.submitButton,
      };
    } catch (error) {
      log(error.message, "error");
      throw error;
    }
  };

  // 动态获取选择器
  const getSelectorsSafely = () => {
    try {
      return getSelectors();
    } catch (error) {
      updateStatus("❌", "配置文件错误，请检查 config.js", "error");
      throw error;
    }
  };

  // 自动化控制器类
  window.AutomationController = class AutomationController {
    constructor() {
      this.state = window.AUTOMATION_STATES.IDLE;
      this.currentEmail = null;
      this.currentToken = null;
      this.currentAccountId = null;
      this.timers = new Map();
      this.retryCount = 0;
      this.maxRetries = 3;
    }

    // 启动自动化流程
    async start() {
      if (this.state !== window.AUTOMATION_STATES.IDLE) {
        log("⚠️ 自动化流程已在运行中", "warning");
        return;
      }

      log("🚀 启动新的自动化注册流程", "info");
      this.setState(window.AUTOMATION_STATES.EMAIL_COUNTDOWN);

      const pageType = this.detectPageType();
      log(`📄 检测页面类型: ${pageType}`, "info");

      try {
        if (pageType === "email") {
          await this.startEmailFlow();
        } else if (pageType === "code") {
          await this.startCodeFlow();
        } else {
          throw new Error("未识别的页面类型");
        }
      } catch (error) {
        this.handleError(error.message);
      }
    }

    // 停止自动化流程
    stop() {
      log("⏹️ 停止自动化流程", "info");
      this.clearAllTimers();
      this.setState(window.AUTOMATION_STATES.IDLE);
      updateStatus("⏹️", "自动化流程已停止", "info");
    }

    // 设置状态
    setState(newState) {
      log(`🔄 状态变更: ${this.state} -> ${newState}`, "info");
      this.state = newState;
    }

    // 清理所有定时器
    clearAllTimers() {
      for (const [name, timerId] of this.timers) {
        clearInterval(timerId);
        clearTimeout(timerId);
        log(`🛑 清理定时器: ${name}`, "info");
      }
      this.timers.clear();
    }

    // 检测页面类型
    detectPageType() {
      try {
        const selectors = getSelectors();
        const emailInput = document.querySelector(selectors.EMAIL_INPUT);
        const codeInput = document.querySelector(selectors.CODE_INPUT);

        if (emailInput) return "email";
        if (codeInput) return "code";
        return "unknown";
      } catch (error) {
        log(`页面类型检测失败: ${error.message}`, "error");
        return "unknown";
      }
    }

    // 邮箱流程：倒计时 -> 生成邮箱 -> 填写 -> 提交
    async startEmailFlow() {
      try {
        // 步骤1：5秒倒计时
        await this.emailCountdown();

        // 步骤2：生成邮箱
        await this.generateEmail();

        // 步骤3：填写邮箱
        await this.fillEmail();

        // 步骤4：提交表单
        await this.submitEmailForm();
      } catch (error) {
        this.handleError(`邮箱流程失败: ${error.message}`);
      }
    }

    // 验证码流程：等待 -> 获取验证码 -> 填写 -> 完成
    async startCodeFlow() {
      try {
        // 步骤1：恢复邮箱数据
        await this.restoreEmailData();

        // 步骤2：等待验证码邮件
        await this.waitForCodeEmail();

        // 步骤3：获取验证码
        await this.fetchVerificationCode();

        // 步骤4：填写验证码
        await this.fillVerificationCode();
      } catch (error) {
        this.handleError(`验证码流程失败: ${error.message}`);
      }
    }

    // 处理错误
    handleError(message) {
      this.setState(window.AUTOMATION_STATES.ERROR);
      updateStatus("❌", `自动化失败: ${message}`, "error");
      this.clearAllTimers();

      // 显示手动获取验证码按钮
      if (this.currentEmail && this.currentToken) {
        setTimeout(() => {
          showManualGetCodeButton();
        }, 2000);
      }
    }

    // ===== 邮箱流程方法 =====

    // 邮箱生成倒计时 - 使用配置文件中的时间
    async emailCountdown() {
      this.setState(window.AUTOMATION_STATES.EMAIL_COUNTDOWN);

      const config = getConfigSafely();
      const countdownTime = config.automation?.emailGenerationCountdown || 5;

      updateStatus(
        "⏰",
        `邮箱生成阶段：${countdownTime}秒倒计时开始...`,
        "info"
      );

      // 显示停止倒计时按钮
      const stopBtn = document.getElementById("stop-countdown-btn");
      if (stopBtn) {
        stopBtn.style.display = "block";
        stopBtn.onclick = () => {
          log("⏹️ 用户停止倒计时", "info");
          this.stop();
          stopBtn.style.display = "none";
          const startBtn = document.getElementById("start-manual-btn");
          if (startBtn) startBtn.style.display = "block";
        };
      }

      return new Promise((resolve) => {
        let countdown = countdownTime;
        const timerId = setInterval(() => {
          updateStatus("⏰", `${countdown}秒后自动生成邮箱...`, "info");
          updateProgress(((countdownTime - countdown) / countdownTime) * 100);

          countdown--;

          if (countdown < 0) {
            clearInterval(timerId);
            this.timers.delete("countdown");
            if (stopBtn) stopBtn.style.display = "none";

            resolve();
          }
        }, 1000);

        this.timers.set("countdown", timerId);
      });
    }

    // 生成邮箱
    async generateEmail() {
      this.setState(window.AUTOMATION_STATES.EMAIL_GENERATION);

      updateStatus("📧", "正在生成邮箱地址...", "info");
      updateProgress(30);

      try {
        // 根据用户选择的邮箱服务类型生成邮箱
        if (currentEmailService === "gmail") {
          // Gmail别名模式
          const existingGmailAlias = loadGmailAliasFromStorage();

          if (existingGmailAlias) {
            // 使用现有Gmail别名邮箱
            this.currentEmail = existingGmailAlias;
            updateEmailDisplay(this.currentEmail);

            updateStatus(
              "♻️",
              `使用现有Gmail别名: ${this.currentEmail}`,
              "success"
            );
            return;
          }

          // 生成新的Gmail别名
          updateStatus("📧", "正在生成Gmail别名邮箱...", "info");
          this.currentEmail = generateGmailAliasEmail();
          updateEmailDisplay(this.currentEmail);

          updateStatus(
            "✨",
            `Gmail别名生成成功: ${this.currentEmail}`,
            "success"
          );
        } else {
          // 临时邮箱模式
          const storedEmailData = loadEmailDataFromStorage();

          if (storedEmailData) {
            // 使用现有临时邮箱数据
            this.currentEmail = storedEmailData.email;
            this.currentToken = storedEmailData.token;
            this.currentAccountId = storedEmailData.accountId;
            updateEmailDisplay(this.currentEmail);

            updateStatus(
              "♻️",
              `使用现有临时邮箱: ${this.currentEmail}`,
              "success"
            );
            return;
          }

          // 生成新的临时邮箱
          updateStatus("📧", "正在生成临时邮箱...", "info");
          const emailModule = getEmailModule();
          if (!emailModule) {
            updateStatus("❌", "邮箱生成模块未加载", "error");
            throw new Error("邮箱生成模块未加载");
          }

          try {
            const emailData = await emailModule.generateTempEmail();
            this.currentEmail = emailData.email;
            this.currentToken = emailData.token;
            this.currentAccountId = emailData.accountId;
          } catch (error) {
            updateStatus("❌", `临时邮箱生成失败: ${error.message}`, "error");
            throw new Error(`临时邮箱生成失败: ${error.message}`);
          }

          updateEmailDisplay(this.currentEmail);

          updateStatus(
            "✨",
            `临时邮箱生成成功: ${this.currentEmail}`,
            "success"
          );
        }

        updateProgress(50);
      } catch (error) {
        throw new Error(`邮箱生成失败: ${error.message}`);
      }
    }

    // 填写邮箱
    async fillEmail() {
      this.setState(window.AUTOMATION_STATES.EMAIL_FILLING);

      updateStatus("📝", "正在填写邮箱地址...", "info");
      updateProgress(70);

      try {
        const selectors = getSelectors();
        const emailInput = document.querySelector(selectors.EMAIL_INPUT);
        if (!emailInput) {
          throw new Error(`未找到邮箱输入框 (${selectors.EMAIL_INPUT})`);
        }

        if (!this.currentEmail) {
          throw new Error("邮箱地址为空");
        }

        // 清空并填写邮箱
        emailInput.value = "";
        emailInput.focus();

        // 模拟用户输入
        const config = getConfigSafely();
        const inputDelay = config.automation?.delays?.afterEmailInput || 50;

        for (let i = 0; i < this.currentEmail.length; i++) {
          emailInput.value += this.currentEmail[i];
          emailInput.dispatchEvent(new Event("input", { bubbles: true }));
          await sleep(inputDelay); // 使用配置中的延迟时间
        }

        emailInput.dispatchEvent(new Event("change", { bubbles: true }));
        emailInput.blur();

        updateStatus("✅", "邮箱地址填写完成", "success");
        updateProgress(80);
      } catch (error) {
        throw new Error(`填写邮箱失败: ${error.message}`);
      }
    }

    // 提交邮箱表单
    async submitEmailForm() {
      updateStatus("🚀", "正在提交邮箱表单...", "info");
      updateProgress(90);

      try {
        const selectors = getSelectors();
        const submitBtn = document.querySelector(selectors.EMAIL_SUBMIT);
        if (!submitBtn) {
          throw new Error(`未找到提交按钮 (${selectors.EMAIL_SUBMIT})`);
        }

        // 点击提交按钮
        submitBtn.click();

        updateStatus(
          "✅",
          "邮箱表单提交完成，等待跳转到验证码页面...",
          "success"
        );
        updateProgress(100);

        this.setState(window.AUTOMATION_STATES.COMPLETED);
      } catch (error) {
        throw new Error(`提交邮箱表单失败: ${error.message}`);
      }
    }

    // ===== 验证码流程方法 =====

    // 恢复邮箱数据
    async restoreEmailData() {
      updateStatus("🔄", "正在恢复邮箱数据...", "info");

      // 检查现有邮箱数据
      const existingGmailAlias = loadGmailAliasFromStorage();
      const storedEmailData = loadEmailDataFromStorage();

      if (existingGmailAlias) {
        this.currentEmail = existingGmailAlias;
        log(`♻️ 恢复Gmail别名邮箱: ${this.currentEmail}`, "success");
        updateEmailDisplay(this.currentEmail);
      } else if (storedEmailData) {
        this.currentEmail = storedEmailData.email;
        this.currentToken = storedEmailData.token;
        this.currentAccountId = storedEmailData.accountId;
        log(`♻️ 恢复临时邮箱: ${this.currentEmail}`, "success");
        updateEmailDisplay(this.currentEmail);
      } else {
        throw new Error("验证码页面缺少邮箱地址数据");
      }
    }

    // 等待验证码邮件 - 使用配置文件中的时间
    async waitForCodeEmail() {
      this.setState(window.AUTOMATION_STATES.CODE_WAITING);

      const config = getConfigSafely();
      const waitTimeSeconds = config.automation?.codeWaitTime || 5;
      const waitTime = waitTimeSeconds * 1000; // 转换为毫秒

      updateStatus(
        "⏳",
        `验证码获取阶段：等待${waitTimeSeconds}秒让验证码邮件到达...`,
        "info"
      );
      updateProgress(20);
      return new Promise((resolve) => {
        let countdown = Math.ceil(waitTime / 1000);
        const timerId = setInterval(() => {
          updateStatus("⏳", `等待验证码邮件到达（${countdown}秒）...`, "info");
          updateProgress(
            20 + ((waitTimeSeconds - countdown) / waitTimeSeconds) * 50
          ); // 更新进度条

          countdown--;

          if (countdown <= 0) {
            clearInterval(timerId);
            this.timers.delete("wait");

            resolve();
          }
        }, 1000);

        this.timers.set("wait", timerId);
      });
    }

    // 获取验证码 - 优化版，减少超时时间
    async fetchVerificationCode() {
      this.setState(window.AUTOMATION_STATES.CODE_FETCHING);
      updateStatus("📧", "正在获取验证码...", "info");
      updateProgress(70);

      if (!this.currentEmail) {
        throw new Error("验证码页面缺少邮箱地址");
      }

      const isGmailAlias =
        /@gmail\.com$/i.test(this.currentEmail) &&
        this.currentEmail.includes("+");

      // 重试机制：最多3次，每次间隔3秒
      const maxRetries = 3;
      let code = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          updateStatus(
            "📧",
            `获取验证码中... (${attempt}/${maxRetries})`,
            "info"
          );

          if (isGmailAlias) {
            // Gmail别名邮箱：使用模块化的Gmail验证码获取
            const module = getVerificationModule();
            if (!module) {
              updateStatus("❌", "验证码模块未加载", "error");
              throw new Error("验证码模块未加载");
            }
            code = await module.fetchVerificationCodeFromGmail(8000);
            if (code) break; // 成功获取，跳出重试循环
          } else {
            // 临时邮箱：使用模块化的临时邮箱验证码获取
            if (!this.currentToken) {
              updateStatus("❌", "临时邮箱缺少token", "error");
              throw new Error("临时邮箱缺少token");
            }
            const module = getVerificationModule();
            if (!module) {
              updateStatus("❌", "验证码模块未加载", "error");
              throw new Error("验证码模块未加载");
            }
            code = await module.fetchVerificationCodeFromTempEmail(
              this.currentEmail,
              this.currentToken
            );
            if (code) break; // 成功获取，跳出重试循环
          }
        } catch (error) {
          if (attempt === maxRetries) {
            throw new Error(`验证码获取失败: ${error.message}`);
          }
          // 等待3秒后重试
          await sleep(3000);
        }
      }

      if (!code) {
        throw new Error("未获取到验证码");
      }

      this.verificationCode = code;
      updateStatus("🎉", `验证码获取成功: ${code}`, "success");
      updateProgress(90);
    }

    // 填写验证码
    async fillVerificationCode() {
      this.setState(window.AUTOMATION_STATES.CODE_FILLING);

      updateStatus("📝", "正在填写验证码...", "info");

      try {
        const selectors = getSelectors();
        const codeInput = document.querySelector(selectors.CODE_INPUT);
        if (!codeInput) {
          throw new Error(`未找到验证码输入框 (${selectors.CODE_INPUT})`);
        }

        if (!this.verificationCode) {
          throw new Error("验证码为空");
        }

        // 清空并填写验证码
        codeInput.value = "";
        codeInput.focus();

        // 模拟用户输入
        const config = getConfigSafely();
        const codeInputDelay = config.automation?.delays?.afterCodeInput || 100;

        for (let i = 0; i < this.verificationCode.length; i++) {
          codeInput.value += this.verificationCode[i];
          codeInput.dispatchEvent(new Event("input", { bubbles: true }));
          await sleep(codeInputDelay); // 使用配置中的延迟时间
        }

        codeInput.dispatchEvent(new Event("change", { bubbles: true }));
        codeInput.blur();

        // 全自动模式：验证码填写完成后自动提交
        updateStatus("✅", "验证码填写完成，正在自动提交...", "success");
        updateProgress(95);

        // 等待一小段时间确保验证码填写完成 - 使用配置中的延迟
        const formSubmissionDelay =
          config.automation?.delays?.formSubmission || 1000;
        await sleep(formSubmissionDelay);

        // 自动点击提交按钮
        await this.autoSubmitCode();

        // 验证码提交完成后的后续操作
        await this.postSubmissionActions();

        // 验证码提交完成后停止自动化
        this.setState(window.AUTOMATION_STATES.COMPLETED);
        updateProgress(100);

        updateStatus("🎉", "验证码已自动提交完成并复制到剪贴板", "success");
      } catch (error) {
        throw new Error(`填写验证码失败: ${error.message}`);
      }
    }

    // 验证码提交后的后续操作
    async postSubmissionActions() {
      try {
        // 等待一小段时间确保提交完成
        await sleep(1000);

        // 复制邮件到剪贴板
        if (this.currentEmail) {
          updateStatus("📋", "正在复制邮件到剪贴板...", "info");
          await this.copyEmailToClipboardAfterSubmission(this.currentEmail);
        }

        // 清理本地存储，为下次使用做准备
        this.clearLocalStorage();

        updateStatus("✅", "邮件已复制，存储已清理", "success");
      } catch (error) {
        log(`⚠️ 后续操作失败: ${error.message}`, "warning");
      }
    }

    // 自动提交验证码
    async autoSubmitCode() {
      updateStatus("🚀", "正在自动提交验证码...", "info");

      try {
        // 尝试多种选择器来找到提交按钮
        const selectors = getSelectors();
        let submitBtn = document.querySelector(selectors.CODE_SUBMIT);

        // 调试模式：打印当前页面所有按钮信息
        if (window.AugmentConfig?.CONFIG.debug?.verbose) {
          const allButtons = document.querySelectorAll("button");
          log(`页面共找到 ${allButtons.length} 个按钮`, "info");
          allButtons.forEach((btn, index) => {
            log(
              `按钮${index + 1}: ${btn.textContent?.trim() || "无文本"} (${
                btn.type || "无类型"
              })`,
              "info"
            );
          });
        }

        // 如果找不到，尝试其他可能的选择器
        if (!submitBtn) {
          submitBtn = document.querySelector('button[type="submit"]');
        }
        // 注意：:contains() 选择器在现代浏览器中不被支持，跳过这些选择器
        if (!submitBtn) {
          // 查找包含"Continue"文本的按钮
          const buttons = document.querySelectorAll("button");
          for (const btn of buttons) {
            const text = btn.textContent.toLowerCase().trim();
            if (
              text.includes("continue") ||
              text.includes("提交") ||
              text.includes("确认") ||
              text.includes("submit")
            ) {
              submitBtn = btn;
              break;
            }
          }
        }

        // 如果还是找不到，尝试查找任何可能的提交按钮
        if (!submitBtn) {
          // 查找所有可能的提交元素
          const possibleSubmits = document.querySelectorAll(
            'button, input[type="submit"], input[type="button"], [role="button"]'
          );

          for (const element of possibleSubmits) {
            const text = element.textContent || element.value || "";
            const lowerText = text.toLowerCase().trim();

            if (
              lowerText.includes("continue") ||
              lowerText.includes("submit") ||
              lowerText.includes("next") ||
              lowerText.includes("提交") ||
              lowerText.includes("确认")
            ) {
              submitBtn = element;
              break;
            }
          }
        }

        if (!submitBtn) {
          updateStatus("⚠️", "未找到验证码提交按钮，请手动提交", "warning");
          log(
            "❌ 无法找到提交按钮，尝试的选择器: " +
              window.SELECTORS.CODE_SUBMIT,
            "error"
          );
          return;
        }

        // 在提交前保存状态，以便页面跳转后恢复
        this.saveSubmissionState();

        // 等待一小段时间确保验证码填写完成
        await sleep(500);

        // 确保按钮可点击
        if (submitBtn.disabled) {
          updateStatus("⚠️", "提交按钮被禁用，请检查验证码", "warning");
          return;
        }

        // 点击提交按钮 - 使用多种方式确保点击成功
        const config = getConfigSafely();
        const clickDelay = config.automation?.delays?.betweenClicks || 200;

        // 方式1: 标准点击
        submitBtn.focus();
        await sleep(clickDelay);
        submitBtn.click();

        // 方式2: 模拟完整的鼠标事件序列
        await sleep(clickDelay);
        const mouseDownEvent = new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        submitBtn.dispatchEvent(mouseDownEvent);

        await sleep(clickDelay / 4);
        const mouseUpEvent = new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        submitBtn.dispatchEvent(mouseUpEvent);

        await sleep(clickDelay / 4);
        const clickEvent = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        submitBtn.dispatchEvent(clickEvent);

        // 方式3: 尝试触发表单提交事件
        await sleep(clickDelay);
        const form = submitBtn.closest("form");
        if (form) {
          form.dispatchEvent(new Event("submit", { bubbles: true }));
        }

        // 方式4: 如果是input类型，尝试触发change事件
        if (submitBtn.tagName === "INPUT") {
          submitBtn.dispatchEvent(new Event("change", { bubbles: true }));
        }

        // 方式5: 尝试键盘事件（Enter键）
        await sleep(clickDelay);
        const enterEvent = new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          bubbles: true,
          cancelable: true,
        });
        submitBtn.dispatchEvent(enterEvent);

        // 方式6: 尝试直接调用onclick处理器
        if (submitBtn.onclick) {
          submitBtn.onclick();
        }

        updateStatus("✅", "验证码已自动提交", "success");
        log("🚀 验证码提交按钮已点击", "success");

        // 等待页面响应
        await sleep(1000);
      } catch (error) {
        updateStatus("❌", `自动提交失败: ${error.message}`, "error");
        log(`❌ 自动提交错误: ${error.message}`, "error");
      }
    }

    // 保存提交状态
    saveSubmissionState() {
      const submissionState = {
        timestamp: Date.now(),
        email: this.currentEmail,
        token: this.currentToken,
        accountId: this.currentAccountId,
        emailService: currentEmailService,
        submitted: true,
      };

      const storageModule = getStorageModule();
      if (storageModule) {
        storageModule.saveSubmissionState(submissionState);
      } else {
        // 备用存储方案
        localStorage.setItem(
          "augment_submission_state",
          JSON.stringify(submissionState)
        );
      }
    }

    // 清理本地存储
    clearLocalStorage() {
      try {
        // 清理Gmail别名存储
        clearGmailAliasFromStorage();

        // 清理临时邮箱存储
        clearEmailDataFromStorage();

        // 清理提交状态存储
        const storageModule = getStorageModule();
        if (storageModule && storageModule.clearSubmissionState) {
          storageModule.clearSubmissionState();
        } else {
          localStorage.removeItem("augment_submission_state");
        }

        log("🧹 本地存储已清理，为下次使用做准备", "success");
      } catch (error) {
        log(`⚠️ 清理存储失败: ${error.message}`, "warning");
      }
    }

    // 验证码提交后复制邮箱到剪贴板
    async copyEmailToClipboardAfterSubmission(email) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          // 使用现代Clipboard API
          await navigator.clipboard.writeText(email);

          // 显示复制成功提示
          updateStatus("📋", `邮箱已复制到剪贴板: ${email}`, "success");

          // 5秒后恢复完成状态
          setTimeout(() => {
            updateStatus("🎉", "验证码提交完成，邮箱已复制", "success");
          }, 5000);
        } else {
          // 备用方案：使用传统方法
          const textArea = document.createElement("textarea");
          textArea.value = email;
          textArea.style.position = "fixed";
          textArea.style.left = "-999999px";
          textArea.style.top = "-999999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();

          try {
            document.execCommand("copy");
            updateStatus("📋", `邮箱已复制到剪贴板: ${email}`, "success");

            // 5秒后恢复完成状态
            setTimeout(() => {
              updateStatus("🎉", "验证码提交完成，邮箱已复制", "success");
            }, 5000);
          } catch (err) {
            updateStatus("⚠️", "复制到剪贴板失败，请手动复制", "warning");
          } finally {
            document.body.removeChild(textArea);
          }
        }
      } catch (error) {
        updateStatus("⚠️", "复制到剪贴板失败，请手动复制", "warning");
      }
    }

    // 复制邮箱到剪贴板（原方法，用于其他场景）
    async copyEmailToClipboard(email) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          // 使用现代Clipboard API
          await navigator.clipboard.writeText(email);

          // 显示复制成功提示
          updateStatus("📋", `邮箱已复制到剪贴板: ${email}`, "success");

          // 3秒后恢复原状态
          setTimeout(() => {
            updateStatus("📧", "邮箱地址已生成", "success");
          }, 3000);
        } else {
          // 备用方案：使用传统方法
          const textArea = document.createElement("textarea");
          textArea.value = email;
          textArea.style.position = "fixed";
          textArea.style.left = "-999999px";
          textArea.style.top = "-999999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();

          try {
            document.execCommand("copy");
            updateStatus("📋", `邮箱已复制到剪贴板: ${email}`, "success");

            // 3秒后恢复原状态
            setTimeout(() => {
              updateStatus("📧", "邮箱地址已生成", "success");
            }, 3000);
          } catch (err) {
            updateStatus("⚠️", "复制到剪贴板失败，请手动复制", "warning");
          } finally {
            document.body.removeChild(textArea);
          }
        }
      } catch (error) {
        updateStatus("⚠️", "复制到剪贴板失败，请手动复制", "warning");
      }
    }

    // 监听提交按钮点击（保留用于其他场景）
    setupSubmitButtonListener() {
      const submitBtn = document.querySelector(window.SELECTORS.CODE_SUBMIT);
      if (!submitBtn) {
        log("⚠️ 未找到验证码提交按钮，无法监听", "warning");
        return;
      }

      // 移除之前的监听器（如果存在）
      if (this.submitButtonListener) {
        submitBtn.removeEventListener("click", this.submitButtonListener);
      }

      // 创建新的监听器
      this.submitButtonListener = () => {
        // 延迟显示状态更新
        setTimeout(() => {
          updateStatus("✅", "验证码已提交", "success");
        }, 1000);
      };

      // 添加监听器
      submitBtn.addEventListener("click", this.submitButtonListener);
    }
  };

  // 创建全局自动化控制器实例
  window.automationController = new AutomationController();

  // 全局错误处理
  window.addEventListener("error", (event) => {
    if (event.error && event.error.message) {
      updateStatus("❌", `插件错误: ${event.error.message}`, "error");
    }
  });

  // Promise 错误处理
  window.addEventListener("unhandledrejection", (event) => {
    if (event.reason && event.reason.message) {
      updateStatus("❌", `异步错误: ${event.reason.message}`, "error");
    }
  });
})();
