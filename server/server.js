const express = require('express');//引入 Express 框架,托管前端页面
const http = require('http');//创建HTTP服务器，处理 HTTP 协议
const net = require('net');//处理TCP网络连接
const WebSocket = require('ws');//客户端与服务端双向通信，实时收发数据
const app = express();//// 创建express应用实例
const server = http.createServer(app);//创建HTTP服务器，并将express挂载到服务器上
const wss = new WebSocket.Server({ server });// 创建WebSocket服务端实例

//导入mysql模块
const mysql = require('mysql2/promise');

// 原始ADC值初始化
let latestSensorData = { 
  heartSound1:0, rawValue1: 0, 
  heartSound2:0, rawValue2: 0, 
  heartSound3:0, rawValue3: 0, 
  heartSound4:0, rawValue4: 0  
}; 

const TCP_PORT = 6789;  //监听TCP端口
const HTTP_PORT = 8081; //浏览器访问http端口

//阿里云MySQL数据库配置
const dbConfig = {
  host: 'rm-bp1gp3217r50dfsc0qo.mysql.rds.aliyuncs.com', // RDS外网地址
  port: 3306,                                         // 默认端口
  user: 'sensor_data',                                 // 数据库账号
  password: 'Dlt2023222_',                           //账号密码
  database: 'sensor_data'                              //数据库名
};

// 创建数据库连接池，提高稳定性
const dbPool = mysql.createPool(dbConfig);

// 托管前端页面
app.use(express.static('public'));
app.use(express.json());

const FRAME_HEAD = 0xFA; // 帧头 
const FRAME_TAIL = 0xFB; // 帧尾 
const FRAME_FIX_LEN = 10; // 帧固定长度 

//数据保存到云端的函数
async function saveToCloud(heartVal, tempVal, lightVal, voltVal) {
  try {
    // 执行SQL插入数据
    const [result] = await dbPool.execute(
      'INSERT INTO sensor_real_time (heart_sound, temperature, light, voltage) VALUES (?, ?, ?, ?)',
      [heartVal, tempVal, lightVal, voltVal]
    );
    console.log(`☁️ 云端保存成功 → 数据ID:${result.insertId} | 心音:${heartVal} 温度:${tempVal} 光强:${lightVal} 电压:${voltVal}`);
  } catch (err) {
    console.error('❌ 云端保存失败:', err.message);
  }
}

// TCP服务器 
const tcpServer = net.createServer((socket) => {
  console.log(`✅ 客户端连接成功: ${socket.remoteAddress}:${socket.remotePort}`);
  socket.tcpBuffer = Buffer.alloc(0); // TCP缓存 
  socket.setKeepAlive(true, 10000); //保活机制
  socket.setNoDelay(true); //TCP立即发数据，无延迟
  socket.setTimeout(30000); //超时断开

//监听，接收数据 
  socket.on('data', (data) => {
    if(!Buffer.isBuffer(data)) {
        console.warn('⚠️ 收到非Buffer数据，丢弃');
        return;
    }
    console.log(`🍕 本次接收到TCP数据长度: ${data.length} 字节`);
    socket.tcpBuffer = Buffer.concat([socket.tcpBuffer, data]);//缓存拼接
    console.log(`📦 缓存区拼接后总长度: ${socket.tcpBuffer.length} 字节`);

    while (socket.tcpBuffer.length >= FRAME_FIX_LEN) {
      //寻找帧头
        const headIndex = socket.tcpBuffer.indexOf(FRAME_HEAD);
        if (headIndex === -1) {
            console.warn('⚠️ 缓存区无帧头，清空无效数据');
            socket.tcpBuffer = Buffer.alloc(0);
            break;
        }
        if (headIndex + FRAME_FIX_LEN > socket.tcpBuffer.length) {
            console.log(`ℹ️ 帧头后数据不足，等待补全 | 缓存区剩余: ${socket.tcpBuffer.length} 字节`);
            break;
        }
        //寻找帧尾，从帧头开始寻找  indexof（目标，起始位置）
        const tailIndex = socket.tcpBuffer.indexOf(FRAME_TAIL, headIndex + 1);
        if (tailIndex === -1) {
            console.log(`ℹ️ 找到帧头但未找到帧尾，等待后续数据补全 | 缓存区剩余: ${socket.tcpBuffer.length} 字节`);
            socket.tcpBuffer = socket.tcpBuffer.slice(headIndex + 1); // 丢弃错误帧头，防止缓存溢出
            break;
        }
        //组成一帧完整数据
        const completeFrame = socket.tcpBuffer.slice(headIndex, tailIndex + 1);
        console.log(`✅ 解析到完整1帧数据 | 帧内容(16进制): ${completeFrame.toString('hex').toUpperCase()} | 帧长度: ${completeFrame.length} 字节`);
            //ADC值还原   高低字节重组
            //心音
            const heartHighByte = completeFrame[1]; 
            const heartLowByte = completeFrame[2];  
            const rawHeartVal = heartHighByte * 128 + heartLowByte;
            //温度
            const tempHighByte = completeFrame[3]; 
            const tempLowByte = completeFrame[4];  
            const rawTempVal = tempHighByte * 128 + tempLowByte;
            //光强
            const lightHighByte = completeFrame[5]; 
            const lightLowByte = completeFrame[6];  
            const rawLightVal = lightHighByte * 128 + lightLowByte;
            //电压
            const voltHighByte = completeFrame[7]; 
            const voltLowByte = completeFrame[8];  
            const rawVoltVal = voltHighByte * 128 + voltLowByte;

            
            // 原生数据直接推送
            latestSensorData = { 
              heartSound1: rawHeartVal,
              rawValue1: rawHeartVal,
              heartSound2: rawTempVal,
              rawValue2: rawTempVal,
              heartSound3: rawLightVal,
              rawValue3: rawLightVal,
              heartSound4: rawVoltVal,
              rawValue4: rawVoltVal
            };
            
            console.log(`📥 帧解析成功 → 心音原始值:${rawHeartVal}, 温度原始值:${rawTempVal}, 光强原始值:${rawLightVal}, 电压原始值:${rawVoltVal}`);

            // 调用云端保存函数
            saveToCloud(rawHeartVal, rawTempVal, rawLightVal, rawVoltVal);

            // 实时推送给前端WebSocket
            wss.clients.forEach(client => {
              try {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify(latestSensorData));
                }
              } catch (err) {
                  console.warn('⚠️ WebSocket推送失败:', err.message);
              }
            });
            socket.tcpBuffer = socket.tcpBuffer.slice(tailIndex + 1);
            console.log(`♻️ 缓存区截取后剩余长度: ${socket.tcpBuffer.length} 字节`);
        }

  });
//错误处理
socket.on('close', (hadError) => {
  console.log(`❌ 客户端断开连接 ${hadError ? '【异常断开】' : '【正常断开】'}`);
  socket.tcpBuffer = Buffer.alloc(0);
});
socket.on('error', (err) => {
  console.error('❌ TCP连接错误:', err.message);
  socket.tcpBuffer = Buffer.alloc(0); 
});
socket.on('timeout', () => {
  console.warn('⚠️ TCP连接超时，主动断开');
  socket.tcpBuffer = Buffer.alloc(0);
  socket.end();
});
});


wss.on('connection', (ws) => {
  console.log('✅ 前端页面WebSocket连接成功');
  // WebSocket前端连接，实时连续推送数据 
  ws.send(JSON.stringify(latestSensorData));

  ws.on('close', () => {
    console.log('❌ 前端页面WebSocket断开连接');
  });
  ws.on('error', (err) => {
    console.warn('⚠️ WebSocket前端错误:', err.message);
   
  });
});

// HTTP接口 (返回4路原始数据) 
app.get('/', (req, res) => res.send('多参数实时监测 ✔️ 心音+温度+光强+电压 | 云端存储版 | 帧头FA-帧尾FB协议'));
app.get('/api', (req, res) => res.json(latestSensorData));

// 端口占用异常捕获
tcpServer.listen(TCP_PORT, '0.0.0.0', (err) => {
  if(err) return console.error(`❌ TCP端口${TCP_PORT}启动失败:`, err.message);
  console.log(`✅ TCP测试服务器启动，监听端口 ${TCP_PORT}`);
});
server.listen(HTTP_PORT, '0.0.0.0', (err) => {
  if(err) return console.error(`❌ HTTP端口${HTTP_PORT}启动失败:`, err.message);
  console.log(`✅ 前端服务启动：http://localhost:${HTTP_PORT}`);
});