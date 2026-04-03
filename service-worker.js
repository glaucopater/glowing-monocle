const SYSTEM_PROMPT = "You are an Glowing Monocle. You receive an image and you need to analyze it in detail. \
You need to provide a detailed description of what is in the image, including objects, people, animals, and the environment. \
Reply in markdown format, with sections for description, categories/tags, color palette, and any anomalies or hallucinations. \
Be concise but thorough. If the image contains NSFW content, clearly indicate that in the response.";

const USER_PROMPT = "Describe what is in this image. Provide a list of categories and tags. \
Provide a list of palette used in the image in hexadecimal format. \
Verify if there are any anomalies or hallucinations. Tell me if the image is NSFW."; 

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") {
        reject(new Error("Failed to convert blob to base64"));
        return;
      }

      const parts = dataUrl.split(",");
      if (parts.length < 2) {
        reject(new Error("Invalid data URL"));
        return;
      }

      resolve(parts[1]);
    };

    reader.onerror = () => {
      reject(reader.error || new Error("FileReader error"));
    };

    reader.readAsDataURL(blob);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "analyze-image",
    title: "Analyze image",
    contexts: ["image"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "analyze-image") return;
  if (!tab?.id) return;

  const imageUrl = info.srcUrl;
  if (!imageUrl) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (imageUrl) => {
        if (window.__imageAnalyzerShowLoading) {
          window.__imageAnalyzerShowLoading(imageUrl);
        }
      },
      args: [imageUrl]
    });

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Image fetch failed: HTTP ${imageResponse.status}`);
    }

    const imageBlob = await imageResponse.blob();
    const imageBase64 = await blobToBase64(imageBlob);

    const payload = {
      model: "gemma4:e2b",
      stream: false,
      messages: [
        {
          role: "user",
          content: SYSTEM_PROMPT + USER_PROMPT,
          images: [imageBase64]
        }
      ]
    };

    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer XXX"
      },
      body: JSON.stringify(payload)
    });

    const raw = await response.text();

    if (!response.ok) {
      throw new Error(`Ollama error ${response.status}: ${raw || "No response body"}`);
    }

    let formattedText = raw;
    let rawJsonText = raw;

    try {
      const parsed = JSON.parse(raw);
      rawJsonText = JSON.stringify(parsed, null, 2);
      formattedText = parsed?.message?.content ?? raw;
    } catch {
      rawJsonText = raw;
      formattedText = raw;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (imageUrl, formattedText, rawJsonText) => {
        if (window.__imageAnalyzerShowResult) {
          window.__imageAnalyzerShowResult(imageUrl, formattedText, rawJsonText);
        }
      },
      args: [imageUrl, formattedText, rawJsonText]
    });
  } catch (error) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (imageUrl, errorMessage) => {
          if (window.__imageAnalyzerShowResult) {
            window.__imageAnalyzerShowResult(
              imageUrl,
              `Error: ${errorMessage}`,
              `Error: ${errorMessage}`
            );
          }
        },
        args: [imageUrl, error.message]
      });
    } catch (innerError) {
      console.error("Failed to display error in modal:", innerError);
    }
  }
});