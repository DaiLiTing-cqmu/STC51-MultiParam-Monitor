# STC51-MultiParam-Monitor
基于 STC51 的多参数采集与 Web 可视化系统

---

## 一、项目简介
    为解决实际医疗中的生理信号检测的局限性，面向居家养老、社区医疗等轻量化监测场景，搭建了集「硬件采集 — 无线传输 — 云端存储 —Web 可视化」的全链路多参数信号监测系统，实现数据的实时采集、云端持久化存储与可视化展示，提供低成本、易部署的便携式信号监测方案。
### 1.技术栈
  - **硬件**：
  STC51 单片机（ADC多参数采集、串口/TCP传输）、PCB原理图设计
  - **服务端**：
  Node.js（Express + WebSocket + Net）、阿里云 RDS MySQL
  - **前端**：
  HTML + ECharts 实时波形可视化
  - **协议**：
  自定义 FA/FB 双校验固定帧（10 字节）
  
---

## 二、硬件模块说明
- `main.c`：STC51单片机核心程序，实现ADC采集多参数（心音/温度/光强/电压），并通过串口/TCP发送数据
- `PCB_main.pdf`：硬件原理图，包含STC51最小系统、ADC采集电路、通信电路等

---

## 三、项目结构
```plaintext
STC51-MultiParam-Monitor/
├── hardware/ # 51 单片机代码 + 硬件原理图
│ ├── main.c # STC51 采集主程序
│ └── PCB_main.pdf # 硬件原理图
├── server/ # Node.js 服务端（核心）
├── web/ # 前端可视化页面
├── sql/ # 数据库建表脚本
├── .gitignore # Git 忽略配置
└── README.md # 项目说明
```

---

## 四、快速部署
### 1. 安装依赖
```bash
cd server
npm install
```
### 2. 数据库初始化
执行 sql/sensor_table.sql 创建数据表。
### 3. 修改数据库配置
修改 server/server.js 中的阿里云 RDS 配置：
```javascript

const dbConfig = {
  host: '你的阿里云RDS地址',
  port: 3306,
  user: '你的账号',
  password: '你的密码',
  database: 'sensor_data'
};
```
### 4. 启动服务
```bash
node server.js
```

### 5. 访问前端
浏览器访问：http://localhost:8081

---

## 五、功能亮点
   - 多参数 ADC 实时采集（心音、温度、光强、电压）
   - 自定义帧协议，数据还原率 99%+
   - WebSocket 低延迟实时波形可视化
   - 阿里云 RDS 云端存储 + 历史数据查询
