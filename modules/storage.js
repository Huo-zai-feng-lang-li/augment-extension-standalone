// 邮箱数据存储管理模块
(() => {
  "use strict";

  // 配置常量
  const STORAGE_KEY = "augment_email_data";
  const GENERATED_EMAIL_KEY = "generated_email";
  const SUBMISSION_STATE_KEY = "augment_submission_state";

  // localStorage 邮箱数据管理
  const saveEmailDataToStorage = (emailData) => {
    try {
      const dataToSave = {
        email: emailData.email,
        token: emailData.token,
        accountId: emailData.accountId,
        password: emailData.password,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      console.error("保存邮箱数据失败:", error.message);
    }
  };

  const loadEmailDataFromStorage = () => {
    try {
      const storedData = localStorage.getItem(STORAGE_KEY);
      if (storedData) {
        const emailData = JSON.parse(storedData);
        // 检查数据是否过期（24小时）
        const isExpired =
          Date.now() - emailData.timestamp > 24 * 60 * 60 * 1000;
        if (isExpired) {
          clearEmailDataFromStorage();
          return null;
        }
        return emailData;
      }
    } catch (error) {
      console.error("加载邮箱数据失败:", error.message);
    }
    return null;
  };

  const clearEmailDataFromStorage = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("清除邮箱数据失败:", error.message);
    }
  };

  // Gmail别名邮箱管理
  const saveGmailAliasToStorage = (email) => {
    try {
      const dataToSave = {
        email: email,
        timestamp: Date.now(),
        type: "gmail_alias",
      };
      localStorage.setItem(GENERATED_EMAIL_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      console.error("保存Gmail别名邮箱失败:", error.message);
    }
  };

  const loadGmailAliasFromStorage = () => {
    try {
      const storedData = localStorage.getItem(GENERATED_EMAIL_KEY);
      if (storedData) {
        const emailData = JSON.parse(storedData);
        // 检查数据是否过期（24小时）
        const isExpired =
          Date.now() - emailData.timestamp > 24 * 60 * 60 * 1000;
        if (isExpired) {
          clearGmailAliasFromStorage();
          return null;
        }
        return emailData.email;
      }
    } catch (error) {
      console.error("加载Gmail别名邮箱失败:", error.message);
    }
    return null;
  };

  const clearGmailAliasFromStorage = () => {
    try {
      localStorage.removeItem(GENERATED_EMAIL_KEY);
    } catch (error) {
      console.error("清除Gmail别名邮箱失败:", error.message);
    }
  };

  // 提交状态管理
  const saveSubmissionState = (submissionState) => {
    try {
      localStorage.setItem(
        SUBMISSION_STATE_KEY,
        JSON.stringify(submissionState)
      );
    } catch (error) {
      console.error("保存提交状态失败:", error.message);
    }
  };

  const loadSubmissionState = () => {
    try {
      const storedData = localStorage.getItem(SUBMISSION_STATE_KEY);
      if (storedData) {
        return JSON.parse(storedData);
      }
    } catch (error) {
      console.error("加载提交状态失败:", error.message);
    }
    return null;
  };

  const clearSubmissionState = () => {
    try {
      localStorage.removeItem(SUBMISSION_STATE_KEY);
    } catch (error) {
      console.error("清除提交状态失败:", error.message);
    }
  };

  // 导出到全局
  window.AugmentStorage = {
    saveEmailDataToStorage,
    loadEmailDataFromStorage,
    clearEmailDataFromStorage,
    saveGmailAliasToStorage,
    loadGmailAliasFromStorage,
    clearGmailAliasFromStorage,
    saveSubmissionState,
    loadSubmissionState,
    clearSubmissionState,
  };
})();
