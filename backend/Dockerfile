FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tesseract-ocr
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3001
CMD ["npx", "tsx", "src/index.ts"]
