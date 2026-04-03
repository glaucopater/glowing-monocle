const analyzeBtn = document.getElementById('analyzeBtn');
const resultEl = document.getElementById('result');

analyzeBtn.addEventListener('click', async () => {
  try {
    resultEl.textContent = 'Sending request...';

    const payload = {
      model: 'gemma4:e2b',
      think: true,
      stream: false,
      messages: [
        {
          role: 'user',
          content: 'I need to wash my car, the car wash is 200 mt far from me. Is it better if I drive there or if I walk?'
        }
      ]
    };

    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer XXX'
      },
      body: JSON.stringify(payload)
    });

    const raw = await res.text();

    if (!res.ok) {
      resultEl.textContent = `HTTP ${res.status}\n${raw || 'No response body'}`;
      return;
    }

    if (!raw.trim()) {
      resultEl.textContent = 'Empty response body';
      return;
    }

    const data = JSON.parse(raw);
    resultEl.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    resultEl.textContent = `Request failed: ${err.message}`;
  }
});