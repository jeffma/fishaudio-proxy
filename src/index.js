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
const WebSocket = require('ws');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// 解析 JSON 请求体
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
  selfHandleResponse: false, // 让 http-proxy-middleware 自动处理响应
  buffer: false, // 禁用缓冲，直接流式传输
  // 禁用 keep-alive，确保连接在响应完成后关闭
  xfwd: true, // 添加 X-Forwarded-* headers
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
    
    // 禁用 keep-alive
    proxyReq.setHeader('Connection', 'close');
    
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
      if (proxyRes.headers['content-length']) {
        res.setHeader('Content-Length', proxyRes.headers['content-length']);
      }
      // 禁用压缩，确保二进制数据正确传输
      res.removeHeader('Content-Encoding');
      // 禁用 keep-alive，确保连接在响应完成后关闭
      res.setHeader('Connection', 'close');
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

// 处理 HTTP 请求（TTS 和 STT）
// 对于 /v1/tts 端点，使用特殊的流式处理
app.post('/v1/tts', async (req, res, next) => {
  // 手动处理 TTS 请求，确保二进制响应正确传输
  const authHeader = req.headers['authorization'] || req.headers['x-fish-api-key'];
  const selectedKey = getRandomApiKey(authHeader);
  
  if (!selectedKey) {
    return res.status(401).json({ error: 'Unauthorized - API key required' });
  }

  try {
    const https = require('https');
    const options = {
      hostname: 'api.fish.audio',
      path: '/v1/tts',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${selectedKey}`,
        'Content-Type': 'application/json',
        'Connection': 'close'
      }
    };

    if (req.headers['model']) {
      options.headers['model'] = req.headers['model'];
    }

    const proxyReq = https.request(options, (proxyRes) => {
      // 设置响应头
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'audio/mpeg');
      if (proxyRes.headers['content-length']) {
        res.setHeader('Content-Length', proxyRes.headers['content-length']);
      }
      res.setHeader('Connection', 'close');
      res.status(proxyRes.statusCode);

      // 流式传输响应数据
      proxyRes.on('data', (chunk) => {
        res.write(chunk);
      });

      proxyRes.on('end', () => {
        res.end();
        console.log(`[${new Date().toISOString()}] TTS response completed`);
      });

      proxyRes.on('error', (err) => {
        console.error(`[${new Date().toISOString()}] Proxy response error:`, err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Proxy response error', message: err.message });
        } else {
          res.end();
        }
      });
    });

    proxyReq.on('error', (err) => {
      console.error(`[${new Date().toISOString()}] Proxy request error:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Proxy request error', message: err.message });
      }
    });

    // 发送请求体
    proxyReq.write(JSON.stringify(req.body));
    proxyReq.end();
  } catch (err) {
    console.error(`[${new Date().toISOString()}] TTS handler error:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Handler error', message: err.message });
    }
  }
});

// 其他 /v1 路径使用标准代理
app.use('/v1', createProxyMiddleware(proxyOptions));

// WebSocket 代理处理（用于 live TTS）
const server = http.createServer(app);

const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  
  // 只处理 /v1/tts-live WebSocket 连接
  if (pathname === '/v1/tts-live') {
    // 从请求头中获取 API keys
    const authHeader = request.headers['authorization'] || request.headers['x-fish-api-key'];
    const selectedKey = getRandomApiKey(authHeader);
    
    if (!selectedKey) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // 连接到 Fish Audio WebSocket
    const targetUrl = 'wss://api.fish.audio/v1/tts-live';
    const fishWs = new WebSocket(targetUrl, {
      headers: {
        'Authorization': `Bearer ${selectedKey}`,
        'model': request.headers['model'] || 's1'
      }
    });

    fishWs.on('open', () => {
      console.log(`[${new Date().toISOString()}] WebSocket connected to Fish Audio`);
      wss.handleUpgrade(request, socket, head, (ws) => {
        // 双向转发消息
        ws.on('message', (message) => {
          if (fishWs.readyState === WebSocket.OPEN) {
            fishWs.send(message);
          }
        });

        fishWs.on('message', (message) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
          }
        });

        ws.on('close', () => {
          console.log(`[${new Date().toISOString()}] Client WebSocket closed`);
          if (fishWs.readyState === WebSocket.OPEN) {
            fishWs.close();
          }
        });

        fishWs.on('close', () => {
          console.log(`[${new Date().toISOString()}] Fish Audio WebSocket closed`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        });

        ws.on('error', (error) => {
          console.error(`[${new Date().toISOString()}] Client WebSocket error:`, error);
        });

        fishWs.on('error', (error) => {
          console.error(`[${new Date().toISOString()}] Fish Audio WebSocket error:`, error);
        });
      });
    });

    fishWs.on('error', (error) => {
      console.error(`[${new Date().toISOString()}] Failed to connect to Fish Audio WebSocket:`, error);
      socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      socket.destroy();
    });
  } else {
    socket.destroy();
  }
});

// 根路径 - 返回服务信息
app.get('/', (req, res) => {
  res.json({
    service: 'fishaudio-proxy',
    version: '1.0.0',
    description: 'A proxy server for Fish Audio API with multi-key management',
    endpoints: {
      tts: '/v1/tts',
      stt: '/v1/stt',
      liveTTS: '/v1/tts-live (WebSocket)',
      health: '/health'
    },
    usage: {
      authorization: 'Bearer YOUR_API_KEY_1,YOUR_API_KEY_2,YOUR_API_KEY_3',
      model: 's1, speech-1.6, or speech-1.5 (in header)'
    },
    documentation: 'https://docs.fish.audio/api-reference/introduction'
  });
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'fishaudio-proxy' });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Fish Audio Proxy server is running on port ${PORT}`);
  console.log(`[${new Date().toISOString()}] Target API: https://api.fish.audio`);
});

