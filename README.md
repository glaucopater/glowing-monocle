# glowing-monocle
A Chrome (and Brave) extension to analyse images in the browser

It depends on a LLM api, by default the setup is considering a Ollama instance running locally (standard chat completion request).

# Start your Ollama instance with the following command:

For Unix-like systems or MacOS:
```
OLLAMA_ORIGINS=chrome-extension://* ollama serve
```
For Windows:
```
set OLLAMA_ORIGINS=chrome-extension://*
ollama serve
```

- Verify that the Ollama instance is running by visiting http://localhost:11434/api/tags

A good and small vision model is https://ollama.com/library/gemma4    

You can install it with:
```
ollama run gemma4:e2b
```

# Install the extension

1. Clone the repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable `Developer mode`
4. Click on `Load unpacked` and select the cloned repository

# Usage

1. Open a webpage with images
2. Click on the extension icon
3. Hover over an image
4. Click on `Glowing Monocle`


# Dependencies

- Marked https://marked.js.org/
- DomPurify https://github.com/cure53/DOMPurify