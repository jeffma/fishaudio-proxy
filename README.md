# Fish Audio API Proxy

中文 | [English](#english)

这是一个专为 Fish Audio API 设计的代理服务器。它允许您安全地将多个 API keys 合并到单个端点，并为每个请求随机选择一个使用。这对于管理密钥、负载均衡和与前端应用程序集成非常有用。

## ✨ 功能特性

* **多密钥管理**: 在 `Authorization` header 中传递多个 Fish Audio API keys（Bearer token），用逗号分隔。
* **随机密钥选择**: 从您提供的列表中为每个请求随机选择一个密钥，有助于分散负载。
* **请求转发**: 无缝转发所有请求到 Fish Audio API (`https://api.fish.audio`)。
* **WebSocket 支持**: 支持 Fish Audio 的实时 TTS WebSocket 连接 (`/v1/tts-live`)。
* **灵活部署**: 针对 Vercel 优化，但也支持使用 Docker 部署。

## 🚀 部署指南

我们强烈推荐使用 Vercel 进行快速一键部署。

### Vercel（推荐）

1. Fork 或克隆此仓库
2. 在 Vercel 中导入项目
3. 部署完成后，您将获得一个专用的代理 URL

### Docker

您也可以使用 Docker 在任何支持的平台上部署，例如 Claw Cloud。

```bash
docker build -t fishaudio-proxy .
docker run -d \
  -p 80:3000 \
  --name fishaudio-proxy \
  --restart unless-stopped \
  fishaudio-proxy
```

您的代理服务器将在 `http://localhost:80` 运行。

## 📖 使用说明

### HTTP 请求（TTS 和 STT）

#### Text-to-Speech (TTS)

```bash
curl --request POST \
  --url https://your-proxy-url.com/v1/tts \
  --header 'Authorization: Bearer YOUR_API_KEY_1,YOUR_API_KEY_2,YOUR_API_KEY_3' \
  --header 'Content-Type: application/json' \
  --header 'model: s1' \
  --data '{
    "text": "Hello, world!",
    "format": "mp3",
    "temperature": 0.9,
    "top_p": 0.9
  }'
```

#### Speech-to-Text (STT)

```bash
curl --request POST \
  --url https://your-proxy-url.com/v1/stt \
  --header 'Authorization: Bearer YOUR_API_KEY_1,YOUR_API_KEY_2' \
  --header 'Content-Type: multipart/form-data' \
  --form 'audio=@audio.wav'
```

### WebSocket 连接（Live TTS）

```javascript
const ws = new WebSocket('wss://your-proxy-url.com/v1/tts-live', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY_1,YOUR_API_KEY_2',
    'model': 's1'
  }
});

ws.on('open', () => {
  console.log('Connected to Fish Audio Live TTS');
  // 发送消息
  ws.send(JSON.stringify({
    text: 'Hello, world!',
    format: 'mp3'
  }));
});

ws.on('message', (data) => {
  console.log('Received:', data);
});
```

## 🔧 配置

### 环境变量

- `PORT`: 服务器端口（默认: 3000）

### API Key 格式

在 `Authorization` header 中，您可以传递多个 Bearer tokens，用逗号分隔：

```
Authorization: Bearer token1,token2,token3
```

代理服务器会随机选择一个 token 用于每个请求。

## 📚 API 文档

Fish Audio API 完整文档：
- [Text-to-Speech](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech)
- [Speech-to-Text](https://docs.fish.audio/api-reference/endpoint/openapi-v1/speech-to-text)
- [Live TTS WebSocket](https://docs.fish.audio/api-reference/endpoint/websocket/tts-live)

## 📄 许可证

MIT License

---

## English

This is a proxy server designed specifically for the Fish Audio API. It allows you to securely consolidate multiple API keys into a single endpoint and randomly select one for use with each request. This is useful for managing keys, load balancing, and integrating with front-end applications.

## ✨ Features

* **Multi-Key Management**: Pass multiple Fish Audio API keys (Bearer tokens), separated by commas, in the `Authorization` header.
* **Random Key Selection**: A key is randomly selected from your provided list for each request, helping to distribute the load.
* **Request Forwarding**: Seamlessly forwards all requests to the Fish Audio API (`https://api.fish.audio`).
* **WebSocket Support**: Supports Fish Audio's live TTS WebSocket connection (`/v1/tts-live`).
* **Flexible Deployment**: Optimized for Vercel, but also supports deployment using Docker.

## 🚀 Deployment Guide

We highly recommend using Vercel for a quick and easy one-click deployment.

### Vercel (Recommended)

1. Fork or clone this repository
2. Import the project in Vercel
3. Once deployed, you will receive a dedicated proxy URL

### Docker

You can also use Docker to deploy on any supported platform, such as Claw Cloud.

```bash
docker build -t fishaudio-proxy .
docker run -d \
  -p 80:3000 \
  --name fishaudio-proxy \
  --restart unless-stopped \
  fishaudio-proxy
```

Your proxy server will be running at `http://localhost:80`.

## 📖 Usage

### HTTP Requests (TTS and STT)

#### Text-to-Speech (TTS)

```bash
curl --request POST \
  --url https://your-proxy-url.com/v1/tts \
  --header 'Authorization: Bearer YOUR_API_KEY_1,YOUR_API_KEY_2,YOUR_API_KEY_3' \
  --header 'Content-Type: application/json' \
  --header 'model: s1' \
  --data '{
    "text": "Hello, world!",
    "format": "mp3",
    "temperature": 0.9,
    "top_p": 0.9
  }'
```

#### Speech-to-Text (STT)

```bash
curl --request POST \
  --url https://your-proxy-url.com/v1/stt \
  --header 'Authorization: Bearer YOUR_API_KEY_1,YOUR_API_KEY_2' \
  --header 'Content-Type: multipart/form-data' \
  --form 'audio=@audio.wav'
```

### WebSocket Connection (Live TTS)

```javascript
const ws = new WebSocket('wss://your-proxy-url.com/v1/tts-live', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY_1,YOUR_API_KEY_2',
    'model': 's1'
  }
});

ws.on('open', () => {
  console.log('Connected to Fish Audio Live TTS');
  // Send message
  ws.send(JSON.stringify({
    text: 'Hello, world!',
    format: 'mp3'
  }));
});

ws.on('message', (data) => {
  console.log('Received:', data);
});
```

## 🔧 Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)

### API Key Format

In the `Authorization` header, you can pass multiple Bearer tokens separated by commas:

```
Authorization: Bearer token1,token2,token3
```

The proxy server will randomly select one token for each request.

## 📚 API Documentation

Fish Audio API full documentation:
- [Text-to-Speech](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech)
- [Speech-to-Text](https://docs.fish.audio/api-reference/endpoint/openapi-v1/speech-to-text)
- [Live TTS WebSocket](https://docs.fish.audio/api-reference/endpoint/websocket/tts-live)

## 📄 License

MIT License

