const net = require('net');

// 配置
const CONFIG = {
  host: 'localhost',    // 目标地址
  port: 6789,           // 目标端口
  interval: 800,       // 发送间隔（毫秒）
  minValue: 100,          // 传感器最小值
  maxValue: 900        // 传感器最大值
};

// 生成随机16位ADC值
function getRandomADC() {
  const value = Math.floor(Math.random() * (CONFIG.maxValue - CONFIG.minValue + 1)) + CONFIG.minValue;
  const highByte = Math.floor(value / 128); // 高7位
  const lowByte = value % 128;              // 低7位
  return [highByte, lowByte];
}

// 封装帧数据
function buildFrame() {
  const heart = getRandomADC();  // 心音
  const temp = getRandomADC();   // 温度
  const light = getRandomADC();  // 光强
  const volt = getRandomADC();   // 电压

  // 组装10字节帧：FA(帧头) + 心音高低 + 温度高低 + 光强高低 + 电压高低 + FB(帧尾)
  const frame = Buffer.from([
    0xFA, 
    heart[0], heart[1],
    temp[0], temp[1],
    light[0], light[1],
    volt[0], volt[1],
    0xFB
  ]);

  // 返回帧和解析后的值
  return {
    frame: frame,
    heartVal: heart[0] * 128 + heart[1],
    tempVal: temp[0] * 128 + temp[1],
    lightVal: light[0] * 128 + light[1],
    voltVal: volt[0] * 128 + volt[1]
  };
}

// 建立TCP连接，持续发送随机数据
function startAutoSend() {
  const client = new net.Socket();
  let sendInterval = null; // 定时器对象，用于停止发送

  // 连接到服务端
  client.connect(CONFIG.port, CONFIG.host, () => {
    console.log(`✅ 已连接到 ${CONFIG.host}:${CONFIG.port}`);
    console.log(`📡 开始每 ${CONFIG.interval}ms 发送随机传感器数据（按 Ctrl+C 停止）...`);
    
    // 定时发送数据
    sendInterval = setInterval(() => {
      const { frame, heartVal, tempVal, lightVal, voltVal } = buildFrame();
      client.write(frame);
      // 打印发送的帧信息
      console.log(`📤 发送帧: ${frame.toString('hex').toUpperCase()} | 心音:${heartVal} 温度:${tempVal} 光强:${lightVal} 电压:${voltVal}`);
    }, CONFIG.interval);
  });

  // 错误处理
  client.on('error', (err) => {
    console.error('❌ 连接错误:', err.message);
    clearInterval(sendInterval); // 清除定时器
    setTimeout(startAutoSend, 3000); // 3秒后自动重连
  });

  // 断开后重连
  client.on('close', () => {
    console.warn('⚠️ 连接断开，3秒后自动重连...');
    clearInterval(sendInterval); // 清除定时器
    setTimeout(startAutoSend, 3000); // 3秒后自动重连
  });

  // 监听退出信号
  process.on('SIGINT', () => {
    console.log('\n🛑 手动停止发送，关闭连接...');
    clearInterval(sendInterval);
    client.destroy();
    process.exit(0);
  });
}

// 启动自动发送
startAutoSend();