document.addEventListener("DOMContentLoaded", async () => {
  const startBtn = document.getElementById("startBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const helpBtn = document.getElementById("helpBtn");
  const statusText = document.getElementById("statusText");
  const statusIcon = document.getElementById("statusIcon");
  const currentTab = document.getElementById("currentTab");
  const quoteText = document.getElementById("quoteText");

  // 情感语录数组
  const quotes = [
    "每一次自动化，都是向未来迈进的一步",
    "科技让生活更简单，让梦想更接近",
    "今天的努力，是明天成功的基石",
    "用代码改变世界，用智慧创造价值",
    "自动化不是替代，而是解放创造力",
    "每一行代码，都承载着改变的力量",
    "效率是成功的加速器",
    "让机器做重复的事，让人类做创造的事",
    "技术的温度，来自于对生活的热爱",
    "简单的背后，是复杂的智慧",
    "创新永远在路上，梦想永远在前方",
    "用技术点亮生活，用智慧照亮未来",
  ];

  let currentQuoteIndex = 0;

  // 动态更换语录
  function updateQuote() {
    if (quoteText) {
      quoteText.style.animation = "none";
      quoteText.offsetHeight; // 触发重排
      quoteText.textContent = quotes[currentQuoteIndex];
      quoteText.style.animation = "fadeInOut 4s infinite";
      currentQuoteIndex = (currentQuoteIndex + 1) % quotes.length;
    }
  }

  // 初始化语录
  updateQuote();

  // 每4秒更换一次语录
  setInterval(updateQuote, 4000);

  // 尝试从网络API获取语录（可选功能）
  async function fetchOnlineQuote() {
    try {
      // 使用免费的一言API
      const response = await fetch("https://v1.hitokoto.cn/?c=i&encode=text");
      if (response.ok) {
        const quote = await response.text();
        if (quote && quote.length < 50) {
          // 限制长度避免显示问题
          quotes.push(quote);
        }
      }
    } catch (error) {
      console.log("获取在线语录失败，使用本地语录:", error);
    }
  }

  // 尝试获取在线语录
  fetchOnlineQuote();

  // 获取当前标签页信息
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab) {
      const url = new URL(tab.url);
      currentTab.textContent = `当前页面：${url.hostname}`;

      // 检查是否在 Augment 网站
      if (
        url.hostname.includes("augmentcode.com") ||
        url.hostname.includes("localhost")
      ) {
        statusText.textContent = "已检测到 Augment 网站";
        statusIcon.style.background = "#4CAF50";
        startBtn.textContent = "开始自动注册";
        startBtn.disabled = false;
      } else {
        statusText.textContent = "请先访问 Augment 网站";
        statusIcon.style.background = "#FF9800";
        startBtn.textContent = "♻️ 前往 Augment 网站";
        startBtn.disabled = false;
      }
    }
  } catch (error) {
    console.error("获取标签页信息失败:", error);
    statusText.textContent = "无法检测当前页面";
    statusIcon.style.background = "#F44336";
  }

  // 开始按钮点击事件
  startBtn.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (
        tab.url.includes("augmentcode.com") ||
        tab.url.includes("localhost")
      ) {
        // 在 Augment 网站，开始自动注册
        statusText.textContent = "正在启动自动注册...";
        statusIcon.style.background = "#2196F3";

        // 向内容脚本发送消息
        await chrome.tabs.sendMessage(tab.id, { action: "startAutoRegister" });

        // 关闭弹窗
        window.close();
      } else {
        // 不在 Augment 网站，跳转到网站
        await chrome.tabs.update(tab.id, { url: "https://augmentcode.com" });
        window.close();
      }
    } catch (error) {
      console.error("操作失败:", error);
      statusText.textContent = "操作失败，请重试";
      statusIcon.style.background = "#F44336";
    }
  });

  // 设置按钮点击事件
  settingsBtn.addEventListener("click", () => {
    // 可以打开设置页面或显示设置选项
    alert("设置功能开发中...");
  });

  // 帮助按钮点击事件
  helpBtn.addEventListener("click", () => {
    // 打开帮助页面
    chrome.tabs.create({ url: "https://github.com/your-repo/help" });
    window.close();
  });

  // 监听来自内容脚本的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateStatus") {
      statusText.textContent = message.status;
      if (message.type === "success") {
        statusIcon.style.background = "#4CAF50";
      } else if (message.type === "error") {
        statusIcon.style.background = "#F44336";
      } else {
        statusIcon.style.background = "#2196F3";
      }
    }
  });
});
