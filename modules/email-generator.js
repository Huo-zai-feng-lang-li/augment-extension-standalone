// 邮箱生成模块
(() => {
  "use strict";

  // Gmail别名邮箱生成函数
  const generateGmailAliasEmail = () => {
    // 使用配置文件中的方法生成Gmail别名
    if (!window.AugmentConfig) {
      throw new Error("配置文件未加载，请确保config.js已正确引入");
    }

    const gmailAlias = window.AugmentConfig.generateGmailAlias();

    // 保存到localStorage
    if (window.AugmentStorage) {
      window.AugmentStorage.saveGmailAliasToStorage(gmailAlias);
    }

    return gmailAlias;
  };

  // 临时邮箱生成函数
  const generateTempEmail = async () => {
    // 使用配置文件中的设置
    if (!window.AugmentConfig) {
      throw new Error("配置文件未加载，请确保config.js已正确引入");
    }

    const config = window.AugmentConfig.CONFIG;
    const apiUrl = config.tempEmail.apiUrl;

    try {
      // 获取可用域名
      const domainsResponse = await fetch(`${apiUrl}/domains`);
      if (!domainsResponse.ok) {
        throw new Error(`获取域名失败: HTTP ${domainsResponse.status}`);
      }
      const domainsData = await domainsResponse.json();

      if (
        !domainsData ||
        !domainsData["hydra:member"] ||
        domainsData["hydra:member"].length === 0
      ) {
        throw new Error("没有可用的邮箱域名");
      }

      const domain = domainsData["hydra:member"][0].domain;
      const randomUsername = `${config.tempEmail.usernamePrefix}${Math.floor(
        Math.random() * 1000000
      )}`;
      const randomPassword = `${config.tempEmail.passwordPrefix}${Math.floor(
        Math.random() * 1000000
      )}`;
      const email = `${randomUsername}@${domain}`;

      // 创建邮箱账户
      const createAccountResponse = await fetch(`${apiUrl}/accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: email,
          password: randomPassword,
        }),
      });

      if (!createAccountResponse.ok) {
        const errorText = await createAccountResponse.text();
        throw new Error(
          `创建邮箱账户失败: HTTP ${createAccountResponse.status}`
        );
      }

      const accountData = await createAccountResponse.json();
      const accountId = accountData.id;

      // 获取访问令牌
      const tokenResponse = await fetch(`${apiUrl}/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: email,
          password: randomPassword,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`获取访问令牌失败: HTTP ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();
      const token = tokenData.token;

      const emailData = {
        email: email,
        token: token,
        accountId: accountId,
        password: randomPassword,
      };

      // 保存邮箱数据到localStorage
      if (window.AugmentStorage) {
        window.AugmentStorage.saveEmailDataToStorage(emailData);
      }

      return emailData;
    } catch (error) {
      throw new Error(`生成邮箱失败: ${error.message}`);
    }
  };

  // 导出到全局
  window.AugmentEmailGenerator = {
    generateGmailAliasEmail,
    generateTempEmail,
  };
})();
