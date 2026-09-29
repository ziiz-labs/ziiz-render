FROM mcr.microsoft.com/playwright:v1.56.0-noble
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production PORT=8080 OUT_DIR=/data/out
EXPOSE 8080
CMD ["node", "server.js"]
