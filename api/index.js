// Vercel serverless function entry point
// 注意：Vercel serverless functions 不支持 WebSocket
// 如果需要 WebSocket 支持，请使用 Docker 部署

// 抑制来自依赖包的弃用警告
const originalEmitWarning = process.emitWarning;
process.emitWarning = function(warning, type, code, ctor) {
  // 忽略 util._extend 相关的弃用警告（来自 http-proxy-middleware 的依赖）
  if (type === 'DeprecationWarning' && 
      (warning && warning.toString().includes('util._extend') || 
       (typeof warning === 'string' && warning.includes('util._extend')))) {
    return;
  }
  // 其他警告正常显示
  return originalEmitWarning.apply(process, arguments);
};

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// 解析 JSON 请求体（请求是 JSON，响应可能是二进制）
app.use(express.json());

// 从 Authorization header 中提取并随机选择 API key
function getRandomApiKey(authHeader) {
  if (!authHeader) {
    return null;
  }

  // 支持 Bearer token 格式: "Bearer token1,token2,token3"
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) {
    const tokens = bearerMatch[1].split(',').map(t => t.trim()).filter(t => t);
    if (tokens.length > 0) {
      // 随机选择一个 token
      const randomIndex = Math.floor(Math.random() * tokens.length);
      return tokens[randomIndex];
    }
  }

  // 也支持直接传入 token（向后兼容）
  const tokens = authHeader.split(',').map(t => t.trim()).filter(t => t);
  if (tokens.length > 0) {
    const randomIndex = Math.floor(Math.random() * tokens.length);
    return tokens[randomIndex];
  }

  return null;
}

// 代理配置
const proxyOptions = {
  target: 'https://api.fish.audio',
  changeOrigin: true,
  pathRewrite: {
    '^/v1': '/v1', // 保持路径不变
  },
  // 对于二进制响应，确保流式传输
  buffer: false, // 禁用缓冲，直接流式传输
  onProxyReq: (proxyReq, req, res) => {
    // 从请求头中获取 API keys
    const authHeader = req.headers['authorization'] || req.headers['x-fish-api-key'];
    
    if (authHeader) {
      const selectedKey = getRandomApiKey(authHeader);
      if (selectedKey) {
        // 设置选中的 Bearer token
        proxyReq.setHeader('Authorization', `Bearer ${selectedKey}`);
        console.log(`[${new Date().toISOString()}] Using API key: ${selectedKey.substring(0, 10)}...`);
      }
    }

    // 转发 model header（Fish Audio 需要在 header 中指定 model）
    if (req.headers['model']) {
      proxyReq.setHeader('model', req.headers['model']);
    }

    // 移除可能存在的代理相关 header
    proxyReq.removeHeader('x-fish-api-key');
    
    // 记录请求信息
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // 记录响应状态和类型
    console.log(`[${new Date().toISOString()}] Response: ${proxyRes.statusCode}, Content-Type: ${proxyRes.headers['content-type']}`);
    
    // 对于二进制响应（音频），确保正确设置响应头
    if (proxyRes.headers['content-type'] && 
        (proxyRes.headers['content-type'].startsWith('audio/') || 
         proxyRes.headers['content-type'].startsWith('application/octet-stream'))) {
      // 确保响应头正确传递
      res.setHeader('Content-Type', proxyRes.headers['content-type']);
      res.setHeader('Content-Length', proxyRes.headers['content-length'] || '');
      // 禁用压缩，确保二进制数据正确传输
      res.removeHeader('Content-Encoding');
    }
  },
  onError: (err, req, res) => {
    console.error(`[${new Date().toISOString()}] Proxy error:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Proxy error',
        message: err.message
      });
    }
  }
};

// 根路径 - 返回服务信息
app.get('/', (req, res) => {
  res.json({
    service: 'fishaudio-proxy',
    version: '1.0.0',
    description: 'A proxy server for Fish Audio API with multi-key management',
    endpoints: {
      tts: '/v1/tts',
      stt: '/v1/stt',
      liveTTS: '/v1/tts-live (WebSocket - Docker only)',
      health: '/health'
    },
    usage: {
      authorization: 'Bearer YOUR_API_KEY_1,YOUR_API_KEY_2,YOUR_API_KEY_3',
      model: 's1, speech-1.6, or speech-1.5 (in header)'
    },
    documentation: 'https://docs.fish.audio/api-reference/introduction',
    note: 'WebSocket support is only available in Docker deployment, not in Vercel'
  });
});

// 处理 HTTP 请求（TTS 和 STT）
app.use('/v1', createProxyMiddleware(proxyOptions));

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'fishaudio-proxy' });
});

// Vercel serverless function 导出
module.exports = app;

