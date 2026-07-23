FROM node:20-slim

# Install system deps needed by sharp / canvas
RUN apt-get update && apt-get install -y \
    libvips-dev \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

# Session folder
RUN mkdir -p session

EXPOSE 5000

CMD ["node", "--max-old-space-size=512", "index.js"]
