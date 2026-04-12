FROM mcr.microsoft.com/playwright/python:v1.44.0-jammy

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy bot source
COPY . .

# Install Playwright browsers (Chromium only)
RUN playwright install chromium --with-deps

EXPOSE 8001

# Run as HTTP service — one process, one browser session at a time
CMD ["uvicorn", "bot.app.main:app", "--host", "0.0.0.0", "--port", "8001"]
