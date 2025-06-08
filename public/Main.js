document.getElementById('submit').onclick = async () => {
  const prompt = document.getElementById('input').value;
  const resultDiv = document.getElementById('result');
  resultDiv.textContent = 'Generating...';

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const err = await response.text();
      resultDiv.textContent = `Error: ${response.status} - ${err}`;
      return;
    }

    const data = await response.json();
    resultDiv.innerHTML = data.code || 'No code received';
  } catch (e) {
    resultDiv.textContent = `Network error: ${e.message}`;
  }
};
